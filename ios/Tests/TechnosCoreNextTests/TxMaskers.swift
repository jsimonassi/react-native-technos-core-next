import Foundation

/// Zera, num pacote TX, os campos que mudam legitimamente entre a gravação e o replay. Pode guardar estado entre pacotes.
protocol PacketMasker: AnyObject {
	func mask(_ packet: [UInt8]) -> [UInt8]
	/// `cmd/key` do pacote se ele começa um frame de dados (para o teste saber em que ponto a conversa está).
	func frameKey(_ packet: [UInt8]) -> String?
}

private func hex2(_ value: UInt8) -> String { String(format: "%02X", value) }

/// Port da `TxMasker` do kit de teste do Repo 1 (`ReplayDriver.kt`): seq (bytes 6..7) de todo frame SMA e, no `02/01`
/// SET_TIME, o CRC (bytes 4..5) e o value (offset 13 em diante, inclusive nas continuações).
final class SmaTxMasker: PacketMasker {
	private static let headerSize = 8
	private static let setTimeValueOffset = 13
	private var remaining = 0
	private var offset = 0
	private var valueFrom = -1

	func mask(_ packet: [UInt8]) -> [UInt8] {
		var out = packet
		if remaining > 0 {
			for index in out.indices where valueFrom >= 0 && offset + index >= valueFrom { out[index] = 0 }
			offset += out.count
			remaining -= out.count
			if remaining <= 0 { reset() }
			return out
		}
		guard out.count >= SmaTxMasker.headerSize, out[0] == 0xAB else { return out }
		out[6] = 0
		out[7] = 0
		if SmaTxMasker.isControl(packet) { return out }
		let total = SmaTxMasker.headerSize + (Int(out[2]) << 8 | Int(out[3]))
		let isSetTime = out.count > 10 && out[8] == 0x02 && out[10] == 0x01
		if isSetTime {
			out[4] = 0
			out[5] = 0
		}
		valueFrom = isSetTime ? SmaTxMasker.setTimeValueOffset : -1
		for index in out.indices where valueFrom >= 0 && index >= valueFrom { out[index] = 0 }
		offset = out.count
		remaining = total - out.count
		if remaining <= 0 { reset() }
		return out
	}

	func frameKey(_ packet: [UInt8]) -> String? {
		guard packet.count > 10, packet[0] == 0xAB, !SmaTxMasker.isControl(packet) else { return nil }
		return "\(hex2(packet[8]))/\(hex2(packet[10]))"
	}

	static func isControl(_ packet: [UInt8]) -> Bool {
		packet.count == headerSize && packet[0] == 0xAB && packet[1] & 0x10 != 0
	}

	private func reset() {
		remaining = 0
		offset = 0
		valueFrom = -1
	}
}

/// Port da `IdoTxMasker`: no `03/01` (acerto de hora) zera data, hora e dia da semana (bytes 2 a 9); o fuso fica.
final class IdoTxMasker: PacketMasker {
	func mask(_ packet: [UInt8]) -> [UInt8] {
		var out = packet
		if out.count >= 10, out[0] == 0x03, out[1] == 0x01 {
			for index in 2...9 { out[index] = 0 }
		}
		return out
	}

	func frameKey(_ packet: [UInt8]) -> String? {
		guard packet.count >= 2 else { return nil }
		return "\(hex2(packet[0]))/\(hex2(packet[1]))"
	}
}

/// Port da `CrpTxMasker` (`CrpReplay.kt` do kit de teste do Repo 1). Guarda estado entre pacotes, porque um frame pode
/// ocupar várias escritas (com bloco de 20, um `F2 02` sai em três; as continuações não têm cabeçalho). Bytes mascarados
/// viram `00`:
/// - no frame `31` (acerto de hora, `len` `0x0A`), os bytes 5 a 8, os segundos que dependem do relógio do replay
///   (parado no `recordedAt`); o `08` do fim fica;
/// - num frame com dado pessoal (`privatePrefix`: `12`, `75`, `41`, `42`, `43`, `B5`, `F2 02`), o payload depois do
///   prefixo mantido, até o fim do frame, inclusive nas continuações. A gravação já tem esses bytes zerados (o driver
///   redige o que vai para o `WatchLogger.frame`: ADR 36 do Repo 1, D14 da fase 2) e o replay escreve os reais, então o
///   TX privado é comparado por `(cmd, sub, tamanho)` nos multiplexados (`B5` mantém o sub; `F2 02`, o `02` e o id) e
///   por `(cmd, tamanho)` nos outros.
///
/// Todos os outros frames (inclusive o fuso `BB 07 00` e o `41 FF` de fim de ligação) são comparados inteiros.
final class CrpTxMasker: PacketMasker {
	private static let headerSize = 5
	private static let setTimeLength = 0x0A
	private static let setTime: UInt8 = 0x31

	/// Bytes que faltam do frame atual (continuações); zero fora de um frame.
	private var remaining = 0
	/// Offset, no frame atual, do primeiro byte a zerar (`-1` = nenhum).
	private var zeroFrom = -1
	/// Bytes do frame atual já vistos.
	private var offset = 0

	func mask(_ packet: [UInt8]) -> [UInt8] {
		var out = packet
		if remaining > 0 {
			for index in out.indices where zeroFrom >= 0 && offset + index >= zeroFrom { out[index] = 0 }
			offset += out.count
			remaining -= out.count
			if remaining <= 0 { reset() }
			return out
		}
		guard let total = CrpTxMasker.totalLength(out) else { return out }
		let cmd = out[4]
		let payload = Array(out[CrpTxMasker.headerSize..<min(out.count, total)])
		// O primeiro pacote tem pelo menos 15 bytes de payload (bloco de 20), o bastante para o prefixo e o sub; o `41 FF`
		// tem 6 bytes e sempre cabe inteiro.
		zeroFrom = CrpTxMasker.privatePrefix(cmd: cmd, payload: payload).map { CrpTxMasker.headerSize + $0 } ?? -1
		if cmd == CrpTxMasker.setTime, total == CrpTxMasker.setTimeLength, out.count >= CrpTxMasker.setTimeLength {
			for index in 5...8 { out[index] = 0 }
		}
		for index in out.indices where zeroFrom >= 0 && index >= zeroFrom && index < total { out[index] = 0 }
		offset = out.count
		remaining = total - out.count
		if remaining <= 0 { reset() }
		return out
	}

	/// `cmd` ou `cmd/sub` (o primeiro byte do payload), um nível só: `5A/00`, `B7/0E`, `BB/16`, `31`, `BB/07`, `59/00`,
	/// `33/01`, `32`, `F8`, `61`, `53/0E`. O `CrpReplayScenario` do Repo 1 usa dois níveis no `B6`, `B9` e `BB` (`BB/16/00`);
	/// aqui um nível basta para saber em que ponto a conversa está. O `31` fica sem sub (o payload é a hora), e um frame
	/// privado só mostra o prefixo que a redação mantém (`12`, `41`, `B5/00`, `F2/02`), para a chave nunca levar dado
	/// pessoal. Sem estado: um pacote de continuação devolve `nil`, porque não começa com `FE EA`.
	func frameKey(_ packet: [UInt8]) -> String? {
		guard let total = CrpTxMasker.totalLength(packet), packet.count >= 5 else { return nil }
		let cmd = packet[4]
		if cmd == CrpTxMasker.setTime || total <= 5 || packet.count <= 5 { return hex2(cmd) }
		let payload = Array(packet[CrpTxMasker.headerSize..<min(packet.count, total)])
		if CrpTxMasker.privatePrefix(cmd: cmd, payload: payload) == 0 { return hex2(cmd) }
		return "\(hex2(cmd))/\(hex2(packet[5]))"
	}

	/// Cópia do `CrpCommand.privatePrefix` do Repo 1 (ADR 36): quantos bytes do payload ficam na gravação; o resto é
	/// zerado, do mesmo tamanho. `nil` quando o frame não é privado e vai inteiro.
	/// - `12` (perfil), `75` (ciclo menstrual), `42` (previsão) e `43` (clima de hoje, com a cidade) → 0;
	/// - `41` (notificação) → 0, menos o payload exato `FF` (fim de ligação), que não tem dado;
	/// - `B5` → 1 (o sub: `00` clima de hoje, `01` mensagens de SOS);
	/// - `F2 02` (um contato) → 2 (o `02` e o id); os outros subs do `F2` não são privados.
	static func privatePrefix(cmd: UInt8, payload: [UInt8]) -> Int? {
		switch cmd {
		case 0x12, 0x75, 0x42, 0x43: return 0
		case 0x41: return payload == [0xFF] ? nil : 0
		case 0xB5: return 1
		case 0xF2: return payload.first == 0x02 ? 2 : nil
		default: return nil
		}
	}

	/// Comprimento total do frame (`FE EA` e nibble alto do byte 2 em 1, 2 ou 3; 12 bits sem sinal), ou `nil` se o
	/// pacote não começa um frame (`CrpFrameCodec.totalLength`).
	static func totalLength(_ packet: [UInt8]) -> Int? {
		guard packet.count >= 5, packet[0] == 0xFE, packet[1] == 0xEA else { return nil }
		let high = packet[2] >> 4
		guard (1...3).contains(high) else { return nil }
		let total = Int(packet[2] & 0x0F) << 8 | Int(packet[3])
		return total < 5 ? nil : total
	}

	private func reset() {
		remaining = 0
		zeroFrom = -1
		offset = 0
	}
}

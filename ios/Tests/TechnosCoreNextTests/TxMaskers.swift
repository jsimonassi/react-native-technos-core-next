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

/// Port da `CrpTxMasker` (`CrpReplay.kt` do kit de teste do Repo 1): no frame `31` (acerto de hora, `FE EA b2 0A 31`)
/// zera os bytes 5 a 8, os segundos que dependem do relógio do replay; o `08` do fim e todos os outros frames (inclusive
/// o fuso `BB 07 00`) são comparados inteiros. Todo frame da fase 1 cabe num pacote, então não há estado.
final class CrpTxMasker: PacketMasker {
	private static let setTimeLength = 0x0A
	private static let setTime: UInt8 = 0x31

	func mask(_ packet: [UInt8]) -> [UInt8] {
		var out = packet
		if CrpTxMasker.totalLength(out) == CrpTxMasker.setTimeLength, out.count >= CrpTxMasker.setTimeLength, out[4] == CrpTxMasker.setTime {
			for index in 5...8 { out[index] = 0 }
		}
		return out
	}

	/// `cmd` ou `cmd/sub` (o primeiro byte do payload), como os rótulos do `CrpReplayScenario`: `5A/00`, `B7/0E`, `BB/16`,
	/// `31`, `BB/07`, `59/00`, `33/01`, `32`, `F8`. O `31` fica sem sub (o payload é a hora).
	func frameKey(_ packet: [UInt8]) -> String? {
		guard let total = CrpTxMasker.totalLength(packet), packet.count >= 5 else { return nil }
		let cmd = packet[4]
		if cmd == CrpTxMasker.setTime || total <= 5 || packet.count <= 5 { return hex2(cmd) }
		return "\(hex2(cmd))/\(hex2(packet[5]))"
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
}

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

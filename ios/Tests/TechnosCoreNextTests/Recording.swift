import Foundation
import TechnosWatchProtocol

/// Uma gravação `.jsonl` do Repo 1 (`docs/fixtures.md` de lá): cabeçalho e pacotes GATT crus. Leitor mínimo, par do
/// `RecordingLoader` do kit de teste do Repo 1.
struct Recording {
	struct Packet {
		let tx: Bool
		let characteristic: String
		let value: [UInt8]
	}

	let source: String
	let device: String
	let firmware: String?
	let mtu: Int32
	let recordedAt: Date
	let timeZone: TimeZone
	let packets: [Packet]

	var txCount: Int { packets.filter(\.tx).count }

	enum LoadError: Error, CustomStringConvertible {
		case unreadable(String)
		case badHeader(String)
		case badPacket(String, Int)

		var description: String {
			switch self {
			case let .unreadable(path): return "unreadable recording \(path)"
			case let .badHeader(path): return "bad header in \(path)"
			case let .badPacket(path, line): return "bad packet at line \(line) of \(path)"
			}
		}
	}

	static func load(_ url: URL) throws -> Recording {
		guard let text = try? String(contentsOf: url, encoding: .utf8) else { throw LoadError.unreadable(url.path) }
		let lines = text.split(whereSeparator: \.isNewline).map(String.init).filter { !$0.isEmpty }
		guard
			let first = lines.first,
			let header = try JSONSerialization.jsonObject(with: Data(first.utf8)) as? [String: Any],
			header["type"] as? String == "header",
			let device = header["device"] as? String,
			let mtu = (header["mtu"] as? NSNumber)?.int32Value,
			let recordedAtText = header["recordedAt"] as? String,
			let recordedAt = parseIso(recordedAtText),
			let zoneId = header["timeZone"] as? String,
			let zone = TimeZone(identifier: zoneId)
		else { throw LoadError.badHeader(url.path) }
		var packets: [Packet] = []
		for (offset, line) in lines.dropFirst().enumerated() {
			guard let object = try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] else {
				throw LoadError.badPacket(url.path, offset + 2)
			}
			guard object["type"] as? String == "packet" else { continue }
			guard
				let dir = object["dir"] as? String,
				let characteristic = object["characteristic"] as? String,
				let hex = object["hex"] as? String,
				let bytes = decodeHex(hex)
			else { throw LoadError.badPacket(url.path, offset + 2) }
			packets.append(Packet(tx: dir == "TX", characteristic: characteristic, value: bytes))
		}
		return Recording(
			source: url.lastPathComponent,
			device: device,
			firmware: header["firmware"] as? String,
			mtu: mtu,
			recordedAt: recordedAt,
			timeZone: zone,
			packets: packets
		)
	}

	static func parseIso(_ text: String) -> Date? {
		let withFraction = ISO8601DateFormatter()
		withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
		if let date = withFraction.date(from: text) { return date }
		let plain = ISO8601DateFormatter()
		plain.formatOptions = [.withInternetDateTime]
		return plain.date(from: text)
	}

	static func decodeHex(_ hex: String) -> [UInt8]? {
		let chars = Array(hex.utf8)
		guard chars.count % 2 == 0 else { return nil }
		var out: [UInt8] = []
		out.reserveCapacity(chars.count / 2)
		var index = 0
		while index < chars.count {
			guard let high = nibble(chars[index]), let low = nibble(chars[index + 1]) else { return nil }
			out.append(high << 4 | low)
			index += 2
		}
		return out
	}

	private static func nibble(_ char: UInt8) -> UInt8? {
		switch char {
		case UInt8(ascii: "0")...UInt8(ascii: "9"): return char - UInt8(ascii: "0")
		case UInt8(ascii: "A")...UInt8(ascii: "F"): return char - UInt8(ascii: "A") + 10
		case UInt8(ascii: "a")...UInt8(ascii: "f"): return char - UInt8(ascii: "a") + 10
		default: return nil
		}
	}

	static func hex(_ bytes: [UInt8]) -> String {
		bytes.map { String(format: "%02X", $0) }.joined()
	}
}

/// Onde ficam as fixtures do Repo 1: `TWP_FIXTURES_DIR` (no `xcodebuild test`, `TEST_RUNNER_TWP_FIXTURES_DIR`) ou o
/// clone irmão `../technos-watch-protocol/fixtures`, achado a partir deste arquivo-fonte (o simulador enxerga o disco
/// do Mac, como no `iosSimulatorArm64Test` do Repo 1).
enum Fixtures {
	static func root() throws -> URL {
		if let override = ProcessInfo.processInfo.environment["TWP_FIXTURES_DIR"], !override.isEmpty {
			return URL(fileURLWithPath: override, isDirectory: true)
		}
		// ios/Tests/TechnosCoreNextTests/Recording.swift → raiz do Repo 2 → irmão technos-watch-protocol.
		let repo2 = URL(fileURLWithPath: #filePath)
			.deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
		let root = repo2.deletingLastPathComponent().appendingPathComponent("technos-watch-protocol/fixtures", isDirectory: true)
		guard FileManager.default.fileExists(atPath: root.path) else {
			throw Recording.LoadError.unreadable("\(root.path) (set TWP_FIXTURES_DIR)")
		}
		return root
	}

	static func load(_ relativePath: String) throws -> Recording {
		try Recording.load(root().appendingPathComponent(relativePath))
	}
}

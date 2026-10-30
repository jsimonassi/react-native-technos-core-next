import Foundation
import TechnosWatchProtocol

/// Gravação dos pacotes GATT crus no formato de fixture do Repo 1 (`FrameJsonl`, `docs/fixtures.md` de lá), par do
/// `FrameRecorder` do Android.
///
/// Os pacotes ficam em memória e só viram arquivo em `write(to:)`, chamado pelo `exportLogs()`: o cabeçalho (primeira
/// linha) leva firmware e MTU, que só se conhecem depois do handshake. Acima de `maxPackets` a gravação para (o
/// chamador avisa no log uma vez), em vez de descartar os mais antigos, porque uma fixture sem o começo não reproduz.
///
/// Thread-safe (`NSLock`): `record` vem da thread da sessão; o resto, da thread do TurboModule.
final class FrameRecorder {
	static let defaultMaxPackets = 50_000

	private let maxPackets: Int
	private let now: () -> Int64
	private let timeZone: () -> TimeZone
	private let lock = NSLock()
	private var lines: [String] = []
	private var startedAtMillis: Int64 = 0
	private var full = false
	private var device = "unknown"
	private var firmwareVersion: String?
	private var linkMtu: Int32 = 23

	init(maxPackets: Int = FrameRecorder.defaultMaxPackets, now: @escaping () -> Int64 = RingLogger.epochMillis, timeZone: @escaping () -> TimeZone = { TimeZone.current }) {
		self.maxPackets = maxPackets
		self.now = now
		self.timeZone = timeZone
	}

	/// Nome do relógio no cabeçalho (o `CoreHost.setRecordingDeviceName`).
	var deviceName: String {
		get { withLock { device } }
		set { withLock { device = newValue } }
	}

	/// Firmware no cabeçalho (o `CoreHost.setRecordingFirmware`).
	var firmware: String? {
		get { withLock { firmwareVersion } }
		set { withLock { firmwareVersion = newValue } }
	}

	/// MTU do link no cabeçalho, lido do transporte no export.
	var mtu: Int32 {
		get { withLock { linkMtu } }
		set { withLock { linkMtu = newValue } }
	}

	var packetCount: Int { withLock { lines.count } }

	var isFull: Bool { withLock { full } }

	/// Guarda um pacote. Devolve `true` só no primeiro pacote descartado por falta de espaço.
	func record(direction: FrameDirection, characteristic: String, value: KotlinByteArray) -> Bool {
		let at = now()
		return withLock {
			if lines.isEmpty { startedAtMillis = at }
			if lines.count >= maxPackets {
				let firstOverflow = !full
				full = true
				return firstOverflow
			}
			lines.append(FrameJsonl.shared.line(direction: direction, atMs: at - startedAtMillis, characteristic: characteristic, value: value))
			return false
		}
	}

	/// Grava cabeçalho e pacotes em `url` (sobrescreve).
	func write(to url: URL) throws {
		let (startedAt, snapshot, name, version, linkMtu) = withLock { (lines.isEmpty ? now() : startedAtMillis, lines, device, firmwareVersion, self.linkMtu) }
		let zone = timeZone()
		let header = FrameJsonl.shared.header(
			device: name,
			firmware: version,
			platform: "ios",
			mtu: linkMtu,
			recordedAtIso: FrameRecorder.isoWithMillis(epochMillis: startedAt, zone: zone),
			timeZoneId: zone.identifier
		)
		var text = header + "\n"
		for line in snapshot {
			text += line
			text += "\n"
		}
		try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
		try Data(text.utf8).write(to: url, options: .atomic)
	}

	/// Começa uma gravação nova.
	func clear() {
		withLock {
			lines.removeAll()
			full = false
		}
	}

	/// `recordedAt` com milissegundos e offset numérico (`+00:00`, nunca `Z`), como o `FrameRecorder` do Android: o
	/// cabeçalho de fixture exige offset numérico (`docs/fixtures.md` do Repo 1, seção 1).
	static func isoWithMillis(epochMillis: Int64, zone: TimeZone) -> String {
		let formatter = DateFormatter()
		formatter.locale = Locale(identifier: "en_US_POSIX")
		formatter.calendar = Calendar(identifier: .gregorian)
		formatter.timeZone = zone
		formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
		return formatter.string(from: Date(timeIntervalSince1970: Double(epochMillis) / 1000))
	}

	private func withLock<T>(_ body: () -> T) -> T {
		lock.lock()
		defer { lock.unlock() }
		return body()
	}
}

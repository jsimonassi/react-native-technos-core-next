import Foundation
import os
import TechnosWatchProtocol

/// Uma linha do log do host. `dir` e `hex` só existem para pacotes GATT (`WatchLogger.frame`).
struct LogEntry {
	let ts: Int64
	let level: LogLevel
	let tag: String
	let message: String
	let dir: FrameDirection?
	let hex: String?

	/// A forma neutra que o `CoreBridge` transforma em `onLog` e nos itens do `getLogs`.
	var coreLogEntry: CoreLogEntry {
		CoreLogEntry(ts: ts, level: level, tag: tag, message: message, dir: dir, hex: hex)
	}
}

/// `WatchLogger` do host iOS: anel em memória de `capacity` entradas, `os_log` (categoria `CoreNext`) e o `onEntry`
/// que o `CoreGraph` liga ao `CoreBridge.onLogEntry` (evento `onLog`). É o par do `RingLogger` do Android.
///
/// - Entradas abaixo de `minLevel` (o `setLogLevel` do JS) são descartadas: não entram no anel, nem no `os_log`, nem
///   no `onEntry`.
/// - Pacotes GATT (`frame`) viram entradas `DEBUG` com `dir` e `hex` e vão **sempre** para o `FrameRecorder`, com
///   qualquer nível, porque uma gravação de fixture com buracos não reproduz.
/// - Thread-safe: a sessão chama o logger de mais de uma thread, às vezes ao mesmo tempo (a da sessão, a de quem chama
///   as consultas síncronas, a fila do Bluetooth depois de um `close`; `docs/ios-pendente.md` → "iOS: estado e
///   pendências", seção Threading). O anel e o nível ficam atrás de um `NSLock`; o `onEntry` roda fora da trava, na
///   thread de quem logou, porque o `CoreBridge` pode logar de novo de dentro dele.
/// - Nunca lança nem chama `fatalError`: um logger que derruba o processo derrubaria o link junto.
final class RingLogger: NSObject, WatchLogger {
	static let defaultCapacity = 2000
	static let subsystem = "br.com.grupotechnos.corenext"

	private let recorder: FrameRecorder
	private let capacity: Int
	private let now: () -> Int64
	private let osLog = OSLog(subsystem: RingLogger.subsystem, category: "CoreNext")
	private let lock = NSLock()
	private var ring: [LogEntry] = []
	private var head = 0
	private var minOrdinal: Int32 = LogLevel.debug.ordinal
	private var entryHandler: ((LogEntry) -> Void)?

	init(recorder: FrameRecorder, capacity: Int = RingLogger.defaultCapacity, now: @escaping () -> Int64 = RingLogger.epochMillis) {
		self.recorder = recorder
		self.capacity = max(1, capacity)
		self.now = now
		super.init()
		ring.reserveCapacity(self.capacity)
	}

	/// Nível mínimo (padrão `DEBUG`).
	var minLevel: LogLevel {
		get { withLock { LogLevel.entries[Int(minOrdinal)] } }
		set { withLock { minOrdinal = newValue.ordinal } }
	}

	/// Chamado a cada entrada aceita, na thread de quem logou; não deve bloquear.
	var onEntry: ((LogEntry) -> Void)? {
		get { withLock { entryHandler } }
		set { withLock { entryHandler = newValue } }
	}

	func log(level: LogLevel, tag: String, message: String) {
		append(LogEntry(ts: now(), level: level, tag: tag, message: message, dir: nil, hex: nil))
	}

	func frame(direction: FrameDirection, characteristic: String, value: KotlinByteArray, summary: String) {
		// O value vai direto para o FrameJsonl do Kotlin: nenhuma cópia extra para gravar.
		if recorder.record(direction: direction, characteristic: characteristic, value: value) {
			log(level: LogLevel.warn, tag: "RingLogger/frame", message: "Frame recording is full; new packets are not recorded until clearLogs()")
		}
		let data = value.toData()
		let text = summary.isEmpty ? "len=\(data.count) (cont.)" : "\(summary) len=\(data.count)"
		append(LogEntry(ts: now(), level: LogLevel.debug, tag: "Frame/\(RingLogger.shortUuid(characteristic))", message: text, dir: direction, hex: RingLogger.hex(data)))
	}

	/// As últimas `limit` entradas, da mais nova para a mais antiga; `limit` é cortado para `0...count`.
	func entries(limit: Int) -> [LogEntry] {
		withLock {
			let count = min(max(limit, 0), ring.count)
			return (0..<count).map { ring[physicalIndex(ofNewest: $0)] }
		}
	}

	/// Quantas entradas o anel tem agora.
	var count: Int { withLock { ring.count } }

	/// Esvazia o anel e começa uma gravação de frames nova.
	func clear() {
		withLock {
			ring.removeAll(keepingCapacity: true)
			head = 0
		}
		recorder.clear()
	}

	/// Grava o anel em `url`, uma entrada JSON por linha, da mais antiga para a mais nova (mesmo formato do Android).
	func write(to url: URL) throws {
		let snapshot: [LogEntry] = withLock { (0..<ring.count).map { ring[(head + $0) % ring.count] } }
		var out = Data()
		for entry in snapshot {
			let object: [String: Any] = [
				"ts": entry.ts,
				"level": entry.level.name,
				"tag": entry.tag,
				"message": entry.message,
				"dir": entry.dir?.name ?? NSNull(),
				"hex": entry.hex ?? NSNull(),
			]
			out.append(try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]))
			out.append(0x0A)
		}
		try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
		try out.write(to: url, options: .atomic)
	}

	private func append(_ entry: LogEntry) {
		let handler: ((LogEntry) -> Void)? = withLock {
			guard entry.level.ordinal >= minOrdinal else { return nil }
			if ring.count < capacity {
				ring.append(entry)
			} else {
				ring[head] = entry
				head = (head + 1) % capacity
			}
			return entryHandler ?? { _ in }
		}
		guard let handler else { return }
		let prefix = entry.dir.map { "\($0.name) " } ?? ""
		let suffix = entry.hex.map { " \($0)" } ?? ""
		os_log("%{public}@", log: osLog, type: RingLogger.osLogType(entry.level), "\(entry.tag): \(prefix)\(entry.message)\(suffix)")
		handler(entry)
	}

	/// Índice no array da `offset`-ésima entrada mais nova (0 = a última gravada).
	private func physicalIndex(ofNewest offset: Int) -> Int {
		let newest = ring.count < capacity ? ring.count - 1 : (head - 1 + capacity) % capacity
		return (newest - offset + ring.count) % ring.count
	}

	private func withLock<T>(_ body: () -> T) -> T {
		lock.lock()
		defer { lock.unlock() }
		return body()
	}

	static func epochMillis() -> Int64 {
		Int64((Date().timeIntervalSince1970 * 1000).rounded(.down))
	}

	static func osLogType(_ level: LogLevel) -> OSLogType {
		switch level.ordinal {
		case LogLevel.debug.ordinal: return .debug
		case LogLevel.info.ordinal: return .info
		case LogLevel.warn.ordinal: return .default
		default: return .error
		}
	}

	private static let hexDigits: [UInt8] = Array("0123456789ABCDEF".utf8)

	/// Hex maiúsculo sem separadores, o mesmo formato do `hex` da fixture (`FrameJsonl.line`).
	static func hex(_ data: Data) -> String {
		var out = [UInt8]()
		out.reserveCapacity(data.count * 2)
		for byte in data {
			out.append(hexDigits[Int(byte >> 4)])
			out.append(hexDigits[Int(byte & 0x0F)])
		}
		return String(decoding: out, as: UTF8.self)
	}

	/// `6e400003-b5a3-...` → `6e400003`; `0000ff62-0000-1000-...` → `ff62`. Só para o log ficar legível.
	static func shortUuid(_ uuid: String) -> String {
		let head = uuid.split(separator: "-", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init) ?? uuid
		if uuid.hasSuffix("-0000-1000-8000-00805f9b34fb") && head.hasPrefix("0000") && head.count == 8 {
			return String(head.dropFirst(4))
		}
		return head
	}
}

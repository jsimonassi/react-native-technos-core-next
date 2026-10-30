import Foundation
import TechnosWatchProtocol

/// `SampleStore` em arquivos JSON, um por tipo, em `directory` (em produção, `Application Support/corenext/`). Par do
/// `FileSampleStore` do Android, com o mesmo formato (`SampleJsonCodec`).
///
/// Por que existe: o relógio pode não devolver o histórico inteiro a cada leitura, então o que a sessão leu precisa
/// sobreviver ao processo e ao reload do JS.
///
/// - Escrita atômica (`Data.write(options: .atomic)`: arquivo temporário e troca): um processo morto no meio deixa o
///   arquivo antigo intacto, nunca um JSON pela metade.
/// - Arquivo ilegível vira lista vazia com `WARN` no log, sem lançar: um arquivo corrompido não derruba a sessão.
/// - Chamado na thread da sessão (contrato do `SampleStore`); IO síncrono é permitido. Uma trava protege contra o
///   `clear` vindo de outra thread.
final class FileSampleStore: NSObject, SampleStore {
	static let stepsFile = "steps.json"
	static let sleepFile = "sleep.json"

	static func confirmedFile(_ kind: DataKind) -> String { "confirmed-\(kind.name.lowercased()).json" }

	private let directory: URL
	private let logger: WatchLogger
	private let lock = NSLock()

	init(directory: URL, logger: WatchLogger) {
		self.directory = directory
		self.logger = logger
		super.init()
	}

	func loadSteps() -> [StepsSample] { read(FileSampleStore.stepsFile, SampleJsonCodec.decodeSteps) }

	func saveSteps(samples: [StepsSample]) { write(FileSampleStore.stepsFile) { try SampleJsonCodec.encodeSteps(samples) } }

	func loadSleep() -> [SleepSession] { read(FileSampleStore.sleepFile, SampleJsonCodec.decodeSleep) }

	func saveSleep(sessions: [SleepSession]) { write(FileSampleStore.sleepFile) { try SampleJsonCodec.encodeSleep(sessions) } }

	func loadConfirmedDays(kind: DataKind) -> [String] { read(FileSampleStore.confirmedFile(kind), SampleJsonCodec.decodeDayKeys) }

	func saveConfirmedDays(kind: DataKind, dayKeys: [String]) {
		write(FileSampleStore.confirmedFile(kind)) { try SampleJsonCodec.encodeDayKeys(dayKeys) }
	}

	func clear() {
		lock.lock()
		defer { lock.unlock() }
		let names = [FileSampleStore.stepsFile, FileSampleStore.sleepFile] + DataKind.entries.map(FileSampleStore.confirmedFile)
		for name in names {
			let url = directory.appendingPathComponent(name)
			guard FileManager.default.fileExists(atPath: url.path) else { continue }
			do {
				try FileManager.default.removeItem(at: url)
			} catch {
				log(LogLevel.warn, "clear", "Could not delete \(name): \(error.localizedDescription)")
			}
		}
	}

	private func read<T>(_ name: String, _ decode: (Data) throws -> SampleJsonCodec.DecodeResult<T>) -> [T] {
		lock.lock()
		defer { lock.unlock() }
		let url = directory.appendingPathComponent(name)
		guard FileManager.default.fileExists(atPath: url.path) else { return [] }
		do {
			let result = try decode(Data(contentsOf: url))
			if result.skipped > 0 { log(LogLevel.warn, "read", "Skipped \(result.skipped) invalid items in \(name)") }
			return result.items
		} catch {
			log(LogLevel.warn, "read", "Unreadable \(name), using empty list: \(error.localizedDescription)")
			return []
		}
	}

	private func write(_ name: String, _ encode: () throws -> Data) {
		lock.lock()
		defer { lock.unlock() }
		do {
			try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
			try encode().write(to: directory.appendingPathComponent(name), options: .atomic)
		} catch {
			log(LogLevel.error, "write", "Could not write \(name): \(error.localizedDescription)")
		}
	}

	private func log(_ level: LogLevel, _ method: String, _ message: String) {
		logger.log(level: level, tag: "FileSampleStore/\(method)", message: message)
	}
}

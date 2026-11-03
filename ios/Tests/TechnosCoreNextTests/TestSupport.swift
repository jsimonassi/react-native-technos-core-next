import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// `CoreEventSink` que faz o mesmo que o shim (`RCTNativeCoreNext.mm`): converte o payload com o
/// `FoundationConverter` antes do `emitOnX:`. Aqui o "emitOnX" só guarda o evento convertido, em ordem.
final class RecordingSink: NSObject, CoreEventSink {
	struct Event {
		let name: String
		let payload: NSDictionary
	}

	private let lock = NSLock()
	private var stored: [Event] = []
	private var ready = true

	var emitting: Bool {
		get { lock.lock(); defer { lock.unlock() }; return ready }
		set { lock.lock(); ready = newValue; lock.unlock() }
	}

	func canEmit() -> Bool { emitting }

	func emit(name: String, payload: [String: Any]) {
		let converted = FoundationConverter.shared.toDictionary(payload: payload) as NSDictionary
		lock.lock()
		stored.append(Event(name: name, payload: converted))
		lock.unlock()
	}

	var events: [Event] {
		lock.lock()
		defer { lock.unlock() }
		return stored
	}

	func events(named name: String) -> [Event] { events.filter { $0.name == name } }

	func count(named name: String) -> Int { events(named: name).count }
}

/// `WatchClock` parado na hora da gravação, no fuso dela, como o `TestClock` do replay do Repo 1.
final class FixedClock: NSObject, WatchClock {
	private let millis: Int64
	private let zone: String

	init(date: Date, zone: TimeZone) {
		millis = Int64((date.timeIntervalSince1970 * 1000).rounded())
		self.zone = zone.identifier
	}

	func nowEpochMillis() -> Int64 { millis }

	func timeZoneId() -> String { zone }
}

/// Liquidação de uma Promise, já convertida como o React Native a receberia.
enum Settlement {
	case resolved(Any?)
	case rejected(code: String, message: String)

	var value: Any? {
		if case let .resolved(value) = self { return value }
		return nil
	}

	var isResolved: Bool {
		if case .resolved = self { return true }
		return false
	}
}

/// `true` se o objeto é um `CFBoolean` de verdade (o que o React Native converte para `true`/`false`).
func isCFBoolean(_ value: Any?) -> Bool {
	guard let value else { return false }
	return CFGetTypeID(value as CFTypeRef) == CFBooleanGetTypeID()
}

/// Meio-dia de `day` (`yyyy-MM-dd`) no fuso do processo, em ISO-8601 com offset, para o `deletedSavedData`.
///
/// O `CoreBridge` lê o dia de cada data no fuso do sistema (`TimeZone.currentSystemDefault()`), não no do `FixedClock`,
/// como o app que lê a data do backend no fuso do telefone. Com o meio-dia local, o dia confirmado é o mesmo qualquer
/// que seja o fuso da máquina (um `"…T15:00:00.000Z"` fixo vira o dia seguinte de UTC+9 para leste).
func localNoonIso(_ day: String) -> String {
	let parts = day.split(separator: "-").compactMap { Int($0) }
	precondition(parts.count == 3, "day must be yyyy-MM-dd: \(day)")
	var calendar = Calendar(identifier: .gregorian)
	calendar.timeZone = TimeZone.current
	let noon = calendar.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))!
	let formatter = ISO8601DateFormatter()
	formatter.timeZone = TimeZone.current
	return formatter.string(from: noon)
}

/// O grafo inteiro do host iOS sobre um `ReplayTransport`, com store, export e pareamento isolados por teste.
final class HostHarness {
	let recording: Recording
	let replay: ReplayTransport
	let graph: CoreGraph
	let sink = RecordingSink()
	let backgroundWork = NoBackgroundWork()
	let pairingDefaults: UserDefaults
	let pairingSuite: String
	let directory: URL

	var bridge: CoreBridge { graph.bridge }

	/// - Parameters:
	///   - bluetoothOnAtStart: repassado ao `ReplayTransport`.
	///   - attachSink: `false` simula um processo sem JS (relançado em segundo plano): nenhum módulo se liga ao controlador.
	convenience init(fixture: String, bluetoothOnAtStart: Bool = true, attachSink: Bool = true) throws {
		try self.init(recording: Fixtures.load(fixture), bluetoothOnAtStart: bluetoothOnAtStart, attachSink: attachSink)
	}

	/// Como `init(fixture:)`, com uma gravação já carregada (por exemplo, só o começo de uma fixture, `Recording.prefix`).
	init(recording: Recording, bluetoothOnAtStart: Bool = true, attachSink: Bool = true) throws {
		self.recording = recording
		let replay = try ReplayTransport(recording: recording, bluetoothOnAtStart: bluetoothOnAtStart)
		self.replay = replay
		directory = FileManager.default.temporaryDirectory.appendingPathComponent("corenext-tests-\(UUID().uuidString)", isDirectory: true)
		pairingSuite = "br.com.grupotechnos.corenext.tests.\(UUID().uuidString)"
		guard let defaults = UserDefaults(suiteName: pairingSuite) else { throw Recording.LoadError.unreadable("suite \(pairingSuite)") }
		pairingDefaults = defaults
		let work = backgroundWork
		graph = CoreGraph(
			transport: { _ in replay },
			storeDirectory: directory.appendingPathComponent("store", isDirectory: true),
			exportDirectory: directory.appendingPathComponent("export", isDirectory: true),
			pairing: PairingStore(defaults: defaults),
			backgroundWork: { _ in work },
			clock: FixedClock(date: recording.recordedAt, zone: recording.timeZone)
		)
		if attachSink { graph.bridge.attach(sink: sink) }
	}

	/// Encerra a sessão e apaga o que o teste gravou.
	func tearDown() {
		graph.session.close()
		pairingDefaults.removePersistentDomain(forName: pairingSuite)
		try? FileManager.default.removeItem(at: directory)
	}

	/// Chama um método JS do `CoreBridge` com a `PromiseCompletion` de produção e espera a liquidação.
	func call(_ method: String, timeout: TimeInterval = 20, file: StaticString = #filePath, line: UInt = #line, _ body: (CoreCompletion) -> Void) -> Settlement {
		let done = DispatchSemaphore(value: 0)
		let lock = NSLock()
		var settlement: Settlement?
		let completion = PromiseCompletion(
			resolve: { value in
				lock.lock()
				settlement = .resolved(value)
				lock.unlock()
				done.signal()
			},
			reject: { code, message, _ in
				lock.lock()
				settlement = .rejected(code: code, message: message ?? "")
				lock.unlock()
				done.signal()
			}
		)
		body(completion)
		if done.wait(timeout: .now() + timeout) == .timedOut {
			XCTFail("\(method) not settled after \(timeout) s; replay: \(describe(replay.snapshot()))", file: file, line: line)
			return .rejected(code: "TEST_TIMEOUT", message: method)
		}
		lock.lock()
		defer { lock.unlock() }
		return settlement ?? .rejected(code: "TEST", message: "no settlement")
	}

	/// Como `call`, mas falha o teste se a Promise for rejeitada.
	@discardableResult
	func resolve(_ method: String, timeout: TimeInterval = 20, file: StaticString = #filePath, line: UInt = #line, _ body: (CoreCompletion) -> Void) -> Any? {
		let settlement = call(method, timeout: timeout, file: file, line: line, body)
		if case let .rejected(code, message) = settlement {
			XCTFail("\(method) rejected \(code): \(message); replay: \(describe(replay.snapshot()))", file: file, line: line)
		}
		return settlement.value
	}

	/// Espera a condição (consultada a cada 20 ms) ou falha.
	func waitUntil(_ what: String, timeout: TimeInterval = 15, file: StaticString = #filePath, line: UInt = #line, _ condition: () -> Bool) {
		let deadline = Date().addingTimeInterval(timeout)
		while !condition() {
			if Date() > deadline {
				XCTFail("timed out waiting for \(what); replay: \(describe(replay.snapshot()))", file: file, line: line)
				return
			}
			Thread.sleep(forTimeInterval: 0.02)
		}
	}

	/// Espera o acerto de hora automático que a sessão manda `postLoginDelayMs` depois do `READY` (o próximo comando
	/// pedido antes dele sairia fora da ordem gravada).
	func waitForAutomaticSetTime(after frames: Int, key: String, file: StaticString = #filePath, line: UInt = #line) {
		waitUntil("automatic set time \(key)", file: file, line: line) {
			let snapshot = replay.snapshot()
			return snapshot.frameKeys.count > frames && snapshot.frameKeys.last == key && snapshot.waitingForTx
		}
	}

	/// Espera o `EnableNotices` interno logado a partir de `since` (epoch ms, o relógio de parede do `RingLogger`) terminar:
	/// é o último comando interno depois do `READY`, e só com ele feito o replay é conferido com a sessão parada (um TX a
	/// mais depois do `BB 07` apareceria em `extraTx`). O `since` deixa de fora o de uma conexão anterior.
	func waitForInternalCommandsDone(since: Int64, file: StaticString = #filePath, line: UInt = #line) {
		waitUntil("internal commands done", file: file, line: line) {
			graph.logger.entries(limit: RingLogger.defaultCapacity).contains {
				$0.ts >= since && $0.tag == "Session/enableDataChangeNotices" && $0.message.hasSuffix("done (internal)")
			}
		}
	}

	func lastPayload(_ name: String) -> NSDictionary? { sink.events(named: name).last?.payload }

	func describe(_ snapshot: ReplayTransport.Snapshot) -> String {
		"consumed \(snapshot.consumed)/\(snapshot.total), TX matched \(snapshot.matchedTx)/\(snapshot.recordedTx), " +
			"READ matched \(snapshot.matchedReads)/\(snapshot.recordedReads), " +
			"mismatches \(snapshot.mismatches.count) \(snapshot.mismatches.first ?? ""), extra \(snapshot.extraTx), last frames \(snapshot.frameKeys.suffix(4))"
	}
}

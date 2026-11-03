import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// Os ajustes, mensagens e interações da fase 2 pelo host iOS inteiro (`CoreGraph`, `IosCoreHost`, `RingLogger`,
/// `FrameRecorder` e o `CoreBridge` do framework), com os valores do Foundation que o `RCTNativeCoreNext.mm` repassa como
/// chegam do React Native: `NSDictionary` com `NSNumber` de ponto flutuante, `CFBoolean` e `NSNull`.
///
/// O relógio é o começo da gravação sintética do Condor Reebok (o pareamento até o `BB 07 00` do acerto de hora): depois
/// dele a gravação acabou, cada TX novo vai para o `extraTx` com a escrita completada (um relógio que não responde, o
/// caso dos ajustes sem resposta, D4(a)), e os avisos espontâneos do relógio são injetados (`ReplayTransport.notify`).
/// As regras (bytes, validação, máquina da câmera) moram no Repo 1 e são testadas lá; aqui só o caminho pelo host.
/// Todos os valores são fictícios. Cada teste imprime uma linha `IOS-PHASE2`.
final class Phase2HostTests: XCTestCase {
	private static let fee3 = "0000fee3-0000-1000-8000-00805f9b34fb"

	/// `12 [175 cm][70 kg][36 anos][masculino]`: nascimento em 15/03/1990 e o relógio da sessão parado em 31/10/2026.
	private static let profileFrame = "FEEA200912AF462400"
	/// `75`: flags `F7` (lembretes ligados), `0F`, ciclo 28, duração 5, mês 2 (março, de 0 a 11), dia 9 e o lembrete às
	/// 08:30 quatro vezes.
	private static let cycleFrame = "FEEA201375F70F1C050209081E081E081E081E"
	private static let vibrateFrame = "FEEA200561"

	func testPrivateSettingsReachTheWatchWhileTheLogAndTheRecordingOnlySeeTheRedactedCopy() throws {
		let harness = try pairedCondorReebok()
		defer { harness.tearDown() }
		let started = Date()
		let bridge = harness.bridge
		// DEBUG: os frames entram no anel e no onLog, então a ausência dos bytes reais abaixo prova alguma coisa.
		bridge.setLogLevel(level: 0)

		XCTAssertNil(harness.resolve("setUserInfo") { bridge.setUserInfo(userInfo: Self.userInfo() as! [String: Any], completion: $0) })
		let menstrual: NSDictionary = [
			"enabled": NSNumber(value: true),
			"reminder": NSNull(),
			"menstrualCycleLength": NSNumber(value: 28.0),
			"menstrualPeriodLength": NSNumber(value: 5.0),
			"lastMenstrualPeriodYear": NSNull(),
			"lastMenstrualPeriodMonth": NSNumber(value: 2.0),
			"lastMenstrualPeriodDay": NSNumber(value: 9.0),
			"reminderHour": NSNumber(value: 8.0),
			"reminderMinute": NSNumber(value: 30.0),
		]
		XCTAssertNil(harness.resolve("setMenstrual") { bridge.setMenstrual(menstrual: menstrual as! [String: Any], completion: $0) })
		XCTAssertNil(harness.resolve("vibrateDevice") { bridge.vibrateDevice(completion: $0) })

		// O relógio recebe os bytes reais.
		let sent = harness.replay.snapshot().extraTx
		XCTAssertEqual(sent, [Self.profileFrame, Self.cycleFrame, Self.vibrateFrame])

		// Entrada inválida: INVALID_ARGUMENT com o onError (requestId -1 e o método) antes do reject, e nada escrito.
		let missingHeight = try XCTUnwrap(Self.userInfo().mutableCopy() as? NSMutableDictionary)
		missingHeight["height"] = NSNull()
		let (settlement, errorAtReject) = settle(harness) { bridge.setUserInfo(userInfo: missingHeight as! [String: Any], completion: $0) }
		guard case let .rejected(code, _) = settlement else { return XCTFail("setUserInfo without height must reject") }
		XCTAssertEqual(code, HostErrorCodes.shared.INVALID_ARGUMENT)
		XCTAssertEqual(errorAtReject?["code"] as? String, HostErrorCodes.shared.INVALID_ARGUMENT)
		XCTAssertEqual(errorAtReject?["method"] as? String, "setUserInfo")
		XCTAssertEqual(intValue(errorAtReject?["requestId"]), -1)
		XCTAssertEqual(harness.replay.snapshot().extraTx, sent)

		// A gravação de frames (o export) tem a cópia redigida do mesmo tamanho; a máscara do replay iguala as duas.
		let path = try XCTUnwrap(harness.resolve("exportLogs") { bridge.exportLogs(completion: $0) } as? String)
		let exported = try Recording.load(URL(fileURLWithPath: path))
		let recorded = exported.packets.filter(\.tx).suffix(3).map { Recording.hex($0.value) }
		let redactedProfile = "FEEA200912" + String(repeating: "00", count: 4)
		let redactedCycle = "FEEA201375" + String(repeating: "00", count: 14)
		XCTAssertEqual(recorded, [redactedProfile, redactedCycle, Self.vibrateFrame])
		for (recordedHex, sentHex) in zip(recorded, sent) {
			let recordedBytes = try XCTUnwrap(Recording.decodeHex(recordedHex))
			let sentBytes = try XCTUnwrap(Recording.decodeHex(sentHex))
			XCTAssertEqual(CrpTxMasker().mask(recordedBytes), CrpTxMasker().mask(sentBytes), "\(recordedHex) vs \(sentHex)")
		}

		// O anel do log e o onLog só viram a cópia redigida.
		let entries = harness.graph.logger.entries(limit: RingLogger.defaultCapacity)
		XCTAssertTrue(entries.contains { $0.hex == redactedProfile }, "the redacted profile frame is logged")
		XCTAssertTrue(entries.contains { $0.hex == redactedCycle }, "the redacted cycle frame is logged")
		let realPayloads = ["AF462400", "F70F1C05"]
		XCTAssertFalse(entries.contains { entry in realPayloads.contains { (entry.hex ?? "").contains($0) || entry.message.contains($0) } })
		let logHexes = harness.sink.events(named: "onLog").compactMap { $0.payload["hex"] as? String }
		XCTAssertTrue(logHexes.contains(redactedProfile), "onLog carries the redacted frame")
		XCTAssertFalse(logHexes.contains { hex in realPayloads.contains { hex.contains($0) } })
		assertOnlyShimEvents(harness)

		print("IOS-PHASE2 \(harness.recording.source): setUserInfo, setMenstrual and vibrateDevice sent \(sent.count) TX, " +
			"export \(recorded.count) phase 2 TX redacted, INVALID_ARGUMENT with onError first, \(entries.count) log entries, " +
			"\(Int(Date().timeIntervalSince(started) * 1000)) ms")
	}

	func testWatchEventsAndTheCameraModeReachTheSinkConverted() throws {
		let harness = try pairedCondorReebok()
		defer { harness.tearDown() }
		let started = Date()
		let bridge = harness.bridge

		// Encontrar celular (D12): 62 00 começa, 62 01 para.
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA20066200")
		harness.waitUntil("onFindPhone 1") { harness.sink.count(named: "onFindPhone") == 1 }
		XCTAssertEqual(harness.lastPayload("onFindPhone")?["status"] as? String, "1")
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA20066201")
		harness.waitUntil("onFindPhone 0") { harness.sink.count(named: "onFindPhone") == 2 }
		XCTAssertEqual(harness.lastPayload("onFindPhone")?["status"] as? String, "0")

		// Disparo com o modo câmera fechado (D11).
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA200566")
		harness.waitUntil("onDeviceRequestedCameraMode") { harness.sink.count(named: "onDeviceRequestedCameraMode") == 1 }
		XCTAssertEqual(harness.lastPayload("onDeviceRequestedCameraMode")?.count, 0)

		// Abrir: o onOpenCameraMode sai depois da escrita e antes do resolve.
		let (opened, openEventsAtResolve) = settle(harness, counting: "onOpenCameraMode") { bridge.openCameraMode(completion: $0) }
		XCTAssertTrue(opened.isResolved, "\(opened)")
		XCTAssertEqual(openEventsAtResolve, 1)
		XCTAssertEqual(harness.lastPayload("onOpenCameraMode")?.count, 0)

		// Disparo com o modo aberto (depois dos 200 ms do eco) → onTakeAPicture; a saída pelo relógio (53 0E FF) fecha o
		// modo, e o disparo seguinte volta a ser onDeviceRequestedCameraMode.
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA200566")
		harness.waitUntil("onTakeAPicture") { harness.sink.count(named: "onTakeAPicture") == 1 }
		XCTAssertEqual(harness.lastPayload("onTakeAPicture")?.count, 0)
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA2007530EFF")
		harness.replay.notify(characteristic: Self.fee3, hex: "FEEA200566")
		harness.waitUntil("second onDeviceRequestedCameraMode") { harness.sink.count(named: "onDeviceRequestedCameraMode") == 2 }
		XCTAssertEqual(harness.sink.count(named: "onTakeAPicture"), 1)

		XCTAssertNil(harness.resolve("closeCameraMode") { bridge.closeCameraMode(completion: $0) })
		XCTAssertEqual(harness.replay.snapshot().extraTx, ["FEEA200566", "FEEA2006530E"])
		XCTAssertEqual(harness.sink.count(named: "onError"), 0, "\(harness.sink.events(named: "onError").map(\.payload))")
		assertOnlyShimEvents(harness)

		print("IOS-PHASE2 \(harness.recording.source): onFindPhone 1/0, onDeviceRequestedCameraMode \(harness.sink.count(named: "onDeviceRequestedCameraMode")), " +
			"onOpenCameraMode before resolve, onTakeAPicture \(harness.sink.count(named: "onTakeAPicture")), " +
			"\(Int(Date().timeIntervalSince(started) * 1000)) ms")
	}

	/// Sem conexão: NOT_READY com o onError antes do reject e sem escrita; o `closeCameraMode` só resolve (D5).
	func testPhase2MethodsWithoutAConnectionRejectNotReadyExceptCloseCameraMode() throws {
		let harness = try HostHarness(fixture: "synthetic/condorreebok-pair-sync.jsonl")
		defer { harness.tearDown() }
		let bridge = harness.bridge
		XCTAssertNil(harness.resolve("initialize") { bridge.initialize(completion: $0) })

		let (vibrate, vibrateError) = settle(harness) { bridge.vibrateDevice(completion: $0) }
		guard case let .rejected(code, _) = vibrate else { return XCTFail("vibrateDevice must reject without a connection") }
		XCTAssertEqual(code, WatchErrorCodes.shared.NOT_READY)
		XCTAssertEqual(vibrateError?["method"] as? String, "vibrateDevice")
		XCTAssertEqual(vibrateError?["code"] as? String, WatchErrorCodes.shared.NOT_READY)

		let (profile, _) = settle(harness) { bridge.setUserInfo(userInfo: Self.userInfo() as! [String: Any], completion: $0) }
		guard case let .rejected(profileCode, _) = profile else { return XCTFail("setUserInfo must reject without a connection") }
		XCTAssertEqual(profileCode, WatchErrorCodes.shared.NOT_READY)

		let errorsBefore = harness.sink.count(named: "onError")
		XCTAssertNil(harness.resolve("closeCameraMode") { bridge.closeCameraMode(completion: $0) })
		XCTAssertEqual(harness.sink.count(named: "onError"), errorsBefore, "closeCameraMode without a connection has no onError")
		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.consumed, 0)
		XCTAssertEqual(replay.extraTx, [])
		XCTAssertEqual(replay.writeTypes, [:])
		assertOnlyShimEvents(harness)

		print("IOS-PHASE2 \(harness.recording.source): without a connection vibrateDevice and setUserInfo NOT_READY, closeCameraMode resolved, 0 TX")
	}

	// MARK: - Auxiliares

	/// O perfil fictício no formato do Condor (`TechnosUserInfoSet`, mês de 1 a 12), como o React Native o entrega.
	private static func userInfo() -> NSDictionary {
		[
			"year": NSNumber(value: 1990.0),
			"month": NSNumber(value: 3.0),
			"day": NSNumber(value: 15.0),
			"weight": NSNumber(value: 70.0),
			"height": NSNumber(value: 175.0),
			"gender": "m",
		]
	}

	/// Pareado e parado: a gravação acabou no `BB 07 00` do acerto de hora automático e os comandos internos terminaram.
	private func pairedCondorReebok(file: StaticString = #filePath, line: UInt = #line) throws -> HostHarness {
		let full = try Fixtures.load("synthetic/condorreebok-pair-sync.jsonl")
		let timeZoneIndex = try XCTUnwrap(full.packets.firstIndex { $0.tx && CrpTxMasker().frameKey($0.value) == "BB/07" }, file: file, line: line)
		let harness = try HostHarness(recording: full.prefix(through: timeZoneIndex))
		let started = RingLogger.epochMillis()
		let bridge = harness.bridge
		XCTAssertNil(harness.resolve("initialize", file: file, line: line) { bridge.initialize(completion: $0) })
		bridge.scan()
		harness.waitUntil("onScannedDevice", file: file, line: line) { harness.sink.count(named: "onScannedDevice") == 1 }
		let deviceId = try XCTUnwrap(harness.lastPayload("onScannedDevice")?["deviceId"] as? String, file: file, line: line)
		XCTAssertNil(harness.resolve("pairDevice", timeout: 30, file: file, line: line) { bridge.pairDevice(deviceId: deviceId, name: "Condor Reebok", completion: $0) })
		harness.waitForAutomaticSetTime(after: 0, key: "BB/07", file: file, line: line)
		harness.waitForInternalCommandsDone(since: started, file: file, line: line)
		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.mismatches, [], file: file, line: line)
		XCTAssertEqual(replay.consumed, replay.total, file: file, line: line)
		XCTAssertEqual(replay.extraTx, [], file: file, line: line)
		XCTAssertEqual(replay.frameKeys, ["5A/00", "B7/0E", "BB/16", "31", "BB/07"], file: file, line: line)
		return harness
	}

	/// Liquida uma chamada com a `PromiseCompletion` de produção e devolve o último `onError` que o sink tinha no instante
	/// do resolve ou do reject (o `onError` sai antes do reject).
	private func settle(_ harness: HostHarness, file: StaticString = #filePath, line: UInt = #line, _ body: (CoreCompletion) -> Void) -> (Settlement, NSDictionary?) {
		let (settlement, seen) = settleObserving(harness, file: file, line: line, observe: { harness.sink.events(named: "onError").last?.payload }, body)
		return (settlement, seen as? NSDictionary)
	}

	/// Como `settle`, devolvendo quantos eventos `event` o sink tinha no instante da liquidação.
	private func settle(_ harness: HostHarness, counting event: String, file: StaticString = #filePath, line: UInt = #line, _ body: (CoreCompletion) -> Void) -> (Settlement, Int?) {
		let (settlement, seen) = settleObserving(harness, file: file, line: line, observe: { harness.sink.count(named: event) }, body)
		return (settlement, seen as? Int)
	}

	private func settleObserving(_ harness: HostHarness, file: StaticString, line: UInt, observe: @escaping () -> Any?, _ body: (CoreCompletion) -> Void) -> (Settlement, Any?) {
		let done = DispatchSemaphore(value: 0)
		let lock = NSLock()
		var settlement: Settlement = .rejected(code: "TEST_TIMEOUT", message: "not settled")
		var seen: Any?
		let completion = PromiseCompletion(
			resolve: { value in
				lock.lock()
				seen = observe()
				settlement = .resolved(value)
				lock.unlock()
				done.signal()
			},
			reject: { code, message, _ in
				lock.lock()
				seen = observe()
				settlement = .rejected(code: code, message: message ?? "")
				lock.unlock()
				done.signal()
			}
		)
		body(completion)
		if done.wait(timeout: .now() + 20) == .timedOut {
			XCTFail("not settled after 20 s; replay: \(harness.describe(harness.replay.snapshot()))", file: file, line: line)
		}
		lock.lock()
		defer { lock.unlock() }
		return (settlement, seen)
	}

	/// Todo evento que o framework emitiu tem um ramo no `emitName:payload:` do `RCTNativeCoreNext.mm` (um nome sem ramo
	/// iria só para o `NSLog`, perdido para o JS).
	private func assertOnlyShimEvents(_ harness: HostHarness, file: StaticString = #filePath, line: UInt = #line) {
		do {
			let dispatched = Set(try TurboModuleSource.dispatchedEvents())
			let emitted = Set(harness.sink.events.map(\.name))
			XCTAssertTrue(emitted.isSubset(of: dispatched), "without a branch in emitName: \(emitted.subtracting(dispatched))", file: file, line: line)
		} catch {
			XCTFail("\(error)", file: file, line: line)
		}
	}
}

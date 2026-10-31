import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// O host iOS inteiro no simulador, sem Bluetooth: `CoreGraph` de verdade (o `CoreBridge` e a sessão do framework
/// Kotlin, o `IosCoreHost`, o `FileSampleStore`, o `PairingStore`, o `RingLogger` e o `FrameRecorder`) sobre um
/// `ReplayTransport` que responde com as gravações reais dos dois relógios (e a sintética do Condor Reebok, com os RX e
/// READ reais da captura HCI do app Condor), método JS por método JS, na ordem em que o app de exemplo os chamou. Cada Promise usa a `PromiseCompletion` de produção, e cada evento passa pelo
/// `FoundationConverter`, como no shim; o que o teste lê é o que o React Native receberia.
///
/// Cada teste imprime uma linha `IOS-REPLAY` com o resultado (contagem de TX e os valores-chave).
final class CoreBridgeReplayTests: XCTestCase {
	private let states = StateMapper.shared

	func testFitGpsRealRecordingThroughTheWholeIosHost() throws {
		let harness = try HostHarness(fixture: "real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl")
		defer { harness.tearDown() }
		let sentinel = "corenext.tests.sentinel.\(UUID().uuidString)"
		UserDefaults.standard.set("keep", forKey: sentinel)
		defer { UserDefaults.standard.removeObject(forKey: sentinel) }
		let started = Date()
		let bridge = harness.bridge

		// initialize: o estado atual (DISCONNECTED) e resolve com null.
		XCTAssertNil(harness.resolve("initialize") { bridge.initialize(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))

		// scan → onScannedDevice com o perfil do nome anunciado.
		let deviceId = try scanOne(harness, expectedName: "fitGPS", profileId: "fitgps", bleName: "Mormaii_fitGPS")

		// Conexão 1: BIND + LOGIN, o acerto de hora automático, Refresh, Ler (info e firmware), bateria, Refresh duas vezes.
		XCTAssertNil(harness.resolve("pairDevice", timeout: 30) { bridge.pairDevice(deviceId: deviceId, name: "fitGPS", completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.CONNECTED))
		XCTAssertEqual(harness.pairingDefaults.string(forKey: PairingStore.keyAddress), deviceId)
		XCTAssertEqual(harness.pairingDefaults.string(forKey: PairingStore.keyProfileId), "fitgps")
		harness.waitForAutomaticSetTime(after: 0, key: "02/01")

		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		harness.resolve("getDeviceInfo") { bridge.getDeviceInfo(completion: $0) }
		XCTAssertEqual(harness.lastPayload("onDeviceInfo")?["firmware"] as? String, "0.2.1")
		XCTAssertEqual(harness.lastPayload("onDeviceInfo")?["deviceId"] as? String, deviceId)
		harness.resolve("getFirmwareInfo") { bridge.getFirmwareInfo(completion: $0) }
		XCTAssertEqual(harness.lastPayload("onFirmwareInfo")?["version"] as? String, "0.2.1")
		harness.resolve("getBatteryStatus") { bridge.getBatteryStatus(completion: $0) }
		let battery = try XCTUnwrap(harness.lastPayload("onBatteryStatus"))
		XCTAssertNotNil(intValue(battery["percentage"]))
		XCTAssertTrue(isCFBoolean(battery["charging"]), "charging must reach JS as true/false")
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }

		// Bluetooth desligado (contrato B: só o false) e religado: o CoreBridge reconecta sozinho, só com LOGIN.
		let framesBeforeOff = harness.replay.snapshot().frameKeys.count
		let disconnectsBeforeOff = harness.replay.snapshot().disconnects
		harness.replay.setBluetooth(enabled: false)
		harness.waitUntil("BLUETOOTH_OFF") { intValue(harness.lastPayload("onConnectStateChanged")?["state"]) == Int(states.BLUETOOTH_OFF) }
		let offConnected = harness.call("isConnected") { bridge.isConnected(completion: $0) }.value
		XCTAssertTrue(isCFBoolean(offConnected))
		XCTAssertEqual(offConnected as? Bool, false)
		XCTAssertGreaterThanOrEqual(harness.replay.snapshot().disconnects, disconnectsBeforeOff, "the session may release the transport, which stays silent")
		let stateEventsBeforeOn = harness.sink.count(named: "onConnectStateChanged")
		harness.replay.setBluetooth(enabled: true)
		harness.waitUntil("reconnected after Bluetooth on") {
			harness.sink.count(named: "onConnectStateChanged") > stateEventsBeforeOn &&
				intValue(harness.lastPayload("onConnectStateChanged")?["state"]) == Int(states.CONNECTED)
		}
		harness.waitForAutomaticSetTime(after: framesBeforeOff, key: "02/01")

		// Conexão 2: Ler, bateria, Refresh, Set time, Refresh e o Sync completo (64 páginas de sono).
		harness.resolve("getDeviceInfo") { bridge.getDeviceInfo(completion: $0) }
		harness.resolve("getFirmwareInfo") { bridge.getFirmwareInfo(completion: $0) }
		harness.resolve("getBatteryStatus") { bridge.getBatteryStatus(completion: $0) }
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		harness.resolve("setTime") { bridge.setTime(completion: $0) }
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		let pedometer = try XCTUnwrap(harness.lastPayload("onPedometer"))
		XCTAssertEqual(intValue(pedometer["pedometer"]), 56, "the watch screen showed 56 steps on 2026-10-29")
		XCTAssertTrue((pedometer["date"] as? String)?.hasPrefix("2026-10-29") == true, "\(pedometer)")
		let syncStartedBefore = harness.sink.count(named: "onSyncStarted")
		harness.resolve("syncDataHistory", timeout: 60) { bridge.syncDataHistory(completion: $0) }
		XCTAssertEqual(harness.sink.count(named: "onSyncStarted"), syncStartedBefore + 1)
		XCTAssertEqual(harness.sink.count(named: "onSyncFinished"), 1)
		XCTAssertGreaterThan(harness.sink.count(named: "onSyncProgress"), 0)
		XCTAssertEqual(harness.backgroundWork.begins, 1)
		XCTAssertEqual(harness.backgroundWork.ends, 1)

		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.mismatches, [])
		XCTAssertEqual(replay.matchedTx, 167)
		XCTAssertEqual(replay.recordedTx, 167)
		XCTAssertEqual(replay.consumed, replay.total)
		XCTAssertEqual(replay.extraTx, [])
		XCTAssertEqual(replay.writeTypes, ["WITH_RESPONSE": 167])

		// Histórico local, pareamento, estado, log e export: valores como o JS os recebe.
		let local = try checkLocalQueries(harness, deviceId: deviceId, name: "fitGPS", profileId: "fitgps", day: "2026-10-29", steps: 56, recordedTx: 167)

		// deletedSavedData confirma o dia; ele some do getHistoryPedometer.
		bridge.deletedSavedData(filteredArrayData: ["2026-10-29T15:00:00.000Z"], category: Double(SavedDataMapper.shared.CATEGORY_PEDOMETER))
		harness.resolve("getHistoryPedometer") { bridge.getHistoryPedometer(daysBefore: 30, completion: $0) }
		XCTAssertEqual((harness.lastPayload("onHistoryPedometer")?["historypedometer"] as? [Any])?.count, 0)

		// forgetDevice: o UNBIND (03/05) não está na gravação e fica sem resposta; a sessão esquece mesmo assim.
		XCTAssertNil(harness.resolve("forgetDevice", timeout: 20) { bridge.forgetDevice(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))
		XCTAssertNil(harness.resolve("getLastPairedDevice") { bridge.getLastPairedDevice(completion: $0) })
		XCTAssertNil(harness.pairingDefaults.string(forKey: PairingStore.keyAddress))
		XCTAssertEqual(UserDefaults.standard.string(forKey: sentinel), "keep", "the app's own defaults must survive a forget")
		// O SmaDriver retransmite o UNBIND sem ACK antes de desistir: todo TX depois da gravação é um 03/05.
		let extra = harness.replay.snapshot().extraTx
		XCTAssertFalse(extra.isEmpty)
		XCTAssertEqual(Set(extra.compactMap { Recording.decodeHex($0).flatMap { SmaTxMasker().frameKey($0) } }), ["03/05"], "\(extra)")
		harness.resolve("getHistoryPedometer") { bridge.getHistoryPedometer(daysBefore: 30, completion: $0) }
		XCTAssertEqual((harness.lastPayload("onHistoryPedometer")?["historypedometer"] as? [Any])?.count, 0)
		let afterForget = harness.call("isConnected") { bridge.isConnected(completion: $0) }.value
		XCTAssertTrue(isCFBoolean(afterForget))
		XCTAssertEqual(afterForget as? Bool, false)

		print("IOS-REPLAY \(harness.recording.source): \(replay.total) packets, TX matched \(replay.matchedTx)/\(replay.recordedTx), " +
			"writes \(replay.writeTypes), steps 2026-10-29 = \(intValue(pedometer["pedometer"]) ?? -1), battery \(intValue(battery["percentage"]) ?? -1)%, " +
			"sleep \(local.sleep), events \(harness.sink.events.count), export \(local.exportedTx) TX, \(Int(Date().timeIntervalSince(started) * 1000)) ms")
	}

	/// A gravação da noite: Sync com o sono vazio, Bluetooth desligado e religado, Disconnect e "Reconnect last"
	/// (`startPairingAttempt`, que resolve na hora), cada reconexão só com LOGIN e o acerto de hora automático.
	func testFitGpsEveningRecordingWithDisconnectAndReconnectLast() throws {
		let harness = try HostHarness(fixture: "real/fitgps/0.2.1/pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl")
		defer { harness.tearDown() }
		let bridge = harness.bridge
		XCTAssertNil(harness.resolve("initialize") { bridge.initialize(completion: $0) })
		let deviceId = try scanOne(harness, expectedName: "fitGPS", profileId: "fitgps", bleName: "Mormaii_fitGPS")
		XCTAssertNil(harness.resolve("pairDevice", timeout: 30) { bridge.pairDevice(deviceId: deviceId, name: "fitGPS", completion: $0) })
		harness.waitForAutomaticSetTime(after: 0, key: "02/01")
		harness.resolve("getDeviceInfo") { bridge.getDeviceInfo(completion: $0) }
		harness.resolve("getFirmwareInfo") { bridge.getFirmwareInfo(completion: $0) }
		harness.resolve("getBatteryStatus") { bridge.getBatteryStatus(completion: $0) }
		XCTAssertEqual(intValue(harness.lastPayload("onBatteryStatus")?["percentage"]), 55)
		harness.resolve("setTime") { bridge.setTime(completion: $0) }
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		XCTAssertEqual(intValue(harness.lastPayload("onPedometer")?["pedometer"]), 56)
		harness.resolve("syncDataHistory", timeout: 30) { bridge.syncDataHistory(completion: $0) }
		if case let .rejected(code, _) = harness.call("getHistorySleep", { bridge.getHistorySleep(completion: $0) }) {
			XCTAssertEqual(code, WatchErrorCodes.shared.NO_DATA)
		} else {
			XCTFail("the evening 05/46 came back empty: getHistorySleep must reject with NO_DATA")
		}

		var frames = harness.replay.snapshot().frameKeys.count
		harness.replay.setBluetooth(enabled: false)
		harness.waitUntil("BLUETOOTH_OFF") { intValue(harness.lastPayload("onConnectStateChanged")?["state"]) == Int(states.BLUETOOTH_OFF) }
		harness.replay.setBluetooth(enabled: true)
		harness.waitForAutomaticSetTime(after: frames, key: "02/01")

		XCTAssertNil(harness.resolve("disconnectCurrentDevice") { bridge.disconnectCurrentDevice(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))
		XCTAssertEqual(harness.call("isConnected") { bridge.isConnected(completion: $0) }.value as? Bool, false)
		let saved = try XCTUnwrap(harness.resolve("getLastPairedDevice") { bridge.getLastPairedDevice(completion: $0) } as? NSDictionary)
		XCTAssertEqual(saved["deviceId"] as? String, deviceId, "disconnect keeps the pairing")

		frames = harness.replay.snapshot().frameKeys.count
		XCTAssertNil(harness.resolve("startPairingAttempt") { bridge.startPairingAttempt(deviceId: deviceId, name: "fitGPS", completion: $0) })
		harness.waitForAutomaticSetTime(after: frames, key: "02/01")
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.CONNECTED))

		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.mismatches, [])
		XCTAssertEqual(replay.matchedTx, 32)
		XCTAssertEqual(replay.recordedTx, 32)
		XCTAssertEqual(replay.consumed, replay.total)
		XCTAssertEqual(replay.extraTx, [])
		XCTAssertEqual(replay.connects.count, 3, "\(replay.connects)")
		print("IOS-REPLAY \(harness.recording.source): \(replay.total) packets, TX matched \(replay.matchedTx)/\(replay.recordedTx), connects \(replay.connects)")
	}

	func testLifeUltraGpsRealRecordingThroughTheWholeIosHost() throws {
		let harness = try HostHarness(fixture: "real/lifeultragps/1.1.1/pair-info-time-steps-sync.jsonl")
		defer { harness.tearDown() }
		let started = Date()
		let bridge = harness.bridge

		XCTAssertNil(harness.resolve("initialize") { bridge.doInitSMASDK(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))
		let deviceId = try scanOne(harness, expectedName: "Life Ultra GPS", profileId: "lifeultragps", bleName: "Life Ultra GPS")

		// pair: informação básica, bind, a resposta ao desafio gravado e o acerto de hora automático (03/01).
		XCTAssertNil(harness.resolve("pairDevice", timeout: 30) { bridge.pairDevice(deviceId: deviceId, name: "Life Ultra GPS", completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.CONNECTED))
		harness.waitForAutomaticSetTime(after: 0, key: "03/01")

		harness.resolve("getDeviceInfo") { bridge.getDeviceInfo(completion: $0) }
		XCTAssertEqual(harness.lastPayload("onDeviceInfo")?["firmware"] as? String, "1.1.1")
		harness.resolve("getFirmwareInfo") { bridge.getFirmwareInfo(completion: $0) }
		XCTAssertEqual(harness.lastPayload("onFirmwareInfo")?["version"] as? String, "1.1.1")
		harness.resolve("getBatteryStatus") { bridge.getBatteryStatus(completion: $0) }
		let battery = try XCTUnwrap(harness.lastPayload("onBatteryStatus"))
		XCTAssertTrue(isCFBoolean(battery["charging"]))
		harness.resolve("setTime") { bridge.setTime(completion: $0) }
		harness.resolve("refreshSteps") { bridge.refreshSteps(completion: $0) }
		let pedometer = try XCTUnwrap(harness.lastPayload("onPedometer"))
		XCTAssertEqual(intValue(pedometer["pedometer"]), 51, "the watch showed 51 steps on 2026-10-30")
		harness.resolve("syncDataHistory", timeout: 30) { bridge.syncDataHistory(completion: $0) }
		XCTAssertEqual(harness.sink.count(named: "onSyncFinished"), 1)

		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.mismatches, [])
		XCTAssertEqual(replay.matchedTx, 12)
		XCTAssertEqual(replay.recordedTx, 12)
		XCTAssertEqual(replay.consumed, replay.total)
		XCTAssertEqual(replay.writeTypes, ["WITHOUT_RESPONSE": 12], "the iDO driver writes without response")

		let local = try checkLocalQueries(harness, deviceId: deviceId, name: "Life Ultra GPS", profileId: "lifeultragps", day: "2026-10-30", steps: 51, recordedTx: 12)

		// O iDO não sabe desfazer o vínculo (nada é escrito); o forget apaga o pareamento e o histórico mesmo assim.
		XCTAssertNil(harness.resolve("forgetDevice", timeout: 20) { bridge.forgetDevice(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))
		XCTAssertNil(harness.resolve("getLastPairedDevice") { bridge.getLastPairedDevice(completion: $0) })
		XCTAssertEqual(harness.replay.snapshot().extraTx, [])

		print("IOS-REPLAY \(harness.recording.source): \(replay.total) packets, TX matched \(replay.matchedTx)/\(replay.recordedTx), " +
			"writes \(replay.writeTypes), steps 2026-10-30 = \(intValue(pedometer["pedometer"]) ?? -1), battery \(intValue(battery["percentage"]) ?? -1)%, " +
			"sleep \(local.sleep), events \(harness.sink.events.count), export \(local.exportedTx) TX, \(Int(Date().timeIntervalSince(started) * 1000)) ms")
	}

	/// O Condor Reebok (CRP, P85) pela fixture sintética do Repo 1 (`synthetic/condorreebok-pair-sync.jsonl`: os TX que o
	/// driver CRP manda e os RX e READ reais da captura HCI do app Condor). Pareamento só com a versão (2A29, `5A 00`,
	/// `B7 0E`, `BB 16 00`, fase `VERSION`, sem BIND), o acerto de hora automático (`31` e `BB 07 00`), bateria e passos do
	/// dia por leitura GATT, firmware pelo `5A 01`, o sync (meias horas do `59`, a sonda `33 01` sem resposta e o sono
	/// vazio do `32`), a bateria espontânea de `2A19` e o `forgetDevice` (`F8`). O vínculo clássico volta "não suportado".
	func testCondorReebokSyntheticFixture() throws {
		let harness = try HostHarness(fixture: "synthetic/condorreebok-pair-sync.jsonl")
		defer { harness.tearDown() }
		let started = Date()
		let bridge = harness.bridge

		XCTAssertNil(harness.resolve("initialize") { bridge.initialize(completion: $0) })
		let deviceId = try scanOne(harness, expectedName: "Condor Reebok", profileId: "condorreebok", bleName: "P85")

		XCTAssertNil(harness.resolve("pairDevice", timeout: 30) { bridge.pairDevice(deviceId: deviceId, name: "Condor Reebok", completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.CONNECTED))
		XCTAssertTrue(
			harness.sink.events(named: "onConnectStateChanged").contains { $0.payload["phase"] as? String == "VERSION" },
			"the CRP handshake reports the VERSION phase"
		)
		XCTAssertEqual(harness.pairingDefaults.string(forKey: PairingStore.keyProfileId), "condorreebok")
		harness.waitForAutomaticSetTime(after: 0, key: "BB/07")
		XCTAssertEqual(harness.replay.snapshot().frameKeys, ["5A/00", "B7/0E", "BB/16", "31", "BB/07"])

		// Vínculo clássico: o iOS responde "não suportado" com a dica; só um WARN do CoreBridge, sem onError.
		harness.waitUntil("classic bond answered") {
			harness.graph.logger.entries(limit: 2000).contains { $0.tag.hasSuffix("classicBond") && $0.message.contains("Settings > Bluetooth") }
		}
		XCTAssertFalse(harness.sink.events(named: "onError").contains { $0.payload["code"] as? String == HostErrorCodes.shared.CLASSIC_BOND_FAILED })

		harness.resolve("getBatteryStatus") { bridge.getBatteryStatus(completion: $0) }
		let battery = try XCTUnwrap(harness.lastPayload("onBatteryStatus"))
		XCTAssertEqual(intValue(battery["percentage"]), 50, "2A19 = 0x32, as the watch showed")
		XCTAssertTrue(isCFBoolean(battery["charging"]))
		XCTAssertEqual(battery["charging"] as? Bool, false)

		harness.resolve("getFirmwareInfo") { bridge.getFirmwareInfo(completion: $0) }
		XCTAssertEqual(harness.lastPayload("onFirmwareInfo")?["version"] as? String, "MOY-VS02-2.0.0")

		let batteryEventsBeforeSync = harness.sink.count(named: "onBatteryStatus")
		harness.resolve("syncDataHistory", timeout: 30) { bridge.syncDataHistory(completion: $0) }
		XCTAssertEqual(harness.sink.count(named: "onSyncStarted"), 1)
		XCTAssertEqual(harness.sink.count(named: "onSyncFinished"), 1)
		// A notificação de 2A19 que veio depois do sono: onBatteryStatus sem pedido.
		harness.waitUntil("spontaneous battery") { harness.sink.count(named: "onBatteryStatus") == batteryEventsBeforeSync + 1 }
		XCTAssertEqual(intValue(harness.lastPayload("onBatteryStatus")?["percentage"]), 50)

		let replay = harness.replay.snapshot()
		XCTAssertEqual(replay.mismatches, [])
		XCTAssertEqual(replay.matchedTx, 12)
		XCTAssertEqual(replay.recordedTx, 12)
		XCTAssertEqual(replay.matchedReads, 3)
		XCTAssertEqual(replay.recordedReads, 3)
		XCTAssertEqual(replay.consumed, replay.total)
		XCTAssertEqual(replay.extraTx, [])
		XCTAssertEqual(replay.writeTypes, ["WITHOUT_RESPONSE": 12], "FEE2 only declares write without response")
		XCTAssertEqual(
			replay.frameKeys,
			["5A/00", "B7/0E", "BB/16", "31", "BB/07", "5A/01", "59/00", "59/01", "59/02", "59/03", "33/01", "32"]
		)

		// Relógio sem uso: nenhum dia com passos e nenhuma noite.
		harness.resolve("getHistoryPedometer") { bridge.getHistoryPedometer(daysBefore: 30, completion: $0) }
		XCTAssertEqual((harness.lastPayload("onHistoryPedometer")?["historypedometer"] as? [Any])?.count, 0)
		if case let .rejected(code, _) = harness.call("getHistorySleep", { bridge.getHistorySleep(completion: $0) }) {
			XCTAssertEqual(code, WatchErrorCodes.shared.NO_DATA)
		} else {
			XCTFail("the empty 0x32 has no night: getHistorySleep must reject with NO_DATA")
		}

		// A gravação do iOS guarda as leituras (READ) e o export as devolve.
		let path = try XCTUnwrap(harness.resolve("exportLogs") { bridge.exportLogs(completion: $0) } as? String)
		let exported = try Recording.load(URL(fileURLWithPath: path))
		XCTAssertEqual(exported.readCount, 3)
		XCTAssertEqual(exported.txCount, 12)
		XCTAssertEqual(exported.device, "P85")
		XCTAssertEqual(exported.firmware, "MOY-VS02-2.0.0")

		// forgetDevice: o F8 (fora da gravação, sem resposta), a dica de esquecer nos Ajustes e o pareamento apagado.
		XCTAssertNil(harness.resolve("forgetDevice", timeout: 20) { bridge.forgetDevice(completion: $0) })
		XCTAssertEqual(intValue(harness.lastPayload("onConnectStateChanged")?["state"]), Int(states.DISCONNECTED))
		XCTAssertEqual(harness.replay.snapshot().extraTx, ["FEEA2005F8"])
		XCTAssertTrue(harness.graph.logger.entries(limit: 2000).contains { $0.tag == "IosCoreHost/removeClassicBond" })
		XCTAssertNil(harness.resolve("getLastPairedDevice") { bridge.getLastPairedDevice(completion: $0) })

		print("IOS-REPLAY \(harness.recording.source): \(replay.total) packets, TX matched \(replay.matchedTx)/\(replay.recordedTx), " +
			"READ matched \(replay.matchedReads)/\(replay.recordedReads), writes \(replay.writeTypes), battery \(intValue(battery["percentage"]) ?? -1)%, " +
			"firmware MOY-VS02-2.0.0, events \(harness.sink.events.count), export \(exported.txCount) TX + \(exported.readCount) READ, " +
			"\(Int(Date().timeIntervalSince(started) * 1000)) ms")
	}

	/// Um reload do JS: o módulo antigo morre com uma Promise pendente (rejeitada com `CANCELLED`) e o novo recebe a fila.
	func testModuleInvalidateRejectsPendingPromisesAndANewSinkGetsTheQueue() throws {
		let harness = try HostHarness(fixture: "real/lifeultragps/1.1.1/pair-info-time-steps-sync.jsonl")
		defer { harness.tearDown() }
		let bridge = harness.bridge
		let deviceId = try scanOne(harness, expectedName: "Life Ultra GPS", profileId: "lifeultragps", bleName: "Life Ultra GPS")
		// O pairDevice fica pendente (conexão retida no transporte); o invalidate chega antes do READY.
		harness.replay.holdConnects()
		let rejected = DispatchSemaphore(value: 0)
		var code: String?
		bridge.pairDevice(deviceId: deviceId, name: "Life Ultra GPS", completion: PromiseCompletion(resolve: { _ in }, reject: { rejectedCode, _, _ in
			code = rejectedCode
			rejected.signal()
		}))
		bridge.invalidate(sink: harness.sink)
		XCTAssertEqual(rejected.wait(timeout: .now() + 5), .success)
		XCTAssertEqual(code, WatchErrorCodes.shared.CANCELLED)
		let reloaded = RecordingSink()
		bridge.attach(sink: reloaded)
		harness.replay.releaseHeldConnect()
		harness.waitUntil("READY delivered to the new module") {
			reloaded.events(named: "onConnectStateChanged").contains { intValue($0.payload["state"]) == Int(states.CONNECTED) }
		}
	}

	/// Processo relançado em segundo plano (restauração): pareamento salvo e nenhum JS. O primeiro `.poweredOn` já pede a
	/// reconexão pendente (`onBluetoothTurnedOn` → `reconnectIfPaired`), sem `attach` nem `initialize`; é esse `connect`
	/// que reclama o periférico restaurado no `CentralTransport`. Os eventos esperam na fila até o módulo se ligar.
	func testFirstPoweredOnReconnectsTheSavedWatchWithoutJs() throws {
		let harness = try HostHarness(fixture: "real/lifeultragps/1.1.1/pair-info-time-steps-sync.jsonl", bluetoothOnAtStart: false, attachSink: false)
		defer { harness.tearDown() }
		harness.graph.pairing.save(CorePairing(address: ReplayTransport.peripheralAddress, profileId: "lifeultragps", name: "Life Ultra GPS"))
		harness.replay.holdConnects()
		harness.replay.setBluetooth(enabled: true)
		harness.waitUntil("connect at the first poweredOn") { !harness.replay.snapshot().connects.isEmpty }
		XCTAssertEqual(harness.replay.snapshot().connects, ["\(ReplayTransport.peripheralAddress) auto=true"])
		XCTAssertTrue(
			harness.graph.logger.entries(limit: 2000).contains { $0.tag == "CoreBridge/reconnectIfPaired" && $0.message.contains("Bluetooth turned on") },
			"reconnectIfPaired must log the Bluetooth reason"
		)
		XCTAssertEqual(harness.sink.events.count, 0, "no module attached yet")
		harness.bridge.attach(sink: harness.sink)
		harness.waitUntil("queued RECONNECTING delivered on attach") {
			harness.sink.events(named: "onConnectStateChanged").contains { $0.payload["sessionState"] as? String == "RECONNECTING" }
		}
	}

	// MARK: - Auxiliares

	private func scanOne(_ harness: HostHarness, expectedName: String, profileId: String, bleName: String) throws -> String {
		harness.bridge.scan()
		harness.waitUntil("onScannedDevice") { harness.sink.count(named: "onScannedDevice") == 1 }
		let scanned = try XCTUnwrap(harness.lastPayload("onScannedDevice"))
		XCTAssertEqual(scanned["deviceId"] as? String, ReplayTransport.peripheralAddress)
		XCTAssertEqual(scanned["name"] as? String, expectedName)
		XCTAssertEqual(scanned["profileId"] as? String, profileId)
		XCTAssertEqual(scanned["bleName"] as? String, bleName)
		XCTAssertNotNil(intValue(scanned["rssi"]))
		return try XCTUnwrap(scanned["deviceId"] as? String)
	}

	private struct LocalResult {
		let sleep: String
		let exportedTx: Int
	}

	/// O que o JS consulta sem falar com o relógio, com os tipos que o React Native recebe.
	private func checkLocalQueries(_ harness: HostHarness, deviceId: String, name: String, profileId: String, day: String, steps: Int, recordedTx: Int) throws -> LocalResult {
		let bridge = harness.bridge
		harness.resolve("getHistoryPedometer") { bridge.getHistoryPedometer(daysBefore: 30, completion: $0) }
		let history = try XCTUnwrap(harness.lastPayload("onHistoryPedometer")?["historypedometer"] as? [NSDictionary])
		let entry = try XCTUnwrap(history.first { ($0["date"] as? String)?.hasPrefix(day) == true }, "\(history)")
		XCTAssertEqual(intValue(entry["pedometer"]), steps)

		let sleep: String
		let sleepSettlement = harness.call("getHistorySleep") { bridge.getHistorySleep(completion: $0) }
		switch sleepSettlement {
		case .resolved:
			sleep = "\((harness.lastPayload("onHistorySleep")?["historysleep"] as? [Any])?.count ?? -1) nights"
		case let .rejected(code, _):
			XCTAssertEqual(code, WatchErrorCodes.shared.NO_DATA)
			XCTAssertEqual(harness.lastPayload("onError")?["code"] as? String, WatchErrorCodes.shared.NO_DATA)
			sleep = code
		}

		let paired = try XCTUnwrap(harness.resolve("getLastPairedDevice") { bridge.getLastPairedDevice(completion: $0) } as? NSDictionary)
		XCTAssertEqual(paired["deviceId"] as? String, deviceId)
		XCTAssertEqual(paired["name"] as? String, name)
		XCTAssertEqual(paired["profileId"] as? String, profileId)

		let connected = harness.resolve("isConnected") { bridge.isConnected(completion: $0) }
		XCTAssertTrue(isCFBoolean(connected), "isConnected must be a CFBoolean, got \(type(of: connected))")
		XCTAssertEqual(connected as? Bool, true)

		let logs = try XCTUnwrap(harness.resolve("getLogs") { bridge.getLogs(limit: 20, completion: $0) } as? NSArray)
		XCTAssertEqual(logs.count, 20)
		let newest = try XCTUnwrap(logs.firstObject as? NSDictionary)
		XCTAssertNotNil(newest["tag"] as? String)
		XCTAssertNotNil(newest["level"] as? String)
		XCTAssertNotNil(newest["ts"] as? NSNumber)
		XCTAssertGreaterThan(harness.sink.count(named: "onLog"), 0)

		let path = try XCTUnwrap(harness.resolve("exportLogs") { bridge.exportLogs(completion: $0) } as? String)
		XCTAssertTrue(path.hasSuffix(".jsonl"))
		let exported = try Recording.load(URL(fileURLWithPath: path))
		XCTAssertEqual(exported.txCount, recordedTx)
		XCTAssertEqual(exported.packets.count, harness.recording.packets.count)
		XCTAssertEqual(exported.mtu, harness.recording.mtu)
		let header = try XCTUnwrap(String(contentsOfFile: path, encoding: .utf8).split(separator: "\n").first)
		XCTAssertTrue(header.contains("\"platform\":\"ios\""), String(header))
		XCTAssertEqual(exported.firmware, harness.recording.firmware)
		let logsPath = path.replacingOccurrences(of: "/frames-", with: "/logs-")
		XCTAssertTrue(FileManager.default.fileExists(atPath: logsPath))
		return LocalResult(sleep: sleep, exportedTx: exported.txCount)
	}
}

/// Um número do payload como `Int` (o React Native lê `NSNumber`; um `CFBoolean` não conta).
func intValue(_ value: Any?) -> Int? {
	guard let number = value as? NSNumber, !isCFBoolean(number) else { return nil }
	return number.intValue
}

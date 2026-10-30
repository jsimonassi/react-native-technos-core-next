import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// As peças de plataforma que o `CoreBridge` não testa: o `FileSampleStore`, o `PairingStore`, o `RingLogger` e o
/// `FrameRecorder`.
final class StoreAndLogTests: XCTestCase {
	private var directory: URL!

	override func setUpWithError() throws {
		directory = FileManager.default.temporaryDirectory.appendingPathComponent("corenext-store-\(UUID().uuidString)", isDirectory: true)
	}

	override func tearDownWithError() throws {
		try? FileManager.default.removeItem(at: directory)
	}

	func testFileSampleStoreRoundTripsAndSurvivesANewInstance() {
		let logger = RingLogger(recorder: FrameRecorder())
		let store = FileSampleStore(directory: directory, logger: logger)
		let sample = StepsSample(atEpochMillis: 1_793_272_400_000, steps: 56, mode: 0, calories: 3, distanceMeters: 38.5)
		let stage = SleepStage(type: SleepStageType.deep, startEpochMillis: 0, endEpochMillis: 60_000, startIso: "a", endIso: "b")
		let night = SleepSession(dayKey: "2026-10-29", startEpochMillis: 0, endEpochMillis: 60_000, startIso: "a", endIso: "b", stages: [stage], totalMinutes: 1, lightMinutes: 0, deepMinutes: 1, remMinutes: 0, awakeMinutes: 0)
		store.saveSteps(samples: [sample])
		store.saveSleep(sessions: [night])
		store.saveConfirmedDays(kind: DataKind.steps, dayKeys: ["2026-10-28"])

		let reopened = FileSampleStore(directory: directory, logger: logger)
		XCTAssertEqual(reopened.loadSteps(), [sample])
		XCTAssertEqual(reopened.loadSleep(), [night])
		XCTAssertEqual(reopened.loadConfirmedDays(kind: DataKind.steps), ["2026-10-28"])
		XCTAssertEqual(reopened.loadConfirmedDays(kind: DataKind.sleep), [])
		XCTAssertTrue(FileManager.default.fileExists(atPath: directory.appendingPathComponent("confirmed-steps.json").path))

		reopened.clear()
		XCTAssertEqual(store.loadSteps(), [])
		XCTAssertEqual(store.loadSleep(), [])
	}

	func testUnreadableFileBecomesEmptyWithAWarningAndInvalidItemsAreSkipped() throws {
		let logger = RingLogger(recorder: FrameRecorder())
		try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
		try Data("{not json".utf8).write(to: directory.appendingPathComponent(FileSampleStore.sleepFile))
		try Data(#"{"version":1,"items":[{"atEpochMillis":1,"steps":2,"mode":0,"calories":0,"distanceMeters":0},{"steps":"x"}]}"#.utf8)
			.write(to: directory.appendingPathComponent(FileSampleStore.stepsFile))
		let store = FileSampleStore(directory: directory, logger: logger)
		XCTAssertEqual(store.loadSleep(), [])
		XCTAssertEqual(store.loadSteps().count, 1)
		let warnings = logger.entries(limit: 10).filter { $0.level == LogLevel.warn }.map(\.message)
		XCTAssertTrue(warnings.contains { $0.contains("Unreadable sleep.json") }, "\(warnings)")
		XCTAssertTrue(warnings.contains { $0.contains("Skipped 1 invalid items in steps.json") }, "\(warnings)")
	}

	func testPairingStoreUsesItsOwnSuiteAndNeverTouchesTheAppDefaults() throws {
		let suite = "br.com.grupotechnos.corenext.tests.\(UUID().uuidString)"
		let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
		defer { defaults.removePersistentDomain(forName: suite) }
		let sentinel = "corenext.tests.sentinel.\(UUID().uuidString)"
		UserDefaults.standard.set("keep", forKey: sentinel)
		defer { UserDefaults.standard.removeObject(forKey: sentinel) }
		defaults.set("other", forKey: "unrelated")

		let store = PairingStore(defaults: defaults)
		XCTAssertNil(store.load())
		store.save(CorePairing(address: "6F1C2B8E-3D4A-4C5B-9E7F-0A1B2C3D4E5F", profileId: "fitgps", name: "fitGPS"))
		XCTAssertEqual(store.load(), CorePairing(address: "6F1C2B8E-3D4A-4C5B-9E7F-0A1B2C3D4E5F", profileId: "fitgps", name: "fitGPS"))
		store.clear()
		XCTAssertNil(store.load())
		XCTAssertEqual(defaults.string(forKey: "unrelated"), "other")
		XCTAssertEqual(UserDefaults.standard.string(forKey: sentinel), "keep")
		XCTAssertNil(UserDefaults.standard.string(forKey: PairingStore.keyAddress))
	}

	/// O `CoreBridge` grava no `READY` (thread da sessão) enquanto lê de outras: um `load` nunca mistura dois relógios.
	func testPairingStoreNeverReturnsAMixOfTwoPairings() throws {
		let suite = "br.com.grupotechnos.corenext.tests.\(UUID().uuidString)"
		let defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
		defer { defaults.removePersistentDomain(forName: suite) }
		let store = PairingStore(defaults: defaults)
		let pairings = [
			CorePairing(address: "6F1C2B8E-3D4A-4C5B-9E7F-0A1B2C3D4E5F", profileId: "fitgps", name: "fitGPS"),
			CorePairing(address: "1A2B3C4D-5E6F-4A7B-8C9D-0E1F2A3B4C5D", profileId: "lifeultragps", name: "Life Ultra GPS"),
		]
		store.save(pairings[0])
		let lock = NSLock()
		var mixed: [String] = []
		DispatchQueue.concurrentPerform(iterations: 4) { worker in
			for index in 0..<2000 {
				if worker == 0 {
					store.save(pairings[index % 2])
				} else if let loaded = store.load(), !pairings.contains(loaded) {
					lock.lock()
					mixed.append("\(loaded.address) \(loaded.profileId) \(loaded.name)")
					lock.unlock()
				}
			}
		}
		XCTAssertEqual(mixed.count, 0, "first mixed pairing: \(mixed.first ?? "")")
	}

	func testRingLoggerIsThreadSafeKeepsTheLastEntriesAndHonoursTheLevel() {
		let recorder = FrameRecorder()
		let logger = RingLogger(recorder: recorder, capacity: 2000)
		let lock = NSLock()
		var delivered = 0
		logger.onEntry = { _ in
			lock.lock()
			delivered += 1
			lock.unlock()
		}
		DispatchQueue.concurrentPerform(iterations: 8) { worker in
			for index in 0..<500 {
				logger.log(level: LogLevel.info, tag: "Test/\(worker)", message: "\(index)")
				if index % 100 == 0 { _ = logger.entries(limit: 50) }
			}
		}
		XCTAssertEqual(logger.count, 2000)
		XCTAssertEqual(delivered, 4000)
		XCTAssertEqual(logger.entries(limit: 5000).count, 2000)
		XCTAssertEqual(logger.entries(limit: -1).count, 0)

		logger.minLevel = LogLevel.warn
		logger.log(level: LogLevel.info, tag: "Test/level", message: "dropped")
		logger.log(level: LogLevel.error, tag: "Test/level", message: "kept")
		XCTAssertEqual(logger.entries(limit: 1).first?.message, "kept")
		XCTAssertEqual(logger.minLevel, LogLevel.warn)

		// Pacotes vão para a gravação mesmo abaixo do nível (a fixture não pode ter buracos).
		let packet = ByteBridgeKt.toByteArray(Data([0xAB, 0x10, 0, 0, 0, 0, 0, 1]))
		logger.frame(direction: FrameDirection.rx, characteristic: "6e400003-b5a3-f393-e0a9-e50e24dcca9e", value: packet, summary: "ACK")
		XCTAssertEqual(recorder.packetCount, 1)
		XCTAssertEqual(logger.entries(limit: 1).first?.message, "kept")

		logger.minLevel = LogLevel.debug
		logger.frame(direction: FrameDirection.tx, characteristic: "0000ff61-0000-1000-8000-00805f9b34fb", value: packet, summary: "")
		let entry = logger.entries(limit: 1).first
		XCTAssertEqual(entry?.tag, "Frame/ff61")
		XCTAssertEqual(entry?.hex, "AB10000000000001")
		XCTAssertEqual(entry?.dir, FrameDirection.tx)
		XCTAssertEqual(entry?.message, "len=8 (cont.)")

		logger.clear()
		XCTAssertEqual(logger.count, 0)
		XCTAssertEqual(recorder.packetCount, 0)
	}

	func testFrameRecorderWritesAFixtureTheReplayCanRead() throws {
		var now: Int64 = 1_793_330_004_524
		let recorder = FrameRecorder(maxPackets: 2, now: { now }, timeZone: { TimeZone(identifier: "America/Sao_Paulo")! })
		recorder.deviceName = "Life Ultra GPS"
		recorder.firmware = "1.1.1"
		recorder.mtu = 23
		XCTAssertFalse(recorder.record(direction: FrameDirection.tx, characteristic: "00000af6-0000-1000-8000-00805f9b34fb", value: ByteBridgeKt.toByteArray(Data([0x02, 0x01]))))
		now += 110
		XCTAssertFalse(recorder.record(direction: FrameDirection.rx, characteristic: "00000af7-0000-1000-8000-00805f9b34fb", value: ByteBridgeKt.toByteArray(Data([0x02, 0x01, 0x66]))))
		XCTAssertTrue(recorder.record(direction: FrameDirection.tx, characteristic: "00000af6-0000-1000-8000-00805f9b34fb", value: ByteBridgeKt.toByteArray(Data([0x03]))))
		XCTAssertFalse(recorder.record(direction: FrameDirection.tx, characteristic: "00000af6-0000-1000-8000-00805f9b34fb", value: ByteBridgeKt.toByteArray(Data([0x03]))))
		XCTAssertTrue(recorder.isFull)

		let url = directory.appendingPathComponent("frames.jsonl")
		try recorder.write(to: url)
		let text = try String(contentsOf: url, encoding: .utf8)
		XCTAssertTrue(text.hasPrefix(#"{"type":"header","device":"Life Ultra GPS","firmware":"1.1.1","platform":"ios","mtu":23,"recordedAt":"2026-10-30T00:13:24.524-03:00","timeZone":"America/Sao_Paulo"}"#), text)
		let recording = try Recording.load(url)
		XCTAssertEqual(recording.packets.count, 2)
		XCTAssertEqual(recording.packets[1].value, [0x02, 0x01, 0x66])
		XCTAssertTrue(text.contains(#""atMs":110"#))
	}

	func testHostAnswersWithTheIosRules() {
		let recorder = FrameRecorder()
		let logger = RingLogger(recorder: recorder)
		let suite = "br.com.grupotechnos.corenext.tests.\(UUID().uuidString)"
		let defaults = UserDefaults(suiteName: suite)!
		defer { defaults.removePersistentDomain(forName: suite) }
		let transport = StubTransport()
		let host = IosCoreHost(logger: logger, recorder: recorder, pairing: PairingStore(defaults: defaults), transport: transport, backgroundWork: NoBackgroundWork(), exportDirectory: directory)
		XCTAssertTrue(host.isValidAddress(address: "6F1C2B8E-3D4A-4C5B-9E7F-0A1B2C3D4E5F"))
		XCTAssertTrue(host.isValidAddress(address: "6f1c2b8e-3d4a-4c5b-9e7f-0a1b2c3d4e5f"))
		XCTAssertFalse(host.isValidAddress(address: "AA:BB:CC:DD:EE:FF"))
		XCTAssertNil(host.missingScanPermission())
		transport.denied = true
		XCTAssertEqual(host.missingScanPermission(), "Bluetooth")
		XCTAssertEqual(host.missingConnectPermission(), "Bluetooth")
		XCTAssertFalse(host.isBluetoothEnabled())
		transport.poweredOn = true
		XCTAssertTrue(host.isBluetoothEnabled())
		host.setLogLevel(level: LogLevel.error)
		XCTAssertEqual(logger.minLevel, LogLevel.error)
	}
}

/// Transporte mínimo para o `IosCoreHost` responder sem Bluetooth.
private final class StubTransport: NSObject, HostTransport {
	var poweredOn = false
	var denied = false

	func attach(events: TransportEvents, delegate: HostTransportDelegate) {}
	var isPoweredOn: Bool { poweredOn }
	var isAuthorizationDenied: Bool { denied }
	var currentMtu: Int32 { 23 }
	func startScan() {}
	func stopScan() {}
	func connect(address: String, autoReconnect: Bool) {}
	func disconnect() {}
	func discoverServices() {}
	func enableNotifications(service: String, characteristic: String, requestId: Int32) {}
	func requestMtu(mtu: Int32, requestId: Int32) {}
	func write(service: String, characteristic: String, value: KotlinByteArray, type: WriteType, requestId: Int32) {}
	func read(service: String, characteristic: String, requestId: Int32) {}
}

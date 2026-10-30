import CoreBluetooth
import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// Contrato do `Transport` (ADRs 12 e 18 do Repo 1) na máquina de estados do `CentralTransport`, sem CoreBluetooth:
/// `LinkLifecycle` (quando sai `onConnected`/`onDisconnected`) e `BluetoothPowerTracker` (o que o estado do central
/// entrega). Mesmos casos do `LinkLifecycleTest` do Android, com os nomes do iOS.
final class LinkLifecycleTests: XCTestCase {
	private var emitted: [String] = []

	private func makeLifecycle() -> LinkLifecycle {
		emitted = []
		return LinkLifecycle(output: LinkLifecycle.Output(
			onConnected: { [unowned self] in self.emitted.append("connected") },
			onDisconnected: { [unowned self] status, _ in self.emitted.append("disconnected(\(status))") }
		))
	}

	private func openLink(_ link: LinkLifecycle, auto: Bool = false) -> Int {
		link.connectAccepted(autoReconnect: auto)
		let generation = link.attemptStarting()
		link.linkUp(generation)
		return generation
	}

	func testBluetoothOffWithAnOpenLinkEmitsNoDisconnectAndIgnoresTheLateCallback() {
		let link = makeLifecycle()
		let generation = openLink(link)
		XCTAssertTrue(link.bluetoothOff())
		XCTAssertEqual(link.linkDown(generation, status: 7), .stale)
		XCTAssertEqual(emitted, ["connected"])
		XCTAssertFalse(link.active)
	}

	func testBluetoothOffWithAPendingConnectionEmitsNothing() {
		let link = makeLifecycle()
		link.connectAccepted(autoReconnect: true)
		let generation = link.attemptStarting()
		XCTAssertTrue(link.bluetoothOff())
		XCTAssertEqual(link.linkDown(generation, status: 6), .stale, "a late didFailToConnect must not re-arm")
		XCTAssertEqual(emitted, [])
	}

	func testDisconnectAfterBluetoothOffEmitsNothingUntilANewConnect() {
		let link = makeLifecycle()
		_ = openLink(link)
		link.bluetoothOff()
		XCTAssertFalse(link.disconnectRequested())
		XCTAssertEqual(emitted, ["connected"])
		_ = openLink(link)
		XCTAssertTrue(link.disconnectRequested())
		XCTAssertEqual(emitted, ["connected", "connected", "disconnected(0)"])
	}

	func testBluetoothOffWhileIdleEmitsNothing() {
		let link = makeLifecycle()
		XCTAssertFalse(link.bluetoothOff())
		XCTAssertEqual(emitted, [])
	}

	func testLinkLossReportedBeforeBluetoothOffIsAnOrdinaryDrop() {
		let link = makeLifecycle()
		let generation = openLink(link)
		XCTAssertEqual(link.linkDown(generation, status: 7), .lost)
		XCTAssertFalse(link.bluetoothOff())
		XCTAssertEqual(emitted, ["connected", "disconnected(7)"])
	}

	func testConnectRejectedEmitsExactlyOnceAndLeavesTheTransportStopped() {
		let link = makeLifecycle()
		link.connectRejected(status: GattStatus.shared.NOT_CONNECTED, message: "Bluetooth is off")
		XCTAssertFalse(link.disconnectRequested())
		XCTAssertEqual(emitted, ["disconnected(-2)"])
	}

	func testConnectRejectedWithAnOpenLinkStillEmitsOnlyOnce() {
		let link = makeLifecycle()
		_ = openLink(link)
		link.connectRejected(status: GattStatus.shared.NOT_FOUND, message: "Unknown peripheral")
		XCTAssertEqual(emitted, ["connected", "disconnected(-3)"])
	}

	func testDisconnectEmitsOnceForAnOpenLinkOrAPendingConnection() {
		let link = makeLifecycle()
		_ = openLink(link)
		XCTAssertTrue(link.disconnectRequested())
		XCTAssertFalse(link.disconnectRequested())
		link.connectAccepted(autoReconnect: true)
		_ = link.attemptStarting()
		XCTAssertTrue(link.disconnectRequested())
		XCTAssertEqual(emitted, ["connected", "disconnected(0)", "disconnected(0)"])
	}

	func testLinkLossAndDirectConnectFailureStopTheTransport() {
		let link = makeLifecycle()
		let generation = openLink(link)
		XCTAssertEqual(link.linkDown(generation, status: 7), .lost)
		XCTAssertFalse(link.disconnectRequested())
		link.connectAccepted(autoReconnect: false)
		let direct = link.attemptStarting()
		XCTAssertEqual(link.linkDown(direct, status: 6), .connectFailed)
		XCTAssertFalse(link.disconnectRequested())
		XCTAssertEqual(emitted, ["connected", "disconnected(7)", "disconnected(6)"])
	}

	func testPendingConnectionFailureReArmsWithoutEvents() {
		let link = makeLifecycle()
		link.connectAccepted(autoReconnect: true)
		let first = link.attemptStarting()
		XCTAssertEqual(link.linkDown(first, status: 6), .pendingFailed)
		XCTAssertTrue(link.active, "still pending: a disconnect must answer")
		let second = link.attemptStarting()
		link.linkUp(second)
		link.linkUp(first)
		XCTAssertEqual(emitted, ["connected"])
	}

	func testConnectThatReplacesAnOpenLinkClosesItWithOneEvent() {
		let link = makeLifecycle()
		let old = openLink(link)
		link.connectAccepted(autoReconnect: true)
		XCTAssertEqual(link.linkDown(old, status: 0), .stale, "the echo of the cancelled connection")
		XCTAssertEqual(emitted, ["connected", "disconnected(0)"])
	}

	/// O Life Ultra GPS no primeiro teste no iPhone: `didFailToConnect` com `peerRemovedPairingInformation` em toda
	/// tentativa. Re-armar nunca passaria; a conexão pendente termina com um evento, como a direta (ADR 23 do Repo 1).
	func testPendingConnectionFailingWithRemovedPairingEndsWithOneEventInsteadOfReArming() {
		let link = makeLifecycle()
		link.connectAccepted(autoReconnect: true)
		let generation = link.attemptStarting()
		XCTAssertEqual(link.linkDown(generation, status: GattStatus.shared.PAIRING_REMOVED), .connectFailed)
		XCTAssertFalse(link.active, "nothing left to re-arm")
		XCTAssertFalse(link.disconnectRequested(), "the session's disconnect gets no second event")
		XCTAssertEqual(emitted, ["disconnected(-4)"])
	}

	func testDirectConnectAndOpenLinkKeepTheirEventsWithRemovedPairing() {
		let link = makeLifecycle()
		link.connectAccepted(autoReconnect: false)
		let direct = link.attemptStarting()
		XCTAssertEqual(link.linkDown(direct, status: GattStatus.shared.PAIRING_REMOVED), .connectFailed)
		let open = openLink(link, auto: true)
		XCTAssertEqual(link.linkDown(open, status: GattStatus.shared.PAIRING_REMOVED), .lost)
		XCTAssertEqual(emitted, ["disconnected(-4)", "connected", "disconnected(-4)"])
	}
}

final class BluetoothPowerTrackerTests: XCTestCase {
	func testCentralBornPoweredOffReportsFalseOnce() {
		var tracker = BluetoothPowerTracker()
		XCTAssertEqual(tracker.update(.unknown), .none)
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOff)), .turnedOff)
		XCTAssertEqual(tracker.update(BluetoothPower(.unauthorized)), .none)
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOn)), .turnedOn)
	}

	func testFirstStateOnOnlyWakesTheBridge() {
		var tracker = BluetoothPowerTracker()
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOn)), .initialOn)
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOn)), .none)
	}

	func testEveryTransitionIsDeliveredOnce() {
		var tracker = BluetoothPowerTracker()
		_ = tracker.update(.on)
		XCTAssertEqual(tracker.update(BluetoothPower(.resetting)), .turnedOff)
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOff)), .none)
		XCTAssertEqual(tracker.update(BluetoothPower(.poweredOn)), .turnedOn)
		XCTAssertEqual(tracker.update(BluetoothPower(.unsupported)), .turnedOff)
	}

	func testStateMapping() {
		XCTAssertEqual(BluetoothPower(.poweredOn), .on)
		XCTAssertEqual(BluetoothPower(.unknown), .unknown)
		for state: CBManagerState in [.poweredOff, .unauthorized, .unsupported, .resetting] {
			XCTAssertEqual(BluetoothPower(state), .off)
		}
	}
}

/// `GattQueue` com um agendador manual: uma operação por vez, timeout, callback de outro tipo, escrita sem resposta
/// esperando crédito, `failAll`.
final class GattQueueTests: XCTestCase {
	private final class ManualScheduler: GattQueue.Scheduler {
		final class Token {
			let action: () -> Void
			var cancelled = false
			init(_ action: @escaping () -> Void) { self.action = action }
		}

		var tokens: [Token] = []

		func schedule(after seconds: TimeInterval, _ action: @escaping () -> Void) -> AnyObject {
			let token = Token(action)
			tokens.append(token)
			return token
		}

		func cancel(_ token: AnyObject) { (token as? Token)?.cancelled = true }

		func fireAll() {
			for token in tokens where !token.cancelled {
				token.cancelled = true
				token.action()
			}
		}
	}

	private var finished: [String] = []

	private func operation(_ name: String, _ kind: GattQueue.Kind, start: GattQueue.Start = .pending) -> GattQueue.Operation {
		GattQueue.Operation(kind: kind, name: name, start: { start }, finish: { [unowned self] status, _ in self.finished.append("\(name):\(status)") })
	}

	func testRunsOneOperationAtATimeAndIgnoresCallbacksOfAnotherKind() {
		let queue = GattQueue(scheduler: ManualScheduler())
		queue.enqueue(operation("a", .write))
		queue.enqueue(operation("b", .notify))
		XCTAssertEqual(queue.active?.name, "a")
		XCTAssertFalse(queue.complete(.notify, status: 0))
		XCTAssertTrue(queue.complete(.write, status: 0))
		XCTAssertEqual(queue.active?.name, "b")
		XCTAssertTrue(queue.complete(.notify, status: 5))
		XCTAssertEqual(finished, ["a:0", "b:5"])
	}

	func testTimeoutFinishesWithTimeoutAndStartsTheNext() {
		let scheduler = ManualScheduler()
		let queue = GattQueue(scheduler: scheduler)
		queue.enqueue(operation("a", .write))
		queue.enqueue(operation("b", .write))
		scheduler.fireAll()
		XCTAssertEqual(finished.first, "a:\(GattStatus.shared.TIMEOUT)")
		XCTAssertEqual(queue.active?.name, "b")
	}

	func testDoneAtStartFinishesImmediately() {
		let queue = GattQueue(scheduler: ManualScheduler())
		queue.enqueue(operation("mtu", .mtu, start: .done(status: 0, payload: Int32(23))))
		queue.enqueue(operation("w", .write, start: .done(status: 0, payload: nil)))
		XCTAssertNil(queue.active)
		XCTAssertEqual(finished, ["mtu:0", "w:0"])
	}

	func testWriteWithoutResponseWaitsForCreditAndRetries() {
		let queue = GattQueue(scheduler: ManualScheduler())
		var credit = false
		var writes = 0
		queue.enqueue(GattQueue.Operation(kind: .write, name: "nr", start: {
			guard credit else { return .waitingForCredit }
			writes += 1
			return .done(status: 0, payload: nil)
		}, finish: { [unowned self] status, _ in self.finished.append("nr:\(status)") }))
		queue.enqueue(operation("next", .write))
		XCTAssertTrue(queue.isWaitingForCredit)
		XCTAssertFalse(queue.complete(.notify, status: 0))
		credit = true
		queue.retryStart()
		XCTAssertEqual(writes, 1)
		XCTAssertEqual(finished, ["nr:0"])
		XCTAssertEqual(queue.active?.name, "next")
	}

	func testFailAllFinishesEveryOperationOnce() {
		let scheduler = ManualScheduler()
		let queue = GattQueue(scheduler: scheduler)
		queue.enqueue(operation("a", .discover))
		queue.enqueue(operation("b", .write))
		queue.failAll(status: GattStatus.shared.NOT_CONNECTED)
		scheduler.fireAll()
		XCTAssertFalse(queue.complete(.discover, status: 0))
		XCTAssertEqual(finished, ["a:-2", "b:-2"])
		XCTAssertNil(queue.active)
	}
}

/// Relançamento pela restauração (`RestoredPeripherals`): o `didConnect` de um restaurado que chega antes do `connect()`
/// da sessão fica aberto; depois de reclamado, ou com outra tentativa em curso, volta a ser cancelado como conexão velha.
final class RestoredPeripheralsTests: XCTestCase {
	private let watch = UUID()
	private let other = UUID()

	func testRestoredConnectionArrivingBeforeTheSessionConnectIsKept() {
		var restored = RestoredPeripherals()
		restored.restore([watch])
		XCTAssertTrue(restored.keepsUnrequestedConnection(watch, transportBusy: false))
		XCTAssertFalse(restored.keepsUnrequestedConnection(other, transportBusy: false), "not restored: a stale connection")
	}

	func testAnotherAttemptInProgressCancelsTheRestoredConnection() {
		var restored = RestoredPeripherals()
		restored.restore([watch])
		XCTAssertFalse(restored.keepsUnrequestedConnection(watch, transportBusy: true))
	}

	func testOnceClaimedALateDidConnectIsStaleAgain() {
		var restored = RestoredPeripherals()
		restored.restore([watch, other])
		restored.claim(watch)
		XCTAssertFalse(restored.keepsUnrequestedConnection(watch, transportBusy: false))
		XCTAssertEqual(restored.unclaimed, [other])
	}

	func testReleaseReturnsTheUnclaimedOnesAndEmptiesTheList() {
		var restored = RestoredPeripherals()
		restored.restore([watch, other])
		restored.claim(watch)
		XCTAssertEqual(restored.releaseAll(), [other])
		XCTAssertTrue(restored.isEmpty)
		XCTAssertFalse(restored.keepsUnrequestedConnection(other, transportBusy: false))
	}
}

/// Re-arme da conexão pendente (`RearmBackoff`): na hora depois de uma tentativa que esperou; espera crescente só para
/// falhas rápidas seguidas.
final class RearmBackoffTests: XCTestCase {
	func testAFailureAfterWaitingReArmsAtOnceEvenAfterFastFailures() {
		var backoff = RearmBackoff()
		XCTAssertEqual(backoff.failed(after: 0.2), 1)
		XCTAssertEqual(backoff.failed(after: 0.2), 2)
		XCTAssertEqual(backoff.failed(after: 3600), 0, "the watch showed up after a long wait")
		XCTAssertEqual(backoff.fastFailures, 0)
		XCTAssertEqual(backoff.failed(after: 0.2), 1, "the count restarts")
	}

	func testFastFailuresDoubleFromOneUpToThirtySeconds() {
		var backoff = RearmBackoff()
		let delays = (0..<8).map { _ in backoff.failed(after: 0.5) }
		XCTAssertEqual(delays, [1, 2, 4, 8, 16, 30, 30, 30])
	}

	func testThresholdAndReset() {
		var backoff = RearmBackoff()
		XCTAssertEqual(backoff.failed(after: RearmBackoff.fastFailure), 0)
		XCTAssertEqual(backoff.failed(after: RearmBackoff.fastFailure - 0.01), 1)
		backoff.reset()
		XCTAssertEqual(backoff.fastFailures, 0)
		XCTAssertEqual(backoff.failed(after: 0), 1)
	}
}

/// Tipo de escrita efetivo (`CentralTransport.effectiveWriteType`): o CoreBluetooth descarta em silêncio a escrita de
/// um tipo que a characteristic não declara, então o transporte usa o outro declarado ou falha.
final class WriteTypeTests: XCTestCase {
	func testRequestedTypeIsUsedWhenDeclared() {
		XCTAssertEqual(CentralTransport.effectiveWriteType(withResponse: false, properties: [.write, .writeWithoutResponse]), .withoutResponse)
		XCTAssertEqual(CentralTransport.effectiveWriteType(withResponse: true, properties: [.write, .writeWithoutResponse]), .withResponse)
	}

	func testWriteCommandOnACharacteristicWithoutTheWithoutResponsePropertyFallsBackToWriteRequest() {
		XCTAssertEqual(CentralTransport.effectiveWriteType(withResponse: false, properties: [.write, .notify]), .withResponse)
		XCTAssertEqual(CentralTransport.effectiveWriteType(withResponse: true, properties: [.writeWithoutResponse]), .withoutResponse)
	}

	func testNoWritePropertyFails() {
		XCTAssertNil(CentralTransport.effectiveWriteType(withResponse: false, properties: [.read, .notify]))
		XCTAssertNil(CentralTransport.effectiveWriteType(withResponse: true, properties: []))
		XCTAssertEqual(CentralTransport.writeNotPermittedStatus, 3)
	}

	func testPropertiesAreDescribedForTheLog() {
		XCTAssertEqual(CentralTransport.describe([.writeWithoutResponse, .write, .notify]), "write|writeWithoutResponse|notify")
		XCTAssertEqual(CentralTransport.describe([]), "")
	}
}

/// Status que o `CentralTransport` entrega à sessão para cada `NSError` do CoreBluetooth: `linkStatus` na conexão, na
/// descoberta e no CCCD; `status` na escrita e na leitura.
final class TransportStatusTests: XCTestCase {
	func testPeerRemovedPairingInformationBecomesThePlatformNeutralStatusWhereTheSessionHandlesIt() {
		let error = NSError(domain: CBErrorDomain, code: CBError.Code.peerRemovedPairingInformation.rawValue)
		XCTAssertEqual(CBError.Code.peerRemovedPairingInformation.rawValue, 14)
		XCTAssertEqual(CentralTransport.linkStatus(error), GattStatus.shared.PAIRING_REMOVED)
		XCTAssertEqual(CentralTransport.linkStatus(CBError(.peerRemovedPairingInformation)), GattStatus.shared.PAIRING_REMOVED)
	}

	/// A sessão trata uma escrita ou leitura que falha como `TRANSPORT`; o 14 nativo deixa isso claro no log.
	func testWritesAndReadsKeepTheNativeCodeOfARemovedPairing() {
		let error = NSError(domain: CBErrorDomain, code: CBError.Code.peerRemovedPairingInformation.rawValue)
		XCTAssertEqual(CentralTransport.status(error), 14)
	}

	func testOtherErrorsKeepTheirNativeCode() {
		for convert in [CentralTransport.status, CentralTransport.linkStatus] {
			XCTAssertEqual(convert(nil), GattStatus.shared.SUCCESS)
			XCTAssertEqual(convert(NSError(domain: CBErrorDomain, code: CBError.Code.connectionTimeout.rawValue)), 6)
			XCTAssertEqual(convert(NSError(domain: CBATTErrorDomain, code: 14)), 14, "ATT 14 is unlikelyError, not a removed pairing")
			XCTAssertEqual(convert(NSError(domain: CBErrorDomain, code: 0)), CentralTransport.unknownErrorStatus)
		}
	}
}

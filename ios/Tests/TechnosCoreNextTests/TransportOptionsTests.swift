import CoreBluetooth
import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol
import XCTest

/// Opções do `central.connect` por quirk do perfil: só o Condor Reebok (`Quirks.iosTransportBridging`) conecta com
/// `CBConnectPeripheralOptionEnableTransportBridgingKey`, como a SDK iOS CRP; o fitGPS e o Life Ultra GPS seguem sem
/// opções. A decisão é do grafo, pelo perfil que a sessão gravou antes de pedir o `connect`.
final class TransportOptionsTests: XCTestCase {
	func testBridgingQuirkAddsConnectOption() throws {
		XCTAssertNil(CentralTransport.connectOptions(transportBridging: false))
		let options = try XCTUnwrap(CentralTransport.connectOptions(transportBridging: true))
		XCTAssertEqual(options.count, 1)
		XCTAssertEqual(options[CBConnectPeripheralOptionEnableTransportBridgingKey] as? Bool, true)
		XCTAssertEqual(CentralTransport.describe(nil), "none")
		XCTAssertTrue(CentralTransport.describe(options).hasSuffix("=true"), CentralTransport.describe(options))

		XCTAssertTrue(Profiles.shared.CONDOR_REEBOK.quirks.iosTransportBridging)
		XCTAssertFalse(Profiles.shared.MORMAII_FIT_GPS.quirks.iosTransportBridging)
		XCTAssertFalse(Profiles.shared.MORMAII_LIFE_ULTRA_GPS.quirks.iosTransportBridging)

		let condor = try connectingHarness(fixture: "synthetic/condorreebok-pair-sync.jsonl", name: "Condor Reebok")
		defer { condor.tearDown() }
		XCTAssertEqual(condor.graph.transportConnectOptions()?[CBConnectPeripheralOptionEnableTransportBridgingKey] as? Bool, true)

		let fitGps = try connectingHarness(fixture: "real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl", name: "fitGPS")
		defer { fitGps.tearDown() }
		XCTAssertNil(fitGps.graph.transportConnectOptions())
	}

	/// Um grafo com o `pairDevice` parado no `connect` (relógio "fora de alcance"): a sessão já tem o perfil.
	private func connectingHarness(fixture: String, name: String) throws -> HostHarness {
		let harness = try HostHarness(fixture: fixture)
		XCTAssertNil(harness.graph.transportConnectOptions(), "no profile before the first connect")
		harness.replay.holdConnects()
		harness.bridge.pairDevice(deviceId: ReplayTransport.peripheralAddress, name: name, completion: PromiseCompletion(resolve: { _ in }, reject: { _, _, _ in }))
		harness.waitUntil("connect requested") { !harness.replay.snapshot().connects.isEmpty }
		return harness
	}
}

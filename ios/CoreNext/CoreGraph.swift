import Foundation
import TechnosWatchProtocol

/// Montagem nativa do Core iOS, uma por processo: logger, gravador, store, transporte, sessão, o `IosCoreHost` e o
/// `CoreBridge` do Repo 1 sobre eles. Par do `CoreGraph` do Android.
///
/// Por que por processo e não por módulo: o TurboModule é recriado a cada reload do JS, mas o link BLE, um sync em
/// andamento e o histórico local não podem cair junto. O módulo só se liga (`CoreBridge.attach`) e se desliga
/// (`CoreBridge.invalidate`) do controlador.
///
/// Não decide nada: o que cada método JS faz mora no `CoreBridge`. Aqui ficam só as ligações que dependem do iOS: o
/// scan, o log e o resultado do vínculo clássico entregam ao controlador, o estado do Bluetooth passa pelo transporte
/// (que tem o papel dele no contrato B) antes de avisar o controlador, e as opções do connect saem do perfil da sessão
/// (`HostTransportDelegate`).
///
/// Criado por `CoreNext.bootstrap(launchOptions:)` no launch do app (para a restauração do Bluetooth) ou, sem isso, no
/// primeiro método JS.
final class CoreGraph: HostTransportDelegate {
	/// Pasta do histórico local, dentro de `Application Support`.
	static let storeDirectoryName = "corenext"
	/// Pasta do `exportLogs`, dentro de `Documents`.
	static let exportDirectoryName = "corenext"

	private static let sharedLock = NSLock()
	private static var sharedInstance: CoreGraph?

	/// O grafo do processo, criado na primeira chamada com as peças de produção.
	static var shared: CoreGraph {
		sharedLock.lock()
		defer { sharedLock.unlock() }
		if let existing = sharedInstance { return existing }
		let created = CoreGraph.production()
		sharedInstance = created
		return created
	}

	/// `true` se o grafo do processo já existe (sem criá-lo).
	static var isCreated: Bool {
		sharedLock.lock()
		defer { sharedLock.unlock() }
		return sharedInstance != nil
	}

	let logger: RingLogger
	let recorder: FrameRecorder
	let transport: HostTransport
	let store: FileSampleStore
	let pairing: PairingStore
	let session: WatchSession
	let host: IosCoreHost
	/// O controlador comum: o TurboModule chama o método de mesmo nome daqui em cada método JS.
	let bridge: CoreBridge

	/// - Parameters:
	///   - transport: fábrica do transporte, que recebe o logger do grafo (produção: `CentralTransport`).
	///   - clock: relógio da sessão; `nil` usa o do sistema (os testes de replay fixam a hora da gravação).
	init(
		transport makeTransport: (RingLogger) -> HostTransport,
		storeDirectory: URL,
		exportDirectory: URL,
		pairing: PairingStore,
		backgroundWork makeBackgroundWork: (RingLogger) -> BackgroundWork,
		clock: WatchClock? = nil
	) {
		let recorder = FrameRecorder()
		let logger = RingLogger(recorder: recorder)
		let transport = makeTransport(logger)
		let store = FileSampleStore(directory: storeDirectory, logger: logger)
		let session: WatchSession
		if let clock {
			session = WatchSession(transport: transport, logger: logger, store: store, clock: clock)
		} else {
			session = WatchSession(transport: transport, logger: logger, store: store)
		}
		let host = IosCoreHost(
			logger: logger,
			recorder: recorder,
			pairing: pairing,
			transport: transport,
			backgroundWork: makeBackgroundWork(logger),
			exportDirectory: exportDirectory
		)
		self.recorder = recorder
		self.logger = logger
		self.transport = transport
		self.store = store
		self.pairing = pairing
		self.session = session
		self.host = host
		// O construtor liga o listener da sessão; os callbacks do transporte e do log só chegam depois desta linha.
		bridge = CoreBridge(session: session, logger: logger, host: host)
		// O resultado do vínculo clássico (sempre "não suportado" no iOS) volta ao controlador; fraco para não reter o bridge.
		host.onClassicBondResult = { [weak bridge] address, result, message in
			bridge?.onClassicBondResult(address: address, result: result, message: message)
		}
		// O CoreBridge manda o onLog sem fila: é volumoso e já fica no anel (getLogs).
		logger.onEntry = { [bridge] entry in bridge.onLogEntry(entry: entry.coreLogEntry) }
		// Por último: o central nasce aqui, e o primeiro estado dele já encontra o controlador pronto.
		transport.attach(events: session.events, delegate: self)
		logger.log(level: LogLevel.info, tag: "CoreGraph/init", message: "Native graph created")
	}

	/// As peças de produção: `CentralTransport`, histórico em `Application Support/corenext/`, export em
	/// `Documents/corenext/`, pareamento na suíte própria do `UserDefaults` e tarefa de segundo plano do UIKit.
	static func production() -> CoreGraph {
		let files = FileManager.default
		let support = files.urls(for: .applicationSupportDirectory, in: .userDomainMask).first ?? files.temporaryDirectory
		let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first ?? files.temporaryDirectory
		return CoreGraph(
			transport: { logger in CentralTransport(logger: logger) },
			storeDirectory: support.appendingPathComponent(storeDirectoryName, isDirectory: true),
			exportDirectory: documents.appendingPathComponent(exportDirectoryName, isDirectory: true),
			pairing: PairingStore.production(),
			backgroundWork: { logger in UIKitBackgroundWork(logger: logger) }
		)
	}

	// MARK: - HostTransportDelegate

	/// Bluetooth desligado: o controlador para o scan antes de o transporte entregar o `false` à sessão.
	func transportBluetoothWillTurnOff() {
		bridge.onBluetoothTurnedOff()
	}

	/// Bluetooth ligado: o transporte já entregou o `true` à sessão; só então o controlador decide reconectar, para a
	/// reconexão entrar na fila da sessão depois do evento.
	func transportBluetoothDidTurnOn() {
		bridge.onBluetoothTurnedOn()
	}

	func transportDidDiscover(profile: DeviceProfile, address: String, rssi: Int32, bleName: String) {
		bridge.onScannedDevice(profile: profile, address: address, rssi: rssi, bleName: bleName)
	}

	func transportScanFailed(errorCode: Int32, message: String) {
		bridge.onScanFailed(errorCode: errorCode, message: message)
	}

	/// Opções do connect pelo perfil da sessão: transport bridging só com `Quirks.iosTransportBridging` (Condor Reebok).
	/// A sessão grava o perfil (`currentProfileId`) antes de pedir o `connect` ao transporte.
	func transportConnectOptions() -> [String: Any]? {
		let bridging = session.currentProfileId.flatMap { DeviceRegistry.shared.byId(id: $0) }?.quirks.iosTransportBridging ?? false
		return CentralTransport.connectOptions(transportBridging: bridging)
	}
}

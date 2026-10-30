import CoreBluetooth
import Foundation
import TechnosWatchProtocol

/// `Transport` do Repo 1 sobre `CBCentralManager`/`CBPeripheral`, e o scan. É a única classe do Core iOS que fala com o
/// CoreBluetooth; par do `AndroidGattTransport`. O desenho e os motivos estão em `docs/ios-pendente.md`.
///
/// **Threading.** Tudo roda numa fila serial própria (`queue`): os métodos do `Transport` só despacham para ela, e o
/// central é criado com a mesma fila, então os callbacks do CoreBluetooth também chegam lá; o estado desta classe nunca é
/// tocado por duas threads. Os eventos saem direto da fila para o `TransportEvents`, que só enfileira na sessão. Só
/// `isPoweredOn` e `currentMtu`, que o `IosCoreHost` lê de qualquer thread, ficam atrás de uma trava.
///
/// **Ciclo de vida do link** (regra no `LinkLifecycle`):
/// - `connect(address)`: o endereço é o UUID do `CBPeripheral`. O periférico vem do cache do scan ou da restauração, do
///   `retrievePeripherals(withIdentifiers:)` ou do `retrieveConnectedPeripherals(withServices:)`; sem nenhum, a conexão é
///   recusada (`NOT_FOUND`, um `onDisconnected`). `central.connect` não tem timeout no iOS: com `autoReconnect = true` ele
///   é a própria conexão pendente (o sistema mantém e acorda o app quando o relógio volta); com `false`, quem desiste é a
///   sessão (`connectTimeoutMs`), com um `disconnect()`.
/// - Um link que caiu (`didDisconnectPeripheral` com link aberto) sai como `onDisconnected` e não é re-armado: quem
///   reconecta é a sessão. Só a conexão pendente que falha sem conectar (`didFailToConnect`) é re-armada: na hora se a
///   tentativa esperou (o relógio apareceu e a conexão não fechou), senão com espera que dobra de 1 s até 30 s
///   (`RearmBackoff`, que explica o porquê no segundo plano). A exceção é o `CBError.peerRemovedPairingInformation` (o
///   iPhone guarda um vínculo que o relógio apagou, e só o usuário o remove nos Ajustes): vira
///   `GattStatus.PAIRING_REMOVED`, com WARN no log, e a conexão pendente termina com `onDisconnected`, como a direta
///   (`LinkLifecycle.linkDown`; ADR 23 do Repo 1). A tradução vale só onde o contrato a põe (`linkStatus`).
/// - `didDisconnectPeripheral` sem link aberto é o eco de um `cancelPeripheralConnection` (que o CoreBluetooth também
///   avisa) e é descartado.
/// - **Contrato B**: `.poweredOff` (e `.unauthorized`, `.unsupported`, `.resetting`) para o transporte sem nenhum
///   `onDisconnected` e entrega só `onBluetoothStateChanged(false)`; um `disconnect()` seguinte não emite nada até um
///   `connect()` novo. Se o central já nasce desligado, entrega o mesmo `false` (`BluetoothPowerTracker`).
///
/// **Operações** (uma por vez, `GattQueue`, timeout de 4 s; a descoberta, 15 s):
/// - `discoverServices`: `discoverServices(nil)` e `discoverCharacteristics(nil, for:)` de cada serviço; UUIDs pelo
///   `GattUuid.normalize` (o `CBUUID.uuidString` vem em maiúsculas e às vezes curto, `FF60`).
/// - `enableNotifications`: `setNotifyValue(true)` → `didUpdateNotificationStateFor`.
/// - `requestMtu`: responde na hora com `maximumWriteValueLength(for: .withoutResponse) + 3`, o MTU ATT real do link, e
///   nunca com o valor de `.withResponse` (512, uma escrita longa; ADR 5 do Repo 1, emenda). O app não negocia MTU no iOS.
/// - `write` `.withResponse` termina em `didWriteValueFor`. `.withoutResponse` (o iDO escreve assim) não tem callback no
///   iOS: escreve quando `canSendWriteWithoutResponse` e termina na hora; com o buffer cheio, espera
///   `peripheralIsReady(toSendWriteWithoutResponse:)`. O tipo pedido só é usado se a characteristic o declara: o
///   CoreBluetooth descarta em silêncio um Write Command numa characteristic sem `.writeWithoutResponse` (o Android
///   manda assim mesmo), então cai no outro tipo declarado, com WARN, ou falha com status 3 (`effectiveWriteType`).
///   O `discoverServices` loga as propriedades de cada characteristic.
/// - `read`: `readValue` → `didUpdateValueFor` da mesma characteristic enquanto a leitura é a operação atual; fora disso,
///   `didUpdateValueFor` é notificação, entregue uma por chamada, na ordem, pela sobrecarga com `Data` (que copia).
///
/// **Restauração**: com `bluetooth-central` em `UIBackgroundModes`, o central nasce com
/// `CBCentralManagerOptionRestoreIdentifierKey`; o `willRestoreState` guarda os periféricos restaurados no cache e em
/// `RestoredPeripherals`. A sessão reconecta pelo `CoreBridge`, que pede o `connect` do relógio salvo já no primeiro
/// `.poweredOn`, sem JS; um `didConnect` de restaurado que chega antes desse `connect` não é cancelado, e quem não for
/// reclamado em `restoredClaimTimeout` é. Limites em `docs/ios-pendente.md`.
final class CentralTransport: NSObject, HostTransport {
	static let restoreIdentifier = "br.com.grupotechnos.corenext.central"
	static let scanDuration: TimeInterval = 7
	static let discoveryTimeout: TimeInterval = 15
	/// Prazo para a sessão reclamar (`connect()`) um periférico restaurado; dentro do despertar em segundo plano.
	static let restoredClaimTimeout: TimeInterval = 10
	static let defaultMtu: Int32 = 23
	/// Status de um `NSError` com código 0 (`CBError.unknown`), para não se confundir com `GattStatus.SUCCESS`; o mesmo
	/// número do `GATT_FAILURE` do Android.
	static let unknownErrorStatus: Int32 = 257
	/// Status de uma escrita numa characteristic que não declara nenhum tipo de escrita: o `CBATTError.writeNotPermitted`,
	/// o mesmo número do `GATT_WRITE_NOT_PERMITTED` do Android.
	static let writeNotPermittedStatus = Int32(CBATTError.writeNotPermitted.rawValue)

	/// A fila serial do Bluetooth (o central entrega os callbacks aqui).
	let queue = DispatchQueue(label: "br.com.grupotechnos.corenext.ble")

	private let logger: WatchLogger
	private let bundle: Bundle
	private let showPowerAlert: Bool

	private let stateLock = NSLock()
	private var poweredOnFlag = false
	private var mtuValue: Int32 = CentralTransport.defaultMtu

	// Estado abaixo: só na `queue`.
	private var central: CBCentralManager?
	private var events: TransportEvents?
	private weak var delegate: HostTransportDelegate?
	private var gattQueue: GattQueue!
	private var lifecycle: LinkLifecycle!
	private var power = BluetoothPowerTracker()
	private var peripheral: CBPeripheral?
	private var attemptGeneration = 0
	private var targetId: UUID?
	private var known: [UUID: CBPeripheral] = [:]
	private var rearmItem: DispatchWorkItem?
	private var backoff = RearmBackoff()
	private var attemptStartedAt = Date()
	private var restored = RestoredPeripherals()
	private var restoredReleaseItem: DispatchWorkItem?
	private var writeTypeWarnings = Set<String>()
	private var servicesAwaitingCharacteristics = 0
	private var readTarget: CBCharacteristic?
	private var scanning = false
	private var scanSeen = Set<UUID>()
	private var scanLogged = Set<String>()
	private var scanStopItem: DispatchWorkItem?

	/// - Parameter showPowerAlert: `CBCentralManagerOptionShowPowerAlertKey`; ligado como no Core iOS atual
	///   (`SMAService.m:48`): o sistema oferece ligar o Bluetooth quando o central nasce com ele desligado.
	init(logger: WatchLogger, bundle: Bundle = .main, showPowerAlert: Bool = true) {
		self.logger = logger
		self.bundle = bundle
		self.showPowerAlert = showPowerAlert
		super.init()
		gattQueue = GattQueue(scheduler: DispatchQueueScheduler(queue: queue))
		lifecycle = LinkLifecycle(output: LinkLifecycle.Output(
			onConnected: { [weak self] in self?.events?.onConnected() },
			onDisconnected: { [weak self] status, message in self?.events?.onDisconnected(status: status, message: message) }
		))
	}

	// MARK: - HostTransport

	func attach(events: TransportEvents, delegate: HostTransportDelegate) {
		queue.sync {
			self.events = events
			self.delegate = delegate
			createCentral()
		}
	}

	var isPoweredOn: Bool {
		stateLock.lock()
		defer { stateLock.unlock() }
		return poweredOnFlag
	}

	var isAuthorizationDenied: Bool {
		switch CBManager.authorization {
		case .denied, .restricted: return true
		default: return false
		}
	}

	var currentMtu: Int32 {
		stateLock.lock()
		defer { stateLock.unlock() }
		return mtuValue
	}

	func startScan() {
		queue.async { self.doStartScan() }
	}

	func stopScan() {
		queue.async { self.stopScanning() }
	}

	// MARK: - Transport

	func connect(address: String, autoReconnect: Bool) {
		queue.async { self.doConnect(address: address, autoReconnect: autoReconnect) }
	}

	func disconnect() {
		queue.async { self.doDisconnect() }
	}

	func discoverServices() {
		queue.async {
			guard let target = self.connectedPeripheral() else {
				self.events?.onServicesDiscovered(services: [], status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			self.gattQueue.enqueue(GattQueue.Operation(
				kind: .discover,
				name: "discoverServices",
				timeout: CentralTransport.discoveryTimeout,
				start: { [weak self] in
					self?.servicesAwaitingCharacteristics = -1
					target.discoverServices(nil)
					return .pending
				},
				finish: { [weak self] status, payload in
					guard let self else { return }
					let services = status == GattStatus.shared.SUCCESS ? (payload as? [DiscoveredService] ?? []) : []
					self.log(LogLevel.info, "discoverServices", "status=\(status) services=\(services.map { $0.uuid })")
					if status == GattStatus.shared.SUCCESS { self.logCharacteristics(of: target) }
					self.events?.onServicesDiscovered(services: services, status: status)
				}
			))
		}
	}

	func enableNotifications(service: String, characteristic: String, requestId: Int32) {
		queue.async {
			guard let target = self.connectedPeripheral() else {
				self.events?.onNotificationsEnabled(requestId: requestId, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			guard let found = self.findCharacteristic(service: service, characteristic: characteristic) else {
				self.events?.onNotificationsEnabled(requestId: requestId, status: GattStatus.shared.NOT_FOUND)
				return
			}
			self.gattQueue.enqueue(GattQueue.Operation(
				kind: .notify,
				name: "enableNotifications \(characteristic)",
				start: {
					if found.isNotifying { return .done(status: GattStatus.shared.SUCCESS, payload: nil) }
					guard !found.properties.isDisjoint(with: [.notify, .indicate]) else {
						return .done(status: CentralTransport.unknownErrorStatus, payload: nil)
					}
					target.setNotifyValue(true, for: found)
					return .pending
				},
				finish: { [weak self] status, _ in
					self?.log(LogLevel.info, "enableNotifications", "characteristic=\(characteristic) status=\(status)")
					self?.events?.onNotificationsEnabled(requestId: requestId, status: status)
				}
			))
		}
	}

	func requestMtu(mtu: Int32, requestId: Int32) {
		queue.async {
			guard let target = self.connectedPeripheral() else {
				self.events?.onMtuChanged(requestId: requestId, mtu: self.currentMtu, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			self.gattQueue.enqueue(GattQueue.Operation(
				kind: .mtu,
				name: "requestMtu \(mtu)",
				start: { [weak self] in
					let effective = CentralTransport.attMtu(of: target)
					self?.setMtu(effective)
					return .done(status: GattStatus.shared.SUCCESS, payload: effective)
				},
				finish: { [weak self] status, payload in
					guard let self else { return }
					let effective = payload as? Int32 ?? self.currentMtu
					self.log(LogLevel.info, "requestMtu", "requested=\(mtu) effective=\(effective) (maximumWriteValueLength(.withoutResponse) + 3) status=\(status)")
					self.events?.onMtuChanged(requestId: requestId, mtu: effective, status: status)
				}
			))
		}
	}

	func write(service: String, characteristic: String, value: KotlinByteArray, type: WriteType, requestId: Int32) {
		// Cópia na thread de quem chamou: o KotlinByteArray é da sessão.
		let data = value.toData()
		let withResponse = type == WriteType.withResponse
		queue.async {
			guard let target = self.connectedPeripheral() else {
				self.events?.onWriteCompleted(requestId: requestId, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			guard let found = self.findCharacteristic(service: service, characteristic: characteristic) else {
				self.events?.onWriteCompleted(requestId: requestId, status: GattStatus.shared.NOT_FOUND)
				return
			}
			self.gattQueue.enqueue(GattQueue.Operation(
				kind: .write,
				name: "write \(characteristic)",
				start: { [weak self] in
					guard let writeType = self?.resolveWriteType(found, characteristic: characteristic, withResponse: withResponse) else {
						return .done(status: CentralTransport.writeNotPermittedStatus, payload: nil)
					}
					if writeType == .withResponse {
						target.writeValue(data, for: found, type: .withResponse)
						return .pending
					}
					// Sem didWriteValueFor para Write Command no iOS: a escrita termina quando o CoreBluetooth a aceita.
					guard target.canSendWriteWithoutResponse else { return .waitingForCredit }
					target.writeValue(data, for: found, type: .withoutResponse)
					return .done(status: GattStatus.shared.SUCCESS, payload: nil)
				},
				finish: { [weak self] status, _ in
					if status != GattStatus.shared.SUCCESS {
						self?.log(LogLevel.warn, "write", "characteristic=\(characteristic) withResponse=\(withResponse) status=\(status)")
					}
					self?.events?.onWriteCompleted(requestId: requestId, status: status)
				}
			))
		}
	}

	func read(service: String, characteristic: String, requestId: Int32) {
		queue.async {
			guard let target = self.connectedPeripheral() else {
				self.events?.onReadCompleted(requestId: requestId, data: nil, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			guard let found = self.findCharacteristic(service: service, characteristic: characteristic) else {
				self.events?.onReadCompleted(requestId: requestId, data: nil, status: GattStatus.shared.NOT_FOUND)
				return
			}
			self.gattQueue.enqueue(GattQueue.Operation(
				kind: .read,
				name: "read \(characteristic)",
				start: { [weak self] in
					self?.readTarget = found
					target.readValue(for: found)
					return .pending
				},
				finish: { [weak self] status, payload in
					self?.readTarget = nil
					let value = status == GattStatus.shared.SUCCESS ? payload as? Data : nil
					self?.events?.onReadCompleted(requestId: requestId, data: value, status: status)
				}
			))
		}
	}

	// MARK: - Conexão (na queue)

	private func createCentral() {
		guard bundle.object(forInfoDictionaryKey: "NSBluetoothAlwaysUsageDescription") != nil else {
			// Sem a chave o iOS encerra o app no primeiro uso do CoreBluetooth; aqui o Core fica sem Bluetooth e avisa.
			log(LogLevel.error, "init", "NSBluetoothAlwaysUsageDescription missing from Info.plist; Bluetooth disabled")
			handlePower(.off, description: "missing usage description")
			return
		}
		var options: [String: Any] = [CBCentralManagerOptionShowPowerAlertKey: showPowerAlert]
		let restoration = CentralTransport.declaresBackgroundCentral(bundle)
		if restoration {
			options[CBCentralManagerOptionRestoreIdentifierKey] = CentralTransport.restoreIdentifier
		}
		central = CBCentralManager(delegate: self, queue: queue, options: options)
		log(LogLevel.info, "init", "Central created (restoration=\(restoration), showPowerAlert=\(showPowerAlert))")
	}

	private func doConnect(address: String, autoReconnect: Bool) {
		cancelRearm()
		closeCurrent()
		guard let central, central.state == .poweredOn else {
			return rejectConnect(status: GattStatus.shared.NOT_CONNECTED, message: "Bluetooth is off")
		}
		guard let uuid = UUID(uuidString: address) else {
			return rejectConnect(status: GattStatus.shared.NOT_FOUND, message: "Invalid address \(address)")
		}
		guard let target = resolvePeripheral(uuid) else {
			return rejectConnect(status: GattStatus.shared.NOT_FOUND, message: "Unknown peripheral \(address) (scan first)")
		}
		claimRestored(uuid)
		lifecycle.connectAccepted(autoReconnect: autoReconnect)
		targetId = uuid
		backoff.reset()
		openConnection(target, autoReconnect: autoReconnect)
	}

	/// `connect()` recusado antes do central: exatamente um `onDisconnected` e o transporte parado.
	private func rejectConnect(status: Int32, message: String) {
		log(LogLevel.warn, "connect", "Rejected: \(message)")
		targetId = nil
		lifecycle.connectRejected(status: status, message: message)
	}

	private func openConnection(_ target: CBPeripheral, autoReconnect: Bool) {
		attemptGeneration = lifecycle.attemptStarting()
		attemptStartedAt = Date()
		peripheral = target
		target.delegate = self
		writeTypeWarnings.removeAll()
		setMtu(CentralTransport.defaultMtu)
		central?.connect(target, options: nil)
		log(LogLevel.info, "connect", "address=\(target.identifier.uuidString) autoReconnect=\(autoReconnect) state=\(target.state.rawValue) generation=\(attemptGeneration)")
	}

	private func doDisconnect() {
		// Um onDisconnected só se havia link aberto ou pendente (ADR 12); depois do Bluetooth desligado, nada (contrato B).
		cancelRearm()
		closeCurrent()
		targetId = nil
		let wasActive = lifecycle.disconnectRequested()
		log(LogLevel.info, "disconnect", "Requested by the session (active=\(wasActive))")
	}

	/// Falha as operações pendentes e cancela a conexão atual sem emitir nada; quem chama avisa o `lifecycle`.
	private func closeCurrent() {
		gattQueue.failAll(status: GattStatus.shared.NOT_CONNECTED)
		readTarget = nil
		guard let current = peripheral else { return }
		peripheral = nil
		if let central, central.state == .poweredOn, current.state == .connected || current.state == .connecting {
			central.cancelPeripheralConnection(current)
		}
	}

	private func resolvePeripheral(_ uuid: UUID) -> CBPeripheral? {
		if let cached = known[uuid] { return cached }
		guard let central else { return nil }
		if let retrieved = central.retrievePeripherals(withIdentifiers: [uuid]).first {
			known[uuid] = retrieved
			return retrieved
		}
		let services = Profiles.shared.all.flatMap { profile in profile.gattCandidates.map { CBUUID(string: $0.service) } }
		if let connected = central.retrieveConnectedPeripherals(withServices: services).first(where: { $0.identifier == uuid }) {
			known[uuid] = connected
			return connected
		}
		return nil
	}

	private func scheduleRearm(after delay: TimeInterval) {
		cancelRearm()
		guard let id = targetId else { return }
		let item = DispatchWorkItem { [weak self] in
			guard let self else { return }
			self.rearmItem = nil
			guard self.lifecycle.active, self.targetId == id, self.central?.state == .poweredOn, let target = self.resolvePeripheral(id) else { return }
			self.log(LogLevel.info, "rearm", "Re-arming pending connection to \(id.uuidString)")
			self.openConnection(target, autoReconnect: true)
		}
		rearmItem = item
		queue.asyncAfter(deadline: .now() + delay, execute: item)
	}

	private func cancelRearm() {
		rearmItem?.cancel()
		rearmItem = nil
	}

	// MARK: - Periféricos restaurados (na queue)

	/// (Re)inicia o prazo para a sessão reclamar os restaurados; vencido, cancela a conexão de quem ninguém reclamou.
	private func scheduleRestoredRelease() {
		restoredReleaseItem?.cancel()
		let item = DispatchWorkItem { [weak self] in self?.releaseRestored() }
		restoredReleaseItem = item
		queue.asyncAfter(deadline: .now() + CentralTransport.restoredClaimTimeout, execute: item)
	}

	private func claimRestored(_ id: UUID) {
		restored.claim(id)
		if restored.isEmpty { cancelRestoredRelease() }
	}

	private func cancelRestoredRelease() {
		restoredReleaseItem?.cancel()
		restoredReleaseItem = nil
	}

	private func releaseRestored() {
		restoredReleaseItem = nil
		let unclaimed = restored.releaseAll()
		guard let central, central.state == .poweredOn else { return }
		for id in unclaimed where peripheral?.identifier != id {
			guard let item = known[id], item.state == .connected || item.state == .connecting else { continue }
			log(LogLevel.info, "willRestoreState", "No connect for restored \(id.uuidString) within \(Int(CentralTransport.restoredClaimTimeout)) s; cancelling its connection")
			central.cancelPeripheralConnection(item)
		}
	}

	private func connectedPeripheral() -> CBPeripheral? {
		guard let current = peripheral, lifecycle.linkConnected else { return nil }
		return current
	}

	private func isCurrent(_ candidate: CBPeripheral) -> Bool {
		peripheral?.identifier == candidate.identifier
	}

	// MARK: - Bluetooth ligado/desligado (na queue)

	private func handlePower(_ power: BluetoothPower, description: String) {
		setPoweredOn(power == .on)
		switch self.power.update(power) {
		case .none:
			break
		case .turnedOff:
			delegate?.transportBluetoothWillTurnOff()
			stopForBluetoothOff()
			events?.onBluetoothStateChanged(enabled: false)
		case .turnedOn:
			log(LogLevel.info, "onBluetoothStateChanged", "enabled=true (\(description))")
			events?.onBluetoothStateChanged(enabled: true)
			delegate?.transportBluetoothDidTurnOn()
		case .initialOn:
			log(LogLevel.info, "onBluetoothStateChanged", "Bluetooth on at startup (\(description))")
			delegate?.transportBluetoothDidTurnOn()
		}
	}

	private func stopForBluetoothOff() {
		cancelRearm()
		cancelRestoredRelease()
		_ = restored.releaseAll()
		stopScanning()
		gattQueue.failAll(status: GattStatus.shared.NOT_CONNECTED)
		readTarget = nil
		// O CoreBluetooth derrubou as conexões e invalidou os periféricos; nenhum didDisconnectPeripheral vem por eles.
		peripheral = nil
		known.removeAll()
		let wasActive = lifecycle.bluetoothOff()
		log(LogLevel.info, "onBluetoothStateChanged", "enabled=false; transport stopped without onDisconnected (active=\(wasActive))")
	}

	// MARK: - Scan (na queue)

	private func doStartScan() {
		guard let central, central.state == .poweredOn else {
			delegate?.transportScanFailed(errorCode: -1, message: "Bluetooth LE scanner unavailable (Bluetooth off?)")
			return
		}
		if scanning { central.stopScan() }
		scanStopItem?.cancel()
		scanSeen.removeAll()
		scanLogged.removeAll()
		// Sem filtro de serviço: o fitGPS 0.2.1 não anuncia o NUS (DeviceRegistry, Repo 1); quem filtra é o nome. Com
		// duplicatas para não perder o nome que só chega no scan response; o evento sai uma vez por periférico.
		central.scanForPeripherals(withServices: nil, options: [CBCentralManagerScanOptionAllowDuplicatesKey: true])
		scanning = true
		let stop = DispatchWorkItem { [weak self] in self?.stopScanning() }
		scanStopItem = stop
		queue.asyncAfter(deadline: .now() + CentralTransport.scanDuration, execute: stop)
		log(LogLevel.info, "startScan", "Scanning for \(Int(CentralTransport.scanDuration * 1000)) ms")
	}

	private func stopScanning() {
		scanStopItem?.cancel()
		scanStopItem = nil
		guard scanning else { return }
		scanning = false
		if let central, central.state == .poweredOn { central.stopScan() }
		log(LogLevel.info, "stopScan", "Scan stopped, \(scanSeen.count) supported devices seen")
	}

	private func handleDiscovery(_ found: CBPeripheral, advertisementData: [String: Any], rssi: NSNumber) {
		guard scanning else { return }
		let id = found.identifier
		if scanSeen.contains(id) { return }
		let localName = advertisementData[CBAdvertisementDataLocalNameKey] as? String
		let services = (advertisementData[CBAdvertisementDataServiceUUIDsKey] as? [CBUUID] ?? []).map { CentralTransport.normalize($0) }
		var bleName = localName
		var profile = DeviceRegistry.shared.identify(bleName: localName, advertisedServices: services)
		if profile == nil, let cachedName = found.name {
			profile = DeviceRegistry.shared.identify(bleName: cachedName, advertisedServices: services)
			if profile != nil { bleName = cachedName }
		}
		let shownName = bleName ?? found.name ?? "nil"
		if scanLogged.insert("\(id.uuidString)|\(shownName)").inserted {
			log(LogLevel.debug, "onScanResult", "address=\(id.uuidString) name=\(shownName) rssi=\(rssi) advertisedServices=\(services) profile=\(profile?.id ?? "nil")")
		}
		guard let profile, let bleName else { return }
		scanSeen.insert(id)
		known[id] = found
		delegate?.transportDidDiscover(profile: profile, address: id.uuidString, rssi: rssi.int32Value, bleName: bleName)
	}

	// MARK: - Auxiliares

	private func findCharacteristic(service: String, characteristic: String) -> CBCharacteristic? {
		guard let current = peripheral else { return nil }
		for candidate in current.services ?? [] where CentralTransport.normalize(candidate.uuid) == service {
			for found in candidate.characteristics ?? [] where CentralTransport.normalize(found.uuid) == characteristic {
				return found
			}
		}
		return nil
	}

	/// O tipo de escrita para `found` (`effectiveWriteType`), com um WARN por characteristic e conexão quando não é o pedido.
	private func resolveWriteType(_ found: CBCharacteristic, characteristic: String, withResponse: Bool) -> CBCharacteristicWriteType? {
		let writeType = CentralTransport.effectiveWriteType(withResponse: withResponse, properties: found.properties)
		let usesRequested = writeType.map { ($0 == .withResponse) == withResponse } ?? false
		if !usesRequested, writeTypeWarnings.insert(characteristic).inserted {
			let outcome = writeType == nil ? "failing with status \(CentralTransport.writeNotPermittedStatus)" : "writing withResponse=\(!withResponse) instead"
			log(LogLevel.warn, "write", "characteristic=\(characteristic) requested withResponse=\(withResponse) but declares [\(CentralTransport.describe(found.properties))]; \(outcome)")
		}
		return writeType
	}

	/// Uma linha por serviço com as propriedades de cada characteristic: a primeira gravação do iPhone mostra o que o
	/// relógio declara (o Android não depende disso para escrever).
	private func logCharacteristics(of source: CBPeripheral) {
		for service in source.services ?? [] {
			let characteristics = (service.characteristics ?? []).map { "\(CentralTransport.normalize($0.uuid))[\(CentralTransport.describe($0.properties))]" }
			log(LogLevel.info, "discoverServices", "service=\(CentralTransport.normalize(service.uuid)) characteristics=\(characteristics)")
		}
	}

	private func mapServices(_ source: CBPeripheral) -> [DiscoveredService] {
		(source.services ?? []).map { service in
			DiscoveredService(
				uuid: CentralTransport.normalize(service.uuid),
				characteristics: (service.characteristics ?? []).map { characteristic in
					let properties = characteristic.properties
					return DiscoveredCharacteristic(
						uuid: CentralTransport.normalize(characteristic.uuid),
						canRead: properties.contains(.read),
						canWrite: properties.contains(.write),
						canWriteWithoutResponse: properties.contains(.writeWithoutResponse),
						canNotify: !properties.isDisjoint(with: [.notify, .indicate])
					)
				}
			)
		}
	}

	private func setPoweredOn(_ value: Bool) {
		stateLock.lock()
		poweredOnFlag = value
		stateLock.unlock()
	}

	private func setMtu(_ value: Int32) {
		stateLock.lock()
		mtuValue = value
		stateLock.unlock()
	}

	private func log(_ level: LogLevel, _ method: String, _ message: String) {
		logger.log(level: level, tag: "CentralTransport/\(method)", message: message)
	}

	/// UUID do CoreBluetooth na forma que a sessão compara (minúsculas, 128 bits).
	static func normalize(_ uuid: CBUUID) -> String {
		GattUuid.shared.normalize(uuid: uuid.uuidString)
	}

	/// O tipo que o CoreBluetooth vai mandar de fato: o pedido, se a characteristic o declara; senão o outro, se declarado;
	/// `nil` se nenhum. O CoreBluetooth descarta, só com um aviso no console, a escrita de um tipo não declarado.
	static func effectiveWriteType(withResponse: Bool, properties: CBCharacteristicProperties) -> CBCharacteristicWriteType? {
		let canWrite = properties.contains(.write)
		let canWriteWithoutResponse = properties.contains(.writeWithoutResponse)
		if withResponse {
			return canWrite ? .withResponse : (canWriteWithoutResponse ? .withoutResponse : nil)
		}
		return canWriteWithoutResponse ? .withoutResponse : (canWrite ? .withResponse : nil)
	}

	/// Propriedades de uma characteristic para o log (`read|write|writeWithoutResponse|notify|indicate`).
	static func describe(_ properties: CBCharacteristicProperties) -> String {
		let names: [(CBCharacteristicProperties, String)] = [
			(.read, "read"), (.write, "write"), (.writeWithoutResponse, "writeWithoutResponse"), (.notify, "notify"), (.indicate, "indicate"),
		]
		return names.filter { properties.contains($0.0) }.map(\.1).joined(separator: "|")
	}

	/// MTU ATT do link: o maior Write Command mais os 3 bytes do cabeçalho ATT.
	static func attMtu(of peripheral: CBPeripheral) -> Int32 {
		Int32(peripheral.maximumWriteValueLength(for: .withoutResponse)) + 3
	}

	/// Status para o `TransportEvents` de uma escrita ou leitura: `SUCCESS` sem erro; senão o código do `NSError`, ou
	/// `unknownErrorStatus` se for 0. Um `peerRemovedPairingInformation` aqui fica 14: a sessão só trata o vínculo apagado
	/// onde o contrato o põe (`linkStatus`).
	static func status(_ error: Error?) -> Int32 {
		guard let error else { return GattStatus.shared.SUCCESS }
		let code = (error as NSError).code
		return code == 0 ? unknownErrorStatus : Int32(truncatingIfNeeded: code)
	}

	/// Status de uma conexão que falhou ou caiu, da descoberta e do CCCD, os lugares onde a sessão trata o vínculo
	/// apagado (`GattStatus.PAIRING_REMOVED`, ADR 23 do Repo 1): o `CBError.peerRemovedPairingInformation` (o iPhone
	/// guarda um vínculo que o relógio apagou) vira `PAIRING_REMOVED`; o resto, como `status`. O domínio é conferido
	/// porque o 14 do `CBATTErrorDomain` é outro erro (`unlikelyError`).
	static func linkStatus(_ error: Error?) -> Int32 {
		let removed = CBError.Code.peerRemovedPairingInformation.rawValue
		if let nsError = error as NSError?, nsError.domain == CBErrorDomain, nsError.code == removed {
			return GattStatus.shared.PAIRING_REMOVED
		}
		return status(error)
	}

	/// O que o usuário tem de fazer quando o status é `PAIRING_REMOVED`, para o WARN do log (o app não remove vínculos).
	static let pairingRemovedHint = "iOS keeps a Bluetooth pairing the watch erased; the user must forget the watch in Settings > Bluetooth (apps cannot remove it), so the connection is not re-armed"

	/// A restauração só vale com o modo `bluetooth-central` declarado; sem ele, o CoreBluetooth recusa o identificador.
	static func declaresBackgroundCentral(_ bundle: Bundle) -> Bool {
		(bundle.object(forInfoDictionaryKey: "UIBackgroundModes") as? [String])?.contains("bluetooth-central") ?? false
	}
}

// MARK: - CBCentralManagerDelegate

extension CentralTransport: CBCentralManagerDelegate {
	func centralManagerDidUpdateState(_ central: CBCentralManager) {
		let description = BluetoothPower.describe(central.state)
		log(LogLevel.info, "centralManagerDidUpdateState", "state=\(description) authorization=\(CBManager.authorization.rawValue)")
		handlePower(BluetoothPower(central.state), description: description)
	}

	func centralManager(_ central: CBCentralManager, willRestoreState dict: [String: Any]) {
		let peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey] as? [CBPeripheral] ?? []
		for item in peripherals {
			known[item.identifier] = item
			item.delegate = self
		}
		restored.restore(peripherals.map(\.identifier))
		if !restored.isEmpty { scheduleRestoredRelease() }
		log(LogLevel.info, "willRestoreState", "Restored \(peripherals.count) peripherals: \(peripherals.map { "\($0.identifier.uuidString) state=\($0.state.rawValue)" })")
	}

	func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String: Any], rssi RSSI: NSNumber) {
		handleDiscovery(peripheral, advertisementData: advertisementData, rssi: RSSI)
	}

	func centralManager(_ central: CBCentralManager, didConnect connected: CBPeripheral) {
		guard isCurrent(connected) else {
			if restored.keepsUnrequestedConnection(connected.identifier, transportBusy: peripheral != nil || lifecycle.active) {
				// Relançado em segundo plano: a conexão que acordou o app chegou antes do connect() da sessão, que vem do
				// primeiro .poweredOn pela fila dela (RestoredPeripherals). Fica aberta para esse connect reclamar.
				log(LogLevel.info, "didConnect", "Keeping restored connection to \(connected.identifier.uuidString) for the session's connect (\(Int(CentralTransport.restoredClaimTimeout)) s)")
				scheduleRestoredRelease()
				return
			}
			// Conexão que ninguém pediu mais (disconnect ou connect para outro relógio no meio): não fica aberta.
			log(LogLevel.debug, "didConnect", "Cancelling stale connection to \(connected.identifier.uuidString)")
			central.cancelPeripheralConnection(connected)
			return
		}
		backoff.reset()
		setMtu(CentralTransport.attMtu(of: connected))
		log(LogLevel.info, "didConnect", "address=\(connected.identifier.uuidString) generation=\(attemptGeneration) mtu=\(currentMtu)")
		lifecycle.linkUp(attemptGeneration)
		if !lifecycle.linkConnected {
			// Conectou depois de um disconnect() que o cancelamento não alcançou: o link não é de ninguém.
			central.cancelPeripheralConnection(connected)
		}
	}

	func centralManager(_ central: CBCentralManager, didFailToConnect failed: CBPeripheral, error: Error?) {
		guard isCurrent(failed) else { return }
		let status = CentralTransport.linkStatus(error)
		log(LogLevel.warn, "didFailToConnect", "address=\(failed.identifier.uuidString) status=\(status) error=\(error?.localizedDescription ?? "nil")")
		if status == GattStatus.shared.PAIRING_REMOVED {
			log(LogLevel.warn, "didFailToConnect", CentralTransport.pairingRemovedHint)
		}
		gattQueue.failAll(status: GattStatus.shared.NOT_CONNECTED)
		// PAIRING_REMOVED numa conexão pendente sai como connectFailed (com evento), não pendingFailed: re-armar não passaria.
		switch lifecycle.linkDown(attemptGeneration, status: status) {
		case .pendingFailed:
			let waited = Date().timeIntervalSince(attemptStartedAt)
			let delay = backoff.failed(after: waited)
			log(LogLevel.warn, "didFailToConnect", "Pending connection failed after \(String(format: "%.1f", waited)) s (fast failures=\(backoff.fastFailures)), re-arming in \(Int(delay)) s")
			scheduleRearm(after: delay)
		case .connectFailed, .lost:
			peripheral = nil
			targetId = nil
		case .stale:
			break
		}
	}

	func centralManager(_ central: CBCentralManager, didDisconnectPeripheral disconnected: CBPeripheral, error: Error?) {
		guard isCurrent(disconnected), lifecycle.linkConnected else {
			// Eco de um cancelPeripheralConnection (disconnect, connect novo) ou de uma tentativa antiga.
			log(LogLevel.debug, "didDisconnectPeripheral", "Ignoring stale disconnect of \(disconnected.identifier.uuidString)")
			return
		}
		let status = CentralTransport.linkStatus(error)
		log(LogLevel.info, "didDisconnectPeripheral", "address=\(disconnected.identifier.uuidString) status=\(status) error=\(error?.localizedDescription ?? "nil")")
		if status == GattStatus.shared.PAIRING_REMOVED {
			log(LogLevel.warn, "didDisconnectPeripheral", CentralTransport.pairingRemovedHint)
		}
		gattQueue.failAll(status: GattStatus.shared.NOT_CONNECTED)
		readTarget = nil
		// Não re-arma: a sessão decide se e quando reconectar (ADRs 11 e 12 do Repo 1).
		_ = lifecycle.linkDown(attemptGeneration, status: status)
		peripheral = nil
	}
}

// MARK: - CBPeripheralDelegate

extension CentralTransport: CBPeripheralDelegate {
	func peripheral(_ source: CBPeripheral, didDiscoverServices error: Error?) {
		guard isCurrent(source), gattQueue.active?.kind == .discover else { return }
		if let error {
			gattQueue.complete(.discover, status: CentralTransport.linkStatus(error))
			return
		}
		let services = source.services ?? []
		if services.isEmpty {
			gattQueue.complete(.discover, status: GattStatus.shared.SUCCESS, payload: [DiscoveredService]())
			return
		}
		servicesAwaitingCharacteristics = services.count
		for service in services { source.discoverCharacteristics(nil, for: service) }
	}

	func peripheral(_ source: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
		guard isCurrent(source), gattQueue.active?.kind == .discover, servicesAwaitingCharacteristics > 0 else { return }
		if let error {
			log(LogLevel.warn, "didDiscoverCharacteristics", "service=\(CentralTransport.normalize(service.uuid)) error=\(error.localizedDescription)")
		}
		servicesAwaitingCharacteristics -= 1
		if servicesAwaitingCharacteristics == 0 {
			gattQueue.complete(.discover, status: GattStatus.shared.SUCCESS, payload: mapServices(source))
		}
	}

	func peripheral(_ source: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?) {
		guard isCurrent(source) else { return }
		gattQueue.complete(.notify, status: CentralTransport.linkStatus(error))
	}

	func peripheral(_ source: CBPeripheral, didWriteValueFor characteristic: CBCharacteristic, error: Error?) {
		guard isCurrent(source) else { return }
		gattQueue.complete(.write, status: CentralTransport.status(error))
	}

	func peripheralIsReady(toSendWriteWithoutResponse source: CBPeripheral) {
		guard isCurrent(source) else { return }
		gattQueue.retryStart()
	}

	func peripheral(_ source: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
		guard isCurrent(source) else { return }
		if let pending = readTarget, pending === characteristic, gattQueue.active?.kind == .read {
			gattQueue.complete(.read, status: CentralTransport.status(error), payload: characteristic.value)
			return
		}
		if let error {
			log(LogLevel.warn, "didUpdateValueFor", "characteristic=\(CentralTransport.normalize(characteristic.uuid)) error=\(error.localizedDescription)")
			return
		}
		guard lifecycle.linkConnected, let value = characteristic.value, !value.isEmpty else { return }
		// Uma chamada por notificação, na ordem, direto da fila do delegate; a sobrecarga com Data copia os bytes.
		events?.onNotification(characteristic: CentralTransport.normalize(characteristic.uuid), data: value)
	}
}

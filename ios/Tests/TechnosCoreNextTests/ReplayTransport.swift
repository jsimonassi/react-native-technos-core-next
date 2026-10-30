import Foundation
@testable import TechnosCoreNext
import TechnosWatchProtocol

/// `HostTransport` de teste que se comporta como o relógio de uma gravação real, para rodar o host iOS inteiro
/// (`CoreGraph`, `IosCoreHost`, stores, logger, `CoreBridge` e a sessão Kotlin) no simulador, que não tem Bluetooth.
///
/// Como o `ReplayDriver` do Repo 1: a cada TX da sessão, compara com o próximo TX da gravação (bytes iguais depois da
/// máscara da família: `SmaTxMasker` ou `IdoTxMasker`) e emite, na ordem, todos os RX gravados até o TX seguinte; os RX
/// antes do primeiro TX saem quando as notificações são ligadas. Divergências não lançam: vão para `mismatches`. Um TX
/// depois do fim da gravação vai para `extraTx` (o UNBIND de um forget que a gravação não tem).
///
/// Como o `CentralTransport`: tudo roda numa fila serial própria; cada método só despacha para ela, e os eventos saem
/// de lá, de forma assíncrona (a escrita termina com `onWriteCompleted` antes dos RX, nos dois tipos de escrita); as
/// notificações vão pela sobrecarga com `Data` e com o UUID passado pelo `GattUuid.normalize` a partir da forma em
/// maiúsculas que o CoreBluetooth daria. O Bluetooth desligado segue o contrato B (`setBluetooth(enabled:)` usa o mesmo
/// `BluetoothPowerTracker` e a mesma ordem de ganchos do `CentralTransport`).
final class ReplayTransport: NSObject, HostTransport {
	/// UUID inventado do periférico (no iOS o endereço é o UUID do `CBPeripheral`).
	static let peripheralAddress = "6F1C2B8E-3D4A-4C5B-9E7F-0A1B2C3D4E5F"

	let recording: Recording
	let profile: DeviceProfile
	let queue = DispatchQueue(label: "br.com.grupotechnos.corenext.replay")

	private let powerLock = NSLock()
	private var poweredOnFlag = true

	// Estado abaixo: só na `queue` (o teste lê com `snapshot()`).
	private var events: TransportEvents?
	private weak var delegate: HostTransportDelegate?
	private var tracker = BluetoothPowerTracker()
	private var index = 0
	private var linkOpen = false
	private let expectedMasker: PacketMasker
	private let actualMasker: PacketMasker
	private var matchedTx = 0
	private var mismatches: [String] = []
	private var extraTx: [String] = []
	private var frameKeys: [String] = []
	private var writeTypes: [String: Int] = [:]
	private var connects: [String] = []
	private var disconnects = 0
	private var notifications = 0
	private var holdConnect = false
	private var heldConnect = false

	/// - Parameter bluetoothOnAtStart: `false` começa como um central recém-criado, sem estado ainda (o primeiro
	///   `setBluetooth(enabled: true)` vira o `.initialOn` do `CentralTransport`, como num processo relançado).
	init(recording: Recording, bluetoothOnAtStart: Bool = true) throws {
		guard let profile = DeviceRegistry.shared.identify(bleName: recording.device, advertisedServices: []) else {
			throw Recording.LoadError.badHeader("no profile for device \(recording.device)")
		}
		self.recording = recording
		self.profile = profile
		if profile.family == Family.sma {
			expectedMasker = SmaTxMasker()
			actualMasker = SmaTxMasker()
		} else {
			expectedMasker = IdoTxMasker()
			actualMasker = IdoTxMasker()
		}
		super.init()
		poweredOnFlag = bluetoothOnAtStart
		if bluetoothOnAtStart { _ = tracker.update(.on) }
	}

	/// O que o teste confere.
	struct Snapshot {
		let consumed: Int
		let total: Int
		let matchedTx: Int
		let recordedTx: Int
		let mismatches: [String]
		let extraTx: [String]
		let frameKeys: [String]
		let writeTypes: [String: Int]
		let connects: [String]
		let disconnects: Int
		let notifications: Int
		/// O próximo pacote da gravação é um TX ainda não escrito (ou a gravação acabou): nada pendente do lado do relógio.
		let waitingForTx: Bool
	}

	func snapshot() -> Snapshot {
		queue.sync {
			Snapshot(
				consumed: index,
				total: recording.packets.count,
				matchedTx: matchedTx,
				recordedTx: recording.txCount,
				mismatches: mismatches,
				extraTx: extraTx,
				frameKeys: frameKeys,
				writeTypes: writeTypes,
				connects: connects,
				disconnects: disconnects,
				notifications: notifications,
				waitingForTx: index >= recording.packets.count || recording.packets[index].tx
			)
		}
	}

	/// Os próximos `connect` ficam pendentes (como um relógio fora de alcance) até `releaseHeldConnect()`.
	func holdConnects() {
		queue.sync { holdConnect = true }
	}

	/// Abre a conexão pendente, se houver, e volta a conectar na hora.
	func releaseHeldConnect() {
		queue.async {
			self.holdConnect = false
			guard self.heldConnect else { return }
			self.heldConnect = false
			self.linkOpen = true
			self.events?.onConnected()
		}
	}

	/// O Bluetooth do telefone ligou ou desligou, com a mesma decisão e a mesma ordem do `CentralTransport.handlePower`.
	func setBluetooth(enabled: Bool) {
		queue.async {
			self.powerLock.lock()
			self.poweredOnFlag = enabled
			self.powerLock.unlock()
			switch self.tracker.update(enabled ? .on : .off) {
			case .none:
				break
			case .turnedOff:
				self.delegate?.transportBluetoothWillTurnOff()
				self.linkOpen = false
				self.heldConnect = false
				self.events?.onBluetoothStateChanged(enabled: false)
			case .turnedOn:
				self.events?.onBluetoothStateChanged(enabled: true)
				self.delegate?.transportBluetoothDidTurnOn()
			case .initialOn:
				self.delegate?.transportBluetoothDidTurnOn()
			}
		}
	}

	// MARK: - HostTransport

	func attach(events: TransportEvents, delegate: HostTransportDelegate) {
		queue.sync {
			self.events = events
			self.delegate = delegate
		}
	}

	var isPoweredOn: Bool {
		powerLock.lock()
		defer { powerLock.unlock() }
		return poweredOnFlag
	}

	var isAuthorizationDenied: Bool { false }

	var currentMtu: Int32 { recording.mtu }

	func startScan() {
		queue.async {
			self.delegate?.transportDidDiscover(profile: self.profile, address: ReplayTransport.peripheralAddress, rssi: -60, bleName: self.recording.device)
		}
	}

	func stopScan() {}

	// MARK: - Transport

	func connect(address: String, autoReconnect: Bool) {
		queue.async {
			self.connects.append("\(address) auto=\(autoReconnect)")
			guard self.isPoweredOn else {
				self.events?.onDisconnected(status: GattStatus.shared.NOT_CONNECTED, message: "Bluetooth is off")
				return
			}
			guard address.caseInsensitiveCompare(ReplayTransport.peripheralAddress) == .orderedSame else {
				self.events?.onDisconnected(status: GattStatus.shared.NOT_FOUND, message: "Unknown peripheral \(address)")
				return
			}
			if self.holdConnect {
				self.heldConnect = true
				return
			}
			self.linkOpen = true
			self.events?.onConnected()
		}
	}

	func disconnect() {
		queue.async {
			self.disconnects += 1
			guard self.linkOpen || self.heldConnect else { return }
			self.linkOpen = false
			self.heldConnect = false
			self.events?.onDisconnected(status: GattStatus.shared.SUCCESS, message: "Disconnected on request")
		}
	}

	func discoverServices() {
		queue.async {
			guard self.linkOpen else {
				self.events?.onServicesDiscovered(services: [], status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			// O fitGPS 0.2.1 expõe só o NUS (sem FF60); o Life Ultra GPS, o 0AF0 com as duas notificações.
			let candidates = self.profile.family == Family.sma ? [Profiles.shared.SMA_NUS] : self.profile.gattCandidates
			self.events?.onServicesDiscovered(services: candidates.map(ReplayTransport.service), status: GattStatus.shared.SUCCESS)
		}
	}

	func enableNotifications(service: String, characteristic: String, requestId: Int32) {
		queue.async {
			guard self.linkOpen else {
				self.events?.onNotificationsEnabled(requestId: requestId, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			self.events?.onNotificationsEnabled(requestId: requestId, status: GattStatus.shared.SUCCESS)
			self.emitRxUntilNextTx()
		}
	}

	func requestMtu(mtu: Int32, requestId: Int32) {
		queue.async {
			// O MTU do cabeçalho, como o FakeTransport do Repo 1: só assim os fragmentos batem com a gravação.
			self.events?.onMtuChanged(requestId: requestId, mtu: self.recording.mtu, status: self.linkOpen ? GattStatus.shared.SUCCESS : GattStatus.shared.NOT_CONNECTED)
		}
	}

	func write(service: String, characteristic: String, value: KotlinByteArray, type: WriteType, requestId: Int32) {
		let data = [UInt8](value.toData())
		let typeName = type.name
		queue.async {
			self.writeTypes[typeName, default: 0] += 1
			guard self.linkOpen else {
				self.events?.onWriteCompleted(requestId: requestId, status: GattStatus.shared.NOT_CONNECTED)
				return
			}
			self.events?.onWriteCompleted(requestId: requestId, status: GattStatus.shared.SUCCESS)
			self.handleTx(data)
		}
	}

	func read(service: String, characteristic: String, requestId: Int32) {
		queue.async {
			self.events?.onReadCompleted(requestId: requestId, data: nil, status: GattStatus.shared.NOT_FOUND)
		}
	}

	// MARK: - Replay (na queue)

	private func handleTx(_ sent: [UInt8]) {
		guard index < recording.packets.count, recording.packets[index].tx else {
			extraTx.append(Recording.hex(sent))
			return
		}
		let expected = recording.packets[index]
		index += 1
		let txNumber = recording.packets[..<index].filter(\.tx).count
		if expectedMasker.mask(expected.value) == actualMasker.mask(sent) {
			matchedTx += 1
		} else {
			mismatches.append("TX #\(txNumber) differs in \(recording.source)\n  recorded \(Recording.hex(expected.value))\n  sent     \(Recording.hex(sent))")
		}
		if let key = actualMasker.frameKey(sent) { frameKeys.append(key) }
		emitRxUntilNextTx()
	}

	private func emitRxUntilNextTx() {
		while index < recording.packets.count, !recording.packets[index].tx {
			let packet = recording.packets[index]
			index += 1
			notifications += 1
			// O CoreBluetooth dá o UUID em maiúsculas; o CentralTransport normaliza antes de entregar.
			events?.onNotification(characteristic: GattUuid.shared.normalize(uuid: packet.characteristic.uppercased()), data: Data(packet.value))
		}
	}

	private static func service(_ candidate: GattCandidate) -> DiscoveredService {
		var characteristics = [
			DiscoveredCharacteristic(uuid: candidate.write, canRead: false, canWrite: true, canWriteWithoutResponse: true, canNotify: false),
			DiscoveredCharacteristic(uuid: candidate.notify, canRead: false, canWrite: false, canWriteWithoutResponse: false, canNotify: true),
		]
		for extra in candidate.extraNotify {
			characteristics.append(DiscoveredCharacteristic(uuid: extra, canRead: false, canWrite: false, canWriteWithoutResponse: false, canNotify: true))
		}
		return DiscoveredService(uuid: candidate.service, characteristics: characteristics)
	}
}

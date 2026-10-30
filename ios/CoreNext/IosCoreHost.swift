import Foundation
import TechnosWatchProtocol

/// O `CoreHost` do iOS: o que o `CoreBridge` (Repo 1, `:bridge`) pede à plataforma, sobre as peças de `ble/`, `store/`
/// e `log/`. Par do `AndroidCoreHost`.
///
/// Só delega. O que cada método JS faz, a ordem evento/`resolve`, quando gravar ou apagar o pareamento, quando ligar o
/// trabalho em segundo plano e quando reconectar estão no `CoreBridge` (inventário na seção 13 do
/// `docs/arquitetura.md` do Repo 1).
///
/// Threads: o `CoreBridge` chama de qualquer thread (a do TurboModule, a da sessão, a fila do Bluetooth). As peças são
/// thread-safe (o transporte despacha para a fila dele e protege o estado lido daqui, o `PairingStore` fica sobre o
/// `UserDefaults`, o `RingLogger`, o `FrameRecorder` e o `BackgroundWork` têm trava). Nenhum método lança, salvo o
/// `exportLogs`.
final class IosCoreHost: NSObject, CoreHost {
	/// Nome da autorização na mensagem `"Missing <nome>"` do `onError` (`docs/arquitetura.md` do Repo 1, seção 13).
	static let bluetoothPermissionName = "Bluetooth"

	private let logger: RingLogger
	private let recorder: FrameRecorder
	private let pairing: PairingStore
	private let transport: HostTransport
	private let backgroundWork: BackgroundWork
	private let exportDirectory: URL
	private let now: () -> Date

	init(
		logger: RingLogger,
		recorder: FrameRecorder,
		pairing: PairingStore,
		transport: HostTransport,
		backgroundWork: BackgroundWork,
		exportDirectory: URL,
		now: @escaping () -> Date = Date.init
	) {
		self.logger = logger
		self.recorder = recorder
		self.pairing = pairing
		self.transport = transport
		self.backgroundWork = backgroundWork
		self.exportDirectory = exportDirectory
		self.now = now
		super.init()
	}

	/// O iOS tem uma autorização só para scan e conexão. `.notDetermined` não conta como falta: o sistema mostra o
	/// pedido no primeiro uso do central, e até a resposta o central não está `.poweredOn` (o `CoreBridge` responde
	/// `BLUETOOTH_OFF`).
	func missingScanPermission() -> String? {
		transport.isAuthorizationDenied ? IosCoreHost.bluetoothPermissionName : nil
	}

	func missingConnectPermission() -> String? {
		transport.isAuthorizationDenied ? IosCoreHost.bluetoothPermissionName : nil
	}

	func isBluetoothEnabled() -> Bool { transport.isPoweredOn }

	/// No iOS o endereço é o UUID do `CBPeripheral` (maiúsculas ou minúsculas), não um MAC.
	func isValidAddress(address: String) -> Bool { UUID(uuidString: address) != nil }

	func startScan() { transport.startScan() }

	func stopScan() { transport.stopScan() }

	func startSyncWork() { backgroundWork.begin() }

	func stopSyncWork() { backgroundWork.end() }

	func loadPairing() -> CorePairing? { pairing.load() }

	func savePairing(pairing: CorePairing) { self.pairing.save(pairing) }

	func clearPairing() { pairing.clear() }

	func setRecordingDeviceName(name: String) { recorder.deviceName = name }

	/// `nil` quando o `CoreBridge` trocou o relógio do cabeçalho e o firmware do novo ainda não foi lido.
	func setRecordingFirmware(firmware: String?) { recorder.firmware = firmware }

	func logEntries(limit: Int32) -> [CoreLogEntry] { logger.entries(limit: Int(limit)).map { $0.coreLogEntry } }

	/// Grava `frames-<carimbo>.jsonl` (formato de fixture do Repo 1) e `logs-<carimbo>.jsonl` (o anel) em
	/// `exportDirectory` (no app, `Documents/corenext/`, visível no app Arquivos com `UIFileSharingEnabled`) e devolve o
	/// caminho absoluto do de frames. Uma falha lança e vira `IO_ERROR` no JS.
	func exportLogs() throws -> String {
		let stamp = IosCoreHost.stamp(now())
		let frames = exportDirectory.appendingPathComponent("frames-\(stamp).jsonl")
		let logs = exportDirectory.appendingPathComponent("logs-\(stamp).jsonl")
		recorder.mtu = transport.currentMtu
		try recorder.write(to: frames)
		try logger.write(to: logs)
		logger.log(level: LogLevel.info, tag: "IosCoreHost/exportLogs", message: "Exported \(recorder.packetCount) packets to \(frames.path), logs to \(logs.path)")
		return frames.path
	}

	func clearLogs() { logger.clear() }

	func setLogLevel(level: LogLevel) { logger.minLevel = level }

	/// `yyyyMMdd-HHmmss` no fuso do telefone, como o carimbo do Android.
	static func stamp(_ date: Date) -> String {
		let formatter = DateFormatter()
		formatter.locale = Locale(identifier: "en_US_POSIX")
		formatter.calendar = Calendar(identifier: .gregorian)
		formatter.timeZone = TimeZone.current
		formatter.dateFormat = "yyyyMMdd-HHmmss"
		return formatter.string(from: date)
	}
}

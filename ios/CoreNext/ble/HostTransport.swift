import Foundation
import TechnosWatchProtocol

/// O que o `CoreGraph` precisa de um transporte além do `Transport` do Repo 1: o estado do Bluetooth e da autorização
/// (para o `IosCoreHost` responder ao `CoreBridge`), o scan e o MTU para o cabeçalho da gravação.
///
/// Implementado pelo `CentralTransport` (CoreBluetooth) e, nos testes do simulador, pelo `ReplayTransport`, que responde
/// com uma gravação real (`ios/Tests/`). Pode ser chamado de qualquer thread; a implementação despacha para a fila dela.
protocol HostTransport: Transport {
	/// Liga a sessão e o grafo. Chamado uma vez pelo `CoreGraph`, depois de criar a sessão e o `CoreBridge`.
	func attach(events: TransportEvents, delegate: HostTransportDelegate)

	/// `true` com o central em `.poweredOn` (o `CoreHost.isBluetoothEnabled`).
	var isPoweredOn: Bool { get }

	/// `true` se o usuário negou (ou o sistema restringiu) o Bluetooth para o app.
	var isAuthorizationDenied: Bool { get }

	/// MTU ATT efetivo do link atual (23 sem link), para o cabeçalho da gravação.
	var currentMtu: Int32 { get }

	/// Começa (ou recomeça) um scan dos relógios suportados; cada um volta pelo delegate.
	func startScan()

	/// Para o scan, se houver.
	func stopScan()
}

/// Ganchos que o transporte chama no grafo (que os repassa ao `CoreBridge`). Chamados da fila do transporte.
protocol HostTransportDelegate: AnyObject {
	/// O Bluetooth desligou: chamado **antes** de entregar `onBluetoothStateChanged(false)` à sessão.
	func transportBluetoothWillTurnOff()

	/// O Bluetooth ligou: chamado **depois** de entregar `onBluetoothStateChanged(true)` à sessão (ou no primeiro estado
	/// ligado, sem entrega).
	func transportBluetoothDidTurnOn()

	/// Um relógio suportado no scan, uma vez por periférico por scan.
	func transportDidDiscover(profile: DeviceProfile, address: String, rssi: Int32, bleName: String)

	/// O scan não começou ou falhou.
	func transportScanFailed(errorCode: Int32, message: String)
}

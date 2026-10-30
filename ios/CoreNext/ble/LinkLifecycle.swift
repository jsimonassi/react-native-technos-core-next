import Foundation
import TechnosWatchProtocol

/// Estado do link do `CentralTransport` e a regra de quando sai `onConnected`/`onDisconnected`, sem CoreBluetooth,
/// para ser testada no simulador (`LinkLifecycleTests`). Mesmas regras do `LinkLifecycle` do Android (contrato do
/// `Transport` do Repo 1, ADRs 12 e 18):
///
/// - Cada `onConnected` tem depois exatamente um `onDisconnected`, exceto quando o Bluetooth desliga.
/// - `disconnectRequested` emite um `onDisconnected` só se havia link aberto ou conexão pendente (`active`).
/// - **Bluetooth desligado** (`bluetoothOff`, "contrato B"): nenhum `onDisconnected` para o link aberto nem para a
///   conexão pendente; o transporte fica parado e um `disconnect()` seguinte não emite nada até um `connect()` novo. É o
///   comportamento natural do CoreBluetooth (`.poweredOff` sem `didDisconnectPeripheral`); se ele vier mesmo assim, chega
///   com o link já parado e é ignorado.
/// - `connect()` recusado na hora (`connectRejected`) emite exatamente um `onDisconnected`.
/// - Conexão pendente que falha sem conectar: nenhum evento (o transporte re-arma), salvo com
///   `GattStatus.PAIRING_REMOVED`, que termina com um `onDisconnected`, como a conexão direta.
/// - Callback de uma tentativa antiga (`generation` diferente) não emite nada.
///
/// Diferença do Android: no iOS não há um objeto por tentativa (o `BluetoothGatt`); a geração muda a cada
/// `central.connect`, e o `CentralTransport` só repassa `didConnect`/`didFailToConnect`/`didDisconnectPeripheral` do
/// periférico atual. Um `didDisconnectPeripheral` sem link aberto é o eco de um `cancelPeripheralConnection` anterior e
/// é descartado lá.
///
/// Não é thread-safe de propósito: só a fila do Bluetooth usa.
final class LinkLifecycle {
	/// Destino dos eventos; no transporte, o `TransportEvents` da sessão.
	struct Output {
		let onConnected: () -> Void
		let onDisconnected: (_ status: Int32, _ message: String) -> Void
	}

	/// O que fazer com uma queda do link (o evento, quando há, já saiu pelo `Output`).
	enum LinkDown: Equatable {
		/// Callback de uma tentativa antiga, ou com o transporte parado: nada a fazer.
		case stale
		/// Link que chegou a conectar caiu sem pedido: saiu `onDisconnected` e o transporte parou.
		case lost
		/// Conexão que nunca conectou e não se re-arma (a direta, ou a pendente com `GattStatus.PAIRING_REMOVED`): saiu
		/// `onDisconnected` e o transporte parou.
		case connectFailed
		/// Conexão pendente que nunca conectou: nenhum evento; o transporte re-arma.
		case pendingFailed
	}

	private let output: Output

	/// Geração da tentativa atual; muda a cada tentativa aberta ou encerrada.
	private(set) var generation = 0
	/// A tentativa atual recebeu `didConnect` e ainda não caiu nem foi encerrada.
	private(set) var linkConnected = false
	/// Há link aberto ou conexão pendente (inclusive re-arme agendado) que um `disconnect()` encerra com evento.
	private(set) var active = false
	/// A conexão atual é pendente (`autoReconnect = true`), a única que se re-arma.
	private(set) var autoReconnect = false

	init(output: Output) {
		self.output = output
	}

	func isCurrent(_ attemptGeneration: Int) -> Bool { attemptGeneration == generation }

	/// `connect()` aceito. Um link que estava aberto sai como `onDisconnected(0)`; uma conexão pendente substituída não
	/// gera evento (nunca houve `onConnected`).
	func connectAccepted(autoReconnect: Bool) {
		let replaced = linkConnected
		invalidate()
		active = true
		self.autoReconnect = autoReconnect
		if replaced { output.onDisconnected(GattStatus.shared.SUCCESS, "Link replaced by a new connect") }
	}

	/// `connect()` recusado antes de chamar o central. Emite exatamente um `onDisconnected` e para.
	func connectRejected(status: Int32, message: String) {
		stop()
		output.onDisconnected(status, message)
	}

	/// Uma tentativa nova vai ser aberta (`central.connect`): devolve a geração dela.
	func attemptStarting() -> Int {
		invalidate()
		return generation
	}

	/// `didConnect` da tentativa `attemptGeneration`.
	func linkUp(_ attemptGeneration: Int) {
		guard isCurrent(attemptGeneration), active else { return }
		linkConnected = true
		output.onConnected()
	}

	/// `didFailToConnect` ou `didDisconnectPeripheral` da tentativa `attemptGeneration`. Uma conexão pendente que falha
	/// com `GattStatus.PAIRING_REMOVED` termina como a direta: o iOS recusa toda tentativa até o usuário esquecer o
	/// relógio nos Ajustes, e sem o evento a sessão ficaria em `RECONNECTING` com o re-arme falhando para sempre (o
	/// contrato do `Transport.connect` do Repo 1 prevê essa exceção, ADR 23).
	func linkDown(_ attemptGeneration: Int, status: Int32) -> LinkDown {
		guard isCurrent(attemptGeneration), active else { return .stale }
		let wasConnected = linkConnected
		invalidate()
		if wasConnected {
			stop()
			output.onDisconnected(status, "Link lost (status=\(status))")
			return .lost
		}
		if !autoReconnect || status == GattStatus.shared.PAIRING_REMOVED {
			stop()
			output.onDisconnected(status, "Connect failed (status=\(status))")
			return .connectFailed
		}
		return .pendingFailed
	}

	/// `disconnect()`. Devolve se havia link aberto ou conexão pendente (e por isso saiu `onDisconnected(0)`).
	@discardableResult
	func disconnectRequested() -> Bool {
		let wasActive = active
		stop()
		if wasActive { output.onDisconnected(GattStatus.shared.SUCCESS, "Disconnected on request") }
		return wasActive
	}

	/// Bluetooth desligado (contrato B): não emite nada. Devolve se havia algo aberto, só para o log.
	@discardableResult
	func bluetoothOff() -> Bool {
		let wasActive = active
		stop()
		return wasActive
	}

	private func stop() {
		invalidate()
		active = false
	}

	private func invalidate() {
		generation += 1
		linkConnected = false
	}
}

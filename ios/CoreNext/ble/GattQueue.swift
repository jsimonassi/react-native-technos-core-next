import Foundation
import TechnosWatchProtocol

/// Fila de operações GATT do `CentralTransport`: uma por vez, cada uma liberada pelo callback correspondente do
/// `CBPeripheral`, pela própria partida (escrita sem resposta, MTU) ou pelo timeout. Par da `GattQueue` do Android.
///
/// Por que existe no iOS, onde o CoreBluetooth enfileira sozinho: o contrato do `Transport` pede exatamente um evento
/// por `requestId`, e o CoreBluetooth não dá callback para escrita sem resposta nem tem timeout. A fila garante os dois.
///
/// Regras:
/// - `Operation.start` roda quando a operação chega na frente e devolve `.pending` (espera o callback), `.done(status,
///   payload)` (terminou na partida) ou `.waitingForCredit` (escrita sem resposta com o buffer cheio: espera
///   `peripheralIsReady(toSendWriteWithoutResponse:)`, e aí `retryStart` roda a partida de novo).
/// - `complete(kind:)` só termina a operação atual se o tipo bater (callback de outro tipo é ignorado).
/// - Timeout termina com `GattStatus.TIMEOUT`; `failAll` termina a atual e as pendentes, cada uma uma vez só.
///
/// Não é thread-safe de propósito: tudo roda na fila do Bluetooth.
final class GattQueue {
	/// Agendador do timeout (a fila GCD do transporte; nos testes, um relógio manual).
	protocol Scheduler {
		func schedule(after seconds: TimeInterval, _ action: @escaping () -> Void) -> AnyObject
		func cancel(_ token: AnyObject)
	}

	/// Tipo da operação, casado com o callback do `CBPeripheralDelegate`.
	enum Kind: Equatable {
		case discover, notify, mtu, write, read
	}

	enum Start {
		case pending
		case done(status: Int32, payload: Any?)
		case waitingForCredit
	}

	/// Uma operação. `finish` é chamado exatamente uma vez.
	final class Operation {
		let kind: Kind
		let name: String
		let timeout: TimeInterval
		let start: () -> Start
		let finish: (_ status: Int32, _ payload: Any?) -> Void

		init(kind: Kind, name: String, timeout: TimeInterval = GattQueue.defaultTimeout, start: @escaping () -> Start, finish: @escaping (Int32, Any?) -> Void) {
			self.kind = kind
			self.name = name
			self.timeout = timeout
			self.start = start
			self.finish = finish
		}
	}

	/// Mesmo limite da `GattQueue` do Android e dos semáforos da SDK SMA (`SmaMessenger.java:36`).
	static let defaultTimeout: TimeInterval = 4

	private let scheduler: Scheduler
	private var pending: [Operation] = []
	private var current: Operation?
	private var timeoutToken: AnyObject?
	private var waitingForCredit = false

	init(scheduler: Scheduler) {
		self.scheduler = scheduler
	}

	var active: Operation? { current }

	var pendingCount: Int { pending.count }

	/// A operação atual espera o `peripheralIsReady(toSendWriteWithoutResponse:)`.
	var isWaitingForCredit: Bool { current != nil && waitingForCredit }

	func enqueue(_ operation: Operation) {
		pending.append(operation)
		if current == nil { next() }
	}

	/// Callback do periférico para uma operação do tipo `kind`. Devolve `true` se terminou a atual.
	@discardableResult
	func complete(_ kind: Kind, status: Int32, payload: Any? = nil) -> Bool {
		guard let operation = current, operation.kind == kind else { return false }
		finishCurrent(status: status, payload: payload)
		return true
	}

	/// O periférico voltou a aceitar escrita sem resposta: roda de novo a partida da operação que esperava.
	func retryStart() {
		guard let operation = current, waitingForCredit else { return }
		waitingForCredit = false
		handle(operation.start(), of: operation)
		if current == nil { next() }
	}

	/// Termina tudo com `status` (em geral `GattStatus.NOT_CONNECTED`).
	func failAll(status: Int32) {
		if current != nil { finishCurrent(status: status, payload: nil, advance: false) }
		let drained = pending
		pending.removeAll()
		for operation in drained { operation.finish(status, nil) }
	}

	private func next() {
		while current == nil, !pending.isEmpty {
			let operation = pending.removeFirst()
			current = operation
			waitingForCredit = false
			let token = scheduler.schedule(after: operation.timeout) { [weak self, weak operation] in
				guard let self, let operation, self.current === operation else { return }
				self.finishCurrent(status: GattStatus.shared.TIMEOUT, payload: nil)
			}
			timeoutToken = token
			handle(operation.start(), of: operation)
		}
	}

	private func handle(_ start: Start, of operation: Operation) {
		guard current === operation else { return }
		switch start {
		case .pending:
			break
		case .waitingForCredit:
			waitingForCredit = true
		case let .done(status, payload):
			finishCurrent(status: status, payload: payload, advance: false)
		}
	}

	private func finishCurrent(status: Int32, payload: Any?, advance: Bool = true) {
		guard let operation = current else { return }
		if let token = timeoutToken { scheduler.cancel(token) }
		timeoutToken = nil
		current = nil
		waitingForCredit = false
		operation.finish(status, payload)
		if advance { next() }
	}
}

/// O `Scheduler` de produção sobre a fila GCD do transporte.
final class DispatchQueueScheduler: GattQueue.Scheduler {
	private let queue: DispatchQueue

	init(queue: DispatchQueue) {
		self.queue = queue
	}

	func schedule(after seconds: TimeInterval, _ action: @escaping () -> Void) -> AnyObject {
		let item = DispatchWorkItem(block: action)
		queue.asyncAfter(deadline: .now() + seconds, execute: item)
		return item
	}

	func cancel(_ token: AnyObject) {
		(token as? DispatchWorkItem)?.cancel()
	}
}

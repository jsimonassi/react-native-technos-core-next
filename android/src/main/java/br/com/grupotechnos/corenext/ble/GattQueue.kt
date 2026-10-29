package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.transport.GattStatus

/**
 * Fila de operações GATT: uma por vez, cada uma liberada pelo callback correspondente ou pelo timeout.
 *
 * Por que existe: o `BluetoothGatt` do Android aceita só uma operação pendente por link; uma segunda
 * `writeCharacteristic`/`writeDescriptor`/`requestMtu` antes do callback da primeira devolve `false`
 * (ou `ERROR_GATT_WRITE_REQUEST_BUSY` na API 33+) e a operação some. A SDK SMA resolve isso com semáforos
 * de 4 s (`SmaMessenger.java:36, 54, 96, 142`); aqui é uma fila explícita com o mesmo timeout.
 *
 * Regras:
 * - [Operation.start] roda quando a operação chega na frente; se devolver status diferente de
 *   [GattStatus.SUCCESS] a operação termina na hora com esse status.
 * - [complete] só termina a operação atual se o [Kind] bater (callback de outro tipo é ignorado).
 * - Timeout ([Operation.timeoutMs]) termina com [GattStatus.TIMEOUT]. Um callback que chegue depois disso
 *   é descartado se o tipo não bater com a operação seguinte; se bater, é atribuído a ela (limite conhecido,
 *   documentado em `docs/transporte-android.md`).
 * - [failAll] termina a atual e todas as pendentes (queda do link), cada uma exatamente uma vez.
 *
 * Não é thread-safe de propósito: todos os métodos rodam na thread do GATT do [AndroidGattTransport]
 * (os callbacks do `BluetoothGatt` são entregues no mesmo `Handler`).
 */
internal class GattQueue(private val scheduler: Scheduler) {
	/** Abstração do `Handler`, para a fila ser testada na JVM. */
	interface Scheduler {
		fun postDelayed(delayMs: Long, action: () -> Unit): Any

		fun cancel(token: Any)
	}

	/** Tipo da operação, casado com o callback do `BluetoothGattCallback`. */
	enum class Kind { DISCOVER, DESCRIPTOR_WRITE, MTU, WRITE, READ }

	/**
	 * Uma operação GATT.
	 *
	 * @property name descrição para log.
	 */
	abstract class Operation(val kind: Kind, val name: String, val timeoutMs: Long = DEFAULT_TIMEOUT_MS) {
		/** Dispara a operação no `BluetoothGatt`. Devolve [GattStatus.SUCCESS] se ela foi aceita. */
		abstract fun start(): Int

		/** Entrega o resultado para a sessão. Chamado exatamente uma vez. [payload] depende do [kind]. */
		abstract fun finish(status: Int, payload: Any?)
	}

	private val pending = ArrayDeque<Operation>()
	private var current: Operation? = null
	private var timeoutToken: Any? = null

	/** Operação em andamento, ou `null`. */
	val active: Operation?
		get() = current

	val pendingCount: Int
		get() = pending.size

	fun enqueue(operation: Operation) {
		pending.addLast(operation)
		if (current == null) next()
	}

	/** Callback do `BluetoothGatt` para uma operação do tipo [kind]. Devolve `true` se terminou a operação atual. */
	fun complete(kind: Kind, status: Int, payload: Any? = null): Boolean {
		val operation = current ?: return false
		if (operation.kind != kind) return false
		finishCurrent(status, payload)
		return true
	}

	/** Termina tudo com [status] (em geral [GattStatus.NOT_CONNECTED]). */
	fun failAll(status: Int) {
		current?.let { finishCurrent(status, null, advance = false) }
		while (pending.isNotEmpty()) {
			pending.removeFirst().finish(status, null)
		}
	}

	private fun next() {
		while (current == null && pending.isNotEmpty()) {
			val operation = pending.removeFirst()
			current = operation
			val started = try {
				operation.start()
			} catch (error: SecurityException) {
				// Permissão BLUETOOTH_CONNECT revogada com o app aberto: falha a operação em vez de derrubar o processo.
				GATT_FAILURE
			}
			if (started != GattStatus.SUCCESS) {
				current = null
				operation.finish(started, null)
				continue
			}
			timeoutToken = scheduler.postDelayed(operation.timeoutMs) {
				if (current === operation) finishCurrent(GattStatus.TIMEOUT, null)
			}
		}
	}

	private fun finishCurrent(status: Int, payload: Any?, advance: Boolean = true) {
		val operation = current ?: return
		timeoutToken?.let(scheduler::cancel)
		timeoutToken = null
		current = null
		operation.finish(status, payload)
		if (advance) next()
	}

	companion object {
		/** Mesmo limite dos semáforos da SDK SMA (`SmaMessenger.java:36`). */
		const val DEFAULT_TIMEOUT_MS = 4_000L

		/** `BluetoothGatt.GATT_FAILURE`, repetido aqui para a fila não depender do SDK Android. */
		const val GATT_FAILURE = 257
	}
}

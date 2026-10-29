package br.com.grupotechnos.corenext.bridge

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Comandos em andamento, indexados pelo `requestId` que vai para a `WatchSession`.
 *
 * A sessão garante exatamente um callback terminal por `requestId` (`WatchSessionListener`); quem recebe o
 * terminal chama [take] e liquida a Promise. Genérico em [T] para ser testado na JVM sem React Native
 * (em produção, `T` é a `Promise` do RN ou `null` para comandos internos sem Promise).
 *
 * Ids começam em 1 e nunca valem `WatchSession.NO_REQUEST_ID` (-1). Thread-safe: os métodos do módulo
 * rodam na thread de módulos nativos e os terminais chegam na thread da sessão.
 */
class RequestRegistry<T : Any> {
	/** Um comando em andamento. [method] é o nome do método JS, usado no `onError.method`. */
	data class Entry<T>(val requestId: Int, val method: String, val token: T?)

	private val nextId = AtomicInteger(1)
	private val pending = ConcurrentHashMap<Int, Entry<T>>()

	/** Aloca um id e guarda o comando até o terminal. */
	fun register(method: String, token: T?): Int {
		val id = allocate()
		pending[id] = Entry(id, method, token)
		return id
	}

	/**
	 * Aloca um id sem guardar nada: para comandos que o próprio Core dispara (reconexão automática).
	 * O terminal desses ids não acha entrada, e o `onError` sai com `method = null`.
	 */
	fun nextId(): Int = allocate()

	/** Remove e devolve o comando, ou `null` se o id não for conhecido (evento espontâneo ou já liquidado). */
	fun take(requestId: Int): Entry<T>? = pending.remove(requestId)

	/** Lê sem remover (para callbacks não terminais, como progresso de sync). */
	fun peek(requestId: Int): Entry<T>? = pending[requestId]

	/** Remove e devolve todos os comandos (usado quando o módulo é destruído). */
	fun drain(): List<Entry<T>> {
		val all = pending.values.toList()
		all.forEach { pending.remove(it.requestId) }
		return all
	}

	val size: Int
		get() = pending.size

	private fun allocate(): Int {
		while (true) {
			val id = nextId.getAndIncrement()
			if (id > 0) return id
			// Após 2^31 comandos o contador dá a volta; reinicia em 1 em vez de produzir ids negativos.
			nextId.compareAndSet(id + 1, 1)
		}
	}
}

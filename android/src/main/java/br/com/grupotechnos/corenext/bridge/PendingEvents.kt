package br.com.grupotechnos.corenext.bridge

/**
 * Fila de eventos para o JavaScript enquanto não há quem os receba.
 *
 * Existe por dois motivos verificados no React Native 0.81.4:
 * - o `emitOnX` gerado pelo codegen chama `mEventEmitterCallback.invoke(...)` sem checar `null`
 *   (`@react-native/codegen/lib/generators/modules/GenerateModuleJavaSpec.js:52-62`), e o callback só é
 *   instalado quando o JS cria o TurboModule (`JavaTurboModule.cpp:972-998`); emitir antes disso é NPE;
 * - a sessão nativa vive no processo (`CoreGraph`) e sobrevive ao reload do JS: eventos da sessão que chegam
 *   entre o fim de um módulo e o início do próximo não podem ser perdidos (estado de conexão, fim de sync).
 *
 * Não muda de thread: emitir da thread da sessão é seguro, porque o `AsyncEventEmitter` do C++ protege a lista
 * de listeners com mutex e cada listener é um `AsyncCallback` que agenda a chamada na thread JS pelo `CallInvoker`
 * (`ReactCommon/react/bridging/EventEmitter.h:65-102`). Por isso não há `runOnJSQueueThread` aqui.
 *
 * Genérico em [P] (payload) para ser testado na JVM. Thread-safe.
 *
 * @param capacity máximo de eventos guardados; acima disso o mais antigo é descartado.
 */
class PendingEvents<P>(private val capacity: Int = DEFAULT_CAPACITY) {
	/** Destino dos eventos: o módulo atual. */
	interface Sink<P> {
		/** `true` quando o módulo pode emitir (instância React ativa e callback de eventos instalado). */
		fun canEmit(): Boolean

		/** Emite de fato. Pode lançar se o módulo morreu no meio; o evento volta para a fila. */
		fun emit(name: String, payload: P)
	}

	private val lock = Any()
	private val queue = ArrayDeque<Pair<String, P>>()
	private var sink: Sink<P>? = null

	/** Liga o módulo e entrega o que estiver na fila. */
	fun attach(sink: Sink<P>) {
		synchronized(lock) { this.sink = sink }
		flush()
	}

	/** Desliga o módulo [sink] (se ainda for o atual). */
	fun detach(sink: Sink<P>) {
		synchronized(lock) {
			if (this.sink === sink) this.sink = null
		}
	}

	/**
	 * Emite agora se possível; senão guarda.
	 *
	 * A emissão de fato acontece **dentro** do lock, e a fila é entregue antes: eventos chegam de várias threads (a da
	 * sessão, a principal no scan e no receiver, a do GATT e a dos módulos pelo log) e, se a entrega saísse do lock,
	 * um evento novo de outra thread podia passar na frente de um que acabou de sair da fila (um
	 * `onConnectStateChanged` antigo chegando depois do atual). Segurar o lock custa pouco: o `AsyncEventEmitter` do
	 * C++ só agenda a chamada no `CallInvoker`. O lock é reentrante, então um log emitido de dentro de [Sink.emit]
	 * não trava.
	 *
	 * @param queueIfNotReady `false` para eventos de alto volume e sem valor depois (ex.: `onLog`, que já fica no
	 * ring do `RingLogger` e pode ser lido com `getLogs`).
	 */
	fun emit(name: String, payload: P, queueIfNotReady: Boolean = true) {
		synchronized(lock) {
			drainLocked()
			val current = sink
			if (current == null || !current.canEmit() || queue.isNotEmpty()) {
				if (queueIfNotReady) enqueue(name, payload)
				return
			}
			try {
				current.emit(name, payload)
			} catch (error: RuntimeException) {
				if (queueIfNotReady) enqueue(name, payload)
			}
		}
	}

	/** Entrega a fila, em ordem, se o módulo estiver pronto. */
	fun flush() {
		synchronized(lock) { drainLocked() }
	}

	private fun drainLocked() {
		while (true) {
			val current = sink ?: return
			if (queue.isEmpty() || !current.canEmit()) return
			val item = queue.removeFirst()
			try {
				current.emit(item.first, item.second)
			} catch (error: RuntimeException) {
				queue.addFirst(item)
				return
			}
		}
	}

	/** Quantos eventos estão guardados. */
	val size: Int
		get() = synchronized(lock) { queue.size }

	private fun enqueue(name: String, payload: P) {
		if (queue.size >= capacity) queue.removeFirst()
		queue.addLast(name to payload)
	}

	companion object {
		const val DEFAULT_CAPACITY = 500
	}
}

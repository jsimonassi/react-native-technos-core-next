package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.bridge.CoreCompletion
import com.facebook.react.bridge.Promise

/**
 * A `Promise` do React Native como o `CoreCompletion` que o `CoreBridge` (Repo 1) liquida: o módulo cria uma por
 * chamada JS que devolve Promise.
 *
 * O `CoreBridge` resolve com os mesmos valores que o módulo antigo entregava ao `Promise.resolve`: `null`, um
 * `Boolean` (`isConnected`), uma `String` (`exportLogs`), um `Map` (`getLastPairedDevice`) ou uma `List` de mapas
 * (`getLogs`). Mapas e listas passam pelo [WritableConverter] (o `Promise.resolve` só aceita `WritableMap`/`WritableArray`
 * para objetos); o resto vai como está. O `reject` usa a sobrecarga `reject(code, message)`, a mesma de antes.
 */
class PromiseCompletion(private val promise: Promise) : CoreCompletion {
	override fun resolve(value: Any?) {
		promise.resolve(
			when (value) {
				is Map<*, *> -> WritableConverter.toMap(value.entries.associate { (key, item) -> key.toString() to item })
				is List<*> -> WritableConverter.toArray(value)
				else -> value
			},
		)
	}

	override fun reject(code: String, message: String) {
		promise.reject(code, message)
	}
}

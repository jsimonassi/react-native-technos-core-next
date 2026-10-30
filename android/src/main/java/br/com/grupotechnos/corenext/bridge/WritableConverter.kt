package br.com.grupotechnos.corenext.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * Converte os mapas puros do `EventMapper` do `:bridge` do Repo 1 (`br.com.grupotechnos.watch.bridge.EventMapper`, que
 * o `CoreBridge` emite e devolve) em `WritableMap`/`WritableArray` do React Native.
 *
 * Precisa das bibliotecas nativas do RN carregadas (`Arguments.createMap` cria um `WritableNativeMap`),
 * por isso fica separado do código comum do Repo 1 e não é usado nos testes JVM.
 *
 * `Long` vira `Double` porque o `WritableMap` não tem `putLong` e o JS só tem `number`.
 * Tipos não previstos viram texto (`toString`) em vez de derrubar o processo.
 */
object WritableConverter {
	fun toMap(source: Map<String, Any?>): WritableMap {
		val map = Arguments.createMap()
		for ((key, value) in source) {
			when (value) {
				null -> map.putNull(key)
				is String -> map.putString(key, value)
				is Boolean -> map.putBoolean(key, value)
				is Int -> map.putInt(key, value)
				is Long -> map.putDouble(key, value.toDouble())
				is Double -> map.putDouble(key, value)
				is Float -> map.putDouble(key, value.toDouble())
				is Number -> map.putDouble(key, value.toDouble())
				is Map<*, *> -> map.putMap(key, toMap(stringKeys(value)))
				is List<*> -> map.putArray(key, toArray(value))
				else -> map.putString(key, value.toString())
			}
		}
		return map
	}

	fun toArray(source: List<*>): WritableArray {
		val array = Arguments.createArray()
		for (value in source) {
			when (value) {
				null -> array.pushNull()
				is String -> array.pushString(value)
				is Boolean -> array.pushBoolean(value)
				is Int -> array.pushInt(value)
				is Long -> array.pushDouble(value.toDouble())
				is Double -> array.pushDouble(value)
				is Float -> array.pushDouble(value.toDouble())
				is Number -> array.pushDouble(value.toDouble())
				is Map<*, *> -> array.pushMap(toMap(stringKeys(value)))
				is List<*> -> array.pushArray(toArray(value))
				else -> array.pushString(value.toString())
			}
		}
		return array
	}

	private fun stringKeys(map: Map<*, *>): Map<String, Any?> =
		map.entries.associate { (key, value) -> key.toString() to value }
}

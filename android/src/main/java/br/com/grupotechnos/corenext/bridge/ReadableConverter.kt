package br.com.grupotechnos.corenext.bridge

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType

/**
 * O caminho inverso do [WritableConverter]: `ReadableArray`/`ReadableMap` que chegam do JS → `List`/`Map` puros, a
 * forma que o `CoreBridge` (Repo 1) recebe (hoje só no `deletedSavedData`).
 *
 * Tipos de saída, pelo `ReadableType` de cada valor: `null`, [Boolean], número sempre como [Double] (o JS só tem
 * `number`), [String], `Map<String, Any?>` (na ordem das chaves do mapa) e `List<Any?>`, aninhados.
 *
 * Por que não o `ReadableArray.toArrayList()`: o tipo dos itens depende da implementação. O `ReadableNativeArray` (o
 * que o TurboModule recebe) devolve `HashMap` para um mapa aninhado, mas o `JavaOnlyArray` devolve o próprio
 * `JavaOnlyMap`, que não é um `java.util.Map`, e o `CoreBridge` o ignoraria. Lendo pelo `getType` daqui, a saída é a
 * mesma para qualquer implementação (e o teste JVM, que só tem o `JavaOnlyArray`, exercita o caminho de produção). É
 * também a leitura que o módulo antigo fazia item a item (`getType` e o `getX` do tipo).
 *
 * Kotlin puro sobre as interfaces do RN, sem a biblioteca nativa: testado na JVM (`ReadableConverterTest`).
 */
object ReadableConverter {
	fun toList(source: ReadableArray): List<Any?> {
		val list = ArrayList<Any?>(source.size())
		for (index in 0 until source.size()) {
			list += when (source.getType(index)) {
				ReadableType.Null -> null
				ReadableType.Boolean -> source.getBoolean(index)
				ReadableType.Number -> source.getDouble(index)
				ReadableType.String -> source.getString(index)
				ReadableType.Map -> source.getMap(index)?.let(::toMap)
				ReadableType.Array -> source.getArray(index)?.let(::toList)
			}
		}
		return list
	}

	fun toMap(source: ReadableMap): Map<String, Any?> {
		val map = LinkedHashMap<String, Any?>()
		val keys = source.keySetIterator()
		while (keys.hasNextKey()) {
			val key = keys.nextKey()
			map[key] = when (source.getType(key)) {
				ReadableType.Null -> null
				ReadableType.Boolean -> source.getBoolean(key)
				ReadableType.Number -> source.getDouble(key)
				ReadableType.String -> source.getString(key)
				ReadableType.Map -> source.getMap(key)?.let(::toMap)
				ReadableType.Array -> source.getArray(key)?.let(::toList)
			}
		}
		return map
	}
}

package br.com.grupotechnos.corenext.bridge

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs

/**
 * `ReadableArray`/`ReadableMap` → `List`/`Map` puros. Roda sobre o `JavaOnlyArray`/`JavaOnlyMap` (Kotlin puro do
 * `react-android`), que leem pelo mesmo `getType`/`getX` do `ReadableNativeArray` de produção.
 */
class ReadableConverterTest {
	@Test
	fun everyTypeBecomesItsPlainKotlinValue() {
		val list = ReadableConverter.toList(JavaOnlyArray.of(null, true, 5, 5.5, 7L, "2026-10-28T10:00:00-03:00"))
		assertEquals(listOf(null, true, 5.0, 5.5, 7.0, "2026-10-28T10:00:00-03:00"), list)
		// Número sempre Double, como no ReadableNativeArray (o JS só tem number).
		assertIs<Double>(list[2])
	}

	@Test
	fun nestedMapsAndArraysBecomeKotlinMapsAndLists() {
		val item = JavaOnlyMap.of("category", 5, "registered_at", "2026-10-28T10:00:00-03:00", "extra", JavaOnlyArray.of(1, "a"))
		val list = ReadableConverter.toList(JavaOnlyArray.of(item, JavaOnlyArray.of(JavaOnlyMap.of("deep", false))))
		val map = assertIs<Map<String, Any?>>(list[0])
		assertEquals(mapOf("category" to 5.0, "registered_at" to "2026-10-28T10:00:00-03:00", "extra" to listOf(1.0, "a")), map)
		assertEquals(listOf(mapOf("deep" to false)), list[1])
	}

	@Test
	fun nullValuesInsideMapsAreKept() {
		val map = ReadableConverter.toMap(JavaOnlyMap.of("registered_at", null, "category", 0.0))
		assertEquals(mapOf("registered_at" to null, "category" to 0.0), map)
		assertEquals(setOf("registered_at", "category"), map.keys)
	}

	@Test
	fun emptyArrayIsAnEmptyList() {
		assertEquals(emptyList(), ReadableConverter.toList(JavaOnlyArray()))
	}
}

package br.com.grupotechnos.corenext.bridge

import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNull

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

	/**
	 * A forma das listas da fase 2 (`setAlarm`, `setWorldClock`, `setAddressBook`, `syncWeather`): mapas com booleanos
	 * e números misturados, um objeto aninhado e um elemento nulo no meio. Valores fictícios.
	 */
	@Test
	fun arrayOfNestedMapsWithMixedValuesAndANullElementKeepsEveryItemInPlace() {
		val alarm = JavaOnlyMap.of("enable", true, "hour", 6, "minute", 45, "repeat", "1111100")
		val alarmAsNumbers = JavaOnlyMap.of("enable", 1, "hour", 7.5, "minute", 0L, "repeat", null)
		val city = JavaOnlyMap.of(
			"name", "Cidade Fictícia",
			"utcOffsetMinutes", -180,
			"latitude", -12.345678,
			"longitude", -45.678901,
			"extra", JavaOnlyArray.of(JavaOnlyMap.of("deep", false), null, JavaOnlyArray.of(true, 0)),
		)
		val list = ReadableConverter.toList(JavaOnlyArray.of(alarm, null, alarmAsNumbers, city))

		assertEquals(4, list.size)
		assertEquals(mapOf("enable" to true, "hour" to 6.0, "minute" to 45.0, "repeat" to "1111100"), list[0])
		// O elemento nulo fica no lugar: quem decide o que ele vale (INVALID_ARGUMENT) é o CoreBridge.
		assertNull(list[1])
		// Sem coerção: o 1 do "enable" segue número e o 7.5 não é arredondado aqui (D7 e D9 moram no SettingsMapper).
		val asNumbers = assertIs<Map<String, Any?>>(list[2])
		assertIs<Double>(asNumbers["enable"])
		assertEquals(mapOf("enable" to 1.0, "hour" to 7.5, "minute" to 0.0, "repeat" to null), asNumbers)
		assertEquals(
			mapOf(
				"name" to "Cidade Fictícia",
				"utcOffsetMinutes" to -180.0,
				"latitude" to -12.345678,
				"longitude" to -45.678901,
				"extra" to listOf(mapOf("deep" to false), null, listOf(true, 0.0)),
			),
			list[3],
		)
	}

	/** A forma dos dicionários da fase 2 com objeto aninhado (o `repeat` do estresse, do não perturbe e da água). */
	@Test
	fun mapWithNestedMapAndArrayOfMapsKeepsKeysTypesAndSourceOrder() {
		val repeat = JavaOnlyMap.of("monday", true, "tuesday", 0, "sunday", null)
		val source = JavaOnlyMap.of(
			"enabled", false,
			"startHour", "08:00",
			"interval", 30,
			"repeat", repeat,
			"items", JavaOnlyArray.of(JavaOnlyMap.of("icon", 3, "min", 15.5), null),
		)
		val map = ReadableConverter.toMap(source)

		// A ordem é a do mapa de origem (o JavaOnlyMap e o ReadableNativeMap não guardam a ordem de inserção).
		val sourceKeys = buildList {
			val keys = source.keySetIterator()
			while (keys.hasNextKey()) add(keys.nextKey())
		}
		assertEquals(sourceKeys, map.keys.toList())
		assertEquals(setOf("enabled", "startHour", "interval", "repeat", "items"), map.keys)
		assertEquals(false, map["enabled"])
		assertEquals(mapOf("monday" to true, "tuesday" to 0.0, "sunday" to null), map["repeat"])
		assertEquals(listOf(mapOf("icon" to 3.0, "min" to 15.5), null), map["items"])
		// Chave ausente continua ausente (o padrão de cada uma é do SettingsMapper, DP-97).
		assertFalse("endHour" in map)
	}
}

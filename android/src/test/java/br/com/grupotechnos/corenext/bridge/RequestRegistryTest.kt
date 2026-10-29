package br.com.grupotechnos.corenext.bridge

import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Liquidação única por `requestId`. */
class RequestRegistryTest {
	@Test
	fun takeReturnsTheEntryOnlyOnce() {
		val registry = RequestRegistry<String>()
		val id = registry.register("getBatteryStatus", "promise-1")
		assertTrue(id > 0)
		assertEquals(RequestRegistry.Entry(id, "getBatteryStatus", "promise-1"), registry.take(id))
		assertNull(registry.take(id))
	}

	@Test
	fun idsAreUniqueAndNeverNoRequestId() {
		val registry = RequestRegistry<String>()
		val ids = (1..100).map { if (it % 2 == 0) registry.register("m", null) else registry.nextId() }
		assertEquals(ids.size, ids.toSet().size)
		ids.forEach { assertNotEquals(-1, it) }
		assertEquals(50, registry.size)
	}

	@Test
	fun unknownIdIsIgnored() {
		val registry = RequestRegistry<String>()
		assertNull(registry.take(-1))
		assertNull(registry.take(registry.nextId()))
	}

	@Test
	fun drainEmptiesTheRegistry() {
		val registry = RequestRegistry<String>()
		registry.register("a", "p1")
		registry.register("b", "p2")
		assertEquals(setOf("p1", "p2"), registry.drain().mapNotNull { it.token }.toSet())
		assertEquals(0, registry.size)
	}
}

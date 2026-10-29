package br.com.grupotechnos.corenext.bridge

import org.junit.Test
import java.util.Collections
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Fila de eventos até o módulo poder emitir. */
class PendingEventsTest {
	private class FakeSink(var ready: Boolean) : PendingEvents.Sink<Int> {
		val received = mutableListOf<Pair<String, Int>>()
		var failNext = false

		override fun canEmit(): Boolean = ready

		override fun emit(name: String, payload: Int) {
			if (failNext) {
				failNext = false
				throw IllegalStateException("module died")
			}
			received += name to payload
		}
	}

	@Test
	fun queuesUntilAttachedAndReady() {
		val events = PendingEvents<Int>()
		events.emit("a", 1)
		val sink = FakeSink(ready = false)
		events.attach(sink)
		events.emit("b", 2)
		assertEquals(2, events.size)
		sink.ready = true
		events.emit("c", 3)
		assertEquals(listOf("a" to 1, "b" to 2, "c" to 3), sink.received)
		assertEquals(0, events.size)
	}

	@Test
	fun eventsWithoutQueueAreDroppedWhenNotReady() {
		val events = PendingEvents<Int>()
		events.emit("onLog", 1, queueIfNotReady = false)
		val sink = FakeSink(ready = true)
		events.attach(sink)
		assertEquals(emptyList(), sink.received)
	}

	@Test
	fun capacityDropsTheOldest() {
		val events = PendingEvents<Int>(capacity = 2)
		events.emit("a", 1)
		events.emit("b", 2)
		events.emit("c", 3)
		val sink = FakeSink(ready = true)
		events.attach(sink)
		assertEquals(listOf("b" to 2, "c" to 3), sink.received)
	}

	@Test
	fun failedEmitGoesBackToTheQueueInOrder() {
		val events = PendingEvents<Int>()
		val sink = FakeSink(ready = true)
		events.attach(sink)
		sink.failNext = true
		events.emit("a", 1)
		assertEquals(1, events.size)
		events.emit("b", 2)
		assertEquals(listOf("a" to 1, "b" to 2), sink.received)
	}

	@Test
	fun detachOnlyRemovesTheCurrentSink() {
		val events = PendingEvents<Int>()
		val old = FakeSink(ready = true)
		val current = FakeSink(ready = true)
		events.attach(old)
		events.attach(current)
		events.detach(old)
		events.emit("a", 1)
		assertEquals(listOf("a" to 1), current.received)
		events.detach(current)
		events.emit("b", 2)
		assertEquals(1, events.size)
	}

	@Test
	fun eventFromAnotherThreadNeverOvertakesAQueuedOne() {
		// "a" sai da fila e a entrega dele demora; "b" chega de outra thread nesse meio-tempo e precisa vir depois.
		val started = CountDownLatch(1)
		val release = CountDownLatch(1)
		val received = Collections.synchronizedList(mutableListOf<String>())
		val sink = object : PendingEvents.Sink<Int> {
			override fun canEmit(): Boolean = true

			override fun emit(name: String, payload: Int) {
				if (name == "a") {
					started.countDown()
					release.await(5, TimeUnit.SECONDS)
				}
				received += name
			}
		}
		val events = PendingEvents<Int>()
		events.emit("a", 1)
		val flusher = thread { events.attach(sink) }
		assertTrue(started.await(5, TimeUnit.SECONDS))
		val other = thread { events.emit("b", 2) }
		// Tempo para "b" passar na frente se a entrega saísse do lock.
		Thread.sleep(200)
		release.countDown()
		flusher.join(5_000)
		other.join(5_000)
		assertEquals(listOf("a", "b"), received.toList())
	}
}

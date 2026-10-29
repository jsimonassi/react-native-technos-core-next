package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.transport.GattStatus
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Serialização, timeout e queda do link na [GattQueue], com um relógio falso no lugar do `Handler`. */
class GattQueueTest {
	private class FakeScheduler : GattQueue.Scheduler {
		val tasks = mutableListOf<Pair<Long, () -> Unit>>()

		override fun postDelayed(delayMs: Long, action: () -> Unit): Any {
			val task = delayMs to action
			tasks += task
			return task
		}

		override fun cancel(token: Any) {
			tasks.remove(token)
		}

		fun fireAll() {
			val pending = tasks.toList()
			tasks.clear()
			pending.forEach { it.second() }
		}
	}

	private class Op(
		kind: GattQueue.Kind,
		name: String,
		private val log: MutableList<String>,
		private val startStatus: Int = GattStatus.SUCCESS,
	) : GattQueue.Operation(kind, name) {
		override fun start(): Int {
			log += "start $name"
			return startStatus
		}

		override fun finish(status: Int, payload: Any?) {
			log += "finish $name status=$status payload=$payload"
		}
	}

	@Test
	fun runsOneOperationAtATime() {
		val log = mutableListOf<String>()
		val queue = GattQueue(FakeScheduler())
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w1", log))
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w2", log))
		assertEquals(listOf("start w1"), log)
		assertEquals(1, queue.pendingCount)
		assertTrue(queue.complete(GattQueue.Kind.WRITE, GattStatus.SUCCESS))
		assertEquals(listOf("start w1", "finish w1 status=0 payload=null", "start w2"), log)
	}

	@Test
	fun callbackOfAnotherKindDoesNotAdvance() {
		val log = mutableListOf<String>()
		val queue = GattQueue(FakeScheduler())
		queue.enqueue(Op(GattQueue.Kind.MTU, "mtu", log))
		assertFalse(queue.complete(GattQueue.Kind.WRITE, GattStatus.SUCCESS))
		assertTrue(queue.complete(GattQueue.Kind.MTU, GattStatus.SUCCESS, 247))
		assertEquals("finish mtu status=0 payload=247", log.last())
	}

	@Test
	fun timeoutFinishesWithTimeoutAndStartsTheNext() {
		val log = mutableListOf<String>()
		val scheduler = FakeScheduler()
		val queue = GattQueue(scheduler)
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w1", log))
		queue.enqueue(Op(GattQueue.Kind.READ, "r1", log))
		assertEquals(GattQueue.DEFAULT_TIMEOUT_MS, scheduler.tasks.single().first)
		scheduler.fireAll()
		assertEquals(listOf("start w1", "finish w1 status=${GattStatus.TIMEOUT} payload=null", "start r1"), log)
		// Callback atrasado da escrita: não casa com a leitura atual, é descartado.
		assertFalse(queue.complete(GattQueue.Kind.WRITE, GattStatus.SUCCESS))
	}

	@Test
	fun completionCancelsTheTimeout() {
		val scheduler = FakeScheduler()
		val queue = GattQueue(scheduler)
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w1", mutableListOf()))
		queue.complete(GattQueue.Kind.WRITE, GattStatus.SUCCESS)
		assertEquals(0, scheduler.tasks.size)
	}

	@Test
	fun startFailureFinishesImmediately() {
		val log = mutableListOf<String>()
		val queue = GattQueue(FakeScheduler())
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w1", log, startStatus = GattQueue.GATT_FAILURE))
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w2", log))
		assertEquals(listOf("start w1", "finish w1 status=257 payload=null", "start w2"), log)
	}

	@Test
	fun failAllFinishesEveryOperationOnce() {
		val log = mutableListOf<String>()
		val scheduler = FakeScheduler()
		val queue = GattQueue(scheduler)
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w1", log))
		queue.enqueue(Op(GattQueue.Kind.WRITE, "w2", log))
		queue.failAll(GattStatus.NOT_CONNECTED)
		assertEquals(
			listOf("start w1", "finish w1 status=-2 payload=null", "finish w2 status=-2 payload=null"),
			log,
		)
		assertEquals(0, scheduler.tasks.size)
		assertEquals(null, queue.active)
		assertFalse(queue.complete(GattQueue.Kind.WRITE, GattStatus.SUCCESS))
	}
}

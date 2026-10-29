package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.transport.GattStatus
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Quando o transporte emite `onConnected`/`onDisconnected` ([LinkLifecycle]): contrato do `Transport.disconnect`
 * (ADR 12 do Repo 1) e contrato B do Bluetooth desligado.
 */
class LinkLifecycleTest {
	private val events = mutableListOf<String>()
	private val lifecycle = LinkLifecycle(object : LinkLifecycle.Output {
		override fun onConnected() {
			events += "connected"
		}

		override fun onDisconnected(status: Int, message: String) {
			events += "disconnected $status $message"
		}
	})

	/** `connect()` aceito e GATT aberto; devolve a geração dos callbacks dele. */
	private fun open(autoReconnect: Boolean): Int {
		lifecycle.connectAccepted(autoReconnect)
		return lifecycle.gattOpening()
	}

	private fun openLink(): Int = open(autoReconnect = false).also { lifecycle.linkUp(it) }

	@Test
	fun bluetoothOffWithAnOpenLinkEmitsNoDisconnectAndIgnoresTheLateCallback() {
		val generation = openLink()
		assertEquals(listOf("connected"), events)

		assertTrue(lifecycle.bluetoothOff())
		// A pilha avisa a queda do GATT que o transporte já fechou: callback atrasado, sem evento.
		assertEquals(LinkLifecycle.LinkDown.STALE, lifecycle.linkDown(generation, 8))
		lifecycle.linkUp(generation)

		assertEquals(listOf("connected"), events)
		assertFalse(lifecycle.linkConnected)
		assertFalse(lifecycle.active)
	}

	@Test
	fun bluetoothOffWithAPendingConnectionEmitsNothingAndStopsTheRearm() {
		val first = open(autoReconnect = true)
		assertEquals(LinkLifecycle.LinkDown.PENDING_FAILED, lifecycle.linkDown(first, 133))
		assertTrue(lifecycle.active, "a pending connection that failed without connecting stays armed")
		val rearmed = lifecycle.gattOpening()

		assertTrue(lifecycle.bluetoothOff())
		assertEquals(LinkLifecycle.LinkDown.STALE, lifecycle.linkDown(rearmed, 133))

		assertEquals(emptyList<String>(), events)
		// O re-arme agendado confere `active` antes de reabrir.
		assertFalse(lifecycle.active)
	}

	@Test
	fun disconnectAfterBluetoothOffEmitsNothingUntilANewConnect() {
		openLink()
		lifecycle.bluetoothOff()

		assertFalse(lifecycle.disconnectRequested())
		assertFalse(lifecycle.disconnectRequested())
		assertEquals(listOf("connected"), events)

		open(autoReconnect = true)
		assertTrue(lifecycle.disconnectRequested())
		assertEquals(listOf("connected", "disconnected 0 Disconnected on request"), events)
	}

	@Test
	fun bluetoothOffWhileIdleEmitsNothing() {
		assertFalse(lifecycle.bluetoothOff())
		assertFalse(lifecycle.disconnectRequested())
		assertEquals(emptyList<String>(), events)
	}

	@Test
	fun linkLossReportedBeforeBluetoothOffIsAnOrdinaryDrop() {
		val generation = openLink()
		assertEquals(LinkLifecycle.LinkDown.LOST, lifecycle.linkDown(generation, 8))

		lifecycle.bluetoothOff()
		assertFalse(lifecycle.disconnectRequested())

		assertEquals(listOf("connected", "disconnected 8 Link lost (status=8)"), events)
	}

	@Test
	fun connectRejectedEmitsExactlyOnceAndLeavesTheTransportStopped() {
		// Conexão pendente armada e o adaptador já desligando, com o STATE_OFF ainda a caminho.
		open(autoReconnect = true)
		lifecycle.connectRejected(GattStatus.NOT_CONNECTED, "Bluetooth is off")
		assertFalse(lifecycle.disconnectRequested())
		lifecycle.bluetoothOff()
		assertFalse(lifecycle.disconnectRequested())

		assertEquals(listOf("disconnected -2 Bluetooth is off"), events)
		assertFalse(lifecycle.active)
	}

	@Test
	fun connectRejectedWithAnOpenLinkStillEmitsOnlyOnce() {
		val generation = openLink()
		lifecycle.connectRejected(GattStatus.NOT_CONNECTED, "Bluetooth is off")
		assertEquals(LinkLifecycle.LinkDown.STALE, lifecycle.linkDown(generation, 8))
		assertFalse(lifecycle.disconnectRequested())

		assertEquals(listOf("connected", "disconnected -2 Bluetooth is off"), events)
	}

	@Test
	fun disconnectEmitsOnceForAnOpenLinkOrAPendingConnection() {
		openLink()
		assertTrue(lifecycle.disconnectRequested())
		assertFalse(lifecycle.disconnectRequested())

		open(autoReconnect = true)
		assertTrue(lifecycle.disconnectRequested())

		assertEquals(
			listOf("connected", "disconnected 0 Disconnected on request", "disconnected 0 Disconnected on request"),
			events,
		)
	}

	@Test
	fun linkLossAndDirectConnectFailureStopTheTransport() {
		val link = openLink()
		assertEquals(LinkLifecycle.LinkDown.LOST, lifecycle.linkDown(link, 19))
		assertFalse(lifecycle.disconnectRequested())

		val direct = open(autoReconnect = false)
		assertEquals(LinkLifecycle.LinkDown.CONNECT_FAILED, lifecycle.linkDown(direct, 133))
		assertFalse(lifecycle.disconnectRequested())

		assertEquals(
			listOf("connected", "disconnected 19 Link lost (status=19)", "disconnected 133 Connect failed (status=133)"),
			events,
		)
	}

	@Test
	fun connectThatReplacesAnOpenLinkClosesItWithOneEvent() {
		val old = openLink()
		lifecycle.connectAccepted(autoReconnect = true)
		assertEquals(LinkLifecycle.LinkDown.STALE, lifecycle.linkDown(old, 8))

		assertEquals(listOf("connected", "disconnected 0 Link replaced by a new connect"), events)
		assertTrue(lifecycle.active)
	}

	@Test
	fun openFailureEmitsOnceAndStops() {
		lifecycle.connectAccepted(autoReconnect = false)
		lifecycle.gattOpening()
		lifecycle.openFailed(GattQueue.GATT_FAILURE)
		assertFalse(lifecycle.disconnectRequested())

		assertEquals(listOf("disconnected ${GattQueue.GATT_FAILURE} connectGatt failed"), events)
	}
}

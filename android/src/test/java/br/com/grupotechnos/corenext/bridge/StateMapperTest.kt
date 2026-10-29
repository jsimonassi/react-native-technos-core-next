package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.ConnectionState
import org.junit.Test
import kotlin.test.assertEquals

/** `ConnectionState` → `deviceConnectStates` do Core atual. */
class StateMapperTest {
	@Test
	fun everyStateHasTheExpectedCode() {
		val expected = mapOf(
			ConnectionState.DISCONNECTED to 0,
			ConnectionState.RECONNECTING to 0,
			ConnectionState.CONNECTING to 1,
			ConnectionState.CONFIGURING to 1,
			ConnectionState.HANDSHAKING to 1,
			ConnectionState.READY to 2,
			ConnectionState.SYNCING to 2,
			ConnectionState.BLUETOOTH_OFF to 4,
		)
		assertEquals(ConnectionState.entries.toSet(), expected.keys)
		for ((state, code) in expected) {
			assertEquals(code, StateMapper.toDeviceConnectState(state), "state=$state")
		}
	}

	@Test
	fun isConnectedOnlyWhenCommandsAreAccepted() {
		val connected = ConnectionState.entries.filter(StateMapper::isConnected).toSet()
		assertEquals(setOf(ConnectionState.READY, ConnectionState.SYNCING), connected)
	}
}

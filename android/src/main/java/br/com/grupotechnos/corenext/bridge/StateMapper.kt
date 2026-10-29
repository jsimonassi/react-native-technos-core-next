package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.ConnectionState

/**
 * Tradução de [ConnectionState] para os códigos de `deviceConnectStates` do Core atual
 * (`TechnosWareCore/src/NativeModules/index.ts:22-30`), que o app Mormaii compara em `onConnectStateChanged.state`.
 *
 * Os estados intermediários da sessão colapsam em "conectando" (1) e `SYNCING` continua "conectado" (2),
 * porque o app só habilita as telas de dados com o código 2. `RECONNECTING` vira 0 para o app mostrar
 * "desconectado" enquanto a conexão pendente espera o relógio voltar, como o Core atual faz quando o link cai
 * (`SMAService.java:254-262`). Os códigos -2 (DFU) e 3 (desconectado em atividade) não são produzidos nesta PoC.
 */
object StateMapper {
	const val DISCONNECTED = 0
	const val CONNECTING = 1
	const val CONNECTED = 2
	const val BLUETOOTH_OFF = 4

	fun toDeviceConnectState(state: ConnectionState): Int = when (state) {
		ConnectionState.DISCONNECTED, ConnectionState.RECONNECTING -> DISCONNECTED
		ConnectionState.CONNECTING, ConnectionState.CONFIGURING, ConnectionState.HANDSHAKING -> CONNECTING
		ConnectionState.READY, ConnectionState.SYNCING -> CONNECTED
		ConnectionState.BLUETOOTH_OFF -> BLUETOOTH_OFF
	}

	/** `true` quando a sessão aceita comandos (resposta de `isConnected`). */
	fun isConnected(state: ConnectionState): Boolean =
		state == ConnectionState.READY || state == ConnectionState.SYNCING
}

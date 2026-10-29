package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.transport.GattStatus

/**
 * Estado do link do [AndroidGattTransport] e a regra de quando sai `onConnected`/`onDisconnected`, em Kotlin puro para
 * ser testada na JVM (`LinkLifecycleTest`). O transporte chama um método por acontecimento, na thread do GATT, e cuida
 * dos objetos do Android (`BluetoothGatt`, scan de reconexão, re-arme); quem emite os dois eventos é esta classe, pelo
 * [Output].
 *
 * Regras (contrato do `Transport` do Repo 1, ADR 12 e `docs/arquitetura.md` seção 5 de lá):
 * - Cada `onConnected` tem depois exatamente um `onDisconnected`, exceto quando o Bluetooth desliga.
 * - [disconnectRequested] emite um `onDisconnected` só se havia link aberto ou conexão pendente ([active]); a sessão
 *   conta essas respostas, e uma a mais derrubaria a tentativa seguinte.
 * - **Bluetooth desligado** ([bluetoothOff], "contrato B"): nenhum `onDisconnected` para o link aberto nem para a
 *   conexão pendente que caíram, nem antes nem depois do `onBluetoothStateChanged(false)` que o transporte entrega em
 *   seguida. O transporte fica parado: um `disconnect()` depois disso e os callbacks atrasados do GATT fechado não
 *   emitem nada até um `connect()` novo. É o que o CoreBluetooth faz no iOS (`poweredOff` sem
 *   `didDisconnectPeripheral`) e o que o `FakeTransport` do Repo 1 já fazia. A gravação do fitGPS mostrou o porquê:
 *   antes desta regra o Android entregou três `onDisconnected` para um link só ao desligar o Bluetooth (o do link, o do
 *   `connect()` recusado e o do `disconnect()` seguinte; `corenext-export/logs-20261029-083254.jsonl`, export local
 *   fora do git por ter o MAC, linhas 101, 109 e 110, ts 1793272958357, 1793272958524 e 1793272958525). Com a contagem da ADR 12,
 *   essa ambiguidade pode fazer a sessão engolir uma queda real e ficar presa em `RECONNECTING`.
 * - Um `onDisconnected` que saiu antes do Bluetooth desligar (a pilha avisou a queda do link antes do broadcast
 *   `STATE_OFF`) é uma queda comum: já saiu, e o [bluetoothOff] seguinte não emite outro.
 * - `connect()` recusado na hora ([connectRejected]: Bluetooth desligado, sem `BLUETOOTH_CONNECT`, MAC inválido) emite
 *   exatamente um `onDisconnected` e deixa o transporte parado.
 * - Callback de um `BluetoothGatt` já fechado ([generation] antiga) não emite nada.
 *
 * Não é thread-safe de propósito: só a thread do GATT usa, como a [GattQueue].
 */
internal class LinkLifecycle(private val output: Output) {
	/** Destino dos eventos de ciclo de vida; no transporte, o `TransportEvents` da sessão. */
	interface Output {
		fun onConnected()

		fun onDisconnected(status: Int, message: String)
	}

	/** O que fazer com um `STATE_DISCONNECTED` do GATT; o evento, quando há, já saiu pelo [Output]. */
	enum class LinkDown {
		/** Callback de um GATT já fechado: nada a fazer. */
		STALE,

		/** Link que chegou a conectar caiu sem pedido: saiu `onDisconnected` e o transporte parou. */
		LOST,

		/** Conexão direta que nunca conectou: saiu `onDisconnected` e o transporte parou. */
		CONNECT_FAILED,

		/** Conexão pendente que nunca conectou: nenhum evento; o transporte re-arma. */
		PENDING_FAILED,
	}

	/** Geração do `BluetoothGatt` atual; muda a cada GATT aberto ou fechado. Callback de outra geração é atrasado. */
	var generation: Int = 0
		private set

	/** O GATT atual passou por `STATE_CONNECTED` e ainda não caiu nem foi fechado. */
	var linkConnected: Boolean = false
		private set

	/** Há link aberto ou conexão pendente (inclusive re-arme agendado) que um `disconnect()` encerra com evento. */
	var active: Boolean = false
		private set

	/** A conexão atual é pendente (`autoConnect = true`), a única que se re-arma. */
	var autoReconnect: Boolean = false
		private set

	fun isCurrent(gattGeneration: Int): Boolean = gattGeneration == generation

	/**
	 * `connect()` aceito, depois de o transporte fechar o GATT anterior. Um link que estava aberto sai como
	 * `onDisconnected(0)`; uma conexão pendente substituída não gera evento (nunca houve `onConnected`).
	 */
	fun connectAccepted(autoReconnect: Boolean) {
		val replaced = linkConnected
		invalidate()
		active = true
		this.autoReconnect = autoReconnect
		if (replaced) output.onDisconnected(GattStatus.SUCCESS, "Link replaced by a new connect")
	}

	/** `connect()` recusado antes de abrir GATT. Fecha o que houver e emite exatamente um `onDisconnected`. */
	fun connectRejected(status: Int, message: String) {
		stop()
		output.onDisconnected(status, message)
	}

	/** Um `BluetoothGatt` novo vai ser aberto: devolve a geração que os callbacks dele carregam. */
	fun gattOpening(): Int {
		invalidate()
		return generation
	}

	/** `connectGatt` devolveu `null`: falha de conexão, sai `onDisconnected` se havia tentativa, e o transporte para. */
	fun openFailed(status: Int) {
		val wasActive = active
		stop()
		if (wasActive) output.onDisconnected(status, "connectGatt failed")
	}

	/** `STATE_CONNECTED`. Só o GATT atual conta; o atrasado é ignorado. */
	fun linkUp(gattGeneration: Int) {
		if (!isCurrent(gattGeneration) || !active) return
		linkConnected = true
		output.onConnected()
	}

	/** `STATE_DISCONNECTED` de um GATT. O transporte fecha esse GATT; o que vier depois dele é atrasado. */
	fun linkDown(gattGeneration: Int, status: Int): LinkDown {
		if (!isCurrent(gattGeneration) || !active) return LinkDown.STALE
		val wasConnected = linkConnected
		invalidate()
		return when {
			wasConnected -> {
				stop()
				output.onDisconnected(status, "Link lost (status=$status)")
				LinkDown.LOST
			}
			!autoReconnect -> {
				stop()
				output.onDisconnected(status, "Connect failed (status=$status)")
				LinkDown.CONNECT_FAILED
			}
			else -> LinkDown.PENDING_FAILED
		}
	}

	/**
	 * `disconnect()`, depois de o transporte fechar o GATT e cancelar re-arme e scan.
	 *
	 * @return se havia link aberto ou conexão pendente (e por isso saiu `onDisconnected(0)`).
	 */
	fun disconnectRequested(): Boolean {
		val wasActive = active
		stop()
		if (wasActive) output.onDisconnected(GattStatus.SUCCESS, "Disconnected on request")
		return wasActive
	}

	/**
	 * Bluetooth do telefone desligou, depois de o transporte fechar o GATT e cancelar re-arme e scan. Não emite nada
	 * (contrato B, no KDoc da classe); o transporte entrega `onBluetoothStateChanged(false)` logo depois.
	 *
	 * @return se havia link aberto ou conexão pendente, só para o log.
	 */
	fun bluetoothOff(): Boolean {
		val wasActive = active
		stop()
		return wasActive
	}

	private fun stop() {
		invalidate()
		active = false
	}

	private fun invalidate() {
		generation++
		linkConnected = false
	}
}

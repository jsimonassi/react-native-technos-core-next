package br.com.grupotechnos.corenext.ble

/**
 * Decide o que fazer em cada evento de um pedido de vínculo Bluetooth clássico (BR/EDR), em Kotlin puro (testado na JVM,
 * `ClassicBondTrackerTest`). Quem executa as ações é o [ClassicBonder], na thread principal.
 *
 * Uma tentativa é um `createBond`. Ela falha quando:
 * - o `createBond` não começa ([onCreateBondReturned] com `false`);
 * - o estado volta para `BOND_NONE` depois de `BOND_BONDING` ([onBondState]): diálogo recusado, chave recusada pelo
 *   relógio ou a primeira tentativa que a pilha derruba (no HCI de 2026-10-31, a primeira tentativa do app Condor, às
 *   15:43:08, falhou com status `0x06` antes de o diálogo aparecer; a segunda, às 15:43:15-18, mostrou o diálogo e fechou
 *   o vínculo);
 * - o prazo da tentativa vence ([onAttemptTimeout]).
 *
 * Na primeira falha a resposta é [Action.RetryAfter] ([RETRY_DELAY_MS]); quando as [maxAttempts] tentativas acabam,
 * [Action.Fail]. `BOND_BONDED` em qualquer momento é [Action.Success]. Depois de [Action.Success] ou [Action.Fail] todo
 * evento vira [Action.Wait] (o pedido acabou e só resta desregistrar o receiver).
 *
 * Não é thread-safe: o [ClassicBonder] chama tudo na thread principal.
 *
 * @param maxAttempts tentativas por pedido, contando a primeira (o `CoreHost` promete uma nova tentativa automática).
 */
internal class ClassicBondTracker(private val maxAttempts: Int = DEFAULT_MAX_ATTEMPTS) {
	/** O que o [ClassicBonder] faz depois de um evento. */
	sealed interface Action {
		/** Nada a fazer: a tentativa continua (ou o pedido já acabou). */
		data object Wait : Action

		/** A tentativa falhou e ainda há outra: chamar `createBond` de novo depois de [delayMs]. */
		data class RetryAfter(val delayMs: Long) : Action

		/** O sistema tem o vínculo. */
		data object Success : Action

		/** As tentativas acabaram; [reason] descreve a última falha (vai para o log e para a mensagem do `onError`). */
		data class Fail(val reason: String) : Action
	}

	/** Número da tentativa atual, a partir de 1. */
	var attempt: Int = 1
		private set

	/** `true` depois de [Action.Success] ou [Action.Fail]. */
	var finished: Boolean = false
		private set

	/** Resultado do `createBond` da tentativa atual: `false` quando o sistema recusou o pedido na hora. */
	fun onCreateBondReturned(started: Boolean): Action {
		if (finished) return Action.Wait
		return if (started) Action.Wait else attemptFailed("createBond was refused")
	}

	/**
	 * Mudança de estado vinda do `ACTION_BOND_STATE_CHANGED` do relógio.
	 *
	 * @param newState `EXTRA_BOND_STATE` ([BOND_NONE], [BOND_BONDING] ou [BOND_BONDED]).
	 * @param previousState `EXTRA_PREVIOUS_BOND_STATE`.
	 * @param reason extra oculto `android.bluetooth.device.extra.REASON`, ou `null`. Não muda a decisão nem o texto da
	 * falha: o [ClassicBonder] o escreve só no log.
	 */
	fun onBondState(newState: Int, previousState: Int, reason: Int?): Action {
		if (finished) return Action.Wait
		return when {
			newState == BOND_BONDED -> {
				finished = true
				Action.Success
			}

			// O motivo fica fora do texto: ele vai para a mensagem do onError, e o código oculto só para o log (ClassicBonder).
			newState == BOND_NONE && previousState == BOND_BONDING -> attemptFailed("bond state went from BONDING to NONE")

			else -> Action.Wait
		}
	}

	/** O prazo da tentativa atual venceu sem `BOND_BONDED`. */
	fun onAttemptTimeout(): Action {
		if (finished) return Action.Wait
		return attemptFailed("attempt timed out")
	}

	private fun attemptFailed(reason: String): Action {
		if (attempt < maxAttempts) {
			attempt++
			return Action.RetryAfter(RETRY_DELAY_MS)
		}
		finished = true
		return Action.Fail("$reason (attempt $attempt of $maxAttempts)")
	}

	companion object {
		const val DEFAULT_MAX_ATTEMPTS = 2

		/** Espera antes da nova tentativa, para a pilha encerrar a anterior (no HCI, o app Condor tentou de novo 7 s depois). */
		const val RETRY_DELAY_MS = 1_500L

		/** `BluetoothDevice.BOND_NONE`, repetido aqui para o rastreador não depender do SDK Android. */
		const val BOND_NONE = 10

		/** `BluetoothDevice.BOND_BONDING`. */
		const val BOND_BONDING = 11

		/** `BluetoothDevice.BOND_BONDED`. */
		const val BOND_BONDED = 12
	}
}

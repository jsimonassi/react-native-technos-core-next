package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDED
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDING
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_NONE

/**
 * Decide o que o esquecer faz com o vínculo Bluetooth clássico do sistema, em Kotlin puro (testado na JVM,
 * `ClassicBondRemovalTest`). Quem executa é o [ClassicBonder], na thread principal.
 *
 * Os dois casos de borda que pedem mais que um `removeBond()`:
 * - **Bluetooth desligado.** O `BluetoothDevice.getBondState()` devolve `BOND_NONE` quando o serviço Bluetooth não está
 *   de pé, sem olhar o vínculo, e o `removeBond()` devolve `false`. Sem cuidado, o esquecer registraria "sem vínculo" e o
 *   vínculo ficaria: ao religar o Bluetooth, o P85 reabre a conexão clássica com a chave guardada (HCI de 2026-10-31,
 *   15:46:27.442-.756) e chamadas e música voltam para um relógio esquecido. Então a remoção fica pendente
 *   ([Step.WAIT_FOR_BLUETOOTH]) e roda quando o Bluetooth liga.
 * - **Vínculo em curso** (`BOND_BONDING`, o diálogo do sistema aberto). A pilha só remove um vínculo em `BOND_BONDED`:
 *   o `removeBond()` é recusado. O [ClassicBonder] tenta `cancelBondProcess()` e continua vigiando o endereço
 *   ([Step.CANCEL_AND_WATCH]); se o usuário aceitar o diálogo mesmo assim, o `BOND_BONDED` que chega vira [Step.REMOVE].
 */
internal object ClassicBondRemoval {
	/** Próximo passo da remoção de um endereço. */
	enum class Step {
		/** Bluetooth desligado: guardar a remoção e tentar de novo quando ele ligar. */
		WAIT_FOR_BLUETOOTH,

		/** Nada no sistema: a remoção acabou. */
		NOTHING_TO_REMOVE,

		/** Vínculo em curso: cancelar o processo e continuar vigiando o endereço. */
		CANCEL_AND_WATCH,

		/** Vínculo feito: `removeBond()`, e a remoção acabou. */
		REMOVE,

		/** Estado intermediário de um endereço vigiado: esperar o próximo. */
		KEEP_WATCHING,
	}

	/** Passo do esquecer (ou da retomada de uma remoção pendente) com o adaptador e o estado lidos agora. */
	fun decide(bluetoothEnabled: Boolean, bondState: Int): Step = when {
		!bluetoothEnabled -> Step.WAIT_FOR_BLUETOOTH
		bondState == BOND_BONDED -> Step.REMOVE
		bondState == BOND_BONDING -> Step.CANCEL_AND_WATCH
		else -> Step.NOTHING_TO_REMOVE
	}

	/** Passo de um `ACTION_BOND_STATE_CHANGED` de um endereço com remoção pendente. */
	fun onBondState(newState: Int): Step = when (newState) {
		BOND_BONDED -> Step.REMOVE
		BOND_NONE -> Step.NOTHING_TO_REMOVE
		else -> Step.KEEP_WATCHING
	}
}

/**
 * Endereços esquecidos cujo vínculo clássico ainda não saiu do sistema, guardados entre processos (o [ClassicBonder]
 * passa as preferências em [load] e [save]). Kotlin puro, testado na JVM. Endereços comparados sem caixa. Não é
 * thread-safe: o [ClassicBonder] usa só na thread principal.
 *
 * Um endereço sai daqui quando a remoção acaba ([ClassicBondRemoval.Step.REMOVE] ou
 * [ClassicBondRemoval.Step.NOTHING_TO_REMOVE]) ou quando o app volta a pedir o vínculo com ele (o usuário pareou o
 * relógio de novo).
 */
internal class PendingBondRemovals(
	private val load: () -> Set<String>,
	private val save: (Set<String>) -> Unit,
) {
	private val addresses: MutableSet<String> by lazy { load().map { it.uppercase() }.toMutableSet() }

	/** Os endereços pendentes, numa cópia. */
	fun all(): Set<String> = addresses.toSet()

	fun isEmpty(): Boolean = addresses.isEmpty()

	operator fun contains(address: String): Boolean = address.uppercase() in addresses

	/** Guarda [address]; grava só se mudou. */
	fun add(address: String) {
		if (addresses.add(address.uppercase())) save(addresses.toSet())
	}

	/** Tira [address]; grava só se mudou. */
	fun remove(address: String) {
		if (addresses.remove(address.uppercase())) save(addresses.toSet())
	}
}

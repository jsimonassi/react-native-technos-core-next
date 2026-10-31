package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.corenext.ble.ClassicBondRemoval.Step
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDED
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDING
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_NONE
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * O esquecer e o vínculo clássico do sistema: Bluetooth desligado (o `getBondState()` mente `BOND_NONE`), vínculo em
 * curso (o `removeBond()` é recusado) e a lista de remoções pendentes que sobrevive ao processo.
 */
class ClassicBondRemovalTest {
	@Test
	fun bluetoothOffWaitsWhateverTheReportedState() {
		// Com o adaptador desligado, BOND_NONE não quer dizer "sem vínculo".
		for (state in listOf(BOND_NONE, BOND_BONDING, BOND_BONDED)) {
			assertEquals(Step.WAIT_FOR_BLUETOOTH, ClassicBondRemoval.decide(bluetoothEnabled = false, bondState = state))
		}
	}

	@Test
	fun bluetoothOnRemovesCancelsOrFinishes() {
		assertEquals(Step.REMOVE, ClassicBondRemoval.decide(bluetoothEnabled = true, bondState = BOND_BONDED))
		assertEquals(Step.CANCEL_AND_WATCH, ClassicBondRemoval.decide(bluetoothEnabled = true, bondState = BOND_BONDING))
		assertEquals(Step.NOTHING_TO_REMOVE, ClassicBondRemoval.decide(bluetoothEnabled = true, bondState = BOND_NONE))
	}

	@Test
	fun watchedAddressIsRemovedIfTheDialogIsAcceptedAfterTheForget() {
		assertEquals(Step.KEEP_WATCHING, ClassicBondRemoval.onBondState(BOND_BONDING))
		assertEquals(Step.REMOVE, ClassicBondRemoval.onBondState(BOND_BONDED))
		assertEquals(Step.NOTHING_TO_REMOVE, ClassicBondRemoval.onBondState(BOND_NONE))
	}

	@Test
	fun pendingRemovalsSurviveAProcessAndIgnoreCase() {
		var stored: Set<String> = emptySet()
		var saves = 0
		val first = PendingBondRemovals(load = { stored }, save = { stored = it; saves++ })
		assertTrue(first.isEmpty())
		first.add("aa:bb:cc:dd:ee:ff")
		first.add("AA:BB:CC:DD:EE:FF")
		assertEquals(1, saves, "the same address in another case is not saved twice")
		assertEquals(setOf("AA:BB:CC:DD:EE:FF"), stored)

		// Processo novo: a remoção continua pendente.
		val second = PendingBondRemovals(load = { stored }, save = { stored = it; saves++ })
		assertTrue("aa:bb:cc:dd:ee:ff" in second)
		assertEquals(setOf("AA:BB:CC:DD:EE:FF"), second.all())
		second.remove("aa:bb:cc:dd:ee:ff")
		assertFalse("AA:BB:CC:DD:EE:FF" in second)
		assertEquals(emptySet(), stored)
		second.remove("AA:BB:CC:DD:EE:FF")
		assertEquals(2, saves, "removing an absent address does not save")
	}
}

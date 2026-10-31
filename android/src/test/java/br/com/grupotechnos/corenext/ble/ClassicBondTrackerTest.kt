package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Action
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDED
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_BONDING
import br.com.grupotechnos.corenext.ble.ClassicBondTracker.Companion.BOND_NONE
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertTrue

/**
 * Regras do pedido de vínculo clássico, na ordem de eventos que o Android entrega (`createBond`, depois
 * `ACTION_BOND_STATE_CHANGED`). Os casos seguem o HCI de 2026-10-31: a primeira tentativa do app Condor caiu antes do
 * diálogo e a segunda, com o diálogo aceito, fechou o vínculo.
 */
class ClassicBondTrackerTest {
	@Test
	fun bondedAfterTheDialogIsSuccess() {
		val tracker = ClassicBondTracker()
		assertEquals(Action.Wait, tracker.onCreateBondReturned(started = true))
		assertEquals(Action.Wait, tracker.onBondState(BOND_BONDING, BOND_NONE, null))
		assertEquals(Action.Success, tracker.onBondState(BOND_BONDED, BOND_BONDING, null))
		assertTrue(tracker.finished)
		assertEquals(1, tracker.attempt)
	}

	@Test
	fun noneAfterBondingRetriesOnceAfterTheDelay() {
		val tracker = ClassicBondTracker()
		tracker.onCreateBondReturned(started = true)
		tracker.onBondState(BOND_BONDING, BOND_NONE, null)
		assertEquals(Action.RetryAfter(ClassicBondTracker.RETRY_DELAY_MS), tracker.onBondState(BOND_NONE, BOND_BONDING, 9))
		assertEquals(2, tracker.attempt)
		assertFalse(tracker.finished)
		// A segunda tentativa, com o diálogo aceito.
		assertEquals(Action.Wait, tracker.onCreateBondReturned(started = true))
		assertEquals(Action.Wait, tracker.onBondState(BOND_BONDING, BOND_NONE, null))
		assertEquals(Action.Success, tracker.onBondState(BOND_BONDED, BOND_BONDING, null))
	}

	@Test
	fun secondFailureGivesUpWithTheReason() {
		val tracker = ClassicBondTracker()
		tracker.onCreateBondReturned(started = true)
		tracker.onBondState(BOND_BONDING, BOND_NONE, null)
		assertIs<Action.RetryAfter>(tracker.onBondState(BOND_NONE, BOND_BONDING, null))
		tracker.onCreateBondReturned(started = true)
		tracker.onBondState(BOND_BONDING, BOND_NONE, null)
		val fail = assertIs<Action.Fail>(tracker.onBondState(BOND_NONE, BOND_BONDING, 13))
		// O código do motivo (extra oculto) não entra no texto, que vai para o onError.
		assertEquals("bond state went from BONDING to NONE (attempt 2 of 2)", fail.reason)
		assertTrue(tracker.finished)
		// Eventos atrasados depois do fim não mudam nada.
		assertEquals(Action.Wait, tracker.onBondState(BOND_BONDED, BOND_BONDING, null))
		assertEquals(Action.Wait, tracker.onAttemptTimeout())
	}

	@Test
	fun timeoutCountsAsAFailedAttempt() {
		val tracker = ClassicBondTracker()
		tracker.onCreateBondReturned(started = true)
		assertEquals(Action.RetryAfter(ClassicBondTracker.RETRY_DELAY_MS), tracker.onAttemptTimeout())
		tracker.onCreateBondReturned(started = true)
		val fail = assertIs<Action.Fail>(tracker.onAttemptTimeout())
		assertEquals("attempt timed out (attempt 2 of 2)", fail.reason)
	}

	@Test
	fun alreadyBondedIsSuccessAtTheFirstEvent() {
		val tracker = ClassicBondTracker()
		assertEquals(Action.Success, tracker.onBondState(BOND_BONDED, BOND_BONDED, null))
		assertTrue(tracker.finished)
	}

	@Test
	fun refusedCreateBondFailsTheAttempt() {
		val tracker = ClassicBondTracker()
		assertEquals(Action.RetryAfter(ClassicBondTracker.RETRY_DELAY_MS), tracker.onCreateBondReturned(started = false))
		val fail = assertIs<Action.Fail>(tracker.onCreateBondReturned(started = false))
		assertEquals("createBond was refused (attempt 2 of 2)", fail.reason)
	}

	@Test
	fun noneWithoutBondingIsNotAFailure() {
		// O primeiro broadcast pode chegar com NONE -> NONE (o sistema limpou um estado antigo); só BONDING -> NONE conta.
		val tracker = ClassicBondTracker()
		tracker.onCreateBondReturned(started = true)
		assertEquals(Action.Wait, tracker.onBondState(BOND_NONE, BOND_NONE, null))
		assertEquals(1, tracker.attempt)
	}

	@Test
	fun oneAttemptOnlyFailsAtTheFirstFailure() {
		val tracker = ClassicBondTracker(maxAttempts = 1)
		assertIs<Action.Fail>(tracker.onAttemptTimeout())
	}
}

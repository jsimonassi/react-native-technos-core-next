package br.com.grupotechnos.corenext

import br.com.grupotechnos.corenext.ble.ClassicBonder
import br.com.grupotechnos.corenext.log.RingLogger
import br.com.grupotechnos.corenext.store.PairingPrefs
import br.com.grupotechnos.watch.bridge.ClassicBondResult
import br.com.grupotechnos.watch.bridge.CoreLogEntry
import br.com.grupotechnos.watch.bridge.CorePairing
import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.LogLevel
import org.junit.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * As partes do [AndroidCoreHost] que rodam sem Android: o nome da permissão que vai na mensagem do `CoreBridge` e as
 * conversões entre os tipos de `log/`/`store/` e os do `:bridge`. Os campos são quase todos `String`; valores distintos
 * em cada um pegam uma troca de campo que o compilador não pegaria.
 */
class AndroidCoreHostTest {
	@Test
	fun connectPermissionGivesTheMessageOfTheOldHost() {
		assertNull(missingPermission(granted = true, name = AndroidCoreHost.CONNECT_PERMISSION))
		val missing = missingPermission(granted = false, name = AndroidCoreHost.CONNECT_PERMISSION)
		// O CoreBridge monta "Missing $permissão"; o módulo antigo escrevia o literal "Missing BLUETOOTH_CONNECT".
		assertEquals("Missing BLUETOOTH_CONNECT", "Missing $missing")
	}

	@Test
	fun scanPermissionNameGoesThroughAsIs() {
		assertNull(missingPermission(granted = true, name = "android.permission.BLUETOOTH_SCAN"))
		assertEquals("android.permission.BLUETOOTH_SCAN", missingPermission(granted = false, name = "android.permission.BLUETOOTH_SCAN"))
	}

	@Test
	fun ringEntryKeepsEveryFieldInTheBridgeEntry() {
		val frame = RingLogger.Entry(
			ts = 1_793_272_450_933L,
			level = LogLevel.DEBUG,
			tag = "Frame/6e400003",
			message = "ack len=8",
			dir = FrameDirection.RX,
			hex = "AB000003",
		)
		assertEquals(
			CoreLogEntry(ts = 1_793_272_450_933L, level = LogLevel.DEBUG, tag = "Frame/6e400003", message = "ack len=8", dir = FrameDirection.RX, hex = "AB000003"),
			frame.toCoreLogEntry(),
		)
		val line = RingLogger.Entry(ts = 7L, level = LogLevel.WARN, tag = "T/m", message = "text", dir = null, hex = null)
		assertEquals(CoreLogEntry(ts = 7L, level = LogLevel.WARN, tag = "T/m", message = "text", dir = null, hex = null), line.toCoreLogEntry())
		assertEquals(FrameDirection.TX, frame.copy(dir = FrameDirection.TX).toCoreLogEntry().dir)
	}

	@Test
	fun pairingRoundTripsWithoutSwappingTheStrings() {
		val saved = PairingPrefs.Pairing(address = "AA:BB:CC:DD:EE:FF", profileId = "fitgps", name = "fitGPS")
		val bridge = saved.toCorePairing()
		assertEquals(CorePairing(address = "AA:BB:CC:DD:EE:FF", profileId = "fitgps", name = "fitGPS"), bridge)
		assertEquals(saved, bridge.toPrefsPairing())
		// O PairingPrefs devolve "" quando a chave do nome não foi gravada; passa adiante como está.
		assertEquals("", PairingPrefs.Pairing("AA:BB:CC:DD:EE:FF", "fitgps", "").toCorePairing().name)
	}

	@Test
	fun classicBondOutcomeMapsToTheBridgeResult() {
		// O Android só tem vínculo ou falha; UNSUPPORTED é do iOS.
		assertEquals(ClassicBondResult.BONDED, ClassicBonder.Outcome.BONDED.toClassicBondResult())
		assertEquals(ClassicBondResult.FAILED, ClassicBonder.Outcome.FAILED.toClassicBondResult())
	}
}

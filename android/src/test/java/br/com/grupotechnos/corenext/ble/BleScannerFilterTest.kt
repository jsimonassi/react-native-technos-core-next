package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.profile.DeviceRegistry
import br.com.grupotechnos.watch.protocol.profile.Profiles
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Os filtros de scan saem dos perfis do Repo 1: o fitGPS e o Life Ultra GPS (iDO) entram sem código por família. */
class BleScannerFilterTest {
	@Test
	fun filtersCoverEveryProfileNameAndService() {
		val spec = BleScanner.filterSpec()
		assertEquals(listOf("Mormaii_fitGPS", "Life Ultra GPS", "Smart Watch 6010"), spec.names)
		assertTrue("00000af0-0000-1000-8000-00805f9b34fb" in spec.services, "iDO service: ${spec.services}")
		assertTrue("6e400001-b5a3-f393-e0a9-e50e24dcca9e" in spec.services, "NUS: ${spec.services}")
		assertEquals(spec.services.distinct(), spec.services)
	}

	@Test
	fun advertisedNamesResolveToTheirProfiles() {
		assertEquals("lifeultragps", DeviceRegistry.identify("Life Ultra GPS", emptyList())?.id)
		assertEquals("lifeultragps", DeviceRegistry.identify("Smart Watch 6010", emptyList())?.id)
		assertEquals("fitgps", DeviceRegistry.identify("Mormaii_fitGPS", emptyList())?.id)
		assertEquals("Life Ultra GPS", Profiles.MORMAII_LIFE_ULTRA_GPS.appName)
	}
}

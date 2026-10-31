package br.com.grupotechnos.corenext.ble

import br.com.grupotechnos.watch.protocol.profile.DeviceRegistry
import br.com.grupotechnos.watch.protocol.profile.Profiles
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Os filtros de scan saem dos perfis do Repo 1: o fitGPS, o Life Ultra GPS (iDO) e o Condor Reebok (CRP) entram sem
 * código por família.
 */
class BleScannerFilterTest {
	@Test
	fun filtersCoverEveryProfileNameAndService() {
		val spec = BleScanner.filterSpec()
		assertEquals(listOf("Mormaii_fitGPS", "Life Ultra GPS", "Smart Watch 6010", "P85", "Condor Reebok"), spec.names)
		assertTrue("00000af0-0000-1000-8000-00805f9b34fb" in spec.services, "iDO service: ${spec.services}")
		assertTrue("6e400001-b5a3-f393-e0a9-e50e24dcca9e" in spec.services, "NUS: ${spec.services}")
		assertTrue("0000feea-0000-1000-8000-00805f9b34fb" in spec.services, "CRP service: ${spec.services}")
		assertEquals(spec.services.distinct(), spec.services)
	}

	@Test
	fun aProfileWithNamePrefixesLeavesTheScanUnfiltered() {
		// O ScanFilter só compara nome exato; o P85 é aceito por prefixo, então o scan sai sem filtro.
		assertTrue(BleScanner.filterSpec().unfiltered)
		assertTrue(BleScanner.filterSpec(listOf(Profiles.CONDOR_REEBOK)).unfiltered)
		assertFalse(BleScanner.filterSpec(listOf(Profiles.MORMAII_FIT_GPS, Profiles.MORMAII_LIFE_ULTRA_GPS)).unfiltered)
	}

	@Test
	fun p85NamesResolveToCondorReebok() {
		for (name in listOf("P85", "P85 ", "P85-1234", "Condor Reebok", " P85\u0000")) {
			assertEquals("condorreebok", DeviceRegistry.identify(name, emptyList())?.id, "name '$name'")
		}
		assertNull(DeviceRegistry.identify("P8", emptyList()))
		assertNull(DeviceRegistry.identify("XP85", emptyList()))
		assertEquals("Condor Reebok", Profiles.CONDOR_REEBOK.appName)
	}

	@Test
	fun advertisedNamesResolveToTheirProfiles() {
		assertEquals("lifeultragps", DeviceRegistry.identify("Life Ultra GPS", emptyList())?.id)
		assertEquals("lifeultragps", DeviceRegistry.identify("Smart Watch 6010", emptyList())?.id)
		assertEquals("fitgps", DeviceRegistry.identify("Mormaii_fitGPS", emptyList())?.id)
		assertEquals("Life Ultra GPS", Profiles.MORMAII_LIFE_ULTRA_GPS.appName)
	}
}

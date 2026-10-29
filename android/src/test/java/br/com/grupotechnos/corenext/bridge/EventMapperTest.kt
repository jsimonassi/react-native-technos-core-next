package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.Battery
import br.com.grupotechnos.watch.protocol.domain.ConnectionState
import br.com.grupotechnos.watch.protocol.domain.DeviceInfo
import br.com.grupotechnos.watch.protocol.domain.SleepSession
import br.com.grupotechnos.watch.protocol.domain.SleepStage
import br.com.grupotechnos.watch.protocol.domain.SleepStageType
import br.com.grupotechnos.watch.protocol.domain.StepsDay
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.profile.Profiles
import org.junit.Test
import java.time.ZoneId
import kotlin.test.assertEquals

/** Formatos de `src/types/events.ts`: nomes de campo, tipos e datas. */
class EventMapperTest {
	private val saoPaulo = ZoneId.of("America/Sao_Paulo")

	private val info = DeviceInfo(
		profileId = "fitgps",
		address = "AA:BB:CC:DD:EE:FF",
		bleName = "Mormaii_fitGPS",
		firmware = "1.2.3",
		bleVersion = null,
	)

	@Test
	fun scannedDeviceUsesAppNameAsName() {
		val event = EventMapper.scannedDevice(Profiles.MORMAII_FIT_GPS, "AA:BB:CC:DD:EE:FF", -61, "Mormaii_fitGPS")
		assertEquals(
			mapOf(
				"name" to "fitGPS",
				"deviceId" to "AA:BB:CC:DD:EE:FF",
				"rssi" to -61,
				"bleName" to "Mormaii_fitGPS",
				"profileId" to "fitgps",
			),
			event,
		)
	}

	@Test
	fun connectStateChangedCarriesCodeSessionStateAndPhase() {
		assertEquals(
			mapOf("state" to 1, "sessionState" to "HANDSHAKING", "phase" to "BIND"),
			EventMapper.connectStateChanged(ConnectionState.HANDSHAKING, "BIND"),
		)
		assertEquals(
			mapOf("state" to 2, "sessionState" to "READY", "phase" to null),
			EventMapper.connectStateChanged(ConnectionState.READY, null),
		)
	}

	@Test
	fun deviceInfoAndFirmwareInfo() {
		assertEquals(
			mapOf(
				"deviceId" to "AA:BB:CC:DD:EE:FF",
				"profileId" to "fitgps",
				"bleName" to "Mormaii_fitGPS",
				"firmware" to "1.2.3",
				"bleVersion" to null,
			),
			EventMapper.deviceInfo(info),
		)
		assertEquals(
			mapOf("version" to "1.2.3", "braceletType" to 0, "platformCode" to 0, "deviceId" to "AA:BB:CC:DD:EE:FF"),
			EventMapper.firmwareInfo(info),
		)
	}

	@Test
	fun batteryKeepsLegacyStringField() {
		assertEquals(
			mapOf("percentage" to 85, "charging" to false, "battery" to "85%"),
			EventMapper.battery(Battery(85)),
		)
	}

	@Test
	fun pedometerAndHistoryPedometer() {
		val day = StepsDay("2026-10-28", "2026-10-28T00:00:00-03:00", steps = 4321, calories = 150, distanceMeters = 3012.5)
		assertEquals(
			mapOf("pedometer" to 4321, "calorie" to 150, "distance" to 3012.5, "date" to "2026-10-28T00:00:00-03:00"),
			EventMapper.pedometer(day),
		)
		assertEquals(
			mapOf(
				"historypedometer" to listOf(
					mapOf("date" to "2026-10-28T00:00:00-03:00", "distance" to 3012.5, "calorie" to 150, "pedometer" to 4321),
				),
			),
			EventMapper.historyPedometer(listOf(day)),
		)
		assertEquals(mapOf("historypedometer" to emptyList<Any?>()), EventMapper.historyPedometer(emptyList()))
	}

	@Test
	fun historySleepUsesStartOfWakeUpDayAndEmptyRespiratoryRate() {
		val stage = SleepStage(
			type = SleepStageType.DEEP,
			startEpochMillis = 0,
			endEpochMillis = 0,
			startIso = "2026-10-28T01:00:00-03:00",
			endIso = "2026-10-28T02:30:00-03:00",
		)
		val session = SleepSession(
			dayKey = "2026-10-28",
			startEpochMillis = 0,
			endEpochMillis = 0,
			startIso = "2026-10-27T23:10:00-03:00",
			endIso = "2026-10-28T06:40:00-03:00",
			stages = listOf(stage),
			totalMinutes = 450,
			lightMinutes = 300,
			deepMinutes = 120,
			remMinutes = 0,
			awakeMinutes = 30,
		)
		val event = EventMapper.historySleep(listOf(session), saoPaulo)
		assertEquals(
			mapOf(
				"historysleep" to listOf(
					mapOf(
						"date" to "2026-10-28T00:00:00-03:00",
						"sleep" to mapOf(
							"start" to "2026-10-27T23:10:00-03:00",
							"end" to "2026-10-28T06:40:00-03:00",
							"items" to listOf(
								mapOf("typeItem" to 3, "startItem" to "2026-10-28T01:00:00-03:00", "endItem" to "2026-10-28T02:30:00-03:00"),
							),
							"respiratoryRateItems" to emptyList<Any?>(),
							"totalSleepMinutes" to 450,
							"lightSleepMinutes" to 300,
							"deepSleepMinutes" to 120,
							"remSleepMinutes" to 0,
							"wakeUpMinutes" to 30,
						),
					),
				),
			),
			event,
		)
	}

	@Test
	fun syncErrorAndLogShapes() {
		assertEquals(emptyMap(), EventMapper.empty())
		assertEquals(mapOf("progress" to 50), EventMapper.syncProgress(50))
		assertEquals(mapOf("progress" to 100), EventMapper.syncProgress(140))
		assertEquals(
			mapOf("requestId" to 7, "code" to "TIMEOUT", "message" to "no ack", "method" to "getBatteryStatus"),
			EventMapper.error(7, "TIMEOUT", "no ack", "getBatteryStatus"),
		)
		assertEquals(
			mapOf(
				"ts" to 1_793_208_600_000.0,
				"level" to "DEBUG",
				"tag" to "Frame/6e400002",
				"message" to "seq=1 03/01 BIND len=45",
				"dir" to "TX",
				"hex" to "AB00",
			),
			EventMapper.log(1_793_208_600_000L, LogLevel.DEBUG, "Frame/6e400002", "seq=1 03/01 BIND len=45", "TX", "AB00"),
		)
		assertEquals(
			mapOf("deviceId" to "AA:BB:CC:DD:EE:FF", "name" to "fitGPS", "profileId" to "fitgps"),
			EventMapper.lastPairedDevice("AA:BB:CC:DD:EE:FF", "fitGPS", "fitgps"),
		)
	}

	@Test
	fun startOfDayIsoFollowsTheZoneOffset() {
		assertEquals("2026-10-28T00:00:00-03:00", EventMapper.startOfDayIso("2026-10-28", saoPaulo))
		assertEquals("2026-10-28T00:00:00Z", EventMapper.startOfDayIso("2026-10-28", ZoneId.of("UTC")))
		assertEquals("2026-07-01T00:00:00+02:00", EventMapper.startOfDayIso("2026-07-01", ZoneId.of("Europe/Berlin")))
	}
}

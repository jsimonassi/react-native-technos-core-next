package br.com.grupotechnos.corenext.store

import br.com.grupotechnos.watch.protocol.domain.DataKind
import br.com.grupotechnos.watch.protocol.domain.MeasurementSample
import br.com.grupotechnos.watch.protocol.domain.SleepSession
import br.com.grupotechnos.watch.protocol.domain.SleepStage
import br.com.grupotechnos.watch.protocol.domain.SleepStageType
import br.com.grupotechnos.watch.protocol.domain.StepsSample
import br.com.grupotechnos.watch.protocol.domain.WorkoutOrigin
import br.com.grupotechnos.watch.protocol.domain.WorkoutRecord
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.NoopWatchLogger
import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Round-trip do [FileSampleStore] e tolerância a arquivo corrompido (org.json real via testImplementation). */
class FileSampleStoreTest {
	@get:Rule val folder = TemporaryFolder()

	private val steps = listOf(
		StepsSample(atEpochMillis = 1_793_156_400_000L, steps = 120, mode = 0, calories = 5, distanceMeters = 84.2),
		StepsSample(atEpochMillis = 1_793_160_000_000L, steps = 0, mode = 0, calories = 0, distanceMeters = 0.0),
	)

	private val sleep = listOf(
		SleepSession(
			dayKey = "2026-10-28",
			startEpochMillis = 1_793_138_400_000L,
			endEpochMillis = 1_793_163_600_000L,
			startIso = "2026-10-27T23:00:00-03:00",
			endIso = "2026-10-28T06:00:00-03:00",
			stages = listOf(
				SleepStage(SleepStageType.LIGHT, 1_793_138_400_000L, 1_793_142_000_000L, "2026-10-27T23:00:00-03:00", "2026-10-28T00:00:00-03:00"),
				SleepStage(SleepStageType.DEEP, 1_793_142_000_000L, 1_793_163_600_000L, "2026-10-28T00:00:00-03:00", "2026-10-28T06:00:00-03:00"),
			),
			totalMinutes = 420,
			lightMinutes = 60,
			deepMinutes = 360,
			remMinutes = 0,
			awakeMinutes = 0,
		),
	)

	@Test
	fun roundTripsEveryKind() {
		val dir = File(folder.root, "corenext")
		val store = FileSampleStore(dir, NoopWatchLogger)
		store.saveSteps(steps)
		store.saveSleep(sleep)
		store.saveConfirmedDays(DataKind.STEPS, listOf("2026-10-27", "2026-10-28"))
		store.saveConfirmedDays(DataKind.SLEEP, listOf("2026-10-28"))

		val reopened = FileSampleStore(dir, NoopWatchLogger)
		assertEquals(steps, reopened.loadSteps())
		assertEquals(sleep, reopened.loadSleep())
		assertEquals(listOf("2026-10-27", "2026-10-28"), reopened.loadConfirmedDays(DataKind.STEPS))
		assertEquals(listOf("2026-10-28"), reopened.loadConfirmedDays(DataKind.SLEEP))
		assertFalse(File(dir, "steps.json.tmp").exists(), "temp file must be renamed away")
	}

	@Test
	fun missingFilesAreEmpty() {
		val store = FileSampleStore(File(folder.root, "none"), NoopWatchLogger)
		assertEquals(emptyList(), store.loadSteps())
		assertEquals(emptyList(), store.loadSleep())
		assertEquals(emptyList(), store.loadConfirmedDays(DataKind.STEPS))
	}

	@Test
	fun corruptedFileBecomesEmptyWithWarning() {
		val dir = folder.newFolder("corenext")
		File(dir, FileSampleStore.STEPS_FILE).writeText("{not json")
		val logger = RecordingLogger()
		assertEquals(emptyList(), FileSampleStore(dir, logger).loadSteps())
		assertTrue(logger.levels.contains(LogLevel.WARN))
	}

	@Test
	fun invalidItemsAreSkippedNotTheWholeFile() {
		val text = """{"version":1,"items":[{"atEpochMillis":1,"steps":2,"mode":0,"calories":0,"distanceMeters":1.5},{"steps":"x"}]}"""
		val result = SampleJsonCodec.decodeSteps(text)
		assertEquals(listOf(StepsSample(1, 2, 0, 0, 1.5)), result.items)
		assertEquals(1, result.skipped)
	}

	@Test
	fun clearRemovesEverything() {
		val dir = File(folder.root, "corenext")
		val store = FileSampleStore(dir, NoopWatchLogger)
		store.saveSteps(steps)
		store.saveConfirmedDays(DataKind.STEPS, listOf("2026-10-28"))
		store.clear()
		assertEquals(emptyList(), store.loadSteps())
		assertEquals(emptyList(), store.loadConfirmedDays(DataKind.STEPS))
	}

	/** Fase 3 em stub (S0h): medições e treinos não vão a arquivo; as chaves confirmadas dos tipos novos já vão. */
	@Test
	fun phase3MeasurementsAndWorkoutsAreStubsThatLoadEmptyAndWriteNothing() {
		val dir = File(folder.root, "corenext")
		val logger = RecordingLogger()
		val store = FileSampleStore(dir, logger)
		val workout = WorkoutRecord(
			startEpochMillis = 1_793_615_400_000L,
			endEpochMillis = 1_793_617_200_000L,
			activeSeconds = 1750,
			sportType = 2,
			familySportType = 1,
			steps = 4000,
			distanceMeters = 3500,
			calories = 250,
			heartRates = listOf(90, 100, 0),
			heartRateIntervalSeconds = 10,
			origin = WorkoutOrigin.WATCH,
		)
		store.saveMeasurements(DataKind.HEART_RATE, listOf(MeasurementSample(1_793_631_600_000L, 72)))
		store.saveMeasurements(DataKind.STRESS, listOf(MeasurementSample(1_793_631_600_000L, 30)))
		store.saveWorkouts(listOf(workout))

		val reopened = FileSampleStore(dir, logger)
		assertEquals(emptyList(), reopened.loadMeasurements(DataKind.HEART_RATE))
		assertEquals(emptyList(), reopened.loadMeasurements(DataKind.STRESS))
		assertEquals(emptyList(), reopened.loadWorkouts())
		assertFalse(dir.exists(), "the stubs must not create files: ${dir.list()?.toList()}")
		assertEquals(
			listOf("saveMeasurements", "saveMeasurements", "saveWorkouts", "loadMeasurements", "loadMeasurements", "loadWorkouts"),
			logger.entries.map { (level, tag) ->
				assertEquals(LogLevel.DEBUG, level, tag)
				tag.removePrefix("FileSampleStore/")
			},
		)

		reopened.saveConfirmedDays(DataKind.HEART_RATE, listOf("2026-11-02T12"))
		reopened.saveConfirmedDays(DataKind.WORKOUTS, listOf("1793615400"))
		assertEquals(listOf("2026-11-02T12"), FileSampleStore(dir, NoopWatchLogger).loadConfirmedDays(DataKind.HEART_RATE))
		assertTrue(File(dir, "confirmed-heart_rate.json").exists())
		assertTrue(File(dir, "confirmed-workouts.json").exists())
		reopened.clear()
		assertEquals(emptyList(), dir.list()?.toList(), "clear must remove the confirmed keys of the new kinds")
	}

	private class RecordingLogger : WatchLogger {
		val levels = mutableListOf<LogLevel>()
		val entries = mutableListOf<Pair<LogLevel, String>>()

		override fun log(level: LogLevel, tag: String, message: String) {
			levels += level
			entries += level to tag
		}

		override fun frame(direction: FrameDirection, characteristic: String, value: ByteArray, summary: String) {}
	}
}

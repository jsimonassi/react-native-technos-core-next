package br.com.grupotechnos.corenext

import br.com.grupotechnos.corenext.bridge.ReadableConverter
import br.com.grupotechnos.watch.bridge.CoreBridge
import br.com.grupotechnos.watch.bridge.CoreHost
import br.com.grupotechnos.watch.bridge.CoreLogEntry
import br.com.grupotechnos.watch.bridge.CorePairing
import br.com.grupotechnos.watch.protocol.domain.DataKind
import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import br.com.grupotechnos.watch.protocol.session.InMemorySampleStore
import br.com.grupotechnos.watch.protocol.session.WatchSession
import br.com.grupotechnos.watch.protocol.transport.Transport
import br.com.grupotechnos.watch.protocol.transport.WriteType
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import org.junit.After
import org.junit.Before
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.util.TimeZone
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * O `deletedSavedData` de agora (o `ReadableArray` pelo [ReadableConverter] e o `CoreBridge` do Repo 1, sobre uma
 * `WatchSession` de verdade) contra o do módulo antigo, que fica aqui **copiado sem mudança** como oráculo: a leitura
 * item a item do `NativeCoreNextModule.kt` antigo (linhas 232-253 e 337-353) e o `SavedDataMapper.kt` antigo do
 * `bridge/`, com `java.time`. Só a saída mudou de forma: o módulo antigo logava e chamava a sessão; aqui o oráculo
 * devolve as linhas de log.
 *
 * O que se compara é o que o `deletedSavedData` deixa ver (ele não tem Promise nem evento): as linhas de log, em ordem,
 * com nível e mensagem iguais (a tag mudou de `NativeCoreNextModule/deletedSavedData` para
 * `CoreBridge/deletedSavedData`). A linha INFO `kind=... dayKeys=[...]` carrega exatamente o que vai para o
 * `confirmUploaded` (chamado quando a lista não é vazia, nos dois códigos). Arrays aleatórios com semente fixa, em três
 * fusos, com todo tipo de item: string, mapa com e sem `registered_at`/`category` de cada tipo, `null`, número,
 * booleano e array aninhado.
 */
class DeletedSavedDataEquivalenceTest {
	private class CapturingLogger : WatchLogger {
		private val lines = mutableListOf<Triple<LogLevel, String, String>>()

		override fun log(level: LogLevel, tag: String, message: String) {
			synchronized(lines) { lines += Triple(level, tag, message) }
		}

		override fun frame(direction: FrameDirection, characteristic: String, value: ByteArray, summary: String) {}

		fun take(tag: String): List<Pair<LogLevel, String>> = synchronized(lines) {
			val taken = lines.filter { it.second == tag }.map { it.first to it.third }
			lines.clear()
			taken
		}
	}

	private object NoopTransport : Transport {
		override fun connect(address: String, autoReconnect: Boolean) {}

		override fun disconnect() {}

		override fun discoverServices() {}

		override fun enableNotifications(service: String, characteristic: String, requestId: Int) {}

		override fun requestMtu(mtu: Int, requestId: Int) {}

		override fun write(service: String, characteristic: String, value: ByteArray, type: WriteType, requestId: Int) {}

		override fun read(service: String, characteristic: String, requestId: Int) {}
	}

	private object NoopHost : CoreHost {
		override fun missingScanPermission(): String? = null

		override fun missingConnectPermission(): String? = null

		override fun isBluetoothEnabled(): Boolean = true

		override fun isValidAddress(address: String): Boolean = true

		override fun startScan() {}

		override fun stopScan() {}

		override fun startSyncWork() {}

		override fun stopSyncWork() {}

		override fun loadPairing(): CorePairing? = null

		override fun savePairing(pairing: CorePairing) {}

		override fun clearPairing() {}

		override fun setRecordingDeviceName(name: String) {}

		override fun setRecordingFirmware(firmware: String?) {}

		override fun logEntries(limit: Int): List<CoreLogEntry> = emptyList()

		override fun exportLogs(): String = ""

		override fun clearLogs() {}

		override fun setLogLevel(level: LogLevel) {}

		override fun hasClassicBond(address: String): Boolean = false

		override fun requestClassicBond(address: String) {}

		override fun removeClassicBond(address: String) {}
	}

	private val logger = CapturingLogger()
	private lateinit var session: WatchSession
	private lateinit var bridge: CoreBridge
	private lateinit var defaultZone: TimeZone

	@Before
	fun setUp() {
		defaultZone = TimeZone.getDefault()
		session = WatchSession(NoopTransport, logger, InMemorySampleStore())
		bridge = CoreBridge(session, logger, NoopHost)
	}

	@After
	fun tearDown() {
		session.close()
		TimeZone.setDefault(defaultZone)
	}

	@Test
	fun handPickedItemsGiveTheSameLogLinesAsTheOldModule() {
		TimeZone.setDefault(TimeZone.getTimeZone("America/Sao_Paulo"))
		val array = JavaOnlyArray.of(
			"2026-10-28T10:00:00-03:00",
			JavaOnlyMap.of("category", 0, "registered_at", "2026-10-29T01:00:00.000Z"),
			JavaOnlyMap.of("registered_at", "2026-10-27"),
			JavaOnlyMap.of("category", 3, "registered_at", "2026-10-27"),
			JavaOnlyMap.of("category", 5),
			JavaOnlyMap.of("registered_at", null),
			"not a date",
			null,
			5,
			true,
			JavaOnlyArray.of("2026-10-28"),
		)
		val expected = oldDeletedSavedData(array, 5.0)
		assertEquals(
			listOf(
				LogLevel.WARN to "Ignoring category 3",
				LogLevel.WARN to "Unreadable dates: [not a date]",
				LogLevel.INFO to "kind=STEPS dayKeys=[2026-10-28, 2026-10-27]",
				LogLevel.INFO to "kind=SLEEP dayKeys=[2026-10-28]",
			),
			expected,
		)
		assertEquals(expected, runNew(array, 5.0))
	}

	@Test
	fun randomArraysGiveTheSameLogLinesAsTheOldModule() {
		val random = Random(20261029)
		var lines = 0
		for (zone in listOf("America/Sao_Paulo", "UTC", "Asia/Tokyo")) {
			TimeZone.setDefault(TimeZone.getTimeZone(zone))
			repeat(CASES_PER_ZONE) { case ->
				val array = randomArray(random)
				val fallback = FALLBACK_CATEGORIES.random(random)
				val expected = oldDeletedSavedData(array, fallback)
				assertEquals(expected, runNew(array, fallback), "zone=$zone case=$case fallback=$fallback array=$array")
				lines += expected.size
			}
		}
		println("DELETED_SAVED_DATA cases=${3 * CASES_PER_ZONE} logLines=$lines")
		assertTrue(lines > 3 * CASES_PER_ZONE, "the generator should produce more than one line per case on average")
	}

	private fun runNew(array: ReadableArray, category: Double): List<Pair<LogLevel, String>> {
		logger.take(NEW_TAG)
		bridge.deletedSavedData(ReadableConverter.toList(array), category)
		return logger.take(NEW_TAG)
	}

	// region Gerador

	private fun randomArray(random: Random): JavaOnlyArray {
		val array = JavaOnlyArray()
		repeat(random.nextInt(0, 9)) {
			when (random.nextInt(100)) {
				in 0 until 30 -> array.pushString(DATES.random(random))
				in 30 until 70 -> array.pushMap(randomItem(random))
				in 70 until 78 -> array.pushNull()
				in 78 until 86 -> if (random.nextBoolean()) array.pushInt(5) else array.pushDouble(0.0)
				in 86 until 92 -> array.pushBoolean(random.nextBoolean())
				else -> array.pushArray(JavaOnlyArray.of(DATES.random(random)))
			}
		}
		return array
	}

	private fun randomItem(random: Random): JavaOnlyMap {
		val item = JavaOnlyMap()
		when (random.nextInt(10)) {
			in 0 until 7 -> item.putString("registered_at", DATES.random(random))
			7 -> item.putInt("registered_at", 5)
			8 -> item.putNull("registered_at")
			else -> {}
		}
		when (random.nextInt(14)) {
			0 -> item.putInt("category", 5)
			1 -> item.putDouble("category", 5.0)
			2 -> item.putInt("category", 0)
			3 -> item.putDouble("category", 0.0)
			4 -> item.putInt("category", 3)
			5 -> item.putDouble("category", 5.9)
			6 -> item.putDouble("category", -0.4)
			7 -> item.putString("category", "5")
			8 -> item.putNull("category")
			9 -> item.putBoolean("category", true)
			10 -> item.putDouble("category", 1e12)
			11 -> item.putLong("category", 5L)
			else -> {}
		}
		if (random.nextInt(5) == 0) item.putMap("extra", JavaOnlyMap.of("category", 0))
		return item
	}

	// endregion

	// region Oráculo: o código do host antigo, sem mudança além de devolver as linhas de log

	/** `NativeCoreNextModule.deletedSavedData` antigo (linhas 232-253): `graph.logger.log` vira uma linha devolvida. */
	private fun oldDeletedSavedData(filteredArrayData: ReadableArray, category: Double): List<Pair<LogLevel, String>> {
		val logged = mutableListOf<Pair<LogLevel, String>>()
		val zone = ZoneId.systemDefault()
		val byKind = LinkedHashMap<DataKind, MutableList<String>>()
		for (index in 0 until filteredArrayData.size()) {
			val (itemCategory, registeredAt) = readSavedItem(filteredArrayData, index, category.toInt()) ?: continue
			val kind = OldSavedDataMapper.kindForCategory(itemCategory)
			if (kind == null) {
				logged += LogLevel.WARN to "Ignoring category $itemCategory"
				continue
			}
			byKind.getOrPut(kind) { mutableListOf() } += registeredAt
		}
		for ((kind, dates) in byKind) {
			val result = OldSavedDataMapper.dayKeys(dates, zone)
			if (result.rejected.isNotEmpty()) {
				logged += LogLevel.WARN to "Unreadable dates: ${result.rejected}"
			}
			logged += LogLevel.INFO to "kind=$kind dayKeys=${result.dayKeys}"
		}
		return logged
	}

	/** `NativeCoreNextModule.readSavedItem` antigo (linhas 337-342). */
	private fun readSavedItem(array: ReadableArray, index: Int, fallbackCategory: Int): Pair<Int, String>? =
		when (array.getType(index)) {
			ReadableType.String -> array.getString(index)?.let { fallbackCategory to it }
			ReadableType.Map -> array.getMap(index)?.let { item -> readSavedMap(item, fallbackCategory) }
			else -> null
		}

	/** `NativeCoreNextModule.readSavedMap` antigo (linhas 344-353). */
	private fun readSavedMap(item: ReadableMap, fallbackCategory: Int): Pair<Int, String>? {
		if (!item.hasKey("registered_at") || item.getType("registered_at") != ReadableType.String) return null
		val registeredAt = item.getString("registered_at") ?: return null
		val itemCategory = if (item.hasKey("category") && item.getType("category") == ReadableType.Number) {
			item.getDouble("category").toInt()
		} else {
			fallbackCategory
		}
		return itemCategory to registeredAt
	}

	/** O `bridge/SavedDataMapper.kt` antigo, com `java.time` (só o nome do objeto mudou). */
	private object OldSavedDataMapper {
		const val CATEGORY_PEDOMETER = 5
		const val CATEGORY_SLEEP = 0

		private val LEGACY_OFFSET: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss[.SSS]XX")

		fun kindForCategory(category: Int): DataKind? = when (category) {
			CATEGORY_PEDOMETER -> DataKind.STEPS
			CATEGORY_SLEEP -> DataKind.SLEEP
			else -> null
		}

		fun dayKey(registeredAt: String, zone: ZoneId): String? {
			val text = registeredAt.trim()
			if (text.isEmpty()) return null
			parseOrNull { OffsetDateTime.parse(text).atZoneSameInstant(zone).toLocalDate() }?.let { return it.toString() }
			parseOrNull { OffsetDateTime.parse(text, LEGACY_OFFSET).atZoneSameInstant(zone).toLocalDate() }?.let { return it.toString() }
			parseOrNull { LocalDateTime.parse(text).toLocalDate() }?.let { return it.toString() }
			parseOrNull { LocalDate.parse(text) }?.let { return it.toString() }
			return null
		}

		fun dayKeys(registeredAts: List<String>, zone: ZoneId): Result {
			val days = LinkedHashSet<String>()
			val rejected = mutableListOf<String>()
			for (value in registeredAts) {
				val day = dayKey(value, zone)
				if (day == null) rejected += value else days += day
			}
			return Result(days.toList(), rejected)
		}

		data class Result(val dayKeys: List<String>, val rejected: List<String>)

		private inline fun <T> parseOrNull(block: () -> T): T? = try {
			block()
		} catch (_: DateTimeParseException) {
			null
		}
	}

	// endregion

	private companion object {
		const val NEW_TAG = "CoreBridge/deletedSavedData"
		const val CASES_PER_ZONE = 700

		val FALLBACK_CATEGORIES = listOf(5.0, 0.0, 7.0, 5.5, -0.5, -0.0, Double.NaN, 1e12)

		val DATES = listOf(
			"2026-10-28T10:00:00-03:00",
			"2026-10-28T23:30:00-03:00",
			"2026-10-29T01:00:00Z",
			"2026-10-29T01:00:00.000Z",
			"2026-10-28T10:00:00.000-0300",
			"2026-10-28T10:00:00-0300",
			"2026-10-28T10:00:00+05:30",
			"2026-10-28T10:00:00",
			"2026-10-28T10:00",
			"2026-10-28",
			" 2026-10-27 ",
			"2026-02-30",
			"2026-10-28T24:00:00",
			"2026-11-02T00:15:00-02:00",
			"2026-03-08T02:30:00",
			"28/10/2026",
			"not a date",
			"",
		)
	}
}

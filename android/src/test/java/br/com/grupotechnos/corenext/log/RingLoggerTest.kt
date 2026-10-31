package br.com.grupotechnos.corenext.log

import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.LogLevel
import org.json.JSONObject
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.time.ZoneId
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** Anel, filtro de nível, pacotes GATT e gravação de fixture. */
class RingLoggerTest {
	@get:Rule val folder = TemporaryFolder()

	private var now = 1_793_208_600_000L
	private val recorder = FrameRecorder(maxPackets = 3, nowMillis = { now }, zone = { ZoneId.of("America/Sao_Paulo") })

	private fun logger(capacity: Int = 2000, onLogcat: (LogLevel, String) -> Unit = { _, _ -> }) =
		RingLogger(recorder, capacity, onLogcat, nowMillis = { now })

	@Test
	fun ringKeepsTheNewestAndReturnsNewestFirst() {
		val logger = logger(capacity = 3)
		(1..5).forEach { logger.log(LogLevel.INFO, "T/m", "message $it") }
		assertEquals(listOf("message 5", "message 4", "message 3"), logger.entries(10).map { it.message })
		assertEquals(listOf("message 5"), logger.entries(1).map { it.message })
	}

	@Test
	fun minLevelFiltersRingLogcatAndListener() {
		val logcat = mutableListOf<String>()
		val logger = logger(onLogcat = { _, message -> logcat += message })
		val emitted = mutableListOf<RingLogger.Entry>()
		logger.onEntry = { emitted += it }
		logger.minLevel = LogLevel.WARN
		logger.log(LogLevel.INFO, "T/m", "dropped")
		logger.log(LogLevel.ERROR, "T/m", "kept")
		assertEquals(listOf("kept"), logger.entries(10).map { it.message })
		assertEquals(listOf("kept"), emitted.map { it.message })
		assertEquals(listOf("T/m: kept"), logcat)
	}

	@Test
	fun framesCarryDirectionAndHexAndAreRecordedEvenWhenFiltered() {
		val logger = logger()
		logger.frame(FrameDirection.TX, "6e400002-b5a3-f393-e0a9-e50e24dcca9e", byteArrayOf(0xAB.toByte(), 0x00, 0x10), "seq=1 03/01 BIND")
		val entry = logger.entries(1).single()
		assertEquals(FrameDirection.TX, entry.dir)
		assertEquals("AB0010", entry.hex)
		assertEquals("Frame/6e400002", entry.tag)
		assertEquals("seq=1 03/01 BIND len=3", entry.message)

		logger.minLevel = LogLevel.INFO
		logger.frame(FrameDirection.RX, "0000ff62-0000-1000-8000-00805f9b34fb", byteArrayOf(0x01), "")
		assertEquals(1, logger.entries(10).size)
		assertEquals(2, recorder.packetCount)
	}

	@Test
	fun recorderWritesFixtureHeaderAndPackets() {
		val logger = logger()
		recorder.firmware = "1.2.3"
		recorder.deviceName = "Mormaii_fitGPS"
		recorder.mtu = 247
		// Primeiro pacote fora do segundo cheio: o recordedAt tem que guardar os milissegundos dele (atMs 0).
		now += 933
		logger.frame(FrameDirection.TX, "6e400002-b5a3-f393-e0a9-e50e24dcca9e", byteArrayOf(0xAB.toByte()), "x")
		now += 120
		logger.frame(FrameDirection.RX, "6e400003-b5a3-f393-e0a9-e50e24dcca9e", byteArrayOf(0x01, 0x02), "")
		val file = File(folder.root, "corenext/frames.jsonl")
		recorder.writeTo(file)
		val lines = file.readLines()
		assertEquals(3, lines.size)
		val header = JSONObject(lines[0])
		assertEquals("header", header.getString("type"))
		assertEquals("Mormaii_fitGPS", header.getString("device"))
		assertEquals("1.2.3", header.getString("firmware"))
		assertEquals(247, header.getInt("mtu"))
		assertEquals("android", header.getString("platform"))
		assertEquals("2026-10-28T14:30:00.933-03:00", header.getString("recordedAt"))
		assertEquals("America/Sao_Paulo", header.getString("timeZone"))
		val second = JSONObject(lines[2])
		assertEquals("RX", second.getString("dir"))
		assertEquals(120, second.getLong("atMs"))
		assertEquals("0102", second.getString("hex"))
	}

	@Test
	fun recorderHeaderUsesANumericOffsetInUtc() {
		val utc = FrameRecorder(nowMillis = { now }, zone = { ZoneId.of("UTC") })
		val file = File(folder.root, "utc/frames.jsonl")
		utc.writeTo(file)
		assertEquals("2026-10-28T17:30:00.000+00:00", JSONObject(file.readLines()[0]).getString("recordedAt"))
	}

	@Test
	fun recorderStopsWhenFullAndWarnsOnce() {
		val logger = logger()
		repeat(5) { logger.frame(FrameDirection.TX, "6e400002-b5a3-f393-e0a9-e50e24dcca9e", byteArrayOf(it.toByte()), "") }
		assertEquals(3, recorder.packetCount)
		assertTrue(recorder.isFull)
		assertEquals(1, logger.entries(100).count { it.level == LogLevel.WARN })
		logger.clear()
		assertEquals(0, recorder.packetCount)
		assertEquals(0, logger.entries(100).size)
	}

	@Test
	fun logsExportOneJsonPerLine() {
		val logger = logger()
		logger.log(LogLevel.INFO, "T/m", "hello")
		logger.frame(FrameDirection.TX, "6e400002-b5a3-f393-e0a9-e50e24dcca9e", byteArrayOf(0x0A), "s")
		val file = File(folder.root, "logs.jsonl")
		logger.writeTo(file)
		val lines = file.readLines().map(::JSONObject)
		assertEquals("hello", lines[0].getString("message"))
		assertTrue(lines[0].isNull("dir"))
		assertEquals("TX", lines[1].getString("dir"))
		assertEquals("0A", lines[1].getString("hex"))
	}

	@Test
	fun readFrameIsRecordedWithReadDirection() {
		// Leituras GATT (versão, firmware, bateria e passos do CRP) entram na gravação como "READ", e o replay as responde.
		val logger = logger()
		logger.frame(FrameDirection.READ, "00002a29-0000-1000-8000-00805f9b34fb", "MOYOUNG-V2".encodeToByteArray(), "")
		val entry = logger.entries(1).single()
		assertEquals(FrameDirection.READ, entry.dir)
		assertEquals("Frame/2a29", entry.tag)
		assertEquals("4D4F594F554E472D5632", entry.hex)
		val file = File(folder.root, "read/frames.jsonl")
		recorder.writeTo(file)
		val packet = JSONObject(file.readLines()[1])
		assertEquals("READ", packet.getString("dir"))
		assertEquals("00002a29-0000-1000-8000-00805f9b34fb", packet.getString("characteristic"))
		assertEquals("4D4F594F554E472D5632", packet.getString("hex"))
		val logs = File(folder.root, "read/logs.jsonl")
		logger.writeTo(logs)
		assertEquals("READ", JSONObject(logs.readLines().single()).getString("dir"))
	}

	@Test
	fun shortUuid() {
		assertEquals("ff62", RingLogger.shortUuid("0000ff62-0000-1000-8000-00805f9b34fb"))
		assertEquals("6e400003", RingLogger.shortUuid("6e400003-b5a3-f393-e0a9-e50e24dcca9e"))
	}
}

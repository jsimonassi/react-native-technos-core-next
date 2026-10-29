package br.com.grupotechnos.corenext.log

import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.FrameJsonl
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Gravação dos pacotes GATT crus no formato de fixture do Repo 1 ([FrameJsonl], `docs/fixtures.md` lá).
 *
 * Os pacotes ficam em memória e só viram arquivo em [writeTo], chamado por `exportLogs()`. Motivo: o cabeçalho
 * (primeira linha) leva firmware e MTU, que só se conhecem depois do handshake; gravar no fim evita reescrever
 * o arquivo. O custo é perder a gravação se o processo morrer antes do export, aceitável numa ferramenta de
 * diagnóstico.
 *
 * Limite de [maxPackets]: acima dele a gravação para (com aviso no log) em vez de descartar os mais antigos,
 * porque um fixture sem o começo (connect/handshake) não serve para replay. `clear()` começa uma gravação nova.
 *
 * Thread-safe.
 */
class FrameRecorder(
	private val maxPackets: Int = DEFAULT_MAX_PACKETS,
	private val nowMillis: () -> Long = System::currentTimeMillis,
	private val zone: () -> ZoneId = ZoneId::systemDefault,
) {
	/** Metadados do cabeçalho, preenchidos pelo `CoreGraph` conforme a sessão avança. */
	@Volatile var deviceName: String = "unknown"

	@Volatile var firmware: String? = null

	@Volatile var mtu: Int = 23

	private val lock = Any()
	private val lines = ArrayList<String>()
	private var startedAtMillis: Long = 0
	private var full = false

	/**
	 * Guarda um pacote. Devolve `true` só no primeiro pacote descartado por falta de espaço,
	 * para o chamador avisar no log uma única vez.
	 */
	fun record(direction: FrameDirection, characteristic: String, value: ByteArray): Boolean = synchronized(lock) {
		if (lines.isEmpty()) startedAtMillis = nowMillis()
		if (lines.size >= maxPackets) {
			val firstOverflow = !full
			full = true
			return firstOverflow
		}
		lines += FrameJsonl.line(direction, nowMillis() - startedAtMillis, characteristic, value)
		false
	}

	/** `true` a partir do primeiro pacote descartado por falta de espaço. */
	val isFull: Boolean
		get() = synchronized(lock) { full }

	val packetCount: Int
		get() = synchronized(lock) { lines.size }

	/** Grava cabeçalho e pacotes em [file] (sobrescreve). */
	fun writeTo(file: File) {
		val (startedAt, snapshot) = synchronized(lock) { (if (lines.isEmpty()) nowMillis() else startedAtMillis) to lines.toList() }
		val recordedAt = Instant.ofEpochMilli(startedAt).atZone(zone()).format(ISO)
		val header = FrameJsonl.header(
			device = deviceName,
			firmware = firmware,
			platform = "android",
			mtu = mtu,
			recordedAtIso = recordedAt,
			timeZoneId = zone().id,
		)
		file.parentFile?.mkdirs()
		file.bufferedWriter(Charsets.UTF_8).use { writer ->
			writer.appendLine(header)
			snapshot.forEach { writer.appendLine(it) }
		}
	}

	/** Começa uma gravação nova. */
	fun clear() {
		synchronized(lock) {
			lines.clear()
			full = false
		}
	}

	companion object {
		/** ~50 mil pacotes cabem com folga em memória (cada linha tem ~150 bytes) e cobrem várias sincronizações. */
		const val DEFAULT_MAX_PACKETS = 50_000

		/** `xxx` (minúsculo) dá `+00:00` em UTC; o `XXX` daria `Z`, e o cabeçalho de fixture exige offset numérico (Repo 1, `docs/fixtures.md`). */
		private val ISO: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssxxx")
	}
}

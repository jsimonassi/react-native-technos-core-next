package br.com.grupotechnos.corenext.log

import android.util.Log
import br.com.grupotechnos.watch.protocol.log.FrameDirection
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import org.json.JSONObject
import java.io.File

/**
 * [WatchLogger] do Core: anel em memória de [capacity] entradas, Logcat e evento `onLog` para a aba Log do exemplo.
 *
 * - Entradas abaixo de [minLevel] (definido por `setLogLevel`) são descartadas: não entram no anel,
 *   não vão para o Logcat nem para o JS.
 * - Pacotes GATT ([frame]) viram entradas `DEBUG` com `dir` e `hex`, e são sempre repassados ao [recorder],
 *   independentemente do nível, porque a gravação de fixture não pode ter buracos.
 * - [onEntry] é chamado na thread de quem logou (em geral a da sessão); não deve bloquear.
 *
 * Thread-safe.
 */
class RingLogger(
	private val recorder: FrameRecorder,
	private val capacity: Int = DEFAULT_CAPACITY,
	private val logcat: (LogLevel, String) -> Unit = ::toLogcat,
	private val nowMillis: () -> Long = System::currentTimeMillis,
) : WatchLogger {
	/** Uma linha do log. [dir] e [hex] só existem para pacotes GATT. */
	data class Entry(
		val ts: Long,
		val level: LogLevel,
		val tag: String,
		val message: String,
		val dir: FrameDirection?,
		val hex: String?,
	)

	@Volatile var minLevel: LogLevel = LogLevel.DEBUG

	@Volatile var onEntry: ((Entry) -> Unit)? = null

	private val lock = Any()
	private val ring = ArrayDeque<Entry>(capacity)

	override fun log(level: LogLevel, tag: String, message: String) {
		append(Entry(nowMillis(), level, tag, message, null, null))
	}

	override fun frame(direction: FrameDirection, characteristic: String, value: ByteArray, summary: String) {
		if (recorder.record(direction, characteristic, value)) {
			log(LogLevel.WARN, "RingLogger/frame", "Frame recording is full; new packets are not recorded until clearLogs()")
		}
		val text = if (summary.isEmpty()) "len=${value.size} (cont.)" else "$summary len=${value.size}"
		append(Entry(nowMillis(), LogLevel.DEBUG, "Frame/${shortUuid(characteristic)}", text, direction, hex(value)))
	}

	/** Últimas [limit] entradas, da mais nova para a mais antiga. */
	fun entries(limit: Int): List<Entry> = synchronized(lock) {
		val count = limit.coerceIn(0, ring.size)
		(0 until count).map { ring[ring.size - 1 - it] }
	}

	/** Esvazia o anel e começa uma gravação de frames nova. */
	fun clear() {
		synchronized(lock) { ring.clear() }
		recorder.clear()
	}

	/** Grava o anel em [file], uma entrada JSON por linha, da mais antiga para a mais nova. */
	fun writeTo(file: File) {
		val snapshot = synchronized(lock) { ring.toList() }
		file.parentFile?.mkdirs()
		file.bufferedWriter(Charsets.UTF_8).use { writer ->
			for (entry in snapshot) {
				val json = JSONObject()
					.put("ts", entry.ts)
					.put("level", entry.level.name)
					.put("tag", entry.tag)
					.put("message", entry.message)
					.put("dir", entry.dir?.name ?: JSONObject.NULL)
					.put("hex", entry.hex ?: JSONObject.NULL)
				writer.appendLine(json.toString())
			}
		}
	}

	private fun append(entry: Entry) {
		if (entry.level.ordinal < minLevel.ordinal) return
		synchronized(lock) {
			if (ring.size >= capacity) ring.removeFirst()
			ring.addLast(entry)
		}
		val prefix = entry.dir?.let { "${it.name} " } ?: ""
		val suffix = entry.hex?.let { " $it" } ?: ""
		logcat(entry.level, "${entry.tag}: $prefix${entry.message}$suffix")
		onEntry?.invoke(entry)
	}

	companion object {
		const val DEFAULT_CAPACITY = 2000
		const val LOGCAT_TAG = "CoreNext"

		/** Hex maiúsculo sem separadores, o mesmo formato do `hex` do fixture (`FrameJsonl.line`). */
		fun hex(bytes: ByteArray): String {
			val digits = "0123456789ABCDEF"
			val out = CharArray(bytes.size * 2)
			bytes.forEachIndexed { index, byte ->
				val value = byte.toInt() and 0xFF
				out[index * 2] = digits[value ushr 4]
				out[index * 2 + 1] = digits[value and 0x0F]
			}
			return String(out)
		}

		/** `6e400003-b5a3-...` → `6e400003`; `0000ff62-0000-1000-...` → `ff62`. Só para deixar o log legível. */
		fun shortUuid(uuid: String): String {
			val head = uuid.substringBefore('-')
			return if (uuid.endsWith("-0000-1000-8000-00805f9b34fb") && head.startsWith("0000")) head.substring(4) else head
		}

		private fun toLogcat(level: LogLevel, message: String) {
			when (level) {
				LogLevel.DEBUG -> Log.d(LOGCAT_TAG, message)
				LogLevel.INFO -> Log.i(LOGCAT_TAG, message)
				LogLevel.WARN -> Log.w(LOGCAT_TAG, message)
				LogLevel.ERROR -> Log.e(LOGCAT_TAG, message)
			}
		}
	}
}

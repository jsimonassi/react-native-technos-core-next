package br.com.grupotechnos.corenext.store

import br.com.grupotechnos.watch.protocol.domain.DataKind
import br.com.grupotechnos.watch.protocol.domain.SleepSession
import br.com.grupotechnos.watch.protocol.domain.StepsSample
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import br.com.grupotechnos.watch.protocol.session.SampleStore
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.file.Files
import java.nio.file.StandardCopyOption

/**
 * [SampleStore] em arquivos JSON, um por tipo, em [directory] (em produção `context.filesDir/corenext/`).
 *
 * Por que existe: o relógio pode não devolver o histórico inteiro a cada leitura (o cursor pode avançar depois
 * do ACK, hipótese 4 do plano), então o que a sessão leu precisa sobreviver ao processo; o Core atual faz o mesmo
 * com `SharedPreferences` (`SMADataRepository.java:25-31, 88-98`).
 *
 * Escrita atômica: grava num `.tmp` no mesmo diretório, faz `fsync` e renomeia por cima do arquivo final.
 * Um processo morto no meio deixa o arquivo antigo intacto, nunca um JSON pela metade.
 *
 * Chamado na thread da sessão (contrato do [SampleStore]); IO síncrono é permitido. Arquivo ilegível vira lista
 * vazia com log `WARN` em vez de exceção, para um arquivo corrompido não derrubar a sessão.
 */
class FileSampleStore(
	private val directory: File,
	private val logger: WatchLogger,
) : SampleStore {
	private val lock = Any()

	override fun loadSteps(): List<StepsSample> = read(STEPS_FILE) { SampleJsonCodec.decodeSteps(it) }

	override fun saveSteps(samples: List<StepsSample>) = write(STEPS_FILE, SampleJsonCodec.encodeSteps(samples))

	override fun loadSleep(): List<SleepSession> = read(SLEEP_FILE) { SampleJsonCodec.decodeSleep(it) }

	override fun saveSleep(sessions: List<SleepSession>) = write(SLEEP_FILE, SampleJsonCodec.encodeSleep(sessions))

	override fun loadConfirmedDays(kind: DataKind): List<String> =
		read(confirmedFile(kind)) { SampleJsonCodec.decodeDayKeys(it) }

	override fun saveConfirmedDays(kind: DataKind, dayKeys: List<String>) =
		write(confirmedFile(kind), SampleJsonCodec.encodeDayKeys(dayKeys))

	override fun clear() {
		synchronized(lock) {
			val names = listOf(STEPS_FILE, SLEEP_FILE) + DataKind.entries.map(::confirmedFile)
			for (name in names) {
				val file = File(directory, name)
				if (file.exists() && !file.delete()) log(LogLevel.WARN, "clear", "Could not delete ${file.name}")
			}
		}
	}

	private fun <T> read(name: String, decode: (String) -> SampleJsonCodec.DecodeResult<T>): List<T> = synchronized(lock) {
		val file = File(directory, name)
		if (!file.exists()) return emptyList()
		try {
			val result = decode(file.readText(Charsets.UTF_8))
			if (result.skipped > 0) log(LogLevel.WARN, "read", "Skipped ${result.skipped} invalid items in $name")
			result.items
		} catch (error: Exception) {
			log(LogLevel.WARN, "read", "Unreadable $name, using empty list: ${error.message}")
			emptyList()
		}
	}

	private fun write(name: String, content: String): Unit = synchronized(lock) {
		try {
			if (!directory.exists() && !directory.mkdirs()) throw IOException("Could not create ${directory.path}")
			val target = File(directory, name)
			val temp = File(directory, "$name.tmp")
			FileOutputStream(temp).use { stream ->
				stream.write(content.toByteArray(Charsets.UTF_8))
				stream.fd.sync()
			}
			Files.move(temp.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
		} catch (error: Exception) {
			log(LogLevel.ERROR, "write", "Could not write $name: ${error.message}")
		}
	}

	private fun log(level: LogLevel, method: String, message: String) {
		logger.log(level, "FileSampleStore/$method", message)
	}

	companion object {
		const val STEPS_FILE = "steps.json"
		const val SLEEP_FILE = "sleep.json"

		fun confirmedFile(kind: DataKind): String = "confirmed-${kind.name.lowercase()}.json"
	}
}

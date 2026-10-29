package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.DataKind
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException

/**
 * Tradução do `deletedSavedData(items, category)` do JS para `WatchSession.confirmUploaded(kind, dayKeys)`.
 *
 * O app manda, depois de enviar ao backend, a lista de `registered_at` confirmados e a categoria
 * (`TechnosCore.deletedCategory`: `PEDOMETER = 5`, `SLEEP = 0`, `TechnosWareCore/src/NativeModules/index.ts:33-43`).
 * A sessão trabalha com dias locais (`yyyy-MM-dd`), então cada data vira o dia local no fuso do telefone.
 *
 * Por que converter para o fuso do telefone e não cortar os 10 primeiros caracteres: hoje o app manda
 * `moment(data.id).format()`, com o offset do telefone (`GTE-Mormaii/src/mappers/entities/general.ts:7-13`),
 * mas a data já passou por `moment(date).toISOString()` (UTC) no caminho (`pedometer.ts:40-48`) e o backend
 * pode devolvê-la em UTC. `2026-10-28T22:00:00-03:00` em UTC é `2026-10-29T01:00:00Z`: cortar daria o dia
 * errado; converter o instante para o fuso local devolve o dia da amostra nos dois formatos.
 */
object SavedDataMapper {
	/** `deletedCategory.PEDOMETER` do Core atual. */
	const val CATEGORY_PEDOMETER = 5

	/** `deletedCategory.SLEEP` do Core atual. */
	const val CATEGORY_SLEEP = 0

	// Formato legado com offset sem dois-pontos (`-0300`), aceito pelo `SimpleDateFormat` "ZZZZZ" do Core atual.
	private val LEGACY_OFFSET: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss[.SSS]XX")

	/** Categoria do Core atual para [DataKind], ou `null` para categorias que este Core não guarda. */
	fun kindForCategory(category: Int): DataKind? = when (category) {
		CATEGORY_PEDOMETER -> DataKind.STEPS
		CATEGORY_SLEEP -> DataKind.SLEEP
		else -> null
	}

	/**
	 * Dia local (`yyyy-MM-dd`) de uma data ISO-8601, ou `null` se não for possível ler.
	 *
	 * Aceita, em ordem: com offset ou `Z` (`2026-10-28T00:00:00-03:00`, `...000Z`), offset legado (`-0300`),
	 * data-hora sem offset (tratada como hora local) e só a data (`2026-10-28`).
	 */
	fun dayKey(registeredAt: String, zone: ZoneId): String? {
		val text = registeredAt.trim()
		if (text.isEmpty()) return null
		parseOrNull { OffsetDateTime.parse(text).atZoneSameInstant(zone).toLocalDate() }?.let { return it.toString() }
		parseOrNull { OffsetDateTime.parse(text, LEGACY_OFFSET).atZoneSameInstant(zone).toLocalDate() }?.let { return it.toString() }
		parseOrNull { LocalDateTime.parse(text).toLocalDate() }?.let { return it.toString() }
		parseOrNull { LocalDate.parse(text) }?.let { return it.toString() }
		return null
	}

	/** Dias distintos, em ordem, das datas que puderam ser lidas; as inválidas vão em [Result.rejected] para log. */
	fun dayKeys(registeredAts: List<String>, zone: ZoneId): Result {
		val days = LinkedHashSet<String>()
		val rejected = mutableListOf<String>()
		for (value in registeredAts) {
			val day = dayKey(value, zone)
			if (day == null) rejected += value else days += day
		}
		return Result(days.toList(), rejected)
	}

	/** Resultado de [dayKeys]. */
	data class Result(val dayKeys: List<String>, val rejected: List<String>)

	private inline fun <T> parseOrNull(block: () -> T): T? = try {
		block()
	} catch (_: DateTimeParseException) {
		null
	}
}

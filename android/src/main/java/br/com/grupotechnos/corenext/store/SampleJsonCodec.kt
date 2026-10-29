package br.com.grupotechnos.corenext.store

import br.com.grupotechnos.watch.protocol.domain.SleepSession
import br.com.grupotechnos.watch.protocol.domain.SleepStage
import br.com.grupotechnos.watch.protocol.domain.SleepStageType
import br.com.grupotechnos.watch.protocol.domain.StepsSample
import org.json.JSONArray
import org.json.JSONObject

/**
 * Formato em disco do [FileSampleStore] (JSON via `org.json`).
 *
 * Cada arquivo é um objeto `{"version":1,"items":[...]}`; o `version` permite migrar o formato sem perder
 * o histórico já gravado. Os nomes dos campos são os das propriedades do domínio, para o arquivo ser legível
 * num `adb shell run-as ... cat`.
 *
 * Decodificação tolerante: item inválido é pulado (e contado em [DecodeResult.skipped]) em vez de descartar
 * o arquivo inteiro, porque perder o histórico local pode perder passos que o relógio já não devolve.
 */
object SampleJsonCodec {
	const val VERSION = 1

	/** Resultado de uma decodificação. */
	data class DecodeResult<T>(val items: List<T>, val skipped: Int)

	fun encodeSteps(samples: List<StepsSample>): String = wrap(
		JSONArray().apply {
			for (sample in samples) {
				put(
					JSONObject()
						.put("atEpochMillis", sample.atEpochMillis)
						.put("steps", sample.steps)
						.put("mode", sample.mode)
						.put("calories", sample.calories)
						.put("distanceMeters", sample.distanceMeters),
				)
			}
		},
	)

	fun decodeSteps(text: String): DecodeResult<StepsSample> = decodeItems(text) { item ->
		StepsSample(
			atEpochMillis = item.getLong("atEpochMillis"),
			steps = item.getInt("steps"),
			mode = item.getInt("mode"),
			calories = item.getInt("calories"),
			distanceMeters = item.getDouble("distanceMeters"),
		)
	}

	fun encodeSleep(sessions: List<SleepSession>): String = wrap(
		JSONArray().apply {
			for (session in sessions) {
				val stages = JSONArray()
				for (stage in session.stages) {
					stages.put(
						JSONObject()
							.put("type", stage.type.name)
							.put("startEpochMillis", stage.startEpochMillis)
							.put("endEpochMillis", stage.endEpochMillis)
							.put("startIso", stage.startIso)
							.put("endIso", stage.endIso),
					)
				}
				put(
					JSONObject()
						.put("dayKey", session.dayKey)
						.put("startEpochMillis", session.startEpochMillis)
						.put("endEpochMillis", session.endEpochMillis)
						.put("startIso", session.startIso)
						.put("endIso", session.endIso)
						.put("stages", stages)
						.put("totalMinutes", session.totalMinutes)
						.put("lightMinutes", session.lightMinutes)
						.put("deepMinutes", session.deepMinutes)
						.put("remMinutes", session.remMinutes)
						.put("awakeMinutes", session.awakeMinutes),
				)
			}
		},
	)

	fun decodeSleep(text: String): DecodeResult<SleepSession> = decodeItems(text) { item ->
		val stagesJson = item.getJSONArray("stages")
		val stages = (0 until stagesJson.length()).map { index ->
			val stage = stagesJson.getJSONObject(index)
			SleepStage(
				type = SleepStageType.valueOf(stage.getString("type")),
				startEpochMillis = stage.getLong("startEpochMillis"),
				endEpochMillis = stage.getLong("endEpochMillis"),
				startIso = stage.getString("startIso"),
				endIso = stage.getString("endIso"),
			)
		}
		SleepSession(
			dayKey = item.getString("dayKey"),
			startEpochMillis = item.getLong("startEpochMillis"),
			endEpochMillis = item.getLong("endEpochMillis"),
			startIso = item.getString("startIso"),
			endIso = item.getString("endIso"),
			stages = stages,
			totalMinutes = item.getInt("totalMinutes"),
			lightMinutes = item.getInt("lightMinutes"),
			deepMinutes = item.getInt("deepMinutes"),
			remMinutes = item.getInt("remMinutes"),
			awakeMinutes = item.getInt("awakeMinutes"),
		)
	}

	fun encodeDayKeys(dayKeys: List<String>): String = wrap(JSONArray().apply { dayKeys.forEach { put(it) } })

	fun decodeDayKeys(text: String): DecodeResult<String> {
		val items = root(text)
		val result = mutableListOf<String>()
		var skipped = 0
		for (index in 0 until items.length()) {
			val value = items.optString(index, "")
			if (value.isEmpty()) skipped++ else result += value
		}
		return DecodeResult(result, skipped)
	}

	private fun wrap(items: JSONArray): String =
		JSONObject().put("version", VERSION).put("items", items).toString()

	private fun root(text: String): JSONArray = JSONObject(text).getJSONArray("items")

	private inline fun <T> decodeItems(text: String, decode: (JSONObject) -> T): DecodeResult<T> {
		val items = root(text)
		val result = ArrayList<T>(items.length())
		var skipped = 0
		for (index in 0 until items.length()) {
			try {
				result += decode(items.getJSONObject(index))
			} catch (error: Exception) {
				skipped++
			}
		}
		return DecodeResult(result, skipped)
	}
}

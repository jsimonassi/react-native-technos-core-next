package br.com.grupotechnos.corenext.bridge

import br.com.grupotechnos.watch.protocol.domain.Battery
import br.com.grupotechnos.watch.protocol.domain.ConnectionState
import br.com.grupotechnos.watch.protocol.domain.DeviceInfo
import br.com.grupotechnos.watch.protocol.domain.SleepSession
import br.com.grupotechnos.watch.protocol.domain.StepsDay
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.profile.DeviceProfile
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Tradução dos tipos de domínio para os payloads dos eventos JS, nos formatos de `src/types/events.ts`.
 *
 * Kotlin puro (só `Map`/`List`/primitivos), para ser testado na JVM sem React Native;
 * a conversão para `WritableMap` fica em [WritableConverter].
 *
 * Datas: usa as strings ISO que o domínio já entrega (`StepsDay.startOfDayIso`, `SleepSession.startIso`...).
 * Só o `date` do sono é calculado aqui, a partir do `dayKey`, com o mesmo padrão `yyyy-MM-dd'T'HH:mm:ssXXX`
 * de `SMAHelper.getDateString` do Core atual (`SMAHelper.java:36-39`). Com offset zero (telefone em UTC, Lisboa no
 * inverno) esse padrão dá `Z`, como o `ZZZZZ` do `SimpleDateFormat` (ICU) do Core; as strings que vêm do Repo 1 usam
 * sempre `+00:00`. Os dois formatos são ISO-8601 válidos e o `moment()` do app lê os dois; a diferença é de paridade
 * com o Core, não de leitura (`docs/api-js.md`, Datas).
 *
 * Inteiros vão como [Int] e decimais como [Double]: o `WritableMap` só tem `putInt`/`putDouble`
 * e o JS recebe `number` nos dois casos.
 */
object EventMapper {
	/** Padrão das datas ISO entregues ao JS. */
	val ISO_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssXXX")

	/** `onScannedDevice` (`ScannedDeviceEvent`). `name` é o `appName`, que o app filtra em `ALLOWED_DEVICE_NAMES`. */
	fun scannedDevice(profile: DeviceProfile, address: String, rssi: Int, bleName: String): Map<String, Any?> = mapOf(
		"name" to profile.appName,
		"deviceId" to address,
		"rssi" to rssi,
		"bleName" to bleName,
		"profileId" to profile.id,
	)

	/** `onConnectStateChanged` (`ConnectStateChangedEvent`). */
	fun connectStateChanged(state: ConnectionState, phase: String?): Map<String, Any?> = mapOf(
		"state" to StateMapper.toDeviceConnectState(state),
		"sessionState" to state.name,
		"phase" to phase,
	)

	/** `onDeviceInfo` (`DeviceInfoEvent`). */
	fun deviceInfo(info: DeviceInfo): Map<String, Any?> = mapOf(
		"deviceId" to info.address,
		"profileId" to info.profileId,
		"bleName" to info.bleName,
		"firmware" to info.firmware,
		"bleVersion" to info.bleVersion,
	)

	/**
	 * `onFirmwareInfo` (`FirmwareInfoEvent`). `braceletType` 0 (`SDKUtils.FITGPS`) e `platformCode` 0 são
	 * os valores que o Core atual emite para SMA (`SMAService.java:241-244`, `EventHandler.kt:274-287`).
	 * `deviceId` é novo: o Core atual não o preenche para SMA.
	 */
	fun firmwareInfo(info: DeviceInfo): Map<String, Any?> = mapOf(
		"version" to info.firmware,
		"braceletType" to 0,
		"platformCode" to 0,
		"deviceId" to info.address,
	)

	/** `onBatteryStatus` (`BatteryStatusEvent`). O SMA não informa carregamento; `battery` é o campo legado `"N%"`. */
	fun battery(battery: Battery): Map<String, Any?> = mapOf(
		"percentage" to battery.percent,
		"charging" to false,
		"battery" to "${battery.percent}%",
	)

	/** `onPedometer` (`PedometerEvent`): total de hoje. */
	fun pedometer(today: StepsDay): Map<String, Any?> = mapOf(
		"pedometer" to today.steps,
		"calorie" to today.calories,
		"distance" to today.distanceMeters,
		"date" to today.startOfDayIso,
	)

	/** Um dia de `onHistoryPedometer` (`PedometerHistoryDay`). */
	fun pedometerDay(day: StepsDay): Map<String, Any?> = mapOf(
		"date" to day.startOfDayIso,
		"distance" to day.distanceMeters,
		"calorie" to day.calories,
		"pedometer" to day.steps,
	)

	/** `onHistoryPedometer` (`HistoryPedometerEvent`). Lista vazia também é emitida, como no Core iOS atual. */
	fun historyPedometer(days: List<StepsDay>): Map<String, Any?> = mapOf(
		"historypedometer" to days.map(::pedometerDay),
	)

	/**
	 * Um dia de `onHistorySleep` (`SleepHistoryDay`). `date` é o início do dia em que a pessoa acordou
	 * ([SleepSession.dayKey]) no fuso [zone]. O SMA não mede respiração nem REM: `respiratoryRateItems` sai vazio.
	 */
	fun sleepDay(session: SleepSession, zone: ZoneId): Map<String, Any?> = mapOf(
		"date" to startOfDayIso(session.dayKey, zone),
		"sleep" to mapOf(
			"start" to session.startIso,
			"end" to session.endIso,
			"items" to session.stages.map { stage ->
				mapOf(
					"typeItem" to stage.type.code,
					"startItem" to stage.startIso,
					"endItem" to stage.endIso,
				)
			},
			"respiratoryRateItems" to emptyList<Any?>(),
			"totalSleepMinutes" to session.totalMinutes,
			"lightSleepMinutes" to session.lightMinutes,
			"deepSleepMinutes" to session.deepMinutes,
			"remSleepMinutes" to session.remMinutes,
			"wakeUpMinutes" to session.awakeMinutes,
		),
	)

	/** `onHistorySleep` (`HistorySleepEvent`). */
	fun historySleep(sessions: List<SleepSession>, zone: ZoneId): Map<String, Any?> = mapOf(
		"historysleep" to sessions.map { sleepDay(it, zone) },
	)

	/** `onSyncStarted` e `onSyncFinished`: sem campos. */
	fun empty(): Map<String, Any?> = emptyMap()

	/** `onSyncProgress` (`SyncProgressEvent`). */
	fun syncProgress(percent: Int): Map<String, Any?> = mapOf("progress" to percent.coerceIn(0, 100))

	/** `onError` (`ErrorEvent`). [requestId] é `-1` quando o erro não veio de um comando. */
	fun error(requestId: Int, code: String, message: String, method: String?): Map<String, Any?> = mapOf(
		"requestId" to requestId,
		"code" to code,
		"message" to message,
		"method" to method,
	)

	/** `onLog` e itens de `getLogs` (`LogEvent`). [ts] vai como [Double] porque epoch millis não cabe em `Int`. */
	fun log(ts: Long, level: LogLevel, tag: String, message: String, dir: String?, hex: String?): Map<String, Any?> = mapOf(
		"ts" to ts.toDouble(),
		"level" to level.name,
		"tag" to tag,
		"message" to message,
		"dir" to dir,
		"hex" to hex,
	)

	/** Retorno de `getLastPairedDevice` (`LastPairedDevice`). */
	fun lastPairedDevice(address: String, name: String, profileId: String): Map<String, Any?> = mapOf(
		"deviceId" to address,
		"name" to name,
		"profileId" to profileId,
	)

	/** Início do dia local de [dayKey] (`yyyy-MM-dd`) em ISO com offset, ex.: `"2026-10-28T00:00:00-03:00"`. */
	fun startOfDayIso(dayKey: String, zone: ZoneId): String =
		LocalDate.parse(dayKey).atStartOfDay(zone).format(ISO_FORMATTER)
}

package br.com.grupotechnos.corenext

import android.bluetooth.BluetoothAdapter
import br.com.grupotechnos.corenext.ble.BlePermissions
import br.com.grupotechnos.corenext.bridge.EventMapper
import br.com.grupotechnos.corenext.bridge.HostErrorCodes
import br.com.grupotechnos.corenext.bridge.PendingEvents
import br.com.grupotechnos.corenext.bridge.SavedDataMapper
import br.com.grupotechnos.corenext.bridge.StateMapper
import br.com.grupotechnos.corenext.bridge.WritableConverter
import br.com.grupotechnos.watch.protocol.domain.DataKind
import br.com.grupotechnos.watch.protocol.domain.WatchErrorCodes
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.profile.DeviceProfile
import br.com.grupotechnos.watch.protocol.session.WatchSession
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReadableType
import java.time.ZoneId

/**
 * TurboModule `NativeCoreNext`. Só traduz JS ↔ [WatchSession]: nenhuma regra de protocolo mora aqui.
 *
 * Comandos que falam com o relógio registram a Promise no [CoreGraph.requests] com um `requestId` e chamam a
 * sessão; o [CoreSessionListener] emite o evento e liquida a Promise no callback terminal. Erros detectados aqui
 * (permissão, Bluetooth desligado, nome desconhecido) rejeitam na hora e também saem como `onError` (`requestId -1`).
 *
 * Os métodos rodam na thread de módulos nativos do RN; `getHistoryPedometer`/`exportLogs` fazem IO de arquivo
 * pequeno ali mesmo. Eventos saem pelo [PendingEvents] do grafo; este módulo é o [PendingEvents.Sink] enquanto vive.
 */
class NativeCoreNextModule(reactContext: ReactApplicationContext) :
	NativeCoreNextSpec(reactContext),
	LifecycleEventListener,
	PendingEvents.Sink<Map<String, Any?>> {
	@Volatile private var attachedGraph: CoreGraph? = null

	init {
		reactContext.addLifecycleEventListener(this)
	}

	// region Ciclo de vida

	override fun invalidate() {
		reactApplicationContext.removeLifecycleEventListener(this)
		attachedGraph?.let { graph ->
			graph.events.detach(this)
			// O JS que esperava estas Promises morreu (reload ou destruição); libera as entradas.
			graph.requests.drain().forEach { it.token?.reject(WatchErrorCodes.CANCELLED, "Module invalidated") }
		}
		attachedGraph = null
		super.invalidate()
	}

	override fun onHostResume() {
		val graph = attachedGraph ?: return
		graph.events.flush()
		graph.reconnectIfPaired("host resume")
	}

	override fun onHostPause() {}

	override fun onHostDestroy() {}

	override fun canEmit(): Boolean = reactApplicationContext.hasActiveReactInstance() && mEventEmitterCallback != null

	override fun emit(name: String, payload: Map<String, Any?>) {
		val map = WritableConverter.toMap(payload)
		when (name) {
			"onScannedDevice" -> emitOnScannedDevice(map)
			"onConnectStateChanged" -> emitOnConnectStateChanged(map)
			"onDeviceInfo" -> emitOnDeviceInfo(map)
			"onFirmwareInfo" -> emitOnFirmwareInfo(map)
			"onBatteryStatus" -> emitOnBatteryStatus(map)
			"onPedometer" -> emitOnPedometer(map)
			"onHistoryPedometer" -> emitOnHistoryPedometer(map)
			"onHistorySleep" -> emitOnHistorySleep(map)
			"onSyncStarted" -> emitOnSyncStarted(map)
			"onSyncProgress" -> emitOnSyncProgress(map)
			"onSyncFinished" -> emitOnSyncFinished(map)
			"onError" -> emitOnError(map)
			"onLog" -> emitOnLog(map)
			else -> throw IllegalArgumentException("Unknown event $name")
		}
	}

	// endregion

	// region Inicialização

	override fun initialize(promise: Promise) {
		val graph = graph()
		graph.emitCurrentState()
		graph.reconnectIfPaired("initialize")
		promise.resolve(null)
	}

	override fun initSMASDK(promise: Promise) {
		initialize(promise)
	}

	// endregion

	// region Scan e conexão

	override fun scan() {
		val graph = graph()
		if (!BlePermissions.hasScanPermission(reactApplicationContext)) {
			graph.emitError(WatchSession.NO_REQUEST_ID, HostErrorCodes.PERMISSION_DENIED, "Missing ${BlePermissions.scanPermissionName()}", "scan")
			return
		}
		if (!BlePermissions.isBluetoothEnabled(reactApplicationContext)) {
			graph.emitError(WatchSession.NO_REQUEST_ID, HostErrorCodes.BLUETOOTH_OFF, "Bluetooth is off", "scan")
			return
		}
		graph.scanner.start()
	}

	override fun stopScan() {
		graph().scanner.stop()
	}

	override fun pairDevice(deviceId: String, name: String, promise: Promise) {
		val graph = graph()
		val profile = checkConnectTarget(graph, "pairDevice", deviceId, name, promise) ?: return
		graph.scanner.stop()
		graph.userDisconnected = false
		graph.recorder.deviceName = profile.bleNames.firstOrNull() ?: profile.appName
		val requestId = graph.requests.register("pairDevice", promise)
		graph.session.pair(requestId, deviceId, profile.id)
	}

	override fun startPairingAttempt(deviceId: String, name: String, promise: Promise) {
		val graph = graph()
		val profile = checkConnectTarget(graph, "startPairingAttempt", deviceId, name, promise) ?: return
		graph.userDisconnected = false
		graph.recorder.deviceName = profile.bleNames.firstOrNull() ?: profile.appName
		// Sem Promise no registro: a reconexão pode levar horas (relógio fora de alcance); o JS acompanha pelo estado.
		val requestId = graph.requests.register("startPairingAttempt", null)
		graph.session.reconnect(requestId, deviceId, profile.id)
		promise.resolve(null)
	}

	override fun disconnectCurrentDevice(promise: Promise) {
		val graph = graph()
		graph.userDisconnected = true
		graph.session.disconnect(graph.requests.register("disconnectCurrentDevice", promise), false)
	}

	override fun forgetDevice(promise: Promise) {
		val graph = graph()
		graph.userDisconnected = true
		graph.prefs.clear()
		graph.session.disconnect(graph.requests.register(CoreSessionListener.METHOD_FORGET, promise), true)
	}

	override fun isConnected(promise: Promise) {
		promise.resolve(StateMapper.isConnected(graph().session.state))
	}

	override fun getLastPairedDevice(promise: Promise) {
		val pairing = graph().prefs.load()
		if (pairing == null) {
			promise.resolve(null)
			return
		}
		promise.resolve(WritableConverter.toMap(EventMapper.lastPairedDevice(pairing.address, pairing.name, pairing.profileId)))
	}

	// endregion

	// region Comandos ao relógio

	override fun getDeviceInfo(promise: Promise) = command(CoreSessionListener.METHOD_DEVICE_INFO, promise) { session, id ->
		session.readDeviceInfo(id)
	}

	override fun getFirmwareInfo(promise: Promise) = command(CoreSessionListener.METHOD_FIRMWARE_INFO, promise) { session, id ->
		session.readDeviceInfo(id)
	}

	override fun getBatteryStatus(promise: Promise) = command("getBatteryStatus", promise) { session, id ->
		session.readBattery(id)
	}

	override fun setTime(promise: Promise) = command("setTime", promise) { session, id ->
		session.setTime(id)
	}

	override fun refreshSteps(promise: Promise) = command("refreshSteps", promise) { session, id ->
		session.refreshSteps(id)
	}

	override fun syncDataHistory(promise: Promise) = command("syncDataHistory", promise) { session, id ->
		session.syncHistory(id, listOf(DataKind.STEPS, DataKind.SLEEP))
	}

	// endregion

	// region Histórico local

	override fun getHistoryPedometer(daysBefore: Double, promise: Promise) {
		val graph = graph()
		try {
			val days = graph.session.getStepsDays(daysBefore.toInt().coerceAtLeast(0))
			graph.events.emit("onHistoryPedometer", EventMapper.historyPedometer(days))
			promise.resolve(null)
		} catch (error: RuntimeException) {
			rejectEarly(graph, promise, "getHistoryPedometer", HostErrorCodes.IO_ERROR, error.message ?: error.javaClass.simpleName)
		}
	}

	override fun getHistorySleep(promise: Promise) {
		val graph = graph()
		val sessions = try {
			graph.session.getSleepSessions(graph.sleepHistoryDays())
		} catch (error: RuntimeException) {
			rejectEarly(graph, promise, "getHistorySleep", HostErrorCodes.IO_ERROR, error.message ?: error.javaClass.simpleName)
			return
		}
		if (sessions.isEmpty()) {
			// Nunca fica mudo (critério exploratório do plano): sem sono gravado vira NO_DATA, evento e rejeição.
			rejectEarly(graph, promise, "getHistorySleep", WatchErrorCodes.NO_DATA, "No sleep sessions stored")
			return
		}
		graph.events.emit("onHistorySleep", EventMapper.historySleep(sessions, ZoneId.systemDefault()))
		promise.resolve(null)
	}

	override fun deletedSavedData(filteredArrayData: ReadableArray, category: Double) {
		val graph = graph()
		val zone = ZoneId.systemDefault()
		val byKind = LinkedHashMap<DataKind, MutableList<String>>()
		for (index in 0 until filteredArrayData.size()) {
			val (itemCategory, registeredAt) = readSavedItem(filteredArrayData, index, category.toInt()) ?: continue
			val kind = SavedDataMapper.kindForCategory(itemCategory)
			if (kind == null) {
				graph.logger.log(LogLevel.WARN, "NativeCoreNextModule/deletedSavedData", "Ignoring category $itemCategory")
				continue
			}
			byKind.getOrPut(kind) { mutableListOf() } += registeredAt
		}
		for ((kind, dates) in byKind) {
			val result = SavedDataMapper.dayKeys(dates, zone)
			if (result.rejected.isNotEmpty()) {
				graph.logger.log(LogLevel.WARN, "NativeCoreNextModule/deletedSavedData", "Unreadable dates: ${result.rejected}")
			}
			graph.logger.log(LogLevel.INFO, "NativeCoreNextModule/deletedSavedData", "kind=$kind dayKeys=${result.dayKeys}")
			if (result.dayKeys.isNotEmpty()) graph.session.confirmUploaded(kind, result.dayKeys)
		}
	}

	// endregion

	// region Logs

	override fun getLogs(limit: Double, promise: Promise) {
		val entries = graph().logger.entries(limit.toInt())
		val list = entries.map { EventMapper.log(it.ts, it.level, it.tag, it.message, it.dir?.name, it.hex) }
		promise.resolve(WritableConverter.toArray(list))
	}

	override fun exportLogs(promise: Promise) {
		val graph = graph()
		try {
			promise.resolve(graph.exportLogs())
		} catch (error: Exception) {
			rejectEarly(graph, promise, "exportLogs", HostErrorCodes.IO_ERROR, error.message ?: error.javaClass.simpleName)
		}
	}

	override fun clearLogs() {
		graph().logger.clear()
	}

	override fun setLogLevel(level: Double) {
		val graph = graph()
		val newLevel = LogLevel.entries.getOrNull(level.toInt())
		if (newLevel == null) {
			graph.logger.log(LogLevel.WARN, "NativeCoreNextModule/setLogLevel", "Invalid level $level")
			return
		}
		graph.logger.minLevel = newLevel
	}

	// endregion

	// region Auxiliares

	/** Grafo do processo, ligando este módulo como destino de eventos na primeira vez. */
	private fun graph(): CoreGraph {
		attachedGraph?.let { return it }
		val graph = CoreGraph.get(reactApplicationContext)
		attachedGraph = graph
		graph.events.attach(this)
		return graph
	}

	private inline fun command(method: String, promise: Promise, call: (WatchSession, Int) -> Unit) {
		val graph = graph()
		call(graph.session, graph.requests.register(method, promise))
	}

	/** Valida permissão, Bluetooth, MAC e nome antes de conectar. Devolve o perfil, ou `null` depois de rejeitar. */
	private fun checkConnectTarget(graph: CoreGraph, method: String, deviceId: String, name: String, promise: Promise): DeviceProfile? {
		if (!BlePermissions.hasConnectPermission(reactApplicationContext)) {
			rejectEarly(graph, promise, method, HostErrorCodes.PERMISSION_DENIED, "Missing BLUETOOTH_CONNECT")
			return null
		}
		if (!BlePermissions.isBluetoothEnabled(reactApplicationContext)) {
			rejectEarly(graph, promise, method, HostErrorCodes.BLUETOOTH_OFF, "Bluetooth is off")
			return null
		}
		if (!BluetoothAdapter.checkBluetoothAddress(deviceId)) {
			rejectEarly(graph, promise, method, HostErrorCodes.INVALID_ARGUMENT, "Invalid Bluetooth address $deviceId")
			return null
		}
		val profile = graph.resolveProfile(name)
		if (profile == null) {
			rejectEarly(graph, promise, method, WatchErrorCodes.UNSUPPORTED_DEVICE, "Unsupported device name $name")
			return null
		}
		return profile
	}

	private fun rejectEarly(graph: CoreGraph, promise: Promise, method: String, code: String, message: String) {
		graph.emitError(WatchSession.NO_REQUEST_ID, code, message, method)
		promise.reject(code, message)
	}

	/**
	 * Lê um item do `deletedSavedData`. Aceita o formato do spec (`{ category, registered_at }`) e, por
	 * compatibilidade, a string pura que o wrapper do Core atual manda (`TechnosWareCore/src/NativeModules/index.ts:763-768`).
	 */
	private fun readSavedItem(array: ReadableArray, index: Int, fallbackCategory: Int): Pair<Int, String>? =
		when (array.getType(index)) {
			ReadableType.String -> array.getString(index)?.let { fallbackCategory to it }
			ReadableType.Map -> array.getMap(index)?.let { item -> readSavedMap(item, fallbackCategory) }
			else -> null
		}

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

	// endregion

	companion object {
		const val NAME = NativeCoreNextSpec.NAME
	}
}

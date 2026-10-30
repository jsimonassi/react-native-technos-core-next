package br.com.grupotechnos.corenext

import br.com.grupotechnos.corenext.bridge.PromiseCompletion
import br.com.grupotechnos.corenext.bridge.ReadableConverter
import br.com.grupotechnos.corenext.bridge.WritableConverter
import br.com.grupotechnos.watch.bridge.CoreBridge
import br.com.grupotechnos.watch.bridge.CoreEventSink
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray

/**
 * TurboModule `NativeCoreNext`: uma casca sobre o [CoreBridge] do Repo 1. Cada método JS chama o método de mesmo nome
 * do controlador, com a `Promise` embrulhada num [PromiseCompletion]; nenhuma regra mora aqui (checagens, eventos,
 * ordem evento/`resolve`, rejeições, pareamento salvo e reconexão estão no [CoreBridge]).
 *
 * O que fica aqui é só o que depende do React Native: o [CoreEventSink] (o `emitOnX` gerado pelo codegen para cada nome,
 * com o payload pelo [WritableConverter]), a conversão do `ReadableArray` do `deletedSavedData` ([ReadableConverter]) e
 * os ganchos de ciclo de vida.
 *
 * Os métodos rodam na thread de módulos nativos do RN; `getHistoryPedometer`/`exportLogs` fazem IO de arquivo pequeno
 * ali mesmo. Este módulo é o destino dos eventos do [CoreBridge] enquanto vive.
 */
class NativeCoreNextModule(reactContext: ReactApplicationContext) :
	NativeCoreNextSpec(reactContext),
	LifecycleEventListener,
	CoreEventSink {
	/** O controlador, depois que este módulo se ligou a ele (primeiro método JS); `null` antes e depois do `invalidate`. */
	@Volatile private var attachedBridge: CoreBridge? = null

	init {
		reactContext.addLifecycleEventListener(this)
	}

	// region Ciclo de vida

	override fun invalidate() {
		reactApplicationContext.removeLifecycleEventListener(this)
		// O JS que esperava as Promises pendentes morreu (reload ou destruição): o CoreBridge as rejeita com CANCELLED.
		attachedBridge?.invalidate(this)
		attachedBridge = null
		super.invalidate()
	}

	override fun onHostResume() {
		attachedBridge?.onHostResume()
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

	override fun initialize(promise: Promise) = bridge().initialize(PromiseCompletion(promise))

	override fun initSMASDK(promise: Promise) = bridge().initSMASDK(PromiseCompletion(promise))

	// endregion

	// region Scan e conexão

	override fun scan() = bridge().scan()

	override fun stopScan() = bridge().stopScan()

	override fun pairDevice(deviceId: String, name: String, promise: Promise) =
		bridge().pairDevice(deviceId, name, PromiseCompletion(promise))

	override fun startPairingAttempt(deviceId: String, name: String, promise: Promise) =
		bridge().startPairingAttempt(deviceId, name, PromiseCompletion(promise))

	override fun disconnectCurrentDevice(promise: Promise) = bridge().disconnectCurrentDevice(PromiseCompletion(promise))

	override fun forgetDevice(promise: Promise) = bridge().forgetDevice(PromiseCompletion(promise))

	override fun isConnected(promise: Promise) = bridge().isConnected(PromiseCompletion(promise))

	override fun getLastPairedDevice(promise: Promise) = bridge().getLastPairedDevice(PromiseCompletion(promise))

	// endregion

	// region Comandos ao relógio

	override fun getDeviceInfo(promise: Promise) = bridge().getDeviceInfo(PromiseCompletion(promise))

	override fun getFirmwareInfo(promise: Promise) = bridge().getFirmwareInfo(PromiseCompletion(promise))

	override fun getBatteryStatus(promise: Promise) = bridge().getBatteryStatus(PromiseCompletion(promise))

	override fun setTime(promise: Promise) = bridge().setTime(PromiseCompletion(promise))

	override fun refreshSteps(promise: Promise) = bridge().refreshSteps(PromiseCompletion(promise))

	override fun syncDataHistory(promise: Promise) = bridge().syncDataHistory(PromiseCompletion(promise))

	// endregion

	// region Histórico local

	override fun getHistoryPedometer(daysBefore: Double, promise: Promise) =
		bridge().getHistoryPedometer(daysBefore, PromiseCompletion(promise))

	override fun getHistorySleep(promise: Promise) = bridge().getHistorySleep(PromiseCompletion(promise))

	override fun deletedSavedData(filteredArrayData: ReadableArray, category: Double) =
		bridge().deletedSavedData(ReadableConverter.toList(filteredArrayData), category)

	// endregion

	// region Logs

	override fun getLogs(limit: Double, promise: Promise) = bridge().getLogs(limit, PromiseCompletion(promise))

	override fun exportLogs(promise: Promise) = bridge().exportLogs(PromiseCompletion(promise))

	override fun clearLogs() = bridge().clearLogs()

	override fun setLogLevel(level: Double) = bridge().setLogLevel(level)

	// endregion

	/**
	 * O controlador do processo, ligando este módulo como destino de eventos na primeira vez (o [CoreBridge.attach]
	 * entrega a fila). As chamadas seguintes não religam: um módulo antigo que ainda receba uma chamada não toma o
	 * lugar do atual.
	 */
	private fun bridge(): CoreBridge {
		attachedBridge?.let { return it }
		val bridge = CoreGraph.get(reactApplicationContext).bridge
		attachedBridge = bridge
		bridge.attach(this)
		return bridge
	}

	companion object {
		const val NAME = NativeCoreNextSpec.NAME
	}
}

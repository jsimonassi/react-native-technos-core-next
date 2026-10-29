package br.com.grupotechnos.corenext

import br.com.grupotechnos.corenext.ble.SyncForegroundService
import br.com.grupotechnos.corenext.bridge.EventMapper
import br.com.grupotechnos.corenext.store.PairingPrefs
import br.com.grupotechnos.watch.protocol.domain.Battery
import br.com.grupotechnos.watch.protocol.domain.ConnectionState
import br.com.grupotechnos.watch.protocol.domain.DeviceInfo
import br.com.grupotechnos.watch.protocol.domain.StepsDay
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.profile.DeviceRegistry
import br.com.grupotechnos.watch.protocol.session.WatchSession
import br.com.grupotechnos.watch.protocol.session.WatchSessionListener

/**
 * Saída da [WatchSession] para o resto do Core. Roda na thread da sessão.
 *
 * Faz três coisas, nesta ordem, em cada callback:
 * 1. efeitos do processo: grava o pareamento ao chegar em `READY`, sobe e desce o [SyncForegroundService],
 *    atualiza o cabeçalho do `FrameRecorder`;
 * 2. emite o evento JS correspondente (pelo [CoreGraph.events], que guarda se o JS ainda não estiver pronto);
 * 3. liquida a Promise do comando, se o callback for terminal (regra do `requestId` do [WatchSessionListener]).
 *
 * O evento sai antes do `resolve` para quem espera a Promise já encontrar o dado emitido.
 * Toda falha de comando também sai como `onError`, com o nome do método JS que a originou.
 */
internal class CoreSessionListener(private val graph: CoreGraph) : WatchSessionListener {
	@Volatile private var activeSyncRequestId: Int? = null

	override fun onStateChanged(state: ConnectionState, phase: String?) {
		graph.logger.log(LogLevel.INFO, "CoreSessionListener/onStateChanged", "state=$state phase=$phase")
		// Depois de um disconnect/forget do usuário não grava: um handshake que chega a READY entre o forgetDevice e a
		// sessão processar o disconnect regravaria o relógio esquecido, e o próximo processo reconectaria a ele.
		if (state == ConnectionState.READY && !graph.userDisconnected) savePairing()
		if (state != ConnectionState.READY && state != ConnectionState.SYNCING) stopSyncService("state=$state")
		graph.events.emit("onConnectStateChanged", EventMapper.connectStateChanged(state, phase))
	}

	override fun onDeviceInfo(requestId: Int, info: DeviceInfo) {
		graph.recorder.firmware = info.firmware
		graph.recorder.deviceName = info.bleName
		val entry = graph.requests.take(requestId)
		// getDeviceInfo e getFirmwareInfo usam a mesma leitura; cada um emite o seu evento. Espontâneo emite os dois.
		when (entry?.method) {
			METHOD_FIRMWARE_INFO -> graph.events.emit("onFirmwareInfo", EventMapper.firmwareInfo(info))
			METHOD_DEVICE_INFO -> graph.events.emit("onDeviceInfo", EventMapper.deviceInfo(info))
			else -> {
				graph.events.emit("onDeviceInfo", EventMapper.deviceInfo(info))
				graph.events.emit("onFirmwareInfo", EventMapper.firmwareInfo(info))
			}
		}
		entry?.token?.resolve(null)
	}

	override fun onBattery(requestId: Int, battery: Battery) {
		graph.events.emit("onBatteryStatus", EventMapper.battery(battery))
		graph.requests.take(requestId)?.token?.resolve(null)
	}

	override fun onLiveSteps(requestId: Int, today: StepsDay) {
		graph.events.emit("onPedometer", EventMapper.pedometer(today))
		graph.requests.take(requestId)?.token?.resolve(null)
	}

	override fun onSyncStarted(requestId: Int) {
		activeSyncRequestId = requestId
		SyncForegroundService.start(graph.appContext)
		graph.events.emit("onSyncStarted", EventMapper.empty())
	}

	override fun onSyncProgress(requestId: Int, percent: Int) {
		graph.events.emit("onSyncProgress", EventMapper.syncProgress(percent))
	}

	override fun onSyncFinished(requestId: Int) {
		if (activeSyncRequestId == requestId) stopSyncService("sync finished")
		graph.events.emit("onSyncFinished", EventMapper.empty())
		graph.requests.take(requestId)?.token?.resolve(null)
	}

	override fun onCompleted(requestId: Int) {
		val entry = graph.requests.take(requestId)
		if (entry?.method == METHOD_FORGET) clearForgottenPairing()
		entry?.token?.resolve(null)
	}

	override fun onError(requestId: Int, code: String, message: String) {
		if (activeSyncRequestId == requestId) stopSyncService("sync error $code")
		val entry = graph.requests.take(requestId)
		if (entry?.method == METHOD_FORGET) clearForgottenPairing()
		graph.emitError(requestId, code, message, entry?.method)
		entry?.token?.reject(code, message)
	}

	private fun savePairing() {
		val address = graph.session.currentAddress ?: return
		val profileId = graph.session.currentProfileId ?: return
		val name = DeviceRegistry.byId(profileId)?.appName ?: profileId
		graph.prefs.save(PairingPrefs.Pairing(address, profileId, name))
	}

	/**
	 * Fim do `forgetDevice`: apaga o pareamento de novo, agora que a sessão já processou o disconnect. O módulo já
	 * apagou ao receber o pedido; esta segunda vez cobre um READY que tenha gravado no meio. Se o usuário já pediu
	 * outro pareamento ([CoreGraph.userDisconnected] voltou a `false`), o que está salvo é o novo e fica.
	 */
	private fun clearForgottenPairing() {
		if (graph.userDisconnected) graph.prefs.clear()
	}

	private fun stopSyncService(reason: String) {
		if (activeSyncRequestId == null) return
		activeSyncRequestId = null
		graph.logger.log(LogLevel.DEBUG, "CoreSessionListener/stopSyncService", reason)
		SyncForegroundService.stop()
	}

	companion object {
		const val METHOD_DEVICE_INFO = "getDeviceInfo"
		const val METHOD_FIRMWARE_INFO = "getFirmwareInfo"
		const val METHOD_FORGET = "forgetDevice"
	}
}

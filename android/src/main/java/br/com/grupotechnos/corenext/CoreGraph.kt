package br.com.grupotechnos.corenext

import android.content.Context
import br.com.grupotechnos.corenext.ble.AndroidGattTransport
import br.com.grupotechnos.corenext.ble.BlePermissions
import br.com.grupotechnos.corenext.ble.BleScanner
import br.com.grupotechnos.corenext.ble.BluetoothStateReceiver
import br.com.grupotechnos.corenext.ble.SyncForegroundService
import br.com.grupotechnos.corenext.bridge.EventMapper
import br.com.grupotechnos.corenext.bridge.PendingEvents
import br.com.grupotechnos.corenext.bridge.RequestRegistry
import br.com.grupotechnos.corenext.log.FrameRecorder
import br.com.grupotechnos.corenext.log.RingLogger
import br.com.grupotechnos.corenext.store.FileSampleStore
import br.com.grupotechnos.corenext.store.PairingPrefs
import br.com.grupotechnos.watch.protocol.domain.ConnectionState
import br.com.grupotechnos.watch.protocol.domain.WatchErrorCodes
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.profile.DeviceProfile
import br.com.grupotechnos.watch.protocol.profile.DeviceRegistry
import br.com.grupotechnos.watch.protocol.profile.Profiles
import br.com.grupotechnos.watch.protocol.session.WatchSession
import com.facebook.react.bridge.Promise
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * Grafo nativo do Core, um por processo: sessão, transporte, logger, store, scanner e fila de eventos.
 *
 * Por que por processo e não por módulo: o TurboModule é recriado a cada reload do JS (e o RN pode destruí-lo
 * antes do processo), mas o link BLE, a sincronização em andamento e o histórico local não podem cair junto.
 * O módulo só se liga ([PendingEvents.attach]) e desliga do grafo.
 *
 * Criado sob demanda no primeiro método JS (ou no `initialize()`), no `applicationContext`.
 */
class CoreGraph private constructor(context: Context) {
	val appContext: Context = context.applicationContext
	val recorder = FrameRecorder()
	val logger = RingLogger(recorder)
	val transport = AndroidGattTransport(appContext, logger)
	val store = FileSampleStore(File(appContext.filesDir, STORE_DIR), logger)
	val session = WatchSession(transport, logger, store)
	val prefs = PairingPrefs(appContext)
	val events = PendingEvents<Map<String, Any?>>()
	val requests = RequestRegistry<Promise>()
	val scanner = BleScanner(
		appContext,
		logger,
		onDevice = { hit ->
			events.emit("onScannedDevice", EventMapper.scannedDevice(hit.profile, hit.address, hit.rssi, hit.bleName))
		},
		onFailure = { errorCode, message ->
			emitError(WatchSession.NO_REQUEST_ID, WatchErrorCodes.TRANSPORT, "$message (errorCode=$errorCode)", "scan")
		},
	)
	private val listener = CoreSessionListener(this)
	private val bluetoothReceiver = BluetoothStateReceiver(appContext, ::onBluetoothStateChanged)

	/**
	 * `true` depois de `disconnectCurrentDevice`/`forgetDevice` e até o próximo `pairDevice`/`startPairingAttempt`.
	 * Impede a reconexão automática (resume do app, Bluetooth religado) de desfazer um "desconectar" explícito.
	 * Só em memória: num processo novo o relógio pareado volta a ser reconectado, como o Core atual faz no boot.
	 */
	@Volatile var userDisconnected = false

	init {
		transport.attach(session.events)
		session.setListener(listener)
		SyncForegroundService.logger = logger
		logger.onEntry = { entry ->
			// onLog não entra na fila: é volumoso e já fica no anel do RingLogger (getLogs).
			events.emit(
				"onLog",
				EventMapper.log(entry.ts, entry.level, entry.tag, entry.message, entry.dir?.name, entry.hex),
				queueIfNotReady = false,
			)
		}
		bluetoothReceiver.register()
		logger.log(LogLevel.INFO, "CoreGraph/init", "Native graph created")
	}

	/**
	 * Reenvia o estado atual como `onConnectStateChanged` (fase `null`, que a sessão não expõe). O grafo e a sessão
	 * sobrevivem ao reload do JS, mas o JS novo só soube das transições que caíram no intervalo do reload: com o relógio
	 * já `READY`, ficaria sem estado até a próxima transição. O `initialize()` chama isto depois de o JS se inscrever.
	 *
	 * Uma transição da thread da sessão pode sair entre a leitura e a emissão; por isso relê depois de emitir e
	 * reenvia se mudou, para o último evento ser sempre o estado atual.
	 */
	fun emitCurrentState() {
		var emitted: ConnectionState
		do {
			emitted = session.state
			events.emit("onConnectStateChanged", EventMapper.connectStateChanged(emitted, null))
		} while (session.state != emitted)
	}

	/** Emite `onError` (`ErrorEvent`). */
	fun emitError(requestId: Int, code: String, message: String, method: String?) {
		logger.log(LogLevel.WARN, "CoreGraph/emitError", "method=$method requestId=$requestId code=$code message=$message")
		events.emit("onError", EventMapper.error(requestId, code, message, method))
	}

	/**
	 * Perfil a partir do nome que o JS passa em `pairDevice(deviceId, name)`: aceita o `appName` (`"fitGPS"`, o que o
	 * app Mormaii manda hoje, `AvailableDevices.java:21-23` do Core atual), o nome BLE (`"Mormaii_fitGPS"`) e o `id`.
	 */
	fun resolveProfile(name: String): DeviceProfile? =
		Profiles.all.firstOrNull { profile -> name == profile.appName || name == profile.id || name in profile.bleNames }

	/** Dias de sono pedidos à sessão em `getHistorySleep` (o spec não tem parâmetro): a retenção do perfil. */
	fun sleepHistoryDays(): Int {
		val profileId = session.currentProfileId ?: prefs.load()?.profileId
		return profileId?.let(DeviceRegistry::byId)?.quirks?.historyRetentionDays ?: DEFAULT_HISTORY_DAYS
	}

	/**
	 * Reconecta ao relógio salvo se fizer sentido: há pareamento salvo, ninguém pediu para desconectar, a sessão está
	 * parada, o Bluetooth está ligado e há permissão. É o equivalente nativo do `useSdkInit` do app Mormaii, que chama
	 * `pairDevice(lastDevice)` a cada vez que o app volta ao primeiro plano (`useSdkInit.ts:15-32`).
	 *
	 * @return `true` se pediu a reconexão.
	 */
	fun reconnectIfPaired(reason: String): Boolean {
		if (userDisconnected) return false
		val pairing = prefs.load() ?: return false
		val state = session.state
		if (state != ConnectionState.DISCONNECTED && state != ConnectionState.BLUETOOTH_OFF) return false
		if (!BlePermissions.isBluetoothEnabled(appContext) || !BlePermissions.hasConnectPermission(appContext)) return false
		logger.log(LogLevel.INFO, "CoreGraph/reconnectIfPaired", "Reconnecting to ${pairing.address} ($reason)")
		DeviceRegistry.byId(pairing.profileId)?.bleNames?.firstOrNull()?.let { recorder.deviceName = it }
		session.reconnect(requests.nextId(), pairing.address, pairing.profileId)
		return true
	}

	/**
	 * Grava logs e frames em `getExternalFilesDir(null)/corenext/` (acessível por `adb pull` sem root;
	 * cai para `filesDir` se o armazenamento externo do app não estiver disponível).
	 *
	 * @return caminho absoluto do `.jsonl` de frames (formato de fixture do Repo 1).
	 */
	fun exportLogs(): String {
		val base = appContext.getExternalFilesDir(null) ?: appContext.filesDir
		val dir = File(base, EXPORT_DIR)
		val stamp = LocalDateTime.now().format(STAMP)
		recorder.mtu = transport.currentMtu
		val frames = File(dir, "frames-$stamp.jsonl")
		val logs = File(dir, "logs-$stamp.jsonl")
		recorder.writeTo(frames)
		logger.writeTo(logs)
		logger.log(LogLevel.INFO, "CoreGraph/exportLogs", "Exported ${recorder.packetCount} packets to ${frames.absolutePath}, logs to ${logs.absolutePath}")
		return frames.absolutePath
	}

	private fun onBluetoothStateChanged(enabled: Boolean) {
		if (!enabled) scanner.stop()
		transport.onBluetoothStateChanged(enabled) {
			if (enabled) reconnectIfPaired("Bluetooth turned on")
		}
	}

	companion object {
		const val STORE_DIR = "corenext"
		const val EXPORT_DIR = "corenext"
		const val DEFAULT_HISTORY_DAYS = 30

		private val STAMP: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")

		@Volatile private var instance: CoreGraph? = null

		/** Instância do processo, criada na primeira chamada. */
		fun get(context: Context): CoreGraph =
			instance ?: synchronized(this) {
				instance ?: CoreGraph(context).also { instance = it }
			}
	}
}

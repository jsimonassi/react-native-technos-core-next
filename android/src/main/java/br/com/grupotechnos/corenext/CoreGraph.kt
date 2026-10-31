package br.com.grupotechnos.corenext

import android.content.Context
import br.com.grupotechnos.corenext.ble.AndroidGattTransport
import br.com.grupotechnos.corenext.ble.BleScanner
import br.com.grupotechnos.corenext.ble.BluetoothStateReceiver
import br.com.grupotechnos.corenext.ble.ClassicBonder
import br.com.grupotechnos.corenext.ble.SyncForegroundService
import br.com.grupotechnos.corenext.log.FrameRecorder
import br.com.grupotechnos.corenext.log.RingLogger
import br.com.grupotechnos.corenext.store.FileSampleStore
import br.com.grupotechnos.corenext.store.PairingPrefs
import br.com.grupotechnos.watch.bridge.CoreBridge
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.session.WatchSession
import java.io.File

/**
 * Montagem nativa do Core, uma por processo: sessão, transporte, logger, store, scanner, o [AndroidCoreHost] e o
 * [CoreBridge] do Repo 1 sobre eles.
 *
 * Por que por processo e não por módulo: o TurboModule é recriado a cada reload do JS (e o RN pode destruí-lo
 * antes do processo), mas o link BLE, a sincronização em andamento e o histórico local não podem cair junto.
 * O módulo só se liga ([CoreBridge.attach]) e desliga ([CoreBridge.invalidate]) do controlador.
 *
 * Não decide nada: o que cada método JS faz mora no [CoreBridge]. Aqui ficam só as ligações que dependem do Android:
 * o scanner, o [ClassicBonder] e o log entregam ao controlador, e o [BluetoothStateReceiver] passa pelo transporte (que
 * tem o papel dele no contrato B do Repo 1) antes de avisar o controlador.
 *
 * Criado sob demanda no primeiro método JS (ou no `initialize()`), no `applicationContext`.
 */
class CoreGraph private constructor(context: Context) {
	private val appContext: Context = context.applicationContext
	private val recorder = FrameRecorder()
	private val logger = RingLogger(recorder)
	private val transport = AndroidGattTransport(appContext, logger)
	private val store = FileSampleStore(File(appContext.filesDir, STORE_DIR), logger)
	private val session = WatchSession(transport, logger, store)
	private val prefs = PairingPrefs(appContext)
	private val scanner = BleScanner(
		appContext,
		logger,
		onDevice = { hit ->
			bridge.onScannedDevice(profile = hit.profile, address = hit.address, rssi = hit.rssi, bleName = hit.bleName)
		},
		onFailure = { errorCode, message -> bridge.onScanFailed(errorCode, message) },
	)
	private val bluetoothReceiver = BluetoothStateReceiver(appContext, ::onBluetoothStateChanged)

	// O resultado só chega depois de um requestClassicBond, que o CoreBridge faz no READY: o bridge já existe.
	private val classicBonder = ClassicBonder(appContext, logger) { address, outcome, message ->
		bridge.onClassicBondResult(address, outcome.toClassicBondResult(), message)
	}

	/** O controlador comum: o [NativeCoreNextModule] chama o método de mesmo nome daqui em cada método JS. */
	val bridge: CoreBridge

	init {
		transport.attach(session.events)
		// O construtor liga o listener da sessão; os callbacks do scanner e do log só chegam depois desta linha.
		bridge = CoreBridge(session, logger, AndroidCoreHost(appContext, logger, recorder, prefs, scanner, transport, classicBonder))
		SyncForegroundService.logger = logger
		// O CoreBridge manda o onLog sem fila: é volumoso e já fica no anel do RingLogger (getLogs).
		logger.onEntry = { entry -> bridge.onLogEntry(entry.toCoreLogEntry()) }
		bluetoothReceiver.register()
		// O receiver só avisa transições: com o Bluetooth já desligado na partida, a sessão ficaria em DISCONNECTED e o
		// JS veria 0, não 4. Vem depois do register() para um STATE_ON no meio não se perder (KDoc do método).
		transport.reportBluetoothOffAtStartup()
		// Um esquecer feito com o Bluetooth desligado num processo anterior deixou a remoção do vínculo pendente.
		classicBonder.resumePendingRemovals()
		logger.log(LogLevel.INFO, "CoreGraph/init", "Native graph created")
	}

	/**
	 * Bluetooth desligado: o controlador para o scan antes de o transporte entregar o `false` à sessão. Ligado: o
	 * transporte entrega o `true` à sessão e só então o controlador decide reconectar, para a reconexão entrar na fila
	 * da sessão depois do evento; o [ClassicBonder] roda as remoções de vínculo que o esquecer deixou pendentes com o
	 * Bluetooth desligado (o relógio reabre o clássico com a chave guardada logo que o Bluetooth liga).
	 */
	private fun onBluetoothStateChanged(enabled: Boolean) {
		if (enabled) classicBonder.onBluetoothOn()
		if (!enabled) bridge.onBluetoothTurnedOff()
		transport.onBluetoothStateChanged(enabled) {
			if (enabled) bridge.onBluetoothTurnedOn()
		}
	}

	companion object {
		const val STORE_DIR = "corenext"

		@Volatile private var instance: CoreGraph? = null

		/** Instância do processo, criada na primeira chamada. */
		fun get(context: Context): CoreGraph =
			instance ?: synchronized(this) {
				instance ?: CoreGraph(context).also { instance = it }
			}
	}
}

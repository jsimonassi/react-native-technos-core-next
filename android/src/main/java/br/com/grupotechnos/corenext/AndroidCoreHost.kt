package br.com.grupotechnos.corenext

import android.bluetooth.BluetoothAdapter
import android.content.Context
import br.com.grupotechnos.corenext.ble.AndroidGattTransport
import br.com.grupotechnos.corenext.ble.BlePermissions
import br.com.grupotechnos.corenext.ble.BleScanner
import br.com.grupotechnos.corenext.ble.ClassicBonder
import br.com.grupotechnos.corenext.ble.SyncForegroundService
import br.com.grupotechnos.corenext.log.FrameRecorder
import br.com.grupotechnos.corenext.log.RingLogger
import br.com.grupotechnos.corenext.store.PairingPrefs
import br.com.grupotechnos.watch.bridge.ClassicBondResult
import br.com.grupotechnos.watch.bridge.CoreHost
import br.com.grupotechnos.watch.bridge.CoreLogEntry
import br.com.grupotechnos.watch.bridge.CorePairing
import br.com.grupotechnos.watch.protocol.log.LogLevel
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.ConcurrentHashMap

/**
 * O [CoreHost] do Android: o que o `CoreBridge` (Repo 1, `:bridge`) pede à plataforma, sobre as peças de `ble/`,
 * `store/` e `log/`.
 *
 * Só delega. Nenhuma regra mora aqui: o que cada método JS faz, a ordem evento/`resolve`, quando gravar ou apagar o
 * pareamento, quando ligar o FGS e quando reconectar estão no `CoreBridge` (inventário em `docs/arquitetura.md`,
 * seção 13, do Repo 1). O que dá para conferir sem Android (os nomes das permissões nas mensagens e as conversões
 * entre os tipos daqui e os do `:bridge`) fica nas funções do fim do arquivo, testadas na JVM (`AndroidCoreHostTest`).
 *
 * Threads: as peças já são thread-safe ([BlePermissions] não tem estado, o [BleScanner] e o [ClassicBonder] postam na
 * main, o [PairingPrefs] fica sobre `SharedPreferences`, o [SyncForegroundService] trava o próprio estado e o
 * [RingLogger] e o [FrameRecorder] também), então os métodos podem vir de qualquer thread, como o KDoc do [CoreHost]
 * exige.
 *
 * Fase 3, ainda em stub (S0h): o trabalho de atividade só vai ao log (o motivo atividade do [SyncForegroundService]
 * chega numa fatia seguinte), as preferências ficam só em memória (o `store/PreferencesStore` sobre
 * `SharedPreferences` também) e a autorização de localização é sempre `null`, porque o método é só do iOS.
 */
internal class AndroidCoreHost(
	private val appContext: Context,
	private val logger: RingLogger,
	private val recorder: FrameRecorder,
	private val prefs: PairingPrefs,
	private val scanner: BleScanner,
	private val transport: AndroidGattTransport,
	private val classicBonder: ClassicBonder,
) : CoreHost {
	override fun missingScanPermission(): String? =
		missingPermission(BlePermissions.hasScanPermission(appContext), BlePermissions.scanPermissionName())

	override fun missingConnectPermission(): String? =
		missingPermission(BlePermissions.hasConnectPermission(appContext), CONNECT_PERMISSION)

	override fun isBluetoothEnabled(): Boolean = BlePermissions.isBluetoothEnabled(appContext)

	override fun isValidAddress(address: String): Boolean = BluetoothAdapter.checkBluetoothAddress(address)

	override fun startScan() {
		scanner.start()
	}

	override fun stopScan() {
		scanner.stop()
	}

	override fun startSyncWork() {
		SyncForegroundService.start(appContext)
	}

	override fun stopSyncWork() {
		SyncForegroundService.stop()
	}

	override fun loadPairing(): CorePairing? = prefs.load()?.toCorePairing()

	override fun savePairing(pairing: CorePairing) {
		prefs.save(pairing.toPrefsPairing())
	}

	override fun clearPairing() {
		prefs.clear()
	}

	override fun setRecordingDeviceName(name: String) {
		recorder.deviceName = name
	}

	/** `null` quando o `CoreBridge` trocou o relógio do cabeçalho e o firmware do novo ainda não foi lido. */
	override fun setRecordingFirmware(firmware: String?) {
		recorder.firmware = firmware
	}

	override fun logEntries(limit: Int): List<CoreLogEntry> = logger.entries(limit).map { it.toCoreLogEntry() }

	/**
	 * Grava logs e frames em `getExternalFilesDir(null)/corenext/` (acessível por `adb pull` sem root; cai para
	 * `filesDir` se o armazenamento externo do app não estiver disponível).
	 *
	 * @return caminho absoluto do `.jsonl` de frames (formato de fixture do Repo 1).
	 */
	override fun exportLogs(): String {
		val base = appContext.getExternalFilesDir(null) ?: appContext.filesDir
		val dir = File(base, EXPORT_DIR)
		val stamp = LocalDateTime.now().format(STAMP)
		recorder.mtu = transport.currentMtu
		val frames = File(dir, "frames-$stamp.jsonl")
		val logs = File(dir, "logs-$stamp.jsonl")
		recorder.writeTo(frames)
		logger.writeTo(logs)
		logger.log(LogLevel.INFO, "AndroidCoreHost/exportLogs", "Exported ${recorder.packetCount} packets to ${frames.absolutePath}, logs to ${logs.absolutePath}")
		return frames.absolutePath
	}

	override fun clearLogs() {
		logger.clear()
	}

	override fun setLogLevel(level: LogLevel) {
		logger.minLevel = level
	}

	/** `BOND_BONDED` no sistema para [address] ([ClassicBonder.hasBond]); sem permissão, `false`. */
	override fun hasClassicBond(address: String): Boolean = classicBonder.hasBond(address)

	/** `createBond(TRANSPORT_BREDR)` com uma nova tentativa ([ClassicBonder.request]); o resultado volta pelo `CoreGraph`. */
	override fun requestClassicBond(address: String) {
		classicBonder.request(address)
	}

	/** `removeBond()` por reflexão, no melhor esforço ([ClassicBonder.remove]). */
	override fun removeClassicBond(address: String) {
		classicBonder.remove(address)
	}

	// region Fase 3 (stub)

	/**
	 * Preferências do `CoreBridge` (hoje só `userProfile`), por enquanto só em memória: somem com o processo. Um
	 * `ConcurrentHashMap` porque o `CoreBridge` chama de qualquer thread; ele não aceita valor nulo, então o `null`
	 * apaga a chave.
	 */
	private val preferences = ConcurrentHashMap<String, String>()

	/** Stub: só o log. O `SyncForegroundService` com o motivo atividade ainda não existe. */
	override fun startActivityWork() {
		logger.log(LogLevel.INFO, "AndroidCoreHost/startActivityWork", "Activity work requested; no foreground service yet (stub)")
	}

	/** Stub: só o log, par do [startActivityWork]. */
	override fun stopActivityWork() {
		logger.log(LogLevel.INFO, "AndroidCoreHost/stopActivityWork", "Activity work finished (stub)")
	}

	/** O valor guardado em memória para [key], ou `null`. */
	override fun loadPreference(key: String): String? = preferences[key]

	/** Guarda [value] em memória em [key]; `null` apaga. */
	override fun savePreference(key: String, value: String?) {
		if (value == null) preferences.remove(key) else preferences[key] = value
	}

	/** Sempre `null`: o `checkIosBackgroundLocationPermission` é só do iOS, e o `CoreBridge` rejeita `NOT_SUPPORTED`. */
	override fun locationAuthorization(): String? = null

	// endregion

	companion object {
		/**
		 * Nome da permissão de conexão na mensagem `"Missing BLUETOOTH_CONNECT"`. É o nome curto, e não o
		 * `Manifest.permission.BLUETOOTH_CONNECT` (`android.permission.…`) que a mensagem do scan usa: o host antigo já
		 * escrevia assim, e o JS vê a mensagem.
		 */
		const val CONNECT_PERMISSION = "BLUETOOTH_CONNECT"

		const val EXPORT_DIR = "corenext"

		private val STAMP: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")
	}
}

/** O que o [CoreHost] devolve numa checagem de permissão: `null` se [granted], senão o [name] que vai na mensagem. */
internal fun missingPermission(granted: Boolean, name: String): String? = if (granted) null else name

/** Entrada do anel do [RingLogger] na forma do `:bridge` (o `CoreBridge` a transforma em `onLog` e nos itens do `getLogs`). */
internal fun RingLogger.Entry.toCoreLogEntry(): CoreLogEntry =
	CoreLogEntry(ts = ts, level = level, tag = tag, message = message, dir = dir, hex = hex)

/** Pareamento salvo no [PairingPrefs] na forma do `:bridge`. */
internal fun PairingPrefs.Pairing.toCorePairing(): CorePairing =
	CorePairing(address = address, profileId = profileId, name = name)

/** Pareamento do `:bridge` na forma que o [PairingPrefs] grava. */
internal fun CorePairing.toPrefsPairing(): PairingPrefs.Pairing =
	PairingPrefs.Pairing(address = address, profileId = profileId, name = name)

/**
 * Resultado do [ClassicBonder] na forma do `:bridge`. O Android não tem "não suportado": um sistema que recusa o
 * `createBond` é uma falha ([ClassicBondResult.FAILED]).
 */
internal fun ClassicBonder.Outcome.toClassicBondResult(): ClassicBondResult = when (this) {
	ClassicBonder.Outcome.BONDED -> ClassicBondResult.BONDED
	ClassicBonder.Outcome.FAILED -> ClassicBondResult.FAILED
}

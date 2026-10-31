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

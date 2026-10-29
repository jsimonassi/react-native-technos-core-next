package br.com.grupotechnos.corenext.ble

import android.annotation.SuppressLint
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import br.com.grupotechnos.watch.protocol.profile.DeviceProfile
import br.com.grupotechnos.watch.protocol.profile.DeviceRegistry
import br.com.grupotechnos.watch.protocol.profile.Profiles
import br.com.grupotechnos.watch.protocol.transport.GattUuid

/**
 * Scan de relógios suportados. Fica fora do `Transport`: a sessão não sabe de scan, só de endereço.
 *
 * - Filtros (OU): nome de advertising de cada perfil (`Mormaii_fitGPS`, o filtro seguro, igual ao Core atual em
 *   `SMAService.java:505-526`) e o serviço de cada `GattCandidate`. O fitGPS 0.2.1 não anuncia o NUS (anúncio com
 *   `180f`, `180a` e `00000001-…`, `logs-20261029-083254.jsonl` linha 6, ts 1793272444786), então é o filtro de
 *   nome que o acha; o de serviço fica para outro firmware que anuncie. Os UUIDs anunciados continuam indo para o log.
 * - `SCAN_MODE_LOW_LATENCY` por [SCAN_DURATION_MS] (7 s, o mesmo do Core atual, `SMAService.java:625-635`).
 * - Cada resultado passa por `DeviceRegistry.identify`; só perfis conhecidos viram [onDevice], uma vez por endereço
 *   por scan (o Core atual emite a cada anúncio).
 *
 * Callbacks no main thread. Não confere permissões: o módulo faz isso antes de chamar [start].
 *
 * @param onDevice relógio suportado encontrado.
 * @param onFailure falha do scan (`errorCode` do `ScanCallback`, ou -1 quando não deu para iniciar).
 */
@SuppressLint("MissingPermission")
class BleScanner(
	context: Context,
	private val logger: WatchLogger,
	private val onDevice: (Hit) -> Unit,
	private val onFailure: (errorCode: Int, message: String) -> Unit,
) {
	/** Um relógio suportado visto no scan. */
	data class Hit(val profile: DeviceProfile, val address: String, val rssi: Int, val bleName: String)

	private val appContext = context.applicationContext
	private val main = Handler(Looper.getMainLooper())
	private val seen = HashSet<String>()
	private val logged = HashSet<String>()
	private var callback: ScanCallback? = null
	private val stopRunnable = Runnable { stop() }

	/** `true` enquanto um scan está ativo. */
	val isScanning: Boolean
		get() = callback != null

	/** Inicia (ou reinicia) um scan de [SCAN_DURATION_MS]. Seguro em qualquer thread. */
	fun start() {
		main.post { doStart() }
	}

	/** Para o scan, se houver. Seguro em qualquer thread. */
	fun stop() {
		if (Looper.myLooper() != Looper.getMainLooper()) {
			main.post { stop() }
			return
		}
		main.removeCallbacks(stopRunnable)
		val current = callback ?: return
		callback = null
		try {
			BlePermissions.adapter(appContext)?.bluetoothLeScanner?.stopScan(current)
		} catch (error: RuntimeException) {
			log(LogLevel.WARN, "stop", "Could not stop scan: ${error.message}")
		}
		log(LogLevel.INFO, "stop", "Scan stopped, ${seen.size} supported devices seen")
	}

	private fun doStart() {
		if (callback != null) stop()
		val scanner = BlePermissions.adapter(appContext)?.bluetoothLeScanner
		if (scanner == null) {
			onFailure(-1, "Bluetooth LE scanner unavailable (Bluetooth off?)")
			return
		}
		seen.clear()
		logged.clear()
		val newCallback = object : ScanCallback() {
			override fun onScanResult(callbackType: Int, result: ScanResult) {
				if (callback === this) handle(result)
			}

			override fun onBatchScanResults(results: MutableList<ScanResult>) {
				if (callback === this) results.forEach(::handle)
			}

			override fun onScanFailed(errorCode: Int) {
				if (callback !== this) return
				callback = null
				main.removeCallbacks(stopRunnable)
				log(LogLevel.ERROR, "onScanFailed", "errorCode=$errorCode")
				onFailure(errorCode, "Scan failed (errorCode=$errorCode)")
			}
		}
		val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
		try {
			scanner.startScan(buildFilters(), settings, newCallback)
		} catch (error: RuntimeException) {
			log(LogLevel.ERROR, "start", "startScan threw ${error.javaClass.simpleName}: ${error.message}")
			onFailure(-1, "Could not start scan: ${error.message}")
			return
		}
		callback = newCallback
		main.postDelayed(stopRunnable, SCAN_DURATION_MS)
		log(LogLevel.INFO, "start", "Scanning for ${SCAN_DURATION_MS} ms")
	}

	private fun handle(result: ScanResult) {
		val address = result.device.address
		val advertisedServices = result.scanRecord?.serviceUuids.orEmpty().map { GattUuid.normalize(it.uuid.toString()) }
		val bleName = result.scanRecord?.deviceName ?: safeDeviceName(result)
		val profile = DeviceRegistry.identify(bleName, advertisedServices)
		if (address in seen) return
		// Loga uma vez por combinação endereço/nome: um anúncio sem nome (só serviço) seguido do scan response com
		// nome aparece duas vezes no log, e o segundo ainda pode virar evento.
		if (logged.add("$address|$bleName")) {
			log(
				LogLevel.DEBUG,
				"onScanResult",
				"address=$address name=$bleName rssi=${result.rssi} advertisedServices=$advertisedServices profile=${profile?.id}",
			)
		}
		if (profile == null || bleName == null) return
		seen += address
		onDevice(Hit(profile, address, result.rssi, bleName))
	}

	private fun safeDeviceName(result: ScanResult): String? = try {
		result.device.name
	} catch (error: SecurityException) {
		null
	}

	private fun buildFilters(): List<ScanFilter> {
		val names = Profiles.all.flatMap { it.bleNames }.distinct()
		val services = Profiles.all.flatMap { profile -> profile.gattCandidates.map { it.service } }.distinct()
		return names.map { ScanFilter.Builder().setDeviceName(it).build() } +
			services.map { ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(it)).build() }
	}

	private fun log(level: LogLevel, method: String, message: String) {
		logger.log(level, "BleScanner/$method", message)
	}

	companion object {
		const val SCAN_DURATION_MS = 7_000L
	}
}

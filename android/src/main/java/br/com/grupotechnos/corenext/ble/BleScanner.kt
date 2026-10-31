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
 * - Filtros (OU), tirados de `Profiles.all` do Repo 1 ([filterSpec]): o nome de advertising de cada perfil
 *   (`Mormaii_fitGPS`, o filtro seguro, igual ao Core atual em `SMAService.java:505-526`; `Life Ultra GPS` e
 *   `Smart Watch 6010` no iDO) e o serviço de cada `GattCandidate` (NUS, `FF60`, `0AF0`). O fitGPS 0.2.1 não anuncia o
 *   NUS (anúncio com `180f`, `180a` e `00000001-…`, `logs-20261029-083254.jsonl` linha 6, ts 1793272444786), então é o
 *   filtro de nome que o acha; o de serviço fica para um relógio que anuncie. Perfil novo no Repo 1 entra no scan sem
 *   mudança aqui. Os UUIDs anunciados continuam indo para o log.
 * - Sem filtro nenhum quando algum perfil aceita prefixo de nome (`DeviceProfile.bleNamePrefixes`; hoje só o Condor
 *   Reebok, `P85`): o `ScanFilter` só compara o nome exato, e um nome com sufixo, espaço ou `NUL` não passaria (o Core de
 *   produção faz `trim` e `startsWith`, `AvailableDevices.java:55-57`, e também escaneia sem filtro). A identificação
 *   continua no `DeviceRegistry.identify`, então o fitGPS e o Life Ultra GPS saem iguais. Nesse modo, aparelhos
 *   desconhecidos e sem nome não vão para o log, que senão encheria o anel num lugar cheio de BLE.
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
	private var unfiltered = false

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
		val spec = filterSpec()
		try {
			scanner.startScan(buildFilters(spec), settings, newCallback)
		} catch (error: RuntimeException) {
			log(LogLevel.ERROR, "start", "startScan threw ${error.javaClass.simpleName}: ${error.message}")
			onFailure(-1, "Could not start scan: ${error.message}")
			return
		}
		callback = newCallback
		unfiltered = spec.unfiltered
		main.postDelayed(stopRunnable, SCAN_DURATION_MS)
		val mode = if (spec.unfiltered) "without filters (a profile accepts name prefixes)" else "with ${spec.names.size + spec.services.size} filters"
		log(LogLevel.INFO, "start", "Scanning for ${SCAN_DURATION_MS} ms $mode")
	}

	private fun handle(result: ScanResult) {
		val address = result.device.address
		val advertisedServices = result.scanRecord?.serviceUuids.orEmpty().map { GattUuid.normalize(it.uuid.toString()) }
		val bleName = result.scanRecord?.deviceName ?: safeDeviceName(result)
		val profile = DeviceRegistry.identify(bleName, advertisedServices)
		if (address in seen) return
		// Loga uma vez por combinação endereço/nome: um anúncio sem nome (só serviço) seguido do scan response com
		// nome aparece duas vezes no log, e o segundo ainda pode virar evento. Sem filtro, só o que tem nome ou perfil.
		val worthLogging = !unfiltered || profile != null || bleName != null
		if (worthLogging && logged.add("$address|$bleName")) {
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

	/** Lista vazia (scan sem filtro) com [FilterSpec.unfiltered]; senão um filtro por nome e um por serviço. */
	private fun buildFilters(spec: FilterSpec): List<ScanFilter> {
		if (spec.unfiltered) return emptyList()
		return spec.names.map { ScanFilter.Builder().setDeviceName(it).build() } +
			spec.services.map { ScanFilter.Builder().setServiceUuid(ParcelUuid.fromString(it)).build() }
	}

	private fun log(level: LogLevel, method: String, message: String) {
		logger.log(level, "BleScanner/$method", message)
	}

	/**
	 * Nomes e serviços dos filtros de scan, em Kotlin puro (testável na JVM, sem o `ScanFilter` do Android).
	 *
	 * @property unfiltered `true` quando algum perfil aceita prefixo de nome: o scan sai sem filtro e [names] e
	 * [services] só documentam o que os perfis anunciam.
	 */
	data class FilterSpec(val names: List<String>, val services: List<String>, val unfiltered: Boolean)

	companion object {
		const val SCAN_DURATION_MS = 7_000L

		/**
		 * Um filtro por nome de advertising e um por serviço de candidato GATT de [profiles], sem repetição; sem filtro
		 * nenhum se algum perfil tem `bleNamePrefixes`.
		 */
		fun filterSpec(profiles: List<DeviceProfile> = Profiles.all): FilterSpec = FilterSpec(
			names = profiles.flatMap { it.bleNames }.distinct(),
			services = profiles.flatMap { profile -> profile.gattCandidates.map { GattUuid.normalize(it.service) } }.distinct(),
			unfiltered = profiles.any { it.bleNamePrefixes.isNotEmpty() },
		)
	}
}

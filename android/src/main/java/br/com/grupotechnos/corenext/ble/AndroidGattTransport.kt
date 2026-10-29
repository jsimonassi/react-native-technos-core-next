package br.com.grupotechnos.corenext.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger
import br.com.grupotechnos.watch.protocol.transport.DiscoveredCharacteristic
import br.com.grupotechnos.watch.protocol.transport.DiscoveredService
import br.com.grupotechnos.watch.protocol.transport.GattStatus
import br.com.grupotechnos.watch.protocol.transport.GattUuid
import br.com.grupotechnos.watch.protocol.transport.Transport
import br.com.grupotechnos.watch.protocol.transport.TransportEvents
import br.com.grupotechnos.watch.protocol.transport.WriteType
import java.util.UUID

/**
 * [Transport] sobre `BluetoothGatt`. É a única classe do Core que fala com a pilha BLE durante a conexão.
 *
 * Threading: tudo roda numa `HandlerThread` própria ("corenext-gatt"). Os métodos do [Transport] só postam
 * nela, e o `connectGatt` recebe o mesmo `Handler`, então os callbacks do GATT também chegam lá; o estado
 * desta classe nunca é tocado por duas threads. Os eventos saem por [TransportEvents], que só enfileira.
 *
 * Ciclo de vida do link (detalhes e motivos em `docs/transporte-android.md`):
 * - Cada [connect] fecha (`close()`) o `BluetoothGatt` anterior e cria outro com `TRANSPORT_LE`.
 *   `autoReconnect = false` (primeiro pareamento) usa conexão direta; `true` usa `autoConnect = true`
 *   (conexão pendente, sem timeout), precedida de um scan curto pelo MAC quando a pilha não conhece o aparelho.
 * - Um link que chegou a conectar e caiu sem pedido **não** é re-armado: sai `onDisconnected` e o transporte para;
 *   quem reconecta é a sessão, com um `connect(address, true)` novo. Só uma conexão pendente que falha sem nunca
 *   conectar é re-armada aqui, com espera que dobra a partir de [REARM_DELAY_MS]; [disconnect] (ou o Bluetooth
 *   desligar) cancela isso.
 * - Quando sai `onConnected`/`onDisconnected` é decidido pelo [LinkLifecycle] (Kotlin puro, testado na JVM):
 *   para cada `onConnected`, exatamente um `onDisconnected`, exceto com o Bluetooth desligado; [disconnect] termina
 *   com um `onDisconnected` só se havia link aberto ou conexão pendente; falha de conexão direta (nunca conectou)
 *   também sai como `onDisconnected`, para a sessão encerrar o pareamento.
 * - Bluetooth desligado ([onBluetoothStateChanged] com `false`) não emite `onDisconnected` nenhum, nem para o link
 *   aberto nem para a conexão pendente: o transporte para e só entrega `onBluetoothStateChanged(false)` ("contrato B",
 *   no KDoc do [LinkLifecycle]).
 * - Nunca chama `BluetoothGatt.refresh()` por reflexão (a SDK SMA chama, `EaseConnector.java:118, 129-141`):
 *   é API oculta, bloqueada para apps novos e limpa o cache de serviços que o `autoConnect` aproveita.
 *
 * Permissões: assume `BLUETOOTH_CONNECT` concedida (o módulo confere antes de chamar a sessão);
 * se for revogada no meio, as operações falham com status de erro em vez de lançar.
 */
@SuppressLint("MissingPermission")
class AndroidGattTransport(
	context: Context,
	private val logger: WatchLogger,
) : Transport {
	private val appContext = context.applicationContext
	private val thread = HandlerThread("corenext-gatt").apply { start() }
	private val handler = Handler(thread.looper)
	private val queue = GattQueue(HandlerScheduler(handler))

	@Volatile private var events: TransportEvents? = null

	/** MTU ATT efetivo do link atual (23 até a negociação). Lido pelo `FrameRecorder` para o cabeçalho. */
	@Volatile var currentMtu: Int = DEFAULT_MTU
		private set

	// Estado abaixo: só na thread do GATT.
	private val lifecycle = LinkLifecycle(object : LinkLifecycle.Output {
		override fun onConnected() {
			events?.onConnected()
		}

		override fun onDisconnected(status: Int, message: String) {
			events?.onDisconnected(status, message)
		}
	})
	private var gatt: BluetoothGatt? = null
	private var targetAddress: String? = null
	private var rearmToken: Runnable? = null
	private var pendingFailures = 0
	private var reconnectScan: ScanCallback? = null
	private var reconnectScanTimeout: Runnable? = null

	/** Liga a sessão. Chamado uma vez pelo `CoreGraph`, antes de qualquer comando. */
	fun attach(events: TransportEvents) {
		this.events = events
	}

	override fun connect(address: String, autoReconnect: Boolean) {
		handler.post { doConnect(address, autoReconnect) }
	}

	override fun disconnect() {
		handler.post { doDisconnect() }
	}

	override fun discoverServices() {
		handler.post {
			val current = gatt
			if (current == null || !lifecycle.linkConnected) {
				events?.onServicesDiscovered(emptyList(), GattStatus.NOT_CONNECTED)
				return@post
			}
			queue.enqueue(object : GattQueue.Operation(GattQueue.Kind.DISCOVER, "discoverServices", DISCOVERY_TIMEOUT_MS) {
				override fun start(): Int = if (current.discoverServices()) GattStatus.SUCCESS else GattQueue.GATT_FAILURE

				override fun finish(status: Int, payload: Any?) {
					val services = if (status == GattStatus.SUCCESS) mapServices(current) else emptyList()
					log(LogLevel.INFO, "discoverServices", "status=$status services=${services.map { it.uuid }}")
					events?.onServicesDiscovered(services, status)
				}
			})
		}
	}

	override fun enableNotifications(service: String, characteristic: String, requestId: Int) {
		handler.post {
			val current = gatt
			val target = findCharacteristic(service, characteristic)
			if (current == null || !lifecycle.linkConnected) {
				events?.onNotificationsEnabled(requestId, GattStatus.NOT_CONNECTED)
				return@post
			}
			if (target == null) {
				events?.onNotificationsEnabled(requestId, GattStatus.NOT_FOUND)
				return@post
			}
			queue.enqueue(object : GattQueue.Operation(GattQueue.Kind.DESCRIPTOR_WRITE, "enableNotifications $characteristic") {
				override fun start(): Int {
					if (!current.setCharacteristicNotification(target, true)) return GattQueue.GATT_FAILURE
					val cccd = target.getDescriptor(CCCD_UUID) ?: return GattStatus.NOT_FOUND
					// 01 00 (notificação), como a SDK SMA (`SmaMessenger.java:62-69`); 02 00 só se a characteristic só indicar.
					val value = if (target.properties and BluetoothGattCharacteristic.PROPERTY_NOTIFY != 0) {
						BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
					} else {
						BluetoothGattDescriptor.ENABLE_INDICATION_VALUE
					}
					return writeDescriptorCompat(current, cccd, value)
				}

				override fun finish(status: Int, payload: Any?) {
					log(LogLevel.INFO, "enableNotifications", "characteristic=$characteristic status=$status")
					events?.onNotificationsEnabled(requestId, status)
				}
			})
		}
	}

	override fun requestMtu(mtu: Int, requestId: Int) {
		handler.post {
			val current = gatt
			if (current == null || !lifecycle.linkConnected) {
				events?.onMtuChanged(requestId, currentMtu, GattStatus.NOT_CONNECTED)
				return@post
			}
			queue.enqueue(object : GattQueue.Operation(GattQueue.Kind.MTU, "requestMtu $mtu") {
				override fun start(): Int = if (current.requestMtu(mtu)) GattStatus.SUCCESS else GattQueue.GATT_FAILURE

				override fun finish(status: Int, payload: Any?) {
					if (status == GattStatus.SUCCESS && payload is Int) currentMtu = payload
					log(LogLevel.INFO, "requestMtu", "requested=$mtu effective=$currentMtu status=$status")
					events?.onMtuChanged(requestId, currentMtu, status)
				}
			})
		}
	}

	override fun write(service: String, characteristic: String, value: ByteArray, type: WriteType, requestId: Int) {
		val bytes = value.copyOf()
		handler.post {
			val current = gatt
			val target = findCharacteristic(service, characteristic)
			if (current == null || !lifecycle.linkConnected) {
				events?.onWriteCompleted(requestId, GattStatus.NOT_CONNECTED)
				return@post
			}
			if (target == null) {
				events?.onWriteCompleted(requestId, GattStatus.NOT_FOUND)
				return@post
			}
			queue.enqueue(object : GattQueue.Operation(GattQueue.Kind.WRITE, "write $characteristic") {
				override fun start(): Int = writeCharacteristicCompat(current, target, bytes, type)

				override fun finish(status: Int, payload: Any?) {
					if (status != GattStatus.SUCCESS) log(LogLevel.WARN, "write", "characteristic=$characteristic status=$status")
					events?.onWriteCompleted(requestId, status)
				}
			})
		}
	}

	override fun read(service: String, characteristic: String, requestId: Int) {
		handler.post {
			val current = gatt
			val target = findCharacteristic(service, characteristic)
			if (current == null || !lifecycle.linkConnected) {
				events?.onReadCompleted(requestId, null, GattStatus.NOT_CONNECTED)
				return@post
			}
			if (target == null) {
				events?.onReadCompleted(requestId, null, GattStatus.NOT_FOUND)
				return@post
			}
			queue.enqueue(object : GattQueue.Operation(GattQueue.Kind.READ, "read $characteristic") {
				override fun start(): Int = if (current.readCharacteristic(target)) GattStatus.SUCCESS else GattQueue.GATT_FAILURE

				override fun finish(status: Int, payload: Any?) {
					events?.onReadCompleted(requestId, if (status == GattStatus.SUCCESS) payload as? ByteArray else null, status)
				}
			})
		}
	}

	/**
	 * Bluetooth do telefone ligou ou desligou (vem do [BluetoothStateReceiver]).
	 *
	 * Ao desligar ("contrato B", no KDoc do [LinkLifecycle]): cancela re-arme e scan de reconexão, falha as operações
	 * pendentes, fecha o GATT e para o transporte **sem** `onDisconnected`, nem para o link aberto nem para a conexão
	 * pendente; depois entrega só `onBluetoothStateChanged(false)`. Um `disconnect()` seguinte e os callbacks atrasados
	 * do GATT fechado não emitem nada até um `connect()` novo.
	 * Ao ligar: só repassa; quem decide reconectar é o `CoreGraph`.
	 *
	 * @param afterDelivered roda na thread do GATT depois de o evento ir para a sessão; o `CoreGraph` usa para
	 * pedir a reconexão só depois de a sessão saber que o Bluetooth voltou (os eventos entram em ordem na fila dela).
	 */
	fun onBluetoothStateChanged(enabled: Boolean, afterDelivered: (() -> Unit)? = null) {
		handler.post {
			if (enabled) {
				log(LogLevel.INFO, "onBluetoothStateChanged", "enabled=true")
			} else {
				stopForBluetoothOff()
			}
			events?.onBluetoothStateChanged(enabled)
			afterDelivered?.invoke()
		}
	}

	/**
	 * Partida do processo com o Bluetooth já desligado: entrega o mesmo que um `STATE_OFF`, porque o
	 * [BluetoothStateReceiver] só avisa transições e a sessão ficaria em `DISCONNECTED` (o JS veria 0, não 4) até
	 * alguém religar o Bluetooth.
	 *
	 * O adaptador é lido aqui, na thread do GATT, e o `CoreGraph` chama isto depois de registrar o receiver: se o
	 * Bluetooth ligar no meio, ou esta leitura já o vê ligado e não entrega nada, ou o `STATE_ON` do receiver entra
	 * na fila depois do `false` daqui. Nos dois casos o último estado da sessão é o certo.
	 */
	fun reportBluetoothOffAtStartup() {
		handler.post {
			if (BlePermissions.isBluetoothEnabled(appContext)) return@post
			log(LogLevel.INFO, "reportBluetoothOffAtStartup", "Bluetooth already off when the native graph was created")
			stopForBluetoothOff()
			events?.onBluetoothStateChanged(false)
		}
	}

	private fun stopForBluetoothOff() {
		cancelRearm()
		stopReconnectScan()
		closeGatt()
		val wasActive = lifecycle.bluetoothOff()
		log(LogLevel.INFO, "onBluetoothStateChanged", "enabled=false; transport stopped without onDisconnected (active=$wasActive)")
	}

	/** Encerra a thread do GATT. O `CoreGraph` vive o processo inteiro, então só testes e ferramentas chamam. */
	fun release() {
		handler.post {
			doDisconnect()
			thread.quitSafely()
		}
	}

	private fun doConnect(address: String, auto: Boolean) {
		cancelRearm()
		stopReconnectScan()
		closeGatt()
		val adapter = BlePermissions.adapter(appContext)?.takeIf { it.isEnabled }
			?: return rejectConnect(GattStatus.NOT_CONNECTED, "Bluetooth is off")
		if (!BlePermissions.hasConnectPermission(appContext)) return rejectConnect(GattStatus.NOT_CONNECTED, "BLUETOOTH_CONNECT not granted")
		if (!BluetoothAdapter.checkBluetoothAddress(address)) return rejectConnect(GattStatus.NOT_FOUND, "Invalid address $address")
		lifecycle.connectAccepted(auto)
		targetAddress = address
		pendingFailures = 0
		val device = adapter.getRemoteDevice(address)
		if (auto) connectPending(device) else openGatt(device, autoConnect = false)
	}

	/**
	 * `connect()` recusado antes de abrir GATT: exatamente um `onDisconnected` e o transporte parado, para um
	 * `disconnect()` seguinte não emitir outro. Na gravação do fitGPS, o `connect()` que a sessão fez com o adaptador
	 * já desligado (`READY -> RECONNECTING`, `logs-20261029-083254.jsonl` linha 102, ts 1793272958497) é o segundo
	 * `onDisconnected` dos três do Bluetooth desligado (linha 109, ts 1793272958524), e o `disconnect()` seguinte ainda
	 * gerou o terceiro (linha 110, ts 1793272958525). O log fica fora do git, por ter o MAC.
	 */
	private fun rejectConnect(status: Int, message: String) {
		log(LogLevel.WARN, "connect", "Rejected: $message")
		lifecycle.connectRejected(status, message)
	}

	/**
	 * Conexão pendente (`autoConnect = true`). Em vários aparelhos ela falha em silêncio se a pilha não tem o tipo de
	 * endereço do relógio em cache (aparelho nunca visto desde o boot, `getType() == DEVICE_TYPE_UNKNOWN`); por isso
	 * antes faz um scan curto filtrado pelo MAC, como a SDK SMA faz antes de cada reconexão (`EaseConnector.java:56-60`).
	 */
	private fun connectPending(device: BluetoothDevice) {
		val needsScan = device.type == BluetoothDevice.DEVICE_TYPE_UNKNOWN && BlePermissions.hasScanPermission(appContext)
		if (!needsScan) {
			openGatt(device, autoConnect = true)
			return
		}
		val scanner = BlePermissions.adapter(appContext)?.bluetoothLeScanner
		if (scanner == null) {
			openGatt(device, autoConnect = true)
			return
		}
		val address = device.address
		val callback = object : ScanCallback() {
			override fun onScanResult(callbackType: Int, result: ScanResult) {
				handler.post {
					if (reconnectScan !== this || targetAddress != address) return@post
					log(LogLevel.INFO, "connectPending", "Found $address by scan (rssi=${result.rssi}), opening pending connection")
					stopReconnectScan()
					openGatt(result.device, autoConnect = true)
				}
			}

			override fun onScanFailed(errorCode: Int) {
				handler.post {
					if (reconnectScan !== this) return@post
					log(LogLevel.WARN, "connectPending", "Reconnect scan failed errorCode=$errorCode, connecting without it")
					stopReconnectScan()
					openGatt(device, autoConnect = true)
				}
			}
		}
		val filters = listOf(ScanFilter.Builder().setDeviceAddress(address).build())
		val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
		try {
			scanner.startScan(filters, settings, callback)
		} catch (error: RuntimeException) {
			log(LogLevel.WARN, "connectPending", "Could not start reconnect scan: ${error.message}")
			openGatt(device, autoConnect = true)
			return
		}
		reconnectScan = callback
		log(LogLevel.INFO, "connectPending", "Device unknown to the stack, scanning for $address up to ${RECONNECT_SCAN_MS} ms")
		val timeout = Runnable {
			if (reconnectScan !== callback) return@Runnable
			log(LogLevel.WARN, "connectPending", "$address not seen by scan, opening pending connection anyway")
			stopReconnectScan()
			openGatt(device, autoConnect = true)
		}
		reconnectScanTimeout = timeout
		handler.postDelayed(timeout, RECONNECT_SCAN_MS)
	}

	private fun openGatt(device: BluetoothDevice, autoConnect: Boolean) {
		closeGatt()
		val gattGeneration = lifecycle.gattOpening()
		val callback = Callback(gattGeneration)
		currentMtu = DEFAULT_MTU
		val opened = try {
			device.connectGatt(appContext, autoConnect, callback, BluetoothDevice.TRANSPORT_LE, BluetoothDevice.PHY_LE_1M_MASK, handler)
		} catch (error: SecurityException) {
			null
		}
		if (opened == null) {
			log(LogLevel.ERROR, "openGatt", "connectGatt returned null for ${device.address}")
			lifecycle.openFailed(GattQueue.GATT_FAILURE)
			return
		}
		gatt = opened
		log(LogLevel.INFO, "openGatt", "address=${device.address} autoConnect=$autoConnect generation=$gattGeneration")
	}

	private fun doDisconnect() {
		// Contrato do `Transport.disconnect` (ADR 12 do Repo 1): um onDisconnected só se havia link aberto ou pendente.
		// Depois do Bluetooth desligado não há nenhum dos dois, então não sai nada (contrato B).
		cancelRearm()
		stopReconnectScan()
		closeGatt()
		val wasActive = lifecycle.disconnectRequested()
		log(LogLevel.INFO, "disconnect", "Requested by the session (active=$wasActive)")
	}

	/**
	 * Fecha o GATT atual sem emitir nada e falha as operações pendentes (antes do `onDisconnected`, se houver um).
	 * Quem chama avisa o [lifecycle], que decide o evento e invalida os callbacks do GATT fechado.
	 */
	private fun closeGatt() {
		queue.failAll(GattStatus.NOT_CONNECTED)
		val current = gatt ?: return
		gatt = null
		try {
			current.disconnect()
			current.close()
		} catch (error: SecurityException) {
			log(LogLevel.WARN, "closeGatt", "SecurityException closing GATT: ${error.message}")
		}
	}

	private fun handleConnectionChange(gattGeneration: Int, source: BluetoothGatt, status: Int, newState: Int) {
		if (!lifecycle.isCurrent(gattGeneration)) {
			// Callback de um GATT já fechado (inclusive pelo Bluetooth desligado): o evento dele já foi decidido.
			return
		}
		log(LogLevel.INFO, "onConnectionStateChange", "status=$status newState=$newState generation=$gattGeneration")
		when (newState) {
			BluetoothProfile.STATE_CONNECTED -> {
				pendingFailures = 0
				currentMtu = DEFAULT_MTU
				lifecycle.linkUp(gattGeneration)
			}

			BluetoothProfile.STATE_DISCONNECTED -> {
				queue.failAll(GattStatus.NOT_CONNECTED)
				gatt = null
				try {
					source.close()
				} catch (error: SecurityException) {
					log(LogLevel.WARN, "onConnectionStateChange", "SecurityException closing GATT: ${error.message}")
				}
				// LOST não re-arma: a sessão decide se e quando reconectar (connect(address, true) na hora para um link
				// pronto, com espera para um que caiu antes do READY) e desiste sem chamar disconnect() num pareamento
				// que caiu ou num forget em andamento. Um re-arme aqui reabriria o link por conta própria nesses casos
				// (ADR 11 e 12 do Repo 1). CONNECT_FAILED (conexão direta) também não fica pendente.
				if (lifecycle.linkDown(gattGeneration, status) == LinkLifecycle.LinkDown.PENDING_FAILED) {
					pendingFailures++
					log(LogLevel.WARN, "onConnectionStateChange", "Pending connection failed (status=$status, failures=$pendingFailures), re-arming")
					scheduleRearm()
				}
			}
		}
	}

	private fun scheduleRearm() {
		cancelRearm()
		val address = targetAddress ?: return
		val action = Runnable {
			rearmToken = null
			if (!lifecycle.active || gatt != null || targetAddress != address) return@Runnable
			val adapter = BlePermissions.adapter(appContext)
			if (adapter == null || !adapter.isEnabled) return@Runnable
			log(LogLevel.INFO, "rearm", "Re-arming pending connection to $address")
			connectPending(adapter.getRemoteDevice(address))
		}
		rearmToken = action
		// Falhas seguidas da conexão pendente (sem nunca conectar) dobram a espera, até 30 s, para não girar em laço.
		val delay = (REARM_DELAY_MS shl pendingFailures.coerceAtMost(5)).coerceAtMost(MAX_REARM_DELAY_MS)
		handler.postDelayed(action, delay)
	}

	private fun cancelRearm() {
		rearmToken?.let(handler::removeCallbacks)
		rearmToken = null
	}

	private fun stopReconnectScan() {
		reconnectScanTimeout?.let(handler::removeCallbacks)
		reconnectScanTimeout = null
		val callback = reconnectScan ?: return
		reconnectScan = null
		try {
			BlePermissions.adapter(appContext)?.bluetoothLeScanner?.stopScan(callback)
		} catch (error: RuntimeException) {
			log(LogLevel.WARN, "stopReconnectScan", "Could not stop scan: ${error.message}")
		}
	}

	private fun findCharacteristic(service: String, characteristic: String): BluetoothGattCharacteristic? {
		val current = gatt ?: return null
		return try {
			current.getService(UUID.fromString(GattUuid.normalize(service)))
				?.getCharacteristic(UUID.fromString(GattUuid.normalize(characteristic)))
		} catch (error: IllegalArgumentException) {
			null
		}
	}

	private fun mapServices(source: BluetoothGatt): List<DiscoveredService> = source.services.map { service ->
		DiscoveredService(
			uuid = GattUuid.normalize(service.uuid.toString()),
			characteristics = service.characteristics.map { characteristic ->
				val properties = characteristic.properties
				DiscoveredCharacteristic(
					uuid = GattUuid.normalize(characteristic.uuid.toString()),
					canRead = properties and BluetoothGattCharacteristic.PROPERTY_READ != 0,
					canWrite = properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0,
					canWriteWithoutResponse = properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0,
					canNotify = properties and (BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_INDICATE) != 0,
				)
			},
		)
	}

	@Suppress("DEPRECATION")
	private fun writeCharacteristicCompat(
		target: BluetoothGatt,
		characteristic: BluetoothGattCharacteristic,
		value: ByteArray,
		type: WriteType,
	): Int {
		// A sessão sempre pede WITH_RESPONSE (`SmaDriver.sendFrame` e `SmaDriver.writeControl` do Repo 1), sem
		// olhar as propriedades descobertas; WITHOUT_RESPONSE só está mapeado porque o contrato do `Transport` o
		// permite. A SDK SMA nunca define o tipo e herda o inicial da characteristic (`SmaMessenger.java:118-119`).
		val writeType = when (type) {
			WriteType.WITH_RESPONSE -> BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
			WriteType.WITHOUT_RESPONSE -> BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
		}
		return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			val code = target.writeCharacteristic(characteristic, value, writeType)
			if (code == BluetoothStatusCodes.SUCCESS) GattStatus.SUCCESS else code
		} else {
			characteristic.writeType = writeType
			characteristic.value = value
			if (target.writeCharacteristic(characteristic)) GattStatus.SUCCESS else GattQueue.GATT_FAILURE
		}
	}

	@Suppress("DEPRECATION")
	private fun writeDescriptorCompat(target: BluetoothGatt, descriptor: BluetoothGattDescriptor, value: ByteArray): Int =
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			val code = target.writeDescriptor(descriptor, value)
			if (code == BluetoothStatusCodes.SUCCESS) GattStatus.SUCCESS else code
		} else {
			descriptor.value = value
			if (target.writeDescriptor(descriptor)) GattStatus.SUCCESS else GattQueue.GATT_FAILURE
		}

	private fun deliverNotification(characteristic: BluetoothGattCharacteristic, value: ByteArray?) {
		if (value == null || value.isEmpty()) return
		// Cópia: abaixo da API 33 o array é o buffer interno da characteristic, reescrito na próxima notificação.
		events?.onNotification(characteristic.uuid.toString(), value.copyOf())
	}

	private fun log(level: LogLevel, method: String, message: String) {
		logger.log(level, "AndroidGattTransport/$method", message)
	}

	/** Callbacks de um `BluetoothGatt` específico; os de gerações antigas (GATT já fechado) são ignorados. */
	private inner class Callback(private val gattGeneration: Int) : BluetoothGattCallback() {
		private val current: Boolean
			get() = lifecycle.isCurrent(gattGeneration)

		override fun onConnectionStateChange(gatt: BluetoothGatt, status: Int, newState: Int) {
			handleConnectionChange(gattGeneration, gatt, status, newState)
		}

		override fun onServicesDiscovered(gatt: BluetoothGatt, status: Int) {
			if (current) queue.complete(GattQueue.Kind.DISCOVER, status)
		}

		override fun onDescriptorWrite(gatt: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
			if (current) queue.complete(GattQueue.Kind.DESCRIPTOR_WRITE, status)
		}

		override fun onMtuChanged(gatt: BluetoothGatt, mtu: Int, status: Int) {
			if (!current) return
			if (!queue.complete(GattQueue.Kind.MTU, status, mtu) && status == BluetoothGatt.GATT_SUCCESS) {
				// MTU mudado sem operação nossa pendente (iniciativa do relógio ou da pilha): só atualiza o valor efetivo.
				currentMtu = mtu
				log(LogLevel.INFO, "onMtuChanged", "Unsolicited MTU change to $mtu")
			}
		}

		override fun onCharacteristicWrite(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
			if (current) queue.complete(GattQueue.Kind.WRITE, status)
		}

		override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray, status: Int) {
			if (current) queue.complete(GattQueue.Kind.READ, status, value.copyOf())
		}

		@Deprecated("Abaixo da API 33")
		@Suppress("DEPRECATION")
		override fun onCharacteristicRead(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
			// Na API 33+ a pilha chama a sobrecarga nova; esta só vale abaixo, para não entregar duas vezes.
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU || !current) return
			queue.complete(GattQueue.Kind.READ, status, characteristic.value?.copyOf())
		}

		override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
			if (current) deliverNotification(characteristic, value)
		}

		@Deprecated("Abaixo da API 33")
		@Suppress("DEPRECATION")
		override fun onCharacteristicChanged(gatt: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU || !current) return
			deliverNotification(characteristic, characteristic.value)
		}
	}

	private class HandlerScheduler(private val handler: Handler) : GattQueue.Scheduler {
		override fun postDelayed(delayMs: Long, action: () -> Unit): Any {
			val runnable = Runnable(action)
			handler.postDelayed(runnable, delayMs)
			return runnable
		}

		override fun cancel(token: Any) {
			handler.removeCallbacks(token as Runnable)
		}
	}

	companion object {
		/** MTU ATT padrão antes da negociação. */
		const val DEFAULT_MTU = 23

		/** Descoberta de serviços demora mais que uma escrita (vários round-trips ATT); 4 s é pouco no primeiro contato. */
		const val DISCOVERY_TIMEOUT_MS = 15_000L

		/** Espera antes de re-armar a conexão pendente, para não entrar em laço quente se a pilha recusar na hora. */
		const val REARM_DELAY_MS = 1_000L

		/** Teto da espera entre re-armes depois de falhas seguidas. */
		const val MAX_REARM_DELAY_MS = 30_000L

		/** Duração do scan por MAC antes de uma conexão pendente. */
		const val RECONNECT_SCAN_MS = 10_000L

		private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
	}
}

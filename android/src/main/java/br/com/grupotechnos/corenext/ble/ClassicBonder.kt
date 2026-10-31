package br.com.grupotechnos.corenext.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import br.com.grupotechnos.watch.protocol.log.LogLevel
import br.com.grupotechnos.watch.protocol.log.WatchLogger

/**
 * Vínculo Bluetooth clássico (BR/EDR) com o relógio: o que o `AndroidCoreHost` faz em `hasClassicBond`,
 * `requestClassicBond` e `removeClassicBond` do `CoreHost` (Repo 1, `:bridge`). Só os perfis com `Quirks.classicBond`
 * chegam aqui (hoje, o Condor Reebok, que usa HFP e A2DP pelo clássico no mesmo endereço do BLE).
 *
 * - [request]: com o vínculo já no sistema, [onResult] na hora com [Outcome.BONDED]. Senão registra um receiver de
 *   `ACTION_BOND_STATE_CHANGED` filtrado pelo endereço e chama `createBond(TRANSPORT_BREDR)` por reflexão, como a SDK CRP
 *   (`sdk:com/realsil/sdk/core/bluetooth/compat/BluetoothDeviceCompat.java:78-160`, chamada por
 *   `sdk:com/crrepa/ble/conn/bond/CRPBluetoothManager.java:93-96`) e o Core de produção
 *   (`core@v4.3.57:android/src/main/java/com/crp/bluetooth/connectionmanager/CRPBleConnectHelper.java`, `startBtBonding`).
 *   O transporte importa: o P85 não tem SMP no BLE (HCI de 2026-10-31, conexão 11), e o `createBond()` público usa
 *   `TRANSPORT_AUTO`, que num aparelho visto pelo scan BLE pode escolher o LE. Se a reflexão falhar, cai no
 *   `createBond()` com WARN. O diálogo de consentimento é do sistema (SSP NoInputNoOutput, HCI 15:43:15-18).
 * - Cada tentativa tem [ATTEMPT_TIMEOUT_MS]; as falhas e a nova tentativa automática são decididas pelo
 *   [ClassicBondTracker]. O motivo de uma falha (`android.bluetooth.device.extra.REASON`, extra oculto) vai só para o
 *   log.
 * - Não abre HFP nem A2DP: no HCI, o Android abriu os perfis sozinho em menos de 1 s depois do vínculo, e na reconexão
 *   depois de desligar e religar o Bluetooth foi o relógio que abriu a conexão clássica, com a chave guardada.
 * - [remove]: `removeBond()` por reflexão (`BluetoothDeviceCompat.java:198-221`; o Core faz o mesmo em
 *   `CRPBleConnectHelper.java:443-473`), com o resultado só no log. Um pedido em andamento para o mesmo endereço é
 *   cancelado e termina com [Outcome.FAILED], que o `CoreBridge` só registra no log (o pedido foi abandonado pelo
 *   esquecer; nenhum `onError` sai). Os dois casos de borda ficam com o [ClassicBondRemoval]: com o Bluetooth desligado,
 *   a remoção vai para as [PendingBondRemovals] (guardadas nas preferências) e roda em [onBluetoothOn] ou em
 *   [resumePendingRemovals] na partida; com o vínculo em curso, `cancelBondProcess()` por reflexão e um receiver que
 *   remove o vínculo se ele aparecer depois. Um [request] do mesmo endereço tira a remoção pendente (o relógio foi
 *   pareado de novo).
 *
 * O `getBondState()` não diz por qual transporte o vínculo foi feito; como o P85 não tem SMP, um vínculo com o endereço
 * dele é o clássico.
 *
 * Threads: [request] e [remove] só postam na thread principal, onde fica todo o estado e de onde sai [onResult];
 * [hasBond] lê o estado do sistema na thread de quem chamou. Nenhum método lança.
 *
 * @param onResult resultado de cada [request], exatamente uma vez por pedido, na thread principal.
 */
@SuppressLint("MissingPermission", "DiscouragedPrivateApi")
class ClassicBonder(
	context: Context,
	private val logger: WatchLogger,
	private val onResult: (address: String, outcome: Outcome, message: String) -> Unit,
) {
	/** Resultado de um pedido. O `iOS` é o único lugar com "não suportado", então aqui só há dois. */
	enum class Outcome { BONDED, FAILED }

	private val appContext = context.applicationContext
	private val main = Handler(Looper.getMainLooper())

	// Estado abaixo: só na thread principal.
	private var active: Request? = null

	private val pendingRemovals = PendingBondRemovals(
		load = { prefs().getStringSet(KEY_PENDING_REMOVALS, null).orEmpty() },
		save = { addresses -> prefs().edit().putStringSet(KEY_PENDING_REMOVALS, addresses).apply() },
	)

	/** Receiver dos endereços com remoção pendente; registrado só enquanto há algum. */
	private var removalWatcher: BroadcastReceiver? = null

	/** `true` se o sistema já tem o vínculo com [address]. Sem permissão ou com endereço inválido, `false`. */
	fun hasBond(address: String): Boolean = try {
		BlePermissions.adapter(appContext)?.getRemoteDevice(address)?.bondState == BluetoothDevice.BOND_BONDED
	} catch (error: SecurityException) {
		log(LogLevel.WARN, "hasBond", "No permission to read the bond state of $address: ${error.message}")
		false
	} catch (error: IllegalArgumentException) {
		false
	}

	/** Pede o vínculo com [address]; o resultado vem por [onResult]. Seguro em qualquer thread. */
	fun request(address: String) {
		main.post { start(address) }
	}

	/** Remove, no melhor esforço, o vínculo com [address]. Seguro em qualquer thread. */
	fun remove(address: String) {
		main.post { doRemove(address) }
	}

	/** O Bluetooth ligou: roda as remoções que ficaram pendentes com ele desligado. Seguro em qualquer thread. */
	fun onBluetoothOn() {
		main.post { resume("Bluetooth turned on") }
	}

	/**
	 * Na partida do processo: retoma as remoções guardadas por um processo anterior (com o Bluetooth desligado, elas
	 * continuam esperando o [onBluetoothOn]). Seguro em qualquer thread.
	 */
	fun resumePendingRemovals() {
		main.post { resume("startup") }
	}

	private fun resume(reason: String) {
		val pending = pendingRemovals.all()
		if (pending.isEmpty()) return
		log(LogLevel.INFO, "remove", "Resuming ${pending.size} pending bond removal(s) ($reason)")
		pending.forEach(::removeNow)
	}

	private fun start(address: String) {
		if (address in pendingRemovals) {
			log(LogLevel.INFO, "request", "$address is being paired again; its pending bond removal is dropped")
			pendingRemovals.remove(address)
			updateRemovalWatcher()
		}
		active?.let { previous ->
			finish(previous, Outcome.FAILED, "Classic bond request for ${previous.address} superseded by a request for $address")
		}
		val device = remoteDevice(address)
		if (device == null) {
			onResult(address, Outcome.FAILED, "Classic bond with $address not requested: Bluetooth adapter unavailable or invalid address")
			return
		}
		if (bondState(device) == BluetoothDevice.BOND_BONDED) {
			log(LogLevel.INFO, "request", "$address is already bonded")
			onResult(address, Outcome.BONDED, "already bonded")
			return
		}
		val request = Request(address, device, ClassicBondTracker())
		active = request
		registerReceiver(request)
		log(LogLevel.INFO, "request", "Requesting classic bond with $address (TRANSPORT_BREDR, up to ${ClassicBondTracker.DEFAULT_MAX_ATTEMPTS} attempts of ${ATTEMPT_TIMEOUT_MS} ms)")
		attempt(request)
	}

	private fun attempt(request: Request) {
		if (active !== request) return
		val started = createBond(request.device)
		val state = bondState(request.device)
		log(LogLevel.INFO, "attempt", "createBond attempt ${request.tracker.attempt} for ${request.address}: started=$started bondState=$state")
		val action = when {
			state == BluetoothDevice.BOND_BONDED -> request.tracker.onBondState(ClassicBondTracker.BOND_BONDED, state, null)
			// Um BONDING que já estava em curso (o sistema não aceita um segundo createBond) conta como tentativa em andamento.
			started || state == BluetoothDevice.BOND_BONDING -> request.tracker.onCreateBondReturned(true)
			else -> request.tracker.onCreateBondReturned(false)
		}
		if (!request.tracker.finished) scheduleTimeout(request)
		apply(request, action)
	}

	private fun apply(request: Request, action: ClassicBondTracker.Action) {
		when (action) {
			ClassicBondTracker.Action.Wait -> Unit
			is ClassicBondTracker.Action.RetryAfter -> {
				cancelTimers(request)
				log(LogLevel.WARN, "attempt", "Classic bond attempt with ${request.address} failed, retrying in ${action.delayMs} ms")
				val retry = Runnable { attempt(request) }
				request.retry = retry
				main.postDelayed(retry, action.delayMs)
			}

			ClassicBondTracker.Action.Success -> finish(request, Outcome.BONDED, "bonded")
			is ClassicBondTracker.Action.Fail -> finish(request, Outcome.FAILED, "Classic Bluetooth bond with ${request.address} was not created: ${action.reason}")
		}
	}

	private fun finish(request: Request, outcome: Outcome, message: String) {
		if (active === request) active = null
		cancelTimers(request)
		unregisterReceiver(request)
		log(if (outcome == Outcome.BONDED) LogLevel.INFO else LogLevel.WARN, "finish", "${request.address}: $outcome ($message)")
		onResult(request.address, outcome, message)
	}

	private fun scheduleTimeout(request: Request) {
		request.timeout?.let(main::removeCallbacks)
		val timeout = Runnable {
			request.timeout = null
			if (active !== request) return@Runnable
			log(LogLevel.WARN, "attempt", "Classic bond attempt ${request.tracker.attempt} with ${request.address} timed out after ${ATTEMPT_TIMEOUT_MS} ms")
			apply(request, request.tracker.onAttemptTimeout())
		}
		request.timeout = timeout
		main.postDelayed(timeout, ATTEMPT_TIMEOUT_MS)
	}

	private fun cancelTimers(request: Request) {
		request.timeout?.let(main::removeCallbacks)
		request.timeout = null
		request.retry?.let(main::removeCallbacks)
		request.retry = null
	}

	private fun onBondStateChanged(request: Request, intent: Intent) {
		if (active !== request) return
		val device = deviceExtra(intent) ?: return
		if (!device.address.equals(request.address, ignoreCase = true)) return
		val newState = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
		val previous = intent.getIntExtra(BluetoothDevice.EXTRA_PREVIOUS_BOND_STATE, BluetoothDevice.ERROR)
		val reason = intent.getIntExtra(EXTRA_REASON, NO_REASON).takeIf { it != NO_REASON }
		log(LogLevel.INFO, "onBondStateChanged", "${request.address}: $previous -> $newState (reason=${reason ?: "none"})")
		apply(request, request.tracker.onBondState(newState, previous, reason))
	}

	private fun doRemove(address: String) {
		active?.takeIf { it.address.equals(address, ignoreCase = true) }?.let { pending ->
			finish(pending, Outcome.FAILED, "Classic bond request for $address cancelled: the watch is being forgotten")
		}
		removeNow(address)
	}

	/** Um passo da remoção de [address] ([ClassicBondRemoval.decide]); deixa pendente o que ainda não acabou. */
	private fun removeNow(address: String) {
		val device = remoteDevice(address) ?: run {
			log(LogLevel.WARN, "remove", "Cannot remove the bond of $address: Bluetooth adapter unavailable or invalid address")
			pendingRemovals.remove(address)
			updateRemovalWatcher()
			return
		}
		val enabled = BlePermissions.isBluetoothEnabled(appContext)
		val state = if (enabled) bondState(device) else BluetoothDevice.BOND_NONE
		when (ClassicBondRemoval.decide(enabled, state)) {
			ClassicBondRemoval.Step.WAIT_FOR_BLUETOOTH -> {
				pendingRemovals.add(address)
				log(LogLevel.WARN, "remove", "Bluetooth is off: the bond with $address will be removed when Bluetooth turns on")
			}
			ClassicBondRemoval.Step.NOTHING_TO_REMOVE -> {
				pendingRemovals.remove(address)
				log(LogLevel.INFO, "remove", "$address has no bond to remove")
			}
			ClassicBondRemoval.Step.CANCEL_AND_WATCH -> {
				pendingRemovals.add(address)
				val cancelled = cancelBondProcess(device)
				log(
					if (cancelled) LogLevel.INFO else LogLevel.WARN,
					"remove",
					"$address is still bonding: cancelBondProcess() returned $cancelled; the bond is removed if it completes",
				)
			}
			ClassicBondRemoval.Step.REMOVE -> {
				pendingRemovals.remove(address)
				removeBond(device, state)
			}
			ClassicBondRemoval.Step.KEEP_WATCHING -> Unit
		}
		updateRemovalWatcher()
	}

	private fun removeBond(device: BluetoothDevice, before: Int) {
		val address = device.address
		val removed = try {
			BluetoothDevice::class.java.getMethod("removeBond").invoke(device) as? Boolean ?: false
		} catch (error: Exception) {
			log(LogLevel.WARN, "remove", "removeBond() by reflection failed for $address: ${error.javaClass.simpleName} ${error.message}")
			false
		} catch (error: LinkageError) {
			log(LogLevel.WARN, "remove", "removeBond() unavailable for $address: ${error.message}")
			false
		}
		log(if (removed) LogLevel.INFO else LogLevel.WARN, "remove", "removeBond($address) returned $removed (bond state was $before)")
	}

	/** `cancelBondProcess()` por reflexão (método oculto); `false` quando o sistema recusa ou bloqueia a reflexão. */
	private fun cancelBondProcess(device: BluetoothDevice): Boolean = try {
		BluetoothDevice::class.java.getMethod("cancelBondProcess").invoke(device) as? Boolean ?: false
	} catch (error: Exception) {
		val cause = (error as? java.lang.reflect.InvocationTargetException)?.targetException ?: error
		log(LogLevel.WARN, "remove", "cancelBondProcess() by reflection failed for ${device.address}: ${cause.javaClass.simpleName} ${cause.message}")
		false
	} catch (error: LinkageError) {
		log(LogLevel.WARN, "remove", "cancelBondProcess() unavailable for ${device.address}: ${error.message}")
		false
	}

	/** Liga o receiver das remoções pendentes enquanto houver alguma, e o desliga quando a lista esvazia. */
	private fun updateRemovalWatcher() {
		if (pendingRemovals.isEmpty()) {
			removalWatcher?.let { receiver ->
				removalWatcher = null
				try {
					appContext.unregisterReceiver(receiver)
				} catch (error: IllegalArgumentException) {
					log(LogLevel.DEBUG, "remove", "Removal watcher already unregistered")
				}
			}
			return
		}
		if (removalWatcher != null) return
		val receiver = object : BroadcastReceiver() {
			override fun onReceive(context: Context, intent: Intent) {
				if (intent.action == BluetoothDevice.ACTION_BOND_STATE_CHANGED) onPendingBondStateChanged(intent)
			}
		}
		if (register(receiver)) removalWatcher = receiver
	}

	private fun onPendingBondStateChanged(intent: Intent) {
		val device = deviceExtra(intent) ?: return
		if (device.address !in pendingRemovals) return
		val newState = intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.ERROR)
		log(LogLevel.INFO, "remove", "Pending removal of ${device.address}: bond state $newState")
		when (ClassicBondRemoval.onBondState(newState)) {
			ClassicBondRemoval.Step.REMOVE -> {
				pendingRemovals.remove(device.address)
				removeBond(device, newState)
			}
			ClassicBondRemoval.Step.NOTHING_TO_REMOVE -> pendingRemovals.remove(device.address)
			else -> Unit
		}
		updateRemovalWatcher()
	}

	/** `createBond(TRANSPORT_BREDR)` por reflexão; se o método oculto não existir ou for bloqueado, o público. */
	private fun createBond(device: BluetoothDevice): Boolean {
		try {
			val method = BluetoothDevice::class.java.getMethod("createBond", Int::class.javaPrimitiveType)
			return method.invoke(device, BluetoothDevice.TRANSPORT_BREDR) as? Boolean ?: false
		} catch (error: SecurityException) {
			log(LogLevel.WARN, "createBond", "No permission to bond with ${device.address}: ${error.message}")
			return false
		} catch (error: Exception) {
			val cause = (error as? java.lang.reflect.InvocationTargetException)?.targetException ?: error
			if (cause is SecurityException) {
				log(LogLevel.WARN, "createBond", "No permission to bond with ${device.address}: ${cause.message}")
				return false
			}
			log(LogLevel.WARN, "createBond", "createBond(TRANSPORT_BREDR) by reflection failed (${cause.javaClass.simpleName}: ${cause.message}); falling back to createBond()")
		} catch (error: LinkageError) {
			log(LogLevel.WARN, "createBond", "createBond(TRANSPORT_BREDR) unavailable (${error.message}); falling back to createBond()")
		}
		return try {
			device.createBond()
		} catch (error: SecurityException) {
			log(LogLevel.WARN, "createBond", "No permission to bond with ${device.address}: ${error.message}")
			false
		}
	}

	private fun remoteDevice(address: String): BluetoothDevice? = try {
		BlePermissions.adapter(appContext)?.getRemoteDevice(address)
	} catch (error: IllegalArgumentException) {
		null
	}

	private fun bondState(device: BluetoothDevice): Int = try {
		device.bondState
	} catch (error: SecurityException) {
		BluetoothDevice.BOND_NONE
	}

	@Suppress("DEPRECATION")
	private fun deviceExtra(intent: Intent): BluetoothDevice? =
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
		} else {
			intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
		}

	private fun registerReceiver(request: Request) {
		val receiver = object : BroadcastReceiver() {
			override fun onReceive(context: Context, intent: Intent) {
				if (intent.action == BluetoothDevice.ACTION_BOND_STATE_CHANGED) onBondStateChanged(request, intent)
			}
		}
		if (register(receiver)) {
			request.receiver = receiver
		} else {
			log(LogLevel.WARN, "request", "Could not register the bond receiver; relying on the attempt timeout")
		}
	}

	/** Registra [receiver] para `ACTION_BOND_STATE_CHANGED` na thread principal; `false` se o sistema recusar. */
	private fun register(receiver: BroadcastReceiver): Boolean {
		val filter = IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
		return try {
			// Broadcast protegido (só a pilha do sistema o envia), como o ACTION_STATE_CHANGED do BluetoothStateReceiver.
			if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
				appContext.registerReceiver(receiver, filter, null, main, Context.RECEIVER_EXPORTED)
			} else {
				appContext.registerReceiver(receiver, filter, null, main)
			}
			true
		} catch (error: RuntimeException) {
			log(LogLevel.WARN, "register", "Could not register a bond receiver: ${error.message}")
			false
		}
	}

	private fun prefs() = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

	private fun unregisterReceiver(request: Request) {
		val receiver = request.receiver ?: return
		request.receiver = null
		try {
			appContext.unregisterReceiver(receiver)
		} catch (error: IllegalArgumentException) {
			log(LogLevel.DEBUG, "finish", "Bond receiver already unregistered")
		}
	}

	private fun log(level: LogLevel, method: String, message: String) {
		logger.log(level, "ClassicBonder/$method", message)
	}

	/** Um pedido em andamento. Só na thread principal. */
	private class Request(val address: String, val device: BluetoothDevice, val tracker: ClassicBondTracker) {
		var receiver: BroadcastReceiver? = null
		var timeout: Runnable? = null
		var retry: Runnable? = null
	}

	companion object {
		/**
		 * Prazo de cada tentativa. O diálogo do sistema espera o usuário; o Core de produção força a desconexão depois de
		 * 12 s em "conectando" (`CRPBleConnectHelper.java:55, 611-623`), o que pode cair no meio do diálogo.
		 */
		const val ATTEMPT_TIMEOUT_MS = 45_000L

		/** `BluetoothDevice.EXTRA_REASON`, oculto no SDK; só vai para o log. */
		const val EXTRA_REASON = "android.bluetooth.device.extra.REASON"

		private const val NO_REASON = Int.MIN_VALUE

		/** Preferências do vínculo clássico (só as remoções pendentes). */
		const val PREFS_NAME = "corenext_classic_bond"

		/** Endereços cujo vínculo o esquecer ainda não conseguiu remover ([PendingBondRemovals]). */
		const val KEY_PENDING_REMOVALS = "pending_removals"
	}
}

package br.com.grupotechnos.corenext.ble

import android.bluetooth.BluetoothAdapter
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build

/**
 * Observa `BluetoothAdapter.ACTION_STATE_CHANGED` e avisa só nas transições finais (`STATE_ON`/`STATE_OFF`).
 *
 * Registrado uma vez por processo pelo `CoreGraph`, no `applicationContext` (o Core atual registra a cada
 * `init` e duplica callbacks, `SMAService.java:123-137`). Na API 33+ registra com `RECEIVER_EXPORTED`: o
 * `ACTION_STATE_CHANGED` é broadcast protegido (só a pilha do sistema pode enviá-lo), então exportar não abre
 * nada para outros apps e evita depender de qual processo do sistema (system_server ou o módulo Bluetooth) envia.
 */
class BluetoothStateReceiver(
	context: Context,
	private val onChanged: (enabled: Boolean) -> Unit,
) : BroadcastReceiver() {
	private val appContext = context.applicationContext
	private var registered = false

	fun register() {
		if (registered) return
		val filter = IntentFilter(BluetoothAdapter.ACTION_STATE_CHANGED)
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
			appContext.registerReceiver(this, filter, Context.RECEIVER_EXPORTED)
		} else {
			appContext.registerReceiver(this, filter)
		}
		registered = true
	}

	fun unregister() {
		if (!registered) return
		appContext.unregisterReceiver(this)
		registered = false
	}

	override fun onReceive(context: Context, intent: Intent) {
		if (intent.action != BluetoothAdapter.ACTION_STATE_CHANGED) return
		when (intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, BluetoothAdapter.ERROR)) {
			BluetoothAdapter.STATE_ON -> onChanged(true)
			BluetoothAdapter.STATE_OFF -> onChanged(false)
		}
	}
}

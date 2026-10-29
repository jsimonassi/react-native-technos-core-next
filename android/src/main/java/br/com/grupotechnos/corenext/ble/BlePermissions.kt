package br.com.grupotechnos.corenext.ble

import android.Manifest
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build

/**
 * Verificação de permissões e do adaptador. O Core não pede permissão (o JS pede, com a UI do app);
 * só confere antes de agir e rejeita com `PERMISSION_DENIED` quando falta.
 *
 * API 31+: `BLUETOOTH_SCAN` (declarada com `neverForLocation`) e `BLUETOOTH_CONNECT`.
 * API 30-: o scan BLE exige `ACCESS_FINE_LOCATION`; conectar não exige permissão de runtime.
 */
object BlePermissions {
	fun adapter(context: Context): BluetoothAdapter? =
		(context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

	fun isBluetoothEnabled(context: Context): Boolean = try {
		adapter(context)?.isEnabled == true
	} catch (error: SecurityException) {
		false
	}

	fun hasScanPermission(context: Context): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
		granted(context, Manifest.permission.BLUETOOTH_SCAN)
	} else {
		granted(context, Manifest.permission.ACCESS_FINE_LOCATION)
	}

	fun hasConnectPermission(context: Context): Boolean = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
		granted(context, Manifest.permission.BLUETOOTH_CONNECT)
	} else {
		true
	}

	/** Nome da permissão que falta para o scan, para a mensagem de erro. */
	fun scanPermissionName(): String =
		if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Manifest.permission.BLUETOOTH_SCAN else Manifest.permission.ACCESS_FINE_LOCATION

	private fun granted(context: Context, permission: String): Boolean =
		context.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED
}

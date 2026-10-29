package br.com.grupotechnos.corenext.store

import android.content.Context
import android.content.SharedPreferences

/**
 * Último relógio pareado, em `SharedPreferences` `"corenext.pairing"`.
 *
 * Gravado só quando a sessão chega em `READY` (o Core atual grava antes de conectar,
 * `SDKServiceManager.kt:122-142`, e acaba "lembrando" relógios que nunca parearam).
 * Apagado em `forgetDevice`. É o que `getLastPairedDevice` devolve e o que a reconexão ao voltar
 * para o app e ao religar o Bluetooth usa.
 */
class PairingPrefs(context: Context) {
	/** Relógio pareado. [name] é o `appName` do perfil (ex.: `"fitGPS"`). */
	data class Pairing(val address: String, val profileId: String, val name: String)

	private val prefs: SharedPreferences = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

	fun load(): Pairing? {
		val address = prefs.getString(KEY_ADDRESS, null) ?: return null
		val profileId = prefs.getString(KEY_PROFILE_ID, null) ?: return null
		return Pairing(address, profileId, prefs.getString(KEY_NAME, null) ?: "")
	}

	fun save(pairing: Pairing) {
		prefs.edit()
			.putString(KEY_ADDRESS, pairing.address)
			.putString(KEY_PROFILE_ID, pairing.profileId)
			.putString(KEY_NAME, pairing.name)
			.apply()
	}

	fun clear() {
		prefs.edit().clear().apply()
	}

	companion object {
		const val FILE = "corenext.pairing"
		const val KEY_ADDRESS = "address"
		const val KEY_PROFILE_ID = "profileId"
		const val KEY_NAME = "name"
	}
}

package br.com.grupotechnos.corenext.bridge

/**
 * Códigos de erro que nascem no host Android, antes de a sessão ser chamada.
 *
 * Completam os de `WatchErrorCodes` (Repo 1), que a sessão produz. Todos aparecem no `reject(code, message)`
 * e no evento `onError`. Documentados em `docs/arquitetura.md`.
 */
object HostErrorCodes {
	/** Falta `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` (API 31+) ou localização (API 30-). O JS pede; o nativo só confere. */
	const val PERMISSION_DENIED = "PERMISSION_DENIED"

	/** O Bluetooth do telefone está desligado (ou o aparelho não tem BLE). */
	const val BLUETOOTH_OFF = "BLUETOOTH_OFF"

	/** Argumento inválido vindo do JS (ex.: MAC mal formado). */
	const val INVALID_ARGUMENT = "INVALID_ARGUMENT"

	/** Falha de arquivo ao exportar logs. */
	const val IO_ERROR = "IO_ERROR"
}

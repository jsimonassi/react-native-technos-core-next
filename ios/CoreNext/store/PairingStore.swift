import Foundation
import TechnosWatchProtocol

/// Último relógio pareado numa suíte própria do `UserDefaults` (`br.com.grupotechnos.corenext.pairing`), par do
/// `PairingPrefs` do Android.
///
/// Nunca toca no `UserDefaults.standard` do app: o Core iOS atual apaga o domínio inteiro do app ao desconectar
/// (`removePersistentDomainForName`, `TechnosWareCore/ios/smaBluetooth/SMAService.m:148-149`), o que leva junto as
/// preferências do app. Aqui o `clear` remove só as três chaves desta suíte.
///
/// O `address` é o UUID do `CBPeripheral` (`identifier.uuidString`), que muda se o app for reinstalado: o pareamento
/// salvo não sobrevive à reinstalação.
///
/// **Threading.** O `CoreBridge` grava na thread da sessão (no `READY`) e lê de outras (`getLastPairedDevice` na do
/// TurboModule, `reconnectIfPaired` na principal ou na fila do Bluetooth). Cada chamada do `UserDefaults` é thread-safe,
/// mas o pareamento são três chaves: a trava faz `load`, `save` e `clear` atômicos entre si, como o único
/// `edit()...apply()` do `PairingPrefs` do Android (sem ela, um `load` no meio de um `save` misturaria o UUID novo com o
/// `profileId` do relógio anterior).
final class PairingStore {
	static let suiteName = "br.com.grupotechnos.corenext.pairing"
	static let keyAddress = "address"
	static let keyProfileId = "profileId"
	static let keyName = "name"

	private let defaults: UserDefaults
	private let lock = NSLock()

	init(defaults: UserDefaults) {
		self.defaults = defaults
	}

	/// A suíte de produção; cai no `standard` só se o sistema recusar a suíte (nome inválido, o que não acontece aqui).
	static func production() -> PairingStore {
		PairingStore(defaults: UserDefaults(suiteName: suiteName) ?? .standard)
	}

	func load() -> CorePairing? {
		lock.lock()
		defer { lock.unlock() }
		guard
			let address = defaults.string(forKey: PairingStore.keyAddress),
			let profileId = defaults.string(forKey: PairingStore.keyProfileId)
		else { return nil }
		return CorePairing(address: address, profileId: profileId, name: defaults.string(forKey: PairingStore.keyName) ?? "")
	}

	func save(_ pairing: CorePairing) {
		lock.lock()
		defer { lock.unlock() }
		defaults.set(pairing.address, forKey: PairingStore.keyAddress)
		defaults.set(pairing.profileId, forKey: PairingStore.keyProfileId)
		defaults.set(pairing.name, forKey: PairingStore.keyName)
	}

	func clear() {
		lock.lock()
		defer { lock.unlock() }
		for key in [PairingStore.keyAddress, PairingStore.keyProfileId, PairingStore.keyName] {
			defaults.removeObject(forKey: key)
		}
	}
}

import CoreBluetooth
import Foundation
import TechnosWatchProtocol
import UIKit

/// API pública do Core iOS para o app e para o shim do TurboModule (`RCTNativeCoreNext.mm`, que a vê pelo
/// `TechnosCoreNext-Swift.h` como `TCNCoreNext`). Sem React Native: o Swift do host não importa o React.
@objc(TCNCoreNext)
public final class CoreNext: NSObject {
	/// Chame no `application(_:didFinishLaunchingWithOptions:)` do app, antes de o React Native subir.
	///
	/// O iOS só relança o app em segundo plano para um periférico conectado (restauração do CoreBluetooth) se o
	/// `CBCentralManager` for recriado com o mesmo identificador durante o launch; o TurboModule nasce sob demanda, depois
	/// do bundle JS, tarde demais (o Core atual cria o central só no `initSMASDK`, `SMAService.m:48`). Por isso o grafo do
	/// processo (e o central) nasce aqui quando:
	/// - o app foi relançado pelo sistema para o Bluetooth (`launchOptions[.bluetoothCentrals]`), ou
	/// - o app já tem a autorização do Bluetooth (`CBManager.authorization == .allowedAlways`).
	///
	/// Sem autorização ainda, nada é criado: o primeiro uso do central mostra o pedido do sistema, e o app decide quando
	/// isso acontece (no primeiro método JS). Idempotente.
	@objc public static func bootstrap(launchOptions: [UIApplication.LaunchOptionsKey: Any]?) {
		let relaunchedForBluetooth = launchOptions?[.bluetoothCentrals] != nil
		guard relaunchedForBluetooth || CBManager.authorization == .allowedAlways else { return }
		let graph = CoreGraph.shared
		if relaunchedForBluetooth {
			let identifiers = launchOptions?[.bluetoothCentrals] as? [String] ?? []
			graph.logger.log(level: LogLevel.info, tag: "CoreNext/bootstrap", message: "Relaunched for Bluetooth restoration: \(identifiers)")
		}
	}

	/// O `CoreBridge` do processo (cria o grafo na primeira chamada). O shim chama em cada método JS.
	@objc public static func sharedBridge() -> CoreBridge {
		CoreGraph.shared.bridge
	}

	/// Uma linha INFO no log do Core (anel, `os_log` e `onLog`), para o shim registrar o próprio ciclo de vida.
	@objc public static func log(tag: String, message: String) {
		CoreGraph.shared.logger.log(level: LogLevel.info, tag: tag, message: message)
	}
}

/// O par `resolve`/`reject` de uma Promise do React Native como `CoreCompletion` (o `PromiseCompletion` do Android).
///
/// Todo valor não nulo passa inteiro pelo `FoundationConverter` numa lista de um elemento e é lido de volta fora do
/// Kotlin: o `KotlinBoolean` do `isConnected` vira `CFBoolean` (o JS recebe `true`/`false`, não `1`/`0`), e os mapas e
/// listas, `NSDictionary`/`NSArray` com os tipos de valor de sempre. O `CoreBridge` chama exatamente um dos dois métodos,
/// uma vez, de qualquer thread; os blocos do React Native aceitam isso.
@objc(TCNPromiseCompletion)
public final class PromiseCompletion: NSObject, CoreCompletion {
	private let resolveBlock: (Any?) -> Void
	private let rejectBlock: (String, String?, Error?) -> Void

	/// Os mesmos tipos de `RCTPromiseResolveBlock` e `RCTPromiseRejectBlock`.
	@objc public init(resolve: @escaping (Any?) -> Void, reject: @escaping (String, String?, Error?) -> Void) {
		resolveBlock = resolve
		rejectBlock = reject
		super.init()
	}

	public func resolve(value: Any?) {
		resolveBlock(PromiseCompletion.toJS(value))
	}

	public func reject(code: String, message: String) {
		rejectBlock(code, message, nil)
	}

	/// O valor como o React Native o converte para JS (`nil` vai como está).
	static func toJS(_ value: Any?) -> Any? {
		guard let value else { return nil }
		return FoundationConverter.shared.toArray(values: [value]).first
	}
}

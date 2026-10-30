import CoreBluetooth
import Foundation

/// O que o estado do `CBCentralManager` significa para a sessão.
enum BluetoothPower: Equatable {
	/// `.unknown`: o central ainda não disse nada (logo depois de criado). Nada a entregar.
	case unknown
	/// `.poweredOn`.
	case on
	/// `.poweredOff`, `.unauthorized`, `.unsupported` e `.resetting`: não há link possível, e o CoreBluetooth já
	/// invalidou os periféricos (no `.resetting`, a conexão com o serviço do sistema caiu) sem chamar
	/// `didDisconnectPeripheral`.
	case off

	init(_ state: CBManagerState) {
		switch state {
		case .poweredOn: self = .on
		case .unknown: self = .unknown
		case .poweredOff, .unauthorized, .unsupported, .resetting: self = .off
		@unknown default: self = .off
		}
	}

	/// Nome curto do estado para o log.
	static func describe(_ state: CBManagerState) -> String {
		switch state {
		case .unknown: return "unknown"
		case .resetting: return "resetting"
		case .unsupported: return "unsupported"
		case .unauthorized: return "unauthorized"
		case .poweredOff: return "poweredOff"
		case .poweredOn: return "poweredOn"
		@unknown default: return "state(\(state.rawValue))"
		}
	}
}

/// Decide o que entregar à sessão e ao `CoreBridge` a cada `centralManagerDidUpdateState`, sem CoreBluetooth (testado
/// em `BluetoothPowerTrackerTests`).
///
/// - Primeiro estado definitivo desligado (o central nasceu com o Bluetooth desligado, sem autorização ou num aparelho
///   sem BLE, como o simulador): `turnedOff`, o mesmo `false` do `reportBluetoothOffAtStartup` do Android; sem ele a
///   sessão ficaria em `DISCONNECTED` e o JS veria 0, não 4.
/// - Primeiro estado ligado: `initialOn`. Nada vai para a sessão (ela já nasce supondo o Bluetooth ligado), mas o
///   `CoreBridge` é avisado (`onBluetoothTurnedOn`): um `initialize()` que chegou antes do primeiro estado viu o
///   Bluetooth "desligado" e não reconectou.
/// - Depois, só as transições: `turnedOff` uma vez por desligamento, `turnedOn` uma vez por religamento.
struct BluetoothPowerTracker {
	enum Decision: Equatable {
		case none
		/// Parar o transporte sem `onDisconnected` (contrato B) e entregar `onBluetoothStateChanged(false)`.
		case turnedOff
		/// Entregar `onBluetoothStateChanged(true)` e depois avisar o `CoreBridge`.
		case turnedOn
		/// Só avisar o `CoreBridge` (primeiro estado, ligado).
		case initialOn
	}

	/// O último estado entregue (`nil` = nenhum ainda).
	private(set) var reported: Bool?

	mutating func update(_ power: BluetoothPower) -> Decision {
		switch power {
		case .unknown:
			return .none
		case .off:
			guard reported != false else { return .none }
			reported = false
			return .turnedOff
		case .on:
			switch reported {
			case .none:
				reported = true
				return .initialOn
			case .some(false):
				reported = true
				return .turnedOn
			case .some(true):
				return .none
			}
		}
	}
}

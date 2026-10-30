import Foundation

/// Espera antes de re-armar uma conexão pendente (`autoReconnect = true`) que falhou em `didFailToConnect`, sem
/// CoreBluetooth, para ser testada no simulador (`RearmBackoffTests`).
///
/// Por que não uma espera que só cresce: o app suspenso não roda timer do GCD, e o despertar do CoreBluetooth dá só uns
/// segundos de execução em segundo plano. Uma espera de 8 s, 16 s ou 30 s depois de uma falha deixaria o relógio sem
/// conexão pendente até o app voltar ao primeiro plano. Por isso:
///
/// - Tentativa que falhou depois de esperar (`attemptDuration >= fastFailure`): o relógio apareceu e a conexão não
///   fechou. Re-arma na hora (espera 0), ainda dentro do despertar; a conexão pendente é passiva e não tem timeout, então
///   isso não gira o rádio.
/// - Falha rápida seguida (`< fastFailure`; um erro que falha na hora): espera que dobra de 1 s até 30 s, para não
///   repetir sem parar. As primeiras esperas cabem no despertar. O vínculo apagado no relógio
///   (`CBError.peerRemovedPairingInformation`), que também falha na hora, não chega aqui: re-armar nunca passaria, e o
///   `LinkLifecycle` encerra a conexão com `GattStatus.PAIRING_REMOVED`.
struct RearmBackoff {
	/// Abaixo disto uma falha conta como "na hora".
	static let fastFailure: TimeInterval = 5
	static let baseDelay: TimeInterval = 1
	static let maxDelay: TimeInterval = 30

	/// Falhas rápidas seguidas desde a última tentativa que esperou (ou desde o `reset`).
	private(set) var fastFailures = 0

	/// A tentativa pendente falhou `attemptDuration` segundos depois de armada: devolve a espera antes de re-armar.
	mutating func failed(after attemptDuration: TimeInterval) -> TimeInterval {
		guard attemptDuration < RearmBackoff.fastFailure else {
			fastFailures = 0
			return 0
		}
		fastFailures += 1
		return min(RearmBackoff.baseDelay * pow(2, Double(min(fastFailures - 1, 5))), RearmBackoff.maxDelay)
	}

	/// Conectou, ou um `connect()` novo começou.
	mutating func reset() {
		fastFailures = 0
	}
}

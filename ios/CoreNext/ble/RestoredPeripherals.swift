import Foundation

/// Periféricos que a restauração do CoreBluetooth (`willRestoreState`) devolveu e que nenhum `connect()` da sessão
/// reclamou ainda, sem CoreBluetooth, para ser testado no simulador (`RestoredPeripheralsTests`).
///
/// Por que existe: num relançamento em segundo plano o `didConnect` da conexão pendente que acordou o app costuma chegar
/// antes do `connect()` da sessão (o `CoreBridge` só pede a reconexão no primeiro `.poweredOn`, e ela passa pela fila da
/// sessão antes de voltar ao transporte). Sem esta lista, o `CentralTransport` trataria esse `didConnect` como conexão
/// velha e a cancelaria, derrubando o link que acordou o app. Com ela, o link fica aberto até a sessão pedir o
/// `connect()` (o `central.connect` de um periférico já conectado devolve o `didConnect` na hora) ou até o prazo do
/// transporte vencer sem ninguém reclamar.
///
/// Não é thread-safe de propósito: só a fila do Bluetooth usa.
struct RestoredPeripherals {
	/// Restaurados ainda sem dono.
	private(set) var unclaimed = Set<UUID>()

	var isEmpty: Bool { unclaimed.isEmpty }

	/// `willRestoreState` devolveu estes periféricos.
	mutating func restore(_ ids: [UUID]) {
		unclaimed.formUnion(ids)
	}

	/// `didConnect` de um periférico que não é a tentativa atual: `true` se é um restaurado sem dono e o transporte está
	/// livre (nenhum link nem tentativa), e então a conexão fica aberta à espera do `connect()` da sessão.
	func keepsUnrequestedConnection(_ id: UUID, transportBusy: Bool) -> Bool {
		!transportBusy && unclaimed.contains(id)
	}

	/// A sessão pediu `connect()` deste periférico: deixa de ser restaurado (um `didConnect` velho dele volta a ser
	/// cancelado como qualquer outro).
	mutating func claim(_ id: UUID) {
		unclaimed.remove(id)
	}

	/// Esvazia a lista (prazo vencido ou Bluetooth desligado) e devolve quem ainda estava sem dono.
	mutating func releaseAll() -> Set<UUID> {
		defer { unclaimed.removeAll() }
		return unclaimed
	}
}

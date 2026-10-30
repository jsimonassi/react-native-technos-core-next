import Foundation
import TechnosWatchProtocol
import UIKit

/// O "trabalho em segundo plano" do sync (`CoreHost.startSyncWork`/`stopSyncWork`). No Android é o
/// `SyncForegroundService`; no iOS, uma tarefa de segundo plano do `UIApplication`, que dá ao app alguns segundos a mais
/// se ele for para o fundo no meio do sync (o modo `bluetooth-central` mantém o link, não a CPU entre eventos).
protocol BackgroundWork: AnyObject {
	func begin()
	func end()
}

/// `beginBackgroundTask`/`endBackgroundTask`, uma tarefa por sync. Uma recusa ou expiração só vai para o log: o sync
/// continua (contrato do `CoreHost.startSyncWork`). Thread-safe; a Apple documenta as duas chamadas como seguras fora da
/// thread principal.
final class UIKitBackgroundWork: BackgroundWork {
	private let logger: WatchLogger
	private let lock = NSLock()
	private var task: UIBackgroundTaskIdentifier = .invalid

	init(logger: WatchLogger) {
		self.logger = logger
	}

	func begin() {
		lock.lock()
		defer { lock.unlock() }
		guard task == .invalid else { return }
		task = UIApplication.shared.beginBackgroundTask(withName: "corenext.sync") { [weak self] in
			self?.logger.log(level: LogLevel.warn, tag: "BackgroundWork/expired", message: "Background time expired during sync")
			self?.end()
		}
		if task == .invalid {
			logger.log(level: LogLevel.warn, tag: "BackgroundWork/begin", message: "Background task refused; sync continues in foreground only")
		}
	}

	func end() {
		lock.lock()
		let current = task
		task = .invalid
		lock.unlock()
		if current != .invalid { UIApplication.shared.endBackgroundTask(current) }
	}
}

/// Sem tarefa de segundo plano (testes no simulador, que não têm `UIApplication`). Conta as chamadas.
final class NoBackgroundWork: BackgroundWork {
	private let lock = NSLock()
	private(set) var begins = 0
	private(set) var ends = 0

	func begin() {
		lock.lock()
		begins += 1
		lock.unlock()
	}

	func end() {
		lock.lock()
		ends += 1
		lock.unlock()
	}
}

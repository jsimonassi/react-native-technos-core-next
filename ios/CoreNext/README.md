# `ios/CoreNext/`

Fontes do pod iOS (`react-native-technos-core-next.podspec`, módulo Swift `TechnosCoreNext`). É o par do
`android/src/main/java/br/com/grupotechnos/corenext/`: a plataforma iOS sob o `CoreBridge` do Repo 1, que decide o que
cada método JS faz. Desenho e motivos em [`../../docs/ios-pendente.md`](../../docs/ios-pendente.md).

## Arquivos da raiz

| Arquivo | Papel | Par no Android |
|---|---|---|
| `CoreNext.swift` | API pública: `CoreNext.bootstrap(launchOptions:)` (o `AppDelegate` chama), `CoreNext.sharedBridge()` e `CoreNext.log(tag:message:)` (o shim chama) e a `PromiseCompletion` (o par resolve/reject do RN como `CoreCompletion`, com o valor pelo `FoundationConverter`). No Objective-C: `TCNCoreNext` e `TCNPromiseCompletion`. | `NativeCoreNextPackage`, `bridge/PromiseCompletion` |
| `CoreGraph.swift` | Um por processo: logger, gravador, store, transporte, `WatchSession`, `IosCoreHost` e `CoreBridge`; repassa os ganchos do transporte (Bluetooth, scan) ao controlador. | `CoreGraph` |
| `IosCoreHost.swift` | O `CoreHost`: autorização e estado do Bluetooth, endereço = UUID, scan, tarefa de segundo plano no sync, pareamento, cabeçalho da gravação, log e `exportLogs`. Só delega. | `AndroidCoreHost` |
| `BackgroundWork.swift` | `beginBackgroundTask`/`endBackgroundTask` durante o sync (`UIKitBackgroundWork`) e a versão vazia dos testes. | `ble/SyncForegroundService` |

## Pastas

| Pasta | O quê | Pode depender de |
|---|---|---|
| [`ble/`](ble/README.md) | `CentralTransport` (CoreBluetooth), `LinkLifecycle`, `GattQueue`, `BluetoothPowerTracker`, o protocolo `HostTransport` | Repo 1 (`transport`, `profile`, `log`), CoreBluetooth |
| [`store/`](store/README.md) | `FileSampleStore` (JSON em `Application Support`), `SampleJsonCodec`, `PairingStore` (suíte própria do `UserDefaults`) | Repo 1 (`SampleStore`, domínio, `log`), Foundation |
| [`log/`](log/README.md) | `RingLogger` (anel de 2000, `os_log`, `onLog`), `FrameRecorder` (fixture `.jsonl`) | Repo 1 (`log`), Foundation |
| [`turbomodule/`](turbomodule/README.md) | `RCTNativeCoreNext.mm`, o shim ObjC++ do TurboModule | React Native (codegen), o framework do Repo 1, a API pública acima |

`ble/`, `store/` e `log/` não usam umas às outras (num módulo Swift isso é convenção, não import): quem as liga é o
`CoreGraph`. Só o `turbomodule/` conhece o React Native; o Swift não importa o React e por isso compila e testa sem ele
(`../Package.swift`, `../Tests/`).

## Não faz

Regra de método JS nem de protocolo (Repo 1: `CoreBridge` e `:protocol`). SDK de fabricante: o transporte fala direto
com o CoreBluetooth.

## Testes

No simulador, sem React Native nem Bluetooth: [`../Tests/README.md`](../Tests/README.md).

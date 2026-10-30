# `ios/Tests/` — testes do host iOS no simulador

Pacote Swift (`../Package.swift`) que compila os fontes Swift de `../CoreNext/` (sem o shim ObjC++) contra o
`TechnosWatchProtocol.xcframework` de `../Frameworks/` e roda com `xcodebuild test` num simulador iOS. Sem React Native
e sem Bluetooth: o simulador não tem BLE, então o relógio é uma gravação real do Repo 1.

## Rodar

```sh
ios/scripts/sync-xcframework.sh            # uma vez (ou --build, se o Repo 1 mudou)
xcrun simctl list devices available        # copie o UDID de um iPhone
cd ios
xcodebuild test -scheme TechnosCoreNext -destination "platform=iOS Simulator,id=<UDID>"
```

Pelo UDID e não pelo nome: com dois simuladores de mesmo nome, `name=` falha com "multiple devices matched".

As fixtures vêm do clone irmão `../technos-watch-protocol/fixtures` (achado a partir do caminho do fonte; o simulador
enxerga o disco do Mac). Outro lugar: `TEST_RUNNER_TWP_FIXTURES_DIR=/caminho/fixtures xcodebuild test ...` (o
`xcodebuild` repassa ao processo de teste as variáveis com o prefixo `TEST_RUNNER_`, sem o prefixo). Cada replay imprime
uma linha `IOS-REPLAY` no log do teste (`grep IOS-REPLAY`).

## O que cada arquivo faz

| Arquivo | O quê |
|---|---|
| `CoreBridgeReplayTests.swift` | O host inteiro: `CoreGraph` de verdade (`CoreBridge` e sessão do framework Kotlin, `IosCoreHost`, `FileSampleStore`, `PairingStore`, `RingLogger`, `FrameRecorder`) sobre o `ReplayTransport`, método JS por método JS, na ordem em que o app de exemplo os chamou nas gravações (e a reconexão pedida no primeiro `.poweredOn` de um processo sem JS, o relançamento da restauração): `real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl` (167 TX, Bluetooth desligado e religado no meio), `real/fitgps/0.2.1/pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl` (32 TX, Disconnect e Reconnect last) e `real/lifeultragps/1.1.1/pair-info-time-steps-sync.jsonl` (12 TX, escrita sem resposta). Confere TX iguais à gravação, passos (56 no fitGPS, 51 no Life Ultra GPS), eventos convertidos, `isConnected` como `CFBoolean`, `getLastPairedDevice` como `NSDictionary`, `exportLogs` legível pelo leitor de fixture, `forgetDevice` apagando o pareamento sem tocar no `UserDefaults` do app, e o `invalidate` de um reload. |
| `ReplayTransport.swift` | `HostTransport` de teste: compara cada TX com o próximo TX gravado (máscara da família) e entrega os RX gravados de forma assíncrona, numa fila própria, como o `CentralTransport`; completa os dois tipos de escrita; simula o Bluetooth com o mesmo `BluetoothPowerTracker` (contrato B). |
| `TxMaskers.swift` | Port da `TxMasker` (SMA) e da `IdoTxMasker` do kit de teste do Repo 1. |
| `Recording.swift` | Leitor mínimo do `.jsonl` (formato no `docs/fixtures.md` do Repo 1) e onde achar as fixtures. |
| `TestSupport.swift` | O `CoreEventSink` que converte como o shim, o relógio parado na hora da gravação, o `HostHarness`. |
| `LinkStateTests.swift` | Contrato B e ciclo do link sem CoreBluetooth: `LinkLifecycle`, `BluetoothPowerTracker`, `GattQueue`, `RestoredPeripherals` (o `didConnect` de um restaurado antes do `connect()` da sessão), `RearmBackoff`, o tipo de escrita efetivo (`CentralTransport.effectiveWriteType`) e o status de cada `NSError` (`CentralTransport.linkStatus`, na conexão, na descoberta e no CCCD: `peerRemovedPairingInformation` → `GattStatus.PAIRING_REMOVED`, que termina a conexão pendente em vez de re-armar; `CentralTransport.status`, na escrita e na leitura: o código nativo). |
| `StoreAndLogTests.swift` | `FileSampleStore`, `PairingStore` (também sob gravação e leitura concorrentes), `RingLogger` (concorrência), `FrameRecorder`, regras do `IosCoreHost`. |

## O que não cobre

O CoreBluetooth de verdade (descoberta, CCCD, MTU, escrita sem resposta com o buffer cheio, restauração) e o shim
ObjC++: isso só no iPhone, com o roteiro do [`example/README.md`](../../example/README.md#rodar-no-iphone).

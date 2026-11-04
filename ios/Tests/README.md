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
uma linha `IOS-REPLAY` no log do teste (`grep IOS-REPLAY`), e cada teste da fase 2, uma `IOS-PHASE2`.

**Fuso.** O `FixedClock` fixa a hora e o fuso da sessão (os da gravação), mas o `deletedSavedData` do `CoreBridge` acha o
dia de cada data no fuso do sistema, como no telefone. Por isso os testes passam a data como o meio-dia local do dia a
confirmar (`localNoonIso`), e não uma hora fixa em UTC, que viraria o dia seguinte de UTC+9 para leste. Os testes não
dependem do fuso do simulador; para conferir: `TEST_RUNNER_TZ=Asia/Tokyo xcodebuild test ...` (e um fuso negativo, como
`Pacific/Honolulu`).

## O que cada arquivo faz

| Arquivo | O quê |
|---|---|
| `CoreBridgeReplayTests.swift` | O host inteiro: `CoreGraph` de verdade (`CoreBridge` e sessão do framework Kotlin, `IosCoreHost`, `FileSampleStore`, `PairingStore`, `RingLogger`, `FrameRecorder`) sobre o `ReplayTransport`, método JS por método JS, na ordem em que o app de exemplo os chamou nas gravações (e a reconexão pedida no primeiro `.poweredOn` de um processo sem JS, o relançamento da restauração): `real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl` (167 TX, Bluetooth desligado e religado no meio), `real/fitgps/0.2.1/pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl` (32 TX, Disconnect e Reconnect last) e `real/lifeultragps/1.1.1/pair-info-time-steps-sync.jsonl` (12 TX, escrita sem resposta), a real do Condor Reebok, `real/condorreebok/MOY-VS02-2.0.0/pair-forget-pair-commands-sync-bt-reconnect.jsonl` (38 TX e 7 READ, gravada no Android: `initialize`, `scan`, `pairDevice`, `forgetDevice` com o `F8`, `getLastPairedDevice`, `pairDevice` de novo, `getDeviceInfo`, `getFirmwareInfo`, `getBatteryStatus`, `setTime` e a releitura que a sessão faz sozinha quando FEE1 notifica passos, `refreshSteps`, `syncDataHistory` com 77 passos ontem e 21 hoje, `getHistoryPedometer`, `getHistorySleep` com `NO_DATA`, `deletedSavedData` de ontem, `getHistoryPedometer` de novo e Bluetooth desligado e religado), a do mesmo relógio gravada no iPhone, `real/condorreebok/MOY-VS02-2.0.0/ios-pair-commands-sync-reconnect.jsonl` (27 TX e 5 READ, MTU 515: `initialize`, `scan`, `pairDevice` com o vínculo clássico "não suportado", `getDeviceInfo`, `getFirmwareInfo`, `getBatteryStatus`, `setTime`, `refreshSteps`, `syncDataHistory` com 77 passos ontem e 21 hoje, `getHistoryPedometer`, `getHistorySleep` com `NO_DATA` e a reconexão do fim, aqui com o Bluetooth desligado e religado, porque a gravação não diz a causa; nenhuma notificação de FEE1, 2A19 ou 2A37) e a sintética do Condor Reebok, `synthetic/condorreebok-pair-sync.jsonl` (12 TX e 3 READ: handshake de versão com a fase `VERSION`, bateria 50 %, firmware `MOY-VS02-2.0.0`, sync sem passos nem sono, a bateria espontânea de `2a19`, o vínculo clássico "não suportado" sem `onError` e o `F8` do forget). Confere TX iguais à gravação, passos (56 no fitGPS, 51 no Life Ultra GPS), eventos convertidos, `isConnected` como `CFBoolean`, `getLastPairedDevice` como `NSDictionary`, `exportLogs` legível pelo leitor de fixture, `forgetDevice` apagando o pareamento sem tocar no `UserDefaults` do app, e o `invalidate` de um reload. |
| `Phase2HostTests.swift` | Os ajustes, mensagens e interações da fase 2 pelo host inteiro, com os `NSDictionary` que o shim repassa (`NSNumber` de ponto flutuante, `CFBoolean` e `NSNull`), sobre o começo da sintética do Condor Reebok (o pareamento até o `BB 07 00`; depois dele cada TX vai para o `extraTx`): `setUserInfo` e `setMenstrual` chegam ao relógio com os bytes reais (`12` e `75`) enquanto o anel do log, o `onLog` e o export só têm a cópia redigida do mesmo tamanho (D14), e a `CrpTxMasker` iguala as duas; `vibrateDevice` (`61`) vai inteiro; `INVALID_ARGUMENT` com o `onError` (`requestId` -1 e o método) antes do reject e nada escrito; os avisos do relógio injetados (`62 00`/`62 01` → `onFindPhone` `"1"`/`"0"`; `66` com a câmera fechada → `onDeviceRequestedCameraMode`; o `onOpenCameraMode` antes do resolve do `openCameraMode`; `66` com ela aberta → `onTakeAPicture`; `53 0E FF` fecha o modo; o `53 0E` do `closeCameraMode`); sem conexão, `NOT_READY` com o `onError` e o `closeCameraMode` que só resolve (D5). Cada evento emitido tem ramo no `emitName:` do shim. Valores fictícios. |
| `TurboModuleSourceTests.swift` | Lê o `RCTNativeCoreNext.mm` e o `src/specs/NativeCoreNext.ts` e confere o que o compilador não garante no shim: os 56 métodos do spec implementados, cada um com uma chamada ao `CoreBridge`; os 24 argumentos de objeto conferidos pelo `CNRejectNil` antes dela (um `nil` passado ao framework encerra o processo, DP-100); e os 27 eventos, cada um com o seu ramo no `emitName:payload:` chamando o `emitOnX:` do mesmo nome; à parte, os 9 métodos e os 10 eventos da fase 3. |
| `TxMaskersTests.swift` | A `CrpTxMasker` com os TX privados (D14), em frames fictícios: cada comando privado (`12`, `75`, `42`, `43`, `41`, `B5 00`, `F2 02`) igual à cópia redigida e diferente com outro tamanho; o prefixo mantido (`cmd`, o sub do `B5`, o `02` e o id do `F2 02`) ainda comparado; um `F2 02` de 50 bytes em três escritas de bloco 20; o `41 FF` e os frames públicos comparados inteiros; os segundos do `31`; a chave do frame sem byte privado. |
| `ReplayTransport.swift` | `HostTransport` de teste: compara cada TX com o próximo TX gravado (máscara da família), responde cada leitura com o próximo READ gravado da mesma characteristic e entrega os RX gravados de forma assíncrona, numa fila própria, na characteristic gravada, como o `CentralTransport`; descobre os serviços do candidato e os das `sideNotify`; completa os dois tipos de escrita; simula o Bluetooth com o mesmo `BluetoothPowerTracker` (contrato B); `notify(characteristic:hex:)` entrega um aviso do relógio fora da gravação. |
| `TxMaskers.swift` | Port da `TxMasker` (SMA), da `IdoTxMasker` e da `CrpTxMasker` do kit de teste do Repo 1. A CRP guarda estado entre pacotes (um frame pode ocupar várias escritas) e zera os segundos do `31` e, nos frames com dado pessoal, o payload depois do prefixo que a redação mantém (cópia do `CrpCommand.privatePrefix`, ADR 36 do Repo 1): o TX privado é comparado por `(cmd, sub, tamanho)` nos multiplexados e por `(cmd, tamanho)` nos outros. |
| `Recording.swift` | Leitor mínimo do `.jsonl` (formato no `docs/fixtures.md` do Repo 1, com `TX`, `RX` e `READ`), onde achar as fixtures e o `prefix(through:)` (só o começo de uma gravação). |
| `TransportOptionsTests.swift` | Opções do `connect`: transport bridging só com `Quirks.iosTransportBridging` (Condor Reebok), decidido pelo perfil que a sessão gravou antes do `connect`. |
| `TestSupport.swift` | O `CoreEventSink` que converte como o shim, o relógio parado na hora da gravação, o `HostHarness` (de uma fixture ou de uma gravação já carregada) e o `localNoonIso` (a data do `deletedSavedData`, abaixo). |
| `LinkStateTests.swift` | Contrato B e ciclo do link sem CoreBluetooth: `LinkLifecycle`, `BluetoothPowerTracker`, `GattQueue`, `RestoredPeripherals` (o `didConnect` de um restaurado antes do `connect()` da sessão), `RearmBackoff`, o tipo de escrita efetivo (`CentralTransport.effectiveWriteType`) e o status de cada `NSError` (`CentralTransport.linkStatus`, na conexão, na descoberta e no CCCD: `peerRemovedPairingInformation` → `GattStatus.PAIRING_REMOVED`, que termina a conexão pendente em vez de re-armar; `CentralTransport.status`, na escrita e na leitura: o código nativo). |
| `StoreAndLogTests.swift` | `FileSampleStore`, `PairingStore` (também sob gravação e leitura concorrentes), `RingLogger` (concorrência), `FrameRecorder` (inclusive a leitura gravada como `READ`), regras do `IosCoreHost` (inclusive o vínculo clássico "não suportado", assíncrono e com a dica). |

## O que não cobre

O CoreBluetooth de verdade (descoberta, CCCD, MTU, escrita sem resposta com o buffer cheio, restauração, o efeito do
transport bridging) e o shim ObjC++ rodando (o `TurboModuleSourceTests` só lê o fonte; os builds do exemplo o
compilam): isso só no iPhone, com o roteiro do [`example/README.md`](../../example/README.md#rodar-no-iphone). Da fase
2, o relógio de verdade (respostas opcionais, ecos, bytes na tela) fica para a validação com o P85; nenhuma gravação
da fase 2 entrou ainda como fixture.

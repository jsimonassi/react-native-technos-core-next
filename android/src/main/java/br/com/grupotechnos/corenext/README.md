# `br.com.grupotechnos.corenext` (Android)

Implementação Android do TurboModule `NativeCoreNext`. É um host fino: uma casca sobre o `CoreBridge` do Repo 1
(`technos-watch-protocol`, módulo `:bridge`), mais o que só o Android tem: transporte BLE, persistência, log e a
conversão de valores do React Native. Toda regra de protocolo (frames SMA, handshake, sync) e toda regra de método JS
(checagens, eventos, ordem evento/`resolve`, rejeições, `NO_DATA`, pareamento salvo, FGS, reconexão automática) estão
no Repo 1, consumido como AAR (`br.com.grupotechnos.watch:bridge:0.1.0`, que traz o `protocol:0.1.0`, via
`mavenLocal`).

## Arquivos da raiz

| Arquivo | Papel |
|---|---|
| `NativeCoreNextModule.kt` | Estende o `NativeCoreNextSpec` gerado pelo codegen. Cada método JS é uma linha que chama o método de mesmo nome do `CoreBridge`, com a Promise num `PromiseCompletion`. É o `CoreEventSink` (o `when` dos `emitOnX`); liga-se ao controlador no primeiro método JS e só chama `invalidate`/`onHostResume` depois disso. |
| `NativeCoreNextPackage.kt` | `BaseReactPackage` encontrado pelo autolinking. |
| `CoreGraph.kt` | Montagem do processo: `WatchSession(AndroidGattTransport, RingLogger, FileSampleStore)`, scanner, prefs, `ClassicBonder`, o `AndroidCoreHost` e o `CoreBridge`. Liga o scanner, o resultado do vínculo clássico (`onClassicBondResult`), o `onEntry` do log e o `BluetoothStateReceiver` aos ganchos do controlador; o Bluetooth ligado e a partida também retomam as remoções de vínculo pendentes do `ClassicBonder`. Sobrevive ao reload do JS. |
| `AndroidCoreHost.kt` | O `CoreHost` do Android: permissões (`BlePermissions`), Bluetooth ligado, MAC válido (`BluetoothAdapter.checkBluetoothAddress`), scan, FGS do sync, `PairingPrefs`, cabeçalho da gravação, log em memória, `exportLogs` e o vínculo Bluetooth clássico (`hasClassicBond`, `requestClassicBond`, `removeClassicBond`, pelo `ClassicBonder`). Só delega. No fim do arquivo, as conversões puras para os tipos do `:bridge` (`CoreLogEntry`, `CorePairing`, `ClassicBondResult`). |

## Pastas

- [`ble/`](ble/README.md): `BluetoothGatt`, fila GATT, scan, estado do adaptador, FGS do sync, vínculo Bluetooth
  clássico.
- [`bridge/`](bridge/README.md): o lado React Native da ponte (`WritableConverter`, `ReadableConverter`,
  `PromiseCompletion`).
- [`store/`](store/README.md): histórico em JSON e último pareamento.
- [`log/`](log/README.md): anel de log, Logcat, `onLog` e gravação de frames em `.jsonl`.

## O que não fica aqui

Protocolo de fabricante, máquina de estados da sessão, agregação de passos e análise de sono (Repo 1, `:protocol`).
O que cada método JS faz, a fila de eventos e os pedidos em andamento (Repo 1, `CoreBridge`; o que mudou e onde foi
parar, em `docs/arquitetura.md`, "O que mora onde"). Pedido de permissão (o JS pede; o nativo só confere e rejeita com
`PERMISSION_DENIED`). iOS (`ios/README.md`).

## Invariantes

- Um `CoreGraph` (e um `CoreBridge`) por processo; um `NativeCoreNextModule` por instância React (recriado no reload).
- Nenhum `override` do módulo tem regra: é uma chamada ao `CoreBridge`. Regra nova vai para o Repo 1, com teste lá.
- Todo comando com Promise termina com exatamente um `resolve` ou `reject` (o `CoreBridge` garante, porque a sessão
  garante um callback terminal por `requestId`). Toda rejeição também sai como evento `onError` com o nome do método.
- Nada aqui bloqueia a thread do GATT nem a do JS: o módulo roda na thread de módulos nativos do RN, o transporte na
  `HandlerThread` "corenext-gatt" e o listener do `CoreBridge` na thread da sessão.

## Testes

`cd example/android && ./gradlew :react-native-technos-core-next:testDebugUnitTest` (JVM, sem aparelho). Nesta pasta,
`AndroidCoreHostTest` (o nome da permissão na mensagem e as conversões, campo a campo, inclusive o resultado do vínculo
clássico) e
`DeletedSavedDataEquivalenceTest` (o `deletedSavedData` antigo do módulo, copiado sem mudança, contra
`ReadableConverter` + `CoreBridge` sobre uma `WatchSession` de verdade, em 2.100 arrays aleatórios e três fusos). As
regras do `CoreBridge` são testadas no Repo 1. Arquitetura completa em `docs/arquitetura.md`; transporte em
`docs/transporte-android.md`.

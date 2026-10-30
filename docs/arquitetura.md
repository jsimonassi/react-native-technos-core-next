# Arquitetura do `react-native-technos-core-next`

Visão do Repo 2: um TurboModule fino sobre o `technos-watch-protocol` (Repo 1). Esta PoC cobre as famílias SMA
(Mormaii fitGPS) e iDO (Mormaii Life Ultra GPS, funções básicas) no Android e, desde 2026-10-30, no iOS (testado num
iPhone com os dois relógios no mesmo dia, sem reconexão nem segundo plano; seção [iOS](#ios)). O host não tem código por família: os
filtros do scan saem de `Profiles.all`, e o perfil diz à sessão quais CCCD ligar (no iDO, dois), se pede MTU e o tipo de
escrita que o driver usa (no iDO, sem resposta). O que cada método JS faz (checagens, eventos, ordem evento/`resolve`, rejeições,
pareamento salvo, reconexão automática) mora no `CoreBridge` do `:bridge` do Repo 1, descrito na seção 13 do
[`docs/arquitetura.md` de lá](../../technos-watch-protocol/docs/arquitetura.md#13-controlador-comum-corebridge); aqui
fica a plataforma. As peças do iOS estão na seção [iOS](#ios) e em detalhe em [`ios-pendente.md`](ios-pendente.md)
("iOS: estado e pendências"); o transporte Android em detalhe em
[`transporte-android.md`](transporte-android.md); o contrato JS em `src/specs/NativeCoreNext.ts` e
`src/types/events.ts`.

## Quem é dono de quê

| Camada | Onde | Responsável por | Não faz |
|---|---|---|---|
| JS | `src/` | Wrapper `TechnosCore`/`TechnosEvents`, tipos, permissões (no app) | Nada de BLE |
| Módulo | `NativeCoreNextModule.kt` | Uma chamada ao `CoreBridge` por método JS (a Promise num `PromiseCompletion`, o `ReadableArray` pelo `ReadableConverter`); ser o `CoreEventSink` (o `emitOnX` de cada nome); ligar-se ao controlador e desligar-se dele | Qualquer regra |
| Controlador | Repo 1 (`CoreBridge`, `br.com.grupotechnos.watch:bridge`) | Checagens e rejeições antecipadas, `requestId` e liquidação, evento antes do `resolve`, `NO_DATA`, pareamento salvo, quando ligar o FGS, reconexão automática, fila de eventos, ciclo de vida do módulo | Plataforma |
| Montagem | `CoreGraph.kt` | Montar a sessão, o transporte, o logger, o store, o scanner, o `AndroidCoreHost` e o `CoreBridge` uma vez por processo; ligar scanner, log e `BluetoothStateReceiver` aos ganchos do controlador | Decidir algo |
| Plataforma | `AndroidCoreHost.kt` | O `CoreHost`: permissões, Bluetooth ligado, MAC válido, scan, FGS, `PairingPrefs`, cabeçalho da gravação, log em memória e export | Decidir quando |
| Transporte | `ble/` | `BluetoothGatt`, fila GATT, scan, estado do adaptador, FGS do sync | Decidir quando reconectar ou desistir |
| Ponte RN | `bridge/` | `WritableConverter` (payload → `WritableMap`), `ReadableConverter` (`ReadableArray` → `List`), `PromiseCompletion` | Mapear o domínio (é o `EventMapper` do Repo 1) |
| Persistência | `store/` | Histórico (`SampleStore`) em JSON, último pareamento | Agregação, poda |
| Log | `log/` | Anel, Logcat, `onLog`, gravação de frames | Envio a servidor |
| Protocolo | Repo 1 (`br.com.grupotechnos.watch:protocol`) | Máquina de estados, handshake BIND/LOGIN, codec SMA, sync, agregação de passos, análise de sono | Plataforma |

```
JS (TechnosCore, TechnosEvents)
   │ métodos (Promise)                        ▲ eventos (emitOnX)
   ▼                                          │
NativeCoreNextModule ── casca: PromiseCompletion, ReadableConverter, WritableConverter; é o CoreEventSink
   │ um método = uma chamada                  ▲ emit(nome, payload)
   ▼                                          │
CoreBridge (Repo 1, :bridge) ── regras, RequestRegistry, PendingEvents, listener da sessão
   │ comandos         ▲ WatchSessionListener        │ CoreHost (consultas e efeitos)
   ▼                  │                             ▼
WatchSession (Repo 1, :protocol)             AndroidCoreHost ── BlePermissions, BleScanner, SyncForegroundService,
   │ Transport        ▲ TransportEvents                         PairingPrefs, FrameRecorder, RingLogger
   ▼                  │
AndroidGattTransport ──▶ BluetoothGatt
(o RingLogger e o FileSampleStore são o WatchLogger e o SampleStore da sessão)
```

## O que mora onde

O host Android já teve as regras: até 2026-10-29, o `NativeCoreNextModule`, o `CoreSessionListener` e o `CoreGraph`
decidiam o que cada método JS fazia, e o `bridge/` daqui tinha o mapeamento. Tudo isso passou para o `:bridge` do
Repo 1 (ADRs 20 e 21 de lá), para o iOS usar o mesmo código. O que o JavaScript vê não mudou.

| Antes, no host Android | Agora |
|---|---|
| `NativeCoreNextModule`: checagens, registro do pedido, `NO_DATA`, leitura do `deletedSavedData`, `getLogs`, `setLogLevel` | `CoreBridge` (o método de mesmo nome); o módulo só delega |
| `CoreSessionListener` (efeitos, evento, liquidação) | o listener interno do `CoreBridge` |
| `CoreGraph`: `userDisconnected`, `emitCurrentState`, `emitError`, `resolveProfile`, `sleepHistoryDays`, `reconnectIfPaired`, a fila e os pedidos | `CoreBridge` |
| `CoreGraph.exportLogs` | `AndroidCoreHost.exportLogs` |
| `bridge/EventMapper`, `StateMapper`, `SavedDataMapper`, `HostErrorCodes`, `PendingEvents`, `RequestRegistry` e os 25 testes deles | `:bridge` do Repo 1, mesmos nomes; os 25 testes, com os mesmos nomes, no `commonTest` de lá (rodam também no simulador iOS) |
| `bridge/WritableConverter` | igual, aqui |
| — | `AndroidCoreHost`, `bridge/ReadableConverter`, `bridge/PromiseCompletion` (novos) |

**O que mudou para quem lê o log.** As linhas das regras têm a tag `CoreBridge/<método>`: `CoreGraph/emitError` →
`CoreBridge/emitError`, `CoreGraph/reconnectIfPaired` → `CoreBridge/reconnectIfPaired`,
`CoreSessionListener/onStateChanged` → `CoreBridge/onStateChanged`, `CoreSessionListener/stopSyncService` →
`CoreBridge/stopSyncWork`, `NativeCoreNextModule/deletedSavedData` → `CoreBridge/deletedSavedData`,
`NativeCoreNextModule/setLogLevel` → `CoreBridge/setLogLevel`; a do export, `CoreGraph/exportLogs` →
`AndroidCoreHost/exportLogs`. As mensagens são as mesmas. `CoreGraph/init` e as tags de `ble/`, `store/` e `log/` não
mudaram.

**Prova de que o JS vê o mesmo.** No Repo 1, um teste de contrato por regra do host antigo e o golden da gravação real
do fitGPS passando pelo `CoreBridge` (seção 13 de lá). Aqui, os testes JVM do que é Android: `AndroidCoreHostTest`
(o `"Missing BLUETOOTH_CONNECT"` e as conversões para os tipos do `:bridge`), `ReadableConverterTest`,
`PromiseCompletionTest` e `DeletedSavedDataEquivalenceTest`, que roda o código antigo do módulo, copiado sem mudança,
contra `ReadableConverter` + `CoreBridge` (sobre uma `WatchSession` de verdade) em 2.100 arrays aleatórios e três
fusos, e exige as mesmas linhas de log. O resto do módulo e do `AndroidCoreHost` é delegação de uma linha, que só um
aparelho exercita (checklist do [`example/README.md`](../example/README.md#checklist-de-aceite-com-o-fitgps)).

## Ciclo de vida

- **Grafo por processo.** `CoreGraph.get(context)` cria `WatchSession(AndroidGattTransport, RingLogger,
  FileSampleStore)`, liga o transporte à sessão, cria o `CoreBridge` com o `AndroidCoreHost` (o construtor do
  controlador liga o listener da sessão) e registra o `BluetoothStateReceiver` no `applicationContext`, na primeira
  chamada de qualquer método JS (normalmente `initialize()`), e vive até o processo morrer. O TurboModule é recriado a
  cada reload do JS; o link BLE e um sync em andamento não caem junto.
- **Módulo por instância React.** Na primeira chamada de um método JS, o módulo se liga ao controlador como destino de
  eventos (`CoreBridge.attach`, que entrega a fila); as chamadas seguintes não religam. Em `invalidate()` ele chama
  `CoreBridge.invalidate`, que o desliga (se ainda for o atual) e rejeita com `CANCELLED` (`"Module invalidated"`) as
  Promises ainda pendentes, porque o JS que as esperava não existe mais. Um módulo que nunca foi usado não chama nada.
- **`initialize()`/`initSMASDK()`** são idempotentes: criam o grafo se preciso, reenviam o estado atual da sessão
  como `onConnectStateChanged` (o `CoreBridge` relê o estado depois de emitir; sem isso um JS recarregado com o relógio
  já `READY` ficaria sem estado até a próxima transição) e tentam reconectar ao relógio salvo.
- **Bluetooth desligado.** O transporte entrega só `onBluetoothStateChanged(false)`, sem `onDisconnected` para o link
  ou a conexão pendente (contrato B, [`transporte-android.md`](transporte-android.md#eventos-de-conexão)), e a sessão
  vai direto para `BLUETOOTH_OFF` (`state` 4). Antes de o transporte agir, o `CoreGraph` avisa o controlador
  (`onBluetoothTurnedOff`), que para o scan. Se o Bluetooth já está desligado quando o grafo nasce, o `CoreGraph` pede
  ao transporte o mesmo evento (`reportBluetoothOffAtStartup`), porque o `BluetoothStateReceiver` só avisa transições:
  sem isso a sessão ficaria em `DISCONNECTED` e o JS veria 0. O evento é assíncrono, então o primeiro `initialize()`
  pode ainda reenviar 0; o 4 chega depois pela transição (o último evento é sempre o estado atual) e qualquer
  `initialize()` seguinte já reenvia 4.

### Reconexão automática

O app Mormaii reconecta hoje pelo JS: `useSdkInit` chama `pairDevice(lastDevice)` sempre que o app volta ao primeiro
plano (`GTE-Mormaii/src/components/ContextDataInitializer/useSdkInit.ts:15-32`). Aqui isso é nativo e simples, no
`CoreBridge.reconnectIfPaired` do Repo 1, chamado em três momentos: `initialize()`, `onHostResume` e Bluetooth
religado (o `CoreGraph` chama `onBluetoothTurnedOn` no bloco que o transporte roda depois de entregar o evento à
sessão, para a reconexão entrar na fila da sessão depois dele). Só reconecta se todas as condições valem:

1. há pareamento salvo em `PairingPrefs` (gravado ao chegar em `READY`, exceto depois de um disconnect/forget do
   usuário; o `forgetDevice` apaga ao ser pedido e de novo quando a sessão conclui o pedido, para um `READY` que
   chegue no meio não regravar o relógio esquecido);
2. ninguém pediu `disconnectCurrentDevice`/`forgetDevice` neste processo (flag em memória `userDisconnected` do
   `CoreBridge`, zerada por `pairDevice`/`startPairingAttempt`; num processo novo o relógio volta a ser reconectado);
3. a sessão está em `DISCONNECTED` ou `BLUETOOTH_OFF`;
4. Bluetooth ligado e `BLUETOOTH_CONNECT` concedida (`AndroidCoreHost.isBluetoothEnabled` e
   `missingConnectPermission`).

A reconexão usa `session.reconnect(...)` com um `requestId` interno (sem Promise): falhas saem como `onError` com
`method: null`. Quando o link cai depois de `READY`, quem reconecta é a sessão do Repo 1 (`connect(address, true)`
na hora), sem passar por aqui; o transporte só mantém a conexão pendente que ela pediu (`transporte-android.md`). Se
o relógio recusar o LOGIN, a sessão desiste (`HANDSHAKE_FAILED`, ADR 11 do Repo 1) e só um `onHostResume` ou
`initialize` seguinte tenta de novo, com um LOGIN por vez e nunca um BIND. O mesmo vale para `PAIRING_REMOVED` (o
vínculo do sistema apagado no relógio, ADR 23 do Repo 1): uma tentativa por gatilho, sem laço.

## Threads

| Thread | O que roda |
|---|---|
| Módulos nativos do RN | Métodos do TurboModule e, dentro deles, o método do `CoreBridge` e as consultas ao `AndroidCoreHost`. `getHistoryPedometer`, `getHistorySleep`, `exportLogs` fazem IO de arquivo pequeno aqui. |
| Sessão (Repo 1, `Dispatchers.Default.limitedParallelism(1)`) | O `WatchSessionListener` do `CoreBridge` (e os efeitos que ele pede ao `AndroidCoreHost`: pareamento, FGS, cabeçalho da gravação), `SampleStore` (`FileSampleStore`), `WatchLogger`. Emite eventos JS daqui. |
| "corenext-gatt" (`HandlerThread`) | Todo o `AndroidGattTransport` e os callbacks do `BluetoothGatt` (o `connectGatt` recebe esse `Handler`); o `onBluetoothTurnedOn` do controlador. |
| Main | Callbacks de scan (`BleScanner`, que chamam `onScannedDevice`/`onScanFailed`), `BroadcastReceiver`, `onHostResume`. |

O `AndroidCoreHost` é chamado de qualquer uma delas; as peças sob ele já são thread-safe (KDoc da classe).

### Emitir eventos fora da thread JS

Verificado no React Native 0.81.4 (`example/node_modules/react-native`):

- O `emitOnX` gerado chama `mEventEmitterCallback.invoke(name, value)` sem checar `null`
  (`@react-native/codegen/lib/generators/modules/GenerateModuleJavaSpec.js:52-62`). O callback é instalado quando o
  JS cria o TurboModule (`ReactCommon/react/nativemodule/core/platform/android/ReactCommon/JavaTurboModule.cpp:972-998`).
- O callback chama `AsyncEventEmitter::emit`, que protege os listeners com mutex e chama cada `AsyncCallback`, que
  agenda a execução na thread JS pelo `CallInvoker` (`ReactCommon/react/bridging/EventEmitter.h:65-102`).

Conclusão: emitir da thread da sessão é seguro; não há `runOnJSQueueThread`. O que é preciso é não emitir antes do
callback existir. Por isso a fila do `CoreBridge` (`PendingEvents`, no `:bridge`) só entrega quando o `canEmit()` do
módulo (`hasActiveReactInstance() && mEventEmitterCallback != null`) é `true` e guarda até 500 eventos enquanto isso
(o mais antigo sai primeiro). `onLog` não entra na fila (volume alto; o anel do `RingLogger` já guarda e o `getLogs`
lê). Eventos emitidos quando o JS ainda não assinou o emitter se perdem, como em qualquer `EventEmitter` do RN: o JS
deve assinar antes de chamar o comando (o `getNativeEventData` do app já faz assim).

## Comandos, Promises e eventos

Todo comando que fala com o relógio segue o mesmo caminho, no `CoreBridge`:

1. confere (pelo `AndroidCoreHost`) permissão, Bluetooth, MAC e nome e, se algo falha, emite `onError` com
   `requestId: -1` e `method` e depois rejeita;
2. registra o `PromiseCompletion` no `RequestRegistry` com o nome do método e recebe um `requestId` (> 0);
3. chama a sessão com esse `requestId`;
4. a sessão termina **exatamente uma vez** com um callback terminal (`onDeviceInfo`, `onBattery`, `onLiveSteps`,
   `onSyncFinished`, `onCompleted` ou `onError`);
5. o listener do `CoreBridge` emite o evento JS e depois liquida a Promise (`resolve(null)` ou `reject(code,
   message)`). Todo `onError` de comando também sai como evento `onError` com o `method` do registro.

| Método JS | Sessão | Evento | Resolve quando |
|---|---|---|---|
| `pairDevice(id, name)` | `pair` | `onConnectStateChanged` | `READY` (`onCompleted`) |
| `startPairingAttempt(id, name)` | `reconnect` | `onConnectStateChanged` | na hora (a reconexão pode demorar indefinidamente) |
| `disconnectCurrentDevice()` | `disconnect(forget = false)` | `onConnectStateChanged` | `onCompleted` |
| `forgetDevice()` | `disconnect(forget = true)` + apaga `PairingPrefs` | `onConnectStateChanged` | `onCompleted` |
| `getDeviceInfo()` | `readDeviceInfo` | `onDeviceInfo` | `onDeviceInfo` |
| `getFirmwareInfo()` | `readDeviceInfo` | `onFirmwareInfo` | `onDeviceInfo` |
| `getBatteryStatus()` | `readBattery` | `onBatteryStatus` | `onBattery` |
| `setTime()` | `setTime` | — | `onCompleted` |
| `refreshSteps()` | `refreshSteps` | `onPedometer` | `onLiveSteps` |
| `syncDataHistory()` | `syncHistory([STEPS, SLEEP])` | `onSyncStarted/Progress/Finished` | `onSyncFinished` |
| `getHistoryPedometer(n)` | `getStepsDays(n)` (local) | `onHistoryPedometer` | logo após emitir |
| `getHistorySleep()` | `getSleepSessions(retenção do perfil)` (local) | `onHistorySleep` ou `onError NO_DATA` | após emitir / rejeita `NO_DATA` |
| `deletedSavedData(items, cat)` | `confirmUploaded(kind, dayKeys)` | — | (void) |
| `isConnected()` | `state` em `READY`/`SYNCING` | — | na hora |

Eventos espontâneos (o relógio avisa que os dados mudaram, `requestId = -1`) saem sem Promise: `onPedometer`;
`onDeviceInfo` espontâneo emite `onDeviceInfo` e `onFirmwareInfo`. O fitGPS 0.2.1 não mandou nenhum aviso desses na
gravação de 2026-10-29: passos ao vivo precisam de `refreshSteps()` periódico ([`pendencias.md`](pendencias.md)).

### `deletedSavedData`

Aceita os itens no formato do spec (`{ category, registered_at }`) e, por compatibilidade, strings puras (o wrapper
do Core atual manda só as datas, `TechnosWareCore/src/NativeModules/index.ts:763-768`). O módulo converte o
`ReadableArray` com o `ReadableConverter` (pelo `getType` de cada item: número como `Double`, mapa como `Map`) e o
`CoreBridge` lê os itens: a categoria do item vale mais que a do parâmetro; `5` (PEDOMETER) vira `STEPS`, `0`
(SLEEP) vira `SLEEP`, as outras são ignoradas com `WARN`; qualquer outro tipo de item é ignorado sem log. Cada
`registered_at` é convertido no dia local do telefone (`SavedDataMapper` do `:bridge`): o instante é levado para o
fuso do telefone antes de pegar a data, porque o app pode devolver datas em UTC. O conjunto de dias vai para
`confirmUploaded`, que tira esses dias de `getHistoryPedometer`/`getHistorySleep`.

## Códigos de erro

Os da sessão (`WatchErrorCodes` do Repo 1): `NOT_READY`, `UNSUPPORTED_DEVICE`, `CONNECT_TIMEOUT`,
`GATT_NOT_SUPPORTED`, `HANDSHAKE_FAILED`, `TIMEOUT`, `PROTOCOL`, `NO_DATA`, `TRANSPORT`, `DISCONNECTED`,
`PAIRING_REMOVED` (o telefone guarda um vínculo Bluetooth que o relógio apagou; hoje só o host iOS o detecta, ADR 23 do
Repo 1), `CANCELLED` e `BUSY` (este reservado: a sessão não o emite, um pareamento novo cancela o anterior com
`CANCELLED`, ADR 13 do Repo 1). Os que nascem antes de chamar a sessão (`HostErrorCodes` do `:bridge`, Repo 1):

| Código | Quando |
|---|---|
| `PERMISSION_DENIED` | Falta `BLUETOOTH_SCAN` (scan) ou `BLUETOOTH_CONNECT` (pair/reconnect) na API 31+, ou localização no scan na API 30-. O JS pede as permissões; o nativo só confere. |
| `BLUETOOTH_OFF` | `scan`, `pairDevice` ou `startPairingAttempt` com o Bluetooth desligado. |
| `INVALID_ARGUMENT` | `deviceId` que não é um MAC válido. |
| `IO_ERROR` | Falha de arquivo em `exportLogs` ou ao ler o histórico local. |

`scan()` é `void`: suas falhas só aparecem como `onError` com `method: "scan"` (`TRANSPORT` quando o próprio
scan falha, com o `errorCode` do Android na mensagem).

## Persistência

- `filesDir/corenext/{steps,sleep,confirmed-steps,confirmed-sleep}.json`: histórico (`store/README.md`).
- `SharedPreferences` `corenext.pairing`: `address`, `profileId`, `name` do último relógio que chegou a `READY`.
- `getExternalFilesDir(null)/corenext/{frames,logs}-<data>.jsonl`: exportação de diagnóstico (`log/README.md`).

## Serviço em primeiro plano

Só durante o sync: o `CoreBridge` pede `startSyncWork` em `onSyncStarted` e `stopSyncWork` em `onSyncFinished`, no
`onError` do sync ou quando a sessão sai de `READY`/`SYNCING`; o `AndroidCoreHost` sobe e desce o
`SyncForegroundService`. Detalhes e limites em
[`transporte-android.md`](transporte-android.md#serviço-em-primeiro-plano-só-no-sync).

## iOS

O mesmo desenho, com as peças do iOS no lugar das do Android; o `CoreBridge` e a sessão são o mesmo código (o framework
`TechnosWatchProtocol` do Repo 1). Detalhes, decisões e o que falta validar: [`ios-pendente.md`](ios-pendente.md).

| Camada | Android | iOS |
|---|---|---|
| Módulo | `NativeCoreNextModule.kt` | `ios/CoreNext/turbomodule/RCTNativeCoreNext.mm` (ObjC++; registrado por `codegenConfig.ios.modulesProvider`) |
| Promise | `bridge/PromiseCompletion` + `WritableConverter` | `PromiseCompletion` (Swift, `CoreNext.swift`) + `FoundationConverter` do Repo 1 |
| Payload dos eventos | `WritableConverter.toMap` | `TWPFoundationConverter toDictionaryPayload:` (booleanos como `CFBoolean`) |
| Montagem | `CoreGraph.kt` (criado no primeiro método JS) | `CoreGraph.swift` (criado por `CoreNext.bootstrap` no `AppDelegate`, se o app já tem a autorização ou foi relançado para o Bluetooth; senão no primeiro método JS) |
| Plataforma | `AndroidCoreHost.kt` | `IosCoreHost.swift` |
| Transporte | `ble/AndroidGattTransport` (`HandlerThread` "corenext-gatt") | `ble/CentralTransport` (fila serial `br.com.grupotechnos.corenext.ble`) |
| Estado do Bluetooth | `BluetoothStateReceiver` + `reportBluetoothOffAtStartup` | `centralManagerDidUpdateState` + `BluetoothPowerTracker` |
| Scan | `BleScanner` (filtros por nome e serviço) | dentro do `CentralTransport` (sem filtro de serviço, filtrado pelo `DeviceRegistry`) |
| Sync em segundo plano | `SyncForegroundService` | `UIKitBackgroundWork` (`beginBackgroundTask`) |
| Histórico | `filesDir/corenext/*.json` | `Application Support/corenext/*.json` |
| Pareamento | `SharedPreferences` `corenext.pairing` | `UserDefaults(suiteName: "br.com.grupotechnos.corenext.pairing")` |
| Export | `getExternalFilesDir(null)/corenext/` | `Documents/corenext/` (app Arquivos) |
| Log do sistema | Logcat, tag `CoreNext` | `os_log`, subsistema `br.com.grupotechnos.corenext` |
| Endereço | MAC | UUID do `CBPeripheral` |
| Volta ao primeiro plano | `LifecycleEventListener.onHostResume` | `UIApplicationWillEnterForegroundNotification` |

```
JS (TechnosCore, TechnosEvents)
   │ métodos (Promise)                        ▲ eventos (emitOnX: → AsyncEventEmitter → thread JS)
   ▼                                          │
RCTNativeCoreNext.mm ── casca: TCNPromiseCompletion, FoundationConverter; é o TWPCoreEventSink
   │ um método = uma chamada                  ▲ emitName:payload:
   ▼                                          │
TWPCoreBridge (Repo 1, framework TechnosWatchProtocol)
   │ comandos         ▲ WatchSessionListener        │ CoreHost
   ▼                  │                             ▼
WatchSession (Repo 1)                        IosCoreHost ── PairingStore, FrameRecorder, RingLogger, UIKitBackgroundWork
   │ Transport        ▲ TransportEvents (direto da fila do Bluetooth)
   ▼                  │
CentralTransport ──▶ CBCentralManager / CBPeripheral
(o RingLogger e o FileSampleStore são o WatchLogger e o SampleStore da sessão; o CoreGraph monta tudo)
```

**Threads no iOS.** Os métodos do TurboModule rodam na fila que o RN cria para o módulo; o listener da sessão, no pool
do GCD (uma vez por vez, thread variável); o `CentralTransport` e os callbacks do CoreBluetooth, na fila
`br.com.grupotechnos.corenext.ble`; a volta ao primeiro plano, na principal. O `IosCoreHost` é chamado de qualquer uma
delas e só toca peças thread-safe.

**Testes do iOS.** Sem React Native e sem Bluetooth, no simulador (`ios/Tests/`): o host inteiro com as gravações reais
dos dois relógios, o contrato B e a fila de operações. Ver [`../ios/Tests/README.md`](../ios/Tests/README.md).

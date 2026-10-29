# Arquitetura do `react-native-technos-core-next`

Visão do Repo 2: um TurboModule fino sobre o `technos-watch-protocol` (Repo 1). Esta PoC cobre a família SMA
(Mormaii fitGPS) no Android. O iOS está descrito em [`ios-pendente.md`](ios-pendente.md); o transporte Android em
detalhe em [`transporte-android.md`](transporte-android.md); o contrato JS em `src/specs/NativeCoreNext.ts` e
`src/types/events.ts`.

## Quem é dono de quê

| Camada | Onde | Responsável por | Não faz |
|---|---|---|---|
| JS | `src/` | Wrapper `TechnosCore`/`TechnosEvents`, tipos, permissões (no app) | Nada de BLE |
| Módulo | `NativeCoreNextModule.kt` | Validar entrada, registrar Promise, chamar a `WatchSession` | Regra de protocolo |
| Grafo | `CoreGraph.kt`, `CoreSessionListener.kt` | Montar a sessão uma vez por processo; efeitos de processo (pareamento salvo, FGS, reconexão); emitir eventos e liquidar Promises | Bytes, estados da sessão |
| Transporte | `ble/` | `BluetoothGatt`, fila GATT, scan, estado do adaptador, FGS do sync | Decidir quando reconectar ou desistir |
| Ponte | `bridge/` | Domínio → payload JS, estado → código, fila de eventos, `requestId` | IO |
| Persistência | `store/` | Histórico (`SampleStore`) em JSON, último pareamento | Agregação, poda |
| Log | `log/` | Anel, Logcat, `onLog`, gravação de frames | Envio a servidor |
| Protocolo | Repo 1 (`br.com.grupotechnos.watch:protocol`) | Máquina de estados, handshake BIND/LOGIN, codec SMA, sync, agregação de passos, análise de sono | Plataforma |

```
JS (TechnosCore)  ──métodos──▶  NativeCoreNextModule ──▶ WatchSession (Repo 1)
       ▲                              │                    │        ▲
       │ eventos (emitOnX)            │ RequestRegistry    │Transport│TransportEvents
       │                              ▼                    ▼        │
  PendingEvents ◀── CoreSessionListener ◀─WatchSessionListener   AndroidGattTransport ──▶ BluetoothGatt
                                                           │
                                               RingLogger / FileSampleStore
```

## Ciclo de vida

- **Grafo por processo.** `CoreGraph.get(context)` cria `WatchSession(AndroidGattTransport, RingLogger,
  FileSampleStore)` na primeira chamada de qualquer método JS (normalmente `initialize()`), registra o
  `BluetoothStateReceiver` no `applicationContext` e vive até o processo morrer. O TurboModule é recriado a cada
  reload do JS; o link BLE e um sync em andamento não caem junto.
- **Módulo por instância React.** Ao ser usado, o módulo se liga como destino de eventos (`PendingEvents.attach`).
  Em `invalidate()` ele se desliga e rejeita com `CANCELLED` as Promises ainda pendentes (o JS que as esperava
  não existe mais).
- **`initialize()`/`initSMASDK()`** são idempotentes: criam o grafo se preciso, reenviam o estado atual da sessão
  como `onConnectStateChanged` (`CoreGraph.emitCurrentState`; sem isso um JS recarregado com o relógio já `READY`
  ficaria sem estado até a próxima transição) e tentam reconectar ao relógio salvo.

### Reconexão automática

O app Mormaii reconecta hoje pelo JS: `useSdkInit` chama `pairDevice(lastDevice)` sempre que o app volta ao primeiro
plano (`GTE-Mormaii/src/components/ContextDataInitializer/useSdkInit.ts:15-32`). Aqui isso é nativo e simples,
em `CoreGraph.reconnectIfPaired`, chamado em três momentos: `initialize()`, `onHostResume` e Bluetooth religado.
Só reconecta se todas as condições valem:

1. há pareamento salvo em `PairingPrefs` (gravado ao chegar em `READY`, exceto depois de um disconnect/forget do
   usuário; o `forgetDevice` apaga ao ser pedido e de novo quando a sessão conclui o pedido, para um `READY` que
   chegue no meio não regravar o relógio esquecido);
2. ninguém pediu `disconnectCurrentDevice`/`forgetDevice` neste processo (flag em memória `userDisconnected`,
   zerada por `pairDevice`/`startPairingAttempt`; num processo novo o relógio volta a ser reconectado);
3. a sessão está em `DISCONNECTED` ou `BLUETOOTH_OFF`;
4. Bluetooth ligado e `BLUETOOTH_CONNECT` concedida.

A reconexão usa `session.reconnect(...)` com um `requestId` interno (sem Promise): falhas saem como `onError` com
`method: null`. Quando o link cai depois de `READY`, quem reconecta é a sessão do Repo 1 (`connect(address, true)`
na hora), sem passar por aqui; o transporte só mantém a conexão pendente que ela pediu (`transporte-android.md`). Se
o relógio recusar o LOGIN, a sessão desiste (`HANDSHAKE_FAILED`, ADR 11 do Repo 1) e só um `onHostResume` ou
`initialize` seguinte tenta de novo, com um LOGIN por vez e nunca um BIND.

## Threads

| Thread | O que roda |
|---|---|
| Módulos nativos do RN | Métodos do TurboModule. `getHistoryPedometer`, `getHistorySleep`, `exportLogs` fazem IO de arquivo pequeno aqui. |
| Sessão (Repo 1, `Dispatchers.Default.limitedParallelism(1)`) | `WatchSessionListener` (`CoreSessionListener`), `SampleStore` (`FileSampleStore`), `WatchLogger`. Emite eventos JS daqui. |
| "corenext-gatt" (`HandlerThread`) | Todo o `AndroidGattTransport` e os callbacks do `BluetoothGatt` (o `connectGatt` recebe esse `Handler`). |
| Main | Callbacks de scan (`BleScanner`), `BroadcastReceiver`, `onHostResume`. |

### Emitir eventos fora da thread JS

Verificado no React Native 0.81.4 (`example/node_modules/react-native`):

- O `emitOnX` gerado chama `mEventEmitterCallback.invoke(name, value)` sem checar `null`
  (`@react-native/codegen/lib/generators/modules/GenerateModuleJavaSpec.js:52-62`). O callback é instalado quando o
  JS cria o TurboModule (`ReactCommon/react/nativemodule/core/platform/android/ReactCommon/JavaTurboModule.cpp:972-998`).
- O callback chama `AsyncEventEmitter::emit`, que protege os listeners com mutex e chama cada `AsyncCallback`, que
  agenda a execução na thread JS pelo `CallInvoker` (`ReactCommon/react/bridging/EventEmitter.h:65-102`).

Conclusão: emitir da thread da sessão é seguro; não há `runOnJSQueueThread`. O que é preciso é não emitir antes do
callback existir. Por isso o `PendingEvents` só entrega quando `hasActiveReactInstance() && mEventEmitterCallback !=
null` e guarda até 500 eventos enquanto isso (o mais antigo sai primeiro). `onLog` não entra na fila (volume alto;
o anel do `RingLogger` já guarda e o `getLogs` lê). Eventos emitidos quando o JS ainda não assinou o emitter se
perdem, como em qualquer `EventEmitter` do RN: o JS deve assinar antes de chamar o comando (o `getNativeEventData`
do app já faz assim).

## Comandos, Promises e eventos

Todo comando que fala com o relógio segue o mesmo caminho:

1. o módulo valida (permissão, Bluetooth, MAC, nome) e, se algo falha, rejeita na hora e emite `onError` com
   `requestId: -1` e `method`;
2. registra a Promise no `RequestRegistry` com o nome do método e recebe um `requestId` (> 0);
3. chama a sessão com esse `requestId`;
4. a sessão termina **exatamente uma vez** com um callback terminal (`onDeviceInfo`, `onBattery`, `onLiveSteps`,
   `onSyncFinished`, `onCompleted` ou `onError`);
5. o `CoreSessionListener` emite o evento JS e depois liquida a Promise (`resolve(null)` ou `reject(code, message)`).
   Todo `onError` de comando também sai como evento `onError` com o `method` do registro.

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
`onDeviceInfo` espontâneo emite `onDeviceInfo` e `onFirmwareInfo`.

### `deletedSavedData`

Aceita os itens no formato do spec (`{ category, registered_at }`) e, por compatibilidade, strings puras (o wrapper
do Core atual manda só as datas, `TechnosWareCore/src/NativeModules/index.ts:763-768`). A categoria do item vale
mais que a do parâmetro. `5` (PEDOMETER) vira `STEPS`, `0` (SLEEP) vira `SLEEP`, as outras são ignoradas com `WARN`.
Cada `registered_at` é convertido no dia local do telefone (`SavedDataMapper`): o instante é levado para o fuso do
telefone antes de pegar a data, porque o app pode devolver datas em UTC. O conjunto de dias vai para
`confirmUploaded`, que tira esses dias de `getHistoryPedometer`/`getHistorySleep`.

## Códigos de erro

Os da sessão (`WatchErrorCodes` do Repo 1): `NOT_READY`, `UNSUPPORTED_DEVICE`, `CONNECT_TIMEOUT`,
`GATT_NOT_SUPPORTED`, `HANDSHAKE_FAILED`, `TIMEOUT`, `PROTOCOL`, `NO_DATA`, `TRANSPORT`, `DISCONNECTED`,
`CANCELLED` e `BUSY` (este reservado: a sessão não o emite, um pareamento novo cancela o anterior com
`CANCELLED`, ADR 13 do Repo 1). Os que nascem no host Android (`bridge/HostErrorCodes.kt`):

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

Só durante o sync: sobe em `onSyncStarted` e desce em `onSyncFinished`, no `onError` do sync ou quando a sessão sai
de `READY`/`SYNCING`. Detalhes e limites em [`transporte-android.md`](transporte-android.md#serviço-em-primeiro-plano-só-no-sync).

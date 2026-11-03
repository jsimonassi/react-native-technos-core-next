# API JavaScript

Referência de tudo o que `react-native-technos-core-next` exporta: métodos de `TechnosCore`, eventos de
`TechnosEvents`, constantes, `utils` e o mock oficial para Jest. Para cada item: assinatura, quando resolve ou
rejeita, formato do payload com exemplo e o equivalente no Core atual (`react-native-technos-ware-core` 4.4.3),
com as diferenças.

Fontes do contrato: `src/specs/NativeCoreNext.ts` (TurboModule), `src/types/events.ts` (payloads), `src/index.ts`
(wrapper). O caminho de cada chamada no Android está em [`arquitetura.md`](arquitetura.md#comandos-promises-e-eventos).
Mudou o spec ou um payload, atualize este arquivo no mesmo PR.

O que cada método faz do lado nativo mora no `CoreBridge` do `:bridge` do Repo 1 (o TurboModule Android só o chama;
[`arquitetura.md`](arquitetura.md#o-que-mora-onde)), e o shim iOS (`ios/CoreNext/turbomodule/`) também. O contrato descrito aqui não
mudou com essa troca: mesmos métodos, eventos, payloads, ordem e rejeições.

Escopo da PoC: famílias SMA (Mormaii fitGPS), iDO (Mormaii Life Ultra GPS, só as funções básicas) e CRP (Condor Reebok,
nome anunciado `P85`, firmware `MOY-VS02-2.0.0`; fase 1: pareamento, reconexão, esquecer, bateria, firmware, hora,
passos e sono, validada pelo usuário com o relógio no Android e no iPhone em 2026-11-01; fase 2: ajustes, mensagens,
interações e o reset de fábrica, com os nomes do Core do app Condor, contrato desde 2026-11-02 e ainda sem validação com
o relógio, [Ajustes, mensagens e interações](#ajustes-mensagens-e-interações-fase-2)), no Android e no iOS
(`ios-pendente.md`). Os métodos, eventos e payloads são os mesmos para as três famílias e as duas plataformas; as
diferenças de comportamento estão em cada item. No iOS o `deviceId` é o UUID do periférico, não o MAC, e a falta de
autorização do Bluetooth sai como `PERMISSION_DENIED` com `"Missing Bluetooth"`. O protocolo do Condor Reebok está no
`docs/protocolo-crp.md` do Repo 1.

## Sumário

- [Uso básico](#uso-básico)
- [Regras gerais](#regras-gerais)
- [Métodos](#métodos)
- [Eventos](#eventos)
- [Constantes](#constantes)
- [utils](#utils)
- [Tipos](#tipos)
- [Mock oficial para Jest](#mock-oficial-para-jest)
- [Migração do app Mormaii](#migração-do-app-mormaii)
- [Migração do app Condor](#migração-do-app-condor)

## Uso básico

```ts
import { TechnosCore, TechnosEvents, utils, errorCodes } from "react-native-technos-core-next";

await TechnosCore.initialize();

const sub = TechnosEvents.onScannedDevice(device => console.log(device.name, device.deviceId, device.rssi));
TechnosCore.scan();

try {
	await TechnosCore.pairDevice("D4:3B:04:11:22:33", "fitGPS");
} catch (error) {
	console.warn(utils.errors.getErrorCode(error)); // "HANDSHAKE_FAILED", "CONNECT_TIMEOUT"...
}

const history = await utils.events.requestNativeEventData(
	TechnosEvents.onHistoryPedometer,
	() => TechnosCore.getHistoryPedometer(3),
	20000,
);
sub.remove();
```

## Regras gerais

1. **Comando + evento.** Comandos que falam com o relógio devolvem `Promise<void>`; o dado lido chega pelo evento
   correspondente, como no Core atual. Assim o padrão do app Mormaii (`getHistoryPedometer(3)` e depois
   `getNativeEventData(onHistoryPedometer, 20000)`) continua funcionando.
2. **Ordem evento → Promise.** O nativo emite o evento e só depois resolve a Promise (o listener da sessão no
   `CoreBridge` do Repo 1). Quem espera a Promise e depois lê o estado já encontra o dado.
3. **Rejeição.** A Promise rejeita com um `Error` que tem `code` (um dos [`errorCodes`](#errorcodes)) e `message`.
   Toda rejeição também sai em [`onError`](#onerror), com o nome do método em `method`.
   **Adendo da fase 2 (`observed`).** Os 23 métodos da fase 2 e o `resetDevice` devolvem a Promise já observada
   (`utils.promise.observed`): chamados sem `await` (o app Condor faz isso com `setUserInfo`, `syncWeather`,
   `vibrateDevice` e a câmera), não geram "Possible unhandled promise rejection"; com `await` ou `.catch`, rejeitam como
   os outros, e a falha sempre sai em `onError`. O `observed` só cobre a Promise que o `TechnosCore` devolve: um wrapper
   `async` do app (como os do `Smartwatch.ts` do app Condor) cria outra Promise, e onde o app chama esse wrapper sem
   `await` uma rejeição ainda gera o aviso no debug ([Migração do app Condor](#migração-do-app-condor), item 3). Os
   métodos da fase 1 não passam por ele, inclusive os que o Core declara `void` e o app Condor chama sem `await`
   (`pairDevice`, `getBatteryStatus`, `getHistorySleep`...; item 15 da Migração do app Condor). Diferença em relação à
   produção: DP-17, DP-78 e DP-93 do [`desvios-de-producao.md`](desvios-de-producao.md).
4. **Inscreva antes de chamar.** Eventos emitidos sem ninguém inscrito se perdem, como em qualquer `EventEmitter` do
   RN. O nativo guarda até 500 eventos enquanto o JS ainda não existe, exceto `onLog`, os eventos espontâneos do
   relógio da fase 2 (`onFindPhone`, `onTakeAPicture`, `onDeviceRequestedCameraMode`) e o `onOpenCameraMode`
   ([`arquitetura.md`](arquitetura.md#emitir-eventos-fora-da-thread-js)). `requestNativeEventData` já inscreve antes
   do comando.
5. **Um comando por vez.** A sessão executa os comandos ao relógio em fila, na ordem de chegada. Chamar vários em
   paralelo é seguro; eles só não andam juntos.
6. **Fora de `READY`/`SYNCING`**, comandos ao relógio rejeitam com `NOT_READY`.
7. **Datas** são ISO-8601 com o offset do telefone, `yyyy-MM-dd'T'HH:mm:ssXXX`, por exemplo
   `"2026-10-28T00:00:00-03:00"`. Com offset zero (telefone em UTC, ou Lisboa no inverno) há duas grafias no mesmo
   payload: o `date` de `onHistorySleep`, montado no Repo 2 como no Core atual (`ZZZZZ` do `SimpleDateFormat`, que no
   Android dá `Z`), sai `"…T00:00:00Z"`; as datas que vêm do Repo 1 (o `date` de `onPedometer`/`onHistoryPedometer`, `start` e `end` do sono) saem sempre
   `"…+00:00"`. As duas são o mesmo instante e o `moment()` lê as duas.

## Métodos

Resumo (detalhes de cada um abaixo):

| Método | Retorno | Fala com o relógio | Evento | Core atual |
|---|---|---|---|---|
| `initialize()` | `Promise<void>` | não | — | `initSMASDK` |
| `initSMASDK()` | `Promise<void>` | não | — | `initSMASDK` |
| `initCRPSDK()` | `Promise<void>` | não | — | `initCRPSDK` (app Condor) |
| `scan()` | `void` | não (scan BLE) | `onScannedDevice` | `scan` |
| `stopScan()` | `void` | não | — | não existe |
| `pairDevice(deviceId, name)` | `Promise<void>` | sim | `onConnectStateChanged` | `pairDevice` (`void`) |
| `startPairingAttempt(deviceId, name)` | `Promise<void>` | sim | `onConnectStateChanged` | `startPairingAttempt` (`void`) |
| `disconnectCurrentDevice()` | `Promise<void>` | sim | `onConnectStateChanged` | `disconnectCurrentDevice` (semântica diferente) |
| `forgetDevice()` | `Promise<void>` | sim | `onConnectStateChanged` | `disconnectCurrentDevice` |
| `resetDevice()` | `Promise<void>` | sim (só CRP) | — | `resetDevice` (`void`) |
| `isConnected()` | `Promise<boolean>` | não | — | só no nativo |
| `getLastPairedDevice()` | `Promise<LastPairedDevice \| null>` | não | — | não existe |
| `getDeviceInfo()` | `Promise<void>` | sim | `onDeviceInfo` | `getDeviceInfo` (sem efeito no SMA) |
| `getFirmwareInfo()` | `Promise<void>` | sim | `onFirmwareInfo` | `getFirmwareInfo` (`void`) |
| `getBatteryStatus()` | `Promise<void>` | sim | `onBatteryStatus` | `getBatteryStatus` (`void`) |
| `setTime()` | `Promise<void>` | sim | — | automático no login |
| `refreshSteps()` | `Promise<void>` | sim | `onPedometer` | polling de 10 s |
| `syncDataHistory()` | `Promise<void>` | sim | `onSyncStarted/Progress/Finished` | `syncDataHistory` (simulado) |
| `getHistoryPedometer(daysBefore)` | `Promise<void>` | não | `onHistoryPedometer` | `getHistoryPedometer` (`void`) |
| `getHistorySleep()` | `Promise<void>` | não | `onHistorySleep` / `onError` | `getHistorySleep` (sem efeito no SMA) |
| `deletedSavedData(items)` | `void` | não | — | `deletedSavedData` |
| `getLogs(limit)` | `Promise<LogEvent[]>` | não | — | não existe |
| `exportLogs()` | `Promise<string>` | não | — | `shareLogs` (outro formato) |
| `clearLogs()` | `void` | não | — | não existe |
| `setLogLevel(level)` | `void` | não | — | não existe |
| `setUserInfo(userInfo)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setGoalsV2(goals)` | `Promise<void>` | sim (só CRP) | — | igual |
| `set12HourFormat(enabled)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setTemperatureUnit(temp)` | `Promise<void>` | sim (só CRP) | — | igual (lá resolve sem esperar o relógio) |
| `setDistanceUnit(distanceUnit)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setScreenTime(time)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setDeviceBatterySaving(enabled)` | `Promise<void>` | sim (só CRP) | — | igual (lá resolve sem esperar o eco) |
| `setSosHelp(isEnabled)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setGestureControlV2(gestureControlMap)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setMenstrual(menstrual)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setHeartRateAutomaticCheck(enabled, startHour, endHour, interval)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setStressAutomaticCheck(automaticStress)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setNotDisturb(notDisturb)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setWaterReminderV2(waterReminder)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setWalkReminder(walkReminder)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setAlarm(alarmArray)` | `Promise<void>` | sim (só CRP) | — | igual |
| `setWorldClock(worldClockList)` | `Promise<void>` | sim (só CRP) | — | igual |
| `manageNotifications(notifications, shouldShowNotificationModal = true)` | `Promise<void>` | sim (só CRP) | — | igual (no Android, lá só grava preferências) |
| `setAddressBook(contactList)` | `Promise<void>` | sim (só CRP) | — | igual |
| `syncWeather(weatherList)` | `Promise<void>` | sim (só CRP) | — | `syncWeather` (`void`) |
| `vibrateDevice()` | `Promise<void>` | sim (só CRP) | — | `vibrateDevice` (`void`) |
| `openCameraMode()` | `Promise<void>` | sim (só CRP) | `onOpenCameraMode` | `openCameraMode` (`void`) |
| `closeCameraMode()` | `Promise<void>` | sim (só CRP) | — | `closeCameraMode` (`void`) |

`TechnosCore` também carrega as constantes `deviceConnectStates`, `deletedCategory`, `errorCodes` e `logLevels` (as duas
primeiras no mesmo lugar do Core atual). "Só CRP": no fitGPS e no Life Ultra GPS o método rejeita `NOT_SUPPORTED`. Na
coluna "Core atual" dos métodos da fase 2, a referência é o Core que o app Condor fixa (`v4.3.57`); "igual" quer dizer
mesmo nome, mesmos argumentos e `Promise<void>`.

### `initialize(): Promise<void>`

Cria o grafo nativo (sessão, transporte, logger, armazenamento) uma vez por processo e, se há relógio pareado salvo
e ninguém pediu desconexão neste processo, pede a reconexão (`CoreBridge.reconnectIfPaired`). Idempotente: o app de
exemplo chama ao montar e de novo quando as permissões chegam.

Antes de pedir a reconexão, emite `onConnectStateChanged` com o estado atual da sessão (com `phase: null`). O grafo
nativo sobrevive ao reload do JS; sem isso, um JS recarregado com o relógio já conectado ficaria sem estado até a
próxima transição. Por isso chame `initialize()` **depois** de se inscrever em `onConnectStateChanged`.

Com o Bluetooth já desligado quando o grafo nasce, a sessão passa a `BLUETOOTH_OFF` (`state` 4) logo em seguida
(`CoreGraph` → `reportBluetoothOffAtStartup`). Como isso é assíncrono, o primeiro `initialize()` pode reenviar 0
antes; o 4 chega depois pela própria transição. Ao religar o Bluetooth, o nativo reconecta ao relógio salvo, se
houver (`reconnectIfPaired`).

- Resolve: na hora.
- Rejeita: só por exceção inesperada no nativo.
- Core atual: `initSMASDK()` (`TechnosWareCore/src/NativeModules/specs/NativeCore.ts:11`), que no Android rejeita
  com `"mainService is null"` se o serviço em primeiro plano não estiver ligado e, a cada chamada, registra callbacks
  de novo (eventos duplicados, `SMAService.java:123-137`). Aqui não há serviço permanente nem registro repetido.

### `initSMASDK(): Promise<void>`

Alias de `initialize()`, para o `Smartwatch.init` do app Mormaii (`GTE-Mormaii/src/services/Smartwatch.ts:34-64`)
não mudar.

### `initCRPSDK(): Promise<void>`

Alias de `initialize()` com o nome que o app Condor usa para o Condor Reebok. Só no JS (`src/index.ts` e o mock): chama
o mesmo `initialize` nativo, sem método próprio no spec, porque o grafo nativo é um só para todas as famílias. Novo.

- Core atual: `initCRPSDK()` do Core que o app Condor fixa (`TechnosWareCore` `v4.3.57`,
  `src/NativeModules/specs/NativeCore.ts:13` e `src/NativeModules/index.ts:267-268`), que inicia a SDK CRP.

### `scan(): void`

Procura relógios por 7 s (`BleScanner.SCAN_DURATION_MS`, o mesmo tempo do Core atual, `SMAService.java:625-635`).
Cada relógio de um modelo conhecido vira um [`onScannedDevice`](#onscanneddevice), uma vez por endereço por busca
(o Core atual emite a cada anúncio); chamar `scan()` de novo recomeça a lista. Não há evento de fim de busca.

- Falhas não lançam: saem em `onError` com `method: "scan"` e `requestId: -1`. Códigos: `PERMISSION_DENIED` (falta
  `BLUETOOTH_SCAN`, ou localização na API 30-), `BLUETOOTH_OFF`, `TRANSPORT` (o scan do Android falhou; o
  `errorCode` vai na mensagem).
- O Condor Reebok é aceito por nome exato (`Condor Reebok`) ou por qualquer nome que comece com `P85` depois de `trim`
  (`DeviceRegistry` do Repo 1), e sai com `name: "Condor Reebok"` e `bleName` igual ao anunciado. Como o filtro de scan
  do Android só compara nome exato, o scan do Android sai sem filtro desde que esse perfil existe
  ([`transporte-android.md`](transporte-android.md#scan-blescanner)); a identificação continua pelo nome.
- Core atual: `scan()` (`NativeCore.ts:14`), sem filtro de serviço e sem aviso de falha. O Core do app Condor escaneia
  sem filtro por 20 s (`CRPBleConnectHelper.java:817-881` no `v4.3.57`, pelo `startLeScan` legado da SDK) e aceita o
  nome que começa com `P85` depois de `trim` (o `trim` em `CRPBleConnectHelper.java:873`, o `startsWith` em
  `AvailableDevices.java:55-57`); no iOS, por 10 s (`CRPService.m:716`). Os 7 s daqui e a emissão única por endereço
  são o DP-92 do [`desvios-de-producao.md`](desvios-de-producao.md) (a tela de busca do app Condor espera 20 s).

### `stopScan(): void`

Interrompe a busca antes dos 7 s. Novo.

### `pairDevice(deviceId: string, name: string): Promise<void>`

Primeiro pareamento: conexão direta, descoberta de serviços, notificações, MTU e handshake completo (BIND e LOGIN no
SMA; no iDO, informação básica, bind e autenticação, com a tela de confirmação no relógio; no CRP, só a leitura da
versão do protocolo, fase `VERSION`, sem confirmação no relógio). Use os campos `deviceId` e `name` de um
`onScannedDevice` (`"fitGPS"`, `"Life Ultra GPS"` ou `"Condor Reebok"`).

- Resolve: quando a sessão chega em `READY` (o mesmo momento do `onConnectStateChanged` com `state: 2`). O BIND
  espera até 60 s pela confirmação na tela do relógio (`Quirks.bindTimeoutMs` do perfil fitGPS, `Profiles.kt`); no
  Life Ultra GPS, até 90 s, e o relógio sempre pede a confirmação no primeiro pareamento (recusar na tela rejeita com
  `HANDSHAKE_FAILED`).
- Rejeita na hora: `PERMISSION_DENIED` (falta `BLUETOOTH_CONNECT`; no iOS, Bluetooth negado ao app), `BLUETOOTH_OFF`,
  `INVALID_ARGUMENT` (`deviceId` não é MAC no Android nem UUID no iOS), `UNSUPPORTED_DEVICE` (`name` desconhecido).
- Rejeita depois: `CONNECT_TIMEOUT` (30 s sem abrir o link, `Quirks.connectTimeoutMs`), `GATT_NOT_SUPPORTED`,
  `HANDSHAKE_FAILED`, `DISCONNECTED`, `TRANSPORT`, `PAIRING_REMOVED`, `CANCELLED`. Não existe `BUSY`: um `pairDevice`
  ou `startPairingAttempt` novo cancela o pedido anterior, que rejeita com `CANCELLED` (ADR 13 do Repo 1).
- `PAIRING_REMOVED` (só no iOS, por enquanto): o telefone guarda um vínculo Bluetooth com o relógio que o relógio já
  apagou (ele foi pareado com outro telefone depois). O sistema recusa a conexão até a pessoa esquecer o relógio nas
  configurações de Bluetooth (no iPhone, Ajustes → Bluetooth → Esquecer Este Dispositivo); o app não consegue fazer
  isso. Mostre essa instrução e deixe a pessoa tentar de novo; o nativo não tenta sozinho (ADR 23 do Repo 1).
- O relógio pareado é salvo ao chegar em `READY` (`getLastPairedDevice` passa a devolvê-lo).
- **Condor Reebok: vínculo Bluetooth clássico.** O relógio faz chamadas e toca música pelo Bluetooth clássico (HFP e
  A2DP), no mesmo endereço do BLE. No `READY`, se o sistema ainda não tem esse vínculo, o nativo o pede: no Android
  aparece o diálogo de pareamento do sistema (aceitar); se a primeira tentativa falhar, ele aparece de novo sozinho uma
  vez. A Promise do `pairDevice` já resolveu: uma recusa ou as duas tentativas sem sucesso saem só em
  [`onError`](#onerror) com `CLASSIC_BOND_FAILED`, `requestId` -1 e `method: "classicBond"`, e o BLE continua pronto
  (passos, bateria e sync funcionam). O nativo não pede de novo até o próximo `pairDevice`. No iPhone o app não cria o
  vínculo: nada aparece, só um WARN no log com a dica de parear em Ajustes > Bluetooth, e nenhum `onError`.
- Core atual: `pairDevice(deviceId, name): void` (`NativeCore.ts:15`). Sem retorno, sem timeout e sem erro para o
  JS; o app Mormaii põe um timeout de 30 s na tela (`ConnectingDeviceManuallyFromWatch/index.tsx:47-66`).

```ts
try {
	await TechnosCore.pairDevice(device.deviceId, device.name);
} catch (error) {
	if (utils.errors.getErrorCode(error) === errorCodes.HANDSHAKE_FAILED) {
		// relógio recusou ou não respondeu o BIND
	}
}
```

### `startPairingAttempt(deviceId: string, name: string): Promise<void>`

Reconecta a um relógio já pareado: conexão pendente sem timeout e handshake curto (só LOGIN no SMA; no CRP, a mesma
leitura de versão do pareamento).

- Resolve: assim que a reconexão é pedida. A conexão de fato é anunciada por `onConnectStateChanged` e pode levar
  horas se o relógio estiver longe.
- Rejeita na hora pelos mesmos motivos de `pairDevice` (`PERMISSION_DENIED`, `BLUETOOTH_OFF`, `INVALID_ARGUMENT`,
  `UNSUPPORTED_DEVICE`). Falhas posteriores só aparecem em `onError` com `method: "startPairingAttempt"`.
- Se o relógio **recusar** o LOGIN (desvinculado na própria tela, ou vinculado a outro telefone), a sessão desiste:
  `onConnectStateChanged` vai para desconectado e sai `onError` com `HANDSHAKE_FAILED`. A reconexão nunca refaz o
  BIND sozinha (ele pode pedir confirmação na tela do relógio); o app deve oferecer um `pairDevice`. Falta de
  resposta e quedas continuam tentando, com espera crescente (ADR 11 do Repo 1).
- Com `PAIRING_REMOVED` (vínculo do sistema apagado no relógio, ver `pairDevice`) a sessão também desiste:
  desconectado e `onError` com o método. Uma reconexão que o nativo começou sozinho (queda do link, Bluetooth religado,
  volta ao primeiro plano) termina com `onError` `PAIRING_REMOVED` e `method: null`, sem nova tentativa até o próximo
  gatilho; o relógio salvo continua salvo.
- Core atual: `startPairingAttempt(deviceId, name): void` (`NativeCore.ts:16`); no SMA equivale a `pairDevice`.

### `disconnectCurrentDevice(): Promise<void>`

Desconecta e para de reconectar até o próximo `pairDevice`/`startPairingAttempt` (ou até o processo reiniciar). O
pareamento salvo e o histórico local continuam.

- Resolve: quando a sessão volta a `DISCONNECTED`.
- No Condor Reebok o vínculo Bluetooth clássico do sistema fica (as chamadas continuam pareadas).
- **Diferença importante:** no Core atual, `disconnectCurrentDevice` (`NativeCore.ts:18`) também desfaz o vínculo no
  relógio e apaga dados: no Android `close` + `unbind` + `clearAllData` (`SMAService.java:663-671`), no iOS
  `relieveWatchBound` e apaga o `NSUserDefaults` inteiro do app (`SMAService.m:141-157`). Esse comportamento agora é
  o `forgetDevice()`.

### `forgetDevice(): Promise<void>`

Desconecta, desfaz o vínculo no relógio (UNBIND `03/05`, se conectado), apaga o pareamento salvo e o histórico local.
No Life Ultra GPS os bytes do desvínculo não são conhecidos: nada é escrito no relógio, que continua se dizendo
vinculado; o resto acontece igual, e o próximo `pairDevice` pede a confirmação na tela de novo.

No Condor Reebok, se conectado, a sessão escreve o `F8` (remover vínculo; o relógio não responde) e desconecta; depois
o nativo remove o vínculo Bluetooth clássico do sistema e só então apaga o pareamento salvo. No Android a remoção é
pelo `removeBond()` por reflexão, no melhor esforço: o resultado vai só para o log, e o relógio some dos Ajustes de
Bluetooth. Com o Bluetooth desligado, o Android não enxerga o vínculo: a remoção fica guardada e acontece quando o
Bluetooth liga (também num processo novo), antes de o relógio reabrir chamadas e música. No iPhone o app não remove
vínculo: o log traz a dica de esquecer o relógio em Ajustes > Bluetooth. Um pedido de vínculo ainda em andamento
(diálogo aberto) é cancelado sem `onError`: o nativo tenta fechar o diálogo e, se o usuário aceitar mesmo assim, remove o
vínculo assim que ele aparece.

**O `forgetDevice` nunca faz reset de fábrica, e o [`resetDevice`](#resetdevice-promisevoid) nunca esquece** (decisão do
usuário de 2026-11-01, ADR 33 do Repo 1). No Condor Reebok, o reset de fábrica (`51 02`) é o método próprio
`resetDevice` desde a fase 2, e ele não apaga o pareamento salvo, o histórico local nem o vínculo Bluetooth do sistema:
quem decide se o relógio também é esquecido é o app. O Core do app Condor manda o reset antes do `F8` em todo
`disconnectCurrentDevice` (`CRPService.java:269-270` no `v4.3.57`, que chama `disconnect(true)`), e todos os botões do
app que tiram o relógio chamam esse método: na troca de pacote (fase 4), o adaptador do app Condor escolhe o que cada
botão chama (`forgetDevice`, `resetDevice` ou os dois; para os dois, o reset antes, porque depois do esquecer não há
conexão e o reset rejeitaria `NOT_READY`).

- Resolve: quando a sessão volta a `DISCONNECTED`.
- Core atual: é o que `disconnectCurrentDevice` faz lá (ver acima). O app Mormaii chama `disconnectCurrentDevice` no
  "esquecer relógio" (`usePairingData`, `disconnectDevice`): ao trocar de pacote, essa chamada vira `forgetDevice`.

### `resetDevice(): Promise<void>`

Reset de fábrica do relógio. No Condor Reebok, a sessão escreve o `51 02` (`FE EA 20 06 51 02`; o relógio não responde,
`sdk:f/x.java:21-25`) e a Promise resolve depois da escrita e do intervalo da fila. Método separado do esquecer, desde a
fase 2 (ADR 33 do Repo 1).

- **Não esquece.** O pareamento salvo, o histórico local e o vínculo Bluetooth clássico do sistema continuam, e o nativo
  não desconecta. Para o relógio limpo e esquecido, chame `resetDevice()` e depois `forgetDevice()`, nessa ordem: depois
  do esquecer não há conexão, e o reset rejeitaria `NOT_READY`.
- O que o P85 faz com a conexão e com o vínculo clássico depois do reset ainda não foi visto (validação da fase 2). Se
  ele derrubar o link, a reconexão automática do relógio salvo tenta de novo, como em qualquer queda.
- Rejeita: `NOT_READY` (desconectado), `NOT_SUPPORTED` (fitGPS e Life Ultra GPS: nada é escrito), `DISCONNECTED` (o link
  caiu antes do fim da escrita ou nos 200 ms do intervalo da fila depois dela; neste caso o `51 02` já foi escrito e o
  reset pode ter acontecido, DP-91 do [`desvios-de-producao.md`](desvios-de-producao.md)) e `CANCELLED`. Promise
  observada (regra 3): sem `await` não gera aviso.
- Core atual: `resetDevice(): void` (`NativeCore.ts:119` no `v4.3.57`). No Android do app Condor, o
  `disconnectCurrentDevice` também manda o `51 02` e, 1 s depois, o `F8` (`CRPService.java:269-270`,
  `CRPBleConnectHelper.java:400-429`); aqui nenhum outro método manda o reset.

### `isConnected(): Promise<boolean>`

`true` quando a sessão está em `READY` ou `SYNCING`. Resolve na hora.

- Core atual: não está no spec JS (`NativeCore.ts`); existe só dentro do nativo (Android lê `isLoggedIn`, iOS sempre
  `NO`, `SMAService.m:1509-1511`).

### `getLastPairedDevice(): Promise<LastPairedDevice | null>`

Último relógio que chegou a `READY`, ou `null`. Use com `startPairingAttempt` para o "reconectar".

```json
{ "deviceId": "D4:3B:04:11:22:33", "name": "fitGPS", "profileId": "fitgps" }
```

- Core atual: não existe; o app Mormaii guarda o último relógio no próprio cache (`CACHE_PAIRING_KEYS`).

### `getDeviceInfo(): Promise<void>`

Lê firmware e identificação (comando VERSION `02/0A` no SMA; no CRP, o `5A 01`, com a leitura da characteristic
`2A28` de reserva). Emite [`onDeviceInfo`](#ondeviceinfo) e resolve em seguida. Rejeita com `NOT_READY`, `TIMEOUT`,
`DISCONNECTED`.

- Core atual: `getDeviceInfo(): void` (`NativeCore.ts:50`). No SMA Android manda o comando de leitura de alarme e
  não emite nada (`SMAService.java:1016-1018`); no iOS não faz nada (`SMAService.m:163-165`).

### `getFirmwareInfo(): Promise<void>`

Mesma leitura de `getDeviceInfo`, mas emite [`onFirmwareInfo`](#onfirmwareinfo), no formato do Core atual.

Cada chamada é uma leitura no relógio: quem quer os dois eventos e chama os dois métodos em seguida lê o firmware duas
vezes. No Condor Reebok são dois `5A 01` seguidos, como o cartão Relógio do app de exemplo faz no "Ler"
(`example/src/screens/ConnectionScreen.tsx:43-44`; na gravação real de 2026-11-01, `real@119023` e `@119425` do
`docs/protocolo-crp.md` do Repo 1, os dois respondidos com `MOY-VS02-2.0.0`).

- Core atual: `getFirmwareInfo(): void` (`NativeCore.ts:51`).

### `getBatteryStatus(): Promise<void>`

Lê a bateria (comando `02/08` no SMA; `02/01`, a informação básica, no iDO; leitura da characteristic `2A19` no
CRP). Emite [`onBatteryStatus`](#onbatterystatus) e resolve. Rejeita com `NOT_READY`, `TIMEOUT`, `DISCONNECTED`. O
Condor Reebok também avisa a bateria sozinho, cerca de uma vez por minuto: sai um `onBatteryStatus` sem pedido
(confirmado no P85 num Android em 2026-11-01; no iPhone, o `2A19` veio em cada virada de minuto numa segunda sessão
no mesmo dia, não versionada, e o usuário relatou que a tela "está atualizando automaticamente"; o evento em si não foi
registrado, porque não há log, [`onBatteryStatus`](#onbatterystatus)).

- Core atual: `getBatteryStatus(): void` (`NativeCore.ts:64`). No iOS o `percentage` sai com lixo, porque o
  `NSDictionary` é passado onde se espera `NSInteger` (`SMAService.m:1237-1243`).

### `setTime(): Promise<void>`

Acerta o relógio com a hora local de parede do telefone (comando `02/01` no SMA; `03/01`, com o fuso, no iDO; `31`
e o fuso `BB 07 00` no CRP). A sessão também faz isso sozinha depois de cada conexão (passados
`Quirks.postLoginDelayMs`, 3 s no fitGPS, 1 s no Life Ultra GPS, 250 ms no Condor Reebok).

- Resolve: no ACK do relógio (no CRP, que não responde, depois das duas escritas). Rejeita com `NOT_READY`,
  `TIMEOUT`, `DISCONNECTED`.
- Core atual: não existe no JS; o Android acerta a hora 3 s depois do login (`SMAService.java:270-295`).

### `refreshSteps(): Promise<void>`

Lê os passos recentes do relógio (`05/41` no SMA; no iDO, `02/A0`, os totais do dia ao vivo; no CRP, os totais do
dia em `FEE1` e os passos por meia hora de hoje e de ontem, `59 00` a `59 03`), grava no histórico local e emite
[`onPedometer`](#onpedometer) com o total de hoje. Resolve depois do evento.

- Core atual: não existe; o Android faz polling de 10 s com `readData([SPORT, ...])` (`SMAService.java:547-603`) e o
  iOS a cada 1 s (`SMAService.h:23`).

### `syncDataHistory(): Promise<void>`

Lê o histórico do relógio (passos `05/41` e sono `05/45`) e grava no armazenamento local, com deduplicação. No Life
Ultra GPS não há histórico na PoC: o sync lê o mesmo total do dia do `refreshSteps` (`02/A0`) e nenhum sono, em menos
de um segundo; um dia em que o app não leu o relógio fica sem passos. Enquanto
roda, a sessão fica em `SYNCING` (o `state` continua 2) e um serviço em primeiro plano mantém o processo vivo.

- Condor Reebok: passos como no `refreshSteps` (meias horas e totais do dia; o relógio não guarda distância nem
  calorias por meia hora) e o sono de hoje (`32`; e o de 1 e 2 dias atrás se o relógio responder ao comando legado
  `33`, sondado uma vez por conexão). Um sono que não responde termina em 4 s sem travar o resto. O P85 com
  `MOY-VS02-2.0.0` responde ao `33` (2026-11-01): os totais de ontem vêm do relógio, e sem noite os três pedidos de sono
  voltam vazios na hora; o sync da gravação real levou 5,6 s.
- Eventos: `onSyncStarted`, `onSyncProgress` (por etapa: 0 no início e `100 * (i + 1) / n` ao fim de cada tipo, então 0, 50 e 100 para passos e sono; `SyncEngine.kt` do Repo 1) e `onSyncFinished`.
- Resolve: depois de `onSyncFinished`.
- Rejeita: com o erro que interrompeu o sync (`NOT_READY`, `TIMEOUT`, `DISCONNECTED`, `CANCELLED`...). Falta de
  sono não é erro.
- **Duração observada:** no fitGPS 0.2.1 com MTU 23, o primeiro sync levou **59 s** (59,3 s de `READY -> SYNCING` a
  `SYNCING -> READY`), quase todo em 64 páginas de sono (`05/45`) de cerca de 900 ms cada, com registros antigos que o
  relógio guardava porque o Core atual nunca lê o sono (atMs 1031806 a 1090678 da fixture
  `technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`, igual byte a byte
  ao export `frames-20261029-083254.jsonl`; `transporte-android.md`). Entre o `onSyncProgress` 50 (passos lidos,
  menos de 1 s depois do início) e o 100 (sono lido) passam cerca de 58 s sem evento nenhum. Quem tiver um timeout próprio menor que isso (o watchdog de 50 s do
  app Mormaii) dá o sync por encerrado antes do fim: ver [`pendencias.md`](pendencias.md).
- Core atual: `syncDataHistory(): void` (`NativeCore.ts:76`). No SMA é simulado: emite `onSyncStarted` e, 5 s (Android,
  `SMAService.java:1394-1403`) ou 12 s depois (iOS, `SMAService.m:768-773`), `onSyncFinished`, sem falar com o relógio.

### `getHistoryPedometer(daysBefore: number): Promise<void>`

Emite [`onHistoryPedometer`](#onhistorypedometer) com os totais por dia gravados localmente, do mais antigo para o mais
novo, sem os dias já confirmados por `deletedSavedData`. Não fala com o relógio: rode `syncDataHistory` antes.

- `daysBefore`: quantos dias antes de hoje incluir; hoje sempre entra (o app Mormaii usa 3).
- Resolve: logo depois de emitir. Sem dados emite `{ historypedometer: [] }`, como o Core iOS atual.
- Rejeita: `IO_ERROR` se o arquivo local não puder ser lido.
- Core atual: `getHistoryPedometer(daysBefore): void` (`NativeCore.ts:41`). O Android ignora `daysBefore`
  (`SMAService.java:829-896`).

### `getHistorySleep(): Promise<void>`

Emite [`onHistorySleep`](#onhistorysleep) com as noites gravadas localmente, sem os dias confirmados. **Exploratório**:
o sono do fitGPS nunca foi validado em produção. O Life Ultra GPS não tem sono na PoC (vem do protocolo V3): sempre
`NO_DATA`. No Condor Reebok, o `date` é o dia em que se acorda, com a virada às 20h como na SDK (um sono lido depois
das 20h vale para o dia seguinte), e `totalSleepMinutes` é leve + profundo + REM, sem o acordado (fase 1 ainda sem
noite real no relógio de teste: em 2026-11-01, sem noite, o relógio respondeu vazio aos três pedidos de sono, `real@233291`,
`@233362` e `@234750` do `docs/protocolo-crp.md` do Repo 1; com essa gravação, o `getHistorySleep` dá `NO_DATA` no teste
do host iOS, `CoreBridgeReplayTests`, e no aparelho ele não foi chamado).

- Resolve: depois de emitir.
- Rejeita com `NO_DATA` **e também emite `onError`** (`code: "NO_DATA"`, `method: "getHistorySleep"`) quando não há
  nenhuma noite, como toda rejeição. Quem escuta `onError` para mostrar falhas ao usuário deve ignorar esse caso: não é
  falha, só falta de dado. Nunca fica sem resposta.
- Core atual: `getHistorySleep(): void` (`NativeCore.ts:81`), vazio para SMA nas duas plataformas
  (`SMAService.java:1423`, `SMAService.m:167`): `onHistorySleep` nunca é emitido e o `getNativeEventData` do app só
  termina no timeout.

### `deletedSavedData(items: readonly SavedItemDelete[]): void`

Marca registros como já enviados ao backend; os dias deles deixam de sair em `getHistoryPedometer`/`getHistorySleep`.
Entrada no mesmo formato do Core atual:

```ts
TechnosCore.deletedSavedData([
	{ category: TechnosCore.deletedCategory.PEDOMETER, registered_at: "2026-10-26T00:00:00-03:00" },
	{ category: TechnosCore.deletedCategory.PEDOMETER, registered_at: "2026-10-27T00:00:00-03:00" },
]);
```

- O wrapper agrupa os itens por categoria e faz uma chamada nativa por categoria, com os itens inteiros
  (`{ category, registered_at }`). Lista vazia não chama o nativo.
- O nativo converte cada `registered_at` no dia local do telefone (aceita offset, `Z`, offset sem dois-pontos e só a
  data) e guarda o **conjunto** de dias confirmados. Só `PEDOMETER` (5) e `SLEEP` (0) têm efeito; outras categorias
  são ignoradas com um `WARN` no log ([`arquitetura.md`](arquitetura.md#deletedsaveddata)).
- Core atual: `deletedSavedData(TechnosSavedItemDelete[])` (`TechnosWareCore/src/NativeModules/index.ts:763-768`)
  manda só as datas, com a categoria do **primeiro** item para a lista toda; no iOS o nativo não faz nada
  (`SMAService.m:1481`). O nativo novo também aceita a lista de strings do formato antigo.

### `getLogs(limit: number): Promise<LogEvent[]>`

Últimas `limit` entradas do log nativo, da mais nova para a mais antiga. O nativo guarda até 2000 (`RingLogger`).
Útil para recuperar o que aconteceu antes de o JS se inscrever em `onLog`. Novo.

### `exportLogs(): Promise<string>`

Grava dois arquivos em `getExternalFilesDir(null)/corenext/` (ou `filesDir/corenext/` se não houver armazenamento
externo) e devolve o caminho do primeiro:

- `frames-<yyyyMMdd-HHmmss>.jsonl`: gravação de todos os pacotes GATT desde o último `clearLogs` (`TX`, `RX` e
  `READ`, o valor de cada leitura GATT), no formato de fixture do `technos-watch-protocol` (cabeçalho + uma linha por
  pacote, `FrameJsonl.kt`). Vira `fixtures/real/<perfil>/<fw>/*.jsonl` no Repo 1 (`fitgps`, `lifeultragps` ou
  `condorreebok`).
- `logs-<mesmo carimbo>.jsonl`: o anel do log, uma [`LogEvent`](#onlog) por linha.

Exemplo de retorno: `"/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/frames-20261028-143000.jsonl"`.
Para copiar: `adb pull "<caminho>"`. Rejeita com `IO_ERROR`.

- Core atual: `shareLogs(zipFileName, shareWithUser)` (`NativeCore.ts:122`) compacta bancos de log do Room; o SMA
  não grava nada lá.

### `clearLogs(): void`

Esvazia o anel do log e começa uma gravação de frames nova. Novo.

### `setLogLevel(level: LogLevelValue): void`

Nível mínimo do log nativo (`logLevels`: `DEBUG` 0, `INFO` 1, `WARN` 2, `ERROR` 3). Entradas abaixo do nível não
entram no anel, no Logcat nem no `onLog`. Os pacotes GATT são entradas `DEBUG`: acima de `DEBUG` eles somem do log,
mas continuam na gravação de frames. Valor inválido é ignorado com `WARN`. Novo.

### Ajustes, mensagens e interações (fase 2)

Os 23 métodos abaixo têm os nomes e os argumentos do Core que o app Condor fixa (`TechnosWareCore` `v4.3.57`,
`src/NativeModules/specs/NativeCore.ts`) e os tipos de entrada dele (`src/types/watchSettings.ts`, exportados da raiz
com os mesmos nomes), para o app Condor trocar de pacote sem mudar as chamadas ([Migração do app
Condor](#migração-do-app-condor)). O que cada método faz mora no `CoreBridge` do Repo 1 (o `SettingsMapper` lê os
dicionários) e os bytes no `CrpDriver` (`docs/protocolo-crp.md` do Repo 1, seções 6, 7, 11 e 12). Contrato desde
2026-11-02, ainda sem validação com o relógio: o roteiro está no
[`example/README.md`](../example/README.md#checklist-da-fase-2-com-o-condor-reebok), e os bytes que só a SDK descreve
podem mudar depois dela.

Regras comuns:

- **Só o Condor Reebok executa.** Com o fitGPS ou o Life Ultra GPS conectados, todos rejeitam `NOT_SUPPORTED` sem
  escrever nada, menos o `syncWeather([])`, que resolve na hora com qualquer relógio.
- **Desconectado**, `NOT_READY` (antes do `NOT_SUPPORTED`). Nada é guardado para reenvio: o app reenvia no próximo sync,
  como na produção. Exceção: `closeCameraMode`.
- **Durante um sync**, o comando entra na fila e roda depois do `onSyncFinished`, como os da fase 1 (regra 5).
- **Entrada malformada** (campo obrigatório ausente, hora fora de `"HH:mm"`, unidade ou gênero desconhecidos, valor
  fora da faixa, número negativo, item nulo numa lista, nome vazio...) rejeita `INVALID_ARGUMENT` antes de chegar à
  sessão, com `onError` (`requestId` -1) antes do reject; a mensagem diz o campo e o esperado e nunca leva um valor que
  possa ser dado pessoal (perfil, ciclo, agenda, clima, cidades). Os campos que o Condor Reebok ignora (janelas, dias)
  também são conferidos. Booleanos aceitam `true`/`false` ou número (diferente de 0 é ligado), e nulo ou ausente é
  desligado; outro tipo é inválido. Nulo inclui o `NSNull` que o iOS põe nas listas no lugar de `null`/`undefined`;
  num dicionário, a chave nula nem chega ao nativo no iOS (vale a chave ausente). Números fracionários são arredondados
  (meio para cima), menos as coordenadas do relógio mundial. Horas `"HH:mm"` têm dois dígitos cada (o formato dos dois Cores), de 00:00 a 23:59; vazio ou ausente
  vale 00:00 (no lembrete de água, 08:00). As regras moram no `SettingsMapper` do Repo 1 (ADR 38 de lá); o que difere da
  produção: DP-95 a DP-97 do [`desvios-de-producao.md`](desvios-de-producao.md).
- **Argumento inteiro `null` ou `undefined`** (no lugar do dicionário, da lista ou do texto): no Android não chega ao
  `CoreBridge`; o React Native rejeita a Promise com um `Error` sem `code` e sem `onError`, exceção à regra 3 (DP-99).
  No iOS, o shim rejeita na hora com `INVALID_ARGUMENT` (mensagem `"<argumento> must not be null"`), sem chamar o
  `CoreBridge` e sem `onError`, também exceção à regra 3; sem essa conferência o `nil` derrubaria o app (DP-100). Vale
  também para `pairDevice`, `startPairingAttempt` e `deletedSavedData` (este só loga). Booleano ou número de outro tipo
  o próprio React Native recusa na chamada (lança no JS), como na produção.
- **Quando resolve.** O P85 não responde à maioria dos ajustes: a Promise resolve depois da escrita e do intervalo da
  fila (200 ms; 500 ms no perfil). Quatro esperam a confirmação que o P85 sempre mandou na captura do app Condor e podem
  rejeitar com `TIMEOUT` (4 s sem resposta) ou `PROTOCOL` (valor diferente do pedido): `setTemperatureUnit`,
  `setDeviceBatterySaving`, `setStressAutomaticCheck` e `setWalkReminder`. O `setWorldClock` depende de uma consulta
  (`TIMEOUT` sem ela). As respostas opcionais (os tipos do filtro de notificações, o perfil e as confirmações da agenda,
  a unidade do clima) nunca rejeitam por ausência: viram WARN no log.
- **Link caindo** no meio: `DISCONNECTED`; `disconnectCurrentDevice`, `forgetDevice` ou reload do JS: `CANCELLED`.
  Sempre um único resultado por chamada.
- **Promise observada** (regra 3): sem `await` não gera "Possible unhandled promise rejection"; com `await`, rejeita.
- **Privacidade.** Os frames com dado pessoal (perfil, ciclo, agenda e clima) saem no log, no `onLog` e na gravação
  `frames-*.jsonl` com o payload zerado, do mesmo tamanho; os bytes reais só vão ao relógio (redação dos frames
  privados, `docs/decisoes.md` do Repo 1). O app de exemplo usa só valores fictícios.

#### `setUserInfo(userInfo: TechnosUserInfoSet): Promise<void>`

`{ year, month, day, weight, height, gender }`, com o mês de 1 a 12, o peso em kg, a altura em cm (pode ser fracionária)
e o gênero como o app Condor manda (`"m"`, `"f"` ou `"o"`, a primeira letra de "Masculino", "Feminino" ou "Outro"), sem
diferenciar maiúsculas. Gênero vazio, nulo ou ausente vale `"o"` (com WARN no log; no fio é o mesmo feminino que os dois
Cores mandam para tudo que não é `"m"`); outra string rejeita `INVALID_ARGUMENT` (DP-95). Ano, mês (1-12), dia (1-31),
peso e altura são obrigatórios; peso e altura negativos rejeitam.

- Condor Reebok: `12 [altura][peso][idade][gênero]`, com altura e peso arredondados e saturados em 0-255, a idade em
  anos completos pela data do telefone e o gênero `00` masculino ou `01` feminino e outro (como os dois Cores). Resolve
  500 ms depois da escrita. O nativo guarda o último perfil em memória, para a atividade da fase 3; nada é persistido.
- Core atual: mesma assinatura (`NativeCore.ts:104`). O Android calcula a idade com o mês deslocado
  (`DateHelpers.kt:189-194`) e dá NPE sem conexão; o iOS resolve sem conferir a conexão. O app Condor chama sem `await`
  (`Smartwatch.ts:57-59`): o `observed` cobre.

#### `setGoalsV2(goals: TechnosGoalsSet): Promise<void>`

`{ steps, calories, distance, exerciseTimeInMinutes, movementTimeInHours }`. `steps`, `calories` e
`exerciseTimeInMinutes` são obrigatórios; `distance` e `movementTimeInHours` podem faltar (o Condor Reebok não os
grava). Negativos rejeitam `INVALID_ARGUMENT`.

- Condor Reebok: `B9 00 00` com as tags `01` passos, `02` kcal e `04` minutos de exercício (u32 LE, arredondados), sem a
  tag `03` da distância: o layout que o Android de produção manda e a captura do app Condor mostra (`pair-sync@7276` no
  `docs/protocolo-crp.md` do Repo 1). `distance` e `movementTimeInHours` não vão. Resolve depois da escrita.
- Core atual: mesma assinatura (`NativeCore.ts:113`). O Android trunca os fracionários (`getInt`); o iOS manda a tag
  `03` com `0x7FFFFFFF`.

#### `set12HourFormat(enabled: boolean): Promise<void>`

`true` = 12 h (AM/PM), `false` = 24 h, como no Core.

- Condor Reebok: `17 00` (12 h) ou `17 01` (24 h), sem resposta. Que `17 00` é 12 h no P85, a validação confirma.
- Core atual: mesma assinatura (`NativeCore.ts:63`) e os mesmos bytes.

#### `setTemperatureUnit(temp: string): Promise<void>`

`"c"` ou `"f"`, como o app Condor manda, sem diferenciar maiúsculas e sem os espaços das pontas (`"celsius"` e
`"fahrenheit"` também valem); outro valor rejeita `INVALID_ARGUMENT` (DP-95).

- Condor Reebok: `7C 00` ou `7C 01` e a consulta `8C`. Resolve quando o `8C` confirma a unidade pedida; rejeita
  `PROTOCOL` se ele trouxer outra e `TIMEOUT` sem resposta em 4 s. A unidade confirmada vale para o clima da conexão.
  Depois que resolve, o nativo reenvia o último clima recebido por `syncWeather` (se houver), convertido, por um pedido
  interno sem Promise, na fila atrás do que já estava pedido: uma falha dele sai só em `onError`, com
  `method: "syncWeather"`.
- Core atual: mesma assinatura (`NativeCore.ts:170`), mas resolve sem esperar o `8C`; o clima é reenviado a cada `8C`
  que chega (`CRPService.java:1369-1415`). Uma string desconhecida vira °C no Android (só `"f"`, sem diferenciar
  maiúsculas, é °F) e °F no iOS quando contém `"f"` minúsculo.

#### `setDistanceUnit(distanceUnit: TechnosDistanceUnitUpdate): Promise<void>`

`{ distance_unit: "km" }` ou `{ distance_unit: "miles" }` (o app Condor manda esses dois; `"mi"` e `"mile"` também
valem), sem diferenciar maiúsculas e sem os espaços das pontas; outro valor rejeita `INVALID_ARGUMENT`.

- Condor Reebok: `1A 00` (métrico) ou `1A 01` (imperial), sem resposta.
- Core atual: mesma assinatura (`NativeCore.ts:65`); uma string desconhecida vira imperial no Android (`contains("km")`)
  e métrico no iOS (`containsString:@"miles"`).

#### `setScreenTime(time: number): Promise<void>`

Segundos com a tela acesa, arredondados; fora de 1 a 255 rejeita `INVALID_ARGUMENT`.

- Condor Reebok: `7D [segundos]`, sem resposta. Quais valores o P85 aceita (a tela do app Condor vai de 5 a 30 s), a
  validação confirma.
- Core atual: mesma assinatura (`NativeCore.ts:116`); no Android, sem conexão **resolve** sem mandar nada
  (`CRPService.java:1154-1161`), e o valor é cortado no cast para byte.

#### `setDeviceBatterySaving(enabled: boolean): Promise<void>`

- Condor Reebok: `94 00` ou `94 01` e o eco `A4 [estado][01]`: resolve no eco, rejeita `PROTOCOL` se o estado ecoado for
  outro e `TIMEOUT` sem eco em 4 s. Um `A4` sem pedido só vai ao log.
- Core atual: mesma assinatura (`NativeCore.ts:169`); resolve sem esperar o eco.

#### `setSosHelp(isEnabled: boolean): Promise<void>`

- Condor Reebok: `BB 08 01 00` ou `BB 08 01 01`, sem resposta. Um aviso de SOS do relógio (`A1`) só vai ao log.
- Core atual: mesma assinatura (`NativeCore.ts:168`); o Android dá NPE sem conexão.

#### `setGestureControlV2(gestureControlMap: TechnosGestureControlSetV2): Promise<void>`

`{ enabled, startHour, endHour }`, com as horas em `"HH:mm"` (vazia ou ausente vale 00:00; hora inválida rejeita
`INVALID_ARGUMENT`).

- Condor Reebok: `18 00` ou `18 01` e `72 [h início][min início][h fim][min fim]`, sem resposta; resolve depois das duas
  escritas. As consultas `28`/`82` que o Core Android manda para conferir não saem (nunca foram vistas no P85).
- Core atual: mesma assinatura (`NativeCore.ts:57`). O Android confere com `28`/`82` sem prazo: se o relógio não
  responder, a Promise nunca termina e trava o sync do app Condor.

#### `setMenstrual(menstrual: TechnosMenstrualDataUpdate): Promise<void>`

O mês da última menstruação vai de **0 a 11** (`lastMenstrualPeriodMonth`, o `moment().month()` do app Condor; contrato
do Core nas duas plataformas), ao contrário do perfil (1 a 12). Os lembretes seguem `reminder`, que o app Condor manda
(`CrpMenstrualPayload`), ou, sem ele, `enabled`. Obrigatórios: as duas durações (não negativas), o mês (0-11) e o dia
(1-31) do início; `reminderHour` (0-23) e `reminderMinute` (0-59) valem 0 quando faltam (como o iOS de produção; o app
Condor sempre manda 10:00), e o ano pode faltar. Fora disso, `INVALID_ARGUMENT`.

- Condor Reebok: `75` com as flags, o ciclo, a duração, o mês (0-11), o dia e quatro horários de lembrete (14 bytes); o
  ano não vai. Sem resposta. O histórico e as distâncias da ovulação e da janela fértil são ignorados.
- Core atual: mesma assinatura (`NativeCore.ts:85`). O Android liga os lembretes com `enabled || reminder` e dá NPE sem
  conexão; o iOS só olha `reminder`.

#### `setHeartRateAutomaticCheck(enabled: boolean, startHour: string, endHour: string, interval: number): Promise<void>`

Os quatro argumentos posicionais do Core (a tela do app Condor manda `(enabled, "00:00", "23:59", 5)`). As horas
seguem a regra de `"HH:mm"` mesmo que o Condor Reebok não as use (DP-96), e o intervalo negativo rejeita
`INVALID_ARGUMENT`.

- Condor Reebok: `1F [n]`, com n = intervalo / 5 arredondado, entre 1 e 255; desligado manda `1F 00`. A janela não vai
  (só aparece no log DEBUG). Sem resposta.
- Core atual: mesma assinatura (`NativeCore.ts:44`). Com intervalo menor que 5, o Android não manda nada e resolve, e o
  iOS manda 0 (desliga); aqui vale n = 1 (5 min).

#### `setStressAutomaticCheck(automaticStress: TechnosStressAutomaticUpdate): Promise<void>`

- Condor Reebok: só o `enabled` vai (`B9 01 01 [0|1]`), e a consulta `B9 11 01 00` confirma: resolve com o mesmo estado,
  rejeita `PROTOCOL` se o relógio confirmar outro e `TIMEOUT` sem resposta em 4 s. A janela, o intervalo, o alerta de
  estresse alto e os dias são ignorados, mas conferidos (`"HH:mm"`, `repeat` em objeto; o intervalo pode faltar). O app
  Condor o manda em todo sync, inclusive o parcial.
- Core atual: mesma assinatura (`NativeCore.ts:45`). O Android guarda o estado pedido numa flag global (duas chamadas
  comparam com a última), aceita qualquer `B9 11 01` sem pedido como resposta e rejeita em 5 s; o iOS resolve sem
  confirmar.

#### `setNotDisturb(notDisturb: TechnosNotDisturbSet): Promise<void>`

`{ enabled, startHour?, endHour?, alwaysOn?, repeat? }`. As horas são conferidas mesmo com o modo desligado.

- Condor Reebok: `71 [h início][min início][h fim][min fim]`, sem resposta, com a regra dos dois Cores para horas
  vazias: desligado (ou `enabled` nulo) manda `00 00 00 00`; cada hora vazia vale 00:00 naquele campo; só `alwaysOn:
  true` explícito vira o dia inteiro (00:00-23:59); os dias são ignorados. Ligado com o início igual ao fim (inclusive
  as duas vazias, que o relógio lê como desligado) gera WARN no log.
- Core atual: mesma assinatura (`NativeCore.ts:87`). O Android ignora `alwaysOn`, lança exceção com `enabled` nulo e,
  sem conexão, resolve sem mandar nada. No sync completo o app Condor manda o não perturbe manual e depois o automático;
  vale o último.

#### `setWaterReminderV2(waterReminder: TechnosWaterReminderUpdate): Promise<void>`

- Condor Reebok: `77 01 [liga][hh][mm][quantidade][intervalo][00]`, sem resposta. Início vazio vale 08:00 (como o Core);
  o intervalo é obrigatório; intervalo fora de 1 a 255 ou quantidade fora de 0 a 255 rejeita `INVALID_ARGUMENT`; a
  quantidade vai como veio, inclusive 0 (o sync do app Condor sem ajuste salvo manda 0), e vale 0 quando falta. O fim e
  os dias são ignorados (e conferidos).
- Core atual: mesma assinatura (`NativeCore.ts:59`); no Android, chave ausente vira exceção nativa.

#### `setWalkReminder(walkReminder: TechnosWalkReminderUpdate): Promise<void>`

O liga/desliga se chama `onOff` (não `enabled`), como no Core e no app Condor: um `enabled` sem `onOff` não liga nada
(só um DEBUG no log).

- Condor Reebok: só o `onOff` vai (`1D [0|1]`), e a consulta `2D` confirma: resolve com o mesmo estado, `PROTOCOL` com
  outro, `TIMEOUT` sem resposta em 4 s. O período (`73`) não sai: vale o padrão do firmware.
- O `interval` e o `stepPerHour` nunca rejeitam, porque o CRP não os grava: número, ou texto com um número (`"60"`, o
  formato que o backend do app Condor guarda); qualquer outro valor (`""`, `"never"`, `Infinity`, negativo) vale 0, com
  um DEBUG ([DP-96](desvios-de-producao.md)).
- Core atual: mesma assinatura (`NativeCore.ts:47`). O Android espera o `2D` sem prazo (a Promise pode nunca terminar) e
  com um callback só, que duas chamadas sobrepostas disputam.

#### `setAlarm(alarmArray: TechnosAlarmSet[]): Promise<void>`

Substitui todos os alarmes. Cada item usa a chave `enable` (o app Condor manda `!!item.enable`; `enabled` não vale
aqui), `hour`, `minute` e o `repeat` de 7 caracteres a partir da segunda (`"1111100"` = segunda a sexta; só o `'1'`
liga o dia). Hora (0-23) e minuto (0-59) valem 0 quando faltam e rejeitam `INVALID_ARGUMENT` fora da faixa; um item
nulo ou que não é objeto também rejeita; o `repeat` ausente conta como tamanho errado.

- Condor Reebok: `B9 05 03` (apaga todos) e um `B9 05 00 [id][liga][tipo][hh][mm][data][dias]` por alarme, com o id =
  posição na lista. Os 7 dias viram "todo dia"; nenhum dia (`"0000000"`) é um alarme único, gravado na próxima
  ocorrência da hora pela data do telefone e reprogramado a cada envio (como no Android de produção); `repeat` de
  tamanho errado vira único, com WARN. Mais de 8 alarmes: os excedentes são cortados, com WARN. `position`, `day`,
  `month`, `year`, `type`, `alarmName` e a soneca são ignorados. Lista vazia só apaga. Resolve depois das escritas ((1 +
  N) × 200 ms). Um alarme único depois de 2030 rejeita `PROTOCOL` (o campo de ano do relógio vai de 2015 a 2030).
- Core atual: mesma assinatura (`NativeCore.ts:54`). O Android dá NPE sem conexão e resolve antes das escritas; o iOS
  manda "semanal" para os 7 dias e erra a data do alarme único na virada do mês (`CRPUserSettings.m:132-143`).

#### `setWorldClock(worldClockList: TechnosWorldClockSet[]): Promise<void>`

`[{ name, utcOffsetMinutes, latitude, longitude }]`, como o app Condor monta da lista de fusos do Core.

- Condor Reebok: consulta as cidades do relógio (`BB 00 00`), apaga as antigas (`BB 00 03 [id]`), grava cada cidade (`BB
  00 02`, com o fuso, a diferença para o fuso atual do telefone, a latitude e a longitude × 10⁶ truncadas em direção a
  zero e o nome em até 40 bytes UTF-8, sem partir caractere) e, se escreveu algo, consulta de novo para conferir
  (diferença só gera WARN). Sem resposta à primeira consulta em 4 s, `TIMEOUT`. Nome vazio, fuso fora de ±1440 min,
  latitude fora de ±90 ou longitude fora de ±180 rejeitam `INVALID_ARGUMENT`. Lista vazia apaga as cidades.
- A diferença de fuso é calculada no envio: depois de uma viagem ou da troca do horário de verão, fica errada até o
  próximo envio.
- Core atual: mesma assinatura (`NativeCore.ts:154`). O Android trunca as coordenadas para graus inteiros e nunca limpa
  o relógio com a lista vazia (`sdk:f/n2.java:81-84`); o iOS troca a latitude pela longitude e apaga com `BB 00 05`.

#### `manageNotifications(notifications: TechnosManageNotificationsUpdate, shouldShowNotificationModal = true): Promise<void>`

`{ [chave]: boolean }`, com o nome do app (como o app Condor mostra, vindo do `getNotificationListByModel`) ou uma chave
fixa. O segundo argumento é ignorado (padrão `true`, como no Core; o app Condor sempre manda `false`; DP-79 do
[`desvios-de-producao.md`](desvios-de-producao.md)).

- É só o **filtro** no relógio; não encaminha notificações. No iPhone, o relógio lê as notificações pelo ANCS e o filtro
  decide quais mostra. No Android, o encaminhamento (o `NotificationListenerService` do Core antigo) ainda não existe
  ([`pendencias.md`](pendencias.md#8-fase-2-do-condor-reebok-o-que-fica-fora-e-o-que-falta-validar)).
- Condor Reebok: consulta os tipos que o relógio suporta (`B9 14 00`, uma vez por conexão; a resposta, e também a falta
  dela, ficam guardadas) e grava `B9 04` com um liga/desliga por tipo, na ordem do relógio; o código do próprio app
  (`0x36`) sempre vai ligado. Sem resposta à consulta em 4 s: WARN no log, nenhum `B9 04`, e a Promise resolve.
- Chaves, sem diferenciar maiúsculas e sem os espaços das pontas (a tabela cobre as listas Android e iOS do Condor
  Reebok e as chaves fixas do app Condor). Duas grafias da mesma chave somam: basta uma ligada. Um valor que não é
  booleano nem número rejeita `INVALID_ARGUMENT`. Na segunda coluna, o código de fio do tipo no relógio (hex), na ordem
  das chaves:

| Chave | Tipo no relógio |
|---|---|
| `CALLS` | ligação (`00`) e ligação perdida (`2D`) |
| `SMS`, `Mensagens` | SMS (`01`) |
| `CALENDAR` | calendário do sistema (`39`) e Google Agenda (`12`) |
| `OTHERS` | outros (`80`) |
| `WhatsApp`, `WhatsApp Business`, `WhatsApp / WBusiness` | WhatsApp (`08`), WhatsApp Business (`2E`), os dois |
| `X`, `Twitter` | X (`05`) |
| `Email`, `Mail` | e-mail (`32`) |
| `Facebook`, `Instagram`, `Skype`, `Messenger`, `Telegram`, `Viber`, `WeChat` | `04`, `06`, `07`, `0C`, `0E`, `0F`, `02` |
| `Gmail`, `Google Calendar`, `Outlook`, `Yahoo`, `Google Pay`, `Google Chat`, `Google Drive`, `Google Maps` | `11`, `12`, `14`, `15`, `18`, `28`, `2A`, `33` |
| `Uber`, `Snapchat`, `YouTube Music`, `YouTube`, `LinkedIn`, `Amazon`, `Netflix`, `Prime` | `1C`, `1F`, `20`, `21`, `22`, `23`, `25`, `27` |
| `TikTok`, `Slack`, `Teams`, `Discord` | `30`, `34`, `35`, `38` |
| `ALL_APPS`, `ALARM` | ignoradas (DEBUG no log) |
| qualquer outra | ignorada (WARN no log) |

- Core atual: mesma assinatura (`NativeCore.ts:50`). O Android só grava as preferências do seu `NotificationListener` e
  resolve, sem falar com o relógio (`CRPService.java:903-929`); o iOS grava o mesmo filtro, mas compara as chaves com
  maiúsculas e perde `Youtube Music`, `Email` e `CALENDAR` (`CRPService.m:547-617`).

#### `setAddressBook(contactList: TechnosContactItem[]): Promise<void>`

`[{ name, phoneNumber }]`. Substitui a agenda do relógio; lista vazia apaga.

- Condor Reebok: lê o perfil da agenda (`F2 00`, uma vez por conexão, sem rejeitar se não vier: vale nome de 20 bytes e
  até 8 contatos), apaga todos (`F2 EF`) e grava um `F2 02` por contato com número, com ids 0, 1, 2... sem buracos. O
  número fica só com os dígitos e o `+` inicial; o nome vai em UTF-8, cortado sem partir caractere, no tamanho que o
  perfil informa (no mínimo 20, no máximo 64 bytes). O relógio confirma cada contato (`F2 FE [id][status]`): status
  diferente de 0 rejeita `PROTOCOL` (o mesmo vale para a confirmação do apagar); uma confirmação que não vem só gera
  WARN.
- Se o P85 aceita o `+`, não se sabe: a consulta `F2 05` existe só no codec do Repo 1, sem método no JS; a validação
  olha a tela do relógio.
- As ligações para os contatos saem pelo HFP do vínculo Bluetooth clássico (no iPhone, o feito em Ajustes).
- Core atual: mesma assinatura (`NativeCore.ts:137`). O Android espera N + 1 confirmações sem prazo e sem olhar o id
  (pode nunca terminar), com ids com buracos; o iOS tira o `+` e resolve sem esperar confirmação.

#### `syncWeather(weatherList: TechnosWeatherListUpdateItem[]): Promise<void>`

A lista que o app monta (no app Condor, com a geolocalização e a API de clima): o item 0 é hoje (temperatura, cidade,
nascer e pôr do sol) e os seguintes são a previsão; o Condor Reebok usa os 7 primeiros, contando hoje.

- Cada item precisa de `icon`, `min` e `max`, e o item 0 também de `temperature`; `locationName` nulo ou ausente vale
  vazio; `temperatureUnit` é `"c"` (ou ausente) ou `"f"`, e outro valor rejeita `INVALID_ARGUMENT`, como um item nulo.
  Do `sunrise` e do `sunset` vale o `HH:mm` logo depois do `T`; sem ele, o horário vai como 00:00, com WARN.
- O nativo guarda em memória o último clima válido e não vazio, em °C (um item com `temperatureUnit: "f"` é
  convertido), mesmo quando a Promise rejeita (`NOT_READY`, `NOT_SUPPORTED`), e o reenvia depois de cada
  `setTemperatureUnit` que resolve (DP-98). Lista vazia resolve na hora, com o relógio desconectado ou com o fitGPS e
  o Life Ultra GPS, sem enviar e sem apagar o guardado. O guardado sobrevive à queda do link e ao reload do JS, não a
  um processo novo.
- Condor Reebok: consulta a unidade (`8C`; sem resposta, usa a última confirmada na conexão ou °C, com WARN, sem
  rejeitar) e manda o "hoje" legado (`43`, com a cidade em até 4 caracteres), o novo (`B5 00`, com o nascer e o pôr do
  sol e a cidade em até 25 bytes) e a previsão (`42`, 7 dias). Os ícones seguem a tabela do Core Android
  (`WeatherAPIV3.java`: 1 a 3 sol, 18 chuva...). Cidade vazia pula o "hoje". As temperaturas viram °F só no envio, com o
  relógio em °F.
- Core atual: `syncWeather(weatherList): void` (`NativeCore.ts:66`). O Android só manda depois da resposta ao `8C` e
  derruba o clima inteiro se o `sunrise` vier fora do formato estrito; o iOS do REEBOK só manda o `43` e o `42` e apaga
  o guardado com a lista vazia.

#### `vibrateDevice(): Promise<void>`

- Condor Reebok: `61`, sem resposta; resolve depois da escrita. Durante um sync, espera o fim dele (a tela de 3 s do app
  Condor pode acabar antes).
- Core atual: `vibrateDevice(): void` (`NativeCore.ts:18`); o Android dá NPE e derruba o app quando a conexão já foi
  fechada.

#### `openCameraMode(): Promise<void>`

- Condor Reebok: `66`, sem resposta esperada. Depois da escrita e do intervalo de 200 ms (em que um eco `66` do relógio
  é descartado, para não virar foto), o nativo marca o modo câmera como aberto, emite
  [`onOpenCameraMode`](#ontakeapicture-ondevicerequestedcameramode-e-onopencameramode) e resolve. Se a escrita falha,
  não emite.
- A partir daí, cada disparo no relógio vira `onTakeAPicture`; com o modo fechado, `onDeviceRequestedCameraMode`. O modo
  fecha com `closeCameraMode`, com a saída pela tela do relógio (`53 0E FF`) ou com a conexão fora de `READY`/`SYNCING`.
- Se o modo fecha antes de o abrir concluir (o app Condor chama `closeCameraMode` ao sair da tela, e o abrir pode estar
  na fila atrás de um sync, ou no intervalo de 200 ms), o abrir resolve sem `onOpenCameraMode` e o modo continua
  fechado; o relógio recebe o `66` e depois o `53 0E` ([DP-59](desvios-de-producao.md)).
- Core atual: `openCameraMode(): void` (`NativeCore.ts:25`). O Android do app Condor nunca emitia `onOpenCameraMode` (a
  espera de 10 s do app sempre estourava); o iOS emitia antes de escrever, sem conferir a conexão.

#### `closeCameraMode(): Promise<void>`

- Condor Reebok: `53 0E` (sai da tela de câmera), sem resposta; resolve depois da escrita e fecha o modo câmera.
- **Desconectado**, só fecha o modo câmera e resolve, sem escrever, sem `NOT_READY` e sem `onError` (exceção à regra
  comum): o app Condor chama ao sair da tela, muitas vezes com o relógio já fora. Vale também quando o link cai entre a
  chamada e o pedido chegar à sessão. O modo câmera fecha na chamada, antes de qualquer escrita. Com o fitGPS ou o Life
  Ultra GPS conectados, `NOT_SUPPORTED`.
- Core atual: `closeCameraMode(): void` (`NativeCore.ts:27`); o Android dá NPE e derruba o app sem conexão.

## Eventos

Todos em `TechnosEvents`, com a forma `TechnosEventEmitter<T>`: `const sub = TechnosEvents.onX(handler);
sub.remove();`. Tipos em `src/types/events.ts`.

| Evento | Payload | Quando | Core atual |
|---|---|---|---|
| `onScannedDevice` | `ScannedDeviceEvent` | durante `scan()` | igual, mais `bleName` e `profileId` |
| `onConnectStateChanged` | `ConnectStateChangedEvent` | toda mudança de estado | igual, mais `sessionState` e `phase` |
| `onDeviceInfo` | `DeviceInfoEvent` | `getDeviceInfo()` | não existe para SMA |
| `onFirmwareInfo` | `FirmwareInfoEvent` | `getFirmwareInfo()` | igual (`deviceId` agora preenchido) |
| `onBatteryStatus` | `BatteryStatusEvent` | `getBatteryStatus()`; aviso do Condor Reebok | igual |
| `onPedometer` | `PedometerEvent` | `refreshSteps()`, aviso do relógio, passos ao vivo do Condor Reebok | mesmo `pedometer` no fitGPS 0.2.1 (o acumulado do dia), com calorias e distância no mesmo evento |
| `onHistoryPedometer` | `HistoryPedometerEvent` | `getHistoryPedometer()` | formato igual ao Core iOS; totais do fitGPS menores (o Core atual soma as horas, [`pendencias.md`](pendencias.md), seção 5) |
| `onHistorySleep` | `HistorySleepEvent` | `getHistorySleep()` | nunca emitido para SMA |
| `onSyncStarted` | `{}` | início do sync | simulado |
| `onSyncProgress` | `SyncProgressEvent` | por etapa do sync | simulado |
| `onSyncFinished` | `{}` | fim do sync | simulado |
| `onFindPhone` | `FindPhoneEvent` | o relógio começa ou para de procurar o telefone (só Condor Reebok) | igual; o Core do Condor não emitia no CRP |
| `onTakeAPicture` | `{}` | disparo no relógio com a câmera aberta | igual |
| `onOpenCameraMode` | `{}` | `openCameraMode()` escrito, antes do resolve | igual; o Core Android do Condor não emitia |
| `onDeviceRequestedCameraMode` | `{}` | disparo no relógio com a câmera fechada | igual, sem abrir o modo câmera |
| `onError` | `ErrorEvent` | toda falha | não existe |
| `onLog` | `LogEvent` | cada entrada do log | não existe |

### `onScannedDevice`

```ts
interface ScannedDeviceEvent {
	name: string; // appName do perfil: "fitGPS"
	deviceId: string; // MAC no Android, UUID do periférico no iOS
	rssi: number;
	bleName: string; // nome anunciado: "Mormaii_fitGPS" (novo)
	profileId: string; // "fitgps" (novo)
}
```

```json
{ "name": "fitGPS", "deviceId": "D4:3B:04:11:22:33", "rssi": -62, "bleName": "Mormaii_fitGPS", "profileId": "fitgps" }
{ "name": "Life Ultra GPS", "deviceId": "C1:02:03:04:05:06", "rssi": -58, "bleName": "Life Ultra GPS", "profileId": "lifeultragps" }
{ "name": "Condor Reebok", "deviceId": "AA:BB:CC:DD:EE:FF", "rssi": -60, "bleName": "P85", "profileId": "condorreebok" }
```

Os nomes que o scan aceita saem dos perfis do Repo 1 (`Mormaii_fitGPS`; `Life Ultra GPS` e `Smart Watch 6010`;
`Condor Reebok` e qualquer nome que comece com `P85`).

Core atual: `{ name, deviceId, rssi }` com `name = "fitGPS"` (`SMAService.java:505-526`). O app Mormaii filtra por
`ALLOWED_DEVICE_NAMES.includes(name)` (`GTE-Mormaii/src/constants/index.ts:138-148`), que continua valendo.

### `onConnectStateChanged`

```ts
interface ConnectStateChangedEvent {
	state: number; // deviceConnectStates
	sessionState: string; // estado detalhado da sessão (novo)
	phase: string | null; // "BIND" ou "LOGIN" durante o handshake; "VERSION" no Condor Reebok (novo)
}
```

```json
{ "state": 1, "sessionState": "HANDSHAKING", "phase": "BIND" }
{ "state": 1, "sessionState": "HANDSHAKING", "phase": "VERSION" }
```

Tradução do estado da sessão para `state` (`StateMapper` do `:bridge`, Repo 1):

| `sessionState` | `state` | Observação |
|---|---|---|
| `DISCONNECTED` | 0 `disconnect` | |
| `RECONNECTING` | 0 `disconnect` | o link caiu e a conexão pendente espera o relógio voltar, como o Core atual mostra (`SMAService.java:254-262`) |
| `CONNECTING`, `CONFIGURING`, `HANDSHAKING` | 1 `connecting` | |
| `READY`, `SYNCING` | 2 `connected` | o app só libera as telas de dados com 2 |
| `BLUETOOTH_OFF` | 4 `disconnectedBluetoothOff` | |

Os códigos -2 (DFU), -1 e 3 (desconectado em atividade) não são produzidos nesta PoC. Core atual: `{ state }`.

### `onDeviceInfo`

```ts
interface DeviceInfoEvent {
	deviceId: string;
	profileId: string;
	bleName: string;
	firmware: string; // "x.y.z"
	bleVersion: string | null; // null no SMA e no iDO; no CRP, o texto lido em 2A29 ("MOYOUNG-V2")
}
```

```json
{ "deviceId": "D4:3B:04:11:22:33", "profileId": "fitgps", "bleName": "Mormaii_fitGPS", "firmware": "1.0.7", "bleVersion": null }
{ "deviceId": "AA:BB:CC:DD:EE:FF", "profileId": "condorreebok", "bleName": "P85", "firmware": "MOY-VS02-2.0.0", "bleVersion": "MOYOUNG-V2" }
```

Novo. Quando o relógio manda a versão sem pedido (`requestId -1`), saem `onDeviceInfo` e `onFirmwareInfo`.

### `onFirmwareInfo`

```ts
interface FirmwareInfoEvent {
	version: string;
	braceletType: number; // 0 no fitGPS, no Life Ultra GPS e no Condor Reebok
	platformCode: number; // 0 no fitGPS, no Life Ultra GPS e no Condor Reebok
	deviceId: string;
}
```

```json
{ "version": "1.0.7", "braceletType": 0, "platformCode": 0, "deviceId": "D4:3B:04:11:22:33" }
```

Core atual: `TechnosFirmwareInfo { version, braceletType: 0, platformCode: 0, deviceId?: number }`
(`SMAService.java:241-244`, `EventHandler.kt:275-287`). Diferença: `deviceId` é sempre preenchido e é string (MAC). No
Life Ultra GPS o `version` sai `"1.1.1"` (os três números do `02/EB`); o Core atual formata `"1.01.01"` e manda o
`deviceId` da iDO (8294) como número (`SDKCallbacks.java:1022-1038`). No Condor Reebok o `version` é o texto do
relógio, `"MOY-VS02-2.0.0"`.

### `onBatteryStatus`

```ts
interface BatteryStatusEvent {
	percentage: number; // 0 a 100
	charging: boolean; // só o Condor Reebok informa; false no SMA e no iDO (o estado de carga do iDO não é repassado na PoC)
	battery: string; // legado, "85%"
}
```

```json
{ "percentage": 85, "charging": false, "battery": "85%" }
{ "percentage": 55, "charging": true, "battery": "55%" }
```

No Condor Reebok, uma leitura de `2A19` acima de 100 quer dizer carregando, com o nível = valor - 100 (a regra é do Core
do app Condor, `CRPService.java:1814-1822` no `v4.3.57`, e ainda falta confirmar no carregador). O relógio também
notifica a bateria sozinho, cerca de uma vez por minuto (na captura do app Condor, `0x32` = 50 % e depois `0x31`):
cada aviso vira um `onBatteryStatus` sem pedido, com o mesmo formato.

Confirmado com o P85 em 2026-11-01 (gravação real do Repo 1, `real@10306` a `@310025` no `docs/protocolo-crp.md` de
lá): `{ "percentage": 43, "charging": false, "battery": "43%" }` a cada cerca de 60 s, sem nenhum pedido, perto da
virada de cada minuto do relógio; não chega um aviso ao conectar, e o ritmo não recomeça com um novo pareamento nem com
o Bluetooth religado. Consequência para quem assina o evento: a bateria aparece até um minuto depois do `READY`, antes
de qualquer `getBatteryStatus` (no app de exemplo, o cartão Bateria já estava preenchido antes do "Ler"), e continua
sendo atualizada sem chamada. Para o valor na hora, chame `getBatteryStatus`.

No iPhone, no mesmo dia, a gravação das 17:04 (`ios-pair-commands-sync-reconnect.jsonl` do Repo 1) não teve nenhum
aviso: só o `onBatteryStatus` do `getBatteryStatus` (a única virada de minuto da janela gravada coincidiu com o
acerto de hora da conexão). Numa segunda sessão no iPhone, às 23:20 (não versionada), o aviso veio em cada uma das 8
viradas de minuto, 42 → 41 → 40 %, e o usuário relatou, sobre o teste com o app aberto: "está atualizando
automaticamente" ([`ios-pendente.md`](ios-pendente.md#a-segunda-sessão-no-iphone-2026-11-01-2320-não-versionada)).
Em segundo plano e com a tela bloqueada não foi testado. Para o valor na hora, chame `getBatteryStatus`.

Core atual: mesmo formato (`EventHandler.kt:290-298`).

### `onPedometer`

```ts
interface PedometerEvent {
	pedometer: number; // passos de hoje
	calorie: number; // kcal estimadas
	distance: number; // metros estimados
	date: string; // início do dia local
}
```

```json
{ "pedometer": 6230, "calorie": 241, "distance": 4512.3, "date": "2026-10-28T00:00:00-03:00" }
```

Sai depois de `refreshSteps()` e quando o relógio avisa que os dados mudaram (`02/70`, `requestId -1`). Na gravação
do fitGPS 0.2.1 o relógio não mandou nenhum `02/70`, nem em cerca de 384 s e 234 s conectado e parado (fixture
`technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`, igual byte a byte ao
export `frames-20261029-083254.jsonl`): para passos ao vivo, chame `refreshSteps()` periodicamente, como o Core atual
faz a cada 10 s (`SMAService.java:547-603`).

No Condor Reebok, `calorie` e `distance` são os totais do dia que o relógio mede (`FEE1`), não estimativas. O relógio
notifica `FEE1` sozinho quando os passos mudam (cerca de uma vez por segundo andando, não a cada passo; o primeiro aviso
depois de uma pausa traz uns 16 passos de uma vez): cada aviso atualiza a meia hora
atual e os totais do dia, e sai um `onPedometer` sem pedido, no máximo um a cada 2 s. Se o aviso chega antes de
qualquer `refreshSteps` ou sync na conexão, o nativo pede uma leitura dos passos uma vez só e a faz 2 s depois do
aviso (andando, os avisos seguintes não adiam a leitura), emite o `onPedometer` dela e, a partir daí, os dos avisos.
Uma leitura que falha só é tentada de novo 30 s depois. Visto no P85 em 2026-11-01: seis avisos em rajada (16 a 21
passos) geraram uma leitura só, 2,35 s depois do primeiro, e um `onPedometer` sem pedido; um `refreshSteps` pedido
durante ela rodou logo depois. Os avisos com a leitura já feita foram vistos no iPhone no mesmo dia, numa segunda
sessão (não versionada): depois de uma leitura de passos, 14 avisos andando (de 37 a 106 passos) e nenhuma leitura
nova até o sync, e o usuário relatou, sobre o teste com o app aberto: "está atualizando automaticamente". O
espaçamento de 2 s entre os `onPedometer` não foi conferido no aparelho (sem log). A meia
hora corrente não vem no histórico do relógio enquanto está aberta; mesmo assim, o `pedometer` de hoje é o total do
relógio (`FEE1`), e o dia de hoje no `onHistoryPedometer` também.

Core atual: `{ pedometer }`, com o `step` do registro mais recente lido pelo polling (`SMAService.java:387-405`). No
fitGPS 0.2.1 esse valor é o acumulado do dia (ADR 1 do Repo 1), o mesmo número que este evento traz e que a tela do
relógio mostra. Calorias e distância saem em eventos separados (`onCalories`, `onDistance`), que não existem aqui.
Calorias e distância daqui usam o mesmo perfil fixo do Core atual (60 kg, 173,5 cm).

### `onHistoryPedometer`

```ts
interface HistoryPedometerEvent {
	historypedometer: {
		date: string; // início do dia local
		distance: number; // metros
		calorie: number; // kcal
		pedometer: number; // passos do dia
	}[];
}
```

```json
{
	"historypedometer": [
		{ "date": "2026-10-26T00:00:00-03:00", "distance": 6321.4, "calorie": 338, "pedometer": 8730 },
		{ "date": "2026-10-27T00:00:00-03:00", "distance": 3010.0, "calorie": 161, "pedometer": 4157 },
		{ "date": "2026-10-28T00:00:00-03:00", "distance": 4512.3, "calorie": 241, "pedometer": 6230 }
	]
}
```

Core atual: mesmo formato, mas o Android põe em `date` a hora do **primeiro** registro do dia (ex.:
`T07:00:00-03:00`) e o iOS o início do dia; distância `double` no Android e inteiro no iOS (`SMAService.m:301-369`).
Os totais diferem no fitGPS: os dois Cores atuais somam as horas do dia, e com o acumulado do dia do firmware 0.2.1
isso conta o acumulado de novo a cada hora com registro; aqui o total do dia é o maior valor do dia, o da tela do
relógio ([`pendencias.md`](pendencias.md), seção 5).
A referência aqui é o iOS (início do dia) com distância `double`. O app faz `moment(date).toISOString()`
(`GTE-Mormaii/src/mappers/entities/pedometer.ts:40-48`) e absorve a diferença.

### `onHistorySleep`

```ts
interface HistorySleepEvent {
	historysleep: {
		date: string; // início do dia em que a pessoa acordou
		sleep: {
			start: string;
			end: string;
			items: { typeItem: number; startItem: string; endItem: string }[]; // 1 acordado, 2 leve, 3 profundo, 4 REM
			respiratoryRateItems: { value: number; date: string }[]; // sempre [] no SMA
			totalSleepMinutes: number;
			lightSleepMinutes: number;
			deepSleepMinutes: number;
			remSleepMinutes: number; // sempre 0 no SMA
			wakeUpMinutes: number;
		};
	}[];
}
```

```json
{
	"historysleep": [
		{
			"date": "2026-10-28T00:00:00-03:00",
			"sleep": {
				"start": "2026-10-27T23:10:00-03:00",
				"end": "2026-10-28T06:40:00-03:00",
				"items": [
					{ "typeItem": 2, "startItem": "2026-10-27T23:10:00-03:00", "endItem": "2026-10-27T23:25:00-03:00" },
					{ "typeItem": 3, "startItem": "2026-10-27T23:25:00-03:00", "endItem": "2026-10-28T01:40:00-03:00" },
					{ "typeItem": 1, "startItem": "2026-10-28T01:40:00-03:00", "endItem": "2026-10-28T01:55:00-03:00" },
					{ "typeItem": 2, "startItem": "2026-10-28T01:55:00-03:00", "endItem": "2026-10-28T06:40:00-03:00" }
				],
				"respiratoryRateItems": [],
				"totalSleepMinutes": 450,
				"lightSleepMinutes": 300,
				"deepSleepMinutes": 135,
				"remSleepMinutes": 0,
				"wakeUpMinutes": 15
			}
		}
	]
}
```

Os estágios vêm do port do `analyseSleeps` da SDK (`SmaSleep.java:17-70`): o SMA nunca produz REM e não mede
respiração. Os opcionais `awrrStatus`, `sleepScore` e `breathQuality` do Core atual não existem aqui.

Core atual: mesmo formato (`TechnosWareCore/src/NativeModules/type/eventData/sleep.ts`), mas nunca emitido para SMA.

### `onSyncStarted`, `onSyncProgress`, `onSyncFinished`

```json
{}
{ "progress": 50 }
{}
```

`progress` vai de 0 a 100, por etapa do sync: 0, 50 (passos lidos) e 100 (sono lido), como o `SyncEngine.kt` do Repo 1 calcula. Um sync que falha não emite `onSyncFinished`: sai um
`onError` com `method: "syncDataHistory"` e a Promise rejeita. Core atual: mesmos nomes e formatos, simulados no SMA.

### `onFindPhone`

```ts
interface FindPhoneEvent {
	status: "1" | "0"; // "1": o relógio começou a procurar o telefone; "0": parou
}
```

```json
{ "status": "1" }
```

Só o Condor Reebok emite (fase 2). Vem do aviso `62` do relógio: payload vazio ou primeiro byte `00` = começou; outro
valor = parou, com qualquer tamanho (regra da SDK Android; a do iOS difere com 2 bytes ou mais, `docs/protocolo-crp.md`
do Repo 1, seção 11). Sai sem pedido, só com a conexão pronta, e **não é guardado** enquanto o JS não existe: depois de
um reload, um alarme de celular fora de hora seria pior do que perdê-lo.

O nativo não toca, não vibra e não acende a lanterna: quem reage é o app (o app Condor toca o `alarm.mp3`; o app de
exemplo vibra). Não há como avisar o relógio de que o telefone foi achado (o `62 FF` existe só no codec do Repo 1). Com
o app em segundo plano, só chega se o processo estiver vivo (no Android, o nativo só tem serviço em primeiro plano
durante o sync). É a opção A da decisão do usuário de 2026-11-01.

Core atual: mesmo formato (`TechnosFindPhoneStatus`, `type/eventData/deviceInfo.ts:28-30`), mas o Core do app Condor
**não emite** no CRP: ele mesmo toca o alarme, com tela cheia, lanterna e vibração (`TechnosFindPhoneManager`). O
handler do app Condor (`useWatchInfoData/index.ts:166-209`) passa a rodar no P85.

### `onTakeAPicture`, `onDeviceRequestedCameraMode` e `onOpenCameraMode`

```json
{}
```

- `onOpenCameraMode`: o `openCameraMode` escreveu a abertura; sai antes de a Promise resolver (regra 2). O app Condor
  espera esse evento com 10 s.
- `onTakeAPicture`: disparo no relógio (RX `66`) com o modo câmera aberto pelo app.
- `onDeviceRequestedCameraMode`: o mesmo disparo com o modo fechado. Não abre o modo (o iOS de produção abria, e os
  disparos seguintes viravam foto com o app fora da tela).
- A saída pela tela do relógio (`53 0E FF`) fecha o modo, sem evento; outro `53` só vai ao log.
- Nenhum dos três é guardado enquanto o JS não existe. Com o app em segundo plano, o disparo só vira o evento (no
  Android de produção havia uma notificação com deep link para abrir a câmera).

Core atual: mesmos nomes e payload vazio (`NativeCore.ts:182-183, 222`); o Core Android do app Condor nunca emitia
`onOpenCameraMode`.

### `onError`

```ts
interface ErrorEvent {
	requestId: number; // -1 quando não veio de um comando
	code: string; // um dos errorCodes
	message: string; // texto em inglês, para log
	method: string | null; // método JS de origem, ou null (ex.: reconexão automática)
}
```

```json
{ "requestId": 12, "code": "TIMEOUT", "message": "No response to 05/41", "method": "syncDataHistory" }
```

Sai para toda Promise rejeitada e para falhas sem Promise (`scan`, reconexão automática, aviso do relógio, vínculo
clássico). Uma reconexão que o nativo começou sozinho e que para por `PAIRING_REMOVED` sai com `method: null` e
`requestId` -1 (a sessão reconectava depois de uma queda) ou interno (o `CoreBridge` pediu a reconexão), conforme quem
a começou. O vínculo Bluetooth clássico do Condor Reebok que não saiu vem com `method: "classicBond"` e `requestId` -1:

```json
{ "requestId": -1, "code": "CLASSIC_BOND_FAILED", "message": "Classic Bluetooth bond with AA:BB:CC:DD:EE:FF was not created: bond state went from BONDING to NONE (attempt 2 of 2)", "method": "classicBond" }
```

Novo.

### `onLog`

```ts
interface LogEvent {
	ts: number; // epoch millis
	level: "DEBUG" | "INFO" | "WARN" | "ERROR";
	tag: string; // "Classe/metodo", ou "Frame/<uuid curto>" para pacotes GATT
	message: string;
	dir: "TX" | "RX" | "READ" | null; // só para pacotes GATT; "READ" é o valor devolvido por uma leitura GATT
	hex: string | null; // bytes do pacote em hex maiúsculo, só para pacotes GATT
}
```

```json
{
	"ts": 1793208600000,
	"level": "DEBUG",
	"tag": "Frame/6e400002",
	"message": "seq=3 02/01 SET_TIME len=4 crc=ok len=17",
	"dir": "TX",
	"hex": "AB000009CD2F000302000100046AB8E780"
}
```

O exemplo é o frame SET_TIME de 2026-10-28 14:30:00 (vetor dourado do Repo 1); o texto de `message` vem do driver e
pode mudar. Cada pacote é um fragmento como foi escrito ou notificado, não o frame remontado: com MTU 23 o cabeçalho
de RX chega sozinho, e a linha `Frame/` de RX não traz `cmd/key` nem CRC. O resumo de cada frame remontado sai numa
entrada `DEBUG` à parte, com tag `SmaDriver/frame`, `dir`/`hex` nulos e `message` `TX seq=<n> <rótulo> len=<n>` ou
`RX seq=<n> <rótulo> len=<n> crc=ok` (só frames de dados; ACK e NACK ficam nas linhas `Frame/`). `onLog` não passa
pela fila de eventos pendentes: o que acontecer antes de o JS se inscrever se recupera com `getLogs`. No Condor
Reebok, as leituras GATT (versão em `2a29`, firmware em `2a28`, bateria em `2a19`, passos do dia em `fee1`) saem com
`dir: "READ"` e tag `Frame/<uuid curto>`; o resumo de cada frame vem do `CrpDriver` do Repo 1. Novo.

## Constantes

Exportadas na raiz e, as duas primeiras, também em `TechnosCore` (como no Core atual).

### `deviceConnectStates`

`{ inDFU: -2, unknown: -1, disconnect: 0, connecting: 1, connected: 2, disconnectOnActivity: 3,
disconnectedBluetoothOff: 4 }`. Iguais ao Core atual (`TechnosWareCore/src/NativeModules/index.ts:22-30`).

### `deletedCategory`

`{ SLEEP: 0, ACTIVITY: 1, STRESS: 2, SPO2: 3, HEART_HERT: 4, PEDOMETER: 5, ACTIVITY_MONITOR: 6, CALORIE: 7,
BODY_ENERGY: 8 }`. Iguais ao Core atual (`index.ts:33-43`), inclusive o nome `HEART_HERT`. Só `PEDOMETER` e `SLEEP`
têm efeito.

### `errorCodes`

| Código | Origem | Quando |
|---|---|---|
| `NOT_READY` | sessão | comando ao relógio fora de `READY`/`SYNCING` |
| `UNSUPPORTED_DEVICE` | sessão/host | `name` ou perfil desconhecido |
| `CONNECT_TIMEOUT` | sessão | o link não abriu em 30 s no primeiro pareamento |
| `GATT_NOT_SUPPORTED` | sessão | nenhum serviço GATT do perfil (`FF60` ou NUS `6E400001`) |
| `HANDSHAKE_FAILED` | sessão | BIND ou LOGIN recusados ou sem resposta |
| `TIMEOUT` | sessão | sem ACK ou resposta no tempo do perfil (4 s por comando) |
| `PROTOCOL` | sessão | frame com CRC ou estrutura inválidos |
| `NO_DATA` | sessão/host | sem registros (sono) |
| `TRANSPORT` | sessão/host | operação GATT ou scan falhou no Android |
| `DISCONNECTED` | sessão | o link caiu com o comando em andamento |
| `PAIRING_REMOVED` | sessão | o telefone guarda um vínculo Bluetooth que o relógio apagou; só a pessoa resolve, esquecendo o relógio nas configurações de Bluetooth (no iPhone, Ajustes → Bluetooth). Hoje só o iOS detecta (`CBError.peerRemovedPairingInformation`) |
| `CANCELLED` | sessão/host | cancelado por desconexão, `forgetDevice`, reload do JS ou por um `pairDevice`/`startPairingAttempt` mais novo |
| `BUSY` | reservado | a sessão não emite: um pareamento novo cancela o anterior com `CANCELLED` (ADR 13 do Repo 1) |
| `NOT_SUPPORTED` | sessão | o modelo conectado não tem o ajuste ou a ação (fase 2: todos no fitGPS e no Life Ultra GPS, e o `resetDevice` neles); nada é escrito no relógio, e desconectado vale o `NOT_READY`. No Core atual, a rejeição `"-1"`/`"Not implemented"` |
| `PERMISSION_DENIED` | host | falta `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` (API 31+) ou localização (API 30-); no iOS, Bluetooth negado ao app (`"Missing Bluetooth"`) |
| `BLUETOOTH_OFF` | host | Bluetooth do telefone desligado |
| `INVALID_ARGUMENT` | host | `deviceId` não é MAC (Android) nem UUID (iOS); argumento malformado de um método da fase 2 (campo obrigatório ausente, faixa, `"HH:mm"`, unidade ou gênero desconhecidos), sempre com `requestId` -1 e antes de falar com o relógio |
| `IO_ERROR` | host | falha de arquivo (histórico local, exportação) |
| `CLASSIC_BOND_FAILED` | host | o vínculo Bluetooth clássico do Condor Reebok (chamadas e música) não saiu: duas tentativas sem sucesso (diálogo do sistema recusado ou sem resposta em 45 s cada); um pedido cancelado pelo `forgetDevice` não sai aqui. Só em `onError`, com `requestId` -1 e `method: "classicBond"`; nenhuma Promise rejeita e o BLE continua pronto. Não é pedido de novo até o próximo `pairDevice`. Nunca sai no iPhone |

Os da sessão (catorze, com o `NOT_SUPPORTED` da fase 2) são os de `WatchErrorCodes.kt` (`:protocol`, Repo 1); os do host
(cinco), os de `HostErrorCodes.kt` (`:bridge`, Repo 1).

### `logLevels`

`{ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }`, na ordem do `LogLevel` do Repo 1.

### `technosEventNames`

Os 17 nomes de evento na ordem do spec (os 4 da fase 2 entre `onSyncFinished` e `onError`). Útil para inscrever em todos
(o app de exemplo e o mock usam).

## utils

### `utils.events.getNativeEventData<T>(emitter, timeoutMs?): Promise<T>`

Mesma semântica do Core atual (`TechnosWareCore/src/utils/events.ts:3-20`):

- inscreve na chamada; resolve com o primeiro evento e remove a inscrição;
- com `timeoutMs > 0`, rejeita com `Error("Timeout Error: getDataFromWatch - <nome do emissor>")` e remove a
  inscrição;
- sem `timeoutMs` (ou `0`), espera indefinidamente.

Não sabe da Promise do comando: se o comando rejeitar, a espera só termina no timeout.

### `utils.events.requestNativeEventData<T>(emitter, command, timeoutMs?): Promise<T>`

Novo. Faz o padrão "comando + evento" sem perder evento nem deixar inscrição pendurada: inscreve, chama `command()`,
resolve com o primeiro evento; se `command` rejeitar (ex.: `NO_DATA`), rejeita com o mesmo erro (com `code`); se o
tempo estourar, rejeita como `getNativeEventData`. O tempo conta a partir da chamada.

```ts
try {
	const sleep = await utils.events.requestNativeEventData(
		TechnosEvents.onHistorySleep,
		() => TechnosCore.getHistorySleep(),
		20000,
	);
} catch (error) {
	if (utils.errors.getErrorCode(error) === errorCodes.NO_DATA) {
		// sem sono gravado
	}
}
```

### `utils.errors.getErrorCode(error): ErrorCode | null`

Código do módulo (`"TIMEOUT"`...) de um erro qualquer, ou `null` se não veio do nativo (o timeout de
`getNativeEventData`, por exemplo). `utils.errors.isTechnosCoreError(error)` é a versão booleana com type guard.

### `utils.savedData.groupSavedItemsByCategory(items): SavedItemsGroup[]`

O agrupamento que `deletedSavedData` usa, exposto para teste.

### `utils.promise.observed<T>(promise): Promise<T>`

Novo. Pendura um `.catch` vazio na Promise e devolve a mesma Promise: quem faz `await` recebe a rejeição normalmente;
quem não faz não gera "Possible unhandled promise rejection". É o que os métodos da fase 2 e o `resetDevice` já fazem
(regra 3); serve para um wrapper do app que repassa a Promise do `TechnosCore`.

## Tipos

Todos os tipos de `src/types/events.ts` e `src/types/emitter.ts` são reexportados. Para trocar de pacote sem renomear,
há apelidos com os nomes do Core atual (`src/types/compat.ts`): `TechnosScannedDevice`, `TechnosConnectStateChanged`,
`TechnosFirmwareInfo`, `TechnosBatteryStatus`, `TechnosPedometer`, `TechnosPedometerHistory`,
`TechnosPedometerHistoryOfDate`, `TechnosSleepHistory`, `TechnosSleepHistoryDay`, `TechnosSleepHistoryDayInfo`,
`TechnosSleepHistoryDayInfoItem`, `TechnosSleepHistoryDayRespiratoryRateItem`, `TechnosSyncProgress`,
`TechnosSavedItemDelete` e, na fase 2, `TechnosFindPhoneStatus`.

Os tipos de entrada da fase 2 (`src/types/watchSettings.ts`) têm os nomes e os campos do Core (`watchSettings.ts` e
`device.ts` do `v4.3.57`) e são exportados da raiz: `TechnosUserInfoSet`, `TechnosGoalsSet`,
`TechnosDistanceUnitUpdate`, `TechnosGestureControlSetV2`, `TechnosMenstrualDataUpdate`, `TechnosMenstrualHistoryEntry`,
`TechnosStressAutomaticUpdate`, `TechnosNotDisturbSet`, `TechnosWaterReminderUpdate`, `TechnosWalkReminderUpdate`,
`TechnosAlarmSet`, `TechnosWorldClockSet`, `TechnosManageNotificationsUpdate`, `TechnosContactItem` (o Core não o
exporta da raiz) e `TechnosWeatherListUpdateItem`, mais `TechnosRepeatWeekdays` (nome novo para o objeto de dias que o
Core repete dentro de cada tipo). Diferenças: `TechnosMenstrualDataUpdate` tem `reminder?` a mais (o app Condor já o
manda) e `TechnosWalkReminderUpdate.notifyType` é `number` (no Core, o enum `NotifyType`: 1 alerta, 2 silencioso;
DP-77 do [`desvios-de-producao.md`](desvios-de-producao.md)). O caminho profundo que o app Condor importa
(`react-native-technos-ware-core/src/NativeModules/type/watchSettings`) fica para a fase 4.

## Mock oficial para Jest

`src/__mocks__/react-native-technos-core-next.ts` troca o TurboModule (que não existe no Jest) por `jest.fn` e
emissores em memória, com os mesmos nomes exportados. Constantes e `utils` são os reais.

```js
// jest.setup.js do app
jest.mock("react-native-technos-core-next", () =>
	require("react-native-technos-core-next/src/__mocks__/react-native-technos-core-next"),
);
```

```ts
import { act } from "react-test-renderer";
import {
	TechnosCore,
	mockEmit,
	mockListenerCount,
	mockReset,
} from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";

beforeEach(() => mockReset());

it("mostra a bateria", () => {
	// ...renderizar o componente
	act(() => mockEmit("onBatteryStatus", { percentage: 80, charging: false, battery: "80%" }));
	expect(TechnosCore.getBatteryStatus).toHaveBeenCalled();
});
```

- Padrões: comandos `Promise<void>` resolvem (inclusive os aliases `initSMASDK` e `initCRPSDK`, os 23 da fase 2 e o
  `resetDevice`); `isConnected` → `false`; `getLastPairedDevice` → `null`; `getLogs` → `[]`; `exportLogs` →
  `MOCK_EXPORT_PATH`. O mock não passa as Promises por `observed`: uma rejeição configurada no teste chega ao app como
  veio.
- `mockEmit(nome, payload)` chama os handlers inscritos (tipado pelo nome do evento).
- `mockListenerCount(nome)` ajuda a verificar que um componente removeu as inscrições.
- `mockReset()` remove os handlers e restaura os padrões (use se o app tiver `resetMocks: true`).

O app de exemplo usa outro caminho: `example/jest.config.js` aponta o nome do pacote direto para o mock.

## Migração do app Mormaii

O que muda ao trocar `react-native-technos-ware-core` por este pacote no `Smartwatch.ts` (só para o fitGPS):

1. `disconnectCurrentDevice` do "esquecer relógio" vira `forgetDevice()`; `disconnectCurrentDevice` agora só
   desconecta.
2. `pairDevice`, `startPairingAttempt` e os comandos de leitura devolvem Promise que pode rejeitar: trate ou ignore
   com `.catch(() => {})` para não gerar "Possible unhandled promise rejection".
3. `onPedometer.pedometer` passa a ser o total de hoje; `onCalories`/`onDistance` não existem (os valores estão no
   próprio `onPedometer`).
4. `onHistoryPedometer.date` passa a ser o início do dia também no Android.
5. `getHistorySleep` agora responde (`onHistorySleep`, ou `NO_DATA` na Promise **e** em `onError`); o `shouldSyncSleep`
   do app hoje sincroniza sono do fitGPS por engano (`useSyncStepsRunner.ts:81`), então vale decidir se o sono do
   fitGPS deve ir ao backend.
6. `syncDataHistory` passa a falar com o relógio e pode rejeitar; `onSyncFinished` só chega no sucesso. O primeiro
   sync observado levou 59 s, acima do watchdog de 50 s do app ([`pendencias.md`](pendencias.md)).
7. A reconexão ao abrir o app passa a ser nativa (`initialize` e volta ao primeiro plano); o `useSdkInit` pode
   continuar chamando `pairDevice(lastDevice)`, mas isso faz um handshake completo. `startPairingAttempt` é o
   equivalente sem BIND.
8. `deletedSavedData` continua com o mesmo formato; listas com mais de uma categoria passam a funcionar.

## Migração do app Condor

O que muda ao trocar `react-native-technos-ware-core` (`v4.3.57`) por este pacote no app Condor, para o Condor Reebok. A
troca é a fase 4; esta lista vale desde a fase 2. Fontes do app: `GTE-CondorSmart/src/...`, só leitura. Cada diferença
de comportamento em relação à produção também está em [`desvios-de-producao.md`](desvios-de-producao.md), com como
reverter.

1. **Nomes, argumentos e tipos iguais.** Os 23 métodos da fase 2 e os 4 eventos têm os nomes, os argumentos e os
   payloads do Core, e os tipos de entrada são exportados da raiz com os mesmos nomes. As referências diretas do
   `Smartwatch.ts` (`export const setNotDisturb = TechnosCore.setNotDisturb` e as outras) continuam válidas. O caminho
   profundo dos tipos (`react-native-technos-ware-core/src/NativeModules/type/watchSettings`, `Smartwatch.ts:19-25`) não
   existe aqui: alias de pacote ou ajuste do import na fase 4.
2. **Tudo devolve Promise, e toda Promise termina.** `syncWeather`, `vibrateDevice`, `openCameraMode`, `closeCameraMode`
   e `resetDevice` são `void` no Core e aqui `Promise<void>` (atribuível a `() => void`). Os outros já eram Promise, mas
   agora sempre terminam, com prazo, e podem rejeitar (`NOT_READY`, `TIMEOUT`, `PROTOCOL`, `INVALID_ARGUMENT`,
   `DISCONNECTED`, `CANCELLED`). No sync de ajustes, cada rejeição vira um `crashlytics().recordError`
   (`useUserSettingsSyncHandler.ts:104-110`); no Core, alguns caminhos nunca terminavam e travavam o sync.
3. **Chamadas sem `await`.** As chamadas diretas ao `TechnosCore` sem `await` (`setUserInfo` no `Smartwatch.ts:57-59`,
   `syncWeather` no `useWeatherData`, `vibrateDevice`, `openCameraMode` e `closeCameraMode` no `useCameraData`) não
   geram aviso (`observed`, regra 3). Os wrappers `async` do `Smartwatch.ts` (`setGoalsV2`, `setMovementReminder`,
   `setSosHelp`...) criam outra Promise: onde o app os chama sem `await` (os `onHide` das telas e as quatro chamadas
   dentro do `.then` em `DeviceConnectedSuccessfully/index.tsx:78-85`), uma rejeição ainda gera "Possible unhandled
   promise rejection" no debug. O release do RN é silencioso e o app não tem rastreador global: custo aceito. Para
   silenciar, `.catch(() => {})` nesses pontos.
4. **`closeCameraMode` desconectado** resolve sem escrever: o blur da tela de câmera continua sem erro.
5. **`onOpenCameraMode` passa a chegar no Android.** O Core Android do Condor nunca emitia, e o `getNativeEventData` de
   10 s do `useCameraData` sempre estourava sem catch.
6. **`onFindPhone` passa a disparar no P85**, com `{ status: "1" | "0" }`: o handler do
   `useWatchInfoData/index.ts:166-209` (o `alarm.mp3` 2 s depois) passa a rodar. O nativo não toca, não vibra, não abre
   tela cheia e não acende a lanterna, como o Core antigo fazia; com o app em segundo plano, só chega com o processo
   vivo.
7. **`syncWeather` só manda a lista que o app monta.** Sem o `getCurrentGeolocation` (fase 4), o app Condor chama
   `syncWeather([])` (`useWeatherData/index.ts:14-17, 60-70`) e nenhum clima chega ao relógio. Depois de um
   `setTemperatureUnit`, o nativo reenvia o último clima, como o Core antigo.
8. **`manageNotifications` é só o filtro no relógio.** No iPhone isso basta (ANCS). No Android, o encaminhamento de
   notificações do Core antigo ainda não existe: o Condor Android para de mostrar notificações no relógio até a fatia do
   encaminhamento entrar
   ([`pendencias.md`](pendencias.md#8-fase-2-do-condor-reebok-o-que-fica-fora-e-o-que-falta-validar)). Enquanto isso, o
   `checkIsNotificationServiceEnabled` do Android vai resolver `true` (camada de compatibilidade da fase 4), para o
   banner da Home e a tela de acesso do primeiro pareamento não pedirem uma permissão que não serve para nada.
9. **Stubs que resolvem sem tráfego** (camada de compatibilidade da fase 4): `manageMusicOption`, `setSportPlate`,
   `setDeviceShortcuts`, `setSportParameter`, `setAutomaticScreenBrightness`, `setAutomaticActivity`,
   `setSedentaryMode`, `setSpo2AutomaticCheck` e `setFindTelephoneControl`, que o Core CRP resolvia sem falar com o
   relógio. Os outros nomes que o app referencia e que não existem aqui vão rejeitar `NOT_SUPPORTED` pelo nativo, com
   `onError`.
10. **Controle de música.** O Core Android respondia aos botões de música do relógio pelo BLE (RX `67`) e mandava o
    título e o estado pelo `NotificationListener`; aqui o `67` não é decodificado e o `manageMusicOption` vira stub. A
    suposição é que o P85 controla a música pelo AVRCP do vínculo clássico; a validação confirma.
11. **Ajuste rejeitado não é reenviado.** Desconectado, `NOT_READY`, e nada é guardado. O app Condor só reenvia a
    maioria dos ajustes no sync completo (o primeiro de cada relógio, ou com "sempre sincronizar tudo"); nos parciais,
    só frequência cardíaca, estresse, metas, SOS e ciclo, e o perfil no fim de todo sync
    (`useSyncStepsRunner.ts:154-158`). Um ajuste rejeitado (`NOT_READY`, `TIMEOUT` ou `PROTOCOL`) fica diferente no
    relógio até lá, como já acontece na produção.
12. **Esquecer e reset são separados.** O `disconnectCurrentDevice` do Core do Condor reseta e esquece; aqui o
    `disconnectCurrentDevice` só desconecta, o `forgetDevice` esquece sem resetar e o `resetDevice` reseta sem esquecer.
    O adaptador escolhe o que cada botão chama; para os dois, o reset vem antes.
13. **Ajustes depois do sync.** Os ajustes rodam na fila depois do sync, e um `vibrateDevice` durante o sync espera o
    fim. No Android, o serviço em primeiro plano do sync termina no `onSyncFinished`: os ajustes que o app manda logo
    depois rodam sem ele e, com o app em segundo plano, podem atrasar ou cair.
14. **Permissões e dados que vinham do Core antigo** (fase 4): o `READ_CONTACTS` e as outras permissões que hoje entram
    pelo manifesto do Core vão para o manifesto do app Condor; o `technosAssets.IANA_TIMEZONE_INFO_LIST` (lista do
    relógio mundial) e a lista de notificações por modelo (`getNotificationListByModel`) precisam existir no JS.
15. **Métodos da fase 1 que eram `void`.** `pairDevice`, `disconnectCurrentDevice`, `getBatteryStatus`,
    `getFirmwareInfo`, `getHistoryPedometer`, `syncDataHistory` e `getHistorySleep` são `void` no Core e aqui devolvem
    Promise que pode rejeitar, **sem** o `observed` (regra 3). O app Condor chama todos sem `await`
    (`Smartwatch.ts:62-74, 168, 197, 201`): no debug, uma rejeição (o `NO_DATA` do `getHistorySleep` num sync sem noite,
    o `NOT_READY` de um `getBatteryStatus` desconectado) gera "Possible unhandled promise rejection". Para silenciar,
    `.catch(() => {})` nesses pontos ou `observed` no wrapper (DP-93; a escolha fica para a fase 4).
16. **Scan mais curto.** O `scan()` procura por 7 s e emite cada relógio uma vez por busca; o Core do Condor procurava
    por 20 s (10 s no iOS) e emitia a cada anúncio, e a tela de busca espera 20 s
    (`screensV2/pairing/SearchingDevices/index.tsx:40-44`). Um P85 que demore mais de 7 s para aparecer fica de fora
    (DP-92); o adaptador pode chamar `scan()` de novo até os 20 s.
17. **Sync só com passos e sono até a fase 3.** O `syncDataHistory` não lê frequência cardíaca, estresse nem
    atividades, que o Core do Condor pedia em todo sync; os históricos desses dados no app não recebem nada do relógio
    até a fase 3 (DP-94).
18. **Argumentos conferidos antes do relógio.** Os dicionários são lidos pelo `SettingsMapper` do Repo 1, mais estrito
    que os dois Cores: campo obrigatório ausente, valor fora da faixa, `"HH:mm"` fora do formato, gênero ou unidade
    desconhecidos e campos mal formados que o Condor Reebok ignora (janelas, dias) rejeitam `INVALID_ARGUMENT` (no sync
    de ajustes, um evento no Crashlytics), onde a produção aceitava, caía num padrão ou lançava exceção nativa. Os
    formatos que o app Condor manda hoje passam, inclusive o gênero vazio (vale `"o"`). DP-95 a DP-97.

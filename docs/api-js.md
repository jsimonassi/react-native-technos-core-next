# API JavaScript

Referência de tudo o que `react-native-technos-core-next` exporta: métodos de `TechnosCore`, eventos de
`TechnosEvents`, constantes, `utils` e o mock oficial para Jest. Para cada item: assinatura, quando resolve ou
rejeita, formato do payload com exemplo e o equivalente no Core atual (`react-native-technos-ware-core` 4.4.3),
com as diferenças.

Fontes do contrato: `src/specs/NativeCoreNext.ts` (TurboModule), `src/types/events.ts` (payloads), `src/index.ts`
(wrapper). O caminho de cada chamada no Android está em [`arquitetura.md`](arquitetura.md#comandos-promises-e-eventos).
Mudou o spec ou um payload, atualize este arquivo no mesmo PR.

O que cada método faz do lado nativo mora no `CoreBridge` do `:bridge` do Repo 1 (o TurboModule Android só o chama;
[`arquitetura.md`](arquitetura.md#o-que-mora-onde)), e o iOS vai usar o mesmo código. O contrato descrito aqui não
mudou com essa troca: mesmos métodos, eventos, payloads, ordem e rejeições.

Escopo da PoC: família SMA (Mormaii fitGPS), só Android. No iOS o import falha, porque
`TurboModuleRegistry.getEnforcing("NativeCoreNext")` não acha o módulo (ver `ios-pendente.md`).

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
4. **Inscreva antes de chamar.** Eventos emitidos sem ninguém inscrito se perdem, como em qualquer `EventEmitter` do
   RN. O nativo guarda até 500 eventos enquanto o JS ainda não existe, exceto `onLog`
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
| `scan()` | `void` | não (scan BLE) | `onScannedDevice` | `scan` |
| `stopScan()` | `void` | não | — | não existe |
| `pairDevice(deviceId, name)` | `Promise<void>` | sim | `onConnectStateChanged` | `pairDevice` (`void`) |
| `startPairingAttempt(deviceId, name)` | `Promise<void>` | sim | `onConnectStateChanged` | `startPairingAttempt` (`void`) |
| `disconnectCurrentDevice()` | `Promise<void>` | sim | `onConnectStateChanged` | `disconnectCurrentDevice` (semântica diferente) |
| `forgetDevice()` | `Promise<void>` | sim | `onConnectStateChanged` | `disconnectCurrentDevice` |
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

`TechnosCore` também carrega as constantes `deviceConnectStates`, `deletedCategory`, `errorCodes` e `logLevels`
(as duas primeiras no mesmo lugar do Core atual).

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

### `scan(): void`

Procura relógios por 7 s (`BleScanner.SCAN_DURATION_MS`, o mesmo tempo do Core atual, `SMAService.java:625-635`).
Cada relógio de um modelo conhecido vira um [`onScannedDevice`](#onscanneddevice), uma vez por endereço por busca
(o Core atual emite a cada anúncio); chamar `scan()` de novo recomeça a lista. Não há evento de fim de busca.

- Falhas não lançam: saem em `onError` com `method: "scan"` e `requestId: -1`. Códigos: `PERMISSION_DENIED` (falta
  `BLUETOOTH_SCAN`, ou localização na API 30-), `BLUETOOTH_OFF`, `TRANSPORT` (o scan do Android falhou; o
  `errorCode` vai na mensagem).
- Core atual: `scan()` (`NativeCore.ts:14`), sem filtro de serviço e sem aviso de falha.

### `stopScan(): void`

Interrompe a busca antes dos 7 s. Novo.

### `pairDevice(deviceId: string, name: string): Promise<void>`

Primeiro pareamento: conexão direta, descoberta de serviços, notificações, MTU e handshake completo (BIND e LOGIN no
SMA). Use os campos `deviceId` e `name` de um `onScannedDevice`.

- Resolve: quando a sessão chega em `READY` (o mesmo momento do `onConnectStateChanged` com `state: 2`). O BIND
  espera até 60 s pela confirmação na tela do relógio (`Quirks.bindTimeoutMs` do perfil fitGPS, `Profiles.kt`).
- Rejeita na hora: `PERMISSION_DENIED` (falta `BLUETOOTH_CONNECT`), `BLUETOOTH_OFF`, `INVALID_ARGUMENT` (`deviceId`
  não é MAC), `UNSUPPORTED_DEVICE` (`name` desconhecido).
- Rejeita depois: `CONNECT_TIMEOUT` (30 s sem abrir o link, `Quirks.connectTimeoutMs`), `GATT_NOT_SUPPORTED`,
  `HANDSHAKE_FAILED`, `DISCONNECTED`, `TRANSPORT`, `CANCELLED`. Não existe `BUSY`: um `pairDevice` ou
  `startPairingAttempt` novo cancela o pedido anterior, que rejeita com `CANCELLED` (ADR 13 do Repo 1).
- O relógio pareado é salvo ao chegar em `READY` (`getLastPairedDevice` passa a devolvê-lo).
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

Reconecta a um relógio já pareado: conexão pendente sem timeout e handshake curto (só LOGIN no SMA).

- Resolve: assim que a reconexão é pedida. A conexão de fato é anunciada por `onConnectStateChanged` e pode levar
  horas se o relógio estiver longe.
- Rejeita na hora pelos mesmos motivos de `pairDevice` (`PERMISSION_DENIED`, `BLUETOOTH_OFF`, `INVALID_ARGUMENT`,
  `UNSUPPORTED_DEVICE`). Falhas posteriores só aparecem em `onError` com `method: "startPairingAttempt"`.
- Se o relógio **recusar** o LOGIN (desvinculado na própria tela, ou vinculado a outro telefone), a sessão desiste:
  `onConnectStateChanged` vai para desconectado e sai `onError` com `HANDSHAKE_FAILED`. A reconexão nunca refaz o
  BIND sozinha (ele pode pedir confirmação na tela do relógio); o app deve oferecer um `pairDevice`. Falta de
  resposta e quedas continuam tentando, com espera crescente (ADR 11 do Repo 1).
- Core atual: `startPairingAttempt(deviceId, name): void` (`NativeCore.ts:16`); no SMA equivale a `pairDevice`.

### `disconnectCurrentDevice(): Promise<void>`

Desconecta e para de reconectar até o próximo `pairDevice`/`startPairingAttempt` (ou até o processo reiniciar). O
pareamento salvo e o histórico local continuam.

- Resolve: quando a sessão volta a `DISCONNECTED`.
- **Diferença importante:** no Core atual, `disconnectCurrentDevice` (`NativeCore.ts:18`) também desfaz o vínculo no
  relógio e apaga dados: no Android `close` + `unbind` + `clearAllData` (`SMAService.java:663-671`), no iOS
  `relieveWatchBound` e apaga o `NSUserDefaults` inteiro do app (`SMAService.m:141-157`). Esse comportamento agora é
  o `forgetDevice()`.

### `forgetDevice(): Promise<void>`

Desconecta, desfaz o vínculo no relógio (UNBIND `03/05`, se conectado), apaga o pareamento salvo e o histórico local.

- Resolve: quando a sessão volta a `DISCONNECTED`.
- Core atual: é o que `disconnectCurrentDevice` faz lá (ver acima). O app Mormaii chama `disconnectCurrentDevice` no
  "esquecer relógio" (`usePairingData`, `disconnectDevice`): ao trocar de pacote, essa chamada vira `forgetDevice`.

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

Lê firmware e identificação (comando VERSION `02/0A`). Emite [`onDeviceInfo`](#ondeviceinfo) e resolve em seguida.
Rejeita com `NOT_READY`, `TIMEOUT`, `DISCONNECTED`.

- Core atual: `getDeviceInfo(): void` (`NativeCore.ts:50`). No SMA Android manda o comando de leitura de alarme e
  não emite nada (`SMAService.java:1016-1018`); no iOS não faz nada (`SMAService.m:163-165`).

### `getFirmwareInfo(): Promise<void>`

Mesma leitura de `getDeviceInfo`, mas emite [`onFirmwareInfo`](#onfirmwareinfo), no formato do Core atual.

- Core atual: `getFirmwareInfo(): void` (`NativeCore.ts:51`).

### `getBatteryStatus(): Promise<void>`

Lê a bateria (comando `02/08`). Emite [`onBatteryStatus`](#onbatterystatus) e resolve. Rejeita com `NOT_READY`,
`TIMEOUT`, `DISCONNECTED`.

- Core atual: `getBatteryStatus(): void` (`NativeCore.ts:64`). No iOS o `percentage` sai com lixo, porque o
  `NSDictionary` é passado onde se espera `NSInteger` (`SMAService.m:1237-1243`).

### `setTime(): Promise<void>`

Acerta o relógio com a hora local de parede do telefone (comando `02/01`). A sessão também faz isso sozinha depois
de cada conexão (passados `Quirks.postLoginDelayMs`, 3 s no fitGPS).

- Resolve: no ACK do relógio. Rejeita com `NOT_READY`, `TIMEOUT`, `DISCONNECTED`.
- Core atual: não existe no JS; o Android acerta a hora 3 s depois do login (`SMAService.java:270-295`).

### `refreshSteps(): Promise<void>`

Lê os passos recentes do relógio (`05/41`), grava no histórico local e emite [`onPedometer`](#onpedometer) com o
total de hoje. Resolve depois do evento.

- Core atual: não existe; o Android faz polling de 10 s com `readData([SPORT, ...])` (`SMAService.java:547-603`) e o
  iOS a cada 1 s (`SMAService.h:23`).

### `syncDataHistory(): Promise<void>`

Lê o histórico do relógio (passos `05/41` e sono `05/45`) e grava no armazenamento local, com deduplicação. Enquanto
roda, a sessão fica em `SYNCING` (o `state` continua 2) e um serviço em primeiro plano mantém o processo vivo.

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
o sono do fitGPS nunca foi validado em produção.

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

- `frames-<yyyyMMdd-HHmmss>.jsonl`: gravação de todos os pacotes GATT TX/RX desde o último `clearLogs`, no formato de
  fixture do `technos-watch-protocol` (cabeçalho + uma linha por pacote, `FrameJsonl.kt`). Vira
  `fixtures/real/fitgps/<fw>/*.jsonl` no Repo 1.
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

## Eventos

Todos em `TechnosEvents`, com a forma `TechnosEventEmitter<T>`: `const sub = TechnosEvents.onX(handler);
sub.remove();`. Tipos em `src/types/events.ts`.

| Evento | Payload | Quando | Core atual |
|---|---|---|---|
| `onScannedDevice` | `ScannedDeviceEvent` | durante `scan()` | igual, mais `bleName` e `profileId` |
| `onConnectStateChanged` | `ConnectStateChangedEvent` | toda mudança de estado | igual, mais `sessionState` e `phase` |
| `onDeviceInfo` | `DeviceInfoEvent` | `getDeviceInfo()` | não existe para SMA |
| `onFirmwareInfo` | `FirmwareInfoEvent` | `getFirmwareInfo()` | igual (`deviceId` agora preenchido) |
| `onBatteryStatus` | `BatteryStatusEvent` | `getBatteryStatus()` | igual |
| `onPedometer` | `PedometerEvent` | `refreshSteps()`, aviso do relógio | `pedometer` muda de significado |
| `onHistoryPedometer` | `HistoryPedometerEvent` | `getHistoryPedometer()` | igual ao Core iOS |
| `onHistorySleep` | `HistorySleepEvent` | `getHistorySleep()` | nunca emitido para SMA |
| `onSyncStarted` | `{}` | início do sync | simulado |
| `onSyncProgress` | `SyncProgressEvent` | por etapa do sync | simulado |
| `onSyncFinished` | `{}` | fim do sync | simulado |
| `onError` | `ErrorEvent` | toda falha | não existe |
| `onLog` | `LogEvent` | cada entrada do log | não existe |

### `onScannedDevice`

```ts
interface ScannedDeviceEvent {
	name: string; // appName do perfil: "fitGPS"
	deviceId: string; // MAC
	rssi: number;
	bleName: string; // nome anunciado: "Mormaii_fitGPS" (novo)
	profileId: string; // "fitgps" (novo)
}
```

```json
{ "name": "fitGPS", "deviceId": "D4:3B:04:11:22:33", "rssi": -62, "bleName": "Mormaii_fitGPS", "profileId": "fitgps" }
```

Core atual: `{ name, deviceId, rssi }` com `name = "fitGPS"` (`SMAService.java:505-526`). O app Mormaii filtra por
`ALLOWED_DEVICE_NAMES.includes(name)` (`GTE-Mormaii/src/constants/index.ts:138-148`), que continua valendo.

### `onConnectStateChanged`

```ts
interface ConnectStateChangedEvent {
	state: number; // deviceConnectStates
	sessionState: string; // estado detalhado da sessão (novo)
	phase: string | null; // "BIND" ou "LOGIN" durante o handshake (novo)
}
```

```json
{ "state": 1, "sessionState": "HANDSHAKING", "phase": "BIND" }
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
	bleVersion: string | null; // o SMA não informa: null
}
```

```json
{ "deviceId": "D4:3B:04:11:22:33", "profileId": "fitgps", "bleName": "Mormaii_fitGPS", "firmware": "1.0.7", "bleVersion": null }
```

Novo. Quando o relógio manda a versão sem pedido (`requestId -1`), saem `onDeviceInfo` e `onFirmwareInfo`.

### `onFirmwareInfo`

```ts
interface FirmwareInfoEvent {
	version: string;
	braceletType: number; // 0 no fitGPS
	platformCode: number; // 0 no fitGPS
	deviceId: string;
}
```

```json
{ "version": "1.0.7", "braceletType": 0, "platformCode": 0, "deviceId": "D4:3B:04:11:22:33" }
```

Core atual: `TechnosFirmwareInfo { version, braceletType: 0, platformCode: 0, deviceId?: number }`
(`SMAService.java:241-244`, `EventHandler.kt:275-287`). Diferença: `deviceId` é sempre preenchido e é string (MAC).

### `onBatteryStatus`

```ts
interface BatteryStatusEvent {
	percentage: number; // 0 a 100
	charging: boolean; // o SMA não informa: sempre false
	battery: string; // legado, "85%"
}
```

```json
{ "percentage": 85, "charging": false, "battery": "85%" }
```

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

Core atual: `{ pedometer }`, com o `step` do registro mais recente lido pelo polling, não o total do dia
(`SMAService.java:387-456`); calorias e distância saem em eventos separados (`onCalories`, `onDistance`), que não
existem aqui. Calorias e distância usam o mesmo perfil fixo do Core atual (60 kg, 173,5 cm).

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

Sai para toda Promise rejeitada e para falhas sem Promise (`scan`, reconexão automática, aviso do relógio). Novo.

### `onLog`

```ts
interface LogEvent {
	ts: number; // epoch millis
	level: "DEBUG" | "INFO" | "WARN" | "ERROR";
	tag: string; // "Classe/metodo", ou "Frame/<uuid curto>" para pacotes GATT
	message: string;
	dir: "TX" | "RX" | null; // só para pacotes GATT
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
pela fila de eventos pendentes: o que acontecer antes de o JS se inscrever se recupera com `getLogs`. Novo.

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
| `CANCELLED` | sessão/host | cancelado por desconexão, `forgetDevice`, reload do JS ou por um `pairDevice`/`startPairingAttempt` mais novo |
| `BUSY` | reservado | a sessão não emite: um pareamento novo cancela o anterior com `CANCELLED` (ADR 13 do Repo 1) |
| `PERMISSION_DENIED` | host | falta `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` (API 31+) ou localização (API 30-) |
| `BLUETOOTH_OFF` | host | Bluetooth do telefone desligado |
| `INVALID_ARGUMENT` | host | `deviceId` não é MAC |
| `IO_ERROR` | host | falha de arquivo (histórico local, exportação) |

Os da sessão são os de `WatchErrorCodes.kt` (`:protocol`, Repo 1); os do host, os de `HostErrorCodes.kt` (`:bridge`,
Repo 1).

### `logLevels`

`{ DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }`, na ordem do `LogLevel` do Repo 1.

### `technosEventNames`

Os 13 nomes de evento na ordem do spec. Útil para inscrever em todos (o app de exemplo e o mock usam).

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

## Tipos

Todos os tipos de `src/types/events.ts` e `src/types/emitter.ts` são reexportados. Para trocar de pacote sem renomear,
há apelidos com os nomes do Core atual (`src/types/compat.ts`): `TechnosScannedDevice`, `TechnosConnectStateChanged`,
`TechnosFirmwareInfo`, `TechnosBatteryStatus`, `TechnosPedometer`, `TechnosPedometerHistory`,
`TechnosPedometerHistoryOfDate`, `TechnosSleepHistory`, `TechnosSleepHistoryDay`, `TechnosSleepHistoryDayInfo`,
`TechnosSleepHistoryDayInfoItem`, `TechnosSleepHistoryDayRespiratoryRateItem`, `TechnosSyncProgress`,
`TechnosSavedItemDelete`.

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

- Padrões: comandos `Promise<void>` resolvem; `isConnected` → `false`; `getLastPairedDevice` → `null`;
  `getLogs` → `[]`; `exportLogs` → `MOCK_EXPORT_PATH`.
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

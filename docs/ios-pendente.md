# iOS: estado e pendências

O host iOS existe desde 2026-10-30: o pod do React Native, o shim ObjC++ do TurboModule e a plataforma em Swift sobre o
`CoreBridge` do Repo 1, com o app de exemplo compilando para o simulador e para o iPhone. **No mesmo dia rodou num
iPhone com os dois relógios** (app de exemplo em Release): pareamento, comandos e sync com o fitGPS e com o Life Ultra
GPS. Reconexão, segundo plano e restauração ainda não foram testados no aparelho. O que o teste mostrou está em
[O que o iPhone mostrou](#o-que-o-iphone-mostrou-2026-10-30); o que foi conferido sem Bluetooth, em
[Verificação](#verificação-sem-iphone); o que falta, em [Pendências](#pendências). Como gerar o framework, rodar os
testes e o app: [`../ios/README.md`](../ios/README.md).
Fontes de referência citadas: Core iOS atual (`TechnosWareCore/ios/smaBluetooth/SMAService.m`), SDK SMA iOS
(`TechnosWareCore/examples/basic/ios/Pods/SmaTechnosIosSdk/BLEAPI/SmaBLE.m`) e o header gerado do XCFramework.

## Peças

| Peça | Onde | Papel | Par no Android |
|---|---|---|---|
| `RCTNativeCoreNext` | `ios/CoreNext/turbomodule/RCTNativeCoreNext.mm` (ObjC++) | Conforma ao `NativeCoreNextSpec` do codegen; cada um dos 23 métodos embrulha resolve/reject numa `TCNPromiseCompletion` e chama o seletor de mesmo nome do `TWPCoreBridge`; é o `TWPCoreEventSink`. Sem regra. | `NativeCoreNextModule` |
| `CoreNext`, `PromiseCompletion` | `ios/CoreNext/CoreNext.swift` | `bootstrap(launchOptions:)` (restauração), `sharedBridge()`, `log(tag:message:)`; a completion que passa todo valor pelo `FoundationConverter`. | `NativeCoreNextPackage`, `PromiseCompletion` |
| `CoreGraph` | `ios/CoreNext/CoreGraph.swift` | Um por processo: `WatchSession(transport:logger:store:)`, `CoreBridge(session:logger:host:)`, os stores, o logger, o transporte; repassa Bluetooth e scan ao controlador. | `CoreGraph` |
| `IosCoreHost` | `ios/CoreNext/IosCoreHost.swift` | O `CoreHost`. | `AndroidCoreHost` |
| `CentralTransport` | `ios/CoreNext/ble/` | `Transport` sobre `CBCentralManager`/`CBPeripheral` e o scan, com `LinkLifecycle`, `GattQueue`, `BluetoothPowerTracker`, `RestoredPeripherals` (restauração) e `RearmBackoff` (re-arme da conexão pendente). | `AndroidGattTransport`, `LinkLifecycle`, `GattQueue`, `BleScanner`, `BluetoothStateReceiver` |
| `FileSampleStore`, `PairingStore` | `ios/CoreNext/store/` | Histórico em JSON (`Application Support/corenext/`) e pareamento numa suíte própria do `UserDefaults` (as três chaves lidas e gravadas sob uma trava). | `FileSampleStore`, `PairingPrefs` |
| `RingLogger`, `FrameRecorder` | `ios/CoreNext/log/` | Anel de 2000 com `os_log` e `onLog`; gravação de frames no formato de fixture. | `RingLogger`, `FrameRecorder` |
| `UIKitBackgroundWork` | `ios/CoreNext/BackgroundWork.swift` | `beginBackgroundTask` durante o sync. | `SyncForegroundService` |

O Swift não importa o React: compila e é testado sem ele (`ios/Package.swift`, `ios/Tests/`). Só o `.mm` conhece o RN.

## Sem regra no host

O que cada método JS faz (checagens e rejeições antecipadas, `requestId`, evento antes do `resolve`, `NO_DATA`,
pareamento salvo, trabalho em segundo plano no sync, reconexão automática, fila de eventos, `CANCELLED` no
`invalidate`) está no `CoreBridge` do `:bridge` (Repo 1, `docs/arquitetura.md` seção 13; ADR 21). O iOS implementa só a
plataforma:

- **`CoreHost`** (`IosCoreHost`): `missingScanPermission`/`missingConnectPermission` devolvem `"Bluetooth"` (mensagem
  `"Missing Bluetooth"`) com `CBManager.authorization` `.denied` ou `.restricted`, e `nil` com `.notDetermined` (o
  sistema mostra o pedido no primeiro uso do central; até a resposta o central não está `.poweredOn` e o controlador
  responde `BLUETOOTH_OFF`); `isBluetoothEnabled` = central `.poweredOn`; `isValidAddress` = `UUID(uuidString:) != nil`;
  scan pelo transporte; `beginBackgroundTask`/`endBackgroundTask` no sync; `PairingStore`; cabeçalho da gravação;
  `logEntries`, `exportLogs` (`throws`), `clearLogs`, `setLogLevel`.
- **Ganchos do processo** (`CoreGraph`, como `HostTransportDelegate`): `onScannedDevice`/`onScanFailed` do scan,
  `onLogEntry` do logger, `onBluetoothTurnedOff()` antes de o transporte entregar `onBluetoothStateChanged(false)` e
  `onBluetoothTurnedOn()` depois de entregar o `true`, na fila do Bluetooth (como o bloco `afterDelivered` do Android).
  No primeiro `.poweredOn` só o `onBluetoothTurnedOn()` é chamado: um `initialize()` que chegou antes do primeiro estado
  viu o Bluetooth "desligado" e não reconectou.
- **Shim**: `attachSink:` na primeira chamada de um método JS e sempre que o sink estiver em outra instância (seção
  [Duas instâncias do TurboModule](#duas-instâncias-do-turbomodule)); `invalidateSink:` no `invalidate`; `onHostResume`
  no `UIApplicationWillEnterForegroundNotification` (o RN não tem `onHostResume` para TurboModule no iOS). Registro pelo
  `codegenConfig.ios.modulesProvider` do `package.json`, conferido no `RCTModuleProviders.mm` gerado.
- **Conversões**, sempre pelo `FoundationConverter`: o `emitName:payload:` converte com `toDictionaryPayload:` antes do
  `emitOnX:`, e a `PromiseCompletion` passa todo valor não nulo por `toArray(values: [value])` e lê o primeiro item (é o
  que faz o `isConnected` chegar como `true`/`false`, e não `1`/`0`; conferido como `CFBoolean` nos testes).

## Restauração do estado do Bluetooth

O iOS só relança o app em segundo plano para um periférico conectado se o `CBCentralManager` for recriado com o mesmo
`CBCentralManagerOptionRestoreIdentifierKey` durante o `application(_:didFinishLaunchingWithOptions:)`. TurboModules
nascem sob demanda, depois do bundle JS: criar o central no módulo repetiria o Core atual, que só o cria no
`initSMASDK` (`SMAService.m:48`, restore id `__sma__ble__core_restoration`; `willRestoreState` em `SMAService.m:1001`).

O que está feito:

- `CoreNext.bootstrap(launchOptions:)`, chamado no `AppDelegate` antes do React Native, cria o grafo do processo (e o
  central) quando o app foi relançado para o Bluetooth (`launchOptions[.bluetoothCentrals]`) ou já tem a autorização
  (`.allowedAlways`). Sem autorização ainda, nada é criado ali: o pedido do sistema aparece no primeiro método JS, quando o
  app quer.
- O central usa o identificador `br.com.grupotechnos.corenext.central`, e só se o `Info.plist` declara
  `bluetooth-central` em `UIBackgroundModes` (sem isso o CoreBluetooth recusa a restauração).
- **Reconexão sem JS.** Num processo relançado com pareamento salvo, o primeiro `.poweredOn` já pede a reconexão: o
  `BluetoothPowerTracker` devolve `.initialOn`, o transporte chama `transportBluetoothDidTurnOn`, e o
  `CoreBridge.onBluetoothTurnedOn` chama `reconnectIfPaired`, que não precisa de módulo ligado nem de `initialize`. As
  condições dele valem num processo novo: `userDisconnected` falso, pareamento salvo, sessão `DISCONNECTED`, central
  `.poweredOn` (marcado antes do aviso) e autorização `.allowedAlways`. Os eventos ficam na fila do `CoreBridge`
  (`PendingEvents`) até o módulo se ligar. Conferido no simulador (`testFirstPoweredOnReconnectsTheSavedWatchWithoutJs`:
  `connect` pendente pedido sem `attach`, e o `RECONNECTING` entregue quando o módulo se liga). `initialize`, o religar
  do Bluetooth e a volta ao primeiro plano chamam o mesmo `reconnectIfPaired`, que não faz nada com a sessão já em
  andamento.
- **`willRestoreState`** guarda os periféricos restaurados no cache do transporte e em `RestoredPeripherals`, e loga. O
  `didConnect` da conexão pendente que acordou o app costuma chegar antes do `connect()` da sessão (que sai do primeiro
  `.poweredOn` e passa pela fila da sessão antes de voltar ao transporte). Esse `didConnect` não é cancelado como
  conexão velha: com o transporte livre, o link fica aberto, e o `connect()` da sessão o reclama (o `central.connect` de
  um periférico já conectado devolve o `didConnect` na hora). Um restaurado que ninguém reclama em 10 s
  (`restoredClaimTimeout`, dentro do despertar em segundo plano) tem a conexão cancelada; depois de reclamado, um
  `didConnect` atrasado dele volta a ser cancelado como qualquer conexão velha.

Limites: não foi conferido no iPhone que o `central.connect` de um periférico já conectado devolve o `didConnect` na
hora (sem ele, a sessão ficaria em `RECONNECTING`, porque a reconexão não tem timeout), nem se os eventos da fila chegam
ao JS quando o React Native sobe num relançamento em segundo plano. A reconexão em si não depende do JS. Matar o app pelo
app switcher **desativa** a restauração; o teste é com pressão de memória (um app pesado em primeiro plano) e
`willRestoreState` no log.

## Escrita: tamanho do fragmento e tipo

- A SDK iOS de produção fragmenta todo comando em pedaços de **20 bytes** (`SmaBLE.m:668, 772-777, 858-861`) e escreve
  `CBCharacteristicWriteWithResponse` (`SmaBLE.m:465, 487`).
- `maximumWriteValueLength(for: .withResponse)` devolve 512 independentemente do MTU (escrita longa com
  Prepare/Execute Write); fragmentar por ele mandaria o BIND de 45 bytes numa escrita só, que firmwares com Nordic UART
  costumam recusar.
- **Implementado** (Repo 1, ADR 5, emenda; KDoc de `Transport.requestMtu`): o `CentralTransport` responde `requestMtu`
  na hora com `peripheral.maximumWriteValueLength(for: .withoutResponse) + 3`, o MTU ATT real do link, e loga
  `requested=… effective=…`. O iOS não negocia MTU pelo app. O tipo de escrita é o que o driver pede (o SMA escreve
  `.withResponse`, o iDO `.withoutResponse`), se a characteristic o declara ([Escrita sem resposta](#escrita-sem-resposta)).
- No fitGPS 0.2.1 o Android negociou MTU 23 (pedido de 247), e o iPhone deu o mesmo (2026-10-30):
  `maximumWriteValueLength(for: .withoutResponse)` = 20, `requestMtu requested=247 effective=23` no log, e o BIND de 45
  bytes saiu em escritas de 20, 20 e 5 bytes, respondido pelo relógio. A regra fica. Com o Life Ultra GPS o link abriu
  com MTU 515 (`didConnect … mtu=515`), mas o perfil iDO não pede MTU e a sessão usa 23; todo comando do driver cabe em
  16 bytes.

## Escrita sem resposta

No iOS **não há `peripheral(_:didWriteValueFor:error:)` para `.withoutResponse`**. A `GattQueue` do `CentralTransport`
escreve quando `canSendWriteWithoutResponse` é `true` e termina a operação na hora; com o buffer cheio, a operação espera
`peripheralIsReady(toSendWriteWithoutResponse:)` e então escreve (timeout de 4 s, como as outras). O iDO (Life Ultra GPS)
escreve todos os comandos assim; no replay do simulador os 12 TX da gravação real saíram `WITHOUT_RESPONSE` e
completaram, e no iPhone as 12 escritas do teste também (todas respondidas pelo relógio). O buffer cheio não apareceu: os
comandos têm até 16 bytes e saem um por vez, cada um esperando a resposta. Esse caminho continua sem teste no aparelho.

**O tipo precisa estar declarado.** O CoreBluetooth descarta, só com um aviso no console ("does not specify the Write
Without Response property - ignoring response-less write"), um Write Command numa characteristic sem
`.writeWithoutResponse`. O Android não olha a propriedade: o `writeCharacteristic` aceita `WRITE_TYPE_NO_RESPONSE` numa
characteristic que só declara `PROPERTY_WRITE`, então a gravação Android do Life Ultra GPS não prova que o `0af6` a
declara (o Repo 1 também não registra as propriedades). Sem tratar, o iDO veria todas as escritas "terminadas" e
estouraria o timeout do handshake sem nada no log. Por isso o `CentralTransport.effectiveWriteType` usa o tipo pedido
só se declarado; senão o outro tipo declarado (com um WARN `CentralTransport/write … declares [...]` por characteristic
e conexão) ou falha a escrita com status 3 (`CBATTError.writeNotPermitted`). E o `discoverServices` loga uma linha por
serviço com as propriedades de cada characteristic (`service=… characteristics=["…0af6…[write|writeWithoutResponse]", …]`).
No iPhone (2026-10-30) o `0af6` declarou `[read|write|writeWithoutResponse]` e o `6e400002` do fitGPS
`[write|writeWithoutResponse]`: o tipo que cada driver pede está declarado, e nenhum WARN `… declares` apareceu. O
desvio do `effectiveWriteType` para o outro tipo continua testado só no simulador (`WriteTypeTests`).

## Descoberta e notificações

- `discoverServices(nil)` e `discoverCharacteristics(nil, for:)` de cada serviço; a ordem de candidatos (`FF60` antes do
  NUS) é da sessão. O fitGPS 0.2.1 expõe o NUS (write `6E400002`, notify `6E400003`, como o Core iOS atual casa em
  `SMAService.m:1054-1061`) e o Device Information (`180A`); o Life Ultra GPS 1.1.1, o `0AF0` (`0AF6`, `0AF7`, `0AF1`,
  `0AF2`) e um segundo serviço que a sessão não usa (descoberta no iPhone,
  [O que o iPhone mostrou](#o-que-o-iphone-mostrou-2026-10-30)).
- **Scan sem filtro de serviço** (`scanForPeripherals(withServices: nil)`, com duplicatas, por 7 s): o fitGPS 0.2.1 não
  anuncia o NUS (anúncio com `180f`, `180a` e `00000001-…`, o mesmo no iPhone em 2026-10-30), e no iPhone o Life Ultra
  GPS não anunciou serviço nenhum (achado pelo nome). Cada periférico passa pelo `DeviceRegistry.identify` com o
  nome local do anúncio e, se não casar, com o `peripheral.name`; o evento sai uma vez por periférico por scan. Em
  segundo plano o iOS exige lista de serviços no scan; a reconexão usa `retrievePeripherals(withIdentifiers:)` e o
  `connect` pendente, não scan.
- `setNotifyValue(true, for:)` → `didUpdateNotificationStateFor` vira `onNotificationsEnabled` (se já notifica, termina
  na hora).
- Notificações chegam em `didUpdateValueFor`, uma por chamada, na ordem, entregues direto da fila do delegate pela
  sobrecarga com `Data` (que copia). Durante um `read` pedido, o `didUpdateValueFor` da mesma characteristic é a
  resposta da leitura.
- UUIDs: `CBUUID.uuidString` vem em maiúsculas e às vezes curto (`FF60`); tudo passa por `GattUuid.normalize`.

## Bytes: `NSData` ↔ `KotlinByteArray`

O header gerado expõe bytes como `TWPKotlinByteArray`. A ponte do `iosMain` do Repo 1 (pacote
`br.com.grupotechnos.watch.protocol.ios`, ADR 19) evita percorrer byte a byte:

| Uso | Swift |
|---|---|
| `Transport.write(...value:...)` → `writeValue` | `value.toData()` (na thread de quem chamou, antes de despachar) |
| `WatchLogger.frame` → `os_log`/hex | `value.toData()`; para a fixture, o `value` vai direto em `FrameJsonl.shared.line(...)` |
| `didUpdateValueFor` de uma notificação | `events.onNotification(characteristic: uuid, data: value)` |
| resposta de `Transport.read` | `events.onReadCompleted(requestId: id, data: value, status: status)` |
| `Data` → `KotlinByteArray` (testes) | `ByteBridgeKt.toByteArray(data)` |

Toda conversão copia; o buffer que o CoreBluetooth reutiliza não afeta a sessão. O `./gradlew :bridge:checkSwiftInterop`
e o `checkObjcInterop` do Repo 1 conferem essas grafias antes de quebrarem aqui.

## Payloads para o JS: `NSDictionary` e `CFBoolean`

O React Native separa `true`/`false` de número pela classe (`__NSCFBoolean`), e o Kotlin/Native entrega todo `Boolean`
como `KotlinBoolean`, que viraria `1`/`0` no JS. Por isso todo payload e todo valor resolvido passam pelo
`FoundationConverter` (`toDictionary(payload:)`, `toArray(values:)`). Não existe conversor de valor solto: o valor vai
numa lista de um elemento e é lido fora do Kotlin. Exceção Kotlin que cruza para o Swift sem `@Throws` encerra o
processo; `EventMapper.startOfDayIso`, `sleepDay` e `historySleep` são `throws` no Swift (ADR 20 do Repo 1), e o
`CoreHost.exportLogs` do iOS lança `NSError`, que vira `IO_ERROR`.

## Threading visto pelo host iOS

- O `CentralTransport` vive numa fila serial (`br.com.grupotechnos.corenext.ble`), a mesma que o central recebe;
  `session.events.onX` é chamado direto dela (cada chamada só enfileira; abaixo de 1,5 ms no simulador, pelo
  `RealtimeReplayTest` do Repo 1). `isPoweredOn` e `currentMtu`, lidos pelo `IosCoreHost` de qualquer thread, ficam
  atrás de uma trava.
- Os callbacks do `WatchSessionListener` (o do `CoreBridge`, que chama o `CoreHost` e o `CoreEventSink`) nunca rodam na
  fila do Bluetooth, saem um por vez, mas **a thread do sistema muda** (no iOS o `Dispatchers.Default` roda no pool do
  GCD). Nada aqui usa thread-local nem compara `Thread.current`.
- Emitir para o JS da thread da sessão é seguro: o `emitOnX:` gerado para iOS chama um `AsyncEventEmitter`
  (`NativeCoreNextSpec-generated.mm`, `setEventEmitterCallback`), que agenda a entrega na thread JS pelo `CallInvoker`,
  o mesmo caminho do Android. O `canEmit` só fica `true` depois de o JSI instalar o callback.
- O `RingLogger` é thread-safe (`NSLock`, o `onEntry` fora da trava): `getStepsDays`, `getSleepSessions` e
  `confirmUploaded` logam na thread do TurboModule, o construtor da sessão também, e um evento atrasado depois de
  `session.close()` loga na fila do Bluetooth. O logger não lança.
- Os métodos do TurboModule rodam na fila que o RN cria para o módulo; `getHistoryPedometer` e `exportLogs` fazem IO de
  arquivo pequeno ali, como no Android.

## Bluetooth desligado, autorização e estados do central

- **Contrato B** (`transporte-android.md#eventos-de-conexão`; ADR 18 do Repo 1): em `.poweredOff` o `CentralTransport`
  falha as operações pendentes, esquece os periféricos e entrega só `onBluetoothStateChanged(false)`, **nenhum**
  `onDisconnected` pelo link aberto ou pela conexão pendente; um `disconnect()` seguinte não emite nada até um
  `connect()` novo. É o comportamento natural do CoreBluetooth; se um `didDisconnectPeripheral` chegar mesmo assim, o
  link já está parado e ele é descartado.
- `.unauthorized`, `.unsupported` (o simulador) e `.resetting` contam como desligado (não há link possível e o
  CoreBluetooth invalidou os periféricos). O JS vê `BLUETOOTH_OFF` (4).
- Estado inicial: se o primeiro estado do central já é desligado, o mesmo `false` é entregue (o
  `reportBluetoothOffAtStartup` do Android).
- `CBCentralManagerOptionShowPowerAlertKey` ligado, como no Core atual (`SMAService.m:48`).
- Sem `NSBluetoothAlwaysUsageDescription` no `Info.plist` o iOS encerraria o app no primeiro uso do CoreBluetooth; o
  `CentralTransport` não cria o central, loga um ERROR e se comporta como Bluetooth desligado.

## Conexão e reconexão

- `address` = UUID do `CBPeripheral` (`identifier.uuidString`). Muda se o app for reinstalado: o pareamento salvo não
  sobrevive à reinstalação, e um pareamento do Core atual não migra sem novo scan.
- O periférico do `connect` vem do cache do scan ou da restauração, de `retrievePeripherals(withIdentifiers:)` ou de
  `retrieveConnectedPeripherals(withServices:)` (serviços dos perfis). Sem nenhum, o `connect` é recusado com
  `NOT_FOUND` (um `onDisconnected`); a sessão tenta de novo com espera crescente.
- `central.connect` não tem timeout: com `autoReconnect = true` ele é a conexão pendente do iOS (o sistema a mantém com
  o app suspenso). Um `didFailToConnect` de uma conexão pendente é re-armado, como o `autoConnect` do Android: na hora
  se a tentativa esperou 5 s ou mais (o relógio apareceu e a conexão não fechou), e com espera que dobra de 1 s até 30 s
  só em falhas rápidas seguidas, um erro que falha na hora (`RearmBackoff`). O motivo é o segundo plano: o app suspenso
  não roda timer do GCD e o despertar do CoreBluetooth dura poucos segundos, então uma espera longa deixaria o relógio
  sem conexão pendente até o app voltar ao primeiro plano; a conexão pendente é passiva e não tem timeout, então re-armar
  na hora não gira o rádio. A conexão direta (`pair`) que falha sai como `onDisconnected`, e o timeout é o da sessão.
- **Vínculo apagado no relógio** (achado no primeiro teste no iPhone, 2026-10-30). O Life Ultra GPS usa o pareamento do
  sistema (bond, com chave LTK). O iPhone guardava o vínculo de um pareamento antigo pelo app Mormaii de produção; o
  relógio foi pareado com um Android depois e apagou as chaves do iPhone. Todo `connect` falhou em 0,3 a 3 s com
  `didFailToConnect` e `CBError.peerRemovedPairingInformation` (código 14), até o usuário tocar em "Esquecer este
  dispositivo" em Ajustes > Bluetooth; depois disso, o pareamento passou na primeira tentativa. App nenhum remove o
  vínculo. Antes, o JS recebia `DISCONNECTED` com `status=14`, e uma conexão pendente seria re-armada para sempre (pelo
  código: no teste só houve conexões diretas). Agora o
  `CentralTransport` traduz o erro para `GattStatus.PAIRING_REMOVED`, loga um WARN com a dica, e não re-arma: a conexão
  pendente termina com `onDisconnected`, como a direta (`LinkLifecycle.linkDown`). A sessão do Repo 1 para com o código
  `PAIRING_REMOVED` (no `pairDevice`, no `startPairingAttempt` e, sem pedido, com `requestId` -1) e não tenta de novo
  sozinha; a próxima tentativa é a do próximo gatilho (voltar ao app depois de esquecer o relógio, religar o Bluetooth,
  `initialize`). ADR 23 do Repo 1. O app de exemplo mostra "Esqueça o relógio em Ajustes > Bluetooth do iPhone e tente
  parear de novo."
- Um `didDisconnectPeripheral` sem link aberto é o eco de um `cancelPeripheralConnection` (o CoreBluetooth avisa também
  esse) e é descartado; um `didConnect` que chega depois de um `disconnect()` cancela a conexão.

## Duas instâncias do TurboModule

No primeiro teste no iPhone (Release), o log trouxe duas linhas `RCTNativeCoreNext/attach` ("TurboModule attached to the
CoreBridge (first JS call)") no mesmo milissegundo, logo depois do `CoreGraph/init` (o grafo nasceu no primeiro método JS,
porque a autorização do Bluetooth ainda não existia no `bootstrap`). O `coreBridge` era `@synchronized(self)` e só
logava com `_attachedBridge` vazio: foram duas instâncias de `RCTNativeCoreNext`, cada uma no seu primeiro método JS, e o
`attachSink:` da segunda substituiu o sink da primeira. Os eventos chegaram ao JS nesse teste.

O que foi conferido no código do RN 0.81.4 (`example/node_modules/react-native`) e no app gerado, sem achar a causa:

- **Registro único.** O shim não usa `RCT_EXPORT_MODULE` (só `+moduleName`, que devolve `NativeCoreNext`); o único
  registro é o `codegenConfig.ios.modulesProvider` (`"NativeCoreNext": "RCTNativeCoreNext"`), e o único arquivo gerado
  que cita a classe é o `RCTModuleProviders.mm` (`example/ios/build/generated/ios/`). Não há registro com dois nomes.
- **Duas instâncias existem por desenho, mas só uma recebe chamadas.** O `RCTModuleProviders.moduleProviders` cria um
  "provedor" com `[klass new]` (uma instância de `RCTNativeCoreNext`, guardada num dicionário estático). O
  `RCTTurboModuleManager._moduleProviderForName` vê que o provedor conforma a `RCTTurboModule` e cria o módulo de verdade
  a partir de `[moduleProvider class]` (`_provideObjCModule` → `_createAndSetUpObjCModule` →
  `RCTAppSetupDefaultModuleFromClass`, que faz `[moduleClass new]`), guardado no `ModuleHolder` do nome; o
  `getTurboModule:` é chamado nesse módulo, com ele mesmo em `InitParams.instance`. O provedor nunca recebe métodos JS.
- **Um gerenciador por runtime.** No modo sem bridge, o `RCTInstance` cria um `RCTTurboModuleManager` só, que guarda o
  `TurboModule` por nome (`_turboModuleCache`) e o objeto por nome (`ModuleHolder`, com trava); o `provideLegacyModule`
  não acha a classe (sem `RCT_EXPORT_MODULE`). O JS chama `TurboModuleRegistry.getEnforcing("NativeCoreNext")` num
  lugar só (`src/specs/NativeCoreNext.ts`).
- **Não é log duplicado.** O `RingLogger` grava cada entrada uma vez; as linhas vizinhas não se repetem.

Sem uma causa clara, o shim não muda o registro. O que mudou (baixo risco): o `coreBridgeFor:` religa o sink quando ele
está em outra instância, então os eventos vão sempre para a instância que o JS chamou por último (o `attach` do
`CoreBridge` com o mesmo sink não faz nada); e o log diz o endereço da instância, o método que a ligou e o sink anterior
(`TurboModule 0x… attached to the CoreBridge (first JS call: initialize:reject:; previous sink 0x…)`, e
`took the event sink back from 0x…` quando o sink volta, até 20 vezes por processo). Só a instância que é o sink chama
o `onHostResume` na volta ao primeiro plano: cada instância ligada tem o seu observador, e dois `onHostResume` pediriam
duas reconexões, a primeira cancelada pela segunda (um `onError` `CANCELLED` com `method: null`). O próximo teste no iPhone mostra qual
chamada veio por qual instância; se as duas instâncias continuarem recebendo métodos, o próximo passo é um ponto de
parada no `coreBridgeFor:` com a pilha de cada uma.

## Integração no app Mormaii

O app Mormaii já tem `AppDelegate` em Swift, `NSBluetoothAlwaysUsageDescription` e `bluetooth-central`
(`GTE-Mormaii/ios/MormaiiWareApp/Info.plist:75, 126-128`). Para trocar o Core:

1. `ios/scripts/sync-xcframework.sh` no clone deste repositório e o pod (autolinking ou `:path`); `pod install`.
2. No `AppDelegate`: `import TechnosCoreNext` e `CoreNext.bootstrap(launchOptions: launchOptions)` antes do React Native.
3. O import JS muda de pacote (`docs/api-js.md`); o `deviceId` passa a ser o UUID (`docs/pendencias.md`, seção 5).

Não verificado: o Podfile do Mormaii aceita `USE_FRAMEWORKS` (`GTE-Mormaii/ios/Podfile:79-83`); com frameworks, o shim
importa `<TechnosCoreNext/TechnosCoreNext-Swift.h>` (o `__has_include` cobre os dois casos), mas o build não foi feito.
Os dois Cores não devem rodar juntos: os dois criam um central, com identificadores de restauração diferentes, e
disputariam o relógio.

## O que o iPhone mostrou (2026-10-30)

Primeiro teste com os dois relógios num iPhone, com o app de exemplo em Release (JS embutido, sem Metro), num processo
só. Fontes: os dois `frames-*.jsonl` exportados (`platform` `ios`) e o log nativo de cada export (fora do git, como no
Android: além dos UUIDs, as linhas do scan trazem o nome do iPhone e de aparelhos por perto).

- **fitGPS (SMA, firmware 0.2.1): o fluxo inteiro passou.** Scan, `pairDevice` com BIND e LOGIN (o `BIND_BACK` chegou
  3,8 s depois do BIND; `READY` 10,5 s depois do toque, 5,3 s deles no `connect`), versão `0.2.1`, bateria 35%, acerto de
  hora (o automático e o `setTime`), `refreshSteps` (0 passos no dia: o relógio não foi usado), `Sync` com passos e sono,
  e `Disconnect` (a sessão ficou em `DISCONNECTED`, sem reconexão sozinha). Depois, `Forget` com a sessão já desconectada
  (sem link, então sem `UNBIND`). Gravação: 52 pacotes (22 TX, 30 RX).
- **MTU.** fitGPS: `didConnect … mtu=23` e `requestMtu requested=247 effective=23`, o mesmo do Android
  ([Escrita](#escrita-tamanho-do-fragmento-e-tipo)). Life Ultra GPS: `didConnect … mtu=515`, sem pedido de MTU (o perfil
  iDO usa 23).
- **Life Ultra GPS (iDO, firmware 1.1.1): as funções básicas passaram, depois de esquecer o vínculo antigo** (abaixo).
  Os dois CCCD (`0af7` e depois `0af2`) aceitos; BIND com a confirmação na tela (o `04/05` do relógio chegou 1,4 s depois
  do `BIND_AUTH`; `READY` 3,3 s depois do toque); o `03/01` automático 1 s depois do `READY`; firmware `1.1.1`, bateria
  12%, `setTime`, passos ao vivo (57 passos, 7 kcal, 59 m), `Sync` em 61 ms e `Sono` com `NO_DATA`, como previsto (o sono
  do iDO está fora da PoC). As 12 escritas foram no `0af6`, sem resposta, e todas tiveram resposta do relógio. Gravação:
  24 pacotes (12 TX, 12 RX).
- **Propriedades das characteristics** (linhas `CentralTransport/discoverServices service=…`):
  - fitGPS, NUS `6e400001`: `6e400002` `[write|writeWithoutResponse]`, `6e400003` `[notify]`. O `180a` só tem leituras.
  - Life Ultra GPS, `0af0`: `0af6` `[read|write|writeWithoutResponse]`, `0af7` `[read|notify]`, `0af1`
    `[read|write|writeWithoutResponse]`, `0af2` `[read|notify]`.
  - Life Ultra GPS, segundo serviço `00000000-0000-0000-6473-5f696c666973`: `00000000-0000-0100-6473-5f696c666973`
    `[read|write|writeWithoutResponse]` e `00000000-0000-0200-6473-5f696c666973` `[read|write|writeWithoutResponse|notify]`.
    O fim do UUID, `6473 5f69 6c66 6973`, é `ds_ilfis` em ASCII, `sifli_sd` invertido: provavelmente um serviço do
    fornecedor da plataforma SiFli (`platform` 98 no `02/01`), talvez de OTA. **Não confirmado**; a sessão o ignora.
- **Vínculo apagado (status 14).** Antes do teste que passou, cinco `pairDevice` com o Life Ultra GPS falharam em 0,3 a
  3 s com `didFailToConnect status=14 error=Peer removed pairing information`, todos conexões diretas
  (`autoReconnect=false`): três antes do fitGPS e duas depois, com o Bluetooth do Android já desligado (então não era o
  Android segurando o relógio). O relógio aparecia no scan normalmente. Depois de "Esquecer este dispositivo" em Ajustes >
  Bluetooth, no mesmo processo, o pareamento passou na primeira tentativa. O build do teste mostrava `DISCONNECTED` com
  `link lost (status=14 Connect failed (status=14))`, sem nada que o usuário pudesse fazer. O código atual (depois do
  teste, ADR 23 do Repo 1; [Conexão e reconexão](#conexão-e-reconexão)) traduz o erro para `GattStatus.PAIRING_REMOVED`
  com um WARN de dica, não re-arma a conexão pendente, e a sessão para com o código `PAIRING_REMOVED` sem tentar de novo
  sozinha; o app de exemplo mostra a dica. Esse comportamento novo foi testado só no simulador e no Repo 1, e a falha numa
  conexão **pendente** (reconexão) não apareceu no aparelho.
- **Bluetooth do iPhone desligado e religado uma vez**, com a sessão em `DISCONNECTED` e nada aberto nem pendente: a
  sessão foi a `BLUETOOTH_OFF` e voltou a `DISCONNECTED`, sem `onDisconnected`. Não testa o contrato B com link aberto
  nem a reconexão.
- **Duas instâncias do TurboModule**: duas linhas `RCTNativeCoreNext/attach` no mesmo milissegundo, logo depois do
  `CoreGraph/init`; os eventos chegaram ao JS. Análise e mitigação em
  [Duas instâncias do TurboModule](#duas-instâncias-do-turbomodule).
- **Autorização**: o grafo nasceu no primeiro método JS (não no `bootstrap`) e o central chegou a `.poweredOn` com
  `authorization=3` (`.allowedAlways`) 2,6 s depois, o que é compatível com o pedido do sistema aceito no primeiro uso. A
  recusa não foi testada.
- **Cabeçalho errado na gravação do fitGPS.** `frames-20261030-093133.jsonl` só tem pacotes do fitGPS, mas o cabeçalho
  saiu com `device` `"Life Ultra GPS"` e `firmware` `"0.2.1"`: os pedidos ao Life Ultra GPS que falharam depois trocaram o
  nome. Corrigido depois do teste no `CoreBridge` (ADR 24 do Repo 1: o nome só muda quando o link abre); o arquivo já
  exportado continua com o cabeçalho errado e precisa de correção antes de virar fixture. O `mtu` do cabeçalho é o do
  transporte na hora do export (23 e 515, aqui iguais aos dos links).
- **Primeiro sono SMA real** (sync do fitGPS, com o relógio parado durante a noite, sem uso): uma página `05/46` com 9
  registros, de um START (17) em 2026-10-29 21:58 até 2026-10-30 09:30, sem END (34) e com um registro fora de ordem; a
  sessão montou uma sessão de sono. A página de passos trouxe um `mode 16` com 56 passos às 23:59 de 2026-10-29 (o total
  do dia). O que esses registros dizem do protocolo é assunto do Repo 1 (`docs/sma-dados.md` e `docs/pendencias.md` de
  lá).

O que este teste não cobriu está em [Pendências](#pendências).

## Verificação (sem iPhone)

Feita em 2026-10-30, com Xcode 26.1.1 e simulador iOS 26:

- **Testes do host no simulador** (`ios/Tests/`, `xcodebuild test`): 47 testes (43 na revisão de 2026-10-30, mais 4 do
  vínculo apagado: o status de cada `NSError` e o `LinkLifecycle` que termina a conexão pendente). O `CoreGraph` de verdade (com o
  `CoreBridge` e a sessão do framework Kotlin, `IosCoreHost`, `FileSampleStore`, `PairingStore`, `RingLogger`,
  `FrameRecorder`) sobre um transporte que responde com as gravações reais, método JS por método JS:
  `pair-commands-bt-reconnect-sync.jsonl` (fitGPS, 850 pacotes, **TX 167/167**, Bluetooth desligado e religado com
  reconexão só com LOGIN, passos do dia 2026-10-29 = **56**), `pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl`
  (fitGPS, **32/32**, Disconnect e Reconnect last, sono vazio → `NO_DATA`) e `pair-info-time-steps-sync.jsonl` (Life
  Ultra GPS, **12/12**, todas as escritas sem resposta, 51 passos). Mais: `isConnected` como `CFBoolean`,
  `getLastPairedDevice` como `NSDictionary`, `charging` booleano, `exportLogs` relido pelo leitor de fixture com
  `platform` `ios`, `forgetDevice` apagando pareamento e histórico sem tocar no `UserDefaults` do app, o `invalidate`
  de um reload rejeitando com `CANCELLED`, a reconexão pedida no primeiro `.poweredOn` sem JS (relançamento), e o
  contrato B e a fila de operações sem CoreBluetooth. Peças puras novas da revisão de 2026-10-30: `RestoredPeripherals`
  (o `didConnect` de um restaurado antes do `connect()` da sessão fica aberto), `RearmBackoff`, o tipo de escrita
  efetivo e o `PairingStore` sob carga concorrente (sem a trava, o mesmo teste leu 110 e 996 pareamentos misturados em
  6000 leituras).
- **App de exemplo no simulador**: o log mostra `CoreGraph/init` (pelo `bootstrap`), `state=unsupported`, a sessão em
  `BLUETOOTH_OFF`, `RCTNativeCoreNext/attach`, `[CoreNextExample] initialize() resolved` e
  `onConnectStateChanged {"state":4,…}` no JS; a tela mostra `Bluetooth desligado (4)` e `Módulo: Inicializado`.
- **Build para iPhone**: `Release`, `-sdk iphoneos`, `CODE_SIGNING_ALLOWED=NO`, arm64, com o `main.jsbundle` embutido.

## Pendências

O que só o iPhone com o relógio fecha (roteiro no [`example/README.md`](../example/README.md#rodar-no-iphone)).
Fechado no teste de 2026-10-30 ([O que o iPhone mostrou](#o-que-o-iphone-mostrou-2026-10-30)):

- [x] Scan, pareamento (BIND e LOGIN no fitGPS; confirmação na tela do Life Ultra GPS), comandos (versão, bateria, hora,
  passos) e sync com o CoreBluetooth de verdade, nos dois relógios, com o app em Release (JS embutido, sem Metro).
- [x] O MTU do fitGPS no iPhone: 23 (`maximumWriteValueLength(.withoutResponse)` = 20), como no Android.
- [x] As propriedades do `0af6` (`[read|write|writeWithoutResponse]`) e do `6e400002` (`[write|writeWithoutResponse]`)
  na linha `CentralTransport/discoverServices service=…`, sem WARN `CentralTransport/write … declares`; as 12 escritas sem
  resposta do Life Ultra GPS completaram.
- [x] `Disconnect` com o fitGPS: `DISCONNECTED`, sem reconexão sozinha.

Em aberto:

- [ ] As duas gravações do teste (`platform` `ios`, 52 e 24 pacotes) como fixture no Repo 1, reproduzindo
  `TX matched N/N`; a do fitGPS precisa antes do cabeçalho corrigido (ADR 24 do Repo 1).
- [ ] A escrita sem resposta do iDO com o buffer cheio (`peripheralIsReady(toSendWriteWithoutResponse:)`): não aconteceu
  no teste.
- [ ] Bluetooth desligado e religado **com o relógio conectado** (contrato B no aparelho e a volta a `READY` só com
  LOGIN), `Reconnect last`, a reconexão depois de o relógio sair do alcance e voltar, e depois de fechar o app pelo app
  switcher e abrir de novo (`retrievePeripherals`). No teste, o Bluetooth do iPhone foi desligado e religado só com a
  sessão em `DISCONNECTED`, sem link nem conexão pendente: não conta.
- [ ] A recusa da autorização (`PERMISSION_DENIED`, `"Missing Bluetooth"`). O aceite no primeiro uso é compatível com o
  log do teste.
- [ ] Segundo plano e restauração (pressão de memória, `willRestoreState` no log): o iOS relançando o app em segundo
  plano para entregar a conexão, `Keeping restored connection` ou um `didConnect` da tentativa da sessão, a sessão
  chegando a `READY` sem abrir o app, e nenhum `No connect for restored`. Junto, a suposição da
  [Restauração](#restauração-do-estado-do-bluetooth) de que o `central.connect` de um periférico restaurado, já
  conectado, devolve o `didConnect` na hora (sem isso, a sessão fica em `RECONNECTING`).
- [ ] Reinstalação: o UUID do relógio muda e o pareamento salvo se perde ([Conexão e reconexão](#conexão-e-reconexão));
  não conferido no aparelho.
- [ ] Convivência com o Core de produção: os dois criam o próprio `CBCentralManager`
  ([Integração no app Mormaii](#integração-no-app-mormaii)); na migração, o app não pode iniciar o Core antigo para um
  modelo que já foi para este. Não testado.
- [ ] H8 com uma gravação iOS (Repo 1, `docs/pendencias.md`, bloco 5).
- [ ] Vínculo apagado no relógio, com o código atual. O erro em si apareceu no teste (cinco conexões diretas com status
  14, no build de antes da correção). Falta: parear o Life Ultra GPS num Android, voltar ao iPhone e ver, no `pairDevice`
  e no "Reconnect last", o `onError` `PAIRING_REMOVED` com a dica na tela, um `connect` por tentativa no log (sem
  `rearm`), e a reconexão ao voltar ao app depois de esquecer o relógio nos Ajustes.
- [ ] Duas instâncias do TurboModule: com o log novo do shim, qual método veio por qual instância
  ([seção](#duas-instâncias-do-turbomodule)).

Limites conhecidos, de desenho:

- **Reconexão em segundo plano.** Depois de uma tentativa que falhou, a sessão espera 2 s, 4 s… até 60 s num `delay` de
  corrotina (`SessionEngine.scheduleReconnect`, Repo 1) sem `connect` pendente no host; com o app suspenso nada acorda o
  app, e a reconexão para até ele voltar ao primeiro plano. No iOS a espera deveria ser o próprio `connect` pendente. É
  mudança na sessão do Repo 1 (`docs/pendencias.md` de lá, seção "iOS"). A queda de um link pronto reconecta na hora e
  não tem esse problema. O re-arme do próprio host (`didFailToConnect` de uma conexão pendente) já é na hora depois de
  uma tentativa que esperou; só falhas rápidas seguidas esperam, e a partir da quarta (8 s) a espera pode passar do
  despertar.
- Um periférico que o sistema não conhece (nunca visto por este app desde a instalação) não reconecta sem um scan.
- Bugs do Core atual que **não** foram reproduzidos: `disconnectCurrentDevice` apagando todo o `NSUserDefaults` do app
  (`SMAService.m:148-149`), bateria passada como dicionário onde o método espera um inteiro (`SMAService.m:1237-1241`),
  `isConnected` sempre `NO` (`SMAService.m:1509-1511`).

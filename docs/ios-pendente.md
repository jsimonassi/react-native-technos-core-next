# iOS: o que falta e as armadilhas já mapeadas

Nada do host iOS foi implementado nesta PoC. O Repo 1 já gera `TechnosWatchProtocol.xcframework` (estático, prefixo
`TWP`, sem `suspend`/`Flow` na API pública; desde a ADR 20 de lá, gerado pelo módulo `:bridge`, com o `:protocol`
exportado, em `bridge/build/XCFrameworks/`), tem a ponte de bytes para o Swift (seção "Bytes" abaixo), o contrato JS
comum com os payloads como `NSDictionary` (seção "Payloads" abaixo) e o controlador `CoreBridge`, que implementa cada
método do spec e já é o que o host Android usa (seção "Sem regra no host" abaixo). Ele também reproduz a gravação
real do fitGPS no simulador iOS e já rodou a sessão no dispatcher de produção com os eventos vindos de uma fila GCD
serial (`docs/pendencias.md` do Repo 1, seção "iOS"). O pod tem só o esqueleto (`ios/README.md`). Este documento junta
o que se sabe para a etapa seguinte. Fontes: Core iOS atual (`TechnosWareCore/ios/smaBluetooth/SMAService.m`), SDK SMA
iOS (`TechnosWareCore/examples/basic/ios/Pods/SmaTechnosIosSdk/BLEAPI/SmaBLE.m`) e o header gerado do XCFramework.

## Peças

| Peça | Linguagem | Papel |
|---|---|---|
| `CentralTransport` | Swift | Implementa `TWPTransport` sobre `CBCentralManager`/`CBPeripheral`; dono do central. |
| `CoreNext.bootstrap(launchOptions:)` | Swift | Cria o `CentralTransport.shared` no launch do app (restauração). |
| `CoreGraph` | Swift | Um por processo, como no Android: monta `WatchSession(transport:logger:store:)`, liga o transporte e cria `CoreBridge(session:logger:host:)`; implementa `CoreHost` (o par do `AndroidCoreHost`), o `SampleStore`, as preferências e o logger; chama os ganchos do processo. |
| `RCTNativeCoreNext.mm` | ObjC++ | Shim do TurboModule: conforma ao `NativeCoreNextSpec` do codegen; cada método embrulha resolve/reject numa `TWPCoreCompletion` e chama o seletor de mesmo nome do `TWPCoreBridge`; é o `TWPCoreEventSink`. Sem regra. |

## Sem regra no host

O que cada método JS faz (checagens e rejeições antecipadas, `requestId`, evento antes do `resolve`, `NO_DATA`,
pareamento salvo, trabalho em segundo plano no sync, reconexão automática, fila de eventos, `CANCELLED` no
`invalidate`) está no `CoreBridge` do `:bridge` (Repo 1, `docs/arquitetura.md` seção 13; ADR 21), em código comum e
testado também no simulador. O Android já é só uma casca sobre ele
([`arquitetura.md`](arquitetura.md#o-que-mora-onde)), então o iOS reimplementa só a plataforma:

- **`CoreHost`** no `CoreGraph.swift`, um método por peça do `AndroidCoreHost`: autorização e estado do
  `CBCentralManager` (`missingScanPermission`/`missingConnectPermission` devolvem o nome que vai na mensagem
  `"Missing <nome>"`, ou `nil`), `isValidAddress` = `UUID(uuidString:) != nil`, scan, `beginBackgroundTask`/
  `endBackgroundTask` no sync, pareamento em `UserDefaults`, cabeçalho da gravação, log em memória e `exportLogs`
  (`throws`). Tabela por plataforma na seção 13 do `docs/arquitetura.md` do Repo 1. É chamado de qualquer thread (a
  do TurboModule, a da sessão, a principal) e não deve bloquear nem lançar, salvo o `exportLogs`.
- **Ganchos do processo**, do `CoreGraph.swift`: `onScannedDevice`/`onScanFailed` do scan, `onLogEntry` do logger,
  `onBluetoothTurnedOff()` antes de entregar `onBluetoothStateChanged(false)` à sessão e `onBluetoothTurnedOn()`
  depois de entregar o `true` (na mesma fila, como o bloco `afterDelivered` do Android).
- **Shim** (forma exata em `bridge/objc-interop/MinimalTurboModule.mm` do Repo 1, que o `check` de lá compila com
  `-Werror`): `attachSink:` na primeira chamada de um método JS (como o `bridge()` do módulo Android) e, só depois
  disso, `invalidateSink:` no `invalidate` e `onHostResume` ao voltar ao primeiro plano
  (`UIApplicationWillEnterForegroundNotification`); `initSMASDK:reject:` chama `doInitSMASDKCompletion:` (o
  Kotlin/Native renomeia a família `init`); o `deletedSavedData` passa o `NSArray` do TurboModule como está.
- **Conversões**, sempre pelo `FoundationConverter` (seção "Payloads" abaixo): o `emitName:payload:` do sink
  converte o payload com `toDictionaryPayload:` antes do `emitOnX:`, e a completion passa todo valor não nulo por
  `toArrayValues:@[value]` e lê o primeiro item antes do `resolve` (é o que faz o `isConnected` chegar como
  `true`/`false`, e não `1`/`0`).

## Restauração do estado do Bluetooth

O iOS pode relançar o app em segundo plano para entregar eventos de um periférico conectado, desde que o
`CBCentralManager` seja recriado com o mesmo `CBCentralManagerOptionRestoreIdentifierKey` durante o
`application(_:didFinishLaunchingWithOptions:)` (`launchOptions[.bluetoothCentrals]` traz os identificadores).

Armadilha: TurboModules são criados **sob demanda**, no primeiro `TurboModuleRegistry.getEnforcing` do JS
(`src/specs/NativeCoreNext.ts`), depois de o bundle carregar. Criar o central no `init` do módulo reproduz o problema
do Core atual, que só cria o central quando o JS chama `initSMASDK` (`SMAService.m:48`, com restore id
`__sma__ble__core_restoration`; `willRestoreState` em `SMAService.m:1001`). Solução: o `AppDelegate` do app chama
`CoreNext.bootstrap(launchOptions:)`, que cria o central; o módulo só se anexa a ele quando o JS sobe. Isso vira
uma instrução de integração para o app consumidor (uma linha no `AppDelegate`).

Teste da restauração: matar o app pelo app switcher **desativa** a restauração. Testar com pressão de memória (um app
pesado em primeiro plano) e confirmar `willRestoreState` no log.

## Escrita: tamanho do fragmento e tipo

- A SDK iOS que funciona em produção fragmenta todo comando em pedaços fixos de **20 bytes**
  (`SmaBLE.m:668, 772-777, 858-861`) e escreve `CBCharacteristicWriteWithResponse` (`SmaBLE.m:465, 487`).
  `maximumWriteValueLength` só aparece no envio de EPO (`SmaBLE.m:3826`).
- `maximumWriteValueLength(for: .withResponse)` devolve 512 independentemente do MTU (o iOS faz *long write* com
  Prepare/Execute Write). Fragmentar por esse valor manda o BIND de 45 bytes num único write longo, que firmwares com
  Nordic UART costumam recusar.
- **Decidido** (Repo 1, `docs/decisoes.md`, ADR 5, emenda; KDoc de `Transport.requestMtu`): o `CentralTransport`
  responde `requestMtu` na hora com `peripheral.maximumWriteValueLength(for: .withoutResponse) + 3`, que reflete o MTU
  ATT real do link, e **nunca** com o valor de `.withResponse`. O tipo de escrita continua `.withResponse`.
  `Quirks.maxFragment` do fitGPS continua `null`: o Android não muda. O iOS não negocia MTU pelo app.
- No fitGPS 0.2.1 o Android negociou MTU 23 (pedido de 247, status 0; `transporte-android.md`, seção "O que a
  gravação do fitGPS mostrou"). Com a regra acima, o iOS também manda fragmentos de 20 bytes para ele, o que tira o
  principal risco da escrita no iOS. A sessão já escreve sempre `WITH_RESPONSE`. Gatilho para rever: a primeira
  gravação feita no iPhone trazer no cabeçalho um `mtu` diferente de 23.

## Escrita sem resposta

No Android, `onCharacteristicWrite` chega também para `WRITE_TYPE_NO_RESPONSE`, e a `GattQueue` avança igual. No iOS
**não há `peripheral(_:didWriteValueFor:error:)` para `.withoutResponse`**: a fila precisa usar
`canSendWriteWithoutResponse` e `peripheralIsReady(toSendWriteWithoutResponse:)` e completar a operação na hora em
que o write é aceito. Alternativa na PoC iOS: aceitar só `.withResponse` (é o que a SDK usa).

## Descoberta e notificações

- O Core iOS atual casa só o NUS: write `6E400002`, notify `6E400003` (`SMAService.m:1054-1061`); a ordem de
  candidatos (`FF60` antes do NUS) é da sessão, como no Android. O fitGPS 0.2.1 expõe só o NUS (sem `FF60`).
- **Scan:** o fitGPS 0.2.1 não anuncia o NUS (anúncio com `180f`, `180a` e `00000001-…`; gravação Android de
  2026-10-29). No iOS, `scanForPeripherals(withServices:)` com o NUS não acharia o relógio: escanear com `nil` e
  filtrar pelo nome `Mormaii_fitGPS`, como o Core iOS atual (`SMAService.m:508, 512`). Em segundo plano o iOS exige
  uma lista de serviços no scan; a reconexão em segundo plano usa `retrievePeripherals(withIdentifiers:)` e
  `connect` pendente, não scan.
- O cabeçalho L1 de 8 bytes chegou sempre numa notificação própria no Android com MTU 23; a remontagem é da sessão e
  vale igual no iOS.
- `setNotifyValue(true, for:)` → `didUpdateNotificationStateFor` vira `onNotificationsEnabled`.
- Notificações chegam em `didUpdateValueFor`; entregar uma por chamada, na ordem, com cópia dos bytes.
- UUIDs: `CBUUID.uuidString` vem em maiúsculas e às vezes curto (`FF60`); passar por `GattUuid.normalize`.

## Shim ObjC++

O `.mm` precisa conformar ao protocolo ObjC++ `NativeCoreNextSpec` (JSI) gerado pelo codegen e implementar **todos**
os métodos do spec (hoje 23), cada um com uma linha que chama o `TWPCoreBridge` (seção "Sem regra no host"), mais
ser o `TWPCoreEventSink`, porque as emissões vivem na `NativeCoreNextSpecBase`. Estimativa: perto das 320 linhas do
`MinimalTurboModule.mm` do Repo 1, que já tem essa forma, todas de casca. O `TWPCoreBridge` do processo vem do Swift:
exige `CoreNext-Swift.h` importável num pod estático (`DEFINES_MODULE = YES`) e um app com pelo menos um arquivo
`.swift` e bridging header (o `examples/basic` tem; o Mormaii não foi verificado).

## Bytes: `NSData` ↔ `KotlinByteArray`

O header gerado expõe bytes como `TWPKotlinByteArray` (`Transport.write(... value:)`, `TransportEvents.onNotification`,
`WatchLogger.frame`), que no Swift só se lê byte a byte. O Repo 1 tem no `iosMain` a ponte que evita isso (pacote
`br.com.grupotechnos.watch.protocol.ios`; tabela, invariantes e testes no `README.md` do pacote, desenho na seção 11 do
`docs/arquitetura.md` de lá, decisão na ADR 19). Grafias exatas no Swift, conferidas no header gerado:

| Uso no `CentralTransport` | Swift |
|---|---|
| `Transport.write(service:characteristic:value:type:requestId:)`: o `value` vira `Data` para o `writeValue` | `let data: Data = value.toData()` |
| `WatchLogger.frame(direction:characteristic:value:summary:)`: o `value` para `os_log` | `value.toData()`; para gravar a fixture, o `value` vai direto em `FrameJsonl.shared.line(direction:atMs:characteristic:value:)` |
| `peripheral(_:didUpdateValueFor:error:)` de uma notificação | `session.events.onNotification(characteristic: uuid, data: value)` |
| o mesmo callback de uma leitura pedida por `Transport.read` (valor opcional) | `session.events.onReadCompleted(requestId: id, data: characteristic.value, status: status)` |
| `Data` → `KotlinByteArray`, se precisar (raro) | `ByteBridgeKt.toByteArray(data)` |

No Objective-C (o shim `.mm`, se precisar): `[value toNSData]`, `[TWPByteBridgeKt toByteArray:data]`,
`onNotificationCharacteristic:data:` e `onReadCompletedRequestId:data:status:` da categoria
`TWPTransportEvents (Extensions)`.

- Toda conversão copia: o `CentralTransport` pode passar o `characteristic.value` direto, sem copiar antes, e o buffer
  que o `CoreBluetooth` reutiliza não afeta a sessão. `Data` vazio e `nil` funcionam.
- As sobrecargas com `data:` só copiam e chamam o método comum: mesma regra de "retorna na hora, de qualquer thread,
  uma chamada por notificação, na ordem". Chamar direto da fila de delegate, sem `DispatchQueue.async` extra.
- **Portão no Repo 1:** a tarefa `./gradlew :bridge:checkSwiftInterop` (parte do `check` de lá) faz
  `swiftc -typecheck -warnings-as-errors -target arm64-apple-ios15.1-simulator` de um host Swift mínimo
  (`bridge/swift-interop/MinimalHost.swift`, contra o framework guarda-chuva) que implementa `Transport`,
  `WatchLogger`, `SampleStore`, `WatchSessionListener` e `WatchClock`, chama toda a API pública da `WatchSession` e
  usa as grafias acima, os dois `TransportEvents` (com `KotlinByteArray` e com `Data`), o domínio que o host mapeia,
  `CoreHost`, `CoreEventSink`, `CoreCompletion` e todo o `CoreBridge`. O `./gradlew :bridge:checkObjcInterop` faz o
  mesmo para o shim (`bridge/objc-interop/MinimalTurboModule.mm`, `clang++ -fsyntax-only -Werror`). Um nome que esse
  arquivo usa e que mude no Repo 1 quebra o build de lá antes de quebrar o `CentralTransport`; um nome que ele não usa
  não é conferido (a lista está no `bridge/swift-interop/README.md` de lá). O 15.1 é o mínimo deste pod.

## Payloads para o JS: `NSDictionary` e `CFBoolean`

O contrato JS (payloads, estados, `deletedSavedData`, códigos do host, fila de eventos, pedidos em andamento) e o
`CoreBridge` estão no módulo `:bridge` do Repo 1, em código comum, e vêm no mesmo framework (`docs/arquitetura.md` de
lá, seções 12 e 13; ADRs 20 e 21); o host Android também os usa. Os payloads são `Map<String, Any?>`, que no Swift
aparece como `[String: Any]`; o React Native, porém, separa `true`/`false` de número pela classe (`__NSCFBoolean`), e
o Kotlin/Native entrega todo `Boolean` como `KotlinBoolean`, que viraria `1`/`0` no JS. A conversão pronta:

| Uso no host | Swift |
|---|---|
| payload de um evento, antes do `emitOnX:` | `FoundationConverter.shared.toDictionary(payload: map)` |
| lista (o retorno de `getLogs`) | `FoundationConverter.shared.toArray(values: list)` |
| valor solto (o `isConnected`) e todo `resolve` de uma `CoreCompletion` | `FoundationConverter.shared.toArray(values: [value])[0]` (`nil` vai como está) |

No Objective-C: `[TWPFoundationConverter.shared toDictionaryPayload:map]` e `toArrayValues:`. Não existe conversor de
valor solto: um `Boolean` que sai de uma função Kotlin chega sempre como `KotlinBoolean`, então o valor vai numa lista
de um elemento e é lido fora do Kotlin. Um `Bool` do Swift já é `CFBoolean` (`NSNumber(value: true)`), então um valor
que o próprio host cria não precisa de conversão. Testes no simulador (o tipo lido pelo Core Foundation):
`FoundationConverterTest` do Repo 1.

O `CoreBridge` monta os payloads por dentro; o host só precisa do `EventMapper` se montar um evento por conta própria.
Exceção Kotlin que cruza para o Swift sem `@Throws` encerra o processo. Por isso `startOfDayIso(dayKey:)`,
`sleepDay(session:)` e `historySleep(sessions:)`, que lançam com um `dayKey` inválido, são `throws` no Swift e se
chamam com `try` (ADR 20 do Repo 1).

## Threading visto pelo host iOS

O `RealtimeReplayTest` do Repo 1 rodou a gravação real no simulador com o dispatcher de produção e os eventos vindos
de um `dispatch_queue_create` serial, como a fila de delegate (`docs/fixtures.md` de lá, seção 4.2). O que isso diz
para o `CentralTransport` e o `CoreGraph`:

- `session.events.onX` pode ser chamado direto da fila de delegate; cada chamada só enfileira (a mais lenta medida
  ficou abaixo de 1,5 ms no simulador).
- Os callbacks do `WatchSessionListener` (o do `CoreBridge`, que daí chama o `CoreHost` e o `CoreEventSink`) nunca
  rodam na fila de delegate e saem um por vez (o dispatcher serial é
  conferido à parte, pelo `SessionThreadingTest` de lá, porque o replay não distingue), mas **a thread do sistema
  muda**: no iOS o `Dispatchers.Default` do Kotlin roda no pool do GCD, o mesmo que executa a fila de delegate
  em outros momentos. Não use thread-local nem compare `Thread.current`. Para emitir ao JS da thread da sessão, o Android
  se apoia no `AsyncEventEmitter`, que é C++ comum (`arquitetura.md`, "Emitir eventos fora da thread JS"); conferir no
  `NativeCoreNextSpecBase` gerado para iOS que o `emitOnX` passa pelo mesmo caminho antes de assumir o mesmo.
- O `WatchLogger` do host tem de ser thread-safe (fila serial própria ou trava, como o `RingLogger` sincronizado do
  Android): ele é chamado de mais de uma thread, às vezes ao mesmo tempo. `getStepsDays`, `getSleepSessions` e
  `confirmUploaded` logam na thread de quem chama (a do TurboModule, como no Android); o construtor da `WatchSession`
  também, se o `SampleStore` falhar ao carregar; e, depois de `session.close()`, um evento atrasado que o
  `CentralTransport` entregue (a resposta ao `disconnect` do próprio `close`) é descartado com um `WatchLogger.log` em
  DEBUG na fila de delegate. O resto sai na thread da sessão (KDoc de `WatchLogger` no Repo 1). O logger não deve
  lançar (um Swift sem `throws` não lança exceção Kotlin, mas um `fatalError` ou uma exceção Objective-C derrubam o
  processo de qualquer jeito); uma exceção Kotlin que um logger lançasse seria engolida nas consultas síncronas e no
  construtor, mas faria falhar a operação em andamento no link, no driver e no sync (KDoc de `WatchLogger`).
- Depois de `session.close()`, um pedido novo termina com `onError(CANCELLED)` na thread de quem chamou, e esse
  callback pode coincidir com os últimos do próprio `close`.

## Outras diferenças a cobrir

- `CBCentralManagerOptionShowPowerAlertKey` (o Core atual liga, `SMAService.m:48`) e o mapeamento de
  `centralManagerDidUpdateState` para `onBluetoothStateChanged` (com os ganchos `onBluetoothTurnedOff`/`On` do
  `CoreBridge` em volta, seção "Sem regra no host"). Contrato do Bluetooth desligado ("contrato B",
  `transporte-android.md#eventos-de-conexão`): em `.poweredOff`, entregar só `onBluetoothStateChanged(false)` e
  **nenhum** `onDisconnected` para o periférico conectado ou a conexão pendente, e não emitir nada num `disconnect()`
  seguinte até um `connect()` novo. É o comportamento natural do CoreBluetooth (não chama `didDisconnectPeripheral`
  nesse caso), e o Android foi alinhado a ele. Estado inicial: se o central já nasce `.poweredOff`, entregar o mesmo
  `false`, como o `reportBluetoothOffAtStartup` do Android.
- Reconexão: `connect(peripheral)` sem timeout já é a conexão pendente do iOS; `retrievePeripherals(withIdentifiers:)`
  pelo UUID salvo substitui o scan por MAC do Android. **Segundo plano:** depois de uma tentativa que falhou, a sessão
  espera 2 s, 4 s… até 60 s num `delay` de corrotina (`SessionEngine.scheduleReconnect` no Repo 1) sem `connect`
  pendente no host; com o app suspenso, nada acorda o app e a reconexão para. No iOS a espera deveria ser o próprio
  `connect` pendente. É mudança na sessão do Repo 1 e está anotada no `docs/pendencias.md` de lá, seção "iOS".
- `address` no iOS é o UUID do periférico (muda se o app for reinstalado): o pareamento salvo não sobrevive à
  reinstalação.
- Bugs do Core atual que não devem ser reproduzidos: `disconnectCurrentDevice` apaga todo o `NSUserDefaults` do app
  (`removePersistentDomainForName`, `SMAService.m:148-149`), bateria passada como dicionário onde o método espera um
  inteiro (`SMAService.m:1237-1241`), `isConnected` sempre `NO` (`SMAService.m:1509-1511`).

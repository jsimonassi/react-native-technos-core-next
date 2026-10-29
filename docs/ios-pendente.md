# iOS: o que falta e as armadilhas já mapeadas

Nada do iOS foi implementado nesta PoC. O Repo 1 já gera `TechnosWatchProtocol.xcframework` (estático, prefixo
`TWP`, sem `suspend`/`Flow` na API pública) e o pod tem só o esqueleto (`ios/README.md`). Este documento junta o que
se sabe para a etapa seguinte. Fontes: Core iOS atual (`TechnosWareCore/ios/smaBluetooth/SMAService.m`), SDK SMA
iOS (`TechnosWareCore/examples/basic/ios/Pods/SmaTechnosIosSdk/BLEAPI/SmaBLE.m`) e o header gerado do XCFramework.

## Peças

| Peça | Linguagem | Papel |
|---|---|---|
| `CentralTransport` | Swift | Implementa `TWPTransport` sobre `CBCentralManager`/`CBPeripheral`; dono do central. |
| `CoreNext.bootstrap(launchOptions:)` | Swift | Cria o `CentralTransport.shared` no launch do app (restauração). |
| `CoreGraph` | Swift | `WatchSession(transport:logger:store:)`, store, prefs, logger; um por processo, como no Android. |
| `RCTNativeCoreNext.mm` | ObjC++ | Shim do TurboModule: conforma ao `NativeCoreNextSpec` do codegen e delega ao Swift. |

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
- Decisão para o iOS: informar à sessão (`onMtuChanged`) `maximumWriteValueLength(for: .withoutResponse) + 3`
  (reflete o MTU real) ou fixar `Quirks.maxFragment = 20` no perfil para iOS; manter `.withResponse` só como tipo de
  escrita. O iOS não negocia MTU pelo app: `requestMtu` responde na hora com o MTU efetivo.

## Escrita sem resposta

No Android, `onCharacteristicWrite` chega também para `WRITE_TYPE_NO_RESPONSE`, e a `GattQueue` avança igual. No iOS
**não há `peripheral(_:didWriteValueFor:error:)` para `.withoutResponse`**: a fila precisa usar
`canSendWriteWithoutResponse` e `peripheralIsReady(toSendWriteWithoutResponse:)` e completar a operação na hora em
que o write é aceito. Alternativa na PoC iOS: aceitar só `.withResponse` (é o que a SDK usa).

## Descoberta e notificações

- O Core iOS atual casa só o NUS: write `6E400002`, notify `6E400003` (`SMAService.m:1054-1061`); a ordem de
  candidatos (`FF60` antes do NUS) é da sessão, como no Android.
- `setNotifyValue(true, for:)` → `didUpdateNotificationStateFor` vira `onNotificationsEnabled`.
- Notificações chegam em `didUpdateValueFor`; entregar uma por chamada, na ordem, com cópia dos bytes.
- UUIDs: `CBUUID.uuidString` vem em maiúsculas e às vezes curto (`FF60`); passar por `GattUuid.normalize`.

## Shim ObjC++

O `.mm` precisa conformar ao protocolo ObjC++ `NativeCoreNextSpec` (JSI) gerado pelo codegen e implementar **todos**
os métodos do spec (hoje 23) delegando ao Swift, mais receber do Swift as emissões, que vivem na
`NativeCoreNextSpecBase`. Estimativa: 150 a 250 linhas, não 40. Exige `CoreNext-Swift.h` importável num pod estático
(`DEFINES_MODULE = YES`) e um app com pelo menos um arquivo `.swift` e bridging header (o `examples/basic` tem; o
Mormaii não foi verificado).

## Bytes: `NSData` ↔ `KotlinByteArray`

O header gerado expõe bytes como `TWPKotlinByteArray` (`Transport.write(... value:)`, `TransportEvents.onNotification`,
`WatchLogger.frame`). Converter em Swift byte a byte (`KotlinByteArray(size:)` + `set(index:value:)`) funciona e custa
pouco para pacotes de até ~250 bytes. Mais limpo: o Repo 1 ganhar no `iosMain` funções de conversão
(`ByteArray.toNSData()`/`NSData.toByteArray()` com `memcpy`) e sobrecargas que aceitem `NSData`; hoje o `iosMain` não
tem nenhuma (só o header gerado foi verificado).

## Outras diferenças a cobrir

- `CBCentralManagerOptionShowPowerAlertKey` (o Core atual liga, `SMAService.m:48`) e o mapeamento de
  `centralManagerDidUpdateState` para `onBluetoothStateChanged`.
- Reconexão: `connect(peripheral)` sem timeout já é a conexão pendente do iOS; `retrievePeripherals(withIdentifiers:)`
  pelo UUID salvo substitui o scan por MAC do Android.
- `address` no iOS é o UUID do periférico (muda se o app for reinstalado): o pareamento salvo não sobrevive à
  reinstalação.
- Bugs do Core atual que não devem ser reproduzidos: `disconnectCurrentDevice` apaga todo o `NSUserDefaults` do app
  (`removePersistentDomainForName`, `SMAService.m:148-149`), bateria passada como dicionário onde o método espera um
  inteiro (`SMAService.m:1237-1241`), `isConnected` sempre `NO` (`SMAService.m:1509-1511`).

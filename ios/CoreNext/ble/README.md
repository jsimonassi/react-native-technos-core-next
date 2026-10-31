# `ble/` (iOS)

Tudo que fala com o CoreBluetooth: a implementação do `Transport` do Repo 1 e o scan. Par do `ble/` do Android.

## Tipos

| Tipo | Papel |
|---|---|
| `HostTransport` | O que o `CoreGraph` precisa de um transporte além do `Transport`: estado do Bluetooth e da autorização, scan, MTU para a gravação, e o `HostTransportDelegate` (ganchos de Bluetooth e scan, e as opções do `connect`, `transportConnectOptions`). Implementado pelo `CentralTransport` e, nos testes, pelo `ReplayTransport`. |
| `CentralTransport` | `Transport` sobre `CBCentralManager`/`CBPeripheral`, numa fila serial própria (o central entrega os callbacks nela). Endereço = UUID do periférico; conexão pendente = `central.connect` sem timeout, com as opções que o delegate devolver (`connectOptions(transportBridging:)`: `CBConnectPeripheralOptionEnableTransportBridgingKey` para o Condor Reebok, como a SDK iOS CRP; nenhuma para os outros; as opções vão para o log); escrita com resposta por `didWriteValueFor` e sem resposta por `canSendWriteWithoutResponse`/`peripheralIsReady(toSendWriteWithoutResponse:)`, no tipo pedido só se a characteristic o declara (`effectiveWriteType`; o `discoverServices` loga as propriedades); `requestMtu` respondido na hora com `maximumWriteValueLength(for: .withoutResponse) + 3`; notificações pela sobrecarga com `Data`; UUIDs pelo `GattUuid.normalize`; scan sem filtro de serviço por 7 s, filtrado pelo `DeviceRegistry`; restauração com `CBCentralManagerOptionRestoreIdentifierKey` quando o app declara `bluetooth-central`. |
| `RestoredPeripherals` | Sem CoreBluetooth: os periféricos do `willRestoreState` que nenhum `connect()` da sessão reclamou. O `didConnect` de um deles com o transporte livre fica aberto (num relançamento ele chega antes do `connect()` da sessão); reclamado, volta a ser cancelado como conexão velha; sem dono em 10 s, a conexão é cancelada. |
| `RearmBackoff` | Sem CoreBluetooth: a espera antes de re-armar uma conexão pendente que falhou. Na hora depois de uma tentativa que esperou 5 s ou mais; 1, 2, 4… até 30 s só para falhas rápidas seguidas (o app suspenso não roda timer). O vínculo apagado no relógio não re-arma (ver Invariantes). |
| `LinkLifecycle` | Sem CoreBluetooth: quando sai `onConnected`/`onDisconnected` (um por link ou `disconnect()` com algo aberto, exatamente um por `connect` recusado, nenhum no Bluetooth desligado nem de tentativa antiga). Mesmas regras do Android. |
| `GattQueue` | Uma operação por vez, cada uma terminada pelo callback, pela própria partida (MTU, escrita sem resposta aceita) ou por timeout (4 s; descoberta 15 s), com espera de crédito para a escrita sem resposta. |
| `BluetoothPowerTracker` / `BluetoothPower` | O que cada `centralManagerDidUpdateState` entrega: `false` uma vez por desligamento (também no primeiro estado, se o central já nasce desligado, sem autorização ou sem BLE), `true` só ao religar, e no primeiro `.poweredOn` só o aviso ao `CoreBridge`. |

## Não faz

Não decide quando conectar, reconectar ou desistir (a sessão decide; o `CoreBridge` reconecta no primeiro `.poweredOn`
do processo, mesmo sem JS, ao religar o Bluetooth, ao voltar ao primeiro plano e no `initialize`). Não interpreta bytes
nem loga pacotes (a sessão loga pelo `WatchLogger.frame`). Não sabe de família: tipo de escrita, CCCD (inclusive as de
outros serviços, como `2a37` e `2a19` do Condor Reebok) e MTU vêm da sessão, que lê o perfil; as opções do `connect`
vêm do grafo, que lê o quirk; o transporte só troca o tipo quando a characteristic não declara o pedido. Não cria nem
remove vínculo clássico (o iOS não deixa; o `IosCoreHost` responde "não suportado").

## Invariantes

- O estado do `CentralTransport` só é tocado na fila `br.com.grupotechnos.corenext.ble`; `isPoweredOn` e `currentMtu`,
  lidos de qualquer thread, ficam atrás de uma trava.
- Toda operação com `requestId` termina com exatamente um evento (inclusive na queda: `failAll(NOT_CONNECTED)`).
- `disconnect()` emite um `onDisconnected` só se havia link aberto ou conexão pendente; com o Bluetooth desligado
  (`.poweredOff`, `.unauthorized`, `.unsupported`, `.resetting`) sai só `onBluetoothStateChanged(false)` e o transporte
  fica parado até o próximo `connect()` (contrato B, ADR 18 do Repo 1).
- `didDisconnectPeripheral` sem link aberto é o eco de um `cancelPeripheralConnection` e é descartado. `didConnect` de
  quem não é a tentativa atual é cancelado, salvo o de um periférico restaurado ainda sem dono com o transporte livre.
- Uma escrita nunca sai num tipo que a characteristic não declara (o CoreBluetooth a descartaria em silêncio): cai no
  outro tipo declarado, com WARN, ou termina com status 3.
- Um `NSError` com código 0 vira status 257, para nunca parecer `GattStatus.SUCCESS`.
- `CBError.peerRemovedPairingInformation` (domínio `CBErrorDomain`, código 14: o iPhone guarda um vínculo que o relógio
  apagou) vira `GattStatus.PAIRING_REMOVED` (-4), com um WARN que diz o que o usuário tem de fazer (esquecer o relógio
  em Ajustes > Bluetooth). Numa conexão pendente, a falha não é re-armada: o `LinkLifecycle` a termina com um
  `onDisconnected`, como a direta, e a sessão para com `PAIRING_REMOVED` (ADR 23 do Repo 1). A tradução
  (`CentralTransport.linkStatus`) vale só onde a sessão a trata: conexão que falhou ou caiu, descoberta e CCCD. Numa
  escrita ou leitura o erro fica com o código nativo (14). O 14 do `CBATTErrorDomain` é outro erro e também fica com o
  código nativo.
- Sem `NSBluetoothAlwaysUsageDescription` no `Info.plist` o central não é criado (o iOS encerraria o app): o Core fica
  sem Bluetooth e loga um ERROR.

## Testes

`LinkLifecycleTests`, `BluetoothPowerTrackerTests`, `GattQueueTests`, `RestoredPeripheralsTests`, `RearmBackoffTests`,
`WriteTypeTests`, `TransportStatusTests` e `TransportOptionsTests` (o transport bridging só com o quirk do perfil)
(`../../Tests/`), no simulador. O resto exige iPhone e relógio: roteiro no
[`example/README.md`](../../../example/README.md#rodar-no-iphone).

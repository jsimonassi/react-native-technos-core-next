# `ble/`

Tudo que fala com a pilha Bluetooth do Android. É a implementação do `Transport` do Repo 1 e mais o que fica fora
dele (scan, estado do adaptador, serviço em primeiro plano, vínculo Bluetooth clássico).

## Tipos

| Tipo | Papel |
|---|---|
| `AndroidGattTransport` | `Transport` sobre `BluetoothGatt`. `HandlerThread` própria; cria um `BluetoothGatt` novo a cada `connect`; re-arma só a conexão pendente (`autoConnect`) que falha sem conectar; depois de uma queda de link para e deixa a sessão reconectar; com o Bluetooth desligado para sem `onDisconnected` (contrato B). Avisa a sessão se o Bluetooth já está desligado na partida (`reportBluetoothOffAtStartup`). |
| `LinkLifecycle` | Kotlin puro: estado do link (geração do GATT, link aberto, conexão pendente) e a regra de quando sai `onConnected`/`onDisconnected`: um `onDisconnected` por link ou `disconnect()` com algo aberto, exatamente um por `connect` recusado, nenhum no Bluetooth desligado nem de callback atrasado. |
| `GattQueue` | Uma operação GATT por vez (descoberta, CCCD, MTU, write, read), liberada pelo callback ou por timeout de 4 s (`GattStatus.TIMEOUT`). |
| `BleScanner` | Scan de 7 s com filtros por nome e por serviço tirados de `Profiles.all` (`filterSpec`: `Mormaii_fitGPS`, `Life Ultra GPS`, `Smart Watch 6010`, `0af0`…), ou sem filtro nenhum quando algum perfil aceita prefixo de nome (`bleNamePrefixes`; hoje o Condor Reebok, `P85`); passa cada resultado por `DeviceRegistry.identify`; um evento por endereço por scan. |
| `ClassicBonder` | Vínculo Bluetooth clássico (BR/EDR) dos perfis com `Quirks.classicBond` (Condor Reebok): `hasBond` (`BOND_BONDED`), `request` (`createBond(TRANSPORT_BREDR)` por reflexão, com `createBond()` de reserva, receiver de `ACTION_BOND_STATE_CHANGED` filtrado pelo endereço, 45 s por tentativa, uma nova tentativa automática) e `remove` (`removeBond()` por reflexão, melhor esforço; com o Bluetooth desligado, a remoção fica pendente nas preferências `corenext_classic_bond` e roda em `onBluetoothOn` ou na partida, `resumePendingRemovals`; com o vínculo em curso, `cancelBondProcess()` por reflexão e um receiver que remove o vínculo se ele aparecer depois). Thread principal. Não abre HFP nem A2DP: o Android abre sozinho depois do vínculo. |
| `ClassicBondRemoval` | Kotlin puro: o passo do esquecer conforme o adaptador e o estado do vínculo (Bluetooth desligado → esperar, porque o `getBondState()` devolve `BOND_NONE` sem olhar; `BONDED` → remover; `BONDING` → cancelar e vigiar; `NONE` → nada) e a lista `PendingBondRemovals`, guardada entre processos. |
| `ClassicBondTracker` | Kotlin puro: a regra das tentativas do `ClassicBonder` (falha = `createBond` recusado, `BONDING → NONE` ou prazo vencido; a primeira falha vira nova tentativa em 1,5 s, a segunda, falha do pedido; `BOND_BONDED` é sucesso). |
| `BluetoothStateReceiver` | `ACTION_STATE_CHANGED` → `STATE_ON`/`STATE_OFF`. |
| `SyncForegroundService` | FGS `connectedDevice` só durante o sync; falha ao subir vira `WARN`, o sync continua. |
| `BlePermissions` | Confere permissões e adaptador (não pede nada). |

## Não faz

Não decide quando conectar, reconectar ou desistir (a sessão decide; o `CoreBridge` do Repo 1 decide reconectar ao
voltar para o app ou ao religar o Bluetooth, e o `CoreGraph` só o avisa). Não interpreta bytes. Não loga pacotes (quem
loga é a sessão, pelo `WatchLogger.frame`, numa linha `Frame/<uuid>` por pacote; o resumo por frame remontado, com
`seq`, rótulo e CRC, sai nas linhas `SmaDriver/frame` e `IdoDriver/frame` do Repo 1). Não sabe de família: o tipo de
escrita, quais CCCD ligar (inclusive as de outros serviços, como `2a37` e `2a19` do Condor Reebok) e se pede MTU vêm
da sessão, que lê o perfil; o vínculo clássico só é pedido quando o `CoreBridge` manda, pelo quirk do perfil. Não
decide o que fazer com uma recusa do vínculo (o `CoreBridge` emite `CLASSIC_BOND_FAILED` e não pede de novo até o
próximo `pairDevice`).

## Depende de

Repo 1 (`transport/`, `profile/`, `log/`), SDK Android. Não usa o `:bridge`: o `ClassicBonder` devolve o próprio
`Outcome`, que o `AndroidCoreHost.kt` converte em `ClassicBondResult`. Montado pelo `CoreGraph`; o `AndroidCoreHost`
usa `BlePermissions`, o `BleScanner`, o `SyncForegroundService` e o `ClassicBonder` quando o `CoreBridge` pede.

## Invariantes

- Estado do `AndroidGattTransport` só é tocado na thread "corenext-gatt".
- Toda operação com `requestId` termina com exatamente um evento (inclusive em queda: `failAll(NOT_CONNECTED)`).
- `disconnect()` emite um `onDisconnected` só se havia link aberto ou conexão pendente (ADR 12 do Repo 1). Bluetooth
  desligado entrega só `onBluetoothStateChanged(false)`, nenhum `onDisconnected`, e deixa o transporte parado até o
  próximo `connect()` (contrato B, em `docs/transporte-android.md`).
- Nunca chama `BluetoothGatt.refresh()` por reflexão.
- Cada `ClassicBonder.request` termina com exatamente um resultado (o `CoreHost` exige): já vinculado, sucesso, falha
  das tentativas, pedido substituído ou cancelado por um `remove` do mesmo endereço (os dois últimos como falha; a do
  cancelamento o `CoreBridge` só loga, porque o pedido foi abandonado pelo esquecer).
- Um `remove` nunca conclui "sem vínculo" com o Bluetooth desligado: a remoção fica pendente (também entre processos)
  até o Bluetooth ligar, e um `request` do mesmo endereço a descarta (o relógio foi pareado de novo).

## Testes

`GattQueueTest` (serialização, timeout, queda), `LinkLifecycleTest` (quando sai `onDisconnected`: Bluetooth desligado
com link aberto ou conexão pendente, `disconnect()` depois disso, `connect` recusado, quedas e callbacks atrasados),
`BleScannerFilterTest` (os filtros do scan cobrem os nomes e serviços de todos os perfis; o prefixo do Condor Reebok
deixa o scan sem filtro; `P85`, `P85-1234` e `Condor Reebok` resolvem para `condorreebok`) e `ClassicBondTrackerTest`
(sucesso, nova tentativa depois de `NONE`, falha na segunda, prazo vencido, já vinculado, `createBond` recusado) e
`ClassicBondRemovalTest` (Bluetooth desligado espera qualquer que seja o estado lido, `BONDED`/`BONDING`/`NONE` com ele
ligado, o diálogo aceito depois do esquecer, a lista pendente entre processos). O
resto exige aparelho: roteiro em `docs/transporte-android.md`.

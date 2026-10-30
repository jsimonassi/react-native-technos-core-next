# `ble/`

Tudo que fala com a pilha Bluetooth do Android. É a implementação do `Transport` do Repo 1 e mais o que fica fora
dele (scan, estado do adaptador, serviço em primeiro plano).

## Tipos

| Tipo | Papel |
|---|---|
| `AndroidGattTransport` | `Transport` sobre `BluetoothGatt`. `HandlerThread` própria; cria um `BluetoothGatt` novo a cada `connect`; re-arma só a conexão pendente (`autoConnect`) que falha sem conectar; depois de uma queda de link para e deixa a sessão reconectar; com o Bluetooth desligado para sem `onDisconnected` (contrato B). Avisa a sessão se o Bluetooth já está desligado na partida (`reportBluetoothOffAtStartup`). |
| `LinkLifecycle` | Kotlin puro: estado do link (geração do GATT, link aberto, conexão pendente) e a regra de quando sai `onConnected`/`onDisconnected`: um `onDisconnected` por link ou `disconnect()` com algo aberto, exatamente um por `connect` recusado, nenhum no Bluetooth desligado nem de callback atrasado. |
| `GattQueue` | Uma operação GATT por vez (descoberta, CCCD, MTU, write, read), liberada pelo callback ou por timeout de 4 s (`GattStatus.TIMEOUT`). |
| `BleScanner` | Scan de 7 s com filtros por nome (`Mormaii_fitGPS`) e por serviço; passa cada resultado por `DeviceRegistry.identify`; um evento por endereço por scan. |
| `BluetoothStateReceiver` | `ACTION_STATE_CHANGED` → `STATE_ON`/`STATE_OFF`. |
| `SyncForegroundService` | FGS `connectedDevice` só durante o sync; falha ao subir vira `WARN`, o sync continua. |
| `BlePermissions` | Confere permissões e adaptador (não pede nada). |

## Não faz

Não decide quando conectar, reconectar ou desistir (a sessão decide; o `CoreBridge` do Repo 1 decide reconectar ao
voltar para o app ou ao religar o Bluetooth, e o `CoreGraph` só o avisa). Não interpreta bytes. Não loga pacotes (quem
loga é a sessão, pelo `WatchLogger.frame`, numa linha `Frame/<uuid>` por pacote; o resumo por frame remontado, com
`seq`, rótulo e CRC, sai nas linhas `SmaDriver/frame` do Repo 1).

## Depende de

Repo 1 (`transport/`, `profile/`, `log/`), SDK Android. Montado pelo `CoreGraph`; o `AndroidCoreHost` usa
`BlePermissions`, o `BleScanner` e o `SyncForegroundService` quando o `CoreBridge` pede.

## Invariantes

- Estado do `AndroidGattTransport` só é tocado na thread "corenext-gatt".
- Toda operação com `requestId` termina com exatamente um evento (inclusive em queda: `failAll(NOT_CONNECTED)`).
- `disconnect()` emite um `onDisconnected` só se havia link aberto ou conexão pendente (ADR 12 do Repo 1). Bluetooth
  desligado entrega só `onBluetoothStateChanged(false)`, nenhum `onDisconnected`, e deixa o transporte parado até o
  próximo `connect()` (contrato B, em `docs/transporte-android.md`).
- Nunca chama `BluetoothGatt.refresh()` por reflexão.

## Testes

`GattQueueTest` (serialização, timeout, queda) e `LinkLifecycleTest` (quando sai `onDisconnected`: Bluetooth desligado
com link aberto ou conexão pendente, `disconnect()` depois disso, `connect` recusado, quedas e callbacks atrasados). O
resto exige aparelho: roteiro em `docs/transporte-android.md`.

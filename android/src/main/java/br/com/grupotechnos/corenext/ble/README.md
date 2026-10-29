# `ble/`

Tudo que fala com a pilha Bluetooth do Android. É a implementação do `Transport` do Repo 1 e mais o que fica fora
dele (scan, estado do adaptador, serviço em primeiro plano).

## Tipos

| Tipo | Papel |
|---|---|
| `AndroidGattTransport` | `Transport` sobre `BluetoothGatt`. `HandlerThread` própria; cria um `BluetoothGatt` novo a cada `connect`; re-arma só a conexão pendente (`autoConnect`) que falha sem conectar; depois de uma queda de link para e deixa a sessão reconectar; um `onDisconnected` por link. |
| `GattQueue` | Uma operação GATT por vez (descoberta, CCCD, MTU, write, read), liberada pelo callback ou por timeout de 4 s (`GattStatus.TIMEOUT`). |
| `BleScanner` | Scan de 7 s com filtros por nome (`Mormaii_fitGPS`) e por serviço; passa cada resultado por `DeviceRegistry.identify`; um evento por endereço por scan. |
| `BluetoothStateReceiver` | `ACTION_STATE_CHANGED` → `STATE_ON`/`STATE_OFF`. |
| `SyncForegroundService` | FGS `connectedDevice` só durante o sync; falha ao subir vira `WARN`, o sync continua. |
| `BlePermissions` | Confere permissões e adaptador (não pede nada). |

## Não faz

Não decide quando conectar, reconectar ou desistir (a sessão decide; o `CoreGraph` decide reconectar ao voltar
para o app ou ao religar o Bluetooth). Não interpreta bytes. Não loga frames (quem loga é a sessão, pelo
`WatchLogger.frame`, para o log ter o resumo `seq/cmd/key`).

## Depende de

Repo 1 (`transport/`, `profile/`, `log/`), SDK Android. Usado por `CoreGraph`.

## Invariantes

- Estado do `AndroidGattTransport` só é tocado na thread "corenext-gatt".
- Toda operação com `requestId` termina com exatamente um evento (inclusive em queda: `failAll(NOT_CONNECTED)`).
- Nunca chama `BluetoothGatt.refresh()` por reflexão.

## Testes

`GattQueueTest` (serialização, timeout, queda). O resto exige aparelho: roteiro em `docs/transporte-android.md`.

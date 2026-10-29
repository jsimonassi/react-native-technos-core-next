# Transporte Android

Como o `ble/AndroidGattTransport` implementa o `Transport` do Repo 1 e o que fica em volta (scan, Bluetooth on/off,
serviço em primeiro plano). A sessão decide *o que* fazer; este documento descreve *como* o Android executa.

Fontes citadas: SDK SMA Android decompilada (`com/bestmafen/...`, só leitura), Core atual
(`TechnosWareCore/android/...`).

## Thread única

Tudo roda na `HandlerThread` "corenext-gatt". Os métodos do `Transport` só fazem `handler.post`, e o `connectGatt`
recebe o mesmo `Handler` (sobrecarga de 6 argumentos, API 26), então os callbacks do `BluetoothGatt` chegam na mesma
thread. Não há lock no estado do transporte. Os eventos para a sessão saem pelo `TransportEvents`, que só enfileira.

## `GattQueue`: uma operação por vez

O Android aceita uma operação GATT pendente por link. Uma segunda chamada antes do callback da primeira devolve
`false` (ou `ERROR_GATT_WRITE_REQUEST_BUSY` na API 33+) e some. A SDK SMA contorna com semáforos de 4 s
(`SmaMessenger.java:36, 54, 96, 142`). Aqui é uma fila:

- Operações: descoberta de serviços, escrita do CCCD, `requestMtu`, `writeCharacteristic`, `readCharacteristic`.
- A operação da frente começa (`start`); se o Android recusar na hora, termina com status de erro e a próxima começa.
- Termina no callback do mesmo tipo (`onServicesDiscovered`, `onDescriptorWrite`, `onMtuChanged`,
  `onCharacteristicWrite`, `onCharacteristicRead`); callback de outro tipo é ignorado.
- Timeout de 4 s por operação → status `GattStatus.TIMEOUT` (-1). A descoberta de serviços tem 15 s: são vários
  round-trips ATT e no primeiro contato 4 s é pouco.
- Queda do link: `failAll(GattStatus.NOT_CONNECTED)` termina a atual e as pendentes, cada uma exatamente uma vez,
  antes do `onDisconnected`. Assim a regra "toda operação com `requestId` termina com um evento" vale também na queda.

Teste: `android/src/test/.../ble/GattQueueTest.kt`.

## Conexão

### Primeiro pareamento: conexão direta

`connect(address, autoReconnect = false)` → `connectGatt(ctx, autoConnect = false, ..., TRANSPORT_LE)`.
`TRANSPORT_LE` explícito porque o relógio também tem lado clássico (a SDK lê o endereço clássico em `2A23`,
`SmaManager.java:218-224`) e sem ele alguns aparelhos tentam BR/EDR. O timeout de 30 s do pareamento é da sessão
(`Quirks.connectTimeoutMs`). Se a conexão direta falha sem nunca conectar (ex.: status 133), sai `onDisconnected`
para a sessão encerrar o pareamento.

### Reconexão: conexão pendente

`connect(address, autoReconnect = true)` → `connectGatt(..., autoConnect = true, ...)`: o controlador fica esperando
o relógio anunciar, sem timeout, com baixo consumo.

Problema: em vários aparelhos o `autoConnect = true` falha em silêncio quando a pilha não tem o tipo de endereço do
relógio em cache (aparelho nunca visto desde o boot; `BluetoothDevice.getType() == DEVICE_TYPE_UNKNOWN`). Por isso,
nesse caso, antes vem um scan de até 10 s filtrado pelo MAC (`SCAN_MODE_LOW_LATENCY`); visto o relógio, abre a
conexão pendente com o `BluetoothDevice` do resultado. Se o scan não achar o relógio (fora de alcance), abre a
conexão pendente assim mesmo e loga `WARN`. A SDK SMA faz um scan antes de cada reconexão pelo mesmo motivo
(`EaseConnector.java:56-60`), mas conecta com `autoConnect = false` e fecha e recomeça a tentativa a cada 18 s
(`EaseConnector.java:25-43`); aqui a conexão pendente fica armada até o relógio voltar.

### Queda e re-arme

Um link que chegou a conectar e caiu sem pedido gera `onDisconnected(status, ...)` e o transporte **para**: não
re-arma nada sozinho. Quem decide reconectar é a sessão do Repo 1: depois de uma queda com o relógio pronto ela chama
`connect(address, true)` na hora; depois de uma queda antes do `READY` numa reconexão, chama com espera crescente; e
num primeiro pareamento que caiu, ou num `forget` em andamento, desiste sem chamar `disconnect()` (`SessionEngine`,
ADR 11 e 12 do Repo 1). Se o transporte re-armasse por conta própria, esses dois últimos casos deixariam uma conexão
pendente escondida para um relógio que falhou ou foi esquecido: quando ele voltasse ao alcance, o link reabriria e a
sessão teria que fechá-lo como "link inesperado" (e, conectado, o relógio para de anunciar, o que atrapalha o scan e o
pareamento seguintes).

O re-arme existe só para a conexão **pendente** (`autoConnect = true`) que falha sem nunca ter conectado: ela volta a
ser armada depois de 1 s, e a espera dobra a cada falha seguida, até 30 s (com o scan acima se preciso). É o "host
mantém a conexão pendente" do estado `RECONNECTING` da sessão. `Transport.disconnect()` ou o Bluetooth desligar
cancelam esse re-arme. Se a sessão chamar `connect(address, true)` de novo durante ele, o transporte fecha o pendente
e cria outro (idempotente).

### Um `BluetoothGatt` por conexão

Cada `connect` fecha (`disconnect()` + `close()`) o `BluetoothGatt` anterior e cria outro. Cada `BluetoothGatt` tem
seu callback com um número de geração; callbacks de um GATT já fechado são ignorados. Reaproveitar um GATT entre
tentativas deixa callbacks atrasados de uma tentativa caírem na seguinte.

### Eventos de conexão

- Para cada `onConnected` sai exatamente um `onDisconnected` (queda, `disconnect()`, `connect` que substitui o link,
  Bluetooth desligado).
- `disconnect()` termina com exatamente um `onDisconnected(0, ...)` quando havia link aberto ou conexão pendente
  (inclusive re-arme agendado), e com nenhum quando não havia: depois de outro `disconnect()`, de uma conexão
  direta que já falhou com evento ou de uma queda de link (que já saiu como `onDisconnected`). É o contrato do `Transport.disconnect` (ADR 12 do Repo 1); a sessão conta essas
  respostas, e um evento a mais derrubaria a tentativa seguinte.
- Falha de uma conexão *pendente* que nunca conectou não gera evento (só log e re-arme): a sessão já está em
  `RECONNECTING` e não há o que avisar.
- `connect` com Bluetooth desligado, sem `BLUETOOTH_CONNECT` ou com MAC inválido termina com `onDisconnected` na hora.

### Sem `refresh()`

O transporte nunca chama `BluetoothGatt.refresh()` por reflexão (a SDK chama a cada fechamento,
`EaseConnector.java:118, 129-141`): é API oculta, entra na lista de restrições de API não-SDK e apaga o cache de
serviços que acelera a reconexão.

## Descoberta, CCCD e MTU

- `discoverServices()` → `onServicesDiscovered(services, status)` com cada serviço e characteristic em UUID de 128 bits
  minúsculo (`GattUuid.normalize`) e as flags `canRead` (`PROPERTY_READ`), `canWrite` (`PROPERTY_WRITE`),
  `canWriteWithoutResponse` (`PROPERTY_WRITE_NO_RESPONSE`), `canNotify` (`PROPERTY_NOTIFY` ou `PROPERTY_INDICATE`).
  A escolha entre `FF60/FF61/FF62` e o NUS `6E400001/02/03` é da sessão, pela ordem de `gattCandidates` do perfil.
- `enableNotifications(service, ch)` → `setCharacteristicNotification(ch, true)` e escrita de `01 00`
  (`ENABLE_NOTIFICATION_VALUE`) no descritor `0x2902`, como a SDK (`SmaMessenger.java:62-69`). Se a characteristic só
  tiver `INDICATE`, escreve `02 00`. Sem descritor `0x2902` → `GattStatus.NOT_FOUND`.
- `requestMtu(mtu)` → `onMtuChanged(requestId, mtuEfetivo, status)`. A sessão pede 247 (`Quirks.requestMtu`); a SDK
  pede 512 (`SmaManager.java:204`). Mudança de MTU sem pedido pendente só atualiza o valor efetivo (usado no cabeçalho
  do fixture). Não verificado no relógio: qual MTU o fitGPS aceita.

## Escrita

- O tipo de escrita vem da sessão: `WITH_RESPONSE` → `WRITE_TYPE_DEFAULT`, `WITHOUT_RESPONSE` →
  `WRITE_TYPE_NO_RESPONSE`. A SDK nunca troca o tipo e usa o padrão da characteristic (`SmaMessenger.java:118-119`).
- API 33+: `writeCharacteristic(ch, value, writeType)` (devolve código; o array é copiado pela pilha).
  Abaixo: `ch.writeType = ...; ch.value = ...; writeCharacteristic(ch)`. O mesmo para o descritor.
- O Android chama `onCharacteristicWrite` também para `WRITE_TYPE_NO_RESPONSE`, então a fila avança igual nos dois
  tipos (no iOS não é assim, ver `ios-pendente.md`).
- O transporte copia o array recebido antes de enfileirar: a sessão pode reutilizar o buffer.

## Notificações

`onCharacteristicChanged` → `onNotification(uuid, value.copyOf())`, uma por notificação, na ordem de chegada. A cópia
importa abaixo da API 33, onde o array é o buffer interno da characteristic e é reescrito na notificação seguinte.
Na API 33+ só a sobrecarga nova (com `value`) é tratada; a antiga retorna cedo para não entregar duas vezes.
A remontagem de frames (L1 de 8 bytes em notificação própria, `SmaManager.java:506-528`) é da sessão.

## Scan (`BleScanner`)

- Filtros (OU): nome `Mormaii_fitGPS` (o filtro seguro, igual ao Core atual, `SMAService.java:505-526`) e o serviço de
  cada `GattCandidate` do perfil.
- `SCAN_MODE_LOW_LATENCY`, 7 s (`SMAService.java:625-635`). Um `onScannedDevice` por endereço por scan.
- Cada resultado passa por `DeviceRegistry.identify(nome, serviços anunciados)`. Nome: `scanRecord.deviceName`, e
  `device.name` se o anúncio não trouxer nome.
- **Pergunta aberta (risco 1 do plano):** o fitGPS anuncia o NUS? Cada endereço visto gera uma linha `DEBUG`
  `BleScanner/onScanResult ... advertisedServices=[...]`. Se aparecer um resultado sem nome com o NUS anunciado, a
  resposta é "sim" e o filtro de serviço passa a ter valor.
- O Android limita a 5 inícios de scan em 30 s por app; acima disso o scan "começa" e não devolve nada (só um aviso no
  Logcat do sistema). Tocar `Scan` repetidamente no exemplo pode cair nisso.

## Bluetooth ligado/desligado

`BluetoothStateReceiver` (registrado uma vez por processo) entrega só `STATE_ON` e `STATE_OFF`.

- **Desligou:** o scanner para; o transporte cancela re-arme e scan de reconexão, falha as operações pendentes, fecha
  o GATT, entrega `onDisconnected` (se havia link) e depois `onBluetoothStateChanged(false)`, para o último estado da
  sessão ser `BLUETOOTH_OFF` (`deviceConnectStates` 4).
- **Ligou:** o transporte entrega `onBluetoothStateChanged(true)` e, na mesma thread, logo depois, o `CoreGraph` chama
  `reconnectIfPaired` (ordem garantida: o `reconnect` entra na fila da sessão depois do evento de Bluetooth).

## Serviço em primeiro plano só no sync

`SyncForegroundService` (`foregroundServiceType="connectedDevice"`, `exported="false"`):

- Sobe em `onSyncStarted`; desce em `onSyncFinished`, no `onError` do sync ou se a sessão sair de `READY`/`SYNCING`.
- Notificação de importância baixa no canal `corenext.sync`.
- `onStartCommand` chama `startForeground` antes de qualquer coisa: um `startForegroundService` sem `startForeground` em
  poucos segundos derruba o app, mesmo que o sync já tenha acabado. Por isso `stop()` não usa `stopService`; ele marca
  "não precisa mais" e o próprio serviço se encerra depois de `startForeground`.
- Se o sistema recusar (`ForegroundServiceStartNotAllowedException` com o app em segundo plano, API 31+; ou
  `SecurityException` sem `BLUETOOTH_CONNECT`, API 34+), o sync continua sem o serviço e o log ganha um `WARN`.
- Sem `START_STICKY`, sem serviço permanente, sem `NotificationListener`. Fora do sync a conexão vive pelo
  `BluetoothGatt` com `autoConnect` enquanto o processo existir. Se o sistema matar o processo em segundo plano, a
  conexão some até o app abrir de novo (risco 10 do plano, aceito na PoC).

## Permissões

Declaradas no manifesto da biblioteca: `BLUETOOTH_SCAN` com `usesPermissionFlags="neverForLocation"` (sem a flag o
scan não devolve nada sem localização), `BLUETOOTH_CONNECT`, `FOREGROUND_SERVICE`,
`FOREGROUND_SERVICE_CONNECTED_DEVICE`, `POST_NOTIFICATIONS`; até a API 30, `BLUETOOTH`, `BLUETOOTH_ADMIN` e
`ACCESS_FINE_LOCATION` (o scan BLE exigia localização). O JS pede as de runtime; o nativo confere e rejeita com
`PERMISSION_DENIED`. `POST_NOTIFICATIONS` negada só esconde a notificação do FGS.

## Limites conhecidos

- **Callback atrasado depois de timeout.** Se uma operação estoura os 4 s e o callback chega depois, ele é atribuído à
  operação seguinte se ela for do mesmo tipo. Em prática um timeout de GATT costuma significar link ruim e a sessão
  derruba o comando; o caso fica registrado aqui e no log (`status=-1`).
- **Re-arme da conexão pendente depende de `disconnect()`.** Uma conexão pendente que nunca conectou só é cancelada
  por `Transport.disconnect()` ou Bluetooth desligado. A sessão do Repo 1 sempre chama `disconnect()` quando desiste
  de uma tentativa que ainda não conectou; depois de uma queda de link o transporte já parou sozinho.
- **`autoConnect` em OEMs.** O scan por MAC cobre o caso do cache vazio; outros problemas de OEM não foram testados.
- **Processo morto.** Sem FGS permanente, o Android pode matar o processo em segundo plano (risco 10).
- **minSdk 26.** O transporte usa `connectGatt` com `Handler` (API 26) e `java.time`; um app com minSdk menor não
  consome esta biblioteca.
- **MTU e write type reais do fitGPS** ainda não verificados com o relógio (E3).

## Gravar frames e puxar do aparelho

1. No exemplo, aba Log: `Clear` (começa uma gravação nova), depois parear / ler bateria / sincronizar.
2. `Export` chama `exportLogs()`, que grava em `getExternalFilesDir(null)/corenext/` (o `Share` da mesma aba só manda
   as últimas entradas do log como texto, sem arquivo):
   `frames-<yyyyMMdd-HHmmss>.jsonl` (formato `FrameJsonl` do Repo 1: cabeçalho + um pacote GATT por linha) e
   `logs-<yyyyMMdd-HHmmss>.jsonl` (o anel de log). Devolve o caminho do arquivo de frames.
3. Sem root:
   ```
   adb pull /sdcard/Android/data/br.com.grupotechnos.corenext.example/files/corenext/ ./corenext-export
   ```
4. Copiar o `frames-*.jsonl` para `technos-watch-protocol/fixtures/real/fitgps/<firmware>/<cenário>.jsonl`, com um
   nome que descreva o roteiro (ex.: `pair-battery-version.jsonl`). É a pasta que o `RealFixturesReplayTest` do Repo 1
   lê; o roteiro de gravação e as regras do replay estão em
   [`docs/fixtures.md`](../../technos-watch-protocol/docs/fixtures.md), seções 2 (pastas) e 3.1 (como gravar).

A gravação fica em memória até o `exportLogs()` (o cabeçalho precisa de firmware e MTU, conhecidos só depois do
handshake). Limite de 50 mil pacotes; ao encher, para de gravar com um `WARN`.

Para comparar com o app Mormaii atual, use o log HCI do Android (Opções do desenvolvedor → "Ativar registro de
espionagem HCI Bluetooth"), `adb bugreport` e o Wireshark com filtro `btatt`; o script `hci2jsonl.py` do Repo 1
converte para o mesmo formato.

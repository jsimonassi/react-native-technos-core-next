# Transporte Android

Como o `ble/AndroidGattTransport` implementa o `Transport` do Repo 1 e o que fica em volta (scan, Bluetooth on/off,
serviço em primeiro plano). A sessão decide *o que* fazer; este documento descreve *como* o Android executa.

Fontes citadas: SDK SMA Android decompilada (`com/bestmafen/...`, só leitura), Core atual
(`TechnosWareCore/android/...`) e a gravação com o fitGPS 0.2.1 de 2026-10-29
([O que a gravação do fitGPS mostrou](#o-que-a-gravação-do-fitgps-mostrou)).

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
  antes do `onDisconnected` (quando há um; com o Bluetooth desligado não há). Assim a regra "toda operação com
  `requestId` termina com um evento" vale também na queda.

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

Quem decide quando sai `onConnected`/`onDisconnected` é o `ble/LinkLifecycle` (Kotlin puro, `LinkLifecycleTest` na
JVM); o `AndroidGattTransport` só cuida dos objetos do Android e chama um método dele por acontecimento.

- Para cada `onConnected` sai exatamente um `onDisconnected` (queda, `disconnect()`, `connect` que substitui o link),
  **exceto com o Bluetooth desligado**, que não emite nenhum (abaixo).
- `disconnect()` termina com exatamente um `onDisconnected(0, ...)` quando havia link aberto ou conexão pendente
  (inclusive re-arme agendado), e com nenhum quando não havia: depois de outro `disconnect()`, de uma conexão direta
  que já falhou com evento, de uma queda de link (que já saiu como `onDisconnected`), de um `connect` recusado na hora
  ou do Bluetooth desligado. É o contrato do `Transport.disconnect` (ADR 12 do Repo 1); a sessão conta essas
  respostas, e um evento a mais derrubaria a tentativa seguinte.
- Falha de uma conexão *pendente* que nunca conectou não gera evento (só log e re-arme): a sessão já está em
  `RECONNECTING` e não há o que avisar.
- `connect` com Bluetooth desligado, sem `BLUETOOTH_CONNECT` ou com MAC inválido fecha o que houver, termina com
  exatamente um `onDisconnected` na hora e deixa o transporte parado: um `disconnect()` seguinte não emite nada.
- **Bluetooth desligado ("contrato B").** O transporte entrega `onBluetoothStateChanged(false)` e **nenhum**
  `onDisconnected` para o link aberto ou a conexão pendente que isso derrubou, nem antes nem depois. Depois disso,
  `disconnect()` e os callbacks atrasados do GATT fechado (geração antiga) não emitem nada até um `connect()` novo. Um
  `onDisconnected` que já tinha saído antes do `onBluetoothStateChanged(false)` (a pilha avisou a queda do link antes do
  broadcast `STATE_OFF`) é uma queda comum, tratada como sempre. Do lado da sessão (Repo 1), o Bluetooth desligado zera
  a contagem de desconexões esperadas da ADR 12 e marca o transporte inativo; o `disconnect()` de limpeza que ela ainda
  chame não conta.
  Por quê: é o que o CoreBluetooth faz no iOS (`poweredOff` sem `didDisconnectPeripheral`) e o que o `FakeTransport` do
  Repo 1 já fazia; e a gravação do fitGPS mostrou o Android, antes desta regra, entregando três `onDisconnected` para um
  link só ao desligar o Bluetooth: o do link, o do `connect()` que a sessão fez com o adaptador já desligado e o do
  `disconnect()` seguinte (log `logs-20261029-083254.jsonl`, linhas 101, 109 e 110, ts 1793272958357, 1793272958524 e
  1793272958525). Com a contagem da ADR 12, essa ambiguidade pode fazer a sessão engolir uma queda real e ficar presa
  em `RECONNECTING`.

### Sem `refresh()`

O transporte nunca chama `BluetoothGatt.refresh()` por reflexão (a SDK chama a cada fechamento,
`EaseConnector.java:118, 129-141`): é API oculta, entra na lista de restrições de API não-SDK e apaga o cache de
serviços que acelera a reconexão.

## Descoberta, CCCD e MTU

- `discoverServices()` → `onServicesDiscovered(services, status)` com cada serviço e characteristic em UUID de 128 bits
  minúsculo (`GattUuid.normalize`) e as flags `canRead` (`PROPERTY_READ`), `canWrite` (`PROPERTY_WRITE`),
  `canWriteWithoutResponse` (`PROPERTY_WRITE_NO_RESPONSE`), `canNotify` (`PROPERTY_NOTIFY` ou `PROPERTY_INDICATE`).
  A escolha entre `FF60/FF61/FF62` e o NUS `6E400001/02/03` é da sessão, pela ordem de `gattCandidates` do perfil;
  no Life Ultra GPS o candidato é o serviço `0af0` (escrita `0af6`, notificações `0af7` e `0af2`).
  O fitGPS 0.2.1 expõe só o NUS: a descoberta trouxe `1800`, `1801`, `6e400001` e `180a`, sem `FF60`, nas duas
  conexões gravadas (log `logs-20261029-083254.jsonl`, linhas 14 e 119, ts 1793272450855 e 1793273190432).
- `enableNotifications(service, ch)` → `setCharacteristicNotification(ch, true)` e escrita de `01 00`
  (`ENABLE_NOTIFICATION_VALUE`) no descritor `0x2902`, como a SDK (`SmaMessenger.java:62-69`). Se a characteristic só
  tiver `INDICATE`, escreve `02 00`. Sem descritor `0x2902` → `GattStatus.NOT_FOUND`. A sessão chama uma vez por
  characteristic, uma de cada vez: no iDO, `0af7` e depois `0af2` (`GattCandidate.extraNotify` do Repo 1, a ordem da SDK
  iDO); as notificações das duas vão para a sessão como qualquer outra.
- `requestMtu(mtu)` → `onMtuChanged(requestId, mtuEfetivo, status)`. No fitGPS a sessão pede 247 (`Quirks.requestMtu`);
  a SDK pede 512 (`SmaManager.java:204`). No Life Ultra GPS a sessão não chama `requestMtu` (`requestMtu = 23`; a SDK
  iDO também não pede), e todo frame tem no máximo 20 bytes; o Android 14+ pode negociar um MTU maior sozinho, o que só
  muda o `currentMtu` do cabeçalho da gravação. Mudança de MTU sem pedido pendente só atualiza o valor efetivo (usado no cabeçalho
  do fixture). **Visto no fitGPS 0.2.1:** o pedido de 247 voltou com MTU efetivo **23 e status 0**, ou seja, foi uma
  negociação bem-sucedida para 23, não o caminho de falha da ADR 5 do Repo 1 (log `logs-20261029-083254.jsonl`,
  linhas 17 e 122, ts 1793272450905 e 1793273190489; cabeçalho `"mtu":23` da fixture
  `technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`). Todo pacote da gravação tem no máximo 20 bytes.

## Escrita

- O tipo vem do driver do Repo 1, sem olhar as propriedades descobertas. O SMA pede `WITH_RESPONSE`
  (`SmaDriver.sendFrame` e `SmaDriver.writeControl`), que o transporte traduz para `WRITE_TYPE_DEFAULT`; a SDK SMA nunca
  define o tipo e herda o inicial da characteristic (`SmaMessenger.java:118-119`), e as propriedades da `6e400002` não
  ficam no log, então não se sabe qual tipo ela usa de fato no fitGPS. O iDO pede `WITHOUT_RESPONSE`
  (`WRITE_TYPE_NO_RESPONSE`), como a SDK iDO em produção (`docs/protocolo-ido.md` do Repo 1, seção 1).
- API 33+: `writeCharacteristic(ch, value, writeType)` (devolve código; o array é copiado pela pilha).
  Abaixo: `ch.writeType = ...; ch.value = ...; writeCharacteristic(ch)`. O mesmo para o descritor.
- O Android chama `onCharacteristicWrite` também para `WRITE_TYPE_NO_RESPONSE`, então a fila avança igual nos dois
  tipos (no iOS não é assim, ver `ios-pendente.md`). É obrigatório, não só conveniente: o `BluetoothGatt` marca o link
  ocupado em toda escrita e só o libera nesse callback, e a SDK iDO dá o ritmo das escritas sem resposta exatamente por
  ele. Se um aparelho não o entregar, o timeout de 4 s da fila termina a escrita com `TIMEOUT` e a sessão vê `TRANSPORT`.
- O transporte copia o array recebido antes de enfileirar: a sessão pode reutilizar o buffer.

## Notificações

`onCharacteristicChanged` → `onNotification(uuid, value.copyOf())`, uma por notificação, na ordem de chegada. A cópia
importa abaixo da API 33, onde o array é o buffer interno da characteristic e é reescrito na notificação seguinte.
Na API 33+ só a sobrecarga nova (com `value`) é tratada; a antiga retorna cedo para não entregar duas vezes.
A remontagem de frames (L1 de 8 bytes em notificação própria, `SmaManager.java:506-528`) é da sessão. No fitGPS 0.2.1
com MTU 23, o cabeçalho L1 de 8 bytes chegou sempre sozinho numa notificação (79 de 79 frames RX de dados na fixture
`technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`, ex.: `AB0000061B000000` em atMs 2424 e o resto do BIND_BACK em
2426), mesmo quando o frame inteiro caberia em 20 bytes.

## Scan (`BleScanner`)

- Filtros (OU), tirados de `Profiles.all` do Repo 1 (`BleScanner.filterSpec`, testado no `BleScannerFilterTest`): os
  nomes de cada perfil (`Mormaii_fitGPS`, o filtro seguro, igual ao Core atual, `SMAService.java:505-526`;
  `Life Ultra GPS` e `Smart Watch 6010` no iDO) e o serviço de cada `GattCandidate` (`FF60`, NUS, `0af0`). Um perfil novo
  no Repo 1 entra no scan sem mudança aqui.
- `SCAN_MODE_LOW_LATENCY`, 7 s (`SMAService.java:625-635`). Um `onScannedDevice` por endereço por scan.
- Cada resultado passa por `DeviceRegistry.identify(nome, serviços anunciados)`. Nome: `scanRecord.deviceName`, e
  `device.name` se o anúncio não trouxer nome.
- **O fitGPS 0.2.1 não anuncia o NUS** (era o risco 1 do plano). O anúncio lista `180f`, `180a` e
  `00000001-0000-1000-8000-00805f9b34fb`, sem o NUS e sem `FF60` (linha `BleScanner/onScanResult`,
  `logs-20261029-083254.jsonl` linha 6, ts 1793272444786). Então só o filtro por nome acha o relógio; o filtro de
  serviço fica por compatibilidade com outro firmware que anuncie. Cada endereço visto continua gerando essa linha
  `DEBUG` com `advertisedServices=[...]`, para conferir em outro firmware.
- O Android limita a 5 inícios de scan em 30 s por app; acima disso o scan "começa" e não devolve nada (só um aviso no
  Logcat do sistema). Tocar `Scan` repetidamente no exemplo pode cair nisso.

## Bluetooth ligado/desligado

`BluetoothStateReceiver` (registrado uma vez por processo) entrega só `STATE_ON` e `STATE_OFF`.

- **Desligou:** o scanner para (o `CoreGraph` avisa o `CoreBridge`, `onBluetoothTurnedOff`, que pede o `stopScan` ao
  `AndroidCoreHost`); o transporte cancela re-arme e scan de reconexão, falha as operações pendentes, fecha
  o GATT, fica parado e entrega só `onBluetoothStateChanged(false)`, **sem** `onDisconnected` para o link ou a conexão
  pendente (contrato B, em [Eventos de conexão](#eventos-de-conexão)). A sessão vai direto para `BLUETOOTH_OFF`
  (`deviceConnectStates` 4), sem passar por `RECONNECTING` nem tentar um `connect()` para o adaptador desligado.
- **Já desligado na partida:** o receiver só avisa transições, então o `CoreGraph`, ao ser criado, chama
  `AndroidGattTransport.reportBluetoothOffAtStartup()` depois de registrar o receiver. Se o adaptador está desligado
  (lido na thread do GATT), o transporte entrega o mesmo `onBluetoothStateChanged(false)` e a sessão sai de
  `DISCONNECTED` para `BLUETOOTH_OFF`; o JS vê o estado 4 pelo evento da transição (o primeiro `initialize()` pode ter
  reenviado 0 antes dele) e por qualquer `initialize()` seguinte (que reenvia o estado atual).
  Se o Bluetooth ligar no meio, ou a leitura já o vê ligado e não sai nada, ou o `STATE_ON` do receiver entra na fila
  depois do `false`: o último estado da sessão é o certo.
- **Ligou:** o transporte entrega `onBluetoothStateChanged(true)` e, na mesma thread, logo depois, o `CoreGraph` chama
  `CoreBridge.onBluetoothTurnedOn`, que decide se reconecta (`reconnectIfPaired`; ordem garantida: o `reconnect`
  entra na fila da sessão depois do evento de Bluetooth).

## Serviço em primeiro plano só no sync

`SyncForegroundService` (`foregroundServiceType="connectedDevice"`, `exported="false"`):

- Sobe em `onSyncStarted`; desce em `onSyncFinished`, no `onError` do sync ou se a sessão sair de `READY`/`SYNCING`.
  Quem decide é o `CoreBridge` (`startSyncWork`/`stopSyncWork`); o `AndroidCoreHost` só chama `start`/`stop`.
- Notificação de importância baixa no canal `corenext.sync`.
- O log registra a subida (`SyncForegroundService/onStartCommand`) e a descida de fato
  (`SyncForegroundService/onDestroy`), não só o pedido de parada (`CoreBridge/stopSyncWork`; antes,
  `CoreSessionListener/stopSyncService`).
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
- **Propriedades da `6e400002` não logadas.** O MTU real do fitGPS já é conhecido (23, abaixo); se a characteristic
  aceita `WRITE_NO_RESPONSE` não, porque o transporte não loga as propriedades. Só importa se a sessão um dia escrever
  sem resposta.

## O que a gravação do fitGPS mostrou

Uma sessão com o fitGPS (firmware 0.2.1) e um Android, em 2026-10-29, com dois arquivos exportados:

- **Pacotes**: o export `frames-20261029-083254.jsonl` (o anterior, `frames-20261029-082857.jsonl`, é prefixo exato
  dele), versionado no Repo 1 como
  `technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`. Os dois são iguais byte a
  byte, então todo `atMs` citado aqui vale na fixture. Na tabela, "fixture".
- **Log**: `logs-20261029-083254.jsonl`. Tem o MAC do relógio e nunca vai para o git, como a pasta `corenext-export/`
  em que os dois exports ficaram, então só existe na máquina de quem gravou. Por isso cada citação dele traz a linha e o
  `ts`, a convenção do `docs/fixtures.md` do Repo 1.

Duas conexões: BIND + LOGIN (atMs 0 a 123713) e, depois de 230 s com o Bluetooth desligado, reconexão só com LOGIN
(atMs 739559 a 1090678).

| Ponto | Visto | Fonte |
|---|---|---|
| GATT | Só o NUS: `1800`, `1801`, `6e400001`, `180a`; sem `FF60` | log, linhas 14 e 119 (ts 1793272450855 e 1793273190432) |
| Anúncio | `180f`, `180a`, `00000001-0000-1000-8000-00805f9b34fb`; sem NUS, então só o filtro por nome casa | log, linha 6 (ts 1793272444786) |
| MTU | 247 pedido, 23 negociado com status 0; todo pacote com 20 bytes ou menos | log, linhas 17 e 122 (ts 1793272450905 e 1793273190489); fixture, cabeçalho |
| Notificações | O L1 de 8 bytes chega sempre sozinho (79 de 79 frames RX de dados) | fixture, ex.: atMs 2424 e 2426 |
| Integridade | 161 frames de dados, 0 CRC inválido, 0 NACK, 0 retransmissão | fixture |
| `seq` | O relógio mantém o próprio `seq` de RX entre conexões (0 a 7, depois 8 a 78); o nosso TX recomeça em 1 a cada conexão | fixture, atMs 739795 (`AB00000693000008`) |
| BIND | ACK do relógio em atMs 194 e BIND_BACK em 2424: cerca de 2,2 s, muito abaixo dos 60 s da sessão. O LOGIN respondeu 2 ms depois do ACK (atMs 2804 e 2806) | fixture |
| Avisos espontâneos | Nenhum frame sem pedido (nem `02/70`, nem `04/62`), inclusive em cerca de 384 s e 234 s parados e conectados | fixture |
| Ritmo do sync | `syncHistory` levou 59,3 s; cada uma das 64 páginas de sono (`05/45`, atMs 1032538 a 1090312) levou cerca de 900 ms: cerca de 362 ms do pedido ao ACK do relógio e cerca de 358 ms do nosso ACK ao pedido seguinte | fixture; log, linhas 193 e 1031 (ts 1793273482717 e 1793273542014) |
| Bluetooth desligado | Antes do contrato B, três `onDisconnected` para um link só | log, linhas 101, 109 e 110 (ts 1793272958357, 1793272958524 e 1793272958525) |

Hipóteses do protocolo que a gravação confirmou ou derrubou (H1 a H9) ficam na tabela do `docs/protocolo-sma.md` do
Repo 1; o que falta testar com o relógio está no `docs/pendencias.md` de lá.

## Gravar frames e puxar do aparelho

1. No exemplo, aba Log: `Clear` (começa uma gravação nova), depois parear / ler bateria / sincronizar. Um cenário
   por gravação.
2. `Export` chama `exportLogs()`, que grava em `getExternalFilesDir(null)/corenext/` (o `Share` da mesma aba só manda
   as últimas entradas do log como texto, sem arquivo):
   `frames-<yyyyMMdd-HHmmss>.jsonl` (formato `FrameJsonl` do Repo 1: cabeçalho + um pacote GATT por linha) e
   `logs-<yyyyMMdd-HHmmss>.jsonl` (o anel de log). Devolve o caminho do arquivo de frames. O `recordedAt` do cabeçalho
   é o instante do primeiro pacote (atMs 0), no formato `yyyy-MM-dd'T'HH:mm:ss.SSSxxx`, com milissegundos e offset
   numérico (ex.: `2026-10-29T08:14:10.933-03:00`).
3. Sem root:
   ```
   adb pull /sdcard/Android/data/br.com.grupotechnos.corenext.example/files/corenext/ ./corenext-export
   ```
4. Copiar **só o `frames-*.jsonl` mais recente** do cenário para
   `technos-watch-protocol/fixtures/real/fitgps/<fw>/<cenário>.jsonl` (`<fw>` como `0.2.1`, `<cenário>` em kebab-case
   descrevendo o roteiro, ex.: `pair-battery-version.jsonl`). É a pasta que o `RealFixturesReplayTest` do Repo 1 lê; o
   roteiro de gravação e as regras do replay estão em
   [`docs/fixtures.md`](../../technos-watch-protocol/docs/fixtures.md), seções 2 (pastas) e 3.1 (como gravar).
   - **Exports são cumulativos.** Cada `Export` grava tudo desde o último `Clear`, então um export anterior do mesmo
     cenário é prefixo exato do seguinte (`frames-20261029-082857.jsonl` é prefixo de `frames-20261029-083254.jsonl`).
     Versionar os dois duplicaria o replay.
   - **Nunca versionar `logs-*.jsonl`**: o log tem o MAC do relógio. O arquivo de frames não tem.
   - Um arquivo pode ter uma reconexão no meio (Bluetooth desligado e religado, LOGIN de novo): o harness de replay do
     Repo 1 reproduz isso.

A gravação fica em memória até o `exportLogs()` (o cabeçalho precisa de firmware e MTU, conhecidos só depois do
handshake). Limite de 50 mil pacotes; ao encher, para de gravar com um `WARN`. `Clear` apaga o anel e a gravação:
exporte antes de cada `Clear` (`RingLogger.kt:63-66`).

Para comparar com o app Mormaii atual, use o log HCI do Android (Opções do desenvolvedor → "Ativar registro de
espionagem HCI Bluetooth"), `adb bugreport` e o Wireshark com filtro `btatt`; o script `hci2jsonl.py` do Repo 1
converte para o mesmo formato.

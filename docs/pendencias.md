# Pendências do host e da integração

O que falta no Repo 2 e na integração com o app Mormaii, levantado a partir da primeira gravação com o relógio real
(Mormaii fitGPS, firmware 0.2.1, Android, 2026-10-29). Os dados da gravação estão em
[`transporte-android.md`](transporte-android.md#o-que-a-gravação-do-fitgps-mostrou).

A **validação no relógio** que ainda falta (dois syncs seguidos para ver se o sono é apagado depois de lido; disconnect,
forget e novo pareamento olhando a tela no BIND; caminhada cruzando uma hora cheia, para ver como a hora fecha; robustez do link; H8 com o
app Mormaii iOS; uma noite de sono) foi adiada: o sono já não funcionava no Core atual e isto é uma prova de conceito. O
roteiro fica no [`docs/pendencias.md` do Repo 1](../../technos-watch-protocol/docs/pendencias.md), junto com as
pendências de protocolo; este documento não o repete. O mesmo vale para o Life Ultra GPS (iDO), que ainda não falou
com este app: roteiro no [`example/README.md`](../example/README.md#checklist-com-o-life-ultra-gps-ido) e caixas na
seção "Life Ultra GPS (iDO)" do Repo 1. Do lado do host, o que só o aparelho confirma: que o `onCharacteristicWrite`
chega para as escritas sem resposta (senão a fila espera 4 s e falha com `TIMEOUT`, `transporte-android.md`) e que os
dois CCCD (`0af7`, `0af2`) são aceitos sem vínculo BLE do sistema.

Fontes do app Mormaii: `GTE-Mormaii/src/...`, só leitura.

## 1. Sync de 59 s contra o watchdog de 50 s do app Mormaii

**Visto.** O primeiro `syncDataHistory` levou 59,3 s (`READY -> SYNCING` e `SYNCING -> READY` nas linhas 193 e 1031
de `logs-20261029-083254.jsonl`, ts 1793273482717 e 1793273542014; o log fica fora do git). Quase todo o tempo foi a
leitura de 64 páginas de sono (`05/45`, atMs 1032538 a 1090312 da fixture
`technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`, igual byte a byte ao
export `frames-20261029-083254.jsonl`), cerca de 900 ms cada com MTU 23: cerca de 362 ms do pedido ao ACK do relógio e
cerca de 358 ms do nosso ACK ao pedido seguinte. As páginas trouxeram 1262 registros de 2023-08 a 2024-11,
dados antigos que ficaram no relógio porque o Core de produção nunca lê o `05/45`; viraram 4 sessões, todas podadas
pela retenção. Se o relógio apaga o sono depois de lido (H2), os syncs seguintes serão curtos; isso não foi testado.

**Problema.** O app Mormaii dá o sync por encerrado aos 50 s:

- `startSyncTimeout` marca `COMPLETED` depois de 50 000 ms
  (`src/store/MainStoreContext/WatchInfo/useWatchInfoData/index.ts:142-152`);
- o timer só é iniciado logo depois de chamar `syncDataHistory` (`:414`), e o `handleSyncProgress` não o reinicia
  (`:161-165`);
- passado o timeout, `handleSyncCompleted` retorna cedo porque `isSyncOngoingRef` já é `false` (`:167-170`), o estado
  `COMPLETE_WATCH` nunca chega e o `syncHistoryDataPromises` não roda
  (`src/store/LowerLevelContext/SyncHandlerStoreContext/useSyncHandlerData/useSyncStepsRunner.ts:255-259`): o envio
  ao backend se perde.

Hoje o progresso sai só em 0, 50 e 100 (por etapa, `SyncEngine.kt` do Repo 1), então mesmo um timer que reiniciasse a
cada progresso ficaria cerca de 58 s sem evento durante o sono.

**Opções** (não exclusivas):

1. **Progresso por página e timer reiniciado no progresso.** O Repo 1 emite `onSyncProgress` a cada página lida (o
   formato do evento não muda: `{ progress }` de 0 a 100) e o app chama `startSyncTimeout()` dentro do
   `handleSyncProgress`. Exige mudança nos dois lados; o contrato JS deste repositório não muda.
2. **Sync mais rápido.** No Repo 1, escrever o ACK com `WITHOUT_RESPONSE`, que a `6e400002` declara (no iPhone, em
   2026-10-30: `[write|writeWithoutResponse]`;
   [`ios-pendente.md`](ios-pendente.md#o-que-o-iphone-mostrou-2026-10-30)), ou não bloquear o despacho esperando a confirmação da escrita do ACK; isso tira a espera de cerca de 358 ms por página
   (estimativa: de 900 para 550 ms, cerca de 35 s em 64 páginas). Os cerca de 362 ms até o ACK do relógio são do
   protocolo. Não serve parar a paginação nas páginas antigas: o relógio entrega da mais antiga para a mais nova, então
   isso nunca chegaria às noites recentes.
3. **Prioridade de conexão alta durante o sync.** Neste repositório: pedir
   `BluetoothGatt.requestConnectionPriority(CONNECTION_PRIORITY_HIGH)` quando o sync começa (no
   `AndroidCoreHost.startSyncWork`, que o `CoreBridge` chama no `onSyncStarted` e onde o serviço em primeiro plano
   sobe) e voltar a `BALANCED` no `stopSyncWork`. A SDK SMA faz
   isso nas transferências grandes (`requestHighSpeedMode`, `SmaManager.java:1458`, que chama
   `requestConnectionPriority` em `SmaMessenger.java:163`; usado em `:485`, `:1131` e `:1191`), mas nunca na leitura
   de histórico. Não testado: medir a duração por página com e sem, no mesmo relógio.
4. **Aceitar só no primeiro sync.** Se o H2 do sono se confirmar, só o primeiro sync de cada relógio passa dos 50 s.
   Depende do teste no relógio; sozinha não resolve.

As mesmas frentes, com o que fecha cada uma, estão no item técnico 1 do `docs/pendencias.md` do Repo 1.

Dono: Repo 1 (progresso, ritmo do ACK), este repositório (prioridade de conexão) e app Mormaii (timer).

## 2. Passos ao vivo precisam de polling

**Visto.** O relógio não mandou nenhum frame sem pedido (nem `02/70`, nem `04/62`), inclusive em cerca de 384 s e
234 s conectado e parado (fixture
`technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`). O driver também não liga
o aviso: o `02/6F SYNC_SWITCH` não é enviado porque o payload é desconhecido nas duas SDKs
(`logs-20261029-083254.jsonl`, linhas 49 e 145, ts 1793272457045 e 1793273193878).

**Consequência.** O `onPedometer` espontâneo (`api-js.md`, [`onPedometer`](api-js.md#onpedometer)) não acontece com
este firmware. Para passos ao vivo, alguém tem que chamar `refreshSteps()` periodicamente, como o Core atual faz a cada
10 s (`TechnosWareCore/android/.../SMAService.java:547-603`).

**A decidir.** Onde fica o polling: no JS do app (intervalo enquanto a tela de passos está aberta) ou num timer
nativo da sessão. O primeiro é mais barato de bateria e não muda este repositório.

## 3. `exportLogs` sem `FileProvider`

`exportLogs()` grava em `getExternalFilesDir(null)/corenext/` e devolve o caminho; o arquivo só sai do telefone por
`adb pull` (ou `run-as`, sem armazenamento externo). O `Share` do exemplo manda as últimas 500 entradas como texto,
porque o `Share` do React Native não anexa arquivo no Android. Nem a biblioteca nem o exemplo declaram um
`FileProvider`.

Para um testador sem `adb`: declarar um `FileProvider` para `files/corenext/` e compartilhar o `frames-*.jsonl` como
anexo (`ACTION_SEND` com `content://`). Cuidado: o `logs-*.jsonl` tem o MAC do relógio; compartilhar só o de frames,
ou mascarar o MAC antes.

## 4. iOS

O host iOS existe desde 2026-10-30 (pod, shim ObjC++ do TurboModule, `CoreGraph`, `IosCoreHost`, `CentralTransport`,
stores, logger) e o app de exemplo compila para o simulador e para o iPhone; o estado, as decisões e o que só o aparelho
fecha estão em [`ios-pendente.md`](ios-pendente.md) ("iOS: estado e pendências"). Já conferido sem iPhone: o host
inteiro no simulador com as três gravações reais (`TX matched 167/167`, `32/32` e `12/12`, passos 56 e 51) e o app de
exemplo registrando o módulo e resolvendo o `initialize` com o evento de estado
([`ios-pendente.md`](ios-pendente.md#verificação-sem-iphone)).

- [x] **Primeiro teste no iPhone com os dois relógios** (2026-10-30, app de exemplo em Release): pareamento, comandos e
  sync com o fitGPS 0.2.1 e com o Life Ultra GPS 1.1.1, este depois de esquecer nos Ajustes um vínculo Bluetooth antigo
  (`PAIRING_REMOVED`, ADR 23 do Repo 1). Resultados em
  [`ios-pendente.md`](ios-pendente.md#o-que-o-iphone-mostrou-2026-10-30).
- [x] **Gravações iOS como fixture**: as duas do primeiro teste reproduzem no Repo 1, em
  `fixtures/real/fitgps/0.2.1/ios-pair-info-time-steps-sleep-sync.jsonl` (`TX matched 22/22`; o `device` do cabeçalho
  foi corrigido por script, `docs/fixtures.md` de lá, seção 5) e
  `fixtures/real/lifeultragps/1.1.1/ios-pair-info-time-steps-sync.jsonl` (`TX matched 12/12`).

Continua em aberto, nesta ordem:

- [ ] **O resto do roteiro no iPhone**: reconexão (Bluetooth desligado com o relógio conectado, `Reconnect last`, fora de
  alcance, app fechado e aberto de novo), `PAIRING_REMOVED` com o código atual, reinstalação (o UUID muda) e a recusa da
  autorização ([`ios-pendente.md`](ios-pendente.md#pendências)).
- [ ] **H8 com uma gravação iOS** (Repo 1, `docs/pendencias.md`, bloco 5).
- [ ] **Segundo plano e restauração**: a restauração com pressão de memória e a reconexão com o app suspenso. O host
  já faz a parte dele (a reconexão sai do primeiro `.poweredOn` sem JS, o `didConnect` restaurado que chega antes dela
  não é cancelado, e o re-arme da conexão pendente é na hora depois de uma tentativa que esperou). Falta a sessão: a
  espera crescente da reconexão é um `delay` na sessão do Repo 1, sem `connect` pendente no host, e não anda com o app
  suspenso; no iOS a espera deveria ser o próprio `connect` pendente
  ([`ios-pendente.md`](ios-pendente.md#pendências)).
- [ ] **Integração no Mormaii** (`AppDelegate`, pod, frameworks dinâmicos não verificados;
  [`ios-pendente.md`](ios-pendente.md#integração-no-app-mormaii)).

## 5. Lacunas da integração com o app Mormaii

### Achado (2026-10-29): o Core de produção provavelmente infla os passos do fitGPS no backend

**Só documentação.** Nada muda no app Mormaii nem no `TechnosWareCore` por causa desta PoC; o achado fica aqui para quem
cuida da produção.

**Visto no relógio.** No fitGPS com firmware 0.2.1, o registro `mode 0` do `05/42` é o **acumulado do dia**, não o total
da hora (hipótese H3 do Repo 1, refutada em 2026-10-29; ADR 1 do
[`docs/decisoes.md` de lá](../../technos-watch-protocol/docs/decisoes.md)). A gravação da manhã termina com 56 passos às
08:31:22 (`atMs` 1032178 de `technos-watch-protocol/fixtures/real/fitgps/0.2.1/pair-commands-bt-reconnect-sync.jsonl`),
o registro ao vivo da noite ainda tem 56 às 21:37:37 e 21:37:47 (`atMs` 29133 e 38440 de
`pair-commands-sync-bt-reconnect-disconnect-reconnect.jsonl`), e o usuário confirmou no aparelho que o relógio ficou
parado o dia todo e que a tela mostrava 56 passos no dia.

**O que o Core de produção faz.** O Android arredonda cada `mode 0` para a hora cheia, guarda o último de cada hora
(`TechnosWareCore/android/src/main/java/com/sma/bluetooth/SMAService.java:437-448`, gravado em `:453`) e soma as horas
de cada dia em `getHistoryPedometer` (`:859-866`); o iOS faz o mesmo (chave por hora em
`TechnosWareCore/ios/smaBluetooth/SMAService.m:1277-1288`, soma por dia em `:334-342`). Com um acumulado do dia, isso
soma um instantâneo do acumulado por hora com registro: em 2026-10-29, um telefone que tivesse lido o relógio de manhã
e à noite mandaria 56 + 56 = 112 para um dia de 56 passos. Como o Core faz polling de `05/41` a cada 10 s com o app
aberto (`SMAService.java:547-603`) e o relógio sempre responde com um registro ao vivo (seção 6 do
[`docs/sma-dados.md` do Repo 1](../../technos-watch-protocol/docs/sma-dados.md)), cada hora com o app aberto vira mais
uma parcela; com N horas, o total chega a até N vezes o real (N quando todos os passos vêm antes da primeira hora com
registro, como em 2026-10-29; cerca de (N+1)/2 com os passos espalhados por igual entre as horas com registro).
Calorias e distância somam do mesmo jeito. Só o histórico soma: ao vivo, o próprio Core de produção mostra o `step`
do registro mais recente (`SMAService.java:387-405`), que é o acumulado do dia, e mede a corrida pela diferença entre
dois registros (`:407-408`).

**Consequência provável.** Os passos diários do fitGPS que o app de produção manda ao backend estão inflados
(`POST /steps_monitor`: `src/services/Api/Pedometer.ts:5` do app, com `smart_watch_slug` = slug do relógio, `b3` no
fitGPS, em `src/mappers/entities/pedometer.ts:50-64`). Não foi conferido: não há acesso ao banco.

**Como conferir** (no backend, `/Users/joao.farias/smartBackend`, só leitura do código até aqui): os registros ficam na
coleção Mongo `steps_monitors` (`src/Infrastructure/Repositories/MongoRepository.cs:30`; entidade
`src/Domain/Health/StepsMonitor.cs`, com `SmartWatchId`), e o fitGPS é o `SmartWatch` de slug `b3`
(`src/Domain/Watches/SmartWatch.cs`). Comparar a distribuição de `Steps` por dia do fitGPS com a de outros modelos
(mediana, percentil 95, dias acima de 50 mil passos): um fitGPS inflado aparece com dias muito maiores, e maiores quanto
mais tempo o app ficou aberto. O mesmo vale para `Calories` e `Distance`.

**O que muda neste repositório.** Nada: o Repo 1 usa o acumulado do dia (`DAY_CUMULATIVE`, o maior valor do dia), e
este Core manda o total que a tela do relógio mostra. Na troca do app para este Core, os passos diários do fitGPS vão
cair em relação ao que o backend já tem para o mesmo usuário; avisar quem acompanha metas, gráficos e medalhas (o
backend calcula medalhas a partir dos `steps_monitors`, `src/Application/Jobs/Medals/DataManagers/HistoryStepsDataLoader.cs`).

### `deviceId`: MAC no Android, UUID no iOS

O `Transport.connect` do Repo 1 recebe o MAC no Android e o UUID do periférico no iOS; o `deviceId` de
`onScannedDevice`, `getLastPairedDevice` e `onFirmwareInfo` segue o mesmo valor. Efeitos:

- O `lastDevice` que o app guarda (`CACHE_PAIRING_KEYS.lastDevice`) muda de formato por plataforma, e o UUID do iOS
  muda se o app for reinstalado (`ios-pendente.md`). Um pareamento salvo não migra entre o Core atual e este no iOS
  sem um novo scan.
- A validação de `pairDevice`/`startPairingAttempt` aceita o MAC no Android e o UUID no iOS (`INVALID_ARGUMENT` para o
  resto; `isValidAddress` de cada `CoreHost`).
- **Firmware:** o app guarda `onFirmwareInfo.deviceId` como número (`useWatchInfoData/index.ts:39, 96-103`) e o manda
  ao backend como filtro de revisão de hardware na checagem de firmware (`:196`; `src/services/Api/Firmware.js:49-52`).
  No Core atual o campo é numérico e opcional; aqui ele é sempre o MAC (`api-js.md`, `onFirmwareInfo`). Antes de
  integrar: ou este repositório deixa de preencher `deviceId` no `onFirmwareInfo` do fitGPS, ou o app passa a ignorá-lo
  para esse modelo.

### Eventos que o app assina e que não existem aqui

O app Mormaii assina 41 eventos do `TechnosEvents`; este repositório tem 13 (`technosEventNames`), dos quais o app usa
9 (`onScannedDevice`, `onConnectStateChanged`, `onFirmwareInfo`, `onBatteryStatus`, `onHistoryPedometer`,
`onHistorySleep`, `onSyncStarted`, `onSyncProgress`, `onSyncFinished`). Os 32 restantes não existem aqui:

| Grupo | Eventos | Onde o app assina |
|---|---|---|
| Atividade | `onActivityStartedV2`, `onActivityStatusV2`, `onActivityUpdateV2`, `onActivityCompletedV2`, `onActivityCompletedV2Less60Seconds`, `onActivityError`, `onActivityRealTimeSpeed`, `onHitGoal` | `store/MainStoreContext/Exercise/useExerciseData/index.ts:388-394`, `screens/activity/ActivityAction/index.tsx:160` |
| Plano de corrida | `onRunningPlanActivityStarted`, `onRunningPlanActionStatus`, `onRunningPlanActivityCompleted`, `onRunningPlanActivityError`, `onRunningPlanActivityUpdate` | `store/MainStoreContext/RunningSportsPlan/useRunningSportsPlanData/index.ts:23-39` |
| AGPS | `onAgpsUpdateStart`, `onAgpsUpdateProgress`, `onAgpsUpdateSuccess`, `onAgpsUpdateUserSuccess`, `onAgpsUpdateFail` | `store/MainStoreContext/GpsUpdate/useGpsUpdateData/index.ts:60-79` |
| Histórico | `onHistoryHeartRate`, `onHistorySpo2`, `onHistoryStress`, `onHistoryCalorie`, `onHistoryReminders`, `onHistoryActivityV2`, `onHistoryActivityMonitor` | `services/History/*/index.ts`, `services/ReminderService.ts:7`, `services/ActivityHistoryService.ts:16`, `services/ActivityMonitorService.ts:10` |
| Câmera | `onTakeAPicture`, `onOpenCameraMode`, `onDeviceRequestedCameraMode` | `store/MainStoreContext/Camera/useCameraData/index.ts:9, 26`, `components/Modals/CameraControlModal/index.tsx:75` |
| Outros | `onFirmwareStatusV2` (DFU), `onFindPhone`, `onFaceInfo`, `onSportParameters` | `useWatchInfoData/index.ts:238, 314`, `useDisplayGalleryData/index.ts:246`, `services/SportsParameterService.ts:8` |

Chamar `TechnosEvents.onX` que não existe lança `TypeError` na hora da assinatura. Então a troca não pode ser só o
import: ou o `Smartwatch.ts` escolhe o Core por modelo (este para o fitGPS, o atual para os outros) e cada assinatura
passa por ele, ou este repositório ganha assinaturas vazias (que nunca disparam) para esses nomes. A primeira opção
é a do roteiro de migração em [`api-js.md`](api-js.md#migração-do-app-mormaii).

### Outros

- Os artefatos do Repo 1 (`bridge` e `protocol`) só existem no `mavenLocal` (`CLAUDE.md`); integrar no app exige
  publicar fora dele.
- Integração atrás de uma flag para o fitGPS, só depois de fechar o item 1.

## 6. Pequenos itens do host

- Logar as propriedades das characteristics na descoberta (`AndroidGattTransport.mapServices`), como o iOS já faz. Se a
  `6e400002` aceita escrita sem resposta, o iPhone já respondeu (2026-10-30: `[write|writeWithoutResponse]`); falta só o
  log do lado Android (`transporte-android.md`, limites conhecidos).
- O app de exemplo não registra modelo e versão do Android no log; hoje isso depende de anotar à mão a cada rodada
  (`example/README.md`).
- O `.gitignore` e o `.editorconfig` da raiz ainda não estão versionados (`git ls-files .gitignore` não imprime nada;
  o `origin/main` só tem o `example/.gitignore`). É o `.gitignore` da raiz que ignora `corenext-export/` e
  `logs-*.jsonl`: num clone sem ele, o `adb pull` do `CLAUDE.md` seguido de `git add -A` leva o log com o MAC do
  relógio. Entram no próximo commit; o mesmo vale para o `.gitignore` do Repo 1, que ignora os `logs-*.jsonl` lá.

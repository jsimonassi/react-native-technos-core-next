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

Todo comportamento que difere da produção (o `TechnosWareCore` na tag `v4.3.57`, que o app Condor fixa, e o app Condor
de produção) fica em [`desvios-de-producao.md`](desvios-de-producao.md), uma entrada `DP-nn` por desvio, com a fonte, o
motivo, o impacto, como voltar e quando revisar; aqui ficam só as pendências do host e da integração.

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
- [x] O `.gitignore` e o `.editorconfig` da raiz estão versionados (conferido em 2026-10-31: `git ls-files .gitignore
  .editorconfig` imprime os dois). O `.gitignore` ignora `corenext-export/`, `logs-*.jsonl` e, desde 2026-10-31,
  `btsnoop_hci.log*` (a captura HCI bruta, com endereços e texto pessoal, em qualquer pasta); o do Repo 1 ignora os
  mesmos `logs-*.jsonl`, `corenext-export/` e `btsnoop_hci.log*`.
- [x] Export do exemplo na raiz (2026-11-01): o `frames-20261101-163702.jsonl` e o `logs-*.jsonl` da primeira gravação
  do Condor Reebok foram parar na raiz deste repositório, onde o `logs-*.jsonl` já era ignorado e o `frames-*.jsonl` não.
  O `.gitignore` ignora agora `/frames-*.jsonl` (só na raiz; `git check-ignore -v` confere): um frames da raiz é cópia
  de trabalho e nunca se versiona aqui; só vira fixture do Repo 1 depois de revisado (sem MAC). A regra também esconde do
  `git status` o que ainda não foi revisado, então a lista fica aqui. Na raiz em 2026-11-01:
  - `frames-20261101-163702.jsonl` e `logs-20261101-163702.jsonl` (Android, 16:31): analisados; o frames, conferido sem
    MAC e sem nome de aparelho vizinho, é a fixture `real/condorreebok/MOY-VS02-2.0.0/pair-forget-pair-commands-sync-bt-reconnect.jsonl`
    do Repo 1, e o logs nunca sai daqui.
  - [x] `frames-20261101-170415.jsonl` (iPhone, `recordedAt` 17:02:59, sem o `logs-*` ao lado): o usuário validou o
    teste ("Teste feito no iOS e funcionando como esperado"); analisado numa cópia isolada, conferido sem nenhum dos 12
    endereços do log do Android, sem texto com cara de MAC e sem nome de aparelho, e versionado sem edição como a fixture
    `real/condorreebok/MOY-VS02-2.0.0/ios-pair-commands-sync-reconnect.jsonl` do Repo 1 (SHA-1 igual ao original). O
    original continua aqui, ignorado.

## 7. Condor Reebok (CRP)

A fase 1 do Condor Reebok (`P85`, firmware `MOY-VS02-2.0.0`) está implementada nas duas plataformas. Até 2026-10-31 foi
testada só sem o relógio: no Repo 1, com as fixtures de referência da captura HCI do app Condor e a sintética; aqui, com
a sintética no simulador iOS (`ios/Tests/`) e com os testes JVM do Android. **Em 2026-11-01 rodou com o relógio num
Android**, pelo app de exemplo: o usuário relatou que "parece funcionar como esperado" e confirmou os passos dos dias
anteriores. A gravação virou a fixture `fixtures/real/condorreebok/MOY-VS02-2.0.0/pair-forget-pair-commands-sync-bt-reconnect.jsonl`
do Repo 1 (`real@<atMs>` no `docs/protocolo-crp.md` de lá), que também passa pelo host iOS inteiro no simulador
(`CoreBridgeReplayTests.testCondorReebokRealAndroidRecordingThroughTheWholeIosHost`). O log nativo da sessão tem o MAC e
os nomes de aparelhos vizinhos e ficou fora do git; ele é citado por `log ts`. **No mesmo dia rodou num iPhone**, com o
P85 já pareado nos Ajustes, e o usuário relatou "Teste feito no iOS e funcionando como esperado": a gravação virou a
fixture `ios-pair-commands-sync-reconnect.jsonl` do Repo 1 (`ios@<atMs>`), que passa pelo host iOS no simulador
(`testCondorReebokRealIosRecordingThroughTheWholeIosHost`); não há log do iPhone
([`ios-pendente.md`](ios-pendente.md#o-que-o-iphone-mostrou-do-condor-reebok-2026-11-01)). Com as duas, a fase 1 está
validada pelo usuário no Android e no iPhone. O protocolo e o que falta confirmar nele
(a regra de carregamento acima de 100, o `B6` no P85, o sono de uma noite real; o `0x33` foi respondido em 2026-11-01)
ficam no `docs/pendencias.md` do Repo 1, seção "Condor Reebok (CRP)". Aqui ficam o host e a integração.

**Validação no aparelho.** Roteiro no [`example/README.md`](../example/README.md#checklist-com-o-condor-reebok-crp),
nas duas plataformas. Do lado do host, o que só o aparelho confirma:

- [x] Android: o scan sem filtro acha o `P85` (e o log não enche com os aparelhos sem nome por perto).
  - 2026-11-01: `BleScanner/start … without filters`, o P85 com `name=P85`, `profile=condorreebok` e
    `advertisedServices=[]` (não anuncia serviço nenhum), um aparelho suportado por scan de 7 s e 18 linhas de scan no
    total nos dois scans (`log ts` 1793561505045 e 1793561586305).
- [x] Android: o `createBond(TRANSPORT_BREDR)` por reflexão funciona na versão do Android do teste (linha
  `ClassicBonder/attempt … started=true`, sem o WARN de reserva para o `createBond()`), o diálogo do sistema aparece,
  e, se a primeira tentativa falhar como no HCI do app Condor (status `0x06`), a segunda aparece sozinha 1,5 s depois. O
  `BOND_BONDED` chega pelo receiver e o Android abre HFP e A2DP sozinho (chamadas e música no relógio).
  - 2026-11-01: `createBond attempt 1 … started=true bondState=10`, sem a reserva, e `10 → 11 → 12` (`BONDED`) pelo
    receiver, 4,5 s depois do pedido, na primeira tentativa ([`transporte-android.md`](transporte-android.md#vínculo-clássico-bredr)).
    A nova tentativa depois de um `0x06` não foi exercitada.
  - [ ] Chamadas e música no relógio depois do vínculo (HFP e A2DP abertos pelo Android): não anotado em 2026-11-01.
- [x] Android: recusar o diálogo duas vezes dá um `onError` `CLASSIC_BOND_FAILED` (`method: "classicBond"`) e nenhum
  diálogo a mais até um `pairDevice` novo; o BLE continua pronto.
  - 2026-11-01: `11 → 10 (reason=1)` nas duas tentativas, a segunda 1,5 s depois da primeira, `onError` com
    `requestId -1`; a sessão ficou em `READY`, os comandos seguintes funcionaram e a reconexão depois do Bluetooth
    religado não pediu o vínculo de novo.
- [x] Android: o `forgetDevice` escreve o `F8`, o `removeBond()` por reflexão volta `true` no log e o relógio some dos
  Ajustes de Bluetooth.
  - 2026-11-01: TX `FEEA2005F8` (`real@38047`) e `removeBond(…) returned true (bond state was 12)`; o `pairDevice`
    seguinte pediu o diálogo de novo.
  - [ ] O relógio sumir dos Ajustes de Bluetooth: não anotado em 2026-11-01 (só o `true` do `removeBond` no log; o
    usuário relatou só "Parece funcionar como esperado").
- [ ] Android: `Forget` com o Bluetooth desligado registra o WARN `Bluetooth is off: the bond with … will be removed
  when Bluetooth turns on`; ao religar, o `removeBond()` sai (`Resuming 1 pending bond removal(s)`) e o relógio some
  dos Ajustes antes de reabrir chamadas e música. Não feito em 2026-11-01.
- [ ] Android: `Forget` com o diálogo do vínculo aberto: o log mostra o `cancelBondProcess()` (e o que ele devolveu),
  o diálogo fecha ou, aceito mesmo assim, o vínculo é removido logo depois; nenhum `onError` `CLASSIC_BOND_FAILED`.
  Não feito em 2026-11-01.
- [x] Android: o CCCD da `2a19` é aceito sem vínculo BLE e o aviso de bateria chega uma vez por minuto
  (`onBatteryStatus` sem pedido).
  - 2026-11-01: as quatro CCCDs (`fee3`, `2a37`, `fee1`, `2a19`) com status 0 nas três conexões, inclusive na do vínculo
    recusado; `0x2B` (43 %) em cinco avisos, um por minuto, perto da virada do minuto (`real@10306` a `@310025`).
- [ ] Android: a `fee1` notifica andando e o `onPedometer` sai no máximo a cada 2 s. Parcial em 2026-11-01: uma
  rajada de `FEE1` antes de qualquer leitura gerou uma releitura só, 2,35 s depois; depois dela não veio mais `FEE1`,
  então os avisos com o estado e o limite de 2 s não foram vistos. No iPhone, os avisos com o estado foram vistos do
  lado do rádio (item abaixo); o limite de 2 s continua sem prova no aparelho.
- [x] iPhone: pareamento, comandos e sync pelo CoreBluetooth (2026-11-01): MTU 515 com bloco 244, as 27 escritas em
  `fee2` (o tipo sem resposta só se vê no teste do simulador; no aparelho, só o log diria) e as 5 leituras GATT, o
  vínculo clássico "não suportado" sem atrapalhar a sessão BLE (o relógio, já pareado nos Ajustes, mandou
  `F9 01 01 00` → `01` sem pedido do app; se o clássico abriu e quem o abriu não se sabe) e uma reconexão de causa não
  gravada
  ([`ios-pendente.md`](ios-pendente.md#o-que-o-iphone-mostrou-do-condor-reebok-2026-11-01)).
- [x] iPhone: a bateria espontânea e a `fee1` andando (2026-11-01, 23:20 a 23:28). O usuário fez o teste curto com o
  app aberto e relatou: "Testado novamente no iPhone e sim, está atualizando automaticamente." A gravação dessa
  segunda sessão (não versionada; `ios-walk@<atMs>` no `docs/protocolo-crp.md` do Repo 1) tem a `2a19` em cada uma
  das 8 viradas de minuto (42 → 41 → 40 %), 14 `fee1` andando (de 37 a 106 passos) sem nenhuma releitura depois do
  `readSteps` do começo e uma rajada de dez `2a37`
  ([`ios-pendente.md`](ios-pendente.md#a-segunda-sessão-no-iphone-2026-11-01-2320-não-versionada)). Na gravação das
  17:04 não tinha vindo nenhuma notificação de `2a19`, `fee1` ou `2a37` (os passos não mudaram, a única virada de
  minuto da janela coincidiu com o acerto de hora do handshake e a queda do link 1 não está gravada).
  - [ ] O status das CCCDs laterais no log (`CentralTransport/enableNotifications … status=…`; sem log nas duas
    sessões), os avisos em segundo plano e com a tela bloqueada, e o `onPedometer` no máximo a cada 2 s no aparelho.
- [ ] iPhone: o efeito do transport bridging, se o iOS pede pareamento BLE (com o P85 esquecido nos Ajustes antes) e o
  `forgetDevice` (nenhum `F8` na gravação de 2026-11-01) ([`ios-pendente.md`](ios-pendente.md#condor-reebok-crp)).

**Observação do app de exemplo (2026-11-01; o app não muda).** O botão "Ler" do cartão Relógio chama `getDeviceInfo` e
depois `getFirmwareInfo` (`example/src/screens/ConnectionScreen.tsx:43-44`). No CRP cada um manda o seu `5A 01`, então
o relógio recebe dois `5A 01` seguidos (`real@119023` e `@119425`, os dois respondidos com `MOY-VS02-2.0.0`). É o mesmo
no SMA e no iDO (duas leituras do firmware), e é o preço de ter os dois eventos. A bateria tem botão próprio (o
`readBattery` de `real@131926` veio depois), mas já estava na tela antes de qualquer "Ler": o P85 notifica a `2a19`
sozinho a cada cerca de 60 s, e cada aviso vira um `onBatteryStatus` sem pedido ([`api-js.md`](api-js.md#onbatterystatus)).

**Limites conhecidos do host.**

- `createBond(int)` e `removeBond()` são APIs ocultas. Se um Android bloquear a reflexão, o `createBond()` público pode
  escolher o LE (sem SMP no P85) e o pedido falha; a remoção não acontece e o usuário esquece o relógio nos Ajustes. Os
  dois casos aparecem no log (`ClassicBonder/`), não no JS.
- Um `forgetDevice` com o diálogo do vínculo ainda aberto cancela o pedido; o host ainda responde `FAILED` (o `CoreHost`
  exige uma resposta por pedido), mas o `CoreBridge` marcou o pedido como abandonado pelo esquecer e só loga o
  resultado: nenhum `onError`, nenhuma recusa. O `cancelBondProcess()` é oculto e pode não fechar o diálogo; se o usuário
  aceitar mesmo assim, o vínculo é removido assim que aparece.
- Um `forgetDevice` com o Bluetooth desligado deixa a remoção do vínculo pendente (preferências) até o Bluetooth ligar;
  um vínculo feito à mão nos Ajustes nesse meio-tempo também sai ([`transporte-android.md`](transporte-android.md)).
- A lista de recusas e o pedido em andamento vivem só em memória no `CoreBridge`: um processo novo pede o vínculo de
  novo no primeiro `READY`. Só o `READY` que fecha um handshake consulta `hasClassicBond` (a volta de `SYNCING` não) e,
  com o vínculo feito, loga um INFO `Classic bond with … already exists`, uma vez por conexão.
- O `getBondState()` não diz por qual transporte o vínculo foi feito; o host trata qualquer vínculo com o endereço do P85
  como o clássico (o BLE dele não tem SMP).

**Decisões do usuário (2026-11-01).**

- **CDM fora do prazo.** O pareamento pelo CDM (o `CompanionDeviceManager` do Android) **não** entra no prazo de
  2026-11-05: só entra se sobrar tempo depois da fase 4. A fase 4 troca o Core no app Condor com o pareamento de hoje
  (scan, `pairDevice` e o vínculo clássico pelo `ClassicBonder`). ADR 34 do Repo 1.
- **Esquecer nunca faz reset de fábrica.** O `forgetDevice` continua sendo o `F8` mais a remoção do vínculo clássico (e
  a limpeza do pareamento salvo e do histórico local); o reset de fábrica (`51 02`) é o método separado `resetDevice`
  desde a fase 2 ([`api-js.md`](api-js.md#resetdevice-promisevoid)), que não esquece o pareamento: o app decide se chama
  os dois. ADR 33 do Repo 1.

**Integração com o app Condor (fase 4).**

- Esquecer e reset: no app Condor de hoje, todos os botões que tiram o relógio (o reset da tela Dispositivo,
  `GTE-CondorSmart/src/screensV2/device/Device/WatchResetModal/index.tsx:23-26`, o desconectar,
  `GTE-CondorSmart/src/componentsV2/Modals/PairingDisconnectModal/index.tsx:34-38`, e outros) chamam o
  `disconnectCurrentDevice` do Core (`GTE-CondorSmart/src/services/Smartwatch.ts:73-75`), que no Core de produção
  Android manda o `51 02` e depois o `F8` (`core@v4.3.57:android/src/main/java/com/crp/bluetooth/CRPService.java:269-270`).
  Aqui o `disconnectCurrentDevice` só desconecta, o `forgetDevice` não reseta e o `resetDevice` não esquece: o adaptador
  da fase 4 escolhe o que cada botão chama (`forgetDevice`, `resetDevice` ou os dois, com o reset antes).
- `deviceId`: o Core do app Condor emite no iOS o MAC que vem no anúncio (`CRPDiscovery.mac`; fase 0, CON-37), e o app
  compara MAC sem `:`; aqui o iOS dá o UUID do periférico ([`deviceId`](#deviceid-mac-no-android-uuid-no-ios)).
- Distância e calorias: o Core Android do app Condor troca os dois campos no histórico de passos
  (`item.putDouble("distance", calories)` e `item.putInt("calorie", distance)`,
  `core@v4.3.57:android/src/main/java/com/crp/bluetooth/CRPService.java:391-392`), e o `EventMapper` daqui manda metros
  em `distance` e kcal em `calorie`. Os dados que o app Condor já mandou ao backend pelo Android podem estar trocados.
- O relógio não guarda distância nem calorias por meia hora (o P85 não respondeu `5D`/`5C` na captura): os totais do dia
  vêm da `fee1` de hoje e do `33 01` de ontem (o P85 com `MOY-VS02-2.0.0` respondeu em 2026-11-01: 77 passos, 63 m e
  4 kcal, `real@225338`; outro firmware pode não responder). Um dia antigo sem esses totais fica só com os passos.
- `initCRPSDK` é só um alias de `initialize` no JS. Os ajustes que o app Condor manda (perfil, metas, 12/24 h, estresse
  e frequência cardíaca automáticos e os outros), as mensagens, as interações e o reset de fábrica entraram na fase 2
  ([seção 8](#8-fase-2-do-condor-reebok-o-que-fica-fora-e-o-que-falta-validar)); as atividades e os históricos de
  frequência cardíaca e estresse ficam para a fase 3. A lista de assinaturas de eventos do app Condor ainda não foi
  levantada como a do app Mormaii ([seção 5](#eventos-que-o-app-assina-e-que-não-existem-aqui)).

## 8. Fase 2 do Condor Reebok: o que fica fora e o que falta validar

A fase 2 (ajustes, mensagens, interações e o `resetDevice`) entrou em 2026-11-02, com os nomes e os argumentos do Core
do app Condor ([`api-js.md`](api-js.md#ajustes-mensagens-e-interações-fase-2)). O protocolo e o que falta confirmar nele
(bytes que só a SDK descreve, respostas opcionais, ecos) ficam no `docs/pendencias.md` do Repo 1; o roteiro de validação
no aparelho, no [`example/README.md`](../example/README.md#checklist-da-fase-2-com-o-condor-reebok); cada diferença em
relação à produção, com como voltar, em [`desvios-de-producao.md`](desvios-de-producao.md) (os `DP-nn` abaixo). Aqui
ficam o host, o JS e a integração.

**Fica fora da fase 2** (decisões do usuário de 2026-11-01, noite):

- [ ] **Encaminhamento de notificações no Android** (o `NotificationListenerService`, a tabela pacote → app, a
  deduplicação, a migração do filtro antigo `user_prefs`/`notification_option` e o `ComponentName`): fatia própria,
  depois da fase 2 e até 2026-11-05. Sem ela, o Condor Android para de mostrar notificações no relógio na troca: o
  `manageNotifications` só grava o filtro no relógio. O serviço ligado também mantém o processo vivo em segundo plano.
  Quando entrar, o SMS respeita o botão de SMS (e não o "Outros") e os acentos só vão se o relógio os mostrar direito
  (DP-44, DP-74).
- [ ] **Controle de música no Android** (prioridade baixa, decisão do usuário de 2026-11-02): na validação (I4,
  Android), o P85 mostra o nome da música pelo AVRCP, mas manda tocar/pausar, próxima e anterior só pelo RX `67`, que
  o Core Next só registra no log, e esses botões não funcionam. O volume muda pelo AVRCP, de forma errada, sem nenhum
  `67` no BLE. O controle por BLE (o `67` virando teclas de mídia, como na produção) entra numa fatia própria depois
  das prioridades da migração; o `manageMusicOption` continua stub na fase 4 (DP-64).
- [ ] **Encontrar celular nativo** (opção B: tela cheia, lanterna, toque e serviço em primeiro plano): fora. Na fase 2
  só o evento `onFindPhone` (opção A); com o app em segundo plano, ele só chega com o processo vivo (DP-57).
- [ ] **Câmera disparada pelo relógio com o app em segundo plano no Android** (a notificação com deep link do Core
  antigo): fora até 2026-11-05 (DP-63).
- [ ] **Geolocalização do clima**: o `getCurrentGeolocation` do Core antigo (`TechnosDeviceLocationManager`, formato `{
  coords: { latitude, longitude }, neighborhood, city }`) vem para este repositório na fase 4. Sem ele, o app Condor
  chama `syncWeather([])` e nenhum clima chega ao relógio (DP-68).
- [ ] **Permissões do manifesto do Core antigo** (`READ_CONTACTS` e as outras) vão para o manifesto do app Condor na
  fase 4; sem `READ_CONTACTS`, a tela Contatos para no aviso de permissão (DP-69). A biblioteca não ganhou permissão
  nenhuma na fase 2.
- [ ] **Serviço em primeiro plano durante o sync de ajustes**: o `CoreBridge` desliga o serviço do sync no
  `onSyncFinished`, e o sync de ajustes do app Condor roda logo depois; com o app em segundo plano no Android, essas
  escritas podem atrasar ou cair. Mitigação possível na fase 4: manter o trabalho em segundo plano enquanto houver
  comando na fila (DP-66).
- [ ] **Camada de compatibilidade da fase 4**: os stubs que resolvem sem tráfego no JS (`manageMusicOption`,
  `setSportPlate` e os outros da [Migração do app Condor](api-js.md#migração-do-app-condor)), o método nativo genérico
  que rejeita `NOT_SUPPORTED` com `onError`, o `checkIsNotificationServiceEnabled` que resolve `true` no Android, o
  caminho profundo dos tipos (`react-native-technos-ware-core/src/NativeModules/type/watchSettings`), o
  `technosAssets.IANA_TIMEZONE_INFO_LIST` e a lista de notificações por modelo (DP-70 a DP-73).
- [ ] **Relógio Force** (pedido do usuário): também usa a SDK CRP, mas não tem Bluetooth clássico, só BLE. As ligações
  (aqui só pelo HFP), a música (AVRCP), o vínculo clássico do pareamento e o resto que no P85 depende do clássico
  precisam ser revalidados quando o Force entrar; o codec `0x41`/`41 FF` do Repo 1 é o caminho provável para as ligações
  nele (DP-75).

**Do JS e do app de exemplo:**

- [ ] **Botão "Consultar suporte ao +" (`F2 05`)**: não entrou na aba Ajustes. O codec existe no Repo 1, mas não há
  método nativo nem caminho de depuração para mandá-lo, e criar um mudaria o contrato JS só para a validação (o contrato
  é o dos 23 métodos mais o `resetDevice`). Na validação, o `+` se confere na tela do relógio e no log, com os contatos
  fictícios (um deles com `+`). Se o `F2 05` fizer falta, ele entra como método só do exemplo no `CoreBridge` e nos dois
  hosts (DP-51).
- [ ] **O que o P85 faz depois do `resetDevice`**: se derruba o link, se a reconexão automática volta e se o vínculo
  clássico continua (DP-02).
- [ ] **Avisos de "Possible unhandled promise rejection" no app Condor**: o `observed` cobre as chamadas diretas ao
  `TechnosCore`, não os wrappers `async` do `Smartwatch.ts` chamados sem `await` (os `onHide` das telas e o `.then` de
  `DeviceConnectedSuccessfully/index.tsx:78-85`). O adaptador da fase 4 decide se põe `.catch` nesses pontos (DP-17).

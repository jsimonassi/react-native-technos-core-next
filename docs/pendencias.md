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
- [x] O `.gitignore` e o `.editorconfig` da raiz estão versionados (conferido em 2026-10-31: `git ls-files .gitignore
  .editorconfig` imprime os dois). O `.gitignore` ignora `corenext-export/`, `logs-*.jsonl` e, desde 2026-10-31,
  `btsnoop_hci.log*` (a captura HCI bruta, com endereços e texto pessoal, em qualquer pasta); o do Repo 1 ignora os
  mesmos `logs-*.jsonl`, `corenext-export/` e `btsnoop_hci.log*`.

## 7. Condor Reebok (CRP)

A fase 1 do Condor Reebok (`P85`, firmware `MOY-VS02-2.0.0`) está implementada nas duas plataformas e testada só sem o
relógio: no Repo 1, com as fixtures de referência da captura HCI do app Condor e a sintética; aqui, com a sintética no
simulador iOS (`ios/Tests/`) e com os testes JVM do Android. O protocolo e o que falta confirmar nele (a regra de
carregamento acima de 100, a sonda do `0x33` e o `B6` no P85, o sono de uma noite real) ficam no `docs/pendencias.md` do
Repo 1, seção "Condor Reebok (CRP)". Aqui ficam o host e a integração.

**Validação no aparelho.** Roteiro no [`example/README.md`](../example/README.md#checklist-com-o-condor-reebok-crp),
nas duas plataformas. Do lado do host, o que só o aparelho confirma:

- [ ] Android: o scan sem filtro acha o `P85` (e o log não enche com os aparelhos sem nome por perto).
- [ ] Android: o `createBond(TRANSPORT_BREDR)` por reflexão funciona na versão do Android do teste (linha
  `ClassicBonder/attempt … started=true`, sem o WARN de reserva para o `createBond()`), o diálogo do sistema aparece,
  e, se a primeira tentativa falhar como no HCI do app Condor (status `0x06`), a segunda aparece sozinha 1,5 s depois. O
  `BOND_BONDED` chega pelo receiver e o Android abre HFP e A2DP sozinho (chamadas e música no relógio).
- [ ] Android: recusar o diálogo duas vezes dá um `onError` `CLASSIC_BOND_FAILED` (`method: "classicBond"`) e nenhum
  diálogo a mais até um `pairDevice` novo; o BLE continua pronto.
- [ ] Android: o `forgetDevice` escreve o `F8`, o `removeBond()` por reflexão volta `true` no log e o relógio some dos
  Ajustes de Bluetooth.
- [ ] Android: `Forget` com o Bluetooth desligado registra o WARN `Bluetooth is off: the bond with … will be removed
  when Bluetooth turns on`; ao religar, o `removeBond()` sai (`Resuming 1 pending bond removal(s)`) e o relógio some
  dos Ajustes antes de reabrir chamadas e música.
- [ ] Android: `Forget` com o diálogo do vínculo aberto: o log mostra o `cancelBondProcess()` (e o que ele devolveu),
  o diálogo fecha ou, aceito mesmo assim, o vínculo é removido logo depois; nenhum `onError` `CLASSIC_BOND_FAILED`.
- [ ] As duas plataformas: o CCCD da `2a19` é aceito sem vínculo BLE e o aviso de bateria chega uma vez por minuto
  (`onBatteryStatus` sem pedido); a `fee1` notifica andando e o `onPedometer` sai no máximo a cada 2 s.
- [ ] iPhone: o efeito do transport bridging e se o iOS pede pareamento BLE ([`ios-pendente.md`](ios-pendente.md#condor-reebok-crp)).

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

**Integração com o app Condor (fase 4).**

- `deviceId`: o Core do app Condor emite no iOS o MAC que vem no anúncio (`CRPDiscovery.mac`; fase 0, CON-37), e o app
  compara MAC sem `:`; aqui o iOS dá o UUID do periférico ([`deviceId`](#deviceid-mac-no-android-uuid-no-ios)).
- Distância e calorias: o Core Android do app Condor troca os dois campos no histórico de passos
  (`item.putDouble("distance", calories)` e `item.putInt("calorie", distance)`,
  `core@v4.3.57:android/src/main/java/com/crp/bluetooth/CRPService.java:391-392`), e o `EventMapper` daqui manda metros
  em `distance` e kcal em `calorie`. Os dados que o app Condor já mandou ao backend pelo Android podem estar trocados.
- O relógio não guarda distância nem calorias por meia hora (o P85 não respondeu `5D`/`5C` na captura): os totais do dia
  vêm da `fee1` de hoje e, se o firmware tiver, do `33 01` de ontem. Um dia antigo sem esses totais fica só com os passos.
- `initCRPSDK` é só um alias de `initialize` no JS. Os outros eventos e métodos que o app Condor usa (atividades,
  estresse, frequência cardíaca, metas, 12/24 h, perfil do usuário) ficam para as fases 2 e 3 do Repo 1; a lista de
  assinaturas do app Condor ainda não foi levantada como a do app Mormaii ([seção 5](#eventos-que-o-app-assina-e-que-não-existem-aqui)).

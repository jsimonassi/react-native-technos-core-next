# Pendências do host e da integração

O que falta no Repo 2 e na integração com o app Mormaii, levantado a partir da primeira gravação com o relógio real
(Mormaii fitGPS, firmware 0.2.1, Android, 2026-10-29). Os dados da gravação estão em
[`transporte-android.md`](transporte-android.md#o-que-a-gravação-do-fitgps-mostrou).

A **validação no relógio** que ainda falta (dois syncs seguidos para ver se o sono é apagado depois de lido; disconnect,
forget e novo pareamento olhando a tela no BIND; caminhada cruzando uma hora cheia para o H3; robustez do link; H8 com o
app Mormaii iOS; uma noite de sono) foi adiada: o sono já não funcionava no Core atual e isto é uma prova de conceito. O
roteiro fica no [`docs/pendencias.md` do Repo 1](../../technos-watch-protocol/docs/pendencias.md), junto com as
pendências de protocolo; este documento não o repete.

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
2. **Sync mais rápido.** No Repo 1, escrever o ACK com `WITHOUT_RESPONSE`, se a `6e400002` aceitar (seção 6), ou não
   bloquear o despacho esperando a confirmação da escrita do ACK; isso tira a espera de cerca de 358 ms por página
   (estimativa: de 900 para 550 ms, cerca de 35 s em 64 páginas). Os cerca de 362 ms até o ACK do relógio são do
   protocolo. Não serve parar a paginação nas páginas antigas: o relógio entrega da mais antiga para a mais nova, então
   isso nunca chegaria às noites recentes.
3. **Prioridade de conexão alta durante o sync.** Neste repositório: pedir
   `BluetoothGatt.requestConnectionPriority(CONNECTION_PRIORITY_HIGH)` quando o sync começa (o mesmo ponto em que o
   `CoreSessionListener.onSyncStarted` liga o serviço em primeiro plano) e voltar a `BALANCED` no fim. A SDK SMA faz
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

Nada do iOS existe além do podspec (iOS 15.1). O que falta e as armadilhas estão em
[`ios-pendente.md`](ios-pendente.md). Da gravação, o que já vale para o iOS: o transporte segue o contrato B do
Bluetooth desligado (`.poweredOff` sem `onDisconnected`); o scan tem que ser sem filtro de serviço (o fitGPS não
anuncia o NUS); com MTU 23 os dois caminhos de tamanho de fragmento dão 20 bytes.

## 5. Lacunas da integração com o app Mormaii

### `deviceId`: MAC no Android, UUID no iOS

O `Transport.connect` do Repo 1 recebe o MAC no Android e o UUID do periférico no iOS; o `deviceId` de
`onScannedDevice`, `getLastPairedDevice` e `onFirmwareInfo` segue o mesmo valor. Efeitos:

- O `lastDevice` que o app guarda (`CACHE_PAIRING_KEYS.lastDevice`) muda de formato por plataforma, e o UUID do iOS
  muda se o app for reinstalado (`ios-pendente.md`). Um pareamento salvo não migra entre o Core atual e este no iOS
  sem um novo scan.
- A validação de `pairDevice`/`startPairingAttempt` aceita só MAC (`INVALID_ARGUMENT`); no iOS ela terá que aceitar
  UUID.
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

- O artefato do Repo 1 só existe no `mavenLocal` (`CLAUDE.md`); integrar no app exige publicar fora dele.
- Integração atrás de uma flag para o fitGPS, só depois de fechar o item 1.

## 6. Pequenos itens do host

- Logar as propriedades da `6e400002` na descoberta (`AndroidGattTransport.mapServices`), para saber se o fitGPS aceita
  `WRITE_NO_RESPONSE` (`transporte-android.md`, limites conhecidos).
- O app de exemplo não registra modelo e versão do Android no log; hoje isso depende de anotar à mão a cada rodada
  (`example/README.md`).
- O `.gitignore` e o `.editorconfig` da raiz ainda não estão versionados (`git ls-files .gitignore` não imprime nada;
  o `origin/main` só tem o `example/.gitignore`). É o `.gitignore` da raiz que ignora `corenext-export/` e
  `logs-*.jsonl`: num clone sem ele, o `adb pull` do `CLAUDE.md` seguido de `git add -A` leva o log com o MAC do
  relógio. Entram no próximo commit; o mesmo vale para o `.gitignore` do Repo 1, que ignora os `logs-*.jsonl` lá.

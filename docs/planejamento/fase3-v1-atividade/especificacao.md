# Fase 3 v1: atividade, FC, estresse e treinos (especificação substituída)

> Status: **substituída em 2026-11-03** pelo recorte do escopo
> ([`../fase3-v2-dados-room/especificacao.md`](../fase3-v2-dados-room/especificacao.md)). Continua sendo o ponto de
> partida da atividade iniciada pelo app (start, pause, resume e stop, eventos V2, cronômetro), adiada. A base que
> ela previa (S0, S6a e S0h: contrato JS, stubs e métodos nativos) foi feita e está no código, sem commit.

Como ler este documento:

- Gerado a partir do resultado final do workflow de desenho de 2026-11-03, por volta de 00:30 (`full.json` tem a
  pesquisa, o rascunho, as críticas e a revisão; `spec.json`, só a especificação final).
- Prefixos das citações: `core@v4.3.57:` = TechnosWareCore na tag v4.3.57 (o Condor passou para a v4.4.5 em
  2026-11-03); `condor:` = GTE-CondorSmart; `R1:` e `R2:` = os dois repositórios do Core Next; `sdk:` = crpblelib
  2.0.3 descompilada.
- `$SCRATCH` e `$SESSAO` eram pastas temporárias da sessão de desenho.
- As perguntas 1 a 3 (GPS, Health Connect e HealthKit, o que cortar primeiro) foram respondidas pelo recorte: GPS
  fora, Health Connect e HealthKit fora, atividade do app em stub. FC, estresse e treinos passaram para a v2.

## Linha de corte: o que entra, o que fica em stub, o que fica fora

ENTRA na fase 3 (14 fatias; cerca de 10,5 h de relógio com 5 agentes depois da S0, ou 9,5 h com 6, sem retrabalho; o
caminho crítico pelas dependências fica em cerca de 9 h e é a vazão que manda):
(1) O contrato JS completo: os 18 símbolos, mais o checkIosBackgroundLocationPermission, o TechnosCore.activityTypes, os
    10 eventos, os enums de valor que o Condor usa em tempo de execução (TechnosActivityV2Status e PlanType, mais
    TechnosActivityOrigin e TechnosActivityErrorCode) e os componentes que o Condor importa. O TechnosNativeChronometer
    funciona, em JS; o TechnosNativeMap, o TechnosMapStyles e o TechnosNativeActionTimer entram como stubs. Sem isso, a
    fase 4 nem compila nem sincroniza: hoje o Condor dá TypeError no sync e na tela de exercício, e o
    constants/Exercises nem carrega sem o PlanType.
(2) Frequência cardíaca (B6 02 só escrito, depois 35) e estresse (B9 11 03) reais, gravados no host, com confirmação por
    hora. O SpO2 é sempre vazio, como na produção para o P85.
(3) Os treinos feitos no relógio (B2 06 só escrito, depois B2 00..05) reais, com id = índice do slot, como a SDK; o 0E
    só como queda do slot mais novo. Payload do Android, vo2Max e recuperação, confirmação por registro.
(4) A atividade iniciada pelo app, pelo protocolo (68, o registro B2 02 0E e o B2 0D zerado a cada 5 s), com a máquina
    de estados no CoreBridge, o cronômetro do telefone pelo relógio de parede, dados ao vivo do FEE1 e do 2A37 filtrados
    e o serviço em primeiro plano da atividade no Android, SEM GPS.

FICA FORA (stub compatível mais DP): GPS do celular, rota, gpsDistance/gpsSpeed/paceByKm e locations. O
onActivityRealTimeSpeed fica declarado, mas nunca é emitido. Também ficam fora: o desenho do mapa (View vazia, que
também deixa em branco o resumo de atividades antigas com rota e a localização do relógio), a retomada da atividade
depois que o processo morre, Health Connect e HealthKit, B2 07..10, 0x57, B2 0D com distância, a redação dos RX de saúde
nos exports e o segundo plano da atividade no iOS.

POR QUÊ: as quatro pesquisas somam uns 3,5 a 4 dias. Só GPS, FGS de localização e mapa custam de 1,25 a 1,75 dia nas
duas plataformas, e o mapa não dá para validar no app de exemplo (falta react-native-maps, a chave e a permissão). O
resto é protocolo e regra comum, que cabe em paralelo e destrava a fase 4. As perguntas 1 e 2 ao usuário confirmam esse
corte.

GARANTIA: a S0 (2,5 h, Repo 1) mais a S0h (1 h, Repo 2) entregam o fallback em cerca de 3,5 h. Os getHistory* emitem
lista vazia, o startActivityByTypeV2 emite onActivityError -1 na hora, pause/resume/stop resolvem sem tráfego, os 10
eventos estão no switch do emit dos dois hosts, os stores e hosts dos dois lados compilam com os métodos novos em stub,
e os componentes existem. A S0 sozinha não basta, porque muda o SampleStore e o CoreHost que os hosts do Repo 2
implementam. A fase 4 nunca fica presa à fase 3.

ORDEM DE CORTE (cada item vira DP e volta ao stub da S0). Decidir a pergunta 3 AGORA, antes de começar, e não na quarta:
(a) os dados ao vivo do FEE1 e do 2A37 nas atualizações (fica só o secondsDuration);
(b) o FGS de atividade no Android;
(c) a atividade do app inteira (o ActivityController não é ligado);
(d) os treinos do relógio, que voltam a {historyactivity: []}.
FC e estresse não se cortam: dão o maior valor (os cards BPM e STRESS do REEBOK) com o menor risco. Se a S5 não estiver
verde no fim do lote paralelo, aplica-se (c) sem discussão.

## Decisões

### F3-D1

**decision:** Linha de corte: o contrato completo (com os enums de valor), FC e estresse reais, SpO2 vazio, treinos do
relógio reais e a atividade do app pelo protocolo sem GPS. O cronômetro funciona em JS; mapa e ActionTimer são stubs.
Fica fora: GPS/rota/velocidade/mapa, Health Connect/HealthKit, retomada depois da morte do processo e redação de RX.
Ordem de corte: dados ao vivo, depois FGS de atividade, depois atividade do app, depois treinos do relógio.

**rationale:** As pesquisas somam 3,5 a 4 dias contra 1 disponível. Os stubs da S0 e da S0h já evitam o TypeError do
Condor, e a fatia de GPS é a mais cara e a menos validável antes de quinta.

### F3-D2

**decision:** API genérica (ADR 40). Domínio: DataKind ganha HEART_RATE, STRESS e WORKOUTS depois de SLEEP. Tipos novos:
MeasurementSample(atEpochMillis, value) e WorkoutRecord com WorkoutOrigin {WATCH, PHONE}. WatchAction ganha
StartActivity(sportType Technos, notAfterEpochMillis), PauseActivity, ResumeActivity, StopActivity e
PhoneActivityInfo(distanceMeters). WatchEvent ganha ActivityState(phase, fromWatch), ActivityRefused(requested?,
lowBattery) e HeartRateMeasured(bpm). WatchErrorCodes ganha LOW_BATTERY. DeviceProfile ganha dataKinds. DeviceDriver
ganha readMeasurements, readWorkouts e readLastWorkout, com padrão notSupported. Não entra DataKind SPO2.

**rationale:** Segue a ADR 35. SMA e iDO herdam NOT_SUPPORTED sem mudar uma linha, e o perfil deles continua com [STEPS,
SLEEP], então o sync e os testes deles não mudam. A sessão continua sem conhecer a família.

### F3-D3

**decision:** Uma única mudança de contrato com o host, toda na S0, publicada logo, e a S0h logo atrás no Repo 2:
- SampleStore: +4 métodos (loadMeasurements/saveMeasurements(kind), loadWorkouts/saveWorkouts);
- WatchSession: +4 (getMeasurements, getWorkouts, storeWorkout, fetchLastWorkout);
- CoreHost: +5 (startActivityWork, stopActivityWork, loadPreference, savePreference, locationAuthorization);
- CoreBridge: +9 métodos, em stub;
- MinimalHost.swift e MinimalTurboModule.mm no mesmo passo;
- S0h (Repo 2): os métodos novos do SampleStore e do CoreHost em stub nos dois hosts (carregam vazio, gravam nada com
  DEBUG; preferências em memória; locationAuthorization null no Android e 'denied' no iOS), o spec codegen com os 9
  métodos e os 10 eventos, os 9 overrides do Android, os 9 métodos do shim iOS e os 10 nomes no switch do emit dos dois.

**rationale:** O Swift não herda corpo de método de interface, e o Repo 2 implementa SampleStore e CoreHost
(FileSampleStore.kt:31, AndroidCoreHost.kt:36, FileSampleStore.swift:15, IosCoreHost.swift) e consome bridge:0.1.0 do
mavenLocal (android/build.gradle:56). Sem a S0h, a publicação da S0 quebra o build do Repo 2 até a S7 e a S8 terminarem,
e o emit do Android lança IllegalArgumentException para evento desconhecido (NativeCoreNextModule.kt:84).

### F3-D4

**decision:** syncHistory usa os tipos pedidos ∩ profile.dataKinds, na ordem de DataKind.entries: STEPS, SLEEP,
HEART_RATE, STRESS, WORKOUTS. Só STEPS é fatal. NOT_SUPPORTED vira INFO, TIMEOUT e PROTOCOL viram WARN, e DISCONNECTED
propaga. Progresso 100×(i+1)/n: no P85, 0/20/40/60/80/100. Não há teto global de tempo. O CoreBridge pede todos os tipos
e tira WORKOUTS quando há atividade do app ativa. A poda do fim do sync passa a ser por tipo (F3-D8).

**rationale:** Mesma regra do sono exploratório que já existe. Cada tipo tem a própria regra de desistência, o que
limita o pior caso. O teto de 20 s/15 s da produção cortaria a FC que chega depois.

### F3-D5

**decision:** FC: TX B6 02 00 00 só escrito (200 ms, sem matcher), depois 35 00..03 (hoje); TX B6 02 01 00 só escrito,
depois 35 04..07 (ontem); em todo sync, uma página por vez. Cada página é absoluta e é guardada. Timeout da 35 00
desiste da FC no sync; uma página seguinte perdida só falta. Valor fora de 40..200 conta como ausente. Hoje, os slots
depois de agora são descartados. O instante da amostra é o início do dia local mais slot×5 min. Um RX B6 02 que chegue
vai só ao log.

**rationale:** O P85 responde ao 35 nas duas capturas e nunca respondeu ao B6 02. Mas todo 35 00 capturado veio 229 ms
depois de um B6 02 escrito, sem espera (pair-sync@57971→@58200; walk@21888→@22118): mandar o B6 02 como escrita mantém
os bytes da produção e custa 0,4 s, sem os 4 s de timeout. A marca de 'ontem sincronizado' do Android tem bug, e o iOS
lê ontem em todo sync.

### F3-D6

**decision:** Estresse: B9 11 03 00 e 01, casados pelos três bytes mais o dia. 0 vale ausente. Valor acima de 100 é
aceito com WARN. Hoje, os slots depois de agora são descartados. Timeout no dia 00 desiste do estresse no sync.

**rationale:** O B9 11 00 FF (ao vivo) e o B9 11 01 (estado) não podem casar com o pedido. A produção aceita qualquer
valor > 0, e nada fora de 1..100 foi visto.

### F3-D7

**decision:** SpO2 sem leitura e sem DataKind: getHistorySpO2 emite {historyspo2: []} em toda família, antes do resolve.
A categoria 3 do deletedSavedData é ignorada com DEBUG.

**rationale:** A produção nunca manda AB ao P85 (o perfil dele não tem SpO2) e o Condor não tem card de SpO2 para o
REEBOK.

### F3-D8

**decision:** Armazenamento, confirmação e poda:
- medições por tipo em measurements-\<kind>.json, mescladas por instante, com a janela do mergeSteps (retenção do perfil
  e 3 h de folga para o futuro); treinos em workouts.json, mesclados por início, com PHONE vencendo WATCH;
- retenção de 30 dias para tudo;
- chaves de confirmação por tipo no confirmed-\<kind>.json que já existe: dia para STEPS/SLEEP, hora local yyyy-MM-ddTHH
  para HEART_RATE/STRESS, segundo epoch do início para WORKOUTS (casa com ±1 s);
- HistoryStore.confirm valida o formato por tipo, no lugar do isDayKey;
- HistoryStore.prune passa a podar por tipo: dias e horas pela comparação de texto com o dia mais antigo mantido (a
  chave de hora começa pelo dia), e WORKOUTS em número, contra o segundo epoch do início do dia mais antigo mantido.

**rationale:** Reaproveita os arquivos e o caminho que já existem. A poda atual filtra as chaves de todo DataKind com
`it >= oldestKept` em texto (HistoryStore.kt:159-163, chamada no fim de todo sync em SyncEngine.kt:50): '1793615400' <
'2026-10-03', então toda confirmação de treino seria apagada no sync seguinte, e o Condor reenviaria tudo.

### F3-D9

**decision:** Payloads de FC e estresse no :bridge (HealthHistoryMapper):
- dias e horas em ordem crescente;
- as amostras da hora local corrente (data + hora de agora) vão para otherValues e as outras para avgValues por hora;
- FC: média com divisão inteira, min e max, otherValues sem min/max;
- estresse: média arredondada (roundToInt), min, max e stressValues com os valores > 0 da hora completados com 0 até 2
  itens; null em família não CRP;
- daysBefore só vai para o log (ADR 15);
- nunca NO_DATA; lista vazia também emite; falha de leitura vira IO_ERROR, como o getHistoryPedometer.

**rationale:** É o formato de TechnosGeneralMappers (que compara data + hora, :36-52) e de TechnosStressMappers, que os
mapeadores do Condor leem sem conferir.

### F3-D10

**decision:** Coleta de treinos do relógio (CrpWorkoutReader):
- TX B2 06 só escrito (sem matcher), depois B2 00 → B2 01 (5 slots);
- candidatos: slot ocupado, início > 1, dentro de agora − 7 dias e não conhecido (±10 s de um início guardado ou de uma
  chave confirmada); do mais novo para o mais antigo;
- por slot, B2 02 com id = índice do slot (regra da SDK); um B2 02 em voo por vez; aceito qualquer B2 03 com payload ≥
  26, qualquer que seja o eco; só é gravado se o início for igual ao do slot;
- se o índice falhar (timeout ou início diferente), o índice fica desligado no resto do sync (WARN) e só o slot ocupado
  mais novo tenta ainda o id 0E; o 0E nunca prova mapeamento;
- B2 04 usa o id ecoado no B2 03, do offset 00 00 até FF FF, no máximo 64 páginas, abortando se o offset não avançar;
  timeout ou aborto na FC guardam o registro sem FC (WARN) e encerram a cadeia B2 do sync;
- no máximo 2 timeouts de B2 02 por sync; sem B2 07..10; B2 01 sem pedido vai só para o log.

**rationale:** A SDK usa o índice (sdk:j/t0.java:44, var2/5), o exemplo do fornecedor manda o id da lista e a produção
pede o id da lista (CRPService.java:1581-1621). O 14 é 'a última atividade registrada' (commit f99b6e4cd;
CRPActivityManagerV2.java:365): com um treino só no slot 4, '14 = 4 + 10' e '14 = último' não se distinguem, e a regra
slot + 10 perderia todos os treinos menos o mais novo. A SDK não confere o eco e manda o B2 04 com o id que veio
(t0.java:70-85). O B2 06 vinha sempre 226 ms antes do B2 00 sem resposta (walk@20781→@21009; pair-sync@56858→@57084).

### F3-D11

**decision:** Payload de treino (WorkoutPayloadMapper):
- chaves do formatDbActivityObject do Android, startDate ISO com offset;
- secondsDuration = tempo ativo (validTime) para treinos do relógio e do app; cadence = passos×60/duração (inteiro);
  watchSpeedKmH = distância/duração×3,6; pace pela duração e pela distância do relógio;
- averageBpm = média arredondada dos valores > 0; bpmList em grupos de 6 com a regra do Android (grupo sem leitura vale
  0);
- vo2Max e recoveryTimeDate pelas fórmulas do Android, com o perfil persistido ou os padrões dele (25 anos, Other);
- paceByKm [], sem maxBpm, minBpm, heartRateZones, exerciseGoal, locations nem as chaves de natação.

**rationale:** O mapper do Condor lê essas chaves e esses tipos (int ou double) sem validar. As fórmulas são matemática
pura: ActivityHelpers.kt:94-118, 236-269, 341-352.

### F3-D12

**decision:** Perfil persistido: o setUserInfo válido grava o UserProfile via CoreHost.savePreference('userProfile',
texto do UserProfileCodec do :bridge). O CoreBridge carrega no primeiro uso. O forgetDevice não apaga.

**rationale:** O Condor manda o setUserInfo só no fim do sync, depois do getHistoryActivityV2. Só em memória, o primeiro
sync de cada processo sairia com os padrões de idade e sexo. O DP-72 pedia revisão na fase 3.

### F3-D13

**decision:** deletedSavedData:
- categoria 4 → HEART_RATE e categoria 2 → STRESS, pela hora local do instante no fuso do telefone;
- categoria 1 → WORKOUTS, pelo segundo epoch do instante (casa com ±1 s); sem casamento, WARN e nada é marcado;
- categoria 3 → ignorada (DEBUG).
O SavedDataMapper ganha hourKeys e secondKeys.

**rationale:** A produção marca todos os treinos do dia, inclusive um cujo POST falhou (perda silenciosa), e no Android
ignora o estresse. Sem casamento, a perda é só reenvio: o backend responde 409 pelo registered_at.

### F3-D14

**decision:** A máquina da atividade mora no CoreBridge, numa classe interna ActivityController. Estados: STOPPED,
START_REQUESTED, STARTED, RESUME, PAUSED, STOP_REQUESTED; os códigos JS são os de TechnosActivityV2Status. Ela fala com
a sessão por uma interface interna ActivitySessionPort (perform, fetchLastWorkout, getWorkouts, storeWorkout,
confirmUploaded, estado do link), implementada sobre a WatchSession e trocada por uma porta falsa nos testes unitários.
Agendador interno sobre kotlinx-coroutines (implementation no commonMain do :bridge; hoje só está no commonTest), com
dispatcher e relógio (nowMillis) injetáveis pelo construtor interno. Uma trava própria protege o estado.

**rationale:** O CrpDriver vive uma conexão e a atividade sobrevive a uma reconexão. A porta deixa a S5 começar logo
depois da S0, sem esperar a S2b e a S3, com os testes fim a fim no simulador só na integração. O checkObjcHeader
continua garantindo que nada de coroutines vaza na API.

### F3-D15

**decision:** Início:
- argumentos convertidos (type inteiro obrigatório; locationEnabled e hasSpeedometer opcionais; metas ignoradas com
  DEBUG);
- inválido → INVALID_ARGUMENT, onError e onActivityError -1;
- atividade já ativa no CoreBridge → onActivityError 1 e resolve;
- START_REQUESTED marca o instante do pedido; prazo de 10 s a partir dele;
- perform(StartActivity(tipo, notAfter = pedido + 10 s)): a sessão recusa CANCELLED sem tráfego se o prazo já passou ao
  chegar a vez; o CRP lê 2A19 (abaixo de 11% → LOW_BATTERY sem escrever → onActivityError 2), confere o prazo de novo,
  escreve B2 0D zerado e 68 [tipo CRP] e resolve depois das escritas;
- só depois do perform bem-sucedido o host recebe startActivityWork();
- o eco vira ActivityState(STARTED) → STARTED, guarda o início do telefone e emite onActivityStartedV2 (status 2);
- prazo vencido em START_REQUESTED → onActivityError -1 e STOPPED; se as escritas já aconteceram (ou acontecerem
  depois), StopActivity interno e a chave do instante do prazo vai para as confirmações de WORKOUTS; se o pedido ainda
  estava na fila, ele sai com CANCELLED (reject com onError, sem novo onActivityError); eco atrasado só vai ao log;
- recusa no START_REQUESTED → 1 ou 2;
- NOT_READY ou NOT_SUPPORTED → onError, reject e onActivityError -1.

**rationale:** O eco chegou em cerca de 4 s na captura e às vezes não vem. A fila é FIFO e sem cancelamento
(SessionEngine.kt:849, :1145), com comandos internos que podem entrar antes (RefreshSteps, ApplySteps). Contar do pedido
JS mantém os 10 s abaixo dos 12 s da tela do Condor, e o notAfter impede que o relógio receba 68 tt e logo 68 FF. Ligar
o serviço só depois das escritas evita subir e derrubar a notificação num SMA, num iDO ou sem conexão.

### F3-D16

**decision:** Pausa e retomada otimistas: depois da escrita do 68 FE/FD, o CoreBridge muda o estado e emite
onActivityStatusV2 (4 ou 3) antes do resolve. O driver lembra cada 68 escrito na conexão com o instante: um RX FE/FD de
1 byte é eco (fromWatch = false, idempotente) se o mesmo byte foi escrito nos últimos 10 s e nenhum 68 mais novo foi
escrito depois; se foi superado por um 68 mais novo, só log; sem escrita correspondente, é ação feita no relógio
(fromWatch = true) e muda o estado. A recusa [FE|FD, 01] só vai ao log e nunca derruba a atividade.

**rationale:** Com o P85, a produção provavelmente nunca pausava no app: o 68 FE ficou sem eco em walk@175572. O único
eco medido levou 3973 ms, e o Condor libera um novo toque em 1 s: sem a janela, um FE atrasado depois de um FD seria
lido como pausa feita no relógio.

### F3-D17

**decision:** Fim:
- stopActivityV2() → STOP_REQUESTED (as atualizações e o B2 0D param);
- perform(StopActivity): 68 FF e resposta opcional até 4 s, casada só por cmd 68, tamanho 1 e [0] = FF;
- depois, fetchLastWorkout: B2 02 0E e B2 04/05 com o id ecoado, e a sessão mescla o registro;
- o CoreBridge procura em getWorkouts um registro WATCH a ±10 s do início do telefone; se achar, usa início, tempo
  ativo, passos, kcal, distância e FC do relógio; senão, os dados do telefone;
- grava o registro PHONE com storeWorkout, emite onActivityCompletedV2 (status 0, com fila), desliga o trabalho de
  atividade e resolve;
- falha ou queda em qualquer passo fecham com os dados do telefone;
- 68 FF sem pedido (fim pelo relógio) → só o fetchLastWorkout e o mesmo fechamento.

**rationale:** Reproduz o caminho do Android (correção do início pelo registro 14, tolerância de 10 s), sem a espera
infinita pelo eco e sem os três 68 FF do iOS. Uma recusa [FF, 01] não pode ser consumida como eco.

### F3-D18

**decision:** stopActivityV2({forceStop: true}): para a atividade localmente, sem evento, e não grava registro. Põe o
segundo epoch do início do telefone nas confirmações de WORKOUTS (confirmUploaded), para a coleta pular a cópia do
relógio (±10 s). Manda 68 FF só se estiver conectado (melhor esforço, sem ler o registro). Resolve na hora.

**rationale:** O Condor só aborta depois de 5 min sem conexão e sobe ele mesmo o último update, com o início do telefone
(useExerciseData:397-401). Sem a chave, o próximo sync coletaria a cópia do relógio como Watch com outro registered_at,
e o backend criaria um segundo exercício. A chave é podada em 30 dias, como as outras.

### F3-D19

**decision:** Atualizações ao vivo:
- tick fixo de 1 s em STARTED/RESUME, onActivityUpdateV2 com status 2 ou 3; o tick só dispara a emissão;
- secondsDuration pela diferença do relógio de parede (nowMillis) desde o início, menos as pausas, nunca negativo nem
  decrescente;
- passos, kcal e watchDistance pelo delta do onLiveSteps desde o início (base = último antes do início, ou o primeiro
  depois dele); um total menor que a base (virada do dia) vira nova base, somando a parcial anterior, sem valor
  negativo;
- averageBpm pela média dos HeartRateMeasured (2A37) desde o início, que já chegam filtrados (40..200 e com contato);
- cadência, velocidade e pace calculados;
- nada depois do STOP_REQUESTED.

**rationale:** Sem o 0x57, a produção Android manda zeros com o P85. O relógio monotônico do Kotlin no Android é o
System.nanoTime, que não anda com a CPU suspensa, e o serviço em primeiro plano não segura wakelock: com a tela apagada,
a duração ficaria curta. O FEE1 é total do dia.

### F3-D20

**decision:** Deduplicação entre a atividade do app e a cópia dela no relógio: o registro PHONE leva o início do relógio
quando o registro casou. O readWorkouts recebe como conhecidos os inícios guardados e as chaves confirmadas, inclusive
as do forceStop e do prazo vencido, com tolerância de ±10 s. O mergeWorkouts nunca troca PHONE por WATCH.

**rationale:** O P85 lista também a atividade iniciada pelo app (walk@179720). Sem isso, o backend receberia duas vezes
(Phone e Watch).

### F3-D21

**decision:** Com atividade do app ativa (STARTED, RESUME ou PAUSED) e a sessão fora de READY/SYNCING, o
onConnectStateChanged sai com state 3 (disconnectOnActivity), também no emitCurrentState. Ao voltar, sai 2. A atividade
continua. Na transição para STOPPED (fim normal, forceStop, prazo vencido) com a sessão fora de READY/SYNCING, o
CoreBridge chama o emitCurrentState para o JS receber o estado real (0 ou 1).

**rationale:** Paridade com a produção (CRPBluetoothListener.java:67-77). Sem a reemissão, o Condor fica em
DISCONNECTED_ON_ACTIVITY depois de um abortar (usePairingData.ts:85-111) e o handleComplete dispara um novo pareamento.

### F3-D22

**decision:** Trabalho de atividade no host: CoreHost.startActivityWork() depois do perform(StartActivity) bem-sucedido,
e stopActivityWork() no STOPPED ou abortado, uma vez cada e só se foi ligado. No Android, o SyncForegroundService passa
a contar por motivo (sync, atividade), com a notificação 'Atividade em andamento' e o tipo connectedDevice. No iOS, só
log.

**rationale:** Uma caminhada é feita com a tela apagada. O app ainda está em primeiro plano cerca de 0,5 s depois do
pedido, o que o Android 12+ permite. Fecha a contradição com o F3-D15.

### F3-D23

**decision:** Um syncDataHistory durante uma atividade do app roda sem WORKOUTS. Pausa e fim esperam na fila (DP-05) o
sync e também o sync de ajustes que o Condor faz logo depois (runLastSyncStep → syncUserSettings → setUserInfoOnWatch),
sem faixa urgente.

**rationale:** A produção ignora o histórico de treinos com atividade em andamento. O Condor sincroniza sozinho ao
voltar ao primeiro plano depois de 30 min, e a fila ficou 10,2 s ocupada com 20 ajustes na validação. Uma faixa urgente
na SessionEngine não cabe no prazo.

### F3-D24

**decision:** JS:
- os 9 métodos novos são Promise\<void>/Promise\<string> embrulhados em observed();
- stopActivityV2(options?) manda {} quando vem undefined;
- TechnosCore.activityTypes é cópia literal da tabela de core@v4.3.57:src/NativeModules/index.ts:45+;
- exportados como VALOR, na raiz e no mock: TechnosActivityV2Status (0..5), TechnosActivityOrigin ('Watch', 'Phone'),
  TechnosActivityErrorCode (-1..4) e PlanType (Run3Km = 1 .. MarathonTrainingPhase2), cópias dos enums do Core;
- TechnosActivityHistoryV2Activity é cópia literal da interface do Core, com todos os opcionais;
- os 10 eventos ficam em TechnosEvents, technosEventNames e no mock;
- LOW_BATTERY entra em errorCodes;
- o comentário do deletedCategory passa a dizer que ACTIVITY, STRESS e HEART_HERT têm efeito.

**rationale:** O Condor chama tudo sem await e usa os nomes do Core. O mapCoreActivityStatusToApp faz switch em
TechnosActivityV2Status (mappers/entities/activity.ts:9, :279-293) e o constants/Exercises usa PlanType no nível do
módulo (:3, :1724+); hoje o Repo 2 só reexporta tipos (`export type *`, src/index.ts:477), então a fase 4 quebraria em
tempo de execução.

### F3-D25

**decision:** Componentes em src/components:
- TechnosNativeChronometer: Text que mostra o secondsDuration do último onActivityUpdateV2, a partir de um activityClock
  assinado no primeiro mount; zera no completed e no stop; mesmas props do Core (chronometerStyle 'condor' →
  Gotham-Bold, fontSize em 6 tamanhos, color, textCenter);
- TechnosNativeMap: View com style e as mesmas props, sem conteúdo;
- TechnosMapStyles com os mesmos nomes;
- TechnosNativeActionTimer mostra 00:00.

**rationale:** O Condor importa os quatro do Core. O cronômetro é indispensável na tela da atividade e sai barato em JS.
Mapa nativo ou sobre o react-native-maps depende da fatia de GPS (pergunta 1).

### F3-D26

**decision:** checkIosBackgroundLocationPermission chama CoreHost.locationAuthorization(). No iOS, 'granted' só com
authorizedAlways e 'denied' no resto. No Android vem null, e o CoreBridge rejeita NOT_SUPPORTED com onError. No app de
exemplo valida-se só o 'denied'; o 'granted' fica para o Condor na fase 4.

**rationale:** É o portão de toda atividade com mapa no iOS do Condor. O exemplo tem NSLocationWhenInUseUsageDescription
vazio e não tem a chave Always (example/ios Info.plist:38-39), então o iOS nem mostra a opção 'Sempre' para ele.

### F3-D27

**decision:** Privacidade: nada de redação de RX na fase 3. Os RX 35, B9 11 03, B2 03 e B2 05 e o 2A37 vão inteiros ao
log e aos exports, como os passos e o sono da fase 1. Os exports fase3-* nunca entram em fixtures/real, e o Repo 1 só
ganha vetores sintéticos e testes de layout. A redação de RX de saúde vira pendência no Repo 1.

**rationale:** A ADR 36 só redige TX. Redigir RX fragmentado exige mexer na remontagem e no gravador e não cabe no
prazo. A regra de não versionar fecha o risco enquanto isso.

### F3-D28

**decision:** Replays:
- a fixture sintética do Condor é regenerada com o tráfego da fase 3, com o simulador respondendo FC, estresse e um
  treino;
- os testes do Repo 1 que passam gravações reais do CRP pelo CoreBridge recebem kinds [STEPS, SLEEP] por um parâmetro
  interno;
- no Repo 2 iOS, os dois testes com gravações reais do Condor usam uma lista de TX tolerados no ReplayTransport (B6/02,
  35/xx, B9/11/03, B2/06, B2/00), sem resposta, e o timeout do sync sobe para 60 s.

**rationale:** As gravações reais da fase 1 não têm esses pedidos e o ReplayTransport é estrito. Com a desistência na
primeira página, cada teste ganha uns 12 s.

### F3-D29

**decision:** Fila de eventos com o JS ausente: onActivityCompletedV2 e os 4 eventos de histórico entram na fila
(queueIfNotReady). onActivityStartedV2, onActivityStatusV2, onActivityUpdateV2, onActivityError e
onActivityRealTimeSpeed não entram.

**rationale:** O fim não pode se perder num reload, porque é o que sobe a atividade ao backend.

### F3-D30

**decision:** B2 0D durante a atividade do app: além do zerado antes do 68 de início, um B2 0D zerado a cada 5 s em
STARTED/RESUME (o primeiro 5 s depois do STARTED), por WatchAction.PhoneActivityInfo(0), no máximo um na fila
(coalescido), só com a sessão em READY/SYNCING; para em PAUSED e no STOP_REQUESTED; sem o B2 0D final.

**rationale:** A produção manda o B2 0D em todo tick, com ou sem GPS (CRPActivityManagerV2.java:422-449, 492-500), a
cada 1 a 5 s pela RAM (ProgressIntervalAdjust.java:33-44: 5 s abaixo de 2 GB). Uma atividade sem nenhum B2 0D nunca foi
observada e pode fazer o P85 encerrar o modo ligado ao telefone. A cada 5 s fica dentro do que a produção já faz e ocupa
uns 4% da fila.

### F3-D31

**decision:** Tabela de tipos Technos → CRP única nas duas plataformas: a do Android
(CRPSmart1ActivityMapper.kt:150-284) mais as entradas que só o iOS tem (CRPSmart1TypeMapper.m), hoje functionalTraining
217 → 73, back 318 → 75 e lowerBody 319 → 76. A volta CRP → Technos é a do Android. Gerada por script, que compara as
duas tabelas da v4.3.57 e falha numa divergência não listada.

**rationale:** No Android de produção os três caem no FREE_TRAINING 18, e o relógio mostra 'treino livre'; o Condor os
oferece ao REEBOK (constants/Exercises/index.ts:1829-1832). A tabela do iOS é mais específica.

### F3-D32

**decision:** WatchSession.storeWorkout pode ser chamado de qualquer thread, mas a mescla e a gravação rodam na thread
da sessão, pela caixa de entrada (o mesmo `call(...)` que o confirmUploaded usa para gravar). O CoreBridge não depende
de ler o registro logo depois: o onActivityCompletedV2 sai do payload que ele montou.

**rationale:** O HistoryStore só aceita escrita concorrente nas chaves confirmadas (AtomicReference); passos, sono e
treinos têm um escritor só, a thread da sessão (HistoryStore.kt:24-31). Assim o mergeWorkouts do readWorkouts e do
fetchLastWorkout nunca concorre com o storeWorkout.

### F3-D33

**decision:** Publicação e portões: só o dono da S0 e o integrador (S10) rodam publishToMavenLocal e o XCFramework, na
coordenada 0.1.0; há uma publicação intermediária pelo integrador quando S3 e S4 fecham, para os testes de replay da S8.
Cada fatia do Repo 1 roda só `:protocol:jvmTest` e `:bridge:jvmTest` com os próprios testes; o `./gradlew check`
completo (4 targets, interop, dokka) roda só na publicação intermediária e na S10.

**rationale:** Agentes paralelos publicando na mesma coordenada sobrescrevem o trabalho uns dos outros, e cinco builds
K/N disputam CPU e o cache do konan. Mudar a versão a cada publicação obrigaria a editar o build.gradle do Repo 2 cada
vez.

### F3-D34

**decision:** Manifest no Condor (fase 4): o FINE com android:maxSdkVersion=30 do Repo 2 é mesclado na declaração do
Condor; o Condor precisa declarar ACCESS_FINE_LOCATION com tools:remove='android:maxSdkVersion' e
ACCESS_BACKGROUND_LOCATION. Fica registrado no DP-69 e na migração do api-js.md, e o checklist da fase 4 confere o
manifest mesclado (processDebugManifest). O Repo 2 não muda o próprio manifest.

**rationale:** O merger acrescenta ao elemento do app o atributo que só a biblioteca declara (manifest-merger
XmlAttribute.mergeInHigherPriorityElement, 30.3.1:168-177). Sem as duas linhas, no Android 12+ o Condor perde o FINE
(pareamento e atividades com mapa travam) e nunca tem o BACKGROUND que o Permission.ts:34-46 exige. A produção declarava
os três sem maxSdk (TechnosWareCore v4.3.57 AndroidManifest.xml:100-102).

## Comandos do relógio

**1.**

**symbol:** getHistoryHeartRate: leitura no syncDataHistory, B6 02 escrito e 0x35 em 8 páginas

**frames:** TX FE EA [b2] 08 B6 02 00 00, só escrita (200 ms, sem matcher), depois TX FE EA [b2] 06 35 [pp] com pp
00..03 (hoje); depois TX FE EA [b2] 08 B6 02 01 00, só escrita, e 35 04..07 (ontem). Um pedido de página por vez. b2 =
20 com bloco ≥ 24 (MTU 515/517) e 10 com bloco 20. Atraso pós-escrita de 500 ms no 35 (CrpCommand.postDelayMs). Um RX B6
02 que chegue vai só ao log.

**response:** RX FE EA 20 4E 35 [pp] v0..v71: payload de 73 bytes (página + 72 u8), casado por (35, pp), MULTIPLEXED.
Slot do dia = (pp mod 4)×72 + i; instante = início do dia local de hoje ou de ontem + slot×5 min. Valor fora de 40..200
= sem medição. Hoje, os slots depois de minutosDoDia/5 são descartados. Timeout de 4 s: na 35 00 desiste da FC no sync
(WARN); em outra página, pula só ela. Nenhuma resposta ao B6 02 é esperada.

**vector:** TX FE EA 20 08 B6 02 00 00; TX FE EA 20 06 35 02; com bloco 20: FE EA 10 06 35 02. RX FE EA 20 4E 35 02 48
46 96 + 69×00, telefone em 2026-11-02 18:00 −03:00 → amostras (1793631600000, 72), (1793631900000, 70), (1793632200000,
150). Com 27 ou C9 na mesma posição, a amostra fica ausente. Com o telefone às 12:07, os slots depois de 12:05 saem.
Ontem: TX FE EA 20 08 B6 02 01 00 antes do TX 35 04.

**source:** sdk:h/a.java:688-706; sdk:f/p0.java:51-55, 82-89; sdk:j/u.java:37-140, 163-165, 314-340;
sdk:m/a.java:718-720; sdk:m/f.java:94-130; pair-sync@57971→@58200 e walk@21888→@22118 (B6 02 escrito cerca de 230 ms
antes do 35 00, sem resposta); pair-sync@58200→@58558 (RX de 73 bytes); páginas pair-sync@59411..@63957 e
walk@22118..@24204.

**2.**

**symbol:** getHistoryStress: leitura no sync, B9 11 03 dd

**frames:** TX FE EA [b2] 08 B9 11 03 [dd], com dd 00 para hoje e 01 para ontem. Atraso de 200 ms. Constante nova
SUB_STRESS_HISTORY = 0x03; rótulo B9/11/03 STRESS_HISTORY.

**response:** RX FE EA 20 38 B9 11 03 [dd] s0..s47: payload de 51 bytes; exige ≥ 50 bytes, como a SDK. Casamento por
(B9, 11, 03, dd): o B9 11 00 FF (ao vivo, walk@41416) e o B9 11 01 (estado da fase 2) não casam. Slot i = início do dia
+ i×30 min. 0 = sem medição; > 100 é aceito com WARN. Hoje, os slots depois de minutosDoDia/30 são descartados. Timeout
no dd 00 desiste do estresse no sync.

**vector:** TX FE EA 20 08 B9 11 03 00. RX FE EA 20 38 B9 11 03 00 + 48 bytes, com s20=1E, s21=28, s22=32, s25=14,
s26=1F, s27=20 e o resto 00 → com o telefone às 18:00 −03:00: 10:00=30, 10:30=40, 11:00=50, 12:30=20, 13:00=31,
13:30=32.

**source:** sdk:f/r1.java:62-69; sdk:h/a.java:1568-1570; sdk:m/a.java:679-681, 2018-2039, 2301-2335;
sdk:j/r0.java:37-76; pair-sync@60160→@60207 e @60386→@60959 (51 bytes); walk@22645→@23229.

**3.**

**symbol:** getHistoryActivityV2: coleta no sync, B2 06 escrito e lista B2 00 → B2 01

**frames:** TX FE EA [b2] 06 B2 06, só escrita (200 ms, sem matcher), depois TX FE EA [b2] 06 B2 00 com expect B2 01,
atraso de 200 ms. Um RX B2 06 que chegue vai só ao log.

**response:** RX B2 01: [01] + N × [início u32 LE][tipo CRP u8]; id do slot = índice 0-based. O P85 manda sempre 5 slots
(payload 26); slot vazio = 00 00 00 00 00, e o mais novo fica à direita. O início são os segundos do relógio de parede
local lidos como GMT+8: epoch real = u32 − (offset do telefone − 8 h). Slot com início ≤ 1, fora de agora − 7 dias ou
conhecido (±10 s de início guardado ou chave confirmada) é pulado. B2 01 sem pedido vai só ao log.

**vector:** TX FE EA 20 06 B2 06; TX FE EA 20 06 B2 00. RX FE EA 20 1F B2 01 + 20×00 + 78 CB E7 6A 01 → um treino no
slot 4, tipo CRP 1 (corrida), início 2026-11-02T07:30:00-03:00 (1793615400000) em America/Sao_Paulo. Teste do codec de
hora também com um fuso +09:00.

**source:** sdk:f/w1.java:26-30, 55-59; sdk:h/a.java:1473-1476; sdk:m/a.java:659-660, 2368-2419; sdk:j/t0.java:28-52;
sdk:f/v1.java:47-58; sdk:g1/d.java:98-100; walk@20781→@21009 e pair-sync@56858→@57084 (B2 06 cerca de 226 ms antes do B2
00, sem resposta); pair-sync@57732, walk@21654 e walk@179720 (26 bytes, 5 slots, cerca de 0,65 s).

**4.**

**symbol:** registro de um treino: B2 02 [id] → B2 03 (coleta e fetchLastWorkout)

**frames:** TX FE EA [b2] 07 B2 02 [id], um em voo por vez. Coleta: slots candidatos do mais novo para o mais antigo, id
= índice do slot (0..4). Só o slot ocupado mais novo tem uma segunda tentativa, com id 0E, se o índice der timeout ou
início diferente. Se o índice falhar em qualquer slot, ele fica desligado no resto do sync (WARN), e os slots mais
antigos ficam para o próximo sync. No máximo 2 timeouts de B2 02 por sync. fetchLastWorkout: id 0E fixo.

**response:** RX B2 03, payload ≥ 26: aceito qualquer B2 03 enquanto um B2 02 está em voo, qualquer que seja o eco [1].
Layout: [03][id ecoado][início u32 LE][fim u32 LE][validTime u16 LE s][1 byte desconhecido, só log][tipo u8][passos u32
LE][distância u32 LE m][kcal u16 LE][2 bytes desconhecidos]. Na coleta, só é gravado se o início for igual ao do slot;
senão, WARN e a próxima candidata. O id ecoado é o que vai no B2 04 e casa o B2 05. Duração > 3 dias ou fim < início:
descartado com WARN.

**vector:** Coleta do slot 4: TX FE EA 20 07 B2 02 04 → RX FE EA 20 1F B2 03 04 78 CB E7 6A 80 D2 E7 6A D6 06 78 01 A0
0F 00 00 AC 0D 00 00 FA 00 00 00 → início 07:30:00, fim 08:00:00 −03:00, ativo 1750 s, tipo 1 (Technos 2), 4000 passos,
3500 m, 250 kcal; o B2 04 sai com id 04. Eco diferente do pedido: TX B2 02 04 → RX B2 03 0E com o mesmo corpo → aceito
pelo início, o B2 04 sai com id 0E. Queda para o 0E: TX B2 02 04 sem resposta (4 s) → TX FE EA 20 07 B2 02 0E → RX B2 03
0E com o início do slot 4 → gravado, e o índice fica desligado no sync. Início divergente: RX com início 07:29:00 para o
slot de 07:30 → nada gravado.

**source:** sdk:j/t0.java:35-45 (id = var2/5, o índice), 54-87 (id ecoado guardado e B2 04 pedido com ele, sem conferir
o pedido); sdk:f/w1.java:32-38; CRPService.java:1581-1621 (a produção pede o id da lista); CRPBleSdkSample
DeviceActivity (queryTraining(info.getId())); CRPActivityManagerV2.java:365 e commit f99b6e4cd ('última atividade
registrada'); walk@179735→@179791 (31 bytes, eco 0E, início igual ao do slot 4).

**5.**

**symbol:** FC de um treino: B2 04 [id][offset] → B2 05

**frames:** TX FE EA [b2] 09 B2 04 [id ecoado no B2 03] [offset u16 BE], com o primeiro offset 00 00; depois, o próximo
offset que a resposta trouxe, até FF FF. Guarda: offset que não avança ou mais de 64 páginas aborta (WARN). Aborto ou
timeout: o registro é gravado sem FC (WARN) e a cadeia B2 do sync termina, sem falhar o sync.

**response:** RX B2 05, casado por (B2, 05, id ecoado): [05][id][próximo offset u16 BE][1 u8 de FC por amostra de 10 s].
Fora de 40..200 vale 0 (inválida). FF FF = última página.

**vector:** Uma página: TX FE EA 20 09 B2 04 04 00 00 → RX FE EA 20 0F B2 05 04 FF FF 5A 64 6E 14 82 FF → FC [90, 100,
110, 0, 130, 0]. Duas páginas: RX FE EA 20 0F B2 05 04 00 06 5A 64 6E 14 82 FF → TX FE EA 20 09 B2 04 04 00 06 → RX FE
EA 20 0F B2 05 04 FF FF … → 12 amostras concatenadas. Timeout no B2 04: registro gravado com heartRates [].

**source:** sdk:f/w1.java:40-49; sdk:j/t0.java:84-85, 95-132, 425-428; walk@179958→@180247 (18 bytes, uma página com FF
FF).

**6.**

**symbol:** startActivityByTypeV2: READ 2A19 → B2 0D zerado → 68 [tipo CRP]

**frames:** 0. A sessão confere notAfterEpochMillis (pedido JS + 10 s) ao chegar a vez do comando: vencido → CANCELLED
sem tráfego.
1. READ 2A19: abaixo de 11% (regra do Core; leitura > 100 = carregando, nível − 100) → LOW_BATTERY sem escrever. Depois
   da leitura, o CRP confere o prazo de novo.
2. TX FE EA [b2] 10 B2 0D 00 00 00 00 00 00 00 00 00 00, que é [0D][u32 LE 0][distância u16 LE 0][u16 0][u16 0].
3. TX FE EA [b2] 06 68 [tt], tt = CrpActivityTypes.toCrp(tipo Technos): WALKING 0, RUNNING 1, BIKE 2; as 3 entradas que
   só o iOS tem (F3-D31); fora da tabela, FREE_TRAINING 18.
Só escrita, 200 ms cada, sem matcher.

**response:** Nenhuma resposta casada. O eco RX FE EA 20 06 68 [tt] (1 byte < FD) chega sozinho (cerca de 4 s na
captura) e vai pelo gancho de não pedidos do CrpActivityControl → WatchEvent.ActivityState(STARTED, fromWatch = false),
porque o mesmo byte foi escrito há menos de 10 s. Recusa: ver o comando de RX 68 sem pedido.

**vector:** Correr (Technos 2 → CRP 1): TX FE EA 20 10 B2 0D 00 00 00 00 00 00 00 00 00 00; TX FE EA 20 06 68 01; RX FE
EA 20 06 68 01 → ActivityState(STARTED, false). Bloco 20: FE EA 10 10 B2 0D … e FE EA 10 06 68 01. Com 2A19 = 0A:
LOW_BATTERY e nenhum TX. Treino funcional (Technos 217): TX FE EA 20 06 68 49. Pedido enfileirado atrás de um
RefreshSteps até depois do prazo: nenhum TX, CANCELLED.

**source:** sdk:f/w1.java:105-122; sdk:f/p0.java:25-29; sdk:h/a.java:1110-1114, 1486-1488; sdk:m/a.java:611-612,
3276-3298; CRPActivityManagerV2.java:85-119, 404-416, 502-509; CRPSmart1ActivityMapper.kt:150-284;
CRPSmart1TypeMapper.m:265-506; CRPSmart1ActivityType.kt:22, 71-75; CRPService.java:1814-1822; walk@77865 (B2 0D, 16
bytes), @78089 (68 00), @78992 (READ 2A19), @82062 (eco, 3973 ms depois); 1ª tentativa sem eco em walk@41292.

**7.**

**symbol:** B2 0D periódico durante a atividade do app (WatchAction.PhoneActivityInfo)

**frames:** TX FE EA [b2] 10 B2 0D 00 00 00 00 00 00 00 00 00 00 a cada 5 s em STARTED/RESUME, o primeiro 5 s depois do
STARTED; no máximo um na fila (coalescido); só com a sessão em READY/SYNCING; para em PAUSED e no STOP_REQUESTED; sem o
B2 0D final. Só escrita, 200 ms.

**response:** Nenhuma: o despacho do B2 na SDK não tem o sub 0D.

**vector:** FE EA 20 10 B2 0D 00 00 00 00 00 00 00 00 00 00 a cada 5 s; com bloco 20, FE EA 10 10 B2 0D 00 00 00 00 00
00 00 00 00 00. Com a sessão fora do ar, nenhum TX e nenhuma recusa acumulada.

**source:** CRPActivityManagerV2.java:422-449 (updatePhoneMetrics em todo tick, sem depender do locationEnabled),
492-509; ProgressIntervalAdjust.java:33-44 (5 s abaixo de 2 GB de RAM); CRPActivityManagerV2.m:319, 447-452 (iOS a cada
1 s); sdk:m/a.java:2368-2419; walk@83089..@179089 (1 Hz no aparelho da captura).

**8.**

**symbol:** pauseActivityV2: 68 FE

**frames:** TX FE EA [b2] 06 68 FE, só escrita, 200 ms. O driver guarda o byte e o instante da escrita.

**response:** Eco esperado pela SDK: RX FE EA 20 06 68 FE. Com TX 68 FE nos últimos 10 s e nenhum 68 mais novo escrito
depois: eco → ActivityState(PAUSED, fromWatch = false), idempotente com o estado otimista. Superado por um 68 mais novo:
só log. Sem escrita correspondente: pausa feita no relógio (fromWatch = true). Recusa RX 68 FE 01: só log. Na captura
não veio eco.

**vector:** TX FE EA 20 06 68 FE; RX sintético FE EA 20 06 68 FE 2 s depois → eco, sem evento novo.

**source:** sdk:f/p0.java:25-29; sdk:h/a.java:1116-1120; sdk:m/a.java:3278-3292; CRPActivityManagerV2.java:179-185,
319-324; walk@175572 (TX sem eco até o 68 FF).

**9.**

**symbol:** resumeActivityV2: 68 FD

**frames:** TX FE EA [b2] 06 68 FD, só escrita, 200 ms. O driver guarda o byte e o instante da escrita.

**response:** Eco esperado: RX FE EA 20 06 68 FD, pela mesma regra de janela de 10 s → ActivityState(RESUMED, fromWatch
= false). Sem escrita correspondente: retomada feita no relógio. Recusa RX 68 FD 01: só log. Nunca visto no ar.

**vector:** TX FE EA 20 06 68 FD; RX sintético FE EA 20 06 68 FD.

**source:** sdk:f/p0.java:25-29; sdk:h/a.java:1116-1120; sdk:m/a.java:3290-3292; CRPActivityManagerV2.java:187-193,
326-331.

**10.**

**symbol:** stopActivityV2: 68 FF + fetchLastWorkout (B2 02 0E, B2 04 com o id ecoado)

**frames:** TX FE EA [b2] 06 68 FF, com resposta opcional (expectOptional) até 4 s, casada só por cmd 68, tamanho 1 e
[0] = FF; a ausência não falha, e uma recusa [FF, 01] não casa. Em seguida, na fila, fetchLastWorkout: TX FE EA [b2] 07
B2 02 0E, depois TX FE EA [b2] 09 B2 04 [id ecoado] [offset].

**response:** Na captura: RX B2 01 sem pedido 2 ms antes do eco (só log); RX 68 FF em 401 ms; B2 03 em 56 ms; B2 05 em
0,29 s. Um 6D FF sem pedido, 13,7 s depois, não casa com nada.

**vector:** TX FE EA 20 06 68 FF; RX FE EA 20 06 68 FF; TX FE EA 20 07 B2 02 0E; RX FE EA 20 1F B2 03 0E A0 EE E7 6A A8
F5 E7 6A F4 06 00 01 AC 0D 00 00 68 10 00 00 FA 00 00 00 (início 10:00:00, fim 10:30:00 −03:00, ativo 1780 s, corrida,
3500 passos, 4200 m, 250 kcal); TX FE EA 20 09 B2 04 0E 00 00; RX FE EA 20 0F B2 05 0E FF FF 78 82 8C 00 96 FA → FC
[120, 130, 140, 0, 150, 0]. RX FE EA 20 07 68 FF 01 durante a espera: não casa, só log.

**source:** sdk:f/p0.java:25-29; sdk:h/a.java:1116-1120; sdk:m/a.java:3276-3298; CRPActivityManagerV2.java:199-216,
238-280, 349-368, 600-603; CRPActivityManagerV2.m:106-116, 206-270; walk@179321 (68 FF), @179720 (B2 01), @179722 (eco),
@179735/@179791 (B2 02/03), @179958/@180247 (B2 04/05), @193394 (6D FF).

**11.**

**symbol:** RX 68 sem pedido (eco, recusa, aviso do relógio)

**frames:** Nenhum TX: gancho de não pedidos do CrpActivityControl, que guarda cada 68 escrito na conexão com o
instante.

**response:** Regra da SDK: tamanho 1 → estado: < FD = STARTED, FD = RESUMED, FE = PAUSED, FF = STOPPED; fromWatch =
false se o mesmo byte foi escrito nos últimos 10 s e nenhum 68 mais novo foi escrito depois; superado por um 68 mais
novo: só log; sem escrita: fromWatch = true. Tamanho 2 com [1] = 01 → ActivityRefused(requested = fase do último 68
escrito na conexão, ou null, lowBattery = ([0] == FF)). Qualquer outro frame com 2 bytes ou mais → FC legada, só log. O
CoreBridge só traduz recusa em START_REQUESTED (lowBattery → onActivityError 2, senão 1); em outros estados, só log.
STARTED sem atividade pedida pelo app: só log.

**vector:** Depois de TX 68 01: RX FE EA 20 07 68 01 01 → ActivityRefused(STARTED, false) → 1; RX FE EA 20 07 68 05 01 →
ActivityRefused(STARTED, false) → 1; RX FE EA 20 07 68 FF 01 → ActivityRefused(STARTED, true) → 2; RX FE EA 20 08 68 01
01 00 → FC legada, só log. TX 68 FE em t, TX 68 FD em t + 1 s, RX 68 FE em t + 4 s → superado, só log; RX 68 FD em t + 5
s → eco. RX 68 FE sem TX nos últimos 10 s, com a atividade ativa → pausa feita no relógio.

**source:** sdk:m/a.java:3276-3298 (e0: tamanho 2 com [1] = 1 → onStartFailed ou onMeasuring; ≥ 2 → FC legada; 1 →
onMeasureState ou onStartSuccess); sdk:j/u.java:208-215; CRPService.java:1659-1709; CRPService.m:1211-1235;
condor:screensV2/activity/ActivityAction/ActionButtons/index.tsx:19-43 (novo toque em 1 s).

**12.**

**symbol:** FC ao vivo durante a atividade: notificação 2A37

**frames:** Nenhum TX: notificação lateral de 2A37 (serviço 180D), que a sessão já assina.

**response:** flags[0] bit 0 = 0: FC u8 em [1]; bit 0 = 1: u16 LE. Bits 1-2 = 10 (contato suportado e não detectado):
ignorado (DEBUG). FC fora de 40..200: ignorada (DEBUG). Senão WatchEvent.HeartRateMeasured(bpm), só com a tentativa
pronta. Hoje só vai ao log (CrpDriver.handleSide).

**vector:** 2A37 06 4E → HeartRateMeasured(78); 2A37 07 4E 00 → HeartRateMeasured(78); 2A37 04 4E → ignorado (sem
contato); 2A37 06 00 e 2A37 06 27 → ignorados (fora da faixa); 2A37 de 1 byte → ignorado.

**source:** Heart Rate Measurement (Bluetooth HRS, flags bits 0-2); CrpDriver.kt:523-534; sdk:j/t0.java:112-114 e
sdk:j/u.java:133 (faixa 40..200); real@20285..@29218, ios-walk@341681..@350681 (flags 06), walk (24 leituras durante a
atividade).

**13.**

**symbol:** Comandos que a fase 3 não manda (desvios)

**frames:** B2 07, B2 09, B2 0E e B2 10 (passos, distância, altitude e avançado por 10 s, só com nível ≥ 1), AB 02
(SpO2), 57 (dados ao vivo do treino) e B2 0D com distância diferente de 0 (sem GPS).

**response:** O P85 nunca respondeu ao B2 06, então o nível fica 0 e as listas não se aplicam. AB e 57 nunca foram
vistos com o P85.

**vector:** Nenhum: os testes de sessão conferem que nenhum desses TX sai num sync nem numa atividade, que sai
exatamente um B2 0D zerado antes de cada 68 de início e que os B2 0D seguintes são zerados, a cada 5 s, só em
STARTED/RESUME.

**source:** sdk:f/i.java:64-68; sdk:f/w1.java:51-103; sdk:com/crrepa/n/d.java:34-107; walk@20781 e pair-sync@56858 (B2
06 sem resposta); CRPActivityManagerV2.java:397, 439, 492-514.

**14.**

**symbol:** getHistorySpO2 / onHistorySpo2

**frames:** Nenhum: a produção nunca manda AB ao P85, que não tem DeviceFeature.SPO2.

**response:** {historyspo2: []} sempre, em toda família, antes do resolve.

**vector:** getHistorySpO2(3) → onHistorySpo2 {historyspo2: []} → resolve null.

**source:** DeviceFeatures.kt:41-46; DeviceFeatures.m:55-59; CRPService.java:501-547; CRPService.m:451-493;
condor:services/History/Spo2History/index.ts:6-10.

**15.**

**symbol:** deletedSavedData, categorias 1, 2, 3 e 4

**frames:** Nenhum: só o histórico local.

**response:** 4 → HEART_RATE e 2 → STRESS, com chave de hora local yyyy-MM-ddTHH no fuso do telefone. 1 → WORKOUTS, com
chave = segundo epoch do início, casando com ±1 s. 3 → ignorada (DEBUG). As chaves de WORKOUTS sobrevivem à poda do sync
(poda numérica por tipo).

**vector:** [{category: 4, registered_at: '2026-11-02T12:00:00-03:00'}] e [{category: 4, registered_at:
'2026-11-02T15:00:00Z'}] → HEART_RATE '2026-11-02T12'. [{category: 1, registered_at: '2026-11-02T10:30:00.000Z'}] →
WORKOUTS '1793615400' → some o treino de 07:30, e continua escondido depois de um sync com poda. [{category: 1,
registered_at: '2026-11-02T07:30:05-03:00'}] → WARN, nada marcado.

**source:** condor:mappers/entities/general.ts:7-27; CRPService.java:848-868; HeartRateHistoryRepository.java:65-90;
ActivityHistoryRepository.java:74-97; ActivityRepository.m:501-545; StressRepository.m:149-163; HistoryStore.kt:159-163.

**16.**

**symbol:** checkIosBackgroundLocationPermission

**frames:** Nenhum.

**response:** iOS: 'granted' só com authorizedAlways; notDetermined, restricted, denied e authorizedWhenInUse →
'denied'. Android: rejeita NOT_SUPPORTED com onError (a produção rejeita '-1').

**vector:** Exemplo no iPhone (sem string de uso de localização) → 'denied'. O 'granted' com 'Sempre' nos Ajustes é
conferido no Condor na fase 4.

**source:** NativeCoreManager.m:139-153; RCTNativeCore.mm:668-672; NativeCoreModule.kt:915-917;
condor:services/Permission.ts:34-46; example/ios Info.plist:38-39.

## API (Kotlin e JS)

DOMÍNIO (:protocol domain/; tudo público, sem value class nem kotlinx na API)
- DataKind ganha HEART_RATE, STRESS e WORKOUTS depois de SLEEP. A ordem de DataKind.entries é a ordem do sync.
- MeasurementSample(atEpochMillis: Long, value: Int).
- WorkoutRecord(startEpochMillis, endEpochMillis, activeSeconds, sportType, familySportType, steps, distanceMeters,
  calories, heartRates: List\<Int>, heartRateIntervalSeconds, origin: WorkoutOrigin, locationEnabled = false,
  gpsDistanceMeters = 0):
  - sportType está no vocabulário Technos;
  - heartRates usa 0 para "sem leitura" e pode vir vazio (B2 05 perdido);
  - WorkoutOrigin é {WATCH, PHONE}.
- WatchAction ganha StartActivity(sportType: Int, notAfterEpochMillis: Long), PauseActivity, ResumeActivity,
  StopActivity e PhoneActivityInfo(distanceMeters: Int).
- WatchEvent ganha:
  - ActivityState(phase: ActivityPhase, fromWatch: Boolean);
  - ActivityRefused(requested: ActivityPhase?, lowBattery: Boolean);
  - HeartRateMeasured(bpm: Int), já filtrado (40..200, com contato);
  - enum ActivityPhase {STARTED, PAUSED, RESUMED, STOPPED}.
- WatchErrorCodes.LOW_BATTERY (15º código). CANCELLED (já existe) também cobre o StartActivity vencido na fila.
- DeviceProfile.dataKinds: padrão [STEPS, SLEEP]; CONDOR_REEBOK = [STEPS, SLEEP, HEART_RATE, STRESS, WORKOUTS].

DEVICEDRIVER (interno)
- Novos, todos com padrão notSupported (SMA e iDO herdam):
  - readMeasurements(kind): List\<MeasurementSample>;
  - readWorkouts(sinceEpochMillis: Long, knownStartSeconds: Set\<Long>): List\<WorkoutRecord>;
  - readLastWorkout(): WorkoutRecord?.
- CRP, em grupos como na fase 2 (ADR 35):
  - CrpHealthReader (B6 02 escrito, 35, B9 11 03);
  - CrpWorkoutReader (B2 06 escrito, B2 00..05; índice, queda 0E, eco aceito, id ecoado no B2 04);
  - CrpActivityControl (perform das 5 ações; memória dos 68 escritos com instante; gancho do RX 68 e do B2 01 sem
    pedido; conferência do notAfter depois do 2A19);
  - CrpActivityTypes (tabela única Technos ↔ CRP, gerada da v4.3.57: Android + entradas só do iOS);
  - CrpDriver.handleSide passa a emitir HeartRateMeasured do 2A37, com os filtros;
  - CrpCommand ganha os rótulos B6/02 HEART_RATE_HISTORY_V2, 35/pp HEART_RATE_TIMING, B9/11/03 STRESS_HISTORY, B2/00
    TRAINING_LIST, B2/01 TRAINING_LIST_REPLY, B2/02 TRAINING_RECORD, B2/03 TRAINING_RECORD_REPLY, B2/04 TRAINING_HR,
    B2/05 TRAINING_HR_REPLY, B2/06 TRAINING_DETAIL, B2/0D PHONE_SPORT_INFO, 68 ACTIVITY_CONTROL e 57 TRAINING_REALTIME
    (só rótulo).

SESSÃO (WatchSession, pública)
- getMeasurements(kind, daysBefore): List\<MeasurementSample>: não confirmadas, até agora. Síncrona e segura em qualquer
  thread, como o getStepsDays.
- getWorkouts(): List\<WorkoutRecord>: não confirmados, em ordem de início.
- storeWorkout(record): de qualquer thread; a mescla e a gravação rodam na thread da sessão pela caixa de entrada.
  Substitui o registro de mesmo início (±1 s); PHONE vence WATCH.
- fetchLastWorkout(requestId): pela fila; chama driver.readLastWorkout, mescla em WORKOUTS e termina com onCompleted.
  Erros: NOT_READY, NOT_SUPPORTED, TIMEOUT, PROTOCOL, DISCONNECTED, CANCELLED.
- perform(StartActivity): ao chegar a vez, notAfter vencido → CANCELLED sem chamar o driver.
- confirmUploaded(kind, keys): o formato da chave depende do tipo (dia; hora local yyyy-MM-ddTHH; segundo epoch do
  início). Outro formato é ignorado com WARN.
- syncHistory(kinds): tipos pedidos ∩ profile.dataKinds; só STEPS é fatal.
- Internos: SessionCommand.FetchLastWorkout. O HistoryStore guarda medições por tipo e treinos, com mescla, janela,
  confirmação por tipo, poda por tipo (texto para dia e hora, número para WORKOUTS) e clear.

SAMPLESTORE (contrato com o host)
- loadMeasurements(kind) / saveMeasurements(kind, samples);
- loadWorkouts() / saveWorkouts(records);
- loadConfirmedDays/saveConfirmedDays guardam as chaves de cada tipo;
- InMemorySampleStore muda junto.

COREHOST (+5 métodos)
- startActivityWork() / stopActivityWork().
- loadPreference(key): String? / savePreference(key, value: String?). Hoje só a chave 'userProfile'.
- locationAuthorization(): String?: 'granted' ou 'denied' no iOS; null no Android.

COREBRIDGE (+9 métodos, nomes do Core, todos com CoreCompletion)
- getHistoryHeartRate(daysBefore: Double), getHistoryStress(daysBefore: Double), getHistorySpO2(daysBefore: Double),
  getHistoryActivityV2().
- startActivityByTypeV2(options: Map\<String, Any?>), pauseActivityV2(), resumeActivityV2(), stopActivityV2(options:
  Map\<String, Any?>).
- checkIosBackgroundLocationPermission().
- O construtor interno ganha nowMillis: () -> Long e o dispatcher do agendador (os testes fixam os dois).
- Internos novos: ActivityController, ActivitySessionPort, BridgeScheduler (kotlinx-coroutines em commonMain,
  implementation), HealthHistoryMapper, WorkoutPayloadMapper, ActivityEstimates, UserProfileCodec.
- O SavedDataMapper ganha as categorias 1, 2, 3 e 4 (hourKeys, secondKeys).
- O StateMapper emite 3 quando há atividade ativa e o link está fora; o STOPPED com o link fora reemite o estado real.
- O syncDataHistory pede todos os tipos (sem WORKOUTS se há atividade).
- O setUserInfo persiste o perfil.
- O forceStop e o prazo vencido do início põem a chave do início em confirmUploaded(WORKOUTS).
- O listener: onWatchEvent trata ActivityState, ActivityRefused e HeartRateMeasured; onLiveSteps alimenta o delta da
  atividade.

EVENTOS JS (formatos do Core v4.3.57)
- onHistoryHeartRate: {historyheartrate: [{date: 'yyyy-MM-dd', items: {avgValues: [{timestamp:
  'yyyy-MM-ddTHH:00:00-03:00', value, min, max}], otherValues: [{timestamp, value}]}}]}.
- onHistoryStress: {historystress: [{date, items: {avgValues: [{timestamp, value, min, max, stressValues: number[] |
  null}], otherValues: [mesmo formato]}}]}.
- onHistorySpo2: {historyspo2: []}.
- onHistoryActivityV2: {historyactivity: [objeto de atividade]}.
- onActivityStartedV2 (status 2), onActivityStatusV2 (4 ou 3), onActivityUpdateV2 (2 ou 3) e onActivityCompletedV2 (0):
  objeto de atividade.
- onActivityError: {errorCode: -1 | 1 | 2}.
- onActivityRealTimeSpeed: {speedKmH: number}; declarado e nunca emitido.
- Objeto de atividade: type, status, day, month, year, hour, minute, second, watchDistanceInMeters, gpsDistanceInMeters
  (0), steps, cadence, calories, averageBpm, secondsDuration, locationEnabled (false), startDate (ISO com offset),
  accuracy (-1), gpsSpeedKmH (0.0), watchSpeedKmH, minAveragePace, secondsAveragePace, avgFrequency 0, stepSize 0,
  jumpRopeTripped 0, jumpRopeTotalJumps 0, jumpRopeMaxConsecutiveJumps 0, elevationGainInMeters 0.0, activityOrigin
  ('Watch' | 'Phone'), vo2Max, recoveryTimeDate ('' sem estimativa), bpmList e paceByKm ([]).
- Payloads sintéticos dos goldens:
  - Treino do relógio: início 07:30 −03:00, ativo 1750 s, CRP 1, 4000 passos, 3500 m, 250 kcal, FC [90, 100, 110, 0,
    130, 0], sem perfil → type 2, secondsDuration 1750, cadence 137, watchSpeedKmH 7.2, pace 8:20, averageBpm 108,
    bpmList [107], vo2Max 28, recoveryTimeDate '2026-11-02T15:59:10-03:00'.
  - Atividade do app, com o registro do fim a 3 s do início do telefone: perfil masculino nascido em 1990-05-15 →
    startDate '2026-11-02T10:00:00-03:00', secondsDuration 1780, steps 3500, watchDistance 4200, calories 250,
    averageBpm 135, bpmList [135], cadence 117, watchSpeedKmH 8.4943…, pace 7:03 (conferir ActivityHelpers.kt:51-67),
    vo2Max 31, recoveryTimeDate '2026-11-02T16:29:40-03:00', activityOrigin 'Phone'.
  - FC às 18:00: {date: '2026-11-02', items: {avgValues: [{timestamp: '2026-11-02T12:00:00-03:00', value: 97, min: 70,
    max: 150}], otherValues: []}}. Às 12:20, as mesmas amostras saem em otherValues.
  - Estresse: hora 10 = {value 35, min 30, max 40, stressValues [30, 40]}; 11 = 50, [50, 0]; 12 = 20, [20, 0]; 13 = 32,
    [31, 32].

SPEC E WRAPPER JS (Repo 2)
- src/specs/NativeCoreNext.ts (na S0h):
  - getHistoryHeartRate(daysBefore: number): Promise\<void>;
  - getHistoryStress(daysBefore: number): Promise\<void>;
  - getHistorySpO2(daysBefore: number): Promise\<void>;
  - getHistoryActivityV2(): Promise\<void>;
  - startActivityByTypeV2(options: NativeDictionary): Promise\<void>;
  - pauseActivityV2(): Promise\<void>;
  - resumeActivityV2(): Promise\<void>;
  - stopActivityV2(options: NativeDictionary): Promise\<void>;
  - checkIosBackgroundLocationPermission(): Promise\<string>;
  - os 10 EventEmitters.
- src/index.ts:
  - os 9 métodos com observed();
  - stopActivityV2(options?: TechnosActivityByTypeStop), que manda {} quando vem undefined;
  - TechnosCore.activityTypes;
  - VALORES: TechnosActivityV2Status, TechnosActivityOrigin, TechnosActivityErrorCode e PlanType (enums TS com os
    números e textos do Core);
  - os 10 eventos em TechnosEvents;
  - os componentes.
- Tipos em events.ts, compat.ts e activity.ts: TechnosHeartRateHistory/Day/DayItem, TechnosStressHistory/Day,
  TechnosOxygenationHistoryDay, TechnosActivityHistoryV2, TechnosActivityHistoryV2Activity (cópia literal, com todos os
  opcionais), TechnosActivityHistoryV2SportPlan, TechnosActivityByTypeStartV2, TechnosActivityByTypeStop,
  TechnosActivityError, TechnosNativeMapProps e TechnosNativeChronometerProps.
- constants.ts: technosEventNames e errorCodes com LOW_BATTERY.
- Mock oficial, com os valores.
- O caminho profundo react-native-technos-ware-core/src/NativeModules/type/eventData/activity e os outros valores que o
  Condor importa fora da atividade ficam para o adaptador da fase 4 (DP-73).

HOST ANDROID
- FileSampleStore e SampleJsonCodec (measurements e workouts).
- store/PreferencesStore.
- AndroidCoreHost com os 5 métodos novos.
- SyncForegroundService com motivos (ForegroundReasons).
- NativeCoreNextModule com os 9 overrides e os 10 nomes no switch do emit (na S0h).

HOST iOS
- FileSampleStore.swift e SampleJsonCodec.swift.
- PreferencesStore.swift.
- IosCoreHost com os 5 métodos novos.
- RCTNativeCoreNext.mm com os 9 métodos e os 10 eventos (na S0h).
- CoreLocation no podspec.

APP DE EXEMPLO
- Aba Dados com FC, Estresse, SpO2 e Treinos, e a confirmação por categoria.
- Aba nova Atividade.

## Plataformas (Android e iOS)

Sem GPS, mapa nativo, permissão nova nem SQL na fase 3.

ANDROID
- Persistência: o FileSampleStore ganha 3 arquivos JSON, com o mesmo esquema do iOS e escrita atômica (.tmp, fsync e
  rename). Item inválido é pulado com WARN, e o clear apaga os novos.
  - measurements-heart_rate.json e measurements-stress.json, cada um uma lista de {at: epochMs, v: int}.
  - workouts.json, uma lista de {start, end, active, sport, familySport, steps, distance, kcal, hr: [int], hrInterval,
    origin: 'WATCH' | 'PHONE', location: bool, gpsDistance}.
  - Os confirmed-heart_rate/stress/workouts.json já saem de DataKind.entries.
- store/PreferencesStore: SharedPreferences 'corenext.prefs', só strings.
- SyncForegroundService: passa a contar por motivo (SYNC, ACTIVITY), com lógica pura testável (ForegroundReasons). Para
  quando nenhum motivo sobra. Com ACTIVITY, o texto é 'Atividade em andamento'. O tipo continua connectedDevice, então o
  manifest da biblioteca não muda. O start vem depois do perform(StartActivity) bem-sucedido, com o app ainda em
  primeiro plano (cerca de 0,5 s depois do toque na contagem), o que o Android 12+ permite. Sem wakelock: a duração vem
  do relógio de parede, então uma suspensão da CPU só atrasa o tick, sem encurtar a duração.
- AndroidCoreHost.locationAuthorization() devolve null.
- Nada de play-services-location nem ACCESS_BACKGROUND_LOCATION na biblioteca. Mas o Condor precisa, na fase 4, de duas
  linhas no próprio manifest (F3-D34, DP-69): ACCESS_FINE_LOCATION com tools:remove='android:maxSdkVersion' (o FINE com
  maxSdkVersion=30 do Repo 2 é mesclado na declaração dele e tira o FINE no Android 12+) e ACCESS_BACKGROUND_LOCATION (o
  Permission.ts:34-46 exige GRANTED para atividade com mapa).

iOS
- FileSampleStore.swift e SampleJsonCodec.swift com o mesmo JSON, com teste cruzado sobre uma amostra comum versionada
  nos dois repositórios.
- PreferencesStore sobre UserDefaults, na suíte do PairingStore.
- startActivityWork/stopActivityWork só registram INFO. Sem localização em segundo plano, o app depende do modo
  bluetooth-central (as notificações do P85 o acordam), e o cronômetro do CoreBridge recalcula pelo relógio de parede.
- locationAuthorization: CLLocationManager().authorizationStatus (iOS 14+), com CoreLocation no podspec.
- O shim não barra opções nulas, porque o wrapper JS já manda {}.
- Nenhuma string de uso nova no exemplo: ler o status não pede. No exemplo só sai 'denied'; o 'granted' é validado no
  Condor.

COMUM
- O tick de 1 s, o B2 0D de 5 s e o prazo de 10 s rodam no :bridge, com kotlinx-coroutines como implementation do
  commonMain, só interno. O checkObjcHeader continua sem coroutines.
- O sync do P85 fica uns 6 a 8 s mais longo: 8 páginas de FC a cerca de 520 ms, os dois B6 02 e o B2 06 escritos (0,6
  s), 2 de estresse, a lista B2 e uns 0,8 s por treino novo. Fica longe dos 50 s do Condor; no pior caso (2 timeouts de
  B2 02, timeout na 35 00 e no B9 11 03 00), uns 16 s a mais.
- A fatia de GPS, se for aprovada depois, entra por CoreHost.startActivityWork(locationEnabled), por um
  bridge.onLocation(fix) e pela distância no PhoneActivityInfo, sem mudar o resto.

## Desvios de produção (DP)

**1.** DP-102 — FC de ontem em todo sync. Produção: o Android só pede ontem (35 04..07, pelo
queryHistoryTimingHeartRate(YESTERDAY)) se ontem não estiver marcado, e a marca sai na primeira resposta de qualquer
flag de ontem (CRPService.java:200, 212-217, 1279-1281; CRPSyncDataFlags.kt:72-97); o iOS pede em todo sync
(CRPService.m:1272-1284). Core Next: hoje e ontem em todo sync, sem marca. Motivo: a marca do Android perde a FC de
ontem quando um pedido some; custa uns 2 s por sync.

**2.** DP-103 — Sequência da FC: uma página por vez e B6 02 só escrito. Produção/SDK: a SDK escreve B6 02 00 00 antes do
35 00 e B6 02 01 00 depois do 35 04, e encadeia as páginas sozinha ao receber cada uma, com vários pedidos em voo
(sdk:h/a.java:688-706; sdk:j/u.java:314-340; pair-sync@57743..@63957). Core Next: B6 02 dd 00 escrito sem esperar
resposta antes da primeira página de cada dia, e um pedido de página por vez (ADR 25). Motivo: o P85 nunca respondeu ao
B6 02 (pair-sync@57971, @59936); os bytes enviados são os mesmos, só muda a ordem do B6 02 de ontem e a intercalação.

**3.** DP-104 — Página de FC sem resposta. Produção/SDK: o dia só é montado quando chega a página 3 (ou a 7), e uma
página perdida descarta o dia (sdk:j/u.java:37-86). Core Next: cada página é absoluta e é guardada; sem a 35 00, desiste
da FC naquele sync; outra página perdida só falta. Motivo: não perder 18 h de FC por uma página.

**4.** DP-105 — Confirmação do estresse também no Android. Produção: o deletedSavedData(STRESS) do Android não faz nada
(CRPService.java:853-854), então o estresse é reenviado em todo sync e a tabela não é limpa (DataStorage.java:129-138);
o iOS apaga por hora (StressRepository.m:149-163). Core Next: confirma por hora nas duas plataformas. Motivo: bug do
Android.

**5.** DP-106 — Média horária do estresse arredondada nas duas plataformas. Produção: o Android usa roundToInt
(CRPStressMappers.kt:35) e o iOS usa @avg.intValue, que trunca (CRPStressMappers.m:47); o iOS também lê [i+1] sem
conferir o tamanho (:28). Core Next: arredonda, como o Android. Motivo: uma regra só, no :bridge. No iPhone, uma hora
com média x,5 sobe 1 ponto.

**6.** DP-107 — Retenção de 30 dias para FC, estresse e treinos, com poda por tipo. Produção: o Android apaga 7 dias
depois do consumo ou 14 dias depois da data, e o estresse fica fora da limpeza (DataStorage.java:109-145); o iOS lê só o
último mês (HeartrateRepository.m:203-240). Core Next: a retenção do perfil, 30 dias, para amostras, treinos e chaves
confirmadas; a poda compara dia e hora como texto e as chaves de treino como número. Motivo: uma regra só.

**7.** DP-108 — Hora confirmada não volta. Produção: o Android atualiza a linha e mantém deleted = 1
(HeartRateHistoryDAO.java:24-25); o iOS zera o DELETED no update e reenvia (HeartrateRepository.m:96-104). Core Next:
como o Android, uma amostra nova numa hora já confirmada não é reenviada. Motivo: a hora é a chave de confirmação nas
duas plataformas, e o backend já tem a hora.

**8.** DP-109 — Dias e horas em ordem crescente nos eventos de FC, estresse e treinos. Produção: a ordem de um HashMap
ou NSDictionary, indefinida (CRPService.java:422-479; CRPService.m:310-348). Core Next: crescente. Motivo: determinismo
e golden; o Condor não depende da ordem.

**9.** DP-110 — FC, estresse, SpO2 e treinos vazios no fitGPS e no Life Ultra GPS. Produção: o SMA tem FC
(SMAService.java:465-500, 889-955) e treinos (:752-790), mas o estresse e o SpO2 dele nunca emitem (:958-960,
:1396-1398; SMAService.m:285-299), e o app espera 20 s; o iDO tem os quatro pelo WorkManager
(IDOService.java:1478-1525). Core Next: emite a lista vazia na hora; o NOT_SUPPORTED do driver só aparece no log do
sync. Motivo: o Repo 1 não tem esses registros no SMA e no iDO. Afeta só o app Mormaii.

**10.** DP-111 — Atividade iniciada pelo app só no CRP. Produção: o SMA só marca START_REQUESTED e emite onActivitySync
(SMAService.java:1342-1346), e o iDO inicia pelo appExchangeDataStart (IDOActivityManagerV2.kt:55-116). Core Next: SMA e
iDO rejeitam NOT_SUPPORTED e emitem onActivityError -1, sem ligar o serviço em primeiro plano; pause, resume e stop sem
atividade resolvem sem tráfego. Motivo: escopo da PoC. Afeta só o app Mormaii.

**11.** DP-112 — Sem Health Connect e sem HealthKit (se a resposta à pergunta 2 for A). Produção: cada FC gravada vai ao
Health Connect e ao HealthKit (HeartRateHistoryRepository.java:19-26; HeartrateRepository.m:18, 51, 55), e as atividades
vão ao Health Connect (ActivityHistoryRepository.java:35-42). Core Next: nada. Motivo: prazo; exige o fluxo de
permissões que o Condor chama (getHCpermissionsStatus e requestHCpermissions).

**12.** DP-113 — Sync do CRP sem teto e com progresso. Produção: o Android fecha em 20 s e o iOS em 15 s, mesmo sem
todas as respostas (CRPService.java:230-246; CRPService.m:142), e o CRP nunca emite onSyncProgress. Core Next: termina
quando cada tipo termina, com a desistência por tipo e sem teto global, e emite 0/20/40/60/80/100. Motivo: um teto
cortaria a FC que chega depois.

**13.** DP-114 — Coleta de treinos do relógio. Produção: o Android baixa de novo todos os treinos de agora − 7 dias em
todo sync e só deduplica no insert; o iOS usa o início do dia − 7 dias; um B2 02 sem resposta para a cadeia, e o sync só
fecha no teto; só grava o treino quando a FC (B2 05) chega inteira (CRPService.java:1581-1634; CRPService.m:1545-1606;
sdk:j/t0.java:95-132). Core Next: o id é o índice do slot, como a SDK, com uma queda para o 0E só no slot mais novo;
aceita o eco do B2 03 que vier e confere o início contra o slot; pula os treinos conhecidos (±10 s de um início guardado
ou confirmado); janela de agora − 7 dias nas duas plataformas; no máximo 2 timeouts de B2 02 por sync; um timeout no B2
04 grava o treino sem FC e encerra a cadeia B2. Motivo: bugs e custo; a queda para o 0E é hipótese a validar.

**14.** DP-115 — Duração do treino do relógio é o tempo ativo. Produção: secondsDuration = fim − início, com as pausas
(CRPActivityHelper.java:42; CRPActivityHelper.m:26); a atividade do app já usa o validTime
(CRPActivityManagerV2.java:238-280). Core Next: validTime nos dois casos, e cadência, velocidade e pace por ele. Motivo:
consistência; uma pausa não infla o pace.

**15.** DP-116 — Formato do treino igual nas duas plataformas. Produção: o Android manda startDate e recoveryTimeDate
sem offset (DateHelpers.kt:20, 69-74); o iOS manda com offset, accuracy 0, averageBpm null e chaves a mais
(TechnosActivityMappers.m:18-105); os dois mandam as chaves de natação nos tipos de natação, e o exerciseGoal. Core
Next: as chaves do Android, datas ISO com offset, sem natação e sem exerciseGoal. Motivo: um formato só no :bridge; o
moment lê o mesmo instante; o Condor não lê natação (HAS_SWIMMING_ATTRIBUTES_TYPES = []).

**16.** DP-117 — Confirmação de treinos por registro. Produção: corta o registered_at no dia e marca todos os treinos do
dia (ActivityHistoryRepository.java:74-97; ActivityRepository.m:501-545), inclusive um cujo POST falhou. Core Next:
marca o treino cujo início casa com o registered_at (±1 s); sem casamento, WARN e nada é marcado, e o backend responde
409 no reenvio. Motivo: perda silenciosa na produção. Depende de o id do backend vir em UTC com Z (a validar).

**17.** DP-118 — Sem FC válida, a regra do Android nas duas plataformas. Produção: no iOS, calculateAverageBpm divide
por zero e o guarda count < 0 nunca vale (CRPActivityHelper.m:83-108). Core Next: lista vazia não gera estimativa e
deixa averageBpm 0; lista só com zeros dá vo2Max por 220 − idade e recuperação vazia (ActivityHelpers.kt:236-269;
CRPActivityHelper.java:132-145).

**18.** DP-119 — Bateria lida antes do 68. Produção: o Android manda o 68, lê a bateria depois e, abaixo de 11%, manda
68 FF; um timeout da leitura também manda 68 FF, sem evento (CRPActivityManagerV2.java:101-119, 287-297); o iOS lê
antes, sem esperar (CRPActivityManagerV2.m:55-77). Core Next: lê 2A19 antes; abaixo de 11%, recusa com LOW_BATTERY sem
escrever e emite onActivityError 2; uma falha da leitura segue com o início, com WARN.

**19.** DP-120 — Prazo de 10 s para o eco do início, contado do pedido JS. Produção: não há prazo no nativo; o Condor
desiste em 12 s sem parar o Core, e um eco atrasado inicia a atividade sem tela (ActivityCountdown/index.tsx:66-69;
CRPService.java:1696-1701). Core Next: prazo de 10 s a partir do START_REQUESTED; o StartActivity leva notAfter, e a
sessão e o driver não escrevem nada depois dele (CANCELLED); vencido o prazo, onActivityError -1, STOPPED e, se o 68 já
tinha saído, 68 FF interno e a chave do instante nas confirmações de WORKOUTS, para a coleta não trazer um micro-treino;
um eco depois disso só vai ao log.

**20.** DP-121 — Erros da atividade. Produção: o -1 é engolido (CRPActivityManagerV2.java:287-297;
CRPActivityManagerV2.m:150-160); [FF,01] vira bateria baixa em qualquer estado (CRPService.java:1705-1707); no iOS, uma
recusa marca STOPPED com o relógio rodando (CRPService.m:1211-1216). Core Next: -1 é emitido sem conexão, com
NOT_SUPPORTED, com argumento inválido e no prazo vencido; a recusa segue a regra da SDK (tamanho 2 com [1] = 01; FF =
bateria baixa) e só vira 1 ou 2 em START_REQUESTED; recusas de pausa, retomada e fim só vão ao log.

**21.** DP-122 — Pausa e retomada otimistas, com janela de eco. Produção: o estado só muda com o eco 68 FE/FD
(CRPService.java:1661-1671; CRPService.m:1218-1224); com o P85, o 68 FE ficou sem eco (walk@175572), então a produção
provavelmente nunca pausava no app. Core Next: onActivityStatusV2 (4 ou 3) sai depois da escrita; um eco do mesmo byte
em até 10 s, não superado por um 68 mais novo, é idempotente; um eco superado só vai ao log; FE/FD sem escrita
correspondente mudam o estado como ação feita no relógio.

**22.** DP-123 — Fim da atividade. Produção: o Android espera o eco do 68 FF sem prazo e depois o B2 02 0E, com 5 s
(CRPActivityManagerV2.java:349-368, 600-603); o iOS manda 68 FF até três vezes e espera o registro sem prazo
(CRPActivityManagerV2.m:207, 216-270). Core Next: um 68 FF, resposta opcional até 4 s casada só pelo eco de 1 byte, e
fetchLastWorkout com os prazos do driver; queda ou falha fecham com os dados do telefone; uma parada pelo relógio só lê
o registro.

**23.** DP-124 — forceStop. Produção: o Android não manda nada e deixa o relógio rodando
(CRPActivityManagerV2.java:349-357); o iOS manda 68 FF (CRPActivityManagerV2.m:206-214); nenhum dos dois emite evento; a
cópia do relógio entra depois como treino Watch e o backend fica com dois exercícios. Core Next: sem evento nas duas
plataformas; 68 FF só se estiver conectado; nenhum registro é guardado, mas o início do telefone entra nas confirmações
de WORKOUTS, para a coleta pular a cópia do relógio (±10 s); se o envio do próprio Condor falhar, a atividade se perde,
como na produção.

**24.** DP-125 — Dados ao vivo durante a atividade (revê o DP-09). Produção: no Android com o P85, secondsDuration,
passos, kcal, FC, velocidade e pace saem 0, porque o Core nunca pede o 0x57 (CRPActivityManagerV2.java:374-382, 422-449,
543-548), e o intervalo é de 1 a 5 s, pela RAM (ProgressIntervalAdjust.java:33-44). Core Next: tick de 1 s;
secondsDuration pelo relógio de parede do telefone, sem as pausas; passos, kcal e distância pelo delta do FEE1, com a
virada do dia tratada; averageBpm pela média do 2A37, só com 40..200 e com contato.

**25.** DP-126 — B2 0D zerado a cada 5 s. Produção: o Android manda o B2 0D com a distância do GPS (0 sem GPS) a cada
tick, de 1 a 5 s pela RAM, e no fim; o iOS a cada 1 s e no fim (CRPActivityManagerV2.java:397, 439, 492-514;
CRPActivityManagerV2.m:268, 319, 447-452). Core Next: o zerado do início e um zerado a cada 5 s em STARTED/RESUME,
coalescido e só em READY/SYNCING, sem o final. Motivo: sem GPS não há distância; 5 s é o ritmo da produção Android em
aparelhos com menos de 2 GB; cada frame ocupa uns 210 ms da fila.

**26.** DP-127 — Sem GPS, rota e velocidade em tempo real (se a resposta à pergunta 1 for A). Produção: Fused (5 s) no
Android e CLLocationManager (3 m) no iOS a partir do STARTED; rota no banco; gpsDistanceInMeters, gpsSpeedKmH, paceByKm
e locations no fim; onActivityRealTimeSpeed no ciclismo (TechnosLocationManager.java:45-162;
TechnosLocationManager.m:16-89; CRPActivityManagerV2.java:467-571). Core Next: locationEnabled false no payload,
distância do relógio, sem locations, e onActivityRealTimeSpeed nunca sai (o velocímetro do ciclismo fica em 0).

**27.** DP-128 — Mapa e cronômetro em JS. Produção: TechnosNativeMap nativo, com polyline ao vivo, resumo e pinos de
relógio, e TechnosNativeChronometer e TechnosNativeActionTimer nativos (nativeviews/maps/TechnosNativeMapView.kt;
RCTTechnosNativeMapView.mm; nativeviews/chronometer/Chronometer.java:23-39). Core Next: TechnosNativeChronometer em JS,
alimentado pelo onActivityUpdateV2; TechnosNativeMap como View vazia com as mesmas props, o que deixa em branco o mapa
da atividade, o resumo de atividades antigas com rota vinda da API (ActivitySmallMap, MapModal), o cartão de localização
do relógio na Home e a tela de encontrar o relógio (DeviceLocationCard, screensV2/home/DeviceLocation); TechnosMapStyles
com os mesmos nomes; TechnosNativeActionTimer mostra 00:00.

**28.** DP-129 — Trabalho em segundo plano durante a atividade (estende o DP-65). Produção: serviço connectedDevice
persistente no Android (TechnosForegroundService.java:55-76) e nada no iOS. Core Next: o Android liga o serviço com o
motivo atividade só depois das escritas do início e até o fim; o iOS conta só com o modo bluetooth-central.

**29.** DP-130 — Atividade em andamento não sobrevive à morte do processo. Produção: a linha fica no Room em STARTED e
só volta se um sync achar o B2 com o mesmo dateId (CRPService.java:1622-1634). Core Next: a atividade vive em memória no
CoreBridge; o treino continua no relógio e entra no próximo sync como treino do relógio.

**30.** DP-131 — Sync durante a atividade sem o passo de treinos. Produção: o callback do B2 01 retorna sem fechar o
flag, e o sync só termina no teto (CRPService.java:1582-1584; CRPService.m:1546-1547). Core Next: o CoreBridge
sincroniza sem WORKOUTS e o sync fecha normalmente; pausa e fim esperam na fila o sync e o sync de ajustes que o Condor
faz logo depois (runLastSyncStep → syncUserSettings → setUserInfoOnWatch, cerca de 10 s com 20 ajustes), como no DP-05.

**31.** DP-132 — Eventos de atividade sem fila, menos o fim. Produção: o Android guarda todos com emitOrQueue
(EventHandler.kt:516-518); o iOS não guarda nenhum. Core Next: onActivityCompletedV2 e os 4 eventos de histórico vão
para a fila; started, status, update, error e real-time speed não vão.

**32.** DP-133 — O banco do Core antigo não migra na troca da fase 4. Produção: atividades do app e treinos não
confirmados ficam no Room ou no SQLite do Core antigo. Core Next: começa vazio; os treinos do relógio dos últimos 7 dias
voltam pelo B2 e o backend deduplica pelo registered_at exato (exige a decodificação idêntica do início, coberta por
golden); atividades do app não enviadas se perdem.

**33.** DP-134 — Tabela de tipos Technos → CRP única. Produção: no Android, functionalTraining (217), back (318) e
lowerBody (319) caem no FREE_TRAINING 18 (CRPSmart1ActivityMapper.kt:150-282); no iOS vão para CRP 73, 75 e 76
(CRPSmart1TypeMapper.m:392-398). Core Next: a tabela do Android mais as entradas que só o iOS tem, nas duas plataformas;
o script de geração lista cada divergência da v4.3.57 aqui. Motivo: uma tabela só; o Condor oferece os três ao REEBOK
(constants/Exercises/index.ts:1829-1832). No Android, o relógio passa a mostrar o esporte em vez de 'treino livre'.

**34.** Atualizações de entradas existentes: o DP-94 é resolvido (o sync lê FC, estresse e treinos). O DP-72 é
resolvido: o perfil é persistido por CoreHost.savePreference; anotar que no iOS isso é novo, porque a produção iOS não
persistia. O DP-73 ganha os exports novos, inclusive os valores TechnosActivityV2Status, TechnosActivityOrigin,
TechnosActivityErrorCode e PlanType, e mantém pendentes o caminho profundo dos tipos de atividade e os outros valores
que o Condor importa fora da atividade (ActionType, TechnosWatchFaceTransferEventStatus, TechnosFirmwareUpgradeStatus,
TechnosTileType, technosAssets, a conferir no adaptador da fase 4). O DP-69 ganha a armadilha do merge: o FINE com
maxSdkVersion=30 do Repo 2 é mesclado na declaração do Condor, que precisa de tools:remove='android:maxSdkVersion' e do
ACCESS_BACKGROUND_LOCATION. O DP-05 ganha a espera do sync de ajustes. O DP-09 passa a apontar para o DP-125, e o DP-65
para o DP-129. O DP-18 ganha o LOW_BATTERY, o CANCELLED do início vencido e o NOT_SUPPORTED do
checkIosBackgroundLocationPermission no Android (na produção, '-1'). Vão para 'Conferido: não é desvio': o SpO2 vazio no
P85, o stressValues só no CRP, o estado 3 com atividade, o tipo desconhecido virando FREE_TRAINING 18, o estresse acima
de 100 aceito, o B2 06 escrito antes do B2 00 como a SDK e o id do B2 02 igual ao índice do slot.

## Testes

REPO 1, PROTOCOLO (commonTest: JVM, unit Android e simulador iOS; tempo virtual). Durante as fatias, só
:protocol:jvmTest; os 4 targets na publicação intermediária e na S10.

Goldens sintéticos, cada vetor conferido contra a SDK (arquivo:linha) e, quando houver, contra o layout da referência
pelo atMs:
- CrpHealthGoldenTest:
  - TX B6 02 00 00 e 01 00; TX 35 pp com b2 20 e com b2 10;
  - decodificação do RX 35 (vetor das 18:00, faixa 39/201, slots futuros de hoje descartados, página de ontem);
  - TX e RX do B9 11 03 00/01 (vetor das 18:00 e WARN acima de 100).
- CrpWorkoutGoldenTest:
  - B2 06 e B2 00/01 (5 slots, vazio, início ≤ 1);
  - B2 02/03 (registro, eco igual, eco diferente do pedido aceito pelo início, início divergente);
  - B2 04/05 com o id ecoado (uma página FF FF, duas páginas, offset que não avança);
  - codec de hora u32 LE GMT+8 (07:30 −03:00 ↔ 78 CB E7 6A, mais um fuso +09:00 e a volta).
- CrpActivityGoldenTest: B2 0D zerado (b2 20 e 10), 68 01/FE/FD/FF, decodificação do RX 68 pela regra da SDK (tamanho 1,
  tamanho 2 com [1] = 01, FC legada), janela de eco de 10 s e eco superado, 2A37 com u8, u16, sem contato e fora da
  faixa.
- CrpActivityTypesTest: walk, run e bike, free training, a assimetria do SURF, o desconhecido → 18 e as 3 entradas que
  só o iOS tem, conferidos contra as duas tabelas da v4.3.57.
- CrpCommandCatalogTest: os rótulos novos.
- CrpRedactionTest: os RX novos não são redigidos (F3-D27).

Sessão com o CrpWatchSimulator (extensões novas CrpSimulatorHealth, CrpSimulatorWorkouts e CrpSimulatorActivity):
- CrpHealthSessionTest:
  - ordem (B6 02 escrito sem matcher antes da 1ª página de cada dia) e progresso do sync do P85 (0/20/40/60/80/100);
  - ontem lido em todo sync;
  - timeout na 35 00 desiste e o sync termina com sucesso;
  - página do meio perdida guarda as outras;
  - um B9 11 00 FF e um B9 11 01 no meio não casam;
  - DISCONNECTED propaga.
- CrpWorkoutSessionTest:
  - B2 06 escrito sem matcher antes do B2 00;
  - índice que casa (vários treinos novos, slots 2, 3 e 4, todos coletados, do mais novo para o mais antigo);
  - índice com timeout no slot mais novo → queda para o 0E, slots antigos adiados com WARN;
  - índice com timeout num slot antigo → índice desligado, o mais novo tenta o 0E;
  - eco diferente do pedido aceito pelo início, B2 04 com o id ecoado;
  - início divergente pulado;
  - conhecido (±10 s) pulado;
  - 64 páginas aborta e grava sem FC;
  - timeout no B2 04 grava sem FC e encerra a cadeia sem falhar o sync;
  - no máximo 2 timeouts de B2 02 por sync;
  - B2 01 sem pedido ignorado;
  - fetchLastWorkout mescla e PHONE vence WATCH.
- CrpActivitySessionTest:
  - início: READ 2A19, depois B2 0D, depois 68 tt, sem matcher (a fila livre depois de uns 0,45 s);
  - notAfter vencido na fila (atrás de um RefreshSteps): CANCELLED e nenhum TX; vencido depois do 2A19: nenhum B2 0D nem
    68;
  - eco → ActivityState só em READY, com fromWatch certo;
  - recusas pela regra da SDK;
  - bateria baixa sem escrita;
  - PhoneActivityInfo escreve B2 0D zerado e NOT_SUPPORTED no SMA e no iDO;
  - 68 FF com resposta opcional que não casa com [FF, 01];
  - 6D FF sem pedido não casa com nada;
  - NOT_READY antes do READY.
- WatchSessionCommandsTest e IdoSessionTest: SMA e iDO dão NOT_SUPPORTED nas 5 ações e no fetchLastWorkout sem escrever;
  o sync deles continua 0/50/100.
- TerminalCallbackInvariantTest: fetchLastWorkout e as 5 ações.
- HistoryStoreTest: medições (janela, poda, chaves de hora, clear); treinos (mescla, PHONE vence, confirmação ±1 s,
  storeWorkout pela caixa de entrada concorrendo com um mergeWorkouts, poda); confirmar um treino, rodar prune e
  conferir que a chave fica; chave antiga de treino (mais de 30 dias) sai.
- CrpReferenceFixtureTest, testes nomeados só de layout e ordem, sem valores:
  - B6 02 sem resposta seguido do 35 00; RX 35 de 73 bytes e as páginas;
  - RX B9 11 03 de 51 bytes;
  - B2 06 sem resposta seguido do B2 00;
  - fluxo da atividade em walk (B2 0D, 68 00 com eco; 68 FE sem eco; 68 FF, B2 01 sem pedido, eco, B2 02 0E, B2 03 de 31
    bytes com eco 0E, B2 04, B2 05).
- Fixture sintética do Condor regenerada (FIXTURES_REGENERATE) com o tráfego da fase 3. O CrpRealFixturesReplayTest não
  muda (kinds explícitos).

REPO 1, BRIDGE (sobre uma WatchSession de verdade, em tempo virtual, ou sobre uma ActivitySessionPort falsa nos testes
unitários do ActivityController)
- HealthHistoryMapperTest: FC às 18:00 e às 12:20; estresse com os 4 casos de hora; dias em ordem; zona −03:00 e UTC.
- WorkoutPayloadMapperTest: golden dos dois payloads da seção API (treino do relógio e atividade do app); sem FC; FC só
  com zeros; distância 0 (pace 0).
- ActivityEstimatesTest: vo2Max, recuperação e bpmList contra os exemplos.
- SavedDataMapperTest: categorias 1, 2, 3 e 4 com offset, Z e sem offset.
- CoreBridgeHistoryTest: os 4 getHistory* emitem antes do resolve, lista vazia, SMA e iDO vazios, IO_ERROR,
  deletedSavedData por categoria esconde as horas e o treino, e o treino continua escondido depois de um sync.
- ActivityControllerTest (porta falsa, tempo e relógio virtuais):
  - caminho feliz com eco atrasado de 4 s;
  - sem eco por 10 s contados do pedido → onActivityError -1, StopActivity e chave do prazo confirmada; pedido ainda na
    fila no prazo → nenhum StopActivity, reject CANCELLED;
  - recusas 1 e 2 em START_REQUESTED; recusa fora dele só no log;
  - LOW_BATTERY → 2 sem 68;
  - startActivityWork só depois do perform bem-sucedido; NOT_READY e NOT_SUPPORTED não ligam nem desligam o serviço;
  - pausa e retomada otimistas, eco idempotente, eco superado ignorado, pausa pelo relógio;
  - fim com registro que casa, que não casa (mais de 10 s), com timeout e com queda;
  - fim pelo relógio;
  - forceStop conectado e desconectado, com a chave do início confirmada;
  - estado 3 durante a queda, 2 na volta e o estado real (0 ou 1) depois de um forceStop desconectado;
  - updates de 1 s com os deltas do onLiveSteps (inclusive a virada do dia) e do 2A37, nenhum depois do pedido de fim;
  - duração pelo relógio de parede: com o relógio virtual saltando 120 s sem ticks (CPU suspensa), o próximo update
    mostra a duração certa;
  - PhoneActivityInfo a cada 5 s só em STARTED/RESUME, coalescido, parado em PAUSED;
  - completed na fila com o JS desligado;
  - start duplicado → 1;
  - INVALID_ARGUMENT.
- CoreBridgeActivityTest (simulador, na integração): caminho feliz, fim com registro, sync durante a atividade sem B2
  00, forceStop seguido de sync que não coleta a cópia do relógio, SMA e iDO → onActivityError -1.
- CoreBridgeGoldenTest regenerado e revisado.
- checkSwiftInterop e checkObjcInterop com os métodos novos (S0 e S10).

REPO 2
- Android (testDebugUnitTest):
  - SampleJsonCodecTest: ida e volta das medições e dos treinos, itens inválidos pulados, amostra JSON comum igual à do
    iOS;
  - FileSampleStoreTest: o clear apaga os arquivos novos;
  - PreferencesStoreTest;
  - ForegroundReasonsTest: contagem por motivo e parada só sem motivo;
  - AndroidCoreHostTest;
  - teste do switch do emit com os 10 nomes novos (S0h).
- iOS (xcodebuild test):
  - StoreAndLogTests com a mesma amostra JSON;
  - Phase3HostTests: lista de métodos do TurboModule; FoundationConverter com listas aninhadas e stressValues null, que
    vira NSNull;
  - CoreBridgeReplayTests: a sintética regenerada passa pelo host iOS inteiro e confere onHistoryHeartRate,
    onHistoryStress e onHistoryActivityV2; as reais usam a lista de TX tolerados;
  - TurboModuleSourceTests.
- JS (Jest):
  - wrapper: observed e stopActivityV2 que manda {};
  - activityTypes: snapshot contra a v4.3.57;
  - valores: TechnosActivityV2Status.STOPPED === 0, TechnosActivityOrigin.PHONE === 'Phone',
    TechnosActivityErrorCode.DEVICE_WITH_LOW_BATTERY === 2, PlanType.Run3Km === 1, importados da raiz e do mock;
  - activityClock e TechnosNativeChronometer: formata e atualiza pelos eventos; zera no completed;
  - TechnosNativeMap renderiza;
  - o mock cobre technosEventNames;
  - os dois typechecks e o ESLint.

## Documentação

REPO 1
- CLAUDE.md e README: a fase 3 sai de "fora do escopo"; o que ficou fora (GPS, Health Connect/HealthKit, redação de RX).
- docs/arquitetura.md:
  - §6: o FetchLastWorkout na fila, o notAfter do StartActivity e o storeWorkout pela caixa de entrada;
  - §7: medições, treinos, confirmação por tipo, poda por tipo, sync pelo perfil;
  - §12: payloads novos;
  - §13: inventário do CoreBridge com o ActivityController e a ActivitySessionPort, a tabela do CoreHost com os 5
    métodos e as linhas novas das regras.
- docs/protocolo-crp.md:
  - §6.4 (FC/estresse, com o B6 02 escrito), §6.5 (treinos, com o B2 06 escrito, o índice e a queda para o 0E) e §6.6
    (atividade, com o B2 0D de 5 s e a janela de eco) no catálogo;
  - §7.4 a §7.6 nos payloads, com o codec de hora LE GMT+8 e a regra de decodificação do RX 68;
  - §11.4 nas diferenças entre plataformas (as linhas dos DP-102 a DP-126 e DP-134);
  - §12.4 a §12.6 com os vetores sintéticos;
  - §13 reescrita: o que ficou sabido e o que falta validar (o índice no B2 02 e se o 0E é o último treino, eco do
    FE/FD, byte [12] e [24..25] do B2 03, paginação do B2 05, B2 01 no fim de treino do relógio, escala do estresse,
    efeito do B2 0D de 5 s).
- docs/decisoes.md: ADR 40 (API genérica de medições, treinos e atividade); ADR 41 (regras JS da fase 3 no CoreBridge:
  estados, prazos contados do pedido, janela de eco, payloads, confirmação, chaves do abortar, fila de eventos, serviço
  só depois das escritas); ADR 42 (respostas do usuário às 3 perguntas).
- docs/pendencias.md: validação da fase 3 por símbolo (Android e iPhone), redação de RX de saúde e fatia de GPS.
- docs/glossario.md: medição, treino, registro, slot, validTime, origem, eco.
- READMEs dos pacotes crp/ e bridge/, protocol/src/testKit/README.md (extensões do simulador),
  bridge/swift-interop/README.md; scripts/README (gerador da tabela de tipos).

REPO 2
- CLAUDE.md: escopo da fase 3.
- docs/api-js.md:
  - os 9 métodos e os 10 eventos, com payloads de exemplo sintéticos;
  - TechnosCore.activityTypes, os valores exportados (TechnosActivityV2Status, TechnosActivityOrigin,
    TechnosActivityErrorCode, PlanType), os componentes e o LOW_BATTERY na tabela de errorCodes;
  - o deletedCategory com efeito em 1, 2 e 4;
  - na seção de migração do Condor: o que muda, as duas linhas do manifest (ACCESS_FINE_LOCATION com
    tools:remove='android:maxSdkVersion' e ACCESS_BACKGROUND_LOCATION) e a conferência do manifest mesclado.
- docs/desvios-de-producao.md: seções novas "10. Frequência cardíaca, estresse e SpO2 (fase 3)" e "11. Treinos e
  atividades (fase 3)", com os DP-102 a DP-134 no índice; DP-94 e DP-72 resolvidos; DP-73, DP-69, DP-05, DP-09, DP-65 e
  DP-18 atualizados; os itens de "Conferido".
- docs/pendencias.md: GPS, Health Connect/HealthKit, retomada da atividade, mapa (inclusive resumo e localização do
  relógio) e ActionTimer reais, redação de RX nos exports, valores restantes do DP-73.
- docs/arquitetura.md: trabalho de atividade, preferências, ActivityController.
- docs/transporte-android.md: motivos do serviço em primeiro plano e quando o motivo atividade liga.
- docs/ios-pendente.md: a fase 2 e a fase 3 no iPhone ainda não validadas; atividade em segundo plano sem localização; o
  'granted' só no Condor.
- src/README.md (componentes, activityTypes e valores), android/.../store/README.md, ios/CoreNext/store/README.md,
  ios/Tests/README.md (TX tolerados).
- example/README.md: abas Dados e Atividade e o checklist da fase 3 no Android e no iPhone, com a regra de que os
  exports fase3-* não entram em repositório.

## Fatias de trabalho

### S0 — Repo 1 (publica para o Repo 2)

- **Estimativa:** 2,5 h
- **Depende de:** —
- **Arquivos:** protocol/.../domain/{Models,WatchActions,WatchEvents,WatchErrorCodes}.kt;
  profile/{DeviceProfile,Profiles}.kt; driver/DeviceDriver.kt;
  session/{SampleStore,WatchSession,SessionCommand,SessionEngine}.kt; crp/{CrpCommand,CrpDriver}.kt;
  crp/{CrpHealthReader,CrpWorkoutReader,CrpActivityControl}.kt (novos, vazios);
  testKit/{CrpWatchSimulator,CrpSimulatorHealth,CrpSimulatorWorkouts,CrpSimulatorActivity}.kt;
  bridge/{CoreHost,CoreBridge,ActivitySessionPort}.kt; bridge commonTest/CoreBridgeTestKit.kt;
  bridge/swift-interop/MinimalHost.swift; bridge/objc-interop/MinimalTurboModule.mm

Contrato da fase 3 e stubs de fallback:
- domínio (com StartActivity.notAfter, PhoneActivityInfo, ActivityState.fromWatch), DeviceProfile.dataKinds,
  LOW_BATTERY, SampleStore e InMemory;
- assinaturas da WatchSession e da SessionEngine (getMeasurements e getWorkouts vazios; fetchLastWorkout pelo driver;
  storeWorkout pela caixa de entrada), padrões do DeviceDriver;
- catálogo do CrpCommand; CrpDriver delegando para três grupos novos, vazios, que recusam; extensões vazias do
  simulador;
- CoreHost com 5 métodos e o FakeCoreHost;
- CoreBridge com os 9 métodos em stub (históricos emitem lista vazia; o start emite onActivityError -1; pause, resume e
  stop resolvem; checkIos... pelo host), o construtor interno com nowMillis e dispatcher, e a interface
  ActivitySessionPort;
- MinimalHost.swift e MinimalTurboModule.mm;
- ./gradlew check, publishToMavenLocal e assembleTechnosWatchProtocolXCFramework (publicador único).

### S0h — Repo 2 (Android, iOS e spec)

- **Estimativa:** 1 h
- **Depende de:** S0 publicada
- **Arquivos:** src/specs/NativeCoreNext.ts;
  android/src/main/java/br/com/grupotechnos/corenext/{NativeCoreNextModule,AndroidCoreHost}.kt,
  store/FileSampleStore.kt; ios/CoreNext/{IosCoreHost}.swift, store/FileSampleStore.swift,
  turbomodule/RCTNativeCoreNext.mm; teste do emit no Android

Fallback do Repo 2 sobre a S0 publicada:
- spec codegen com os 9 métodos e os 10 eventos;
- métodos novos do SampleStore em stub nos dois FileSampleStore (carregam vazio, gravam nada, DEBUG) e do CoreHost em
  stub (atividade só log, preferências em memória, locationAuthorization null no Android e 'denied' no iOS);
- 9 overrides no NativeCoreNextModule e 9 métodos no RCTNativeCoreNext.mm, chamando o CoreBridge;
- os 10 nomes no switch do emit dos dois hosts;
- refresh-dependencies, assembleDebug, build iOS do exemplo no simulador.

### S1 — Repo 1 :protocol

- **Estimativa:** 3 h
- **Depende de:** S0
- **Arquivos:** crp/CrpHealthReader.kt, crp/CrpHealthPayloads.kt; testKit/CrpSimulatorHealth.kt;
  commonTest/{CrpHealthGoldenTest,CrpHealthSessionTest,CrpReferenceFixtureTest}.kt; docs/protocolo-crp.md
  §6.4/7.4/12.4/13; crp/README.md

FC (B6 02 escrito, 35) e estresse (B9 11 03) no CRP: decodificadores, CrpHealthReader com as regras de desistência,
extensão do simulador, goldens, sessão, testes de layout da referência e documentação do protocolo.

### S2a — Repo 1 :protocol

- **Estimativa:** 3,5 h
- **Depende de:** S0; usa CrpActivityTypes.toTechnos da S2b (entregue na 1ª hora dela)
- **Arquivos:** crp/CrpWorkoutReader.kt, crp/CrpWorkoutPayloads.kt; testKit/CrpSimulatorWorkouts.kt;
  commonTest/{CrpWorkoutGoldenTest,CrpWorkoutSessionTest}.kt, CrpReferenceFixtureTest (1 teste); docs/protocolo-crp.md
  §6.5/7.5/12.5

Treinos do relógio:
- codec B2 01/03/05 e codec de hora u32 LE GMT+8;
- CrpWorkoutReader (B2 06 escrito; readWorkouts com índice, queda 0E só no slot mais novo, eco aceito, id ecoado no B2
  04, conhecidos ±10 s, guarda de páginas, registro sem FC no timeout do B2 04, no máximo 2 timeouts; readLastWorkout
  com id 0E);
- simulador (incluindo um modo que responde só ao 0E e um que ecoa outro id), goldens, sessão, layout da walk e
  documentação.

### S2b — Repo 1 :protocol

- **Estimativa:** 3,5 h
- **Depende de:** S0
- **Arquivos:** crp/CrpActivityTypes.kt, crp/CrpActivityControl.kt, crp/CrpActivityPayloads.kt, crp/CrpDriver.kt
  (handleSide e gancho); scripts/gen-crp-activity-types.py; testKit/CrpSimulatorActivity.kt;
  commonTest/{CrpActivityGoldenTest,CrpActivityTypesTest,CrpActivitySessionTest}.kt, CrpReferenceFixtureTest (1 teste);
  docs/protocolo-crp.md §6.6/7.6/12.6

Controle da atividade e tabela de tipos:
- CrpActivityTypes, gerado uma vez por script a partir das duas tabelas da v4.3.57 (Android + entradas só do iOS) e
  versionado como dado;
- CrpActivityControl: perform das 5 ações, bateria antes do start, conferência do notAfter depois do 2A19, B2 0D zerado,
  68 sem matcher, resposta opcional do FF casada só pelo eco de 1 byte, PhoneActivityInfo;
- memória dos 68 escritos com instante; gancho do RX 68 (regra da SDK, janela de 10 s, eco superado) e do B2 01 sem
  pedido; 2A37 filtrado → HeartRateMeasured no CrpDriver.handleSide;
- simulador (eco atrasado, sem eco, recusa, eco superado, B2 01 no fim, 2A37), goldens, sessão, layout da walk e
  documentação.

### S3 — Repo 1 :protocol (sessão)

- **Estimativa:** 3,5 h
- **Depende de:** S0 (integração com S1 e S2a no fim)
- **Arquivos:** session/{HistoryStore,SyncEngine,SessionEngine,WatchSession,SessionCommand}.kt;
  commonTest/{HistoryStoreTest,WatchSessionCommandsTest,IdoSessionTest,TerminalCallbackInvariantTest,CrpSessionTest,CrpSyntheticReplayTest}.kt;
  testKit/SyntheticCondorReebokFixture.kt e fixture sintética; docs/arquitetura.md §6-§7

HistoryStore (medições, treinos, confirmação por tipo, poda por tipo com WORKOUTS numérico, clear, storeWorkout pela
caixa de entrada), SyncEngine pelo perfil com tipos não fatais, comando FetchLastWorkout, notAfter do StartActivity
conferido na vez do comando e os corpos da WatchSession. Testes de sessão de SMA, iDO e CRP; regenera a fixture
sintética do Condor depois da S1 e da S2a.

### S4 — Repo 1 :bridge

- **Estimativa:** 3,5 h
- **Depende de:** S0 (fim a fim com S3)
- **Arquivos:**
  bridge/{CoreBridge,HealthHistoryMapper,WorkoutPayloadMapper,ActivityEstimates,UserProfileCodec,SavedDataMapper,IsoDates}.kt;
  bridge
  commonTest/{HealthHistoryMapperTest,WorkoutPayloadMapperTest,ActivityEstimatesTest,SavedDataMapperTest,CoreBridgeHistoryTest,CoreBridgeIdoTest,CoreBridgeGoldenTest}.kt;
  bridge/golden; docs/decisoes.md ADR 40

Históricos, treinos e confirmação no CoreBridge:
- WorkoutPayloadMapper e ActivityEstimates primeiro (entregues na 1ª hora e meia, para a S5);
- getHistoryHeartRate/Stress/SpO2/ActivityV2 reais; HealthHistoryMapper;
- UserProfileCodec e persistência no setUserInfo;
- SavedDataMapper com categorias 1/2/3/4 e IsoDates (chave de hora e instante);
- syncDataHistory com todos os tipos e parâmetro interno de kinds para os testes de gravação real;
- golden regenerado, README do bridge, arquitetura §12/13, ADR 40.

### S5 — Repo 1 :bridge

- **Estimativa:** 4,5 h
- **Depende de:** S0 para a parte unitária (3,5 h); S2b e S3 para o teste no simulador (1 h no fim); o
  WorkoutPayloadMapper da S4
- **Arquivos:** bridge/{ActivityController,ActivitySessionPort,BridgeScheduler,StateMapper,CoreBridge}.kt;
  bridge/build.gradle.kts (kotlinx-coroutines em commonMain, implementation); bridge
  commonTest/{ActivityControllerTest,CoreBridgeActivityTest}.kt; docs/decisoes.md ADR 41

Atividade no CoreBridge:
- ActivityController sobre a ActivitySessionPort: estados; agendador de coroutines com dispatcher e relógio injetáveis;
  start com prazo contado do pedido e notAfter; pause/resume otimistas com fromWatch; stop/forceStop (chave do início
  confirmada); recusas pela regra da SDK; deltas do onLiveSteps (virada do dia) e do 2A37; duração pelo relógio de
  parede; PhoneActivityInfo a cada 5 s coalescido; fechamento com fetchLastWorkout, casamento ±10 s e storeWorkout;
  trabalho de atividade no host só depois do perform; fila só no completed;
- StateMapper com o 3 e a reemissão no STOPPED;
- sync sem WORKOUTS durante a atividade;
- ActivityControllerTest com a porta falsa desde o início; CoreBridgeActivityTest com o simulador na integração; ADR 41;
  arquitetura §13.

### S6a — Repo 2 JS

- **Estimativa:** 1,5 h
- **Depende de:** — (o contrato está nesta especificação); fecha depois da S0h
- **Arquivos:** src/index.ts; src/activityTypes.ts e src/activityEnums.ts (novos);
  src/types/{events,compat,emitter,activity}.ts; src/constants.ts; src/__mocks__/react-native-technos-core-next.ts;
  testes Jest do example

Contrato JS (o spec já veio na S0h):
- wrapper com observed();
- TechnosCore.activityTypes (cópia literal da v4.3.57);
- valores TechnosActivityV2Status, TechnosActivityOrigin, TechnosActivityErrorCode e PlanType;
- tipos e apelidos do Core (TechnosActivityHistoryV2Activity literal), technosEventNames, errorCodes com LOW_BATTERY,
  comentário do deletedCategory;
- mock; Jest.

### S6b — Repo 2 JS e docs

- **Estimativa:** 3 h
- **Depende de:** S6a; texto final dos docs depois de S4 e S5
- **Arquivos:**
  src/components/{activityClock.ts,TechnosNativeChronometer.tsx,TechnosNativeMap.tsx,mapStyles.ts,TechnosNativeActionTimer.tsx};
  src/index.ts; docs/{api-js,desvios-de-producao,pendencias,arquitetura}.md; src/README.md; CLAUDE.md

Componentes: TechnosNativeChronometer funcional sobre o activityClock; TechnosNativeMap como stub com as props do Core;
TechnosMapStyles; TechnosNativeActionTimer como stub. Exports, Jest e a documentação inteira do Repo 2 (api-js com a
migração do manifest, desvios DP-102 a DP-134 e as atualizações, pendências, src/README, CLAUDE.md).

### S7 — Repo 2 Android

- **Estimativa:** 3 h
- **Depende de:** S0h
- **Arquivos:** android/src/main/java/br/com/grupotechnos/corenext/{AndroidCoreHost,CoreGraph}.kt;
  store/{FileSampleStore,SampleJsonCodec,PreferencesStore}.kt e README;
  ble/{SyncForegroundService,ForegroundReasons}.kt;
  android/src/test/.../{store/SampleJsonCodecTest,store/FileSampleStoreTest,store/PreferencesStoreTest,ble/ForegroundReasonsTest,AndroidCoreHostTest}.kt;
  docs/transporte-android.md

FileSampleStore e SampleJsonCodec com medições e treinos reais; PreferencesStore; AndroidCoreHost com os 5 métodos
reais; SyncForegroundService com motivos (ForegroundReasons puro). Testes unitários; assembleDebug contra a S0
publicada; docs de transporte e arquitetura.

### S8 — Repo 2 iOS

- **Estimativa:** 3 h
- **Depende de:** S0h; publicação intermediária (S3 e S4) para o replay sintético
- **Arquivos:** ios/CoreNext/store/{FileSampleStore,SampleJsonCodec,PreferencesStore}.swift;
  ios/CoreNext/{IosCoreHost,CoreGraph}.swift; react-native-technos-core-next.podspec;
  ios/Tests/TechnosCoreNextTests/{StoreAndLogTests,Phase3HostTests,CoreBridgeReplayTests,ReplayTransport,TurboModuleSourceTests}.swift;
  ios/Tests/README.md; docs/ios-pendente.md

FileSampleStore.swift e SampleJsonCodec.swift reais; PreferencesStore.swift; IosCoreHost (atividade só no log,
locationAuthorization real); CoreLocation no podspec. Testes: StoreAndLog, Phase3Host, TX tolerados nos replays reais,
TurboModuleSource; o replay sintético regenerado depois da publicação intermediária. Builds do exemplo no simulador
(Debug) e no iPhone (Release, sem assinar); ios-pendente.

### S9 — Repo 2 exemplo

- **Estimativa:** 2 h
- **Depende de:** S6a (S6b para o cronômetro)
- **Arquivos:** example/src/screens/{DataScreen,ActivityScreen}.tsx; example/src/components/TabBar.tsx; example/App.tsx;
  example/README.md

Aba Dados ganha FC, Estresse, SpO2 e Treinos: espera de 20 s, JSON cru, e confirmação por categoria (horas antes da
corrente; treinos listados). Aba nova Atividade: tipo (caminhada, corrida, ciclismo, treino livre, treino funcional),
Iniciar, Pausar, Retomar, Parar, Abortar (forceStop), lista dos eventos com horário, TechnosNativeChronometer e o botão
da permissão de localização (iOS). example/README com as abas e o checklist da fase 3 no Android e no iPhone.

### S10 — Repo 1 e Repo 2

- **Estimativa:** 2 h
- **Depende de:** S1 a S9
- **Arquivos:** —

Integração e portões (o integrador é o único publicador depois da S0):
- publicação intermediária quando S3 e S4 fecham (./gradlew check, publishToMavenLocal, XCFramework) para a S8;
- Repo 1 final: ./gradlew check dokkaHtml publishToMavenLocal assembleTechnosWatchProtocolXCFramework;
- Repo 2: sync-xcframework.sh, pod install, testes nativos Android, assembleDebug, Jest, os dois typechecks, ESLint,
  testes iOS no simulador e os dois builds do exemplo;
- revisão cruzada dos DP com as ADRs; APK para a validação no Android.

## Checklist de validação

**1.** Portão Repo 1: ./gradlew check dokkaHtml verde, com checkObjcHeader, checkSwiftInterop e checkObjcInterop, e as
linhas GOLDEN e REPLAY nos 4 targets; publishToMavenLocal e o XCFramework gerados.

**2.** Portão Repo 2: testes nativos, :app:assembleDebug, npm test, os dois typechecks e ESLint; no iOS, xcodebuild test
e os builds Debug (simulador) e Release (iPhone, sem assinar).

**3.** Preparação (Android): app de exemplo novo. No P85, fazer Forget e parear de novo, porque o vínculo clássico ficou
faltando na validação da fase 2. Na aba Ajustes, ligar a FC automática (5 min) e o estresse automático e usar o relógio
no pulso pelo menos 1 h antes. Na aba Log, DEBUG e Hex ligados. Um export por cenário (fase3-historicos,
fase3-treino-relogio, fase3-atividade-app), sempre Export antes de Clear. Os exports ficam fora dos repositórios: têm FC
e estresse reais.

**4.** H1 (Android, fase3-historicos). Aba Dados, Sync. Esperado: barra 0, 20, 40, 60, 80, 100; no log, TX B6 02 00 00
antes do 35 00 e B6 02 01 00 antes do 35 04 (sem resposta), 35 00 a 35 07, B9 11 03 00 e 01, B2 06 seguido do B2 00;
sync em menos de 20 s. Anotar a duração e se algum RX B6 02 ou B2 06 apareceu.

**5.** H2. Botão FC. Esperado: onHistoryHeartRate em menos de 20 s, com hoje e ontem; a hora corrente em otherValues.
Comparar uma hora com a tela de FC do relógio e anotar se bate.

**6.** H3. Botão Estresse. Esperado: onHistoryStress, com stressValues em pares. Comparar com a tela de estresse do
relógio e anotar o maior valor visto (a escala é desconhecida).

**7.** H4. Botão SpO2. Esperado: {historyspo2: []} na hora.

**8.** H5. Confirmar FC e estresse, depois FC e Estresse de novo. Esperado: as horas confirmadas somem; a corrente
continua.

**9.** H6. Sync de novo. Esperado: as páginas 35 de ontem saem de novo, e as horas confirmadas não voltam.

**10.** H7. Force stop e reabrir o app (persistência). Esperado: FC e estresse continuam, e o que foi confirmado
continua escondido.

**11.** T1 (Android, fase3-treino-relogio). No próprio relógio, iniciar uma caminhada de uns 3 min e parar no relógio,
com o app aberto e conectado. Anotar se chega algum RX 68 ou B2 01 sem pedido no fim.

**12.** T2. Sync, depois Treinos. Esperado: no log, B2 06, B2 00 → B2 01; B2 02 04 (índice do slot 4); B2 03 com o mesmo
início do slot; B2 04 com o id ecoado → B2 05. Um treino com tipo caminhada, início igual ao do relógio, duração ativa,
passos, kcal e distância, e bpmList. Anotar o id ecoado e se foi preciso cair para o 0E.

**13.** T2b. Antes de qualquer sync, fazer DOIS treinos curtos no relógio (ocupam os slots 3 e 4). Sync, depois Treinos.
Esperado: os dois aparecem; no log, B2 02 04 e B2 02 03, cada um com o início do seu slot. Anotar qual id respondeu para
o slot 3 e se houve queda para o 0E.

**14.** T3. Fazer mais um treino no relógio, depois Sync e Treinos. Esperado: o novo aparece, e os anteriores não são
baixados de novo (log 'known'). Anotar se os slots deslizaram para a esquerda.

**15.** T4. Confirmar treinos, fazer Sync e Sync de novo. Esperado: a lista fica vazia nos dois syncs (a poda não apaga
as chaves), e nenhum B2 02 sai para eles.

**16.** A1 (Android, fase3-atividade-app). Aba Atividade, Caminhada, Iniciar. Esperado: o relógio entra na caminhada
(anotar se mostra contagem e quanto demora); onActivityStartedV2 em uns 4 s; o cronômetro anda; updates a cada 1 s com
secondsDuration; no log, um B2 0D zerado a cada 5 s. Andar pelo menos 3 min e conferir passos, kcal e FC média subindo,
a tela do relógio e que não chega 68 FF nem B2 01 espontâneo nem a atividade termina sozinha.

**17.** A2. Pausar. Esperado: status 4 na hora; o B2 0D para. Anotar se o relógio pausa e se aparece eco 68 FE no log.
Esperar 10 s: o cronômetro parado.

**18.** A3. Retomar. Esperado: status 3; o B2 0D volta. Anotar se o relógio retoma e se aparece eco 68 FD.

**19.** A4. Parar. Esperado: no log, 68 FF, eco, B2 01 sem pedido, B2 02 0E → B2 03 → B2 04 → B2 05.
onActivityCompletedV2 com o início do relógio (poucos segundos antes do início no app), a duração ativa, passos, kcal,
distância e bpmList. Depois, Treinos mostra a atividade uma vez só, com origem Phone, e um Sync não a duplica como
Watch.

**20.** A5. Iniciar pelo app e parar pelo relógio. Esperado: onActivityCompletedV2 chega sem tocar no app. Se nada
chegar, anotar o que o log mostrou.

**21.** A6. Atividade de menos de 1 min, iniciada e parada pelo app. Esperado: completed com os dados do relógio, ou com
os do telefone se o relógio não guardou o treino (log de registro que não casa).

**22.** A7. Iniciar um treino no relógio e, com ele rodando, Iniciar pelo app. Esperado: onActivityError 1. Senão,
anotar a resposta do 68 no log.

**23.** A8 (opcional, com o relógio abaixo de 11%). Iniciar. Esperado: onActivityError 2 e nenhum TX 68.

**24.** A9. Desligar o Bluetooth do telefone por 30 s durante uma atividade e religar. Esperado: state 3 durante a queda
e 2 na volta; a atividade continua e o Parar funciona.

**25.** A10. Desligar o Bluetooth durante uma atividade e tocar Abortar. Esperado: nenhum evento e nenhum TX; o
onConnectStateChanged reemite o estado real (0 ou 1). Ao religar, o relógio ainda está no treino; parar no relógio,
fazer Sync e conferir que a cópia do relógio não aparece em Treinos (log 'known').

**26.** A11 (só Android). Iniciar, bloquear a tela e caminhar 3 min. Esperado: notificação 'Atividade em andamento'; ao
desbloquear, o cronômetro igual ao tempo de parede desde o início (comparar com um relógio) e os updates seguindo.

**27.** A12. Ciclismo, iniciar e parar. Esperado: o relógio mostra bicicleta, e o type no completed é 3. Treino
funcional: o relógio mostra o esporte (não 'treino livre').

**28.** A13. Pausar e retomar em menos de 2 s (dois toques rápidos). Esperado: o estado final é RESUME e nenhum status 4
falso aparece depois; anotar os ecos no log.

**29.** A14 (opcional). Com uma atividade rodando e a tela bloqueada, desbloquear depois de 30 min e Parar logo. Anotar
quanto o fim demorou (sync automático e ajustes na frente).

**30.** iPhone (depois): repetir a validação da fase 2 e H1 a H7, T1 a T4 e A1 a A10, A12 e A13 com os mesmos exports.
A11 não se aplica: sem serviço em primeiro plano, anotar o que acontece com a tela bloqueada. Tocar o botão de permissão
de localização: 'denied' no exemplo; o 'granted' com 'Sempre' é conferido no Condor na fase 4.

**31.** Conferência de privacidade de cada export: nenhum MAC (grep -Eic '([0-9a-f]{2}:){5}[0-9a-f]{2}' dá 0). Os
exports da fase 3 não entram em fixtures/real.

**32.** Lembrete para a fase 4: rodar processDebugManifest no Condor e conferir que o ACCESS_FINE_LOCATION mesclado não
tem maxSdkVersion e que o ACCESS_BACKGROUND_LOCATION está lá.

## Riscos

**1.** Id do B2 02 para treinos do relógio: a regra nova é o índice (SDK, exemplo do fornecedor e as duas produções),
mas nenhum B2 02 com índice foi visto no ar com o P85; só o 0E. Se o P85 não aceitar o índice, só o treino mais novo de
cada sync entra (pela queda para o 0E) e os outros nunca chegam; nada é gravado errado, porque o início é conferido. A
validação T2/T2b decide.

**2.** Eco do 68: o início levou uns 4 s e às vezes não veio; FE e FD nunca foram vistos. A pausa otimista pode divergir
do relógio se ele recusar sem avisar. Os 10 s contados do pedido podem cortar um eco lento, e aí o 68 FF interno para o
treino no relógio.

**3.** B2 0D a cada 5 s: é o ritmo da produção Android em aparelhos com pouca RAM, mas com o P85 só se viu 1 Hz. Se o
relógio encerrar o modo ligado ao telefone ou mostrar algo estranho, o A1/A11 mostra, e o ritmo passa a 1 s (uma
constante).

**4.** Confirmação de treinos depende de o id do 409 vir em UTC com Z. Se o backend devolver sem offset, o moment do
Condor lê como hora local e nada casa: o treino é reenviado até a poda, sem duplicar no backend, porque ele deduplica
pelo registered_at.

**5.** Sem GPS (pergunta 1, opção A), o gate do Condor continua exigindo ACCESS_BACKGROUND_LOCATION GRANTED no Android e
'Sempre' no iOS para caminhada, corrida e ciclismo. Na fase 4, o Condor precisa das duas linhas no manifest (F3-D34):
sem o tools:remove, o FINE com maxSdkVersion=30 do Repo 2 é mesclado e o Condor perde a localização precisa no Android
12+, o que trava o pareamento e as atividades com mapa.

**6.** Contrato com o Swift: SampleStore, CoreHost e o listener mudam numa vez só. O usuário só testa o iOS depois; até
lá, o iOS é coberto pelos testes do host no simulador (replay sintético regenerado) e pelos portões de interop. Um erro
de JSON entre as plataformas é pego só pela amostra JSON comum.

**7.** Duração total do sync do P85 com a fase 3: no caso normal uns 7 s a mais. No pior caso (2 timeouts de B2 02,
timeout na 35 00, no B9 11 03 00 e no B2 04), uns 20 s a mais, longe dos 50 s do Condor.

**8.** Prazo: 14 fatias, cerca de 40 h de agente, 10,5 h de relógio com 5 agentes só sem retrabalho. Por isso a pergunta
3 precisa de resposta antes de começar, e a S5 é a primeira a cair. O fallback da S0 e da S0h fica pronto em cerca de
3,5 h.

**9.** Conflitos de merge: as fatias paralelas tocam o CrpDriver, o CrpCommand e o CoreBridge. A S0 cria os arquivos de
grupo e as regiões, e cada fatia mexe só nos próprios arquivos novos e na sua região. A S2b é a única que toca o
CrpDriver.handleSide. Só a S0 e o integrador publicam no mavenLocal.

**10.** Privacidade: sem redação de RX, os exports levam FC, estresse, passos e horários de treino reais. Mitigação: a
regra de nunca versionar exports fase3-* e a pendência de redação de RX no Repo 1.

**11.** Android em segundo plano: mesmo com o serviço de atividade, um fabricante agressivo pode matar o processo. A
atividade em memória se perde (DP-130), e o treino entra depois como treino do relógio. Sem wakelock, o tick atrasa com
a CPU suspensa, mas a duração não, porque vem do relógio de parede.

**12.** Histórico vazio sem medição automática: a FC e o estresse só existem com o 1F e o B9 01 01 ligados. No Condor
isso vem do sync de ajustes da fase 2; na validação, os dois precisam ser ligados antes.

**13.** Troca de Core na fase 4: treinos já postados pelo Core antigo voltam pelo B2 e só não duplicam se a
decodificação do início for idêntica à da SDK, coberta por golden. O backend não atualiza a duração dos que já existem:
os antigos ficam com fim − início e os novos com o tempo ativo.

**14.** Valores do Core usados fora da atividade (ActionType, TechnosWatchFaceTransferEventStatus,
TechnosFirmwareUpgradeStatus, TechnosTileType, technosAssets) continuam faltando; se algum for usado no nível do módulo
de um arquivo carregado no boot, a fase 4 quebra no import. Fica no DP-73 para o adaptador.

## Perguntas ao usuário (sem resposta)

### Pergunta 1

O GPS do celular nas atividades com mapa (caminhada, corrida e ciclismo) entra até quinta?

- A) Fica fora da fase 3. A atividade com mapa roda pelo relógio: distância, passos, FC e tempo do P85, sem trajeto e
  sem velocidade GPS. O TechnosNativeMap é uma View vazia, então também ficam em branco o resumo das atividades antigas
  com rota vinda da API, o cartão de localização do relógio na Home e a tela de encontrar o relógio. O GPS vira uma
  fatia depois do prazo (DP-127 e DP-128).
- A+) Como A, mais um TechnosNativeMap só de resumo em JS sobre o react-native-maps, que o Condor já embarca
  (dependência opcional, cerca de 2 h, validado só no Condor na fase 4). O resumo das atividades antigas e a localização
  do relógio voltam a ter mapa; o mapa ao vivo continua vazio.
- B) GPS só no Android dentro do prazo (cerca de +0,5 dia): rota, distância e velocidade GPS, onActivityRealTimeSpeed e
  serviço em primeiro plano de localização. iOS e o desenho do mapa continuam fora.
- C) GPS nas duas plataformas e mapa em JS sobre o react-native-maps (cerca de +1,5 dia). Empurra a fase 4 para depois
  de quinta.

**Recomendação:** A

**Por quê:** As quatro pesquisas somam de 3,5 a 4 dias, e a fase 3 tem cerca de 1, que já fica justo (cerca de 10,5 h de
relógio). GPS, serviço de localização e mapa custam sozinhos de 1,25 a 1,75 dia, e o mapa não dá para validar no app de
exemplo. Com A, o Condor inicia, pausa e para a atividade com o P85 e manda o treino ao backend com os dados do relógio.
O que se perde é visível: trajeto, velocidade GPS e todos os mapas do app. O A+ recupera os mapas de resumo por umas 2
h, mas só pode ser conferido no Condor; se houver folga na fase 4, vale a pena. Por ser regressão de produto, a decisão
é sua.

### Pergunta 2

A gravação no Health Connect (Android) e no Apple Health (iOS) da FC e das atividades entra antes de quinta?

- A) Fica fora até o prazo (DP-112). Na fase 4, getHCpermissionsStatus e requestHCpermissions viram stubs, e a seção
  'Integrar com apps' do Condor não grava nada.
- B) Entra na fase 3 (cerca de +0,5 a 1 dia nas duas plataformas, com permissões e entitlement).

**Recomendação:** A

**Por quê:** A produção grava a FC no Health Connect e no HealthKit, e o Condor oferece essa integração ao REEBOK. O
Core Next não tem nada disso, e o fluxo de permissões é uma fatia de plataforma inteira, sem relação com o protocolo do
P85. Só você decide se essa regressão vale até depois do prazo.

### Pergunta 3

Se faltar tempo, o que cai primeiro? Precisa de resposta agora, antes de começar, porque o plano já ocupa o dia inteiro.

- A) A atividade iniciada pelo app volta ao stub da S0: o Condor mostra o erro genérico ao iniciar, e os treinos feitos
  no relógio continuam chegando. O encaminhamento de notificações do Android mantém o seu dia.
- B) O encaminhamento de notificações do Android passa para depois de quinta, e a atividade iniciada pelo app fica
  completa.
- C) Os treinos feitos no relógio voltam à lista vazia, e o resto continua.

**Recomendação:** A

**Por quê:** FC, estresse e treinos do relógio são baratos e alimentam todo dia os cards e o histórico do REEBOK.
Notificações no relógio são uso diário no Android. A atividade iniciada pelo app é a fatia mais cara e com mais
incógnitas do P85: eco do início em cerca de 4 s ou ausente, pausa sem eco, ritmo do B2 0D, id do registro. O stub da S0
já existe desde a primeira manhã; cortar é só não ligar o ActivityController. Pelas dependências, a fase 3 inteira dá
uns 10,5 h de relógio sem retrabalho, e decidir agora evita que o corte vire discussão na quarta.

## Revisão: o que mudou depois das críticas

**1.** P1 (aceita): o id do B2 02 passa a ser o índice do slot, a regra da SDK (sdk:j/t0.java:44, var2/5), do exemplo do
fornecedor e das duas produções (CRPService.java:1581-1621). O 0E vira só a queda do slot ocupado mais novo e nunca
prova mapeamento. Se o índice falhar, ele fica desligado no sync, com no máximo 2 timeouts; slots processados do mais
novo para o mais antigo. Mudaram F3-D10, o comando do registro, o DP-114 (o id deixa de ser desvio), os testes e o
checklist, com o T2b novo (dois treinos antes do sync).

**2.** P2 (aceita): vetor corrigido para TX B2 02 04 com eco 04. Aceita-se qualquer B2 03 com um B2 02 em voo,
confere-se o início, e o id ecoado vai no B2 04 e casa o B2 05 (a SDK faz assim, t0.java:70-85). Entraram um golden com
eco diferente do pedido e um da queda para o 0E.

**3.** P3 (aceita, com outra correção): em vez de um quirk desligado, o padrão passa a ser um B2 0D zerado a cada 5 s em
STARTED/RESUME, coalescido e só em READY/SYNCING. A produção manda em todo tick, de 1 a 5 s pela RAM, com ou sem GPS
(CRPActivityManagerV2.java:422-449; ProgressIntervalAdjust.java:33-44). Novo F3-D30, nova WatchAction.PhoneActivityInfo,
novo comando, DP-126 reescrito, e A1/A2/A3 conferem a tela do relógio e o ritmo.

**4.** P4 (aceita): B6 02 dd 00 e B2 06 voltam como escrita sem matcher, com os mesmos bytes da produção e cerca de 0,6
s por sync. Todo 35 00 e todo B2 00 capturados vieram uns 230 ms depois deles, sem espera. Mudaram F3-D5, F3-D10, os
comandos, o DP-103 (agora 'uma página por vez') e o DP-114, que deixa de citar o B2 06. O B2 06 foi para 'Conferido'; H1
confere os TX; o ReplayTransport do iOS tolera B6/02 e B2/06.

**5.** P5 (aceita): a decodificação do RX 68 segue a SDK (sdk:m/a.java:3276-3298): tamanho 1 é estado; tamanho 2 com [1]
= 01 é recusa, com FF = bateria baixa; o resto é FC legada, só log. O CoreBridge só traduz a recusa em START_REQUESTED.
A resposta opcional do 68 FF casa só pelo eco de 1 byte.

**6.** P6 (aceita): janela de eco de 10 s com eco superado no CrpActivityControl, e ActivityState ganha fromWatch.
Mudaram F3-D16 e o DP-122; entrou o A13 (pausar e retomar rápido).

**7.** P7 (aceita): a lista de comandos não enviados fica explícita (B2 07, 09, 0E e 10, AB 02, 57, B2 0D com
distância), e o teste confere exatamente um B2 0D zerado antes de cada início e os periódicos zerados.

**8.** P8 (aceita): tabela Technos → CRP única, a do Android mais as entradas que só o iOS tem (217 → 73, 318 → 75, 319
→ 76, conferidas em CRPSmart1ActivityType.kt e CRPSmart1TypeMapper.m), gerada por script que compara as duas. Novos
F3-D31 e DP-134, CrpActivityTypesTest e o caso do treino funcional no A12.

**9.** P9 e E7 (aceitas): o forceStop e o prazo vencido do início põem a chave do início em confirmUploaded(WORKOUTS), e
a coleta pula a cópia do relógio (±10 s). É mais barato que um conjunto novo de 'inícios conhecidos' e é podado em 30
dias. Mudaram F3-D15, F3-D18, F3-D20, o DP-120 e o DP-124, e o A10 confere.

**10.** P10 (aceita): o 2A37 ignora FC fora de 40..200 e flags com contato suportado e não detectado. O delta do FEE1
trata a virada do dia sem valor negativo. Mudaram F3-D19, o comando do 2A37, o DP-125 e os testes.

**11.** E1 (aceita, confirmada pela fonte do manifest-merger 30.3.1, XmlAttribute.java:168-177, e pelo manifest de
produção v4.3.57:100-102): novo F3-D34. O Condor precisa de ACCESS_FINE_LOCATION com
tools:remove='android:maxSdkVersion' e de ACCESS_BACKGROUND_LOCATION. Entra no DP-69, na migração do api-js.md e num
lembrete para conferir o manifest mesclado na fase 4.

**12.** E2 (aceita, HistoryStore.kt:159-163 e SyncEngine.kt:50): a poda passa a ser por tipo, com as chaves de WORKOUTS
comparadas como número. Mudaram F3-D8, F3-D4 e o DP-107; o HistoryStoreTest ganhou 'confirmar, podar e a chave fica'; o
T4 confere em dois syncs.

**13.** E3 (aceita): TechnosActivityV2Status, TechnosActivityOrigin, TechnosActivityErrorCode e PlanType passam a ser
exportados como valor, na raiz e no mock, e TechnosActivityHistoryV2Activity vira cópia literal. Os quatro enums existem
no Core (sportsPlan.ts:8, eventData/activity.ts:8, 117, 150); o Condor faz switch no primeiro (activity.ts:279-293) e
usa PlanType no nível do módulo (constants/Exercises:3, :1724+). Mudaram F3-D24, a API, a S6a, o Jest e o DP-73, que
agora lista os valores restantes.

**14.** E4 (aceita): estimativa refeita para cerca de 40 h de agente e 10,5 h de relógio com 5 agentes (9,5 h com 6). A
S5 começa logo depois da S0, sobre uma ActivitySessionPort falsa (F3-D14). Os portões são incrementais (F3-D33), e a
pergunta 3 passa a pedir resposta antes de começar.

**15.** E5 (aceita, FileSampleStore.kt:31, AndroidCoreHost.kt:36, FileSampleStore.swift:15, NativeCoreNextModule.kt:84,
android/build.gradle:56): nova fatia S0h (1 h) com os stubs dos hosts, o spec codegen, os overrides e o switch do emit.
Entrou também a regra de publicador único na coordenada 0.1.0 (F3-D33). A GARANTIA do cutLine agora conta com S0 mais
S0h.

**16.** E6 (aceita): o prazo de 10 s conta do START_REQUESTED. O StartActivity leva notAfterEpochMillis, e a sessão (na
vez do comando) e o CRP (depois do 2A19) recusam com CANCELLED sem escrever. Mudaram F3-D15, o comando de início, o
DP-120 e os testes (start na fila atrás de um RefreshSteps).

**17.** E8 (aceita): a duração ao vivo vem do relógio de parede (nowMillis injetável) menos as pausas, nunca negativa
nem decrescente; o tick só dispara a emissão. Mudaram F3-D19, a plataforma, o DP-125, o teste de salto do relógio
virtual e a comparação com o relógio de parede no A11.

**18.** E9 (aceita): o storeWorkout grava pela caixa de entrada da sessão (o mesmo `call(...)` que o confirmUploaded usa
para persistir, SessionEngine.kt:183-186). Novo F3-D32, API e teste de concorrência.

**19.** E10 (aceita): o DP-128 e a pergunta 1 passam a dizer que a View vazia também apaga o resumo de atividades
antigas, o cartão de localização do relógio e a tela de encontrar o relógio (confirmado nos 7 arquivos do Condor que
usam CondorNativeMap). Entrou a opção A+ (mapa de resumo em JS, cerca de 2 h).

**20.** E11 (aceita, example/ios Info.plist:38-39): no exemplo valida-se só o 'denied', e o 'granted' fica para o Condor
na fase 4. Mudaram F3-D26, o comando e o checklist do iPhone.

**21.** E12 (aceita): o startActivityWork só depois do perform(StartActivity) bem-sucedido, o que fecha a contradição
entre F3-D15 e F3-D22. Mudaram também o DP-129, o DP-111 e os testes (NOT_READY e NOT_SUPPORTED não sobem o serviço).

**22.** E13 (aceita): no STOPPED com o link fora, o CoreBridge chama o emitCurrentState. Mudaram F3-D21, o teste e o
A10.

**23.** E14 (aceita, useSyncStepsRunner.ts:131-158; Sync.ts:15): o F3-D23, o DP-131 e o DP-05 passam a contar a espera
do sync de ajustes; entrou o A14 opcional.

**24.** Outros ajustes: S2a, S2b, S3 e S5 com estimativas maiores; S9 com treino funcional e eventos com horário; riscos
reescritos (id, B2 0D, manifest, prazo, valores restantes do DP-73); docs com a §13 do protocolo e as ADRs 41/42
atualizadas.

## Revisão: críticas rejeitadas

**1.** P3, só a correção proposta: o B2 0D atrás de um quirk desligado foi trocado por um B2 0D periódico ligado por
padrão, a cada 5 s. É o ritmo que a própria produção Android usa em aparelhos com menos de 2 GB
(ProgressIntervalAdjust.java:33-44), e uma atividade sem nenhum B2 0D nunca foi observada. O problema apontado foi
aceito.

**2.** P1, a regra 'travar o mapeamento só quando um slot diferente do mais novo casar': deixou de fazer sentido sem o
slot + 10. Com o índice primeiro, qualquer casamento pelo índice prova a regra da SDK (o índice 4 não se confunde com o
14), e só o 0E fica proibido de provar mapeamento.

**3.** E1, a alternativa de o Repo 2 deixar de declarar o FINE com maxSdkVersion=30: rejeitada. A biblioteca só precisa
de localização para o scan até a API 30 (comentário do AndroidManifest.xml do Repo 2), e o Condor já vai mexer no
manifest na fase 4 por causa do DP-69. Ficaram a documentação e a conferência do manifest mesclado.

**4.** E5, a versão própria por publicação (ex.: 0.1.0-f3s0): rejeitada em favor de um publicador único. O Repo 2 fixa a
coordenada em android/build.gradle:56, e trocar a versão a cada publicação exigiria editar o build do Repo 2 cada vez.

**5.** E6, a alternativa de cancelamento por requestId na sessão: não adotada. O notAfter no StartActivity resolve o
mesmo caso sem uma API pública nova de cancelamento, e a fila da sessão é FIFO sem remoção (SessionEngine.kt:1145).

**6.** E8, a alternativa de um relógio que conte a suspensão vindo do host (elapsedRealtime ou mach_continuous_time):
não adotada. Exigiria um sexto método no CoreHost. O relógio de parede injetável basta, com a duração presa em nunca
negativa nem decrescente.

**7.** E9, a alternativa de AtomicReference com compare-and-set para os treinos: não adotada. Gravar pela caixa de
entrada segue o padrão que o confirmUploaded já usa para persistir (SessionEngine.kt:183-186) e mantém um escritor só
por lista (HistoryStore.kt:24-31).

**8.** E10, a recomendação implícita de fazer o mapa de resumo agora: o mapa entrou como opção A+ na pergunta 1, mas a
recomendação continua A. Sem react-native-maps, chave nem permissão, o app de exemplo não valida mapa, e o plano já
ocupa o dia.

**9.** E11, acrescentar ao exemplo as strings de uso e um botão que peça a autorização: rejeitado. O 'granted' é
validado no Condor, que já tem as chaves NSLocation* e o modo location, e o exemplo só confere o 'denied'.

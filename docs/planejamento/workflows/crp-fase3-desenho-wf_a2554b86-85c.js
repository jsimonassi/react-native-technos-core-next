export const meta = {
	name: 'crp-fase3-desenho',
	description: 'Fase 3 CRP (atividade + históricos): pesquisa em 4 fatias, especificação com linha de corte, crítica em 2 lentes e revisão. Só leitura.',
	phases: [
		{ title: 'Pesquisa', detail: '4 fatias em paralelo: históricos, treinos do relógio, atividade pelo app (protocolo), plataforma (GPS, banco local, mapa, segundo plano)' },
		{ title: 'Especificação', detail: 'arquiteto monta a spec da fase 3 com a linha de corte' },
		{ title: 'Crítica', detail: 'protocolo e encaixe no Condor/plataformas/prazo' },
		{ title: 'Revisão', detail: 'spec final' },
	],
}

const SP = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const RULES = `
Você está num trabalho SÓ LEITURA: não crie, edite nem apague arquivos em nenhum repositório (o scratchpad ${SP} pode ser usado para scripts e notas suas, numa pasta própria nova). Nada de git add/commit/stash/checkout/reset. O working tree dos dois repos pode ter a fase 2 não commitada; ela é a base atual.
Privacidade: a captura HCI de produção (${SP}/condor-out/frames.jsonl, derivada do btsnoop do usuário) e as fixtures de referência ${R1}/fixtures/reference/condorreebok/MOY-VS02-2.0.0/*.jsonl (condor-app-reconnect-sync-walk.jsonl tem uma caminhada real) têm dado pessoal: perfil (0x12), notificações (0x41), clima e localização (0x42, 0x43, 0xB5), e os números reais de atividade, passos, frequência cardíaca, sono e estresse do usuário. Use esses frames só para entender LAYOUT, ordem e se houve resposta; nunca reproduza os valores deles no retorno. Vetores de teste no retorno devem ser sintéticos. Nunca escreva MAC nenhum nem nome de aparelho próximo. Leia arquivos de dados só com python3 -I e scripts fora da pasta dos dados.
Fontes:
- App Condor (consumidor alvo da fase 4): /Users/joao.farias/GTE-CondorSmart (branch release/2.5.0). Serviço do relógio em src/services/Smartwatch.ts; features por modelo em src/constants/FeaturesByDevice.ts (o P85 é REEBOK / "Condor Reebok"); exercício em src/store/MainStoreContext/Exercise/useExerciseData/index.ts e src/screensV2/activity/; históricos em src/services/History/* e src/store/MainStoreContext/History/*; sync em src/store/LowerLevelContext/SyncHandlerStoreContext/useSyncHandlerData/useSyncStepsRunner.ts; envio de atividade à API em src/services/ActivityHistoryService.ts; mapper src/mappers/entities/activity.ts. Use grep -rn sem --include com glob (o shell é zsh).
- Core de produção que o Condor usa (pin v4.3.57): cópia em ${SP}/core-v4.3.57 (android/, ios/, src/), e o repo /Users/joao.farias/TechnosWareCore (git show v4.3.57:<caminho>; o checkout local está em v4.4.4, cuidado com números de linha). Android CRP: android/src/main/java/com/crp/bluetooth/ (CRPService.java e vizinhos), mais o código comum de atividade/GPS/banco/mapa do Core (procure por Activity, Location, Exercise, Training, Route, Map, Room/SQLite, ViewManager, foreground service); iOS: ios/crpBluetooth/ e ios/reactlibrary/. Spec JS: src/NativeModules (NativeCoreSpec, tipos de eventData de atividade, histórico de FC/estresse/SpO2).
- SDK CRP Android decompilada e ofuscada (crpblelib 2.0.3): use ${SP}/vendor-recheck/src (com/crrepa/ble/conn/CRPBleConnection*, listeners e tipos em com/crrepa/ble/conn/{listener,type,bean}, impl em com/crrepa/h/a.java, frames em com/crrepa/f/*, despacho de respostas em com/crrepa/m/a.java). SDK iOS: /Users/joao.farias/CrpTechnosIosSdk (CRPSmartBand.framework, header CRPSmartBand-Swift.h). Exemplo do fornecedor: /Users/joao.farias/CRPBleSdkSample.
- Inventário da fase 0: ${SP}/../tasks/w0l17lizi.output (JSON; result.inventory[*].items com proposedPhase "3" = os 18 símbolos da fase 3, com condorUsage, coreAndroid, coreIos, sdkApi, notes; confira e corrija, não confie cegamente) e result.protocol; notas em ${SP}/condor-out/fase0-protocolo.md.
- Nova SDK: Repo 1 ${R1} (KMP; leia CLAUDE.md, docs/arquitetura.md, docs/protocolo-crp.md (a seção 13 lista o que ficou para a fase 3: atividades B2, FC 35/B6 02, estresse B9 11), docs/decisoes.md, docs/pendencias.md, o pacote crp/ (CrpDriver, CrpCommand, writers da fase 2), driver/DeviceDriver, session/SessionEngine e WatchSession, domain/, bridge/CoreBridge, CoreHost, EventMapper) e Repo 2 ${R2} (TurboModule; leia CLAUDE.md, docs/api-js.md, docs/desvios-de-producao.md (DP-72 perfil só em memória, DP-94 sync sem FC/estresse/treinos), docs/pendencias.md, src/specs, src/index.ts, src/compat, android/ (ble/, store/, bridge/, SyncForegroundService) e ios/CoreNext/). Veja também como o SMA (fitGPS) e o iDO (Life Ultra GPS) estão no Repo 1 e como o Core de produção implementa os mesmos métodos para eles, porque a API nova precisa ser genérica entre famílias (família sem suporte responde NOT_SUPPORTED).
- Validação da fase 2 no Android (2026-11-02), achados de protocolo: ${SP}/val-android/notas-s9.md (só leitura).
Contexto do prazo: hoje é segunda 2026-11-02, 23h; o prazo final (Condor rodando na SDK nova, com o P85) é quinta 2026-11-05. Ainda faltam, além da fase 3: a validação da fase 2 no iPhone, a fatia de encaminhamento de notificações no Android (~1 dia) e a fase 4 (troca do Core no Condor). A fase 3 precisa caber em cerca de 1 dia de implementação; o que não couber vira desvio documentado com stub compatível. Toda diferença em relação à produção vira entrada no docs/desvios-de-producao.md do Repo 2 (regra do usuário).
`

const SLICES = [
	{ key: 'historicos', title: 'Históricos de saúde', symbols: 'getHistoryHeartRate, onHistoryHeartRate, getHistoryStress, onHistoryStress, getHistorySpO2, onHistorySpo2, e a parte do syncDataHistory da produção que pede FC de hoje/ontem, estresse de hoje/ontem e SpO2 (o P85 tem SpO2?). Inclua o formato exato dos eventos (shapes que o Condor lê e mapeia), o daysBefore, o que é guardado localmente no Core e como o Condor confirma/apaga (deletedSavedData).', extra: 'Compare com o que a fase 1 já faz para passos e sono no Repo 1 (SampleStore, getStepsDays, getSleepSessions) e proponha o encaixe genérico.' },
	{ key: 'treinos', title: 'Treinos registrados no relógio', symbols: 'getHistoryActivityV2, onHistoryActivityV2, e o queryHistoryTraining / getSportRecordList do sync de produção (atividades iniciadas no relógio).', extra: 'Bytes do B2 (e o que mais a SDK pede para detalhes de treino: FC por minuto, GPS? passos), paginação, identificação/dedup, o que a captura de referência condor-app-reconnect-sync-walk.jsonl mostra (só layout), o shape que o Condor espera e como ele envia à API.' },
	{ key: 'atividade-protocolo', title: 'Atividade iniciada pelo app (protocolo e sessão)', symbols: 'startActivityByTypeV2, pauseActivityV2, resumeActivityV2, stopActivityV2, onActivityStartedV2, onActivityStatusV2, onActivityUpdateV2, onActivityCompletedV2, onActivityError, onActivityRealTimeSpeed.', extra: 'Comandos CRP de esporte (iniciar/pausar/retomar/parar, tipos de esporte, dados em tempo real que o relógio manda durante o exercício, o que acontece se o relógio parar a atividade pelo próprio relógio ou desconectar no meio), máquina de estados da atividade, temporizações, o que vem do relógio vs o que é calculado no telefone (distância, velocidade, calorias, FC), e como isso entra na sessão do Repo 1 sem bloquear a fila de comandos.' },
	{ key: 'atividade-plataforma', title: 'Atividade: GPS, banco local, mapa e segundo plano', symbols: 'a parte de plataforma de startActivityByTypeV2/stopActivityV2/onActivityCompletedV2/onActivityRealTimeSpeed: rastreio de GPS no telefone, cálculo de distância e velocidade, persistência local da atividade e da rota, mapa nativo (ViewManager ou componente que o Condor renderiza), serviço em primeiro plano e localização em segundo plano no Android, background location no iOS, permissões, retomada após o app morrer.', extra: 'Diga exatamente o que o Condor importa do Core para o mapa e para a rota (componentes nativos, tipos, eventos), o que o Core de produção implementa em cada plataforma (arquivo:linha), e o mínimo que o Core Next precisa portar para o Condor funcionar na fase 4. O memo do usuário diz que "banco local e mapa nativo já se sabe que são viáveis": confirme o que existe e estime o esforço.' },
]

const RESEARCH = {
	type: 'object',
	properties: {
		symbols: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					symbol: { type: 'string' },
					condor: { type: 'string', description: 'onde e quando o Condor chama/escuta (arquivo:linha), argumentos exatos e shape, o que espera de volta (promise, evento, timeout), em que fluxo (sync, tela de exercício, histórico)' },
					coreAndroid: { type: 'string', description: 'o que o Core Android faz (arquivo:linha na v4.3.57): mapeamento, defaults, chamadas da SDK, eventos emitidos, persistência, bugs' },
					coreIos: { type: 'string', description: 'idem iOS' },
					frames: { type: 'string', description: 'layout byte a byte de cada frame (cmd, sub, payload, endianness, faixas), resposta esperada ou ausência dela, fonte (arquivo:linha da SDK), evidência na captura (só layout e se houve resposta; sem valores pessoais), um vetor SINTÉTICO' },
					platform: { type: 'string', description: 'peças de plataforma necessárias (GPS, permissões, serviço em primeiro plano, banco, mapa, segundo plano) em Android e iOS, e o que o Core faz hoje' },
					otherFamilies: { type: 'string', description: 'como SMA/iDO fazem o equivalente no Core de produção e no Repo 1, para a API genérica' },
					p85Reachable: { type: 'string', description: 'o P85 suporta? evidência' },
					effort: { type: 'string', enum: ['XS', 'S', 'M', 'L', 'XL'] },
					risks: { type: 'string' },
					openQuestions: { type: 'array', items: { type: 'string' } },
				},
				required: ['symbol', 'condor', 'coreAndroid', 'coreIos', 'frames', 'platform', 'otherFamilies', 'p85Reachable', 'effort', 'risks', 'openQuestions'],
			},
		},
		crossCutting: { type: 'array', items: { type: 'string' } },
	},
	required: ['symbols', 'crossCutting'],
}

phase('Pesquisa')
const research = await parallel(SLICES.map(s => () => agent(`${RULES}
Fatia "${s.title}". Símbolos: ${s.symbols}
${s.extra}
Para cada símbolo, levante a verdade nas fontes. Prioridades: (1) o que o Condor realmente chama e espera, porque na fase 4 o Condor vai trocar o Core pela SDK nova com o mínimo de mudança; (2) os bytes exatos que o relógio recebe e manda (SDK + captura); (3) o que precisa de plataforma em Android e iOS; (4) como ficaria genérico entre famílias. Cite arquivo:linha em tudo. Registre bugs do Core de produção que NÃO devem ser copiados (mas lembre que todo desvio vira entrada documentada). Se um símbolo depende de algo fora da fatia, diga em crossCutting.`, { label: 'pesquisa:' + s.key, phase: 'Pesquisa', schema: RESEARCH })))
const found = research.map((r, i) => ({ slice: SLICES[i].key, result: r }))
log(`pesquisa: ${found.filter(f => f.result).length}/${SLICES.length} fatias`)

const SPEC = {
	type: 'object',
	properties: {
		cutLine: { type: 'string', description: 'o que entra na fase 3 vs o que vira stub documentado/pós-prazo, e por quê, considerando ~1 dia de implementação' },
		decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, decision: { type: 'string' }, rationale: { type: 'string' } }, required: ['id', 'decision', 'rationale'] } },
		commands: { type: 'array', items: { type: 'object', properties: { symbol: { type: 'string' }, frames: { type: 'string' }, response: { type: 'string' }, vector: { type: 'string' }, source: { type: 'string' } }, required: ['symbol', 'frames', 'response', 'vector', 'source'] } },
		api: { type: 'string', description: 'mudanças por camada: domain, DeviceDriver, SessionEngine/WatchSession, store, CoreBridge/CoreHost/EventMapper, spec JS (nomes, argumentos e shapes de eventos compatíveis com o Core para o Condor), Android host (GPS, serviço, banco, mapa), iOS host, app de exemplo' },
		platform: { type: 'string' },
		deviations: { type: 'array', items: { type: 'string' }, description: 'desvios de produção previstos (para o docs/desvios-de-producao.md), cada um com produção vs Core Next e motivo' },
		tests: { type: 'string' },
		docs: { type: 'string' },
		workSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, repo: { type: 'string' }, scope: { type: 'string' }, files: { type: 'string' }, dependsOn: { type: 'string' }, estimate: { type: 'string' } }, required: ['id', 'repo', 'scope', 'files', 'dependsOn', 'estimate'] } },
		validationChecklist: { type: 'array', items: { type: 'string' } },
		risks: { type: 'array', items: { type: 'string' } },
		userQuestions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, recommendation: { type: 'string' }, why: { type: 'string' } }, required: ['question', 'options', 'recommendation', 'why'] } },
	},
	required: ['cutLine', 'decisions', 'commands', 'api', 'platform', 'deviations', 'tests', 'docs', 'workSlices', 'validationChecklist', 'risks', 'userQuestions'],
}

phase('Especificação')
const spec = await agent(`${RULES}
Pesquisa das 4 fatias: ${JSON.stringify(found)}
Você é o arquiteto da fase 3. Monte a especificação de implementação, seguindo a arquitetura e as convenções dos dois repos (leia-as, e veja como a fase 2 entrou: WatchSetting/WatchAction/WatchEvent, CoreBridge com 24 métodos, hosts Android/iOS, app de exemplo com abas e o roteiro de validação no example/README.md). Regras de desenho:
- API genérica entre famílias; SMA/iDO respondem NOT_SUPPORTED onde não implementarem (sem quebrar os testes deles).
- Nomes, argumentos e shapes de eventos do JS compatíveis com o que o Condor usa do Core (para a fase 4); o que for só do Condor fica no JS (adaptadores), não no protocolo.
- Não copiar bugs do Core de produção; toda diferença vira desvio documentado.
- Prazo: proponha a linha de corte (o essencial para o Condor funcionar na fase 4 com o P85 vs stub documentado), e quebre a implementação em fatias paralelizáveis com arquivos, dependências e estimativa (Repo 1 protocolo, Repo 1 sessão/bridge, Repo 2 Android, Repo 2 iOS, Repo 2 JS/exemplo/docs).
- Testes: vetores dourados sintéticos por comando, testes de sessão com o simulador CRP do Repo 1, testes de bridge, testes de host quando houver plataforma; e roteiro de validação do usuário no Android e no iPhone (o que ele faz e vê no relógio e no app).
- Perguntas ao usuário só para decisões que são dele (produto/escopo/prazo), com opções, recomendação e porquê; não pergunte fatos verificáveis.`, { label: 'arquiteto', phase: 'Especificação', schema: SPEC })

phase('Crítica')
const CRIT = {
	type: 'object',
	properties: {
		issues: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['alta', 'media', 'baixa'] }, where: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, fix: { type: 'string' } }, required: ['id', 'severity', 'where', 'issue', 'evidence', 'fix'] } },
		summary: { type: 'string' },
	},
	required: ['issues', 'summary'],
}
const LENSES = [
	{ key: 'protocolo', prompt: 'Lente protocolo: tente REFUTAR cada frame, vetor, resposta esperada e fonte da spec contra a SDK decompilada, o header iOS e a captura (layout). Procure byte errado, endianness, faixa, sub-comando, paginação, resposta que não existe, ordem/atraso exigido pela SDK, dados em tempo real mal interpretados, e comandos que o P85 não aceita.' },
	{ key: 'encaixe', prompt: 'Lente encaixe: tente REFUTAR que o Condor funcionaria na fase 4 com esta API (nomes, argumentos, shapes de eventos, promises, timeouts e fluxos da tela de exercício e do sync), que Android e iOS conseguem fazer o que a spec pede (GPS em segundo plano, serviço em primeiro plano, permissões, banco, mapa), que SMA/iDO não quebram, e que a linha de corte e as fatias cabem em ~1 dia. Aponte dependências escondidas entre fatias e o que a spec esqueceu.' },
]
const critiques = await parallel(LENSES.map(l => () => agent(`${RULES}
Especificação proposta: ${JSON.stringify(spec)}
Pesquisa de base: ${JSON.stringify(found)}
${l.prompt} Cada problema com evidência (arquivo:linha). Não reporte estilo.`, { label: 'critica:' + l.key, phase: 'Crítica', schema: CRIT })))

phase('Revisão')
const final = await agent(`${RULES}
Especificação proposta: ${JSON.stringify(spec)}
Críticas: ${JSON.stringify(critiques.filter(Boolean))}
Pesquisa de base: ${JSON.stringify(found)}
Confira cada crítica nas fontes. Aceite as corretas e corrija a spec; rejeite as erradas com evidência. Devolva a spec final completa (mesmo formato), mais a lista do que mudou e do que foi rejeitado.`, {
	label: 'arquiteto:revisao',
	phase: 'Revisão',
	schema: { type: 'object', properties: { spec: SPEC, changed: { type: 'array', items: { type: 'string' } }, rejected: { type: 'array', items: { type: 'string' } } }, required: ['spec', 'changed', 'rejected'] },
})

return { research: found, draft: spec, critiques: critiques.filter(Boolean), final }

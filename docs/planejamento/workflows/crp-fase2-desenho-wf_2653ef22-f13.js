export const meta = {
	name: 'crp-fase2-desenho',
	description: 'Fase 2 CRP (tela Dispositivo do Condor): pesquisa dos 26 símbolos em 4 fatias, especificação, crítica em 2 lentes e revisão. Só leitura.',
	phases: [
		{ title: 'Pesquisa', detail: '4 fatias em paralelo: Condor, Core v4.3.57, SDK, captura HCI, equivalentes SMA/iDO' },
		{ title: 'Especificação', detail: 'arquiteto monta a spec da fase 2' },
		{ title: 'Crítica', detail: 'protocolo e encaixe no Condor/plataformas' },
		{ title: 'Revisão', detail: 'spec final' },
	],
}

const SP = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const RULES = `
Você está num trabalho SÓ LEITURA: não crie, edite nem apague arquivos em nenhum repositório (o scratchpad ${SP} pode ser usado para scripts e notas suas, numa pasta própria). Nada de git add/commit/stash/checkout. Outro trabalho está editando os repos em paralelo (fixtures e docs da fase 1); ignore diffs não commitados em fixtures/ e docs/.
Privacidade: a captura HCI de produção (${SP}/condor-out/frames.jsonl, derivada do btsnoop do usuário) tem dado pessoal nos frames 0x12 (altura/peso/idade/sexo reais), 0x41 (texto de notificação), 0x42 (previsão do tempo), 0x43 e 0xB5 (localização/clima). Use esses frames só para entender o LAYOUT; nunca reproduza os valores deles no seu retorno. Vetores de teste no retorno devem ser sintéticos. Nunca escreva MAC nenhum. Leia arquivos de dados só com python3 -I e scripts fora da pasta dos dados.
Fontes:
- App Condor (consumidor alvo da fase 4): /Users/joao.farias/GTE-CondorSmart (branch release/2.5.0). Serviço do relógio em src/services/Smartwatch.ts; features por modelo em src/constants/FeaturesByDevice.ts (o P85 é REEBOK / "Condor Reebok"); sync de ajustes em useUserSettingsSyncHandler.ts e useSyncStepsRunner.ts.
- Core de produção que o Condor usa (pin v4.3.57): cópia em ${SP}/core-v4.3.57 (android/, ios/, src/), e o repo /Users/joao.farias/TechnosWareCore (use git show v4.3.57:<caminho> se precisar). Android CRP: android/src/main/java/com/crp/bluetooth/ (CRPService.java etc.); iOS: ios/crpBluetooth/. Spec JS: src/NativeModules (NativeCoreSpec, tipos de eventData).
- SDK CRP Android decompilada e ofuscada (crpblelib 2.0.3): ${SP}/vendor-sdks/crp/src (com/crrepa/ble/conn/CRPBleConnection*, impl em com/crrepa/h/a.java, frames em com/crrepa/f/*, despacho de respostas em com/crrepa/m/a.java). SDK iOS: /Users/joao.farias/CrpTechnosIosSdk (CRPSmartBand.framework, header CRPSmartBand-Swift.h). Exemplo do fornecedor: /Users/joao.farias/CRPBleSdkSample.
- Inventário da fase 0: ${'/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/tasks/w0l17lizi.output'} (JSON; result.inventory[*].items com proposedPhase "2" = os 26 símbolos da fase 2; cada item tem condorUsage, coreAndroid, coreIos, sdkApi, notes) e result.protocol; notas de protocolo em ${SP}/condor-out/fase0-protocolo.md.
- Nova SDK: Repo 1 ${R1} (KMP; leia CLAUDE.md, docs/arquitetura.md, docs/protocolo-crp.md, docs/decisoes.md, o pacote crp/ — CrpCommand.kt já tem catálogo e codecs de 0x12, 0x17, B9 só no catálogo —, driver/DeviceDriver, session/SessionEngine, bridge/CoreBridge e CoreHost) e Repo 2 ${R2} (TurboModule; leia CLAUDE.md, docs/api-js.md, src/specs, src/index.ts, android/ e ios/CoreNext/). Veja também como o SMA e o iDO estão no Repo 1 e como o Core de produção implementa os mesmos métodos para SMA/iDO, porque a API nova precisa ser genérica entre famílias (família sem suporte responde "não suportado").
Contexto do prazo: hoje é domingo 2026-11-01 à tarde; o prazo final (Condor rodando na SDK nova) é quinta 2026-11-05. A fase 2 deveria caber em cerca de 1 dia de implementação, com as fases 3 (atividade + históricos) e 4 (troca do core no Condor) depois. A fase 1 (pareamento, bateria, firmware, hora, passos, sono, esquecer, vínculo clássico) está pronta e validada no Android e no iPhone.
`

const SLICES = [
	{ key: 'ajustes', title: 'Ajustes simples', symbols: 'setUserInfo, setGoalsV2, set12HourFormat, setTemperatureUnit, setDistanceUnit, setScreenTime, setDeviceBatterySaving, setSosHelp, setGestureControlV2, setMenstrual' },
	{ key: 'janelas', title: 'Monitoramento, lembretes e alarmes', symbols: 'setStressAutomaticCheck, setHeartRateAutomaticCheck, setNotDisturb, setWaterReminderV2, setWalkReminder, setAlarm, setWorldClock' },
	{ key: 'mensagens', title: 'Notificações, contatos e clima', symbols: 'manageNotifications, setAddressBook, syncWeather' },
	{ key: 'interacoes', title: 'Interações relógio ↔ app', symbols: 'vibrateDevice, onFindPhone, openCameraMode, closeCameraMode, onOpenCameraMode, onTakeAPicture' },
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
					condor: { type: 'string', description: 'onde e quando o Condor chama/escuta (arquivo:linha), argumentos exatos e shape, o que espera de volta (promise, evento, timeout), em que fluxo (sync, primeiro pareamento, tela)' },
					coreAndroid: { type: 'string', description: 'o que o CRPService Android faz (arquivo:linha): mapeamento de argumentos, defaults, chamadas da SDK, eventos emitidos, bugs' },
					coreIos: { type: 'string', description: 'idem iOS' },
					frames: { type: 'string', description: 'layout byte a byte de cada frame (cmd, sub, payload, endianness, faixas), resposta esperada ou ausência dela, fonte (arquivo:linha da SDK), evidência na captura HCI (só layout e se houve resposta; sem valores pessoais), um vetor SINTÉTICO' },
					platform: { type: 'string', description: 'peças de plataforma necessárias (permissões, NotificationListener, ANCS, contatos, câmera, overlay, foreground) em Android e iOS, e o que o Core faz hoje' },
					otherFamilies: { type: 'string', description: 'como SMA/iDO fazem o equivalente no Core de produção e no Repo 1, para a API genérica' },
					p85Reachable: { type: 'string' },
					effort: { type: 'string', enum: ['XS', 'S', 'M', 'L'] },
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
Fatia "${s.title}". Símbolos: ${s.symbols}.
Para cada símbolo, levante a verdade nas fontes (não confie só no inventário da fase 0; confira e corrija). Prioridades: (1) o que o Condor realmente chama e espera, porque na fase 4 o Condor vai trocar o Core pela SDK nova com o mínimo de mudança; (2) os bytes exatos que o relógio recebe e se responde (SDK + captura HCI); (3) o que precisa de plataforma em Android e iOS; (4) como ficaria genérico entre famílias. Cite arquivo:linha em tudo. Registre bugs do Core de produção que NÃO devem ser copiados. Se um símbolo depende de algo fora da fatia (ex.: permissão, serviço de notificação, evento global), diga em crossCutting.`, { label: 'pesquisa:' + s.key, phase: 'Pesquisa', schema: RESEARCH })))
const found = research.map((r, i) => ({ slice: SLICES[i].key, result: r }))
log(`pesquisa: ${found.filter(f => f.result).length}/${SLICES.length} fatias`)

const SPEC = {
	type: 'object',
	properties: {
		cutLine: { type: 'string', description: 'o que entra na fase 2 vs o que vira stub/pós-prazo, e por quê' },
		decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, decision: { type: 'string' }, rationale: { type: 'string' } }, required: ['id', 'decision', 'rationale'] } },
		commands: { type: 'array', items: { type: 'object', properties: { symbol: { type: 'string' }, frames: { type: 'string' }, response: { type: 'string' }, vector: { type: 'string' }, source: { type: 'string' } }, required: ['symbol', 'frames', 'response', 'vector', 'source'] } },
		api: { type: 'string', description: 'mudanças por camada: domain, DeviceDriver, SessionEngine/WatchSession, CoreBridge/CoreHost/HostErrorCodes, spec JS (nomes e argumentos compatíveis com o Core para o Condor), eventos, Android host, iOS host, app de exemplo' },
		platform: { type: 'string' },
		tests: { type: 'string' },
		docs: { type: 'string' },
		workSlices: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, repo: { type: 'string' }, scope: { type: 'string' }, files: { type: 'string' }, dependsOn: { type: 'string' } }, required: ['id', 'repo', 'scope', 'files', 'dependsOn'] } },
		validationChecklist: { type: 'array', items: { type: 'string' } },
		risks: { type: 'array', items: { type: 'string' } },
		userQuestions: { type: 'array', items: { type: 'string' } },
	},
	required: ['cutLine', 'decisions', 'commands', 'api', 'platform', 'tests', 'docs', 'workSlices', 'validationChecklist', 'risks', 'userQuestions'],
}

phase('Especificação')
const spec = await agent(`${RULES}
Pesquisa das 4 fatias: ${JSON.stringify(found)}
Você é o arquiteto da fase 2. Monte a especificação de implementação, seguindo a arquitetura e as convenções dos dois repos (leia-as). Regras de desenho:
- API genérica entre famílias; SMA/iDO respondem "não suportado" onde não implementarem (sem quebrar os testes deles).
- Nomes e argumentos do JS compatíveis com o que o Condor chama no Core (para a fase 4), com tipos explícitos; o que for só do Condor fica no JS (adaptadores), não no protocolo.
- Não copiar bugs do Core de produção; registrar a diferença.
- Respeitar o prazo: proponha a linha de corte (o que é essencial para o Condor funcionar na fase 4 vs stub documentado), e quebre a implementação em fatias paralelizáveis com arquivos e dependências claras (Repo 1 protocolo, Repo 1 sessão/bridge, Repo 2 Android, Repo 2 iOS, Repo 2 JS/exemplo/docs).
- Testes: vetores dourados sintéticos por comando, testes de sessão com o CrpWatchSimulator, testes de bridge, testes de host quando houver plataforma; e roteiro de validação do usuário no Android e no iPhone (o que ele vê no relógio para cada ajuste).
- Perguntas ao usuário só para decisões que são dele (produto/escopo), não para fatos verificáveis.`, { label: 'arquiteto', phase: 'Especificação', schema: SPEC })

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
	{ key: 'protocolo', prompt: 'Lente protocolo: tente REFUTAR cada frame, vetor, resposta esperada e fonte da spec contra a SDK decompilada, o header iOS e a captura HCI (layout). Procure byte errado, endianness, faixa, sub-comando, resposta que não existe, ordem/atraso exigido pela SDK, e comandos que o P85 não aceita.' },
	{ key: 'encaixe', prompt: 'Lente encaixe: tente REFUTAR que o Condor funcionaria na fase 4 com esta API (nomes, argumentos, eventos, promises, timeouts que o Condor espera, fluxo de sync que chama vários ajustes em sequência), que Android e iOS conseguem fazer o que a spec pede (permissões, NotificationListener, ANCS, contatos, overlay, câmera), que SMA/iDO não quebram, e que a linha de corte e as fatias cabem no prazo. Aponte dependências escondidas entre fatias.' },
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

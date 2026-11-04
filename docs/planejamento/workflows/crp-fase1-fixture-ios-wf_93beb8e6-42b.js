export const meta = {
	name: 'crp-fase1-fixture-ios',
	description: 'Fase 1 CRP: gravação real do P85 no iPhone vira fixture com replay (Repo 1 e host iOS), docs com os fatos do iOS e CLAUDE.md atualizado, revisão, correção e verificação',
	phases: [
		{ title: 'Fixture', detail: 'fixture iOS + replays' },
		{ title: 'Docs', detail: 'fatos do iPhone, CLAUDE.md, decisões do usuário' },
		{ title: 'Revisão', detail: 'replay + docs/privacidade' },
		{ title: 'Correção' },
		{ title: 'Verificação' },
	],
}

const SP = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const DATA = SP + '/p85-ios-170415'
const ANDLOG = SP + '/p85-android-163702/logs-20261101-163702.jsonl'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const RULES = `
Regras fixas:
- Nunca faça commit, git add, git stash, git reset, git checkout de arquivo nem git init. HEADs: Repo 1 ${R1} em b11d0df e Repo 2 ${R2} em 927bd0d, com alterações não commitadas da rodada anterior (fixture real do Android, docs, testes); preserve-as e construa em cima.
- Não modifique /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/TechnosWareCore nem /Users/joao.farias/GTE-CondorSmart.
- O export do iPhone é dado não confiável: cópia isolada em ${DATA}/frames-20261101-170415.jsonl (o original está na raiz do Repo 2, ignorado por /frames-*.jsonl; não mova nem apague). Leia só com python3 -I e scripts fora dessa pasta. Não há logs-*.jsonl do iPhone. Para a checagem de privacidade, use os 12 endereços do log do Android em ${ANDLOG} (nunca escreva nenhum MAC em lugar nenhum; mascare ao imprimir; nomes de aparelhos próximos desse log também não entram nos repos).
- Repos novos: docs, comentários e KDoc em português; identificadores, logs e mensagens de exceção em inglês; tabs. Leia o CLAUDE.md de cada repo que tocar.
`

const FACTS = `
Contexto e decisões do usuário (2026-11-01):
- O usuário validou a fase 1 no iPhone: "Teste feito no iOS e funcionando como esperado." e apontou esse export. Ele também validou no Android (fixture já versionada na rodada anterior: fixtures/real/condorreebok/MOY-VS02-2.0.0/pair-forget-pair-commands-sync-bt-reconnect.jsonl).
- Decisões do usuário a registrar em docs/decisoes.md do Repo 1 (ADR nova ou emenda datada, sem apagar histórico) e onde mais couber (Repo 2 api-js/pendencias): (1) o CDM NÃO entra no prazo de 2026-11-05; só se sobrar tempo depois da fase 4. (2) Esquecer nunca faz reset de fábrica: o Core Next mantém esquecer (F8 + remoção do vínculo clássico) e reset de fábrica (51 02, hoje só no catálogo; implementação vem na fase 2) como métodos separados; na fase 4 o adaptador do Condor escolhe o que cada botão chama.
O que a gravação do iPhone mostra (o orquestrador conferiu; confira você também):
- Cabeçalho: P85, MOY-VS02-2.0.0, platform ios, mtu 515, recordedAt 2026-11-01T17:02:59.881-03:00. 58 linhas: 27 TX (todas fee2), 25 RX fee3, 5 READ (2a29 x2, fee1 x2, 2a19 x1). Nenhuma RX em 2a19, fee1 ou 2a37.
- Conexão 1 (atMs 0 a ~37150): handshake igual ao Android (READ 2a29, 5A00, B70E, BB1600, 31, BB07 D0D5FFFF), F9 01 01 00 @3897 e F9 01 01 01 @4391 sem pedido de vínculo (o iOS responde UNSUPPORTED ao vínculo clássico; o P85 já estava pareado em Ajustes > Bluetooth, e o usuário disse que funcionou como esperado), 5A01 duas vezes (botão Ler), F9 02 00 @9385 e @12850, depois F9 02 01 (@13482, @17845, @32154, @37150), READ 2a19 = 2B, Set time, duas leituras de passos (FEE1 + 59 00..03 + 33 01), a segunda seguida de sono (32, 33 03, 33 04 com eco vazio). 59 01 traz o índice 9 (16:30) = 0x15 (21): a meia hora que estava aberta na gravação do Android aparece com o valor do FEE1 depois de fechar. 33 01 = 77 / 63 m / 4 kcal de novo.
- Conexão 2 (atMs 70767 a 71856): reconexão (READ 2a29, 5A00, B70E, BB1600, 31, BB07); a gravação termina logo depois. Nenhum F8 (esquecer não foi gravado no iPhone).
- Sem notificações espontâneas no iPhone: a rodada do Android mostrou que o 2A19 vem de um temporizador livre do relógio de ~60 s (10,3 s + n x 60 s), então a janela de ~37 s da conexão 1 pode simplesmente não ter pegado um tique; o 2A37 só veio no Android na conexão com vínculo criado. Ou seja: inconclusivo, não é falha confirmada. O orquestrador pediu ao usuário um teste rápido (andar ~20 passos com o app aberto e esperar 2 min pela bateria) ou o logs do iPhone. Registre como pendência aberta, sem afirmar defeito.
Decisão pendente com o usuário (não decida): a fixture do Android tem 10 leituras de 2A37 (frequência cardíaca com horário). O orquestrador vai recomendar manter (não identifica a pessoa, e a fase 3 vai precisar de 2A37 real). Não remova nem edite a fixture do Android; só deixe a pendência registrada onde já estiver.
`

phase('Fixture')
const fixture = await agent(`${RULES}
${FACTS}
Tarefa: versionar a gravação do iPhone como fixture real e fazê-la passar nos replays, do mesmo jeito que a do Android foi feita na rodada anterior (leia o diff atual de CrpRealFixturesReplayTest.kt, CrpReplay.kt, fixtures/README.md, docs/fixtures.md e, no Repo 2, ios/Tests/TechnosCoreNextTests/CoreBridgeReplayTests.swift e TestSupport.swift).
1. Confira de novo a privacidade da cópia isolada (12 endereços do log Android em texto e bytes nas duas ordens; nenhum texto com cara de MAC; cabeçalho sem endereço; nenhum UUID de periférico). Depois copie (cp, sem editar) para ${R1}/fixtures/real/condorreebok/MOY-VS02-2.0.0/ios-<cenario>.jsonl, nome kebab-case no padrão dos ios-* existentes (ex.: ios-pair-commands-sync-reconnect.jsonl). Confira o sha1 igual ao original.
2. Rode o replay real do CRP no Repo 1. Corrija o kit (testKit) se a gravação iOS expuser limitação (mtu 515 e o byte b2, F9 02 00, duas leituras de passos, reconexão no fim, ausência de notificações). Só mude driver/sessão se a gravação provar um bug, com teste que falha sem a correção.
3. Teste nomeado para a gravação iOS que afirma o que ela prova, sem depender do fuso/relógio da máquina: TX/READ casados, firmware, bateria 43 por leitura, 2026-10-31 = 77 passos / 63 m / 4 kcal com 15:30 = 77, 2026-11-01 16:30 = 21 vindo do 59 01 (meia hora fechada), sono sem sessões sem timeout, reconexão terminando READY.
4. Repo 2: se os testes de replay do host iOS listam gravações reais explicitamente, acrescente esta do mesmo jeito (como os ios-* do fitGPS/Life Ultra) e rode xcodebuild test -scheme TechnosCoreNext no simulador. Atualize ios/Tests/README.md e fixtures/README.md conforme a convenção.
5. Rode ./gradlew check no Repo 1 e os testes iOS do Repo 2. Não edite docs/ (outro agente faz). Retorne o que mudou, linhas REPLAY, testes com contagens e fatos novos.`, {
	label: 'fixture-ios',
	phase: 'Fixture',
	schema: {
		type: 'object',
		properties: {
			fixturePath: { type: 'string' },
			replayLines: { type: 'array', items: { type: 'string' } },
			filesChanged: { type: 'array', items: { type: 'string' } },
			driverBugs: { type: 'array', items: { type: 'string' } },
			testsRun: { type: 'array', items: { type: 'string' } },
			newFacts: { type: 'array', items: { type: 'string' } },
			notes: { type: 'array', items: { type: 'string' } },
		},
		required: ['fixturePath', 'replayLines', 'filesChanged', 'driverBugs', 'testsRun', 'newFacts', 'notes'],
	},
})

phase('Docs')
const docs = await agent(`${RULES}
${FACTS}
Retorno da fixture iOS: ${JSON.stringify(fixture)}
Tarefa: atualizar os docs dos dois repos com o que a gravação do iPhone prova e com as duas decisões do usuário, seguindo a convenção de citação (caminho da fixture + atMs) e separando confirmado de hipótese. Arquivos prováveis: Repo 1 docs/protocolo-crp.md, docs/decisoes.md, docs/pendencias.md, docs/fixtures.md, docs/glossario.md, README.md, CLAUDE.md; Repo 2 docs/ios-pendente.md, docs/pendencias.md, docs/api-js.md, README.md e CLAUDE.md (as linhas 22-23 ainda dizem que o Condor Reebok não rodou com o relógio: corrija para o estado atual, validado no Android e no iPhone em 2026-11-01).
Pontos: validação do iPhone (o que foi coberto e o que não: esquecer/F8 no iPhone, perda de alcance, carregador, noite de sono, notificações espontâneas); MTU 515 no iOS vs 517 no Android e o efeito no byte b2/bloco; F9 01 01 xx chegando sem pedido de vínculo quando o P85 já está pareado no sistema (reforça que F9 01 acompanha o link clássico, ainda hipótese) e F9 02 00 antes de F9 02 01; meia hora corrente que aparece no 0x59 depois de fechar (16:30 = 21); ausência de 2A19/2A37/FEE1 no iPhone registrada como inconclusiva (temporizador livre de ~60 s) com o teste pedido ao usuário; as duas decisões do usuário (CDM fora do prazo; esquecer e reset de fábrica separados, reset na fase 2). Não mexa em código nem testes. Retorne arquivos e resumo.`, {
	label: 'docs-ios',
	phase: 'Docs',
	schema: { type: 'object', properties: { filesChanged: { type: 'array', items: { type: 'string' } }, summary: { type: 'array', items: { type: 'string' } }, stillOpen: { type: 'array', items: { type: 'string' } } }, required: ['filesChanged', 'summary', 'stillOpen'] },
})

phase('Revisão')
const FINDINGS = {
	type: 'object',
	properties: {
		findings: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, severity: { type: 'string', enum: ['alta', 'media', 'baixa'] }, file: { type: 'string' }, issue: { type: 'string' }, evidence: { type: 'string' }, suggestion: { type: 'string' } }, required: ['id', 'severity', 'file', 'issue', 'evidence', 'suggestion'] } },
		summary: { type: 'string' },
	},
	required: ['findings', 'summary'],
}
const LENSES = [
	{ key: 'replay', prompt: 'Lente replay: o teste da gravação iOS afirma o que ela prova, não passa em vazio, não depende de fuso/relógio da máquina, e as mudanças no kit não enfraquecem os outros replays (Android CRP, sintético CRP, fitGPS, Life Ultra). Rode o que precisar sem alterar arquivos.' },
	{ key: 'docs-privacidade', prompt: 'Lente docs e privacidade: cada afirmação nova bate com a gravação (python3 -I sobre a cópia isolada), confirmado vs hipótese está certo, os dois repos estão consistentes entre si e com o código, as decisões do usuário estão registradas como ele disse, e nenhum MAC/nome de aparelho/dado pessoal entrou nos repos.' },
]
const reviews = await parallel(LENSES.map(l => () => agent(`${RULES}
${FACTS}
Retorno da fixture: ${JSON.stringify(fixture)}
Retorno dos docs: ${JSON.stringify(docs)}
Revisor SÓ LEITURA (não edite nada). ${l.prompt} Cada achado com evidência concreta; sem estilo.`, { label: 'revisao:' + l.key, phase: 'Revisão', schema: FINDINGS })))
const findings = reviews.filter(Boolean).flatMap((r, i) => r.findings.map(f => ({ ...f, id: LENSES[i].key + '-' + f.id })))
log(`${findings.length} achados`)

phase('Correção')
let fix = { fixed: [], rejected: [], deferred: [], testsRun: [] }
if (findings.length) {
	fix = await agent(`${RULES}
${FACTS}
Achados: ${JSON.stringify(findings)}
Confirme cada um nas fontes; corrija os reais do menor jeito correto; rejeite os errados com evidência; adie só decisão do usuário. Rode os testes afetados. Retorne fixed/rejected/deferred e testsRun.`, {
		label: 'correcao',
		phase: 'Correção',
		schema: {
			type: 'object',
			properties: {
				fixed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' } }, required: ['id', 'what'] } },
				rejected: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] } },
				deferred: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] } },
				testsRun: { type: 'array', items: { type: 'string' } },
			},
			required: ['fixed', 'rejected', 'deferred', 'testsRun'],
		},
	})
}

phase('Verificação')
const verify = await agent(`${RULES}
Verificação final do zero. (1) Repo 1: ./gradlew check dokkaHtml --rerun-tasks --continue; contagens por target e as linhas REPLAY do CRP (Android e iOS reais, sintético) e GOLDEN. (2) Repo 2: xcodebuild test -scheme TechnosCoreNext no simulador (o diff toca testes iOS); se o diff tocar Android/JS, rode também os testes deles. (3) Privacidade com scripts seus: 12 endereços do ${ANDLOG} (texto e bytes nas duas ordens) e os nomes de aparelhos próximos desse log em todos os arquivos versionáveis dos dois repos; nenhum logs-*, btsnoop ou corenext-export rastreado ou fora do .gitignore; originais frames/logs na raiz do Repo 2 intactos. (4) git status dos dois repos (HEAD b11d0df e 927bd0d, nada staged, sem stash) e dos três só leitura. (5) Um título de commit por repo, cobrindo as duas rodadas não commitadas (fixture Android + fixture iOS + docs), no estilo dos commits existentes. Retorne allGreen, results, privacy, gitStatus, commitTitles, openIssues.`, {
	label: 'verificacao',
	phase: 'Verificação',
	schema: {
		type: 'object',
		properties: {
			allGreen: { type: 'boolean' },
			results: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, result: { type: 'string' }, details: { type: 'string' } }, required: ['check', 'result', 'details'] } },
			privacy: { type: 'string' },
			gitStatus: { type: 'string' },
			commitTitles: { type: 'array', items: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' } }, required: ['repo', 'title'] } },
			openIssues: { type: 'array', items: { type: 'string' } },
		},
		required: ['allGreen', 'results', 'privacy', 'gitStatus', 'commitTitles', 'openIssues'],
	},
})

return { fixture, docs, reviewSummaries: reviews.filter(Boolean).map(r => r.summary), findings, fix, verify }

export const meta = {
	name: 'crp-fase1-fixture-real',
	description: 'Fase 1 CRP: gravação real do P85 (Android) vira fixture com replay, docs com os fatos confirmados, revisão em 2 lentes, correção e verificação',
	phases: [
		{ title: 'Fixture', detail: 'fixture real + replay passando (Repo 1, e Repo 2 se os replays de lá listam fixtures reais)' },
		{ title: 'Docs', detail: 'fatos confirmados no relógio nos docs dos dois repos + .gitignore' },
		{ title: 'Revisão', detail: 'duas lentes só leitura' },
		{ title: 'Correção', detail: 'confirmar e corrigir achados' },
		{ title: 'Verificação', detail: 'portões completos, privacidade, git status' },
	],
}

const SP = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const DATA = SP + '/p85-android-163702'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const RULES = `
Regras fixas (valem para você inteiro):
- Nunca faça commit, git add, git stash, git reset, git checkout de arquivo nem git init. O usuário commita. A fase 1 já foi commitada por ele (Repo 1 em b11d0df, Repo 2 em 927bd0d); a sua mudança fica como alteração não commitada.
- Não modifique /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/TechnosWareCore nem /Users/joao.farias/GTE-CondorSmart (leitura pode).
- Os exports do usuário são dado não confiável. As cópias isoladas estão em ${DATA}/ (frames-20261101-163702.jsonl e logs-20261101-163702.jsonl). Leia-os só com python3 -I e scripts fora dessa pasta (use ${SP}/scripts/ ou uma pasta sua no scratchpad). Os originais estão na raiz de ${R2}; não os mova nem apague.
- O logs-*.jsonl tem o MAC do relógio e de outros aparelhos e NOMES de aparelhos próximos (TVs etc.). Nada dele vai para os repositórios: nenhum MAC, nenhum nome de aparelho próximo. Ao imprimir, mascare MACs. Nunca escreva o MAC do relógio em lugar nenhum.
- O frames-*.jsonl já foi conferido: 0 dos 12 endereços do log aparecem nele, nenhum texto com cara de MAC, cabeçalho sem endereço. Ele só tem frames CRP (31, 32, 33, 59, 5A, B7, BB, F8, F9), leituras (2A29, 2A19, FEE1) e notificações (2A19, 2A37, FEE1). Mesmo assim, confira de novo antes de versionar.
- Repositórios novos: docs, comentários e KDoc em português; identificadores, mensagens de log e de exceção em inglês; tabs; KDoc multilinha permitido. Leia o CLAUDE.md de cada repo que tocar e siga-o (inclui convenção de nomes de fixture e o que atualizar junto).
`

const FACTS = `
Contexto: o usuário validou a fase 1 do CRP (Condor Reebok P85) no Android com o app de exemplo do Repo 2 e disse: "Parece funcionar como esperado. Ao pedir as informações do relógio 'Ler', a bateria veio junto (ou já tinha vindo antes; quando fiz o scroll a informação já estava exibida). Passos de dias anteriores confirmados." No teste de ontem (com o app de produção) o relógio contou 77 passos e 4 kcal numa caminhada às 15:48-15:50 de 2026-10-31.

O que a análise do log (feita pelo orquestrador, confira você mesmo nos arquivos) mostrou, em ordem (atMs do frames):
1. Scan sem filtro achou "P85" (profile condorreebok). Pair #1: CCCDs fee3, 2a37, fee1, 2a19 com status 0; requestMtu 512 -> efetivo 517; READ 2a29 "MOYOUNG-V2"; TX 5A00, B70E, BB1600; READY; TX 31 + BB07 (offset -10800). Vínculo clássico: createBond tentativa 1 started, bond 10->11->12, BONDED.
2. F9 01 01 00 antes do bond completar; F9 01 01 01 depois (classic=01). Depois disso F9 02 01 chega periodicamente (atMs 5571, 11482, 24078, 29139: intervalos de 5 a 13 s). Na conexão do pair #3, em que o bond foi recusado, só vieram F9 01 01 00 (duas vezes) e nenhum F9 02. Hipótese: F9 02 01 só aparece com o link clássico ativo; significado ainda desconhecido.
3. 2A19 notifica 0x2B (43%, charging=false) por conta própria a cada ~60 s; a sessão emite onBatteryStatus sem pedido. É por isso que a bateria "já estava lá". No exemplo, o botão "Ler" do card de informações chama getDeviceInfo e getFirmwareInfo (example/src/screens/ConnectionScreen.tsx:43-44), e cada um manda 5A 01 (dois 5A 01 seguidos no log); a bateria tem botão próprio (readBattery #6 logo depois). A regra "> 100 = carregando" continua não confirmada (não houve teste no carregador).
4. 2A37 notifica FC (82..78 bpm) a cada ~1 s depois do bond.
5. Forget: TX F8, removeBond returned true (bond state era 12), DISCONNECTED.
6. Pair #3 (C4, recusando o diálogo): tentativa 1 bond 10->11->10 reason=1, nova tentativa depois de 1500 ms, de novo 11->10 reason=1 -> FAILED, onError CLASSIC_BOND_FAILED, estado continuou READY. Depois disso os comandos funcionaram.
7. Ler: 5A01 -> "MOY-VS02-2.0.0" (duas vezes). Battery READ 2B. Set time manual (#7).
8. FEE1 em rajada (passos 16..21, 13..17 m, 1 kcal) sem meias horas lidas na conexão -> um único pedido de refresh (o hold do achado P1 funcionou). Depois: refresh interno, refreshSteps #8 (botão) e syncHistory #9 leem cada um FEE1 + 59 00..03 + 33 01.
9. 59 00/01 (hoje) vieram todas zero, porque os 21 passos de hoje estão na meia hora corrente ainda aberta; 59 03 traz 0x4D (77) no índice 7 = 15:30 de ontem, que bate com a caminhada.
10. 33 01 RESPONDEU no P85: FEEA200F 33 01 4D0000 3F0000 040000 -> ontem 77 passos, 63 m, 4 kcal (bate com o relógio). O log decodificou isso como "yesterday totals". Isso fecha a dúvida "o P85 responde ao 0x33?": responde ao 33 01 (formato legado), e não veio B6.
11. Sono: TX 32 -> RX FEEA200532 (eco sem registros); TX 33 03 -> RX FEEA20063303 (eco sem registros); TX 33 04 -> RX FEEA20063304. Ou seja, o P85 responde aos comandos legados de sono com eco vazio quando não há noite; nenhum timeout. readSleep: 0 sessões (não houve noite com o relógio ainda).
12. deletedSavedData kind=STEPS dayKeys=[2026-10-31] (o exemplo confirmou o dia).
13. Bluetooth desligado: READY -> BLUETOOTH_OFF; religado: RECONNECTING, openGatt autoConnect=true, CONFIGURING, HANDSHAKING [VERSION] (RECONNECT), READY, setTime automático. Como o bond tinha sido recusado no pair #3, nenhuma tentativa de vínculo nova (correto).
Não testado nesta gravação: carregador, sair do alcance, esquecer com o Bluetooth desligado, passos ao vivo depois de as meias horas estarem lidas (não vieram mais FEE1 depois do refresh), uma noite de sono, iPhone.
`

phase('Fixture')
const fixture = await agent(`${RULES}
${FACTS}
Tarefa (Repo 1 ${R1}, e Repo 2 ${R2} só se necessário): transformar a gravação real do Android na primeira fixture real do CRP e fazer o replay real passar.
1. Leia o CLAUDE.md e docs/fixtures.md do Repo 1 e o teste CrpRealFixturesReplayTest (hoje imprime "REPLAY crp: no recordings yet"), o kit de replay CRP (testKit: CrpReplay, CrpWatchSimulator, CrpTxMasker, ReplayDriver) e como os replays reais do fitGPS/Life Ultra lidam com gravações de várias conexões (pareamento, esquecer, parear de novo, Bluetooth off/on).
2. Copie (não mova) ${DATA}/frames-20261101-163702.jsonl para ${R1}/fixtures/real/condorreebok/MOY-VS02-2.0.0/<cenario>.jsonl, com nome kebab-case no padrão dos existentes (ex.: android-pair-forget-pair-commands-sync-bt-reconnect.jsonl). Confirme de novo que nenhum MAC do logs (12 endereços) aparece, em texto ou bytes nas duas ordens, antes e depois da cópia. Não edite o conteúdo da gravação (se precisar de metadados, siga a convenção do fixtures.md; não invente campos).
3. Rode o replay real. Se falhar, descubra se a causa é limitação do kit de replay (várias conexões numa gravação, READ, notificações laterais 2a19/2a37/fee1, F8 no meio, 31 com hora diferente, segunda conexão com bond recusado, reconexão) ou um bug real do driver/sessão evidenciado pela gravação. Corrija o kit/teste. Só mude driver/sessão se for bug real comprovado pela gravação; nesse caso escreva teste que falha sem a correção e descreva no retorno.
4. Faça o replay real afirmar o que a gravação prova, de forma que não dependa do relógio da máquina: TX casados (com o mascaramento do 31), estados finais, firmware MOY-VS02-2.0.0, bateria 43, total de ontem 77 passos / 63 m / 4 kcal, meia hora 15:30 de ontem com 77, sono sem sessões sem timeout, F8 enviado. Siga o estilo dos replays reais existentes (linhas REPLAY no system-out).
5. Veja se os replays do Repo 2 (Android src/test e iOS ios/Tests, ex. CoreBridgeReplayTests) listam fixtures reais explicitamente (como fazem com fitgps/lifeultragps). Se listam, inclua a nova do mesmo jeito e rode-os. Se não listam, não mexa.
6. Rode ./gradlew :protocol:allTests :bridge:allTests (ou o check completo) no Repo 1 e os testes do Repo 2 que você tocou. Se publicar artefatos for necessário para o Repo 2 enxergar algo, use publishToMavenLocal / assembleTechnosWatchProtocolXCFramework + ios/scripts/sync-xcframework.sh.
Não edite docs/ dos repos (outro agente faz isso depois com o seu retorno), exceto o README de fixtures se a convenção exigir listar a gravação nova. Retorne o que mudou, a linha REPLAY, os testes rodados com contagens, e qualquer fato novo que a gravação revelou.`, {
	label: 'fixture-real',
	phase: 'Fixture',
	schema: {
		type: 'object',
		properties: {
			fixturePath: { type: 'string' },
			replayLine: { type: 'string' },
			filesChanged: { type: 'array', items: { type: 'string' } },
			driverBugs: { type: 'array', items: { type: 'string' } },
			testsRun: { type: 'array', items: { type: 'string' } },
			newFacts: { type: 'array', items: { type: 'string' } },
			notes: { type: 'array', items: { type: 'string' } },
		},
		required: ['fixturePath', 'replayLine', 'filesChanged', 'driverBugs', 'testsRun', 'newFacts', 'notes'],
	},
})

phase('Docs')
const docs = await agent(`${RULES}
${FACTS}
Resultado do agente da fixture (já aplicado nos repos): ${JSON.stringify(fixture)}

Tarefa: registrar nos docs dos dois repos o que a gravação real do Android confirmou, com a fixture como evidência (cite o caminho da fixture e o atMs, como os docs já fazem com a captura HCI). Leia antes o CLAUDE.md de cada repo e os docs atuais: Repo 1 docs/protocolo-crp.md, docs/decisoes.md (ADRs 25-32), docs/pendencias.md (seção "Condor Reebok (CRP)"), docs/fixtures.md, docs/glossario.md; Repo 2 docs/pendencias.md (seção 7), docs/ios-pendente.md, docs/transporte-android.md, docs/api-js.md.
O que registrar (só o que a gravação prova; separe confirmado de hipótese):
- O P85 responde ao 33 01 no formato legado ([01][passos u24 LE][distância u24 LE, m][kcal u24 LE]); vetor real FEEA200F33014D00003F0000040000 = 77 / 63 m / 4 kcal; não veio B6. Atualize a ADR/seção que tratava o 33 01 como sondagem incerta (sem apagar o histórico da decisão: acrescente o resultado com data 2026-11-01).
- 32, 33 03 e 33 04 respondem com eco sem registros quando não há noite (vetores reais); sem timeout. Noite real ainda pendente.
- F9 01 01 xx = estado do link clássico (00 antes do bond, 01 depois); F9 02 01 periódico só com o link clássico ativo (intervalos observados), significado desconhecido.
- MTU pedido 512, efetivo 517; CCCDs de fee3/2a37/fee1/2a19 com status 0 no Android; 2A19 notifica a cada ~60 s (0x2B = 43%); 2A37 a cada ~1 s depois do bond.
- Vínculo clássico no Android: aceitar = BONDED na tentativa 1; recusar = reason=1 nas duas tentativas -> CLASSIC_BOND_FAILED com estado READY; esquecer = F8 + removeBond true; reconexão depois de Bluetooth off/on sem novo pedido de vínculo quando recusado.
- Passos: meias horas de hoje zeradas enquanto a meia hora corrente está aberta (o total vem do FEE1); 59 03 índice 7 = 15:30 de ontem com 77.
- Itens das pendências que ficam fechados e os que continuam abertos (carregador, sair do alcance, esquecer com Bluetooth desligado, passos ao vivo depois de as meias horas estarem lidas, noite de sono, iPhone inteiro). Marque com data 2026-11-01.
- Repo 2: em example/src/screens/ConnectionScreen.tsx o "Ler" chama getDeviceInfo e getFirmwareInfo, que mandam 5A 01 duas vezes; registre como observação (não mude o app) e explique na doc de api-js (ou onde couber) que onBatteryStatus chega sozinho a cada ~60 s no CRP.
- Repo 2 .gitignore: o export do exemplo foi parar na raiz (frames-*.jsonl não é ignorado; logs-*.jsonl é). Adicione /frames-*.jsonl com um comentário de uma linha em português dizendo que o frames da raiz é revisado e copiado para o Repo 1 como fixture. Confirme com git check-ignore.
Não mexa em código nem testes. Retorne os arquivos alterados e um resumo por arquivo.`, {
	label: 'docs-confirmados',
	phase: 'Docs',
	schema: {
		type: 'object',
		properties: {
			filesChanged: { type: 'array', items: { type: 'string' } },
			summary: { type: 'array', items: { type: 'string' } },
			stillOpen: { type: 'array', items: { type: 'string' } },
		},
		required: ['filesChanged', 'summary', 'stillOpen'],
	},
})

phase('Revisão')
const FINDINGS = {
	type: 'object',
	properties: {
		findings: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					severity: { type: 'string', enum: ['alta', 'media', 'baixa'] },
					file: { type: 'string' },
					line: { type: 'string' },
					issue: { type: 'string' },
					evidence: { type: 'string' },
					suggestion: { type: 'string' },
				},
				required: ['id', 'severity', 'file', 'issue', 'evidence', 'suggestion'],
			},
		},
		summary: { type: 'string' },
	},
	required: ['findings', 'summary'],
}
const changed = JSON.stringify({ fixture: fixture && fixture.filesChanged, docs: docs && docs.filesChanged })
const LENSES = [
	{ key: 'replay', prompt: `Lente: o replay real e o kit de teste. Leia o diff (git diff e arquivos novos) do Repo 1 e do Repo 2. Confira que o teste realmente afirma o que a gravação prova (não passa em vazio, não regenera nada, não depende do fuso/relógio da máquina, roda nos 4 targets se os outros replays rodam), que mudanças no kit não enfraquecem os replays existentes (fitGPS, Life Ultra, sintético CRP), e que qualquer mudança em driver/sessão é justificada pela gravação e testada. Rode os testes que precisar (sem alterar arquivos). Cada achado com evidência concreta (arquivo:linha, saída de teste).` },
	{ key: 'docs-privacidade', prompt: `Lente: docs e privacidade. Confira cada afirmação nova dos docs contra ${DATA}/frames-20261101-163702.jsonl e o logs (python3 -I, scripts fora da pasta), a convenção de citação dos docs, a separação confirmado/hipótese, consistência entre os dois repos e com o código (nomes de métodos, constantes). Privacidade: varra o diff e os arquivos novos dos dois repos atrás dos 12 endereços do logs (texto e bytes, nas duas ordens), dos nomes de aparelhos próximos que aparecem no logs e de qualquer outro dado pessoal. Confira que o .gitignore novo funciona e que os originais na raiz do Repo 2 continuam lá. Cada achado com evidência concreta.` },
]
const reviews = await parallel(LENSES.map(l => () => agent(`${RULES}
${FACTS}
Arquivos alterados nesta rodada: ${changed}
Retorno da fixture: ${JSON.stringify(fixture)}
Retorno dos docs: ${JSON.stringify(docs)}
Você é revisor SÓ LEITURA: não edite nada nos repositórios. ${l.prompt} Não reporte estilo sem efeito; reporte o que está errado, falta ou contradiz a gravação.`, { label: 'revisao:' + l.key, phase: 'Revisão', schema: FINDINGS })))
const findings = reviews.filter(Boolean).flatMap((r, i) => r.findings.map(f => ({ ...f, id: LENSES[i].key + '-' + f.id })))
log(`${findings.length} achados nas revisões`)

phase('Correção')
let fix = { fixed: [], rejected: [], deferred: [], testsRun: [] }
if (findings.length) {
	fix = await agent(`${RULES}
${FACTS}
Achados das revisões: ${JSON.stringify(findings)}
Para cada achado: confirme lendo o código/doc/gravação. Se for real, corrija (código, teste ou doc) do menor jeito correto; se não for, rejeite com a evidência. Adie só o que depender de decisão do usuário, explicando por quê. Depois rode os testes afetados nos dois repos (Repo 1: ./gradlew check se tocou Kotlin; Repo 2: os testes do que tocou). Retorne fixed/rejected/deferred com o que foi feito e testsRun com comando e resultado.`, {
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
Verificação final, do zero, sem confiar nos retornos anteriores. Repo 1 ${R1} e Repo 2 ${R2}.
1. Repo 1: ./gradlew check dokkaHtml --rerun-tasks --continue. Reporte contagens por target de :protocol e :bridge e as linhas REPLAY (em especial a do CRP real, que antes dizia "no recordings yet") e GOLDEN.
2. Repo 2: se git diff do Repo 2 tocar código ou testes, rode os testes correspondentes (Android: cd example/android && ./gradlew :react-native-technos-core-next:testDebugUnitTest; iOS: cd ios && xcodebuild test -scheme TechnosCoreNext -destination 'platform=iOS Simulator,name=<um iPhone disponível>'; JS: cd example && npm test -- --ci && npx tsc --noEmit). Se só tocou docs/.gitignore, diga isso e rode só o git check-ignore do frames da raiz.
3. Privacidade: com scripts seus, do zero, procure os 12 endereços do ${DATA}/logs-20261101-163702.jsonl (texto e bytes nas duas ordens) e os nomes de aparelhos próximos do logs em todos os arquivos versionáveis (git ls-files + não rastreados não ignorados) dos dois repos. Confirme que nenhum logs-*.jsonl, btsnoop ou corenext-export está rastreado ou não ignorado, e que os originais frames/logs continuam na raiz do Repo 2.
4. git status dos dois repos (HEAD esperado: b11d0df e 927bd0d, nada staged, sem stash) e dos três repositórios só leitura (sem mudanças).
5. Sugira um título de commit por repo (só título, em português, no estilo "feat:/test:/docs: ..." dos commits existentes).
Retorne allGreen, resultados por checagem, privacidade, gitStatus, commitTitles e openIssues.`, {
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

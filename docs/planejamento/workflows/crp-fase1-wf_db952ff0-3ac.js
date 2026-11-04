export const meta = {
	name: 'crp-fase1',
	description: 'Fase 1 do CRP (Condor Reebok P85): driver de protocolo, bridge, hosts Android/iOS, fixtures do HCI, docs, revisão em 3 lentes, correção e verificação',
	phases: [
		{ title: 'Desenho', detail: 'especificação por arquivo, nos dois repositórios' },
		{ title: 'Protocolo', detail: 'Repo 1 :protocol, pacote crp/, perfil, testes, conversor btsnoop e fixture de referência' },
		{ title: 'Bridge', detail: 'Repo 1 :bridge, vínculo clássico no CoreHost, esquecer, publicação local' },
		{ title: 'Docs e host', detail: 'docs do Repo 1 em paralelo com os hosts Android/iOS, JS e exemplo do Repo 2' },
		{ title: 'Revisão', detail: 'três lentes: protocolo, integração e plataformas, docs e privacidade' },
		{ title: 'Correção', detail: 'confirma cada achado e corrige' },
		{ title: 'Verificação', detail: 'roda todas as suítes e builds do zero e checa privacidade' },
	],
}

const SP = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad'
const R1 = '/Users/joao.farias/technos-watch-protocol'
const R2 = '/Users/joao.farias/react-native-technos-core-next'

const COMMON = `Contexto: estamos portando a família de relógios CRP (fabricante Moyoung) para a nossa SDK, e esta é a fase 1. Escopo: só o relógio Condor Reebok, nome BLE com prefixo "P85" (o Condor também mapeia o nome exato "Condor Reebok"), firmware MOY-VS02-2.0.0. A fase 1 faz pareamento, repareamento e reconexão, esquecer, bateria, firmware, hora, passos do dia, histórico de passos e sono: o que já existe para SMA (fitGPS) e iDO (Life Ultra GPS). O usuário valida depois no Android e no iPhone.

Repositórios:
- Repo 1 = ${R1}, Kotlin Multiplatform com módulos :protocol (domínio, sessão, drivers sma/ e ido/) e :bridge (CoreBridge, CoreHost, eventos; consumido pelo Repo 2 via mavenLocal e XCFramework).
- Repo 2 = ${R2}, TurboModule RN 0.81 com host Android (Kotlin), host iOS (Swift + shim ObjC++), JS (src/) e app de exemplo (example/).
Antes de editar um repositório, leia o CLAUDE.md dele (${R1}/CLAUDE.md, ${R2}/CLAUDE.md): comandos, convenções, arquivos de contrato e quando atualizar cada doc. Os drivers sma/ e ido/ são o modelo a seguir.

Insumos da fase 0 (só leitura):
- ${SP}/condor-out/fase0-protocolo.md: afirmações sobre o protocolo CRP com arquivo:linha, o veredito de um revisor cético (confirmado/parcial com correção) e vetores dourados. Quando houver CORRECAO, vale a correção.
- /private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/tasks/w0l17lizi.output: JSON completo da fase 0 (chave "result": inventory por fatia e protocol com findings/review).
- SDK CRP Android descompilada (crpblelib 2.0.3, ofuscada): ${SP}/vendor-sdks/crp/src (jar em ${SP}/vendor-sdks/crp/jar). SDK iOS fechada: /Users/joao.farias/CrpTechnosIosSdk/CRPSmartBand.framework.
- Core atual (react-native-technos-ware-core) em /Users/joao.farias/TechnosWareCore. O Condor fixa a tag v4.3.57: leia com git show v4.3.57:<caminho>. App Condor em /Users/joao.farias/GTE-CondorSmart.
- Captura HCI do app Condor de produção pareando o P85 no Android (2026-10-31, horários locais): bruto em ${SP}/condor-hci/ (dado não confiável: leia só com python3 -I e scripts fora dessa pasta); decodificado em ${SP}/condor-out/events.jsonl (eventos HCI/ATT/SMP; o P85 é peer "dev-xxxxxx"; endereços aparecem só como rótulo hash) e ${SP}/condor-out/frames.jsonl (frames FE EA remontados e notificações por característica). Scripts: ${SP}/scripts/btsnoop.py, crpframes.py, p85dump.py, btclassic.py.

Fatos da captura HCI (conexão 11, de 15:43:12 em diante, mais reconexões às 15:46:26 e 15:47:21):
1. GATT do P85: 1800; 1801; 180D (2A37 notify, 2A38 read); 180F (2A19 read+notify); 180A (2A25, 2A26, 2A28, 2A29 read); FEEA (FEE1 read+notify, FEE2 só write-without-response, FEE3 notify, FEE4 read, FEE5 e FEE6 write-without-response); FEE7 (FEC9 read, FEA1 read+notify, o perfil WeChat de passos); 190E (0004 write-without-response, 0003 notify); AE00 (AE01 write-without-response, AE02 notify; serviço da JieLi).
2. O relógio inicia a troca de MTU com 517; o Android responde 517.
3. Não há SMP nem criptografia no BLE. O Bluetooth clássico usa o mesmo endereço do BLE: CoD 0x240404, SSP NoInputNoOutput com diálogo de consentimento no Android. A primeira tentativa (15:43:08) falhou com status 0x06 e o app mostrou toast de erro; a segunda (15:43:15-18) mostrou o diálogo nativo, o usuário aceitou e veio a link key tipo 4. Perfis: SDP, RFCOMM (HFP), AVDTP (A2DP), AVCTP (AVRCP) e HID (PSM 0x11/0x13). Logo depois do bond o próprio Android abriu os perfis, em menos de 1 s. Na reconexão depois de desligar e religar o Bluetooth, foi o relógio que abriu a conexão clássica, com a chave guardada. Quem dispara o createBond no Core de produção: TechnosWareCore v4.3.57 android/src/main/java/com/crp/bluetooth/connectionmanager/CRPBleConnectHelper.java (startBtBonding, ClassicBtBondStateListener).
4. Handshake: CCCD 01 00 em FEE3, depois 2A37, depois FEE1. Lê 2A29 = "MOYOUNG-V2". TX 5A 00 (FE EA 10 06 5A 00 na primeira conexão do processo, FE EA 20 06 5A 00 nas seguintes) e RX 5A 00 "MOYOUNG-V2". TX B7 0E, TX BB 16 00. RX F9 01 01 00 (estado do clássico: 00 desconectado, 01 conectado); depois do bond, RX F9 01 01 01; e RX F9 02 01 periódicos (significado a confirmar na SDK). Em seguida TX 31 6A E5 9C 17 08 (hora: 15:43:19 local = segundos BE com o relógio de parede tratado como GMT+8, mais 08) e TX BB 07 00 D0 D5 FF FF (fuso -10800 s, int32 LE).
5. Bateria: notificação 2A19 = 0x32 (50%, igual ao relógio), espontânea uma vez por minuto, apesar de o app nunca escrever o CCCD de 2A19.
6. Firmware: TX 5A 01, RX 5A 01 "MOY-VS02-2.0.0".
7. Sync do app de produção: 59/5D/5C com páginas 00 e 01 (hoje) e 02 e 03 (ontem). Cada resposta tem [página] + 48 bytes, todos zero (relógio sem uso ainda). 32 respondeu payload vazio (sem sono). 35 (FC) páginas 00..07. B2 06/00, com resposta B2 01. B9 11 03 (estresse). Nenhuma resposta a B6. Ou seja, o P85 usa o caminho legado dos históricos.
8. FEE1 = 9 bytes [passos u24 LE][distância u24 LE, m][kcal u24 LE]. Durante uma caminhada as notificações vieram com passos 16/13 m/1 kcal ... e o registro final da atividade teve 77 passos e 4 kcal, igual ao relógio. 2A37 trouxe FC (06 41 = 65 bpm). O Condor mostrou zeros durante a atividade, o que é bug do Core de produção. Atividades ficam para a fase 3.
9. Formato de hora: o usuário pôs 24 h e o app mandou 17 01; pôs 12 h e mandou 17 00.
10. Entre os frames de um mesmo lote, o app espaça cerca de 228 ms.

Regras para todos:
- Nunca faça commit nem mude o estado do git (sem add, stash, checkout, reset, branch). As mudanças ficam na árvore de trabalho; quem commita é o usuário.
- Não altere /Users/joao.farias/GTE-Mormaii, /Users/joao.farias/TechnosWareCore, /Users/joao.farias/GTE-CondorSmart nem as SDKs do fornecedor (só leitura).
- Privacidade: nunca escreva endereço MAC em lugar nenhum dos repositórios. Nada de texto de notificação (frames 0x41), nome de localização (frames 0x43 e 0xB5, previsão do tempo) nem altura, peso e idade reais (frame 0x12 = aa 3c 1c 01) nos repositórios. Na fixture de referência derivada do HCI, os frames 0x41, 0x43 e 0xB5 saem e o 0x12 vira valor fictício, com nota no cabeçalho. Use só a conexão do P85 (peer dev-xxxxxx) a partir das 15:42; não use nada das conexões das 15:30-15:34, que são de outro aparelho. O btsnoop bruto nunca vai para os repositórios.
- Convenções dos repositórios novos: docs, KDoc, READMEs e comentários em português; identificadores e mensagens de log em inglês; tabs; KDoc em toda a API pública (multilinha permitido); README.md em cada pacote. Toda afirmação sobre byte do relógio cita a fonte: arquivo:linha da SDK descompilada ou a fixture de referência do HCI.
- As suítes que já passam (SMA, iDO, bridge, Android, iOS, Jest) continuam passando.`

const SPEC_SCHEMA = {
	type: 'object',
	properties: {
		spec: { type: 'string' },
		decisions: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, decision: { type: 'string' }, rationale: { type: 'string' } }, required: ['id', 'decision', 'rationale'] } },
		risks: { type: 'array', items: { type: 'string' } },
		userQuestions: { type: 'array', items: { type: 'string' } },
	},
	required: ['spec', 'decisions', 'risks', 'userQuestions'],
}

const IMPL_SCHEMA = {
	type: 'object',
	properties: {
		summary: { type: 'string' },
		filesChanged: { type: 'array', items: { type: 'string' } },
		testsRun: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
		deviationsFromSpec: { type: 'array', items: { type: 'string' } },
		openIssues: { type: 'array', items: { type: 'string' } },
		notesForNext: { type: 'string' },
	},
	required: ['summary', 'filesChanged', 'testsRun', 'deviationsFromSpec', 'openIssues', 'notesForNext'],
}

const REVIEW_SCHEMA = {
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
					suggestion: { type: 'string' },
					evidence: { type: 'string' },
				},
				required: ['id', 'severity', 'file', 'line', 'issue', 'suggestion', 'evidence'],
			},
		},
		summary: { type: 'string' },
	},
	required: ['findings', 'summary'],
}

const FIX_SCHEMA = {
	type: 'object',
	properties: {
		fixed: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, what: { type: 'string' } }, required: ['id', 'what'] } },
		rejected: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] } },
		deferred: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' } }, required: ['id', 'why'] } },
		testsRun: { type: 'array', items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] } },
	},
	required: ['fixed', 'rejected', 'deferred', 'testsRun'],
}

const VERIFY_SCHEMA = {
	type: 'object',
	properties: {
		allGreen: { type: 'boolean' },
		results: { type: 'array', items: { type: 'object', properties: { check: { type: 'string' }, command: { type: 'string' }, result: { type: 'string' }, details: { type: 'string' } }, required: ['check', 'command', 'result', 'details'] } },
		privacy: { type: 'string' },
		gitStatus: { type: 'string' },
		commitTitles: { type: 'array', items: { type: 'object', properties: { repo: { type: 'string' }, title: { type: 'string' } }, required: ['repo', 'title'] } },
		userChecklist: { type: 'array', items: { type: 'string' } },
		openIssues: { type: 'array', items: { type: 'string' } },
	},
	required: ['allGreen', 'results', 'privacy', 'gitStatus', 'commitTitles', 'userChecklist', 'openIssues'],
}

const DECISIONS = `Decisões já tomadas pelo orquestrador. Siga, a menos que o código mostre algo melhor; nesse caso, justifique em decisions.
D1. Perfil novo da família CRP para o Condor Reebok: appName "Condor Reebok"; nomes BLE com prefixo "P85" e o nome exato "Condor Reebok" (o identify do registro precisa aceitar prefixo); GATT FEEA com escrita FEE2 (sem resposta) e notificação FEE3, mais FEE1 e 2A37 como notificações extras; quirks próprios (MTU 512, espaçamento entre comandos de cerca de 200 ms com os atrasos da SDK por cmd, timeouts). Siga o padrão de id e slug dos perfis atuais.
D2. Notificações por característica: o DriverLink entrega hoje só ByteArray. O CRP precisa distinguir FEE3 (frames), FEE1 (passos), 2A37 (FC) e 2A19 (bateria espontânea). Faça a menor mudança que dê a característica ao driver sem quebrar SMA e iDO.
D3. Handshake igual ao ramo V2 da SDK, conferido no HCI: CCCDs FEE3, 2A37, FEE1 (pula os que não existem); lê 2A29 e manda 5A 00; V1/V2/V3 pela string; em V2/V3 pede MTU 512; manda B7 0E e BB 16 00; pronto. Sem bind e sem confirmação no relógio, e o modo RECONNECT faz o mesmo. Byte 2 do frame: 0x10 com bloco de 20, 0x20 + bits altos do tamanho depois do MTU; na recepção, aceitar nibble alto 1, 2 ou 3. Bloco de escrita = min(MTU, 250) - 3, arredondado para baixo a múltiplo de 4.
D4. Comandos da fase 1:
- bateria: leitura de 2A19 (valor > 100 = carregando, convenção do Core) e também a notificação espontânea;
- firmware: 5A 01 primeiro, 2A28 de reserva; protocolo ("MOYOUNG-V2") como bleVersion ou campo equivalente;
- hora: 0x31 [u32 BE do relógio de parede tratado como GMT+8][08], depois BB 07 00 [fuso int32 LE em segundos, já com horário de verão];
- passos: leitura de FEE1 (total do dia) + 59/5D/5C páginas 00 e 01 (hoje) e 02 e 03 (ontem), em meias horas, com distância e calorias reais do relógio;
- sono: 0x32 (hoje) e 0x33 03 / 0x33 04 (1 e 2 dias atrás), com a montagem legada da SDK; aceitar resposta B6 01 se vier, mas não depender dela; timeout próprio para 0x32 sem resposta;
- passos ao vivo: notificações de FEE1 viram onLiveSteps/onPedometer;
- F9: só log por enquanto, com o significado tirado da SDK;
- unbind (esquecer): F8, para o relógio apagar o vínculo clássico; confira os bytes na SDK e no Core.
O reset de fábrica 51 02 entra só no catálogo e no codec, sem ser enviado: na fase 2 vira método explícito da tela Dispositivo.
D5. Passos com distância e calorias reais: estenda o domínio (por exemplo, campos opcionais na amostra) para o CRP levar os valores do relógio. SMA e iDO continuam com as estimativas. A persistência atual (JSON no Android e no iOS) tem de continuar lendo arquivos antigos.
D6. Vínculo clássico (HFP/A2DP para chamadas):
- no Android, depois de READY no primeiro pareamento (e na reconexão se o celular não tiver o bond), o CoreBridge pede ao host o bond clássico do mesmo endereço;
- o host faz createBond em BR/EDR (veja como o Core de produção chama), acompanha ACTION_BOND_STATE_CHANGED, tenta de novo uma vez automaticamente se cair em BOND_NONE (a primeira tentativa no HCI falhou) e informa o resultado;
- isso não bloqueia o estado conectado; falha final gera onError com código novo (por exemplo CLASSIC_BOND_FAILED) sem requestId, mais log;
- esquecer = driver manda F8, host remove o bond do sistema (reflexão, melhor esforço, como o Core de produção), depois limpa o pareamento salvo;
- no iOS o app não consegue emparelhar o clássico: o host responde "não suportado" com uma dica no log (o usuário pareia as chamadas nos Ajustes);
- no iOS a SDK do fornecedor conecta com CBConnectPeripheralOptionEnableTransportBridgingKey: replique por quirk do perfil e documente que ainda não se sabe se o iPhone vai pedir emparelhamento BLE.
A capacidade é do CoreHost (:bridge), com implementação nos dois hosts, no MinimalHost.swift e nos fakes de teste.
D7. JS: sem quebra de API. Adicionar initCRPSDK como alias de initialize() (como initSMASDK), o código de erro novo em constants.ts/index.ts, tipos e mock. O onScannedDevice do P85 sai com name "Condor Reebok" (o app Condor só aceita esse nome).
D8. Fixtures:
(a) conversor de btsnoop para o formato jsonl de fixture em ${R1}/scripts/ (por exemplo btsnoop2jsonl.py, python3 sem dependências), com filtro pela conexão de um aparelho e redação dos cmds 0x41, 0x43, 0xB5 e 0x12; nunca escreve endereço;
(b) fixture de referência redigida da captura do app de produção, com o cabeçalho marcando a origem (HCI, app de produção) e o que foi redigido; siga docs/fixtures.md e crie uma convenção nova se precisar (por exemplo, fixtures/reference/);
(c) testes que decodificam essa fixture com o codec novo: respostas 5A, páginas 59/5D/5C, 32 vazio, FEE1, 2A19 e os bytes de hora e fuso, comparados ao horário da captura;
(d) teste de replay da sessão (pair → hora → bateria → firmware → sync de passos e sono), com fixture sintética montada a partir dos RX reais na ordem que o nosso driver envia, e matcher CRP por cmd e sub-byte no FakeTransport.
A gravação real com o nosso driver vem da validação do usuário, como nas famílias anteriores.
D9. Não copiar os bugs do Core de produção: distance/calorie trocados no Android (emitir certo e registrar na doc para a fase 4 decidir com o backend); sono B6 01 ignorado; fila travada sem resposta a 0x32.
D10. Docs: docs/protocolo-crp.md no Repo 1 é a peça central (nível do protocolo-ido.md: GATT, frame, fila e temporização, handshake com diagrama, catálogo de comandos com fonte, payloads, dados de passos e sono, Bluetooth clássico, diferenças entre plataformas e quirks, vetores dourados). Também: decisoes.md (ADRs novas), arquitetura.md, fixtures.md, glossario.md (Moyoung, JieLi, CTKD, HFP, A2DP, SSP…), pendencias.md (fases 2 e 3, reset de fábrica, bond LE no iPhone desconhecido, deviceId/MAC do iOS para a fase 4, bugs do Condor achados), README e CLAUDE.md. No Repo 2: api-js.md, arquitetura.md, transporte-android.md (vínculo clássico), ios-pendente.md, pendencias.md, example/README.md (checklist do Condor Reebok no Android e no iPhone), README e CLAUDE.md, e os READMEs das pastas tocadas.`

phase('Desenho')
const design = await agent(`${COMMON}

${DECISIONS}

Tarefa: você é o arquiteto da fase 1. Não edite nenhum arquivo. Leia o código dos dois repositórios: SessionEngine, WatchSession, DriverLink, DeviceDriver, Drivers, Profiles, DeviceRegistry, os drivers ido/ e sma/, HistoryStore/SampleStore, os testes e o testing/ FakeTransport, o :bridge (CoreBridge, CoreHost, HostErrorCodes, EventMapper, testes, swift-interop/MinimalHost.swift), os hosts do Repo 2 (Android ble/, CoreGraph, AndroidCoreHost, NativeCoreNextModule; iOS CentralTransport, IosCoreHost, CoreGraph, RCTNativeCoreNext.mm) e o JS (src/specs, src/index.ts, constants, mock). Leia também os insumos da fase 0 e os fatos do HCI.
Produza uma especificação de implementação completa e executável por outros agentes, em português:
- para cada repositório e módulo: arquivos a criar e a modificar, com responsabilidades, assinaturas Kotlin/Swift/TS das partes públicas e internas novas, e onde cada decisão D1-D10 entra;
- tabela do catálogo de comandos da fase 1, com bytes exatos de pedido e resposta, a fonte (SDK arquivo:linha e/ou frame do HCI) e o comportamento de timeout e espaçamento;
- algoritmo do handshake e do sync, a montagem do sono e a conversão das meias horas em amostras do domínio;
- como o FakeTransport e o replay passam a suportar CRP;
- plano de testes (nomes dos testes e o que cada um prova), plano de docs (arquivo por arquivo) e a ordem de implementação;
- divisão de trabalho: (A) Repo 1 :protocol + conversor + fixtures; (B) Repo 1 :bridge + publicação local; (C) docs do Repo 1; (D) Repo 2 inteiro. Diga o que cada um não pode tocar, para (C) e (D) rodarem em paralelo sem conflito.
Em userQuestions, ponha só o que realmente depende do usuário.`, { label: 'desenho', phase: 'Desenho', schema: SPEC_SCHEMA })

if (!design) return { error: 'design agent failed' }
const SPEC = `Especificação da fase 1 (do arquiteto; siga e registre os desvios):
${design.spec}

Decisões finais:
${design.decisions.map(d => `- ${d.id}: ${d.decision} (motivo: ${d.rationale})`).join('\n')}`

phase('Protocolo')
const proto = await agent(`${COMMON}

${SPEC}

Tarefa (A): implemente no Repo 1 a parte do módulo :protocol, mais o conversor de btsnoop, as fixtures e os testes, conforme a especificação. Isso inclui pacote crp/ (codec, catálogo, payloads, driver), perfil e registro, as mudanças em DriverLink/sessão/domínio, suporte CRP no FakeTransport/replay, testes dourados (vetores confirmados da fase 0 e frames reais do HCI), testes de parser e de montagem do sono, replay da sessão, conversor scripts/btsnoop2jsonl.py (rode-o sobre ${SP}/condor-hci/ com python3 -I para gerar a fixture de referência redigida) e os testes de decodificação dessa fixture. Escreva KDoc completo e o README.md do pacote crp/; atualize os READMEs dos pacotes que você mudar. Não edite docs/*.md, README.md da raiz, CLAUDE.md nem nada do :bridge: isso é de outras tarefas. Anote em notesForNext o que elas precisam saber.
Rode as suítes do Repo 1 que o CLAUDE.md manda (incluindo os testes JVM de :protocol e de :bridge) e só termine com tudo verde, ou explique o que falhou.`, { label: 'protocolo', phase: 'Protocolo', schema: IMPL_SCHEMA })

const protoNotes = proto ? `Resultado da tarefa (A), Repo 1 :protocol:
${proto.summary}
Arquivos: ${proto.filesChanged.join(', ')}
Desvios: ${proto.deviationsFromSpec.join(' | ')}
Pendências: ${proto.openIssues.join(' | ')}
Notas: ${proto.notesForNext}` : 'A tarefa (A) falhou; confira o estado do Repo 1 antes de seguir.'

phase('Bridge')
const bridge = await agent(`${COMMON}

${SPEC}

${protoNotes}

Tarefa (B): implemente no Repo 1 a parte do módulo :bridge, conforme a especificação:
- capacidade de vínculo clássico no CoreHost;
- orquestração no CoreBridge: quando pedir o bond e a ordem do esquecer (F8, depois remover o bond, depois limpar);
- código de erro novo em HostErrorCodes e os mapeamentos de evento necessários;
- os fakes e testes do bridge (CoreBridgeTestKit e afins) e o swift-interop/MinimalHost.swift;
- golden regenerado, se o CLAUDE.md mandar.
Atualize bridge/README.md e os READMEs dos pacotes do bridge; não edite docs/*.md nem o :protocol, salvo uma correção mínima e necessária, que você reporta.
No fim, rode as suítes do Repo 1 (protocol + bridge + checagem do header/Swift interop, se existir) e publique para o Repo 2 como o CLAUDE.md manda: publishToMavenLocal e o XCFramework, ou o script ${R2}/ios/scripts/sync-xcframework.sh --build. Só termine com tudo verde ou explique o que falhou.`, { label: 'bridge', phase: 'Bridge', schema: IMPL_SCHEMA })

const bridgeNotes = bridge ? `Resultado da tarefa (B), Repo 1 :bridge:
${bridge.summary}
Arquivos: ${bridge.filesChanged.join(', ')}
Desvios: ${bridge.deviationsFromSpec.join(' | ')}
Pendências: ${bridge.openIssues.join(' | ')}
Notas: ${bridge.notesForNext}` : 'A tarefa (B) falhou; confira o estado do :bridge antes de seguir.'

phase('Docs e host')
const [docs, host] = await parallel([
	() => agent(`${COMMON}

${SPEC}

${protoNotes}

${bridgeNotes}

Tarefa (C): escreva e atualize a documentação do Repo 1 conforme D10 e a especificação: docs/protocolo-crp.md (novo, peça central), decisoes.md (ADRs novas, numeradas na sequência das existentes), arquitetura.md, fixtures.md, glossario.md, pendencias.md, README.md da raiz e CLAUDE.md (família CRP, comandos novos, conversor de btsnoop, arquivos de contrato). Leia o código final do :protocol e do :bridge para a doc bater com ele, e cite a fonte de cada byte (SDK arquivo:linha ou fixture de referência). Não edite código, testes nem nada do Repo 2. Rode a checagem de documentação que o CLAUDE.md mandar (por exemplo Dokka com reportUndocumented), se houver.`, { label: 'docs-repo1', phase: 'Docs e host', schema: IMPL_SCHEMA }),
	() => agent(`${COMMON}

${SPEC}

${protoNotes}

${bridgeNotes}

Tarefa (D): implemente o Repo 2 conforme a especificação.
- Host Android: o scan aceita o P85 pelo registro do Repo 1; vínculo clássico com createBond em BR/EDR, receiver de estado de bond, uma nova tentativa automática e remoção do bond por reflexão; o transporte lida com FEE2 sem resposta, com a 2A19 espontânea e com as notificações extras.
- Host iOS: opção de transport bridging por quirk do perfil no connect; vínculo clássico "não suportado" com dica; IosCoreHost e CoreGraph conforme o CoreHost novo.
- JS: initCRPSDK, código de erro novo, tipos, mock, TSDoc.
- App de exemplo: o que for preciso para validar o Condor Reebok.
- Docs do Repo 2 (api-js.md, arquitetura.md, transporte-android.md, ios-pendente.md, pendencias.md, example/README.md com checklist do Condor Reebok no Android e no iPhone, README e CLAUDE.md) e os READMEs das pastas tocadas.
Não edite o Repo 1; se precisar de algo lá, reporte em openIssues. Rode como o CLAUDE.md manda: testes do host Android, testes iOS (SPM/simulador), Jest, typecheck, ESLint e Prettier, build do exemplo Android, build iOS Debug no simulador e Release para iphoneos. Só termine com tudo verde ou explique o que falhou.`, { label: 'repo2', phase: 'Docs e host', schema: IMPL_SCHEMA }),
])

const allNotes = `${protoNotes}

${bridgeNotes}

Resultado da tarefa (C), docs do Repo 1: ${docs ? docs.summary + ' | Arquivos: ' + docs.filesChanged.join(', ') + ' | Pendências: ' + docs.openIssues.join(' | ') : 'falhou'}

Resultado da tarefa (D), Repo 2: ${host ? host.summary + ' | Arquivos: ' + host.filesChanged.join(', ') + ' | Desvios: ' + host.deviationsFromSpec.join(' | ') + ' | Pendências: ' + host.openIssues.join(' | ') : 'falhou'}`

phase('Revisão')
const LENSES = [
	{ key: 'protocolo', prompt: 'Lente PROTOCOLO: confira o driver CRP, o codec, os payloads, o handshake, o sync, a montagem do sono, os timeouts e o espaçamento contra a SDK descompilada (fase0-protocolo.md e o código citado) e contra os frames reais do HCI (frames.jsonl). Procure bytes errados, endianness, offsets, casos de borda (resposta vazia, páginas, timeout de 0x32, frame fragmentado, nibble do byte 2), regressões em SMA/iDO e testes que não provam o que dizem.' },
	{ key: 'integracao', prompt: 'Lente INTEGRAÇÃO E PLATAFORMAS: confira o :bridge (CoreHost, CoreBridge, ordem do esquecer, quando pedir o bond clássico, erros e eventos), os hosts Android (createBond/removeBond, receivers, permissões, threading, ciclo de vida, write sem resposta, notificações extras) e iOS (transport bridging, CoreGraph, IosCoreHost, shim), o JS (compatibilidade com o Core atual e com o Condor: initCRPSDK, nome "Condor Reebok", shapes de eventos, distance/calorie corretos), o app de exemplo, e regressões para fitGPS e Life Ultra.' },
	{ key: 'docs-privacidade', prompt: 'Lente DOCS, CONVENÇÕES E PRIVACIDADE: a doc bate com o código; protocolo-crp.md permite reimplementar sem a SDK; cada byte tem fonte; ADRs, pendências e checklists corretos; português nas docs e inglês no código; tabs; KDoc/TSDoc; READMEs por pacote; CLAUDE.md atualizados. Privacidade: nenhum MAC (procure padrões XX:XX:XX:XX:XX:XX e 6 bytes de endereço nos diffs e fixtures), nenhum texto de notificação, nome de localização ou altura/peso/idade reais, nada da conexão de outro aparelho; o btsnoop bruto fora dos repositórios; corenext-export/ e os logs fora do git.' },
]
const reviews = await parallel(LENSES.map(l => () => agent(`${COMMON}

${SPEC}

${allNotes}

Tarefa: revisão independente da fase 1, só leitura (não edite nada). ${l.prompt}
Veja os diffs com git -C ${R1} diff, git -C ${R2} diff e git status (arquivos novos não rastreados também contam). Para cada problema real, dê severidade, arquivo, linha, o problema, a correção sugerida e a evidência (bytes, arquivo:linha, saída de comando). Não reporte gosto pessoal.`, { label: `revisao:${l.key}`, phase: 'Revisão', schema: REVIEW_SCHEMA })))

const findings = reviews.filter(Boolean).flatMap((r, i) => r.findings.map(f => ({ ...f, id: `${LENSES[i].key}-${f.id}` })))
log(`${findings.length} achados de revisão (${findings.filter(f => f.severity === 'alta').length} alta, ${findings.filter(f => f.severity === 'media').length} média)`)

phase('Correção')
let fix = null
if (findings.length) {
	fix = await agent(`${COMMON}

${SPEC}

${allNotes}

Tarefa: corrija os achados da revisão abaixo. Para cada um, confirme primeiro que o problema existe (abrindo o código, a SDK ou o HCI). Se existir, corrija e diga o que mudou. Se não existir, rejeite com o motivo. Só adie se depender do usuário ou de teste com o relógio. Corrija também os de severidade baixa quando forem baratos. Depois rode de novo as suítes afetadas nos dois repositórios; se mudar o Repo 1, publique de novo para o Repo 2 (publishToMavenLocal e XCFramework) e rode os testes do Repo 2.

Achados (JSON):
${JSON.stringify(findings)}`, { label: 'correcao', phase: 'Correção', schema: FIX_SCHEMA })
}

phase('Verificação')
const verify = await agent(`${COMMON}

Tarefa: verificação final da fase 1, do zero e só leitura (não edite arquivos, não mude o git). Rode, seguindo os CLAUDE.md:
- Repo 1: todas as suítes JVM de :protocol e :bridge, os testes iOS do simulador se o CLAUDE.md mandar, as checagens de documentação, swift-interop e header, e confirme que a publicação local e o XCFramework do Repo 2 estão atualizados com o código atual;
- Repo 2: testes do host Android, testes iOS (SPM/simulador), Jest, typecheck, ESLint e Prettier, build do exemplo Android, build iOS Debug no simulador e Release para iphoneos.
Anote as contagens de testes e as linhas de REPLAY. Privacidade: procure MAC, texto de notificação, nome de localização e altura/peso/idade reais nos diffs e nos arquivos novos dos dois repositórios; confirme que o btsnoop e o corenext-export/ estão fora do git.
Em gitStatus, resuma git status dos dois repositórios. Em commitTitles, sugira um título curto de commit em português por repositório. Em userChecklist, liste o roteiro de validação da fase 1 para o usuário fazer com o Condor Reebok, no Android e no iPhone (o que fazer, o que observar, o que exportar).

Contexto do que foi feito:
${allNotes}

Correções: ${fix ? JSON.stringify(fix) : 'nenhuma'}`, { label: 'verificacao', phase: 'Verificação', schema: VERIFY_SCHEMA })

return {
	design: { decisions: design.decisions, risks: design.risks, userQuestions: design.userQuestions },
	proto, bridge, docs, host,
	reviewSummaries: reviews.filter(Boolean).map((r, i) => ({ lens: LENSES[i].key, summary: r.summary, count: r.findings.length })),
	findings, fix, verify,
}

export const meta = {
	name: 'crp-fase0',
	description: 'Fase 0 do CRP: inventário do Condor Smart por fase e levantamento do protocolo CRP (GATT/frame, conexão, comandos da fase 1) com verificação cética',
	phases: [
		{ title: 'Inventário', detail: '103 símbolos + 39 eventos do Condor classificados por fase, com o que o Core e a SDK fazem' },
		{ title: 'Protocolo', detail: 'GATT e frame, conexão e pareamento, comandos da fase 1 na SDK descompilada' },
		{ title: 'Verificação', detail: 'revisor cético por tema de protocolo, conferindo cada arquivo:linha' },
	],
}

const SDK = '/private/tmp/claude-502/-Users-joao-farias-GTE-Mormaii/ae4c00f2-34b0-4c1a-b929-4ce810ea855c/scratchpad/vendor-sdks/crp'

const COMMON = `Contexto: estamos portando o suporte aos relógios CRP para uma SDK nossa. Repo 1 = /Users/joao.farias/technos-watch-protocol (Kotlin Multiplatform; drivers sma/ e ido/ já prontos; docs/protocolo-sma.md e docs/protocolo-ido.md mostram o nível de detalhe que buscamos). Repo 2 = /Users/joao.farias/react-native-technos-core-next (TurboModule RN com host Android e iOS). Depois vamos trocar o core do app Condor Smart (/Users/joao.farias/GTE-CondorSmart, RN 0.81.4, só usa CRP, fixa react-native-technos-ware-core na tag v4.3.57) pela SDK nova. Escopo agora: só o relógio Condor Reebok, cujo nome BLE começa com "P85" (TechnosWareCore android/src/main/java/com/reactlibrary/devices/AvailableDevices.java:55; GTE-CondorSmart src/helpers/general.ts:54).

Fontes (todas só leitura):
- SDK CRP Android crpblelib 2.0.3, descompilada e ofuscada, em ${SDK}: src/ (pacotes legíveis com/crrepa/ble/{conn,trans,ota,scan,spp,sifli,nrf,hisilicon,lzo,log}, com/crrepa/ble/CRPBleClient.java; pacotes ofuscados com/crrepa/<letras>; também com/realsil, com/jieli, com/sifli, com/jni, com/compress), decompiled-jar/, jar/, AndroidManifest-crpblelib-2.0.3.xml. OTA por chip em com/crrepa/ble/ota/{goodix,hisilicon,hs,jieli,realtek,sifli}.
- SDK CRP iOS (Swift, binário fechado): /Users/joao.farias/CrpTechnosIosSdk/CRPSmartBand.framework (API pública em Headers/CRPSmartBand-Swift.h, 220 KB; binário CRPSmartBand: use strings, nm, otool só para ler).
- App de exemplo do fornecedor: /Users/joao.farias/CRPBleSdkSample.
- Core atual: /Users/joao.farias/TechnosWareCore. Android em android/src/main/java/com/crp/bluetooth/ (CRPService.java e os gerentes em connectionmanager/, steps/, historical/, activitymanager/, firmware/, watchfaces/, usersettings/, camera/, findphone/, music/, phonemanager/, promiseManager/, mappers/); iOS em ios/crpBluetooth/; spec JS em src/NativeModules/. O Condor fixa a tag v4.3.57: se ela existir (git -C /Users/joao.farias/TechnosWareCore tag -l v4.3.57), leia a versão fixada com git show v4.3.57:<caminho> ou git grep <padrão> v4.3.57 e aponte diferenças relevantes em relação ao HEAD.
- App Condor: /Users/joao.farias/GTE-CondorSmart/src (src/services/Smartwatch.ts é a fachada do Core; src/constants/FeaturesByDevice.ts define o que cada modelo mostra, REEBOK incluso; src/constants/index.ts tem DEVICE_MODEL).

Regras: não altere nenhum arquivo em nenhum repositório e não rode comandos git que mudem estado. Não execute código do fornecedor. Se precisar calcular algo (checksum, CRC, bytes de exemplo), escreva um script python pequeno num diretório temporário seu, fora da pasta da SDK, e rode com python3 -I. Toda afirmação sobre bytes, UUIDs, ordem de chamadas ou campos cita arquivo:linha (caminho completo ou relativo à raiz da fonte). Textos em português; identificadores como estão no código. Não escreva endereços MAC.`

const SLICES = [
	{
		key: 'A',
		title: 'conexão, sync, históricos e perfil',
		methods: ['initCRPSDK', 'scan', 'pairDevice', 'disconnectCurrentDevice', 'getBatteryStatus', 'getFirmwareInfo', 'syncDataHistory', 'deletedSavedData', 'getHistoryPedometer', 'getHistorySleep', 'getHistoryHeartRate', 'getHistorySpO2', 'getHistoryStress', 'getHistoryCalorie', 'getHistoryActivityMonitor', 'getHistoryActivityV2', 'getLiveData', 'setUserInfo', 'setGoalsV2', 'getDeviceGoals', 'deviceConnectStates', 'deletedCategory', 'onBluetoothPermissionChanged', 'shareLogs'],
		events: ['onScannedDevice', 'onConnectStateChanged', 'onBatteryStatus', 'onFirmwareInfo', 'onSyncStarted', 'onSyncProgress', 'onSyncFinished', 'onHistoryPedometer', 'onHistorySleep', 'onHistoryHeartRate', 'onHistorySpo2', 'onHistoryStress', 'onHistoryCalorie', 'onHistoryActivityMonitor', 'onHistoryActivityV2', 'onHistoryReminders'],
	},
	{
		key: 'B',
		title: 'tela Dispositivo: ajustes, lembretes, notificações',
		methods: ['set12HourFormat', 'setAlarm', 'getAlarmV3', 'setWorldClock', 'setWaterReminderV2', 'setWalkReminder', 'setVoiceAssistant', 'setTemperatureUnit', 'setDistanceUnit', 'setStressAutomaticCheck', 'setSpo2AutomaticCheck', 'setHeartRateAutomaticCheck', 'setHeartRateMax', 'setSosHelp', 'setSedentaryMode', 'setScreenTime', 'setNotDisturb', 'setMenstrual', 'setHandWashingReminder', 'setGestureControlV2', 'setGestureControl', 'setFindTelephoneControl', 'setDeviceShortcuts', 'setDeviceBatterySaving', 'setAutomaticScreenBrightness', 'screenBrightness', 'setAutomaticRespiratoryRateCheck', 'setAutomaticActivity', 'setAddressBook', 'manageNotifications', 'manageMusicOption', 'getNotificationListByModel', 'vibrateDevice', 'syncWeather', 'setSportPlate', 'setSportParameter', 'getSportParameters'],
		events: ['onSportParameters', 'onFindPhone'],
	},
	{
		key: 'C',
		title: 'atividades, plano de corrida, arquivos, câmera e plataforma',
		methods: ['activityTypes', 'startActivityByTypeV2', 'pauseActivityV2', 'resumeActivityV2', 'stopActivityV2', 'startRunningPlanActivity', 'pauseRunningPlanActivity', 'resumeRunningPlanActivity', 'stopRunningPlanActivity', 'syncRunningPlanWithDevice', 'getCurrentRunningPlan', 'finishRunningPlanByDate', 'getCurrentGeolocation', 'getLastDeviceLocation', 'deleteDeviceLocation', 'deleteAllDeviceLocation', 'checkIosBackgroundLocationPermission', 'updateFirmwareV2', 'updateFirmwareSequential', 'updateEPOGPS', 'updateAGPS', 'setWatchFaceByName', 'setWatchDial', 'getListWatchFace', 'deleteWatchFaceByName', 'changeWatchFace', 'changeWatchPhotoV2', 'openCameraMode', 'closeCameraMode', 'openNativeCamera', 'showToast', 'requestHCpermissions', 'getHCpermissionsStatus', 'haveHCpermissionsBeenRequested', 'openHCsettings', 'showBatteryOptimizationsActivity', 'isIgnoringBatteryOptimizations', 'requestDrawOverlaysPermission', 'checkDrawOverlaysPermission', 'openAutoStartPermission', 'manufacturerBlocksAutoStart', 'checkIsNotificationServiceEnabled'],
		events: ['onActivityCompletedV2', 'onActivityError', 'onActivityRealTimeSpeed', 'onActivityStartedV2', 'onActivityStatusV2', 'onActivityUpdateV2', 'onRunningPlanActionStatus', 'onRunningPlanActivityCompleted', 'onRunningPlanActivityError', 'onRunningPlanActivityStarted', 'onRunningPlanActivityUpdate', 'onAgpsUpdateFail', 'onAgpsUpdateProgress', 'onAgpsUpdateStart', 'onAgpsUpdateSuccess', 'onAgpsUpdateUserSuccess', 'onFirmwareStatusV2', 'onFaceInfo', 'onDeviceRequestedCameraMode', 'onOpenCameraMode', 'onTakeAPicture'],
	},
]

const ALL = SLICES.map(s => `fatia ${s.key}: ${s.methods.concat(s.events).join(', ')}`).join('\n')

const INVENTORY_SCHEMA = {
	type: 'object',
	properties: {
		items: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					symbol: { type: 'string' },
					kind: { type: 'string', enum: ['method', 'event', 'constant'] },
					condorUsage: { type: 'string' },
					reebokReachable: { type: 'string' },
					talksToWatch: { type: 'boolean' },
					coreAndroid: { type: 'string' },
					coreIos: { type: 'string' },
					sdkApi: { type: 'string' },
					proposedPhase: { type: 'string', enum: ['1', '2', '3', 'pos-prazo', 'plataforma', 'nao-alcancavel-p85'] },
					effort: { type: 'string', enum: ['S', 'M', 'L'] },
					notes: { type: 'string' },
				},
				required: ['symbol', 'kind', 'condorUsage', 'reebokReachable', 'talksToWatch', 'coreAndroid', 'coreIos', 'sdkApi', 'proposedPhase', 'effort', 'notes'],
			},
		},
		missingFromSlice: { type: 'array', items: { type: 'string' } },
		extraFindings: { type: 'array', items: { type: 'string' } },
	},
	required: ['items', 'missingFromSlice', 'extraFindings'],
}

const PROTOCOL_SCHEMA = {
	type: 'object',
	properties: {
		summary: { type: 'string' },
		claims: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					topic: { type: 'string' },
					claim: { type: 'string' },
					evidence: { type: 'array', items: { type: 'string' } },
					confidence: { type: 'string', enum: ['alta', 'media', 'baixa'] },
				},
				required: ['id', 'topic', 'claim', 'evidence', 'confidence'],
			},
		},
		goldenVectors: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					hex: { type: 'string' },
					derivation: { type: 'string' },
					evidence: { type: 'array', items: { type: 'string' } },
				},
				required: ['name', 'hex', 'derivation', 'evidence'],
			},
		},
		openQuestions: { type: 'array', items: { type: 'string' } },
		hciChecks: { type: 'array', items: { type: 'string' } },
	},
	required: ['summary', 'claims', 'goldenVectors', 'openQuestions', 'hciChecks'],
}

const VERDICT_SCHEMA = {
	type: 'object',
	properties: {
		verdicts: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					id: { type: 'string' },
					status: { type: 'string', enum: ['confirmado', 'parcial', 'errado', 'sem-suporte'] },
					correction: { type: 'string' },
					evidence: { type: 'array', items: { type: 'string' } },
				},
				required: ['id', 'status', 'correction', 'evidence'],
			},
		},
		vectorVerdicts: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: { type: 'string' },
					status: { type: 'string', enum: ['confirmado', 'parcial', 'errado', 'sem-suporte'] },
					correction: { type: 'string' },
				},
				required: ['name', 'status', 'correction'],
			},
		},
		missedImportant: { type: 'array', items: { type: 'string' } },
	},
	required: ['verdicts', 'vectorVerdicts', 'missedImportant'],
}

const UUID_HINT = `UUIDs que aparecem como literais em com/crrepa: 6e40ff02/6e40ff03-b5a3-f393-e0a9-e50e24dcca9e, 0000ff01..0000ff04-0000-1000-8000-00805f9b34fb, a6ed0402/a6ed0403-d344-460a-8075-b9e8ec90d71b, FE010000-1234-5678-ABCD-00805F9B34FB, os da SiFli 00000000-0000-0x00-6473-5f696c666973 e o SPP 00001101. Outros podem ser montados em código ofuscado ou por string concatenada. Não assuma que algum deles é o canal de comando sem provar no código.`

const GOAL = `Objetivo final: conseguir implementar no Repo 1 um driver crp/ para o Condor Reebok (P85) sem a SDK, cobrindo connect → configuração GATT → handshake → pronto, bateria, firmware, hora, passos do dia, histórico de passos e sono, reconexão e esquecer o relógio. Prefira o caminho que o P85 usa; quando a SDK tiver ramos por chip ou por versão, diga como cada ramo é escolhido e o que decide o ramo do P85.`

const PROTO = [
	{
		key: 'transporte',
		title: 'GATT, frame e plataformas de chip',
		prompt: `Tarefa (fase 0, protocolo, tema GATT, frame e plataformas de chip). ${GOAL}
Levante, na SDK Android e cruzando com o iOS (Swift header, strings do binário):
1. Serviços e características do canal de comandos (escrita e notificação), descritores CCCD, tipo de escrita, pedido de MTU, e qual conjunto de UUIDs vale para qual chip/plataforma e como a SDK decide (anúncio, descoberta de serviços, consulta de firmware). ${UUID_HINT}
2. Estrutura do pacote: cabeçalho, tamanho, id de comando, payload, checksum ou CRC (algoritmo exato, bytes cobertos), sequência, ACK, fragmentação em pacotes de 20 bytes ou MTU-3, remontagem das respostas, criptografia ou ofuscação de payload, fila de comandos e timeouts, como uma resposta casa com o pedido.
3. O conceito de plataforma (realtek, goodix, hisilicon, hs, jieli, sifli, nrf): onde a SDK guarda, como descobre e como dá para saber qual é a do P85 (string de firmware, comando de consulta, anúncio). Diga o que muda no protocolo de comandos entre plataformas e o que muda só em OTA e mostradores.
4. Uso de SPP/Bluetooth clássico (00001101) e se o P85 precisaria disso.
5. Para a plataforma provável do P85: qual caminho de atualização de firmware e de envio de mostrador se aplica, e uma estimativa curta de complexidade (isso é risco de prazo, não precisa de bytes).
Em goldenVectors, dê pelo menos o pacote completo de consulta de bateria e de consulta de firmware, com a derivação byte a byte. Em hciChecks, liste o que procurar num HCI snoop do app de produção pareando com o P85 para confirmar cada ponto.`,
	},
	{
		key: 'conexao',
		title: 'conexão, pareamento, reconexão e esquecer',
		prompt: `Tarefa (fase 0, protocolo, tema conexão, pareamento, reconexão e esquecer). ${GOAL}
Levante:
1. O que CRPBleConnection e a SDK fazem do connect até o estado conectado: descoberta de serviços, ordem de habilitar notificações, MTU, algum comando de bind, autenticação ou handshake, createBond ou SMP (veja com/crrepa/ble/conn/bond), se o relógio pede confirmação na tela, e o que a SDK espera antes de avisar "conectado". Cruze com o iOS (o relógio exige bond do sistema? isso decide se o iPhone mostra o diálogo de emparelhamento e se o erro de vínculo apagado, CBError 14, pode acontecer).
2. O que o Core atual (CRPService e connectionmanager/CRPBleConnectHelper, CRPBluetoothListener; e ios/crpBluetooth/CRPService.m) chama ao conectar e logo depois: hora, idioma, perfil do usuário, metas, unidades, flags de sync, leitura de bateria e firmware etc., na ordem, na versão v4.3.57 do Core.
3. O que o app Condor chama depois do pareamento (fluxo de pareamento em GTE-CondorSmart/src, ex.: setUserInfo, metas, sync) e em cada abertura do app.
4. Reconexão: autoConnect, reconexão da própria SDK, o que o Core faz ao religar o Bluetooth e ao abrir o app; como o Core guarda o último relógio.
5. Desconectar e esquecer: comandos de unbind ou reset de fábrica enviados ao relógio, removeBond, o que o Condor chama no botão Desconectar e no Resetar relógio.
6. Estados de conexão da SDK e como o Core os mapeia para deviceConnectStates.
Em goldenVectors, dê os pacotes que o handshake ou o pós-conexão enviam (se houver), com derivação. Em hciChecks, liste o que procurar no HCI snoop do app de produção pareando o P85 (ex.: SMP Pairing Request? ordem de CCCD? primeiro comando?).`,
	},
	{
		key: 'comandos',
		title: 'comandos da fase 1',
		prompt: `Tarefa (fase 0, protocolo, tema comandos da fase 1). ${GOAL}
Para cada função abaixo, dê o id de comando, o layout do pedido (offsets, endianness, unidades), o layout da resposta e como a SDK a interpreta, se o relógio também envia isso sozinho (notificação espontânea), e como o Core atual (v4.3.57, Android e iOS) leva o resultado ao evento JS (shapes de onBatteryStatus, onFirmwareInfo, onHistoryPedometer, onHistorySleep, onSyncStarted/Progress/Finished; tipos em TechnosWareCore/src/NativeModules/type/eventData/):
1. bateria (consulta e aviso de carga, se existir);
2. versão de firmware e outras informações de hardware ou plataforma;
3. acertar a hora (e fuso, formato 12/24 h, se forem do mesmo comando);
4. passos do dia (tempo real) e o que vem junto (distância, calorias);
5. histórico de passos (por dia, por hora, quantos dias, paginação);
6. histórico de sono (registros, estágios, como a SDK monta a sessão e os minutos de cada estágio; REM existe?);
7. perfil do usuário (altura, peso, idade, sexo) e metas, se forem necessários para os passos e calorias;
8. a sequência que o syncDataHistory do Core dispara no CRP (quais comandos, em que ordem, como sabe que acabou; o Core usa CRPSyncDataFlags).
Em goldenVectors, dê os pacotes completos de pedido para cada comando, com derivação byte a byte; se houver resposta de exemplo no código ou nos testes, decodifique. Em hciChecks, liste o que procurar no HCI snoop para confirmar cada layout.`,
	},
]

const inventoryRuns = parallel(SLICES.map(s => () => agent(
	`${COMMON}

Tarefa (fase 0, inventário, fatia ${s.key}: ${s.title}). Para cada símbolo abaixo, levante como o Condor usa e o que está por trás no Core atual e na SDK CRP.
Métodos e constantes: ${s.methods.join(', ')}
Eventos: ${s.events.join(', ')}

Para cada símbolo, preencha:
- condorUsage: arquivos:linhas das chamadas e em qual tela ou fluxo (curto).
- reebokReachable: se o fluxo aparece para o Condor Reebok (veja FeaturesByDevice.ts e os gates por modelo), com a evidência; "desconhecido" se não der para saber.
- talksToWatch: se o método conversa com o relógio (false para Health Connect, permissões, câmera nativa, toasts, constantes).
- coreAndroid e coreIos: método do CRPService (ou gerente) na versão fixada, a(s) chamada(s) da SDK CRP que ele faz, arquivo:linha; "não implementado no CRP" quando for o caso.
- sdkApi: nome(s) da API pública da SDK CRP (Android CRPBleConnection.* ou outra classe; iOS CRPSmartBand).
- proposedPhase: "1" = conexão, pareamento, reconexão, bateria, firmware, hora, passos do dia, histórico de passos e sono (o que já fizemos para SMA e iDO); "2" = comando simples da tela Dispositivo (uma escrita ou leitura, sem transferência de arquivo, sem estado longo); "3" = atividades (início, pausa, fim, plano de corrida, tempo real, GPS do celular) e históricos (FC, SpO2, estresse, calorias, monitor de atividade, atividades); "pos-prazo" = transferência de arquivo (firmware, mostrador, foto, AGPS/EPO) ou algo grande que você recomenda adiar, com o motivo; "plataforma" = não fala com o relógio, só porte de código do host; "nao-alcancavel-p85" = o Condor não chega nele com o Reebok.
- effort: S, M ou L para portar (protocolo + host), e notes com os riscos (depende de chip, transferência de arquivo, estado no host, banco local, serviço em primeiro plano, permissão especial).

Confira também se a lista está completa: rode grep -rhoE 'TechnosCore\\.[a-zA-Z0-9_]+' e grep -rhoE 'TechnosEvents\\.[a-zA-Z0-9_]+' em /Users/joao.farias/GTE-CondorSmart/src; se achar símbolo que não está em nenhuma das três fatias abaixo, ponha em missingFromSlice.
${ALL}
${s.key === 'A' ? 'Você também procura outros caminhos de acesso ao Core além de TechnosCore. e TechnosEvents. (imports diretos de react-native-technos-ware-core, NativeModules, utils, tipos, ViewManagers ou componentes nativos do Core como mapas) e relata em extraFindings, com arquivo:linha.' : ''}`,
	{ label: `inventario:${s.key}`, phase: 'Inventário', schema: INVENTORY_SCHEMA },
).then(r => (r ? { slice: s.key, title: s.title, ...r } : null))))

const protocolRuns = pipeline(
	PROTO,
	p => agent(`${COMMON}\n\n${p.prompt}`, { label: `protocolo:${p.key}`, phase: 'Protocolo', schema: PROTOCOL_SCHEMA }),
	(res, p) => {
		if (!res) return null
		return agent(
			`${COMMON}

Você é um revisor cético. Abaixo estão afirmações de outro agente sobre o protocolo CRP, tema "${p.title}". Para cada claim (pelo id), abra as evidências citadas e verifique se elas sustentam exatamente o que está escrito. status: confirmado, parcial, errado ou sem-suporte (use sem-suporte quando a citação não mostra a afirmação, mesmo que ela pareça plausível). Em correction, escreva a versão correta com a evidência. Para cada vetor dourado, refaça a derivação (bytes, checksum) a partir do código citado, com um script python -I seu se precisar. Em missedImportant, liste o que é essencial para implementar "${p.title}" no driver crp/ e o agente não cobriu, com arquivo:linha.

Afirmações do outro agente (JSON):
${JSON.stringify(res)}`,
			{ label: `verifica:${p.key}`, phase: 'Verificação', schema: VERDICT_SCHEMA },
		).then(v => ({ key: p.key, title: p.title, findings: res, review: v }))
	},
)

const [inventory, protocol] = await Promise.all([inventoryRuns, protocolRuns])
return { inventory: inventory.filter(Boolean), protocol: protocol.filter(Boolean) }

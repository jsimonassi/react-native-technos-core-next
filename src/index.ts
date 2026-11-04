/**
 * Ponto de entrada da biblioteca `react-native-technos-core-next`.
 *
 * Mantém os nomes do Core atual (`TechnosCore`, `TechnosEvents`, `utils`, `deviceConnectStates`,
 * `deletedCategory`, `TechnosCore.activityTypes`, os enums de valor das atividades e os componentes
 * `TechnosNativeChronometer`, `TechnosNativeMap`, `TechnosMapStyles` e `TechnosNativeActionTimer`) para os apps Mormaii e
 * Condor trocarem de pacote mudando o import. A referência completa de cada método e evento, com payloads de exemplo e
 * diferenças em relação ao Core atual, está em `docs/api-js.md`.
 */
import { activityTypes } from "./activityTypes";
import { deletedCategory, deviceConnectStates, errorCodes, logLevels, type LogLevelValue } from "./constants";
import NativeCoreNext from "./specs/NativeCoreNext";
import type { TechnosActivityByTypeStartV2, TechnosActivityByTypeStop } from "./types/activity";
import type { TechnosEventEmitter, TechnosEventEmitters, TechnosEventMap } from "./types/emitter";
import type { LastPairedDevice, LogEvent, SavedItemDelete } from "./types/events";
import type {
	TechnosAlarmSet,
	TechnosContactItem,
	TechnosDistanceUnitUpdate,
	TechnosGestureControlSetV2,
	TechnosGoalsSet,
	TechnosManageNotificationsUpdate,
	TechnosMenstrualDataUpdate,
	TechnosNotDisturbSet,
	TechnosStressAutomaticUpdate,
	TechnosUserInfoSet,
	TechnosWalkReminderUpdate,
	TechnosWaterReminderUpdate,
	TechnosWeatherListUpdateItem,
	TechnosWorldClockSet,
} from "./types/watchSettings";
import { utils } from "./utils";
import { observed } from "./utils/promise";
import { groupSavedItemsByCategory } from "./utils/savedData";

/**
 * Comandos do módulo nativo.
 *
 * Regra geral (igual ao spec): comandos que falam com o relógio devolvem `Promise<void>` que resolve quando o
 * relógio confirma e rejeita com um dos {@link errorCodes} (leia com `utils.errors.getErrorCode`). Toda rejeição
 * também sai em `TechnosEvents.onError`. O dado lido chega pelo evento correspondente, como no Core atual.
 *
 * Diferença principal em relação ao Core atual: lá os comandos são `void` e falhas são silenciosas; aqui quase todos
 * devolvem Promise. Código que ignora o retorno continua funcionando, mas convém tratar a rejeição para não gerar
 * "Possible unhandled promise rejection". Os ajustes, mensagens e interações da fase 2 (de `setUserInfo` a
 * `closeCameraMode`), o `resetDevice` e os métodos da fase 3 (históricos de FC, estresse, SpO2 e treinos, a atividade
 * e o `checkIosBackgroundLocationPermission`) já devolvem a Promise marcada como observada (`utils.promise.observed`):
 * chamados sem `await`, não geram esse aviso; com `await`, rejeitam normalmente.
 */
export const TechnosCore = {
	/** Mesmos códigos de `onConnectStateChanged.state` do Core atual. */
	deviceConnectStates,
	/** Mesmas categorias de `deletedSavedData` do Core atual. */
	deletedCategory,
	/** Códigos de erro das rejeições e de `onError`. Também exportado na raiz. */
	errorCodes,
	/** Níveis de `setLogLevel`. Também exportado na raiz. */
	logLevels,
	/**
	 * Códigos Technos dos tipos de atividade (`type` de `startActivityByTypeV2` e dos treinos), cópia literal da tabela
	 * do Core atual (`v4.3.57`). Fase 3.
	 */
	activityTypes,

	/**
	 * Cria o grafo nativo (sessão, transporte, logger) e, se houver relógio pareado salvo, pede a reconexão.
	 * Antes, emite `onConnectStateChanged` com o estado atual (o nativo sobrevive ao reload do JS): chame depois de
	 * se inscrever. Idempotente: pode ser chamado a cada abertura do app. Novo; substitui os `initXxxSDK` do Core atual.
	 */
	initialize: (): Promise<void> => NativeCoreNext.initialize(),

	/**
	 * Alias de {@link TechnosCore.initialize}, com o nome que o app Mormaii usa para o fitGPS
	 * (`Smartwatch.init` → `initSMASDK`).
	 */
	initSMASDK: (): Promise<void> => NativeCoreNext.initSMASDK(),

	/**
	 * Alias de {@link TechnosCore.initialize}, com o nome que o app Condor usa para o Condor Reebok (família CRP). Só no
	 * JS: chama o mesmo `initialize` nativo, porque o grafo nativo é um só para todas as famílias.
	 */
	initCRPSDK: (): Promise<void> => NativeCoreNext.initialize(),

	/**
	 * Procura relógios por 7 s. Cada relógio de um modelo suportado vira um `onScannedDevice`, uma vez por endereço
	 * por busca (o Core atual emite a cada anúncio). Não há evento de fim de busca. Sem permissão ou com o Bluetooth
	 * desligado, não lança: emite `onError` com `method: "scan"` (`PERMISSION_DENIED` ou `BLUETOOTH_OFF`).
	 */
	scan: (): void => NativeCoreNext.scan(),

	/** Interrompe a busca antes dos 7 s. Novo. */
	stopScan: (): void => NativeCoreNext.stopScan(),

	/**
	 * Primeiro pareamento com um relógio vindo de `onScannedDevice`.
	 *
	 * Resolve quando a conexão fica pronta (`onConnectStateChanged` com `state = connected`). No fitGPS o BIND espera
	 * até 60 s pela confirmação na tela do relógio; no Condor Reebok não há confirmação (só a leitura da versão, fase
	 * `VERSION`), e logo depois o nativo pede o vínculo Bluetooth clássico das chamadas e da música (no Android, o
	 * diálogo do sistema; uma falha sai só em `onError` com `CLASSIC_BOND_FAILED`).
	 *
	 * Rejeita na hora com `PERMISSION_DENIED`, `BLUETOOTH_OFF`, `INVALID_ARGUMENT` ou `UNSUPPORTED_DEVICE`; depois, com
	 * `CANCELLED`, `TRANSPORT`, `CONNECT_TIMEOUT`, `GATT_NOT_SUPPORTED`, `HANDSHAKE_FAILED`, `DISCONNECTED` ou
	 * `PAIRING_REMOVED` (o usuário tem de esquecer o relógio nas configurações de Bluetooth do telefone; hoje só o iOS
	 * detecta). No Core atual é `void` e não informa falha.
	 *
	 * @param deviceId MAC do relógio (`onScannedDevice.deviceId`; no iOS, o UUID do periférico).
	 * @param name `onScannedDevice.name` (ex.: `"fitGPS"`, `"Condor Reebok"`).
	 */
	pairDevice: (deviceId: string, name: string): Promise<void> => NativeCoreNext.pairDevice(deviceId, name),

	/**
	 * Reconecta ao relógio já pareado (handshake curto, sem confirmação no relógio). Resolve assim que a reconexão é
	 * pedida; a conexão de fato é anunciada por `onConnectStateChanged`, e pode demorar se o relógio estiver longe.
	 * Rejeita na hora pelos mesmos motivos de {@link TechnosCore.pairDevice}; falhas posteriores só saem em `onError`
	 * com `method: "startPairingAttempt"`. No Core atual é `void` e, para SMA, equivale a `pairDevice`.
	 */
	startPairingAttempt: (deviceId: string, name: string): Promise<void> =>
		NativeCoreNext.startPairingAttempt(deviceId, name),

	/**
	 * Desconecta sem esquecer o relógio: o pareamento salvo e o histórico local continuam.
	 * Diferente do Core atual, onde `disconnectCurrentDevice` também desfaz o vínculo e apaga dados (use
	 * {@link TechnosCore.forgetDevice} para isso).
	 */
	disconnectCurrentDevice: (): Promise<void> => NativeCoreNext.disconnectCurrentDevice(),

	/**
	 * Desconecta, desfaz o vínculo no relógio (UNBIND no fitGPS, `F8` no Condor Reebok, se conectado), esquece o
	 * pareamento salvo e apaga o histórico local. No Condor Reebok também remove o vínculo Bluetooth clássico do sistema
	 * no Android (no iPhone só o usuário remove, em Ajustes > Bluetooth). Equivale ao `disconnectCurrentDevice` do Core
	 * atual. Novo.
	 */
	forgetDevice: (): Promise<void> => NativeCoreNext.forgetDevice(),

	/**
	 * Reset de fábrica do relógio: no Condor Reebok, o `51 02` (o relógio não responde), resolvido depois da escrita e do
	 * intervalo da fila. Separado de {@link TechnosCore.forgetDevice} (que nunca reseta): não esquece o pareamento
	 * salvo, não apaga o histórico local e não remove o vínculo Bluetooth do sistema; o app decide se chama os dois. O
	 * que o relógio faz com a conexão depois do reset ainda não foi validado.
	 *
	 * Rejeita com `NOT_READY` (desconectado), `NOT_SUPPORTED` (fitGPS e Life Ultra GPS), `DISCONNECTED` (também quando o
	 * link cai nos 200 ms depois da escrita, com o `51 02` já enviado: o reset pode ter acontecido) ou `CANCELLED`.
	 * Promise observada (sem `await` não gera aviso). No Core atual é `resetDevice(): void` (`NativeCore.ts:119` no
	 * `v4.3.57`), e o Core do app Condor também o manda antes do `F8` em todo `disconnectCurrentDevice`.
	 */
	resetDevice: (): Promise<void> => observed(NativeCoreNext.resetDevice()),

	/** `true` quando a sessão está pronta para comandos (conectada, inclusive durante sync). */
	isConnected: (): Promise<boolean> => NativeCoreNext.isConnected(),

	/**
	 * Último relógio pareado, ou `null` se não há pareamento salvo. Use com
	 * {@link TechnosCore.startPairingAttempt} para reconectar. Novo (no app Mormaii isso vive no cache do app).
	 */
	getLastPairedDevice: async (): Promise<LastPairedDevice | null> => {
		const device = (await NativeCoreNext.getLastPairedDevice()) as LastPairedDevice | null | undefined;
		return device ?? null;
	},

	/**
	 * Lê firmware e identificação do relógio (comando VERSION). Emite `onDeviceInfo` e resolve em seguida.
	 * No Core atual não existe para SMA (o Android manda um comando de alarme).
	 */
	getDeviceInfo: (): Promise<void> => NativeCoreNext.getDeviceInfo(),

	/** Lê a versão do firmware (mesma leitura de `getDeviceInfo`). Emite `onFirmwareInfo`, no formato do Core atual. */
	getFirmwareInfo: (): Promise<void> => NativeCoreNext.getFirmwareInfo(),

	/**
	 * Lê a bateria. Emite `onBatteryStatus`, no formato do Core atual, e resolve em seguida. O Condor Reebok também
	 * avisa sozinho (cerca de uma vez por minuto): sai um `onBatteryStatus` sem pedido.
	 */
	getBatteryStatus: (): Promise<void> => NativeCoreNext.getBatteryStatus(),

	/**
	 * Acerta o relógio com a hora local do telefone. O nativo também faz isso sozinho logo depois de cada conexão.
	 * Novo (no Core atual só acontece no login).
	 */
	setTime: (): Promise<void> => NativeCoreNext.setTime(),

	/** Lê os passos recentes do relógio e emite `onPedometer` com o total de hoje. Novo. */
	refreshSteps: (): Promise<void> => NativeCoreNext.refreshSteps(),

	/**
	 * Lê o histórico do relógio (passos e sono; no Condor Reebok também frequência cardíaca, estresse e treinos) e grava
	 * localmente. Emite `onSyncStarted`, `onSyncProgress` e `onSyncFinished`; resolve depois de `onSyncFinished` e
	 * rejeita com o erro que interrompeu o sync (também em `onError`). Com uma atividade iniciada pelo app em andamento,
	 * os treinos ficam de fora (DP-131). No Core atual o sync do SMA é simulado (só emite os eventos com atraso).
	 *
	 * Por enquanto (fase 3 em andamento) o nativo lê só passos e sono, em todos os modelos (DP-94).
	 */
	syncDataHistory: (): Promise<void> => NativeCoreNext.syncDataHistory(),

	/**
	 * Emite `onHistoryPedometer` com os totais por dia gravados localmente, sem os dias já confirmados por
	 * {@link TechnosCore.deletedSavedData}, e resolve. Sem dados emite a lista vazia. Não fala com o relógio:
	 * chame `syncDataHistory` antes.
	 *
	 * @param daysBefore quantos dias antes de hoje incluir (hoje sempre entra). O Core atual ignora este valor no
	 * Android.
	 */
	getHistoryPedometer: (daysBefore: number): Promise<void> => NativeCoreNext.getHistoryPedometer(daysBefore),

	/**
	 * Emite `onHistorySleep` com as noites gravadas localmente, ou rejeita com `NO_DATA` (e emite `onError`) quando
	 * não há sono. Exploratório no fitGPS: o Core atual nunca emitiu sono para SMA.
	 */
	getHistorySleep: (): Promise<void> => NativeCoreNext.getHistorySleep(),

	// Fase 3: históricos e atividade. Nomes e argumentos do Core atual (`NativeCore.ts` do `v4.3.57`), com Promise no
	// lugar do `void` de lá, todas observadas; regras em `docs/api-js.md` e no `CoreBridge` do Repo 1.

	/**
	 * Emite `onHistoryHeartRate` com as horas de frequência cardíaca gravadas localmente e ainda não confirmadas por
	 * {@link TechnosCore.deletedSavedData} (categoria `HEART_HERT`), e resolve. Sem dados emite a lista vazia (nunca
	 * `NO_DATA`); falha de leitura rejeita `IO_ERROR`. As horas completas vão em `avgValues` (média, mínimo e máximo) e
	 * as leituras da hora local corrente em `otherValues`. Não fala com o relógio: chame `syncDataHistory` antes. Só o
	 * Condor Reebok mede; nos outros modelos a lista vem vazia (DP-110). Promise observada.
	 *
	 * Por enquanto (fase 3 em andamento) o nativo ainda não lê nem guarda a frequência cardíaca: o evento sai sempre com
	 * a lista vazia.
	 *
	 * @param daysBefore só vai para o log, como no `getHistoryPedometer` (entra tudo o que não foi confirmado).
	 */
	getHistoryHeartRate: (daysBefore: number): Promise<void> =>
		observed(NativeCoreNext.getHistoryHeartRate(daysBefore)),

	/**
	 * Emite `onHistoryStress` com as horas de estresse ainda não confirmadas (categoria `STRESS`), e resolve, com as
	 * mesmas regras de {@link TechnosCore.getHistoryHeartRate} (média arredondada; `stressValues` só no Condor Reebok).
	 * Promise observada. Por enquanto (fase 3 em andamento) o evento sai sempre com a lista vazia, como o da frequência
	 * cardíaca.
	 *
	 * @param daysBefore só vai para o log.
	 */
	getHistoryStress: (daysBefore: number): Promise<void> => observed(NativeCoreNext.getHistoryStress(daysBefore)),

	/**
	 * Emite `onHistorySpo2` sempre com `{ historyspo2: [] }` e resolve: nenhum modelo da PoC lê SpO2, e a produção também
	 * não lia no Condor Reebok (F3-D7). Existe porque o app Condor chama. Promise observada.
	 *
	 * @param daysBefore ignorado.
	 */
	getHistorySpO2: (daysBefore: number): Promise<void> => observed(NativeCoreNext.getHistorySpO2(daysBefore)),

	/**
	 * Emite `onHistoryActivityV2` com os treinos gravados localmente e ainda não confirmados (categoria `ACTIVITY`): os
	 * feitos no relógio (`activityOrigin: "Watch"`) e as atividades iniciadas pelo app (`"Phone"`), em ordem de início, e
	 * resolve. Sem dados emite a lista vazia; falha de leitura rejeita `IO_ERROR`. Só o Condor Reebok tem treinos; nos
	 * outros modelos a lista vem vazia (DP-110). Promise observada. Por enquanto (fase 3 em andamento) o nativo ainda não
	 * lê nem guarda treinos: o evento sai sempre com a lista vazia.
	 */
	getHistoryActivityV2: (): Promise<void> => observed(NativeCoreNext.getHistoryActivityV2()),

	/**
	 * Marca registros como já enviados ao backend; os dias deles deixam de sair em `getHistoryPedometer` e
	 * `getHistorySleep`. Mesmo formato de entrada do Core atual.
	 *
	 * Os itens são agrupados por categoria e cada grupo vai numa chamada nativa. O Core atual usa a categoria do
	 * primeiro item para a lista inteira. Lista vazia não chama o nativo.
	 *
	 * @param items registros a confirmar; de `registered_at` só o dia local é usado.
	 */
	deletedSavedData: (items: readonly SavedItemDelete[]): void => {
		for (const group of groupSavedItemsByCategory(items)) {
			NativeCoreNext.deletedSavedData(group.items, group.category);
		}
	},

	// Fase 2: ajustes, mensagens e interações. Nomes e argumentos do Core atual (`NativeCore.ts` do `v4.3.57`); regras
	// comuns no TSDoc de `setUserInfo` e em `docs/api-js.md`.

	/**
	 * Perfil do usuário. No Condor Reebok, o `0x12` com altura e peso arredondados e saturados em 0-255, a idade em anos
	 * completos pela data do telefone e o gênero; o relógio não responde, e a Promise resolve depois da escrita e de
	 * 500 ms. O nativo guarda o último perfil em memória.
	 *
	 * Regras de todos os métodos da fase 2: só o Condor Reebok executa (o fitGPS e o Life Ultra GPS rejeitam
	 * `NOT_SUPPORTED`, sem escrever nada); desconectado, `NOT_READY` (nada é guardado para reenvio); durante um sync, o
	 * comando espera o fim dele na fila; entrada malformada rejeita `INVALID_ARGUMENT` antes de chegar ao relógio; o
	 * link caindo dá `DISCONNECTED` e um `disconnectCurrentDevice` dá `CANCELLED`. Toda rejeição também sai em `onError`,
	 * e a Promise é observada (sem `await` não gera aviso).
	 *
	 * @param userInfo `{ year, month (1-12), day, weight (kg), height (cm), gender ("m", "f" ou "o"; vazio vale "o") }`.
	 */
	setUserInfo: (userInfo: TechnosUserInfoSet): Promise<void> => observed(NativeCoreNext.setUserInfo(userInfo)),

	/**
	 * Metas diárias. No Condor Reebok, o `B9 00` com passos, calorias e minutos de exercício (arredondados); a distância e
	 * `movementTimeInHours` não vão. Resolve depois da escrita.
	 */
	setGoalsV2: (goals: TechnosGoalsSet): Promise<void> => observed(NativeCoreNext.setGoalsV2(goals)),

	/**
	 * Formato da hora no relógio: `true` = 12 h (AM/PM), `false` = 24 h, como no Core. No Condor Reebok, o `17`; resolve
	 * depois da escrita.
	 */
	set12HourFormat: (enabled: boolean): Promise<void> => observed(NativeCoreNext.set12HourFormat(enabled)),

	/**
	 * Unidade de temperatura, `"c"` ou `"f"` (sem diferenciar maiúsculas; outro valor rejeita `INVALID_ARGUMENT`). No
	 * Condor Reebok, o `7C` e a consulta `8C`: resolve quando o relógio confirma a unidade, rejeita com `PROTOCOL` se ele
	 * confirmar outra e com `TIMEOUT` sem resposta em 4 s. Depois, o nativo reenvia o último clima recebido por
	 * `syncWeather`, convertido. O Core atual resolvia sem esperar o relógio.
	 */
	setTemperatureUnit: (temp: string): Promise<void> => observed(NativeCoreNext.setTemperatureUnit(temp)),

	/**
	 * Unidade de distância: `{ distance_unit: "km" }` ou `{ distance_unit: "miles" }` (também `"mi"`), como o app Condor
	 * manda. Outro valor rejeita `INVALID_ARGUMENT`. No Condor Reebok, o `1A`; resolve depois da escrita.
	 */
	setDistanceUnit: (distanceUnit: TechnosDistanceUnitUpdate): Promise<void> =>
		observed(NativeCoreNext.setDistanceUnit(distanceUnit)),

	/**
	 * Tempo de tela acesa, em segundos (arredondado; fora de 1 a 255 rejeita `INVALID_ARGUMENT`). No Condor Reebok, o
	 * `7D`; resolve depois da escrita.
	 */
	setScreenTime: (time: number): Promise<void> => observed(NativeCoreNext.setScreenTime(time)),

	/**
	 * Modo de economia de bateria. No Condor Reebok, o `94` e o eco `A4`: resolve no eco, rejeita com `PROTOCOL` se o
	 * estado ecoado for outro e com `TIMEOUT` sem eco em 4 s.
	 */
	setDeviceBatterySaving: (enabled: boolean): Promise<void> =>
		observed(NativeCoreNext.setDeviceBatterySaving(enabled)),

	/** Liga ou desliga o SOS do relógio. No Condor Reebok, o `BB 08`; resolve depois da escrita. */
	setSosHelp: (isEnabled: boolean): Promise<void> => observed(NativeCoreNext.setSosHelp(isEnabled)),

	/**
	 * Levantar o pulso para acender a tela, com a janela `"HH:mm"`. No Condor Reebok, o `18` e o `72`; resolve depois das
	 * duas escritas. Hora inválida rejeita `INVALID_ARGUMENT`.
	 */
	setGestureControlV2: (gestureControlMap: TechnosGestureControlSetV2): Promise<void> =>
		observed(NativeCoreNext.setGestureControlV2(gestureControlMap)),

	/**
	 * Ciclo menstrual, com o mês da última menstruação de **0 a 11** (contrato do Core; o perfil usa 1 a 12). Os lembretes
	 * seguem `reminder` (que o app Condor manda) ou, sem ele, `enabled`. No Condor Reebok, o `75` (o ano não vai);
	 * resolve depois da escrita.
	 */
	setMenstrual: (menstrual: TechnosMenstrualDataUpdate): Promise<void> =>
		observed(NativeCoreNext.setMenstrual(menstrual)),

	/**
	 * Frequência cardíaca automática, com os quatro argumentos posicionais do Core. No Condor Reebok, o `1F` com o
	 * intervalo em passos de 5 min (arredondado, no mínimo 1); desligado manda 0, e a janela é ignorada. Resolve depois da
	 * escrita.
	 *
	 * @param enabled liga ou desliga.
	 * @param startHour início da janela, `"HH:mm"` (ignorado no Condor Reebok).
	 * @param endHour fim da janela, `"HH:mm"` (ignorado no Condor Reebok).
	 * @param interval minutos entre medições.
	 */
	setHeartRateAutomaticCheck: (
		enabled: boolean,
		startHour: string,
		endHour: string,
		interval: number,
	): Promise<void> => observed(NativeCoreNext.setHeartRateAutomaticCheck(enabled, startHour, endHour, interval)),

	/**
	 * Estresse automático. No Condor Reebok, só o `enabled` vai (`B9 01 01`), e a consulta `B9 11 01` confirma: rejeita
	 * com `PROTOCOL` se o relógio confirmar outro estado e com `TIMEOUT` sem resposta em 4 s.
	 */
	setStressAutomaticCheck: (automaticStress: TechnosStressAutomaticUpdate): Promise<void> =>
		observed(NativeCoreNext.setStressAutomaticCheck(automaticStress)),

	/**
	 * Não perturbe. No Condor Reebok, o `71` com a janela: desligado manda `00:00-00:00`; hora vazia vale 00:00; só
	 * `alwaysOn: true` vira o dia inteiro; os dias são ignorados. Resolve depois da escrita.
	 */
	setNotDisturb: (notDisturb: TechnosNotDisturbSet): Promise<void> =>
		observed(NativeCoreNext.setNotDisturb(notDisturb)),

	/**
	 * Lembrete de água. No Condor Reebok, o `77 01` com o início (vazio = 08:00), o intervalo (1 a 255 min) e a quantidade
	 * (0 a 255); o fim e os dias são ignorados. Resolve depois da escrita.
	 */
	setWaterReminderV2: (waterReminder: TechnosWaterReminderUpdate): Promise<void> =>
		observed(NativeCoreNext.setWaterReminderV2(waterReminder)),

	/**
	 * Lembrete de sedentarismo, com o liga/desliga na chave `onOff`. No Condor Reebok, só o `onOff` vai (`1D`), e a
	 * consulta `2D` confirma: `PROTOCOL` se o relógio confirmar outro estado, `TIMEOUT` sem resposta em 4 s. O
	 * `interval` e o `stepPerHour` nunca rejeitam (texto numérico é lido; o resto vale 0).
	 */
	setWalkReminder: (walkReminder: TechnosWalkReminderUpdate): Promise<void> =>
		observed(NativeCoreNext.setWalkReminder(walkReminder)),

	/**
	 * Substitui todos os alarmes do relógio (lista vazia só apaga). Cada item usa a chave `enable` e o `repeat` de 7
	 * caracteres a partir da segunda (`"0000000"` = único, na próxima ocorrência da hora). No Condor Reebok, o `B9 05 03`
	 * e um `B9 05 00` por alarme, no máximo 8 (o resto é cortado com WARN); resolve depois das escritas. Ano acima de 2030
	 * no alarme único rejeita `PROTOCOL`.
	 */
	setAlarm: (alarmArray: TechnosAlarmSet[]): Promise<void> => observed(NativeCoreNext.setAlarm(alarmArray)),

	/**
	 * Substitui as cidades do relógio mundial (lista vazia apaga). No Condor Reebok, consulta o relógio (`BB 00 00`),
	 * apaga as cidades antigas e grava as novas; sem resposta à consulta em 4 s, `TIMEOUT`. Nome vazio rejeita
	 * `INVALID_ARGUMENT`.
	 */
	setWorldClock: (worldClockList: TechnosWorldClockSet[]): Promise<void> =>
		observed(NativeCoreNext.setWorldClock(worldClockList)),

	/**
	 * Filtro de notificações no relógio: nome do app ou chave fixa → ligado. No Condor Reebok, consulta os tipos do
	 * relógio (`B9 14 00`, uma vez por conexão) e grava o filtro (`B9 04`); sem resposta à consulta, resolve sem gravar
	 * (WARN no log). Não encaminha notificações: no iPhone elas chegam pelo ANCS; no Android o encaminhamento ainda não
	 * existe.
	 *
	 * @param notifications chave → ligado.
	 * @param shouldShowNotificationModal ignorado (o app Condor sempre manda `false`); padrão `true`, como no Core.
	 */
	manageNotifications: (
		notifications: TechnosManageNotificationsUpdate,
		shouldShowNotificationModal = true,
	): Promise<void> => observed(NativeCoreNext.manageNotifications(notifications, shouldShowNotificationModal)),

	/**
	 * Substitui a agenda do relógio (lista vazia apaga). No Condor Reebok, apaga todos (`F2 EF`) e grava um `F2 02` por
	 * contato com número; rejeita com `PROTOCOL` se o relógio recusar um contato ou o apagar.
	 */
	setAddressBook: (contactList: TechnosContactItem[]): Promise<void> =>
		observed(NativeCoreNext.setAddressBook(contactList)),

	/**
	 * Clima de hoje (item 0) e previsão (até 7 dias, contando hoje). O nativo guarda o último clima não vazio, em °C, e o
	 * reenvia depois de cada `setTemperatureUnit`; lista vazia resolve sem enviar e sem apagar o guardado. No Condor
	 * Reebok, consulta a unidade (`8C`, sem rejeitar se não vier) e manda `43`, `B5 00` e `42`. No Core atual é `void`.
	 */
	syncWeather: (weatherList: TechnosWeatherListUpdateItem[]): Promise<void> =>
		observed(NativeCoreNext.syncWeather(weatherList)),

	/** Faz o relógio vibrar (`61` no Condor Reebok, sem resposta). Durante um sync, espera o fim. No Core é `void`. */
	vibrateDevice: (): Promise<void> => observed(NativeCoreNext.vibrateDevice()),

	/**
	 * Abre a câmera no relógio (`66` no Condor Reebok). Depois da escrita, emite `onOpenCameraMode` e resolve; a partir
	 * daí, cada disparo no relógio vira `onTakeAPicture`. Um `closeCameraMode` chamado antes de a abertura terminar (na
	 * fila atrás de um sync, por exemplo) vence: ela resolve sem o evento e o modo fica fechado. No Core atual é `void`,
	 * e o Core Android do Condor nunca emitia `onOpenCameraMode`.
	 */
	openCameraMode: (): Promise<void> => observed(NativeCoreNext.openCameraMode()),

	/**
	 * Fecha a câmera no relógio (`53 0E` no Condor Reebok). Desconectado, só zera o estado da câmera e resolve, sem
	 * rejeitar (o app Condor chama ao sair da tela, muitas vezes já desconectado). No Core atual é `void`.
	 */
	closeCameraMode: (): Promise<void> => observed(NativeCoreNext.closeCameraMode()),

	/**
	 * Inicia uma atividade no relógio (fase 3, só o Condor Reebok). Resolve depois das escritas; o início confirmado pelo
	 * relógio sai em `onActivityStartedV2` (status 2) e, a partir dele, um `onActivityUpdateV2` por segundo. O relógio
	 * tem 10 s, contados desta chamada, para confirmar; sem isso, `onActivityError` com `errorCode` -1 e a atividade não
	 * começa.
	 *
	 * Erros em `onActivityError`: -1 sem conexão (`NOT_READY`), em modelo sem atividade pelo app (`NOT_SUPPORTED`), com
	 * argumento inválido (`INVALID_ARGUMENT`) ou sem confirmação no prazo; 1 com uma atividade já em andamento (resolve);
	 * 2 com a bateria do relógio baixa (`LOW_BATTERY`). As rejeições também saem em `onError`. Sem GPS: a distância é
	 * a do relógio (DP-127). Promise observada. No Core atual é `void`.
	 *
	 * Por enquanto (fase 3 em andamento) a atividade iniciada pelo app não está ligada: em todo modelo, o nativo emite
	 * `onActivityError` com `errorCode` -1 na hora e resolve, sem falar com o relógio.
	 *
	 * @param activityOptions `type` (de {@link TechnosCore.activityTypes}) é obrigatório; as metas são ignoradas.
	 */
	startActivityByTypeV2: (activityOptions: TechnosActivityByTypeStartV2): Promise<void> =>
		observed(NativeCoreNext.startActivityByTypeV2(activityOptions)),

	/**
	 * Pausa a atividade em andamento: depois da escrita, emite `onActivityStatusV2` (status 4) e resolve, sem esperar o
	 * eco do relógio (DP-122). Sem atividade, resolve sem falar com o relógio. Durante um sync, espera o fim dele na
	 * fila. Promise observada. No Core atual é `void`. Por enquanto (fase 3 em andamento) nenhuma atividade chega a
	 * começar, então resolve sem falar com o relógio e sem evento.
	 */
	pauseActivityV2: (): Promise<void> => observed(NativeCoreNext.pauseActivityV2()),

	/**
	 * Retoma a atividade pausada: depois da escrita, emite `onActivityStatusV2` (status 3) e resolve, como
	 * {@link TechnosCore.pauseActivityV2}. Promise observada. No Core atual é `void`. Por enquanto, como a pausa, resolve
	 * sem falar com o relógio e sem evento.
	 */
	resumeActivityV2: (): Promise<void> => observed(NativeCoreNext.resumeActivityV2()),

	/**
	 * Encerra a atividade: lê o registro do treino no relógio, emite `onActivityCompletedV2` (status 0) e resolve. Uma
	 * falha ou queda no caminho fecha com os dados do telefone. Com `{ forceStop: true }`, encerra só no telefone, sem
	 * evento e sem registro, e resolve na hora (o app sobe ele mesmo o último update; DP-124). Sem atividade, resolve sem
	 * falar com o relógio. Promise observada. No Core atual é `void`. Por enquanto, como a pausa, resolve sem falar com o
	 * relógio e sem evento.
	 *
	 * @param finishActivityOptions opcional, como no Core; sem ele, o nativo recebe `{}`.
	 */
	stopActivityV2: (finishActivityOptions?: TechnosActivityByTypeStop): Promise<void> =>
		observed(NativeCoreNext.stopActivityV2(finishActivityOptions ?? {})),

	/**
	 * Autorização de localização em segundo plano: no iOS, `"granted"` só com "Sempre" e `"denied"` no resto; no Android
	 * rejeita `NOT_SUPPORTED` (também em `onError`), onde o Core atual rejeitava `"-1"`. Não pede permissão. Promise
	 * observada. Por enquanto (fase 3 em andamento) o iOS responde sempre `"denied"`: a leitura do `CLLocationManager`
	 * ainda não está ligada.
	 */
	checkIosBackgroundLocationPermission: (): Promise<string> =>
		observed(NativeCoreNext.checkIosBackgroundLocationPermission()),

	/**
	 * Últimas entradas do log nativo, da mais nova para a mais antiga (o nativo guarda até 2000). Novo.
	 *
	 * @param limit quantidade máxima de entradas.
	 */
	getLogs: async (limit: number): Promise<LogEvent[]> => (await NativeCoreNext.getLogs(limit)) as LogEvent[],

	/**
	 * Grava o log e a gravação dos frames em arquivos `.jsonl` e devolve o caminho absoluto da gravação de frames
	 * (formato de fixture); o log fica ao lado, com o mesmo carimbo. Rejeita com `IO_ERROR`. Novo; substitui o
	 * `shareLogs` do Core atual.
	 */
	exportLogs: (): Promise<string> => NativeCoreNext.exportLogs(),

	/** Esvazia o log em memória do nativo. Novo. */
	clearLogs: (): void => NativeCoreNext.clearLogs(),

	/**
	 * Nível mínimo do log nativo. Novo.
	 *
	 * @param level um dos {@link logLevels}.
	 */
	setLogLevel: (level: LogLevelValue): void => NativeCoreNext.setLogLevel(level),
};

const typed = <K extends keyof TechnosEventMap>(name: K): TechnosEventEmitter<TechnosEventMap[K]> =>
	NativeCoreNext[name] as unknown as TechnosEventEmitter<TechnosEventMap[K]>;

/**
 * Emissores de eventos do módulo nativo, tipados com os formatos de `src/types/events.ts`.
 *
 * Uso: `const sub = TechnosEvents.onBatteryStatus(e => ...); sub.remove();`. Mesmos nomes do Core atual;
 * `onDeviceInfo`, `onError` e `onLog` são novos. Os eventos espontâneos do relógio da fase 2 (`onFindPhone`,
 * `onTakeAPicture`, `onDeviceRequestedCameraMode`) e o `onOpenCameraMode` não são guardados enquanto o JS não existe.
 * Da fase 3, os quatro históricos e o `onActivityCompletedV2` são guardados e entregues quando o JS volta; os outros
 * eventos de atividade não (DP-132).
 */
export const TechnosEvents: TechnosEventEmitters = {
	/** Um relógio suportado apareceu na busca. */
	onScannedDevice: typed("onScannedDevice"),
	/** O estado da conexão mudou. */
	onConnectStateChanged: typed("onConnectStateChanged"),
	/** Resposta de `getDeviceInfo`. */
	onDeviceInfo: typed("onDeviceInfo"),
	/** Resposta de `getFirmwareInfo`. */
	onFirmwareInfo: typed("onFirmwareInfo"),
	/** Resposta de `getBatteryStatus`, ou aviso do relógio (Condor Reebok). */
	onBatteryStatus: typed("onBatteryStatus"),
	/**
	 * Total de passos de hoje, depois de `refreshSteps`, quando o relógio avisa que os dados mudaram ou, no Condor
	 * Reebok, com os passos ao vivo (no máximo um a cada 2 s).
	 */
	onPedometer: typed("onPedometer"),
	/** Resposta de `getHistoryPedometer`. */
	onHistoryPedometer: typed("onHistoryPedometer"),
	/** Resposta de `getHistorySleep`. */
	onHistorySleep: typed("onHistorySleep"),
	/** Início de `syncDataHistory`. */
	onSyncStarted: typed("onSyncStarted"),
	/** Progresso de `syncDataHistory`, de 0 a 100. */
	onSyncProgress: typed("onSyncProgress"),
	/** Fim com sucesso de `syncDataHistory`. */
	onSyncFinished: typed("onSyncFinished"),
	/** O relógio começou (`status: "1"`) ou parou (`"0"`) de procurar o telefone. Só o Condor Reebok. */
	onFindPhone: typed("onFindPhone"),
	/** Disparo da câmera no relógio com o modo câmera aberto por `openCameraMode`. */
	onTakeAPicture: typed("onTakeAPicture"),
	/** A abertura de `openCameraMode` foi escrita; sai antes de a Promise resolver. */
	onOpenCameraMode: typed("onOpenCameraMode"),
	/** Disparo da câmera no relógio com o modo câmera fechado. */
	onDeviceRequestedCameraMode: typed("onDeviceRequestedCameraMode"),
	/** Resposta de `getHistoryHeartRate`. */
	onHistoryHeartRate: typed("onHistoryHeartRate"),
	/** Resposta de `getHistoryStress`. */
	onHistoryStress: typed("onHistoryStress"),
	/** Resposta de `getHistorySpO2`, sempre com a lista vazia. */
	onHistorySpo2: typed("onHistorySpo2"),
	/** Resposta de `getHistoryActivityV2`. */
	onHistoryActivityV2: typed("onHistoryActivityV2"),
	/** O relógio confirmou o início pedido por `startActivityByTypeV2` (status 2). */
	onActivityStartedV2: typed("onActivityStartedV2"),
	/** Pausa (status 4) ou retomada (status 3), pelo app ou no relógio. */
	onActivityStatusV2: typed("onActivityStatusV2"),
	/** Atualização da atividade em andamento a cada 1 s (status 2 ou 3), com a duração pelo relógio do telefone. */
	onActivityUpdateV2: typed("onActivityUpdateV2"),
	/** Fim da atividade (status 0), pelo `stopActivityV2` ou no relógio. */
	onActivityCompletedV2: typed("onActivityCompletedV2"),
	/** Falha ou recusa da atividade (`errorCode` -1, 1 ou 2). */
	onActivityError: typed("onActivityError"),
	/** Velocidade em tempo real. Declarado por compatibilidade; nunca sai (sem GPS, DP-127). */
	onActivityRealTimeSpeed: typed("onActivityRealTimeSpeed"),
	/** Falha de um comando (toda rejeição) ou do link. */
	onError: typed("onError"),
	/** Cada entrada do log nativo, inclusive os pacotes GATT em hex. */
	onLog: typed("onLog"),
};

export {
	ActionType,
	PlanType,
	TechnosActivityErrorCode,
	TechnosActivityOrigin,
	TechnosActivityV2Status,
} from "./activityEnums";
export type { TechnosExerciseGoalTypes } from "./activityEnums";
export { TechnosMapStyles } from "./components/mapStyles";
export { TechnosNativeActionTimer } from "./components/TechnosNativeActionTimer";
export { TechnosNativeChronometer } from "./components/TechnosNativeChronometer";
export type { TechnosNativeChronometerProps } from "./components/TechnosNativeChronometer";
export { TechnosNativeMap } from "./components/TechnosNativeMap";
export type { TechnosNativeMapProps } from "./components/TechnosNativeMap";
export { deletedCategory, deviceConnectStates, errorCodes, logLevels, technosEventNames } from "./constants";
export type { DeletedCategory, DeviceConnectState, ErrorCode, LogLevelName, LogLevelValue } from "./constants";
export { utils };
export type { TechnosCoreError } from "./utils/errors";
export type { SavedItemsGroup } from "./utils/savedData";
export type * from "./types";

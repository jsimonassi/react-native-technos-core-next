import type { CodegenTypes, TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

/**
 * Payload genérico de eventos e dicionários. No Android vira `ReadableMap`/`WritableMap`.
 * Os formatos de cada evento estão em `src/types` e em `docs/api-js.md`.
 */
type NativeDictionary = CodegenTypes.UnsafeObject;

/**
 * Contrato do TurboModule. Mudou aqui, muda o codegen: mantenha `docs/api-js.md` em sincronia.
 *
 * Regra geral: comandos que falam com o relógio devolvem `Promise<void>` que resolve quando o relógio confirma
 * e rejeita com o código de erro (`TIMEOUT`, `NOT_READY`...). O dado em si chega pelo evento correspondente,
 * como no Core atual, para o `getNativeEventData` do app continuar funcionando. Onde o relógio não responde (a maioria
 * dos ajustes da fase 2), a Promise resolve depois da escrita e do intervalo da fila.
 *
 * Os ajustes, mensagens e interações da fase 2 têm os nomes e argumentos do Core atual (`TechnosWareCore` `v4.3.57`,
 * `src/NativeModules/specs/NativeCore.ts`), todos com `Promise<void>`, inclusive os que lá são `void`. Só o Condor
 * Reebok os executa; o fitGPS e o Life Ultra GPS rejeitam `NOT_SUPPORTED`. Os formatos dos dicionários estão em
 * `src/types/watchSettings.ts`.
 */
export interface Spec extends TurboModule {
	/** Cria o grafo nativo (sessão, transporte, logger). Idempotente. */
	initialize(): Promise<void>;
	/** Alias de compatibilidade com o Core atual; chama `initialize`. */
	initSMASDK(): Promise<void>;

	/** Procura relógios por 7 s. Cada modelo suportado vira um `onScannedDevice`. */
	scan(): void;
	/** Para o scan antes dos 7 s. Sem efeito se não houver scan (`docs/api-js.md`, `stopScan`). */
	stopScan(): void;

	/** Primeiro pareamento. Resolve quando a sessão chega em READY. */
	pairDevice(deviceId: string, name: string): Promise<void>;
	/** Reconecta ao relógio já pareado. Resolve assim que a reconexão é pedida (pode demorar a acontecer). */
	startPairingAttempt(deviceId: string, name: string): Promise<void>;
	/** Desconecta sem esquecer o relógio. */
	disconnectCurrentDevice(): Promise<void>;
	/** Desconecta, desfaz o vínculo no relógio e apaga o histórico local. Nunca faz reset de fábrica. */
	forgetDevice(): Promise<void>;
	/** Reset de fábrica do relógio (`51 02` no Condor Reebok). Não esquece o pareamento salvo: o app decide. */
	resetDevice(): Promise<void>;
	/** `true` em READY ou SYNCING. Lê o estado da sessão; não fala com o relógio. */
	isConnected(): Promise<boolean>;
	/** Último relógio pareado `{ deviceId, name, profileId }`, ou `null`. */
	getLastPairedDevice(): Promise<NativeDictionary>;

	/** Lê a versão do relógio e emite `onDeviceInfo`. */
	getDeviceInfo(): Promise<void>;
	/** Mesma leitura de `getDeviceInfo`, emitida como `onFirmwareInfo` (formato do Core atual). */
	getFirmwareInfo(): Promise<void>;
	/** Lê a bateria e emite `onBatteryStatus`. */
	getBatteryStatus(): Promise<void>;
	/** Acerta o relógio com a hora e o fuso do telefone. Sem evento: a Promise é o resultado. */
	setTime(): Promise<void>;
	/** Lê os passos recentes do relógio e emite `onPedometer` com o total de hoje. */
	refreshSteps(): Promise<void>;

	/** Lê o histórico do relógio (passos e sono) e grava localmente. Emite `onSyncStarted/Progress/Finished`. */
	syncDataHistory(): Promise<void>;
	/** Emite `onHistoryPedometer` a partir do histórico local. Não fala com o relógio. */
	getHistoryPedometer(daysBefore: number): Promise<void>;
	/** Emite `onHistorySleep` a partir do histórico local, ou `onError` com `NO_DATA`. */
	getHistorySleep(): Promise<void>;
	/** Marca registros como enviados ao backend (mesmo formato do Core atual). */
	deletedSavedData(filteredArrayData: NativeDictionary[], category: number): void;

	/** Perfil do usuário (`TechnosUserInfoSet`: altura, peso, nascimento com mês 1-12, gênero). */
	setUserInfo(userInfo: NativeDictionary): Promise<void>;
	/** Metas diárias (`TechnosGoalsSet`). */
	setGoalsV2(goals: NativeDictionary): Promise<void>;
	/** `true` = 12 h (AM/PM), `false` = 24 h. */
	set12HourFormat(enabled: boolean): Promise<void>;
	/** `"c"` ou `"f"`. Resolve quando o relógio confirma a unidade; depois o nativo reenvia o último clima. */
	setTemperatureUnit(temp: string): Promise<void>;
	/** `{ distance_unit: "km" | "miles" }` (`TechnosDistanceUnitUpdate`). */
	setDistanceUnit(distanceUnit: NativeDictionary): Promise<void>;
	/** Tempo de tela acesa, em segundos (1 a 255). */
	setScreenTime(time: number): Promise<void>;
	/** Modo de economia de bateria. Resolve no eco do relógio. */
	setDeviceBatterySaving(enabled: boolean): Promise<void>;
	/** Liga ou desliga o SOS do relógio. */
	setSosHelp(isEnabled: boolean): Promise<void>;
	/** Levantar o pulso para acender, com janela (`TechnosGestureControlSetV2`). */
	setGestureControlV2(gestureControlMap: NativeDictionary): Promise<void>;
	/** Ciclo menstrual (`TechnosMenstrualDataUpdate`, mês 0-11). */
	setMenstrual(menstrual: NativeDictionary): Promise<void>;
	/** Frequência cardíaca automática; no Condor Reebok só o intervalo (minutos) vale, a janela é ignorada. */
	setHeartRateAutomaticCheck(enabled: boolean, startHour: string, endHour: string, interval: number): Promise<void>;
	/** Estresse automático (`TechnosStressAutomaticUpdate`). Resolve quando o relógio confirma o estado. */
	setStressAutomaticCheck(automaticStress: NativeDictionary): Promise<void>;
	/** Não perturbe (`TechnosNotDisturbSet`). */
	setNotDisturb(notDisturb: NativeDictionary): Promise<void>;
	/** Lembrete de água (`TechnosWaterReminderUpdate`). */
	setWaterReminderV2(waterReminder: NativeDictionary): Promise<void>;
	/** Lembrete de sedentarismo (`TechnosWalkReminderUpdate`, chave `onOff`). Resolve quando o relógio confirma. */
	setWalkReminder(walkReminder: NativeDictionary): Promise<void>;
	/** Substitui todos os alarmes (`TechnosAlarmSet[]`, chave `enable`); lista vazia apaga todos. */
	setAlarm(alarmArray: NativeDictionary[]): Promise<void>;
	/** Substitui as cidades do relógio mundial (`TechnosWorldClockSet[]`). */
	setWorldClock(worldClockList: NativeDictionary[]): Promise<void>;
	/** Filtro de notificações no relógio (`TechnosManageNotificationsUpdate`); o segundo argumento é ignorado. */
	manageNotifications(notifications: NativeDictionary, shouldShowNotificationModal: boolean): Promise<void>;
	/** Substitui a agenda do relógio (`TechnosContactItem[]`); lista vazia apaga todos. */
	setAddressBook(contactList: NativeDictionary[]): Promise<void>;
	/** Clima de hoje e previsão (`TechnosWeatherListUpdateItem[]`); lista vazia resolve sem enviar. */
	syncWeather(weatherList: NativeDictionary[]): Promise<void>;
	/** Faz o relógio vibrar. */
	vibrateDevice(): Promise<void>;
	/** Abre a câmera no relógio; emite `onOpenCameraMode` antes de resolver. */
	openCameraMode(): Promise<void>;
	/** Fecha a câmera no relógio. Desconectado, só zera o estado e resolve. */
	closeCameraMode(): Promise<void>;

	/** Últimas entradas do log em memória, da mais nova para a mais antiga. */
	getLogs(limit: number): Promise<NativeDictionary[]>;
	/** Grava o log e a gravação de frames em arquivo e devolve o caminho do arquivo `.jsonl`. */
	exportLogs(): Promise<string>;
	/** Esvazia o anel de log e começa uma gravação de frames nova. */
	clearLogs(): void;
	/** 0 = DEBUG, 1 = INFO, 2 = WARN, 3 = ERROR. */
	setLogLevel(level: number): void;

	/** Relógio achado no scan (`ScannedDeviceEvent`, `docs/api-js.md`, Eventos). */
	readonly onScannedDevice: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Mudança de estado da sessão (`ConnectStateChangedEvent`); o `initialize` reenvia o estado atual. */
	readonly onConnectStateChanged: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Identificação do relógio (`DeviceInfoEvent`). */
	readonly onDeviceInfo: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Versão do firmware no formato do Core atual (`FirmwareInfoEvent`). */
	readonly onFirmwareInfo: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Bateria em percentual (`BatteryStatusEvent`). */
	readonly onBatteryStatus: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Total de passos de hoje (`PedometerEvent`), de `refreshSteps` ou de um aviso do relógio. */
	readonly onPedometer: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Dias de passos ainda não confirmados (`HistoryPedometerEvent`), resposta de `getHistoryPedometer`. */
	readonly onHistoryPedometer: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Noites de sono ainda não confirmadas (`HistorySleepEvent`), resposta de `getHistorySleep`. Exploratório. */
	readonly onHistorySleep: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Começo de um `syncDataHistory` (`SyncStartedEvent`, vazio). */
	readonly onSyncStarted: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Progresso do sync, 0 a 100 (`SyncProgressEvent`). */
	readonly onSyncProgress: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Fim com sucesso do sync (`SyncFinishedEvent`, vazio); falha sai em `onError`. */
	readonly onSyncFinished: CodegenTypes.EventEmitter<NativeDictionary>;
	/** O relógio começou (`status: "1"`) ou parou (`"0"`) de procurar o telefone (`FindPhoneEvent`); sem fila. */
	readonly onFindPhone: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Disparo da câmera no relógio com o modo câmera aberto (`TakeAPictureEvent`, vazio); sem fila. */
	readonly onTakeAPicture: CodegenTypes.EventEmitter<NativeDictionary>;
	/** A abertura de `openCameraMode` foi escrita (`OpenCameraModeEvent`, vazio); sai antes do resolve. */
	readonly onOpenCameraMode: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Disparo da câmera no relógio com o modo câmera fechado (`DeviceRequestedCameraModeEvent`, vazio); sem fila. */
	readonly onDeviceRequestedCameraMode: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Toda falha de comando e erros espontâneos (`ErrorEvent`, com `code`, `message` e `method`). */
	readonly onError: CodegenTypes.EventEmitter<NativeDictionary>;
	/** Cada entrada do log nativo (`LogEvent`); não é guardada enquanto o JS não existe. */
	readonly onLog: CodegenTypes.EventEmitter<NativeDictionary>;
}

export default TurboModuleRegistry.getEnforcing<Spec>("NativeCoreNext");

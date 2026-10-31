/**
 * Formato dos eventos emitidos pelo módulo nativo.
 *
 * É o contrato entre o código nativo (o `EventMapper` do `:bridge` do `technos-watch-protocol`) e o JavaScript.
 * Onde existe equivalente no Core atual (`react-native-technos-ware-core`), os nomes e tipos são os mesmos,
 * para o app Mormaii trocar de pacote mudando só o import. Campos novos são opcionais para o app atual.
 *
 * Datas: ISO-8601 com offset do telefone, `yyyy-MM-dd'T'HH:mm:ssXXX` (ex.: `"2026-10-28T00:00:00-03:00"`),
 * o mesmo formato de `SMAHelper.getDateString` no Core atual.
 */

/** `onScannedDevice`. `name` é o `appName` do perfil, que o app usa no filtro `ALLOWED_DEVICE_NAMES`. */
export interface ScannedDeviceEvent {
	name: string;
	deviceId: string;
	rssi: number;
	/** Nome de advertising (ex.: `"Mormaii_fitGPS"`, `"P85"` no Condor Reebok). Novo. */
	bleName: string;
	/** Id do perfil no módulo de protocolo (ex.: `"fitgps"`, `"condorreebok"`). Novo. */
	profileId: string;
}

/** `onConnectStateChanged`. `state` segue `deviceConnectStates`. */
export interface ConnectStateChangedEvent {
	state: number;
	/** Estado detalhado da sessão (`DISCONNECTED`, `CONNECTING`, `CONFIGURING`, `HANDSHAKING`, `READY`, `SYNCING`, `RECONNECTING`, `BLUETOOTH_OFF`). Novo. */
	sessionState: string;
	/**
	 * Subetapa do handshake ou `null`. Novo. `"BIND"` e `"LOGIN"` no fitGPS e no Life Ultra GPS; `"VERSION"` no Condor
	 * Reebok (leitura da versão do protocolo, no pareamento e na reconexão; não há confirmação no relógio).
	 */
	phase: string | null;
}

/** `onDeviceInfo`. Novo (o Core atual não emite device info para SMA). */
export interface DeviceInfoEvent {
	deviceId: string;
	profileId: string;
	bleName: string;
	firmware: string;
	/** Versão do protocolo BLE, quando o relógio informa. No Condor Reebok, o texto lido em 2A29 (`"MOYOUNG-V2"`). */
	bleVersion: string | null;
}

/** `onFirmwareInfo`, igual ao `TechnosFirmwareInfo` do Core atual. */
export interface FirmwareInfoEvent {
	version: string;
	braceletType: number;
	platformCode: number;
	deviceId: string;
}

/**
 * `onBatteryStatus`, igual ao `TechnosBatteryStatus` do Core atual. Vem de `getBatteryStatus` ou, no Condor Reebok,
 * também sozinho (o relógio avisa cerca de uma vez por minuto).
 */
export interface BatteryStatusEvent {
	percentage: number;
	/**
	 * `true` carregando. Só o Condor Reebok informa: uma leitura acima de 100 quer dizer carregando, com nível = valor -
	 * 100 (regra do Core atual). No fitGPS e no Life Ultra GPS é sempre `false`.
	 */
	charging: boolean;
	/** @deprecated Use `percentage`. Mantido por compatibilidade (`"85%"`). */
	battery: string;
}

/** `onPedometer`: total de hoje. `pedometer` como no Core atual; os demais campos são novos. */
export interface PedometerEvent {
	pedometer: number;
	calorie: number;
	/** Metros. */
	distance: number;
	/** Início do dia local. */
	date: string;
}

/** Um dia em `onHistoryPedometer`, igual ao `TechnosPedometerHistoryOfDate` do Core atual. */
export interface PedometerHistoryDay {
	/** Início do dia local (referência: Core iOS atual). */
	date: string;
	/** Metros. */
	distance: number;
	calorie: number;
	pedometer: number;
}

/** `onHistoryPedometer`. */
export interface HistoryPedometerEvent {
	historypedometer: PedometerHistoryDay[];
}

/** Um estágio de sono. `typeItem`: 1 acordado, 2 leve, 3 profundo, 4 REM. */
export interface SleepItem {
	typeItem: number;
	startItem: string;
	endItem: string;
}

export interface SleepRespiratoryRateItem {
	value: number;
	date: string;
}

/** Igual ao `TechnosSleepHistoryDayInfo` do Core atual. O SMA não mede respiração nem REM. */
export interface SleepDayInfo {
	start: string;
	end: string;
	items: SleepItem[];
	respiratoryRateItems: SleepRespiratoryRateItem[];
	totalSleepMinutes: number;
	lightSleepMinutes: number;
	deepSleepMinutes: number;
	remSleepMinutes: number;
	wakeUpMinutes: number;
}

/** Um dia em `onHistorySleep`. `date` é o início do dia em que a pessoa acordou. */
export interface SleepHistoryDay {
	date: string;
	sleep: SleepDayInfo;
}

/** `onHistorySleep`. */
export interface HistorySleepEvent {
	historysleep: SleepHistoryDay[];
}

/** `onSyncStarted` e `onSyncFinished` não têm campos. */
export type SyncStartedEvent = Record<string, never>;
export type SyncFinishedEvent = Record<string, never>;

/** `onSyncProgress`, de 0 a 100. */
export interface SyncProgressEvent {
	progress: number;
}

/** `onError`. Novo. Toda Promise rejeitada também gera este evento. */
export interface ErrorEvent {
	/** `-1` quando o erro não veio de um comando. */
	requestId: number;
	/** Um dos `errorCodes`. */
	code: string;
	message: string;
	/**
	 * Método do módulo que originou o erro (ex.: `"getBatteryStatus"`), ou `null`. `"classicBond"` no
	 * `CLASSIC_BOND_FAILED`, que nasce no nativo quando a conexão fica pronta, e não num método JS.
	 */
	method: string | null;
}

/** `onLog` e itens de `getLogs`. Novo. */
export interface LogEvent {
	/** Epoch millis. */
	ts: number;
	level: "DEBUG" | "INFO" | "WARN" | "ERROR";
	tag: string;
	message: string;
	/**
	 * Preenchido só para pacotes GATT: `"TX"` escrito pelo app, `"RX"` notificação do relógio, `"READ"` valor devolvido
	 * por uma leitura GATT (no Condor Reebok, versão, firmware, bateria e passos do dia).
	 */
	dir: "TX" | "RX" | "READ" | null;
	/** Bytes do pacote em hex maiúsculo, só para pacotes GATT. */
	hex: string | null;
}

/** Retorno de `getLastPairedDevice`. */
export interface LastPairedDevice {
	deviceId: string;
	name: string;
	profileId: string;
}

/** Item aceito por `deletedSavedData`, igual ao `TechnosSavedItemDelete` do Core atual. */
export interface SavedItemDelete {
	category: number;
	/** ISO-8601; só o dia local é usado. */
	registered_at: string;
}

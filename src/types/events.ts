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
	/** Nome de advertising (ex.: `"Mormaii_fitGPS"`). Novo. */
	bleName: string;
	/** Id do perfil no módulo de protocolo (ex.: `"fitgps"`). Novo. */
	profileId: string;
}

/** `onConnectStateChanged`. `state` segue `deviceConnectStates`. */
export interface ConnectStateChangedEvent {
	state: number;
	/** Estado detalhado da sessão (`DISCONNECTED`, `CONNECTING`, `CONFIGURING`, `HANDSHAKING`, `READY`, `SYNCING`, `RECONNECTING`, `BLUETOOTH_OFF`). Novo. */
	sessionState: string;
	/** Subetapa do handshake (`"BIND"`, `"LOGIN"`) ou `null`. Novo. */
	phase: string | null;
}

/** `onDeviceInfo`. Novo (o Core atual não emite device info para SMA). */
export interface DeviceInfoEvent {
	deviceId: string;
	profileId: string;
	bleName: string;
	firmware: string;
	bleVersion: string | null;
}

/** `onFirmwareInfo`, igual ao `TechnosFirmwareInfo` do Core atual. */
export interface FirmwareInfoEvent {
	version: string;
	braceletType: number;
	platformCode: number;
	deviceId: string;
}

/** `onBatteryStatus`, igual ao `TechnosBatteryStatus` do Core atual. */
export interface BatteryStatusEvent {
	percentage: number;
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
	/** Método do módulo que originou o erro (ex.: `"getBatteryStatus"`), ou `null`. */
	method: string | null;
}

/** `onLog` e itens de `getLogs`. Novo. */
export interface LogEvent {
	/** Epoch millis. */
	ts: number;
	level: "DEBUG" | "INFO" | "WARN" | "ERROR";
	tag: string;
	message: string;
	/** Preenchido só para pacotes GATT. */
	dir: "TX" | "RX" | null;
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

import type {
	BatteryStatusEvent,
	ConnectStateChangedEvent,
	DeviceInfoEvent,
	ErrorEvent,
	FindPhoneEvent,
	FirmwareInfoEvent,
	HistoryPedometerEvent,
	HistorySleepEvent,
	PedometerEvent,
	ScannedDeviceEvent,
	TechnosEventMap,
	TechnosEventName,
} from "react-native-technos-core-next";

/** Situação do último `syncDataHistory`, montada a partir de `onSyncStarted/Progress/Finished` e `onError`. */
export interface SyncState {
	status: "idle" | "running" | "finished" | "failed";
	/** 0 a 100. */
	progress: number;
	startedAt: number | null;
	finishedAt: number | null;
	error: ErrorEvent | null;
}

/** Eventos espontâneos do relógio e da câmera (fase 2), mostrados em lista na aba Ajustes. */
export type WatchEventName = "onFindPhone" | "onTakeAPicture" | "onOpenCameraMode" | "onDeviceRequestedCameraMode";

/** Uma linha da lista de eventos do relógio. */
export interface WatchEventEntry {
	/** Sequencial, para chave de lista. */
	id: number;
	name: WatchEventName;
	payload: TechnosEventMap[WatchEventName];
	at: number;
}

/** Quantos eventos do relógio a aba Ajustes guarda, do mais novo para o mais antigo. */
export const WATCH_EVENTS_CAPACITY = 30;

/** Último valor de cada evento (exceto `onLog`, que fica num ring separado). */
export interface CoreState {
	/** Relógios vistos na busca, na ordem em que apareceram; o RSSI é o mais recente. */
	devices: ScannedDeviceEvent[];
	connection: ConnectStateChangedEvent | null;
	deviceInfo: DeviceInfoEvent | null;
	firmwareInfo: FirmwareInfoEvent | null;
	battery: BatteryStatusEvent | null;
	pedometer: PedometerEvent | null;
	historyPedometer: HistoryPedometerEvent | null;
	historySleep: HistorySleepEvent | null;
	/** Último `onFindPhone` (o App vibra o telefone com `status: "1"`). */
	findPhone: FindPhoneEvent | null;
	/** Eventos do relógio e da câmera, do mais novo para o mais antigo (até {@link WATCH_EVENTS_CAPACITY}). */
	watchEvents: WatchEventEntry[];
	/** Total de eventos do relógio desde o início (dá o `id` de cada linha). */
	watchEventTotal: number;
	sync: SyncState;
	lastError: ErrorEvent | null;
	/** Epoch millis da última vez que cada evento chegou. */
	receivedAt: Partial<Record<TechnosEventName, number>>;
}

/** Um evento recebido do módulo. */
export type CoreEventAction = {
	[K in TechnosEventName]: { type: "event"; name: K; payload: TechnosEventMap[K]; at: number };
}[TechnosEventName];

/** Ações do reducer. */
export type CoreAction = CoreEventAction | { type: "clearDevices" } | { type: "clearError" };

/** Estado antes de qualquer evento. */
export const initialCoreState: CoreState = {
	devices: [],
	connection: null,
	deviceInfo: null,
	firmwareInfo: null,
	battery: null,
	pedometer: null,
	historyPedometer: null,
	historySleep: null,
	findPhone: null,
	watchEvents: [],
	watchEventTotal: 0,
	sync: { status: "idle", progress: 0, startedAt: null, finishedAt: null, error: null },
	lastError: null,
	receivedAt: {},
};

const upsertDevice = (devices: ScannedDeviceEvent[], device: ScannedDeviceEvent): ScannedDeviceEvent[] => {
	const index = devices.findIndex(item => item.deviceId === device.deviceId);
	if (index < 0) {
		return [...devices, device];
	}
	const next = devices.slice();
	next[index] = device;
	return next;
};

const clampProgress = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const pushWatchEvent = (
	state: CoreState,
	name: WatchEventName,
	payload: TechnosEventMap[WatchEventName],
	at: number,
): Pick<CoreState, "watchEvents" | "watchEventTotal"> => {
	const id = state.watchEventTotal + 1;
	return {
		watchEvents: [{ id, name, payload, at }, ...state.watchEvents].slice(0, WATCH_EVENTS_CAPACITY),
		watchEventTotal: id,
	};
};

/**
 * Um erro encerra o sync em andamento quando veio do próprio `syncDataHistory` ou não veio de comando nenhum
 * (queda do link durante o sync chega com `method: null`).
 */
const errorEndsSync = (sync: SyncState, error: ErrorEvent): boolean =>
	sync.status === "running" && (error.method === "syncDataHistory" || error.method === null);

const applyEvent = (state: CoreState, action: CoreEventAction): CoreState => {
	const receivedAt = { ...state.receivedAt, [action.name]: action.at };
	switch (action.name) {
		case "onScannedDevice":
			return { ...state, receivedAt, devices: upsertDevice(state.devices, action.payload) };
		case "onConnectStateChanged":
			return { ...state, receivedAt, connection: action.payload };
		case "onDeviceInfo":
			return { ...state, receivedAt, deviceInfo: action.payload };
		case "onFirmwareInfo":
			return { ...state, receivedAt, firmwareInfo: action.payload };
		case "onBatteryStatus":
			return { ...state, receivedAt, battery: action.payload };
		case "onPedometer":
			return { ...state, receivedAt, pedometer: action.payload };
		case "onHistoryPedometer":
			return { ...state, receivedAt, historyPedometer: action.payload };
		case "onHistorySleep":
			return { ...state, receivedAt, historySleep: action.payload };
		case "onSyncStarted":
			return {
				...state,
				receivedAt,
				sync: { status: "running", progress: 0, startedAt: action.at, finishedAt: null, error: null },
			};
		case "onSyncProgress":
			return {
				...state,
				receivedAt,
				sync: {
					...state.sync,
					status: "running",
					progress: clampProgress(action.payload.progress),
					startedAt: state.sync.startedAt ?? action.at,
				},
			};
		case "onSyncFinished":
			return {
				...state,
				receivedAt,
				sync: { ...state.sync, status: "finished", progress: 100, finishedAt: action.at, error: null },
			};
		case "onFindPhone":
			return {
				...state,
				receivedAt,
				findPhone: action.payload,
				...pushWatchEvent(state, action.name, action.payload, action.at),
			};
		case "onTakeAPicture":
		case "onOpenCameraMode":
		case "onDeviceRequestedCameraMode":
			return { ...state, receivedAt, ...pushWatchEvent(state, action.name, action.payload, action.at) };
		case "onError":
			return {
				...state,
				receivedAt,
				lastError: action.payload,
				sync: errorEndsSync(state.sync, action.payload)
					? { ...state.sync, status: "failed", finishedAt: action.at, error: action.payload }
					: state.sync,
			};
		case "onLog":
			return state;
		// Fase 3: por enquanto só o horário de chegada; as abas Dados e Atividade ainda não mostram estes eventos.
		case "onHistoryHeartRate":
		case "onHistoryStress":
		case "onHistorySpo2":
		case "onHistoryActivityV2":
		case "onActivityStartedV2":
		case "onActivityStatusV2":
		case "onActivityUpdateV2":
		case "onActivityCompletedV2":
		case "onActivityError":
		case "onActivityRealTimeSpeed":
			return { ...state, receivedAt };
	}
};

/** Reducer puro do estado do app de exemplo. */
export const coreReducer = (state: CoreState, action: CoreAction): CoreState => {
	switch (action.type) {
		case "event":
			return applyEvent(state, action);
		case "clearDevices":
			return { ...state, devices: [] };
		case "clearError":
			return { ...state, lastError: null };
	}
};

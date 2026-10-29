import type {
	BatteryStatusEvent,
	ConnectStateChangedEvent,
	DeviceInfoEvent,
	ErrorEvent,
	FirmwareInfoEvent,
	HistoryPedometerEvent,
	HistorySleepEvent,
	LogEvent,
	PedometerEvent,
	ScannedDeviceEvent,
	SyncFinishedEvent,
	SyncProgressEvent,
	SyncStartedEvent,
} from "./events";

/**
 * Inscrição devolvida por um emissor de eventos. Chame `remove()` para parar de receber.
 *
 * É o subconjunto do `EventSubscription` do React Native que a biblioteca usa; declarado aqui para o mock
 * oficial e os testes não precisarem montar o objeto completo do RN.
 */
export interface TechnosEventSubscription {
	remove(): void;
}

/**
 * Emissor de um evento do módulo nativo, com a mesma forma do `CodegenTypes.EventEmitter` do RN:
 * recebe o handler e devolve a inscrição.
 */
export type TechnosEventEmitter<T> = (handler: (event: T) => void | Promise<void>) => TechnosEventSubscription;

/** Payload de cada evento, pelo nome do emissor no spec. */
export interface TechnosEventMap {
	onScannedDevice: ScannedDeviceEvent;
	onConnectStateChanged: ConnectStateChangedEvent;
	onDeviceInfo: DeviceInfoEvent;
	onFirmwareInfo: FirmwareInfoEvent;
	onBatteryStatus: BatteryStatusEvent;
	onPedometer: PedometerEvent;
	onHistoryPedometer: HistoryPedometerEvent;
	onHistorySleep: HistorySleepEvent;
	onSyncStarted: SyncStartedEvent;
	onSyncProgress: SyncProgressEvent;
	onSyncFinished: SyncFinishedEvent;
	onError: ErrorEvent;
	onLog: LogEvent;
}

/** Nome de um evento do módulo (`"onScannedDevice"`, `"onLog"`...). */
export type TechnosEventName = keyof TechnosEventMap;

/** Todos os emissores tipados, no formato de `TechnosEvents`. */
export type TechnosEventEmitters = {
	readonly [K in TechnosEventName]: TechnosEventEmitter<TechnosEventMap[K]>;
};

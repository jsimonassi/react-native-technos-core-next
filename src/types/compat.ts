/**
 * Apelidos com os nomes de tipo do Core atual (`react-native-technos-ware-core`), para o app Mormaii trocar
 * de pacote sem renomear tipos. Cada apelido aponta para o tipo novo de `./events`.
 *
 * Diferenças de forma em relação ao Core atual estão no TSDoc de cada apelido e em `docs/api-js.md`.
 */
import type {
	BatteryStatusEvent,
	ConnectStateChangedEvent,
	FirmwareInfoEvent,
	HistoryPedometerEvent,
	HistorySleepEvent,
	PedometerEvent,
	PedometerHistoryDay,
	SavedItemDelete,
	ScannedDeviceEvent,
	SleepDayInfo,
	SleepHistoryDay,
	SleepItem,
	SleepRespiratoryRateItem,
	SyncProgressEvent,
} from "./events";

/** `TechnosScannedDevice` do Core atual; ganhou `bleName` e `profileId`. */
export type TechnosScannedDevice = ScannedDeviceEvent;

/** `TechnosConnectStateChanged` do Core atual; ganhou `sessionState` e `phase`. */
export type TechnosConnectStateChanged = ConnectStateChangedEvent;

/** `TechnosFirmwareInfo` do Core atual. Aqui `deviceId` é sempre preenchido e é string (MAC), não `number?`. */
export type TechnosFirmwareInfo = FirmwareInfoEvent;

/** `TechnosBatteryStatus` do Core atual, mesma forma. */
export type TechnosBatteryStatus = BatteryStatusEvent;

/** `TechnosPedometer` do Core atual; ganhou `calorie`, `distance` e `date`. */
export type TechnosPedometer = PedometerEvent;

/** `TechnosPedometerHistory` do Core atual, mesma forma. */
export type TechnosPedometerHistory = HistoryPedometerEvent;

/** `TechnosPedometerHistoryOfDate` do Core atual. `date` é sempre o início do dia local (como no Core iOS). */
export type TechnosPedometerHistoryOfDate = PedometerHistoryDay;

/** `TechnosSleepHistory` do Core atual, mesma forma. */
export type TechnosSleepHistory = HistorySleepEvent;

/** `TechnosSleepHistoryDay` do Core atual, mesma forma. */
export type TechnosSleepHistoryDay = SleepHistoryDay;

/** `TechnosSleepHistoryDayInfo` do Core atual, sem os opcionais `awrrStatus`, `sleepScore` e `breathQuality`. */
export type TechnosSleepHistoryDayInfo = SleepDayInfo;

/** `TechnosSleepHistoryDayInfoItem` do Core atual, mesma forma. */
export type TechnosSleepHistoryDayInfoItem = SleepItem;

/** `TechnosSleepHistoryDayRespiratoryRateItem` do Core atual; o SMA sempre entrega lista vazia. */
export type TechnosSleepHistoryDayRespiratoryRateItem = SleepRespiratoryRateItem;

/** `TechnosSyncProgress` do Core atual, mesma forma. */
export type TechnosSyncProgress = SyncProgressEvent;

/** `TechnosSavedItemDelete` do Core atual, mesma forma. */
export type TechnosSavedItemDelete = SavedItemDelete;

/**
 * Apelidos com os nomes de tipo do Core atual (`react-native-technos-ware-core`), para os apps Mormaii e Condor
 * trocarem de pacote sem renomear tipos. Cada apelido aponta para o tipo novo de `./events`. Os tipos de entrada dos
 * ajustes (`./watchSettings`) e os das atividades (`./activity`, cópias literais) já têm os nomes do Core e não
 * precisam de apelido.
 *
 * Diferenças de forma em relação ao Core atual estão no TSDoc de cada apelido e em `docs/api-js.md`.
 */
import type {
	BatteryStatusEvent,
	ConnectStateChangedEvent,
	FindPhoneEvent,
	FirmwareInfoEvent,
	HeartRateHistoryDay,
	HeartRateHistoryItems,
	HeartRateHourAverage,
	HeartRateSample,
	HistoryHeartRateEvent,
	HistoryPedometerEvent,
	HistorySleepEvent,
	HistorySpo2Event,
	HistoryStressEvent,
	PedometerEvent,
	PedometerHistoryDay,
	SavedItemDelete,
	ScannedDeviceEvent,
	SleepDayInfo,
	SleepHistoryDay,
	SleepItem,
	SleepRespiratoryRateItem,
	Spo2HistoryDay,
	Spo2HistoryItem,
	StressHistoryDay,
	StressHistoryItems,
	StressHourAverage,
	StressSample,
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

/** `TechnosFindPhoneStatus` do Core atual (`type/eventData/deviceInfo.ts:28-30`), mesma forma. */
export type TechnosFindPhoneStatus = FindPhoneEvent;

/** `TechnosHeartRateHistory` do Core atual, mesma forma. */
export type TechnosHeartRateHistory = HistoryHeartRateEvent;

/** `TechnosHeartRateHistoryDay` do Core atual; `date` é o dia local `"yyyy-MM-dd"`. */
export type TechnosHeartRateHistoryDay = HeartRateHistoryDay;

/** `TechnosHeartRateHistoryDayItem` do Core atual, mesma forma. */
export type TechnosHeartRateHistoryDayItem = HeartRateHistoryItems;

/** `TechnosHeartRateHistoryOtherValues` do Core atual; o Core Next não manda `min` e `max`. */
export type TechnosHeartRateHistoryOtherValues = HeartRateSample;

/** `TechnosHeartRateHistoryAvgValues` do Core atual, mesma forma. */
export type TechnosHeartRateHistoryAvgValues = HeartRateHourAverage;

/** `TechnosStressHistory` do Core atual, mesma forma. */
export type TechnosStressHistory = HistoryStressEvent;

/** `TechnosStressHistoryDay` do Core atual; `date` é o dia local `"yyyy-MM-dd"`. */
export type TechnosStressHistoryDay = StressHistoryDay;

/** `TechnosStressHistoryDayItem` do Core atual, mesma forma. */
export type TechnosStressHistoryDayItem = StressHistoryItems;

/** `TechnosStressHistoryOtherValues` do Core atual; `stressValues` também aceita `null` (modelo que não é CRP). */
export type TechnosStressHistoryOtherValues = StressSample;

/** `TechnosStressHistoryAvgValues` do Core atual; `stressValues` também aceita `null` (modelo que não é CRP). */
export type TechnosStressHistoryAvgValues = StressHourAverage;

/** `TechnosOxygenationHistory` do Core atual, mesma forma; a lista vem sempre vazia. */
export type TechnosOxygenationHistory = HistorySpo2Event;

/** `TechnosOxygenationHistoryDay` do Core atual, mesma forma. */
export type TechnosOxygenationHistoryDay = Spo2HistoryDay;

/** `TechnosOxygenationHistoryDayItem` do Core atual, mesma forma. */
export type TechnosOxygenationHistoryDayItem = Spo2HistoryItem;

/**
 * Mock oficial de `react-native-technos-core-next` para Jest.
 *
 * Substitui o TurboModule (que não existe no Jest) por funções `jest.fn` e emissores em memória, com os mesmos
 * nomes exportados por `src/index.ts`. Constantes e `utils` são os reais.
 *
 * Como usar no app (setup do Jest):
 * ```js
 * jest.mock("react-native-technos-core-next", () =>
 * 	require("react-native-technos-core-next/src/__mocks__/react-native-technos-core-next"),
 * );
 * ```
 * No teste:
 * ```ts
 * import { TechnosCore, mockEmit } from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";
 * act(() => mockEmit("onBatteryStatus", { percentage: 80, charging: false, battery: "80%" }));
 * expect(TechnosCore.getBatteryStatus).toHaveBeenCalled();
 * ```
 *
 * Valores padrão: comandos `Promise<void>` resolvem, `isConnected` resolve `false`, `getLastPairedDevice` resolve
 * `null`, `getLogs` resolve `[]` e `exportLogs` resolve um caminho fictício. Se o app usa `resetMocks`/
 * `jest.resetAllMocks`, chame {@link mockReset} no `beforeEach` para restaurar esses valores.
 */
import { deletedCategory, deviceConnectStates, errorCodes, logLevels, technosEventNames } from "../constants";
import type { TechnosCore as RealTechnosCore } from "../index";
import type { TechnosEventEmitter, TechnosEventEmitters, TechnosEventMap, TechnosEventName } from "../types/emitter";
import { utils } from "../utils";

type RealCore = typeof RealTechnosCore;

/** `TechnosCore` com cada método trocado por um `jest.Mock` de mesma assinatura. */
export type MockedTechnosCore = {
	[K in keyof RealCore]: RealCore[K] extends (...args: infer A) => infer R ? jest.Mock<R, A> : RealCore[K];
};

/** Caminho devolvido por `exportLogs` no mock. */
export const MOCK_EXPORT_PATH =
	"/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/frames-20261028-143000.jsonl";

type AnyHandler = (event: never) => void | Promise<void>;

const listeners = new Map<TechnosEventName, Set<AnyHandler>>(
	technosEventNames.map(name => [name, new Set<AnyHandler>()]),
);

const listenersOf = (name: TechnosEventName): Set<AnyHandler> => {
	const set = listeners.get(name);
	if (!set) {
		throw new Error(`Unknown event: ${name}`);
	}
	return set;
};

const createEmitter = <K extends TechnosEventName>(name: K): TechnosEventEmitter<TechnosEventMap[K]> => {
	const emitter: TechnosEventEmitter<TechnosEventMap[K]> = handler => {
		const set = listenersOf(name);
		const entry = handler as AnyHandler;
		set.add(entry);
		return { remove: () => set.delete(entry) };
	};
	// Dá à mensagem de timeout de `getNativeEventData` o nome do evento, o que deixa a falha do teste legível.
	Object.defineProperty(emitter, "name", { value: name });
	return emitter;
};

/**
 * Dispara um evento para todos os handlers inscritos, como se viesse do nativo. Em testes de componente, chame
 * dentro de `act(...)`.
 */
export const mockEmit = <K extends TechnosEventName>(name: K, payload: TechnosEventMap[K]): void => {
	for (const handler of Array.from(listenersOf(name))) {
		(handler as (event: TechnosEventMap[K]) => void)(payload);
	}
};

/** Quantos handlers estão inscritos no evento. Útil para verificar que um componente removeu as inscrições. */
export const mockListenerCount = (name: TechnosEventName): number => listenersOf(name).size;

const resolved = <A extends unknown[]>() => jest.fn<Promise<void>, A>(() => Promise.resolve());

/** `TechnosCore` do mock. */
export const TechnosCore: MockedTechnosCore = {
	deviceConnectStates,
	deletedCategory,
	errorCodes,
	logLevels,
	initialize: resolved(),
	initSMASDK: resolved(),
	initCRPSDK: resolved(),
	scan: jest.fn(),
	stopScan: jest.fn(),
	pairDevice: resolved(),
	startPairingAttempt: resolved(),
	disconnectCurrentDevice: resolved(),
	forgetDevice: resolved(),
	isConnected: jest.fn(),
	getLastPairedDevice: jest.fn(),
	getDeviceInfo: resolved(),
	getFirmwareInfo: resolved(),
	getBatteryStatus: resolved(),
	setTime: resolved(),
	refreshSteps: resolved(),
	syncDataHistory: resolved(),
	getHistoryPedometer: resolved(),
	getHistorySleep: resolved(),
	deletedSavedData: jest.fn(),
	getLogs: jest.fn(),
	exportLogs: jest.fn(),
	clearLogs: jest.fn(),
	setLogLevel: jest.fn(),
};

const applyDefaults = (): void => {
	for (const value of Object.values(TechnosCore)) {
		if (typeof value === "function" && "mockReset" in value) {
			(value as jest.Mock).mockReset();
		}
	}
	const promiseMethods = [
		TechnosCore.initialize,
		TechnosCore.initSMASDK,
		TechnosCore.initCRPSDK,
		TechnosCore.pairDevice,
		TechnosCore.startPairingAttempt,
		TechnosCore.disconnectCurrentDevice,
		TechnosCore.forgetDevice,
		TechnosCore.getDeviceInfo,
		TechnosCore.getFirmwareInfo,
		TechnosCore.getBatteryStatus,
		TechnosCore.setTime,
		TechnosCore.refreshSteps,
		TechnosCore.syncDataHistory,
		TechnosCore.getHistoryPedometer,
		TechnosCore.getHistorySleep,
	] as jest.Mock<Promise<void>, unknown[]>[];
	for (const method of promiseMethods) {
		method.mockImplementation(() => Promise.resolve());
	}
	TechnosCore.isConnected.mockImplementation(() => Promise.resolve(false));
	TechnosCore.getLastPairedDevice.mockImplementation(() => Promise.resolve(null));
	TechnosCore.getLogs.mockImplementation(() => Promise.resolve([]));
	TechnosCore.exportLogs.mockImplementation(() => Promise.resolve(MOCK_EXPORT_PATH));
};

/**
 * Restaura o estado inicial do mock: remove todos os handlers inscritos e repõe os valores padrão de cada
 * `jest.fn` (zerando chamadas registradas).
 */
export const mockReset = (): void => {
	for (const set of listeners.values()) {
		set.clear();
	}
	applyDefaults();
};

applyDefaults();

/** `TechnosEvents` do mock: emissores em memória, disparados por {@link mockEmit}. */
export const TechnosEvents: TechnosEventEmitters = {
	onScannedDevice: createEmitter("onScannedDevice"),
	onConnectStateChanged: createEmitter("onConnectStateChanged"),
	onDeviceInfo: createEmitter("onDeviceInfo"),
	onFirmwareInfo: createEmitter("onFirmwareInfo"),
	onBatteryStatus: createEmitter("onBatteryStatus"),
	onPedometer: createEmitter("onPedometer"),
	onHistoryPedometer: createEmitter("onHistoryPedometer"),
	onHistorySleep: createEmitter("onHistorySleep"),
	onSyncStarted: createEmitter("onSyncStarted"),
	onSyncProgress: createEmitter("onSyncProgress"),
	onSyncFinished: createEmitter("onSyncFinished"),
	onError: createEmitter("onError"),
	onLog: createEmitter("onLog"),
};

export { deletedCategory, deviceConnectStates, errorCodes, logLevels, technosEventNames, utils };

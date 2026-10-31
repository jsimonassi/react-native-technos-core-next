/**
 * Testa o wrapper real (`src/index.ts`) sobre um TurboModule falso. O nome do pacote aponta para o mock no Jest, então
 * o wrapper é importado pelo caminho profundo, que aponta para o arquivo real.
 */
import { TechnosCore, TechnosEvents, deletedCategory, errorCodes } from "react-native-technos-core-next/src/index";
import { groupSavedItemsByCategory } from "react-native-technos-core-next/src/utils/savedData";

jest.mock("react-native-technos-core-next/src/specs/NativeCoreNext", () => ({
	__esModule: true,
	default: {
		deletedSavedData: jest.fn(),
		initialize: jest.fn(() => Promise.resolve()),
		initSMASDK: jest.fn(() => Promise.resolve()),
		pairDevice: jest.fn(() => Promise.resolve()),
		getLastPairedDevice: jest.fn(() => Promise.resolve(null)),
		getLogs: jest.fn(() => Promise.resolve([])),
		setLogLevel: jest.fn(),
		onBatteryStatus: jest.fn(() => ({ remove: jest.fn() })),
	},
}));

interface FakeNative {
	deletedSavedData: jest.Mock;
	initialize: jest.Mock;
	initSMASDK: jest.Mock;
	pairDevice: jest.Mock;
	getLastPairedDevice: jest.Mock;
	getLogs: jest.Mock;
	setLogLevel: jest.Mock;
	onBatteryStatus: jest.Mock;
}

const native = (): FakeNative =>
	jest.requireMock<{ default: FakeNative }>("react-native-technos-core-next/src/specs/NativeCoreNext").default;

beforeEach(() => {
	jest.clearAllMocks();
});

describe("TechnosCore.deletedSavedData", () => {
	it("faz uma chamada nativa por categoria, na ordem em que as categorias aparecem", () => {
		TechnosCore.deletedSavedData([
			{ category: deletedCategory.PEDOMETER, registered_at: "2026-10-26T00:00:00-03:00" },
			{ category: deletedCategory.SLEEP, registered_at: "2026-10-26T07:10:00-03:00" },
			{ category: deletedCategory.PEDOMETER, registered_at: "2026-10-27T00:00:00-03:00" },
		]);

		expect(native().deletedSavedData.mock.calls).toEqual([
			[
				[
					{ category: 5, registered_at: "2026-10-26T00:00:00-03:00" },
					{ category: 5, registered_at: "2026-10-27T00:00:00-03:00" },
				],
				5,
			],
			[[{ category: 0, registered_at: "2026-10-26T07:10:00-03:00" }], 0],
		]);
	});

	it("não chama o nativo com lista vazia, como o Core atual", () => {
		TechnosCore.deletedSavedData([]);
		expect(native().deletedSavedData).not.toHaveBeenCalled();
	});

	it("agrupa sem alterar os itens", () => {
		const items = [
			{ category: 5, registered_at: "a" },
			{ category: 0, registered_at: "b" },
		];
		const groups = groupSavedItemsByCategory(items);
		expect(groups).toEqual([
			{ category: 5, items: [items[0]] },
			{ category: 0, items: [items[1]] },
		]);
		expect(groups[0].items[0]).toBe(items[0]);
	});
});

describe("TechnosCore (repasse ao nativo)", () => {
	it("repassa os argumentos de pairDevice e devolve a Promise do nativo", async () => {
		await expect(TechnosCore.pairDevice("AA:BB:CC:DD:EE:FF", "fitGPS")).resolves.toBeUndefined();
		expect(native().pairDevice).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF", "fitGPS");
	});

	it("propaga a rejeição do nativo com o código", async () => {
		const error = Object.assign(new Error("BIND sem resposta"), { code: "HANDSHAKE_FAILED" });
		native().pairDevice.mockReturnValueOnce(Promise.reject(error));
		await expect(TechnosCore.pairDevice("AA", "fitGPS")).rejects.toMatchObject({ code: "HANDSHAKE_FAILED" });
	});

	it("getLastPairedDevice devolve null quando o nativo não tem pareamento", async () => {
		native().getLastPairedDevice.mockReturnValueOnce(Promise.resolve(undefined));
		await expect(TechnosCore.getLastPairedDevice()).resolves.toBeNull();

		const saved = { deviceId: "AA", name: "fitGPS", profileId: "fitgps" };
		native().getLastPairedDevice.mockReturnValueOnce(Promise.resolve(saved));
		await expect(TechnosCore.getLastPairedDevice()).resolves.toEqual(saved);
	});

	it("initCRPSDK é só um alias do initialize nativo (o app Condor usa esse nome)", async () => {
		await expect(TechnosCore.initCRPSDK()).resolves.toBeUndefined();
		expect(native().initialize).toHaveBeenCalledTimes(1);
		expect(native().initSMASDK).not.toHaveBeenCalled();
	});

	it("setLogLevel manda o número do nível", () => {
		TechnosCore.setLogLevel(TechnosCore.logLevels.WARN);
		expect(native().setLogLevel).toHaveBeenCalledWith(2);
	});

	it("TechnosEvents usa os emissores do spec", () => {
		const handler = jest.fn();
		TechnosEvents.onBatteryStatus(handler);
		expect(native().onBatteryStatus).toHaveBeenCalledWith(handler);
	});

	it("expõe o código do vínculo Bluetooth clássico, que só sai em onError", () => {
		expect(errorCodes.CLASSIC_BOND_FAILED).toBe("CLASSIC_BOND_FAILED");
		expect(TechnosCore.errorCodes.CLASSIC_BOND_FAILED).toBe("CLASSIC_BOND_FAILED");
		// Treze códigos da sessão e cinco do host.
		expect(Object.keys(errorCodes)).toHaveLength(18);
	});

	it("mantém as constantes do Core atual", () => {
		expect(TechnosCore.deviceConnectStates).toEqual({
			inDFU: -2,
			unknown: -1,
			disconnect: 0,
			connecting: 1,
			connected: 2,
			disconnectOnActivity: 3,
			disconnectedBluetoothOff: 4,
		});
		expect(TechnosCore.deletedCategory).toEqual({
			SLEEP: 0,
			ACTIVITY: 1,
			STRESS: 2,
			SPO2: 3,
			HEART_HERT: 4,
			PEDOMETER: 5,
			ACTIVITY_MONITOR: 6,
			CALORIE: 7,
			BODY_ENERGY: 8,
		});
	});
});

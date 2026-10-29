import {
	TechnosEvents,
	mockEmit,
	mockListenerCount,
	mockReset,
} from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";
import { getNativeEventData, requestNativeEventData } from "react-native-technos-core-next/src/utils/events";
import { getErrorCode } from "react-native-technos-core-next/src/utils/errors";

const day = { date: "2026-10-28T00:00:00-03:00", distance: 1200, calorie: 50, pedometer: 1700 };

beforeEach(() => {
	mockReset();
	jest.useFakeTimers();
});

afterEach(() => {
	jest.useRealTimers();
});

describe("getNativeEventData", () => {
	it("resolve com o primeiro evento e remove a inscrição", async () => {
		const promise = getNativeEventData(TechnosEvents.onHistoryPedometer, 20000);
		expect(mockListenerCount("onHistoryPedometer")).toBe(1);

		mockEmit("onHistoryPedometer", { historypedometer: [day] });
		mockEmit("onHistoryPedometer", { historypedometer: [] });

		await expect(promise).resolves.toEqual({ historypedometer: [day] });
		expect(mockListenerCount("onHistoryPedometer")).toBe(0);
	});

	it("rejeita no timeout com a mensagem do Core atual e remove a inscrição", async () => {
		const promise = getNativeEventData(TechnosEvents.onHistoryPedometer, 20000);
		jest.advanceTimersByTime(19999);
		expect(mockListenerCount("onHistoryPedometer")).toBe(1);

		jest.advanceTimersByTime(1);
		await expect(promise).rejects.toThrow("Timeout Error: getDataFromWatch - onHistoryPedometer");
		expect(mockListenerCount("onHistoryPedometer")).toBe(0);
	});

	it("o evento depois do timeout não faz nada", async () => {
		const promise = getNativeEventData(TechnosEvents.onBatteryStatus, 100);
		jest.advanceTimersByTime(100);
		await expect(promise).rejects.toThrow("Timeout Error");
		expect(() => mockEmit("onBatteryStatus", { percentage: 1, charging: false, battery: "1%" })).not.toThrow();
	});

	it("sem timeout espera indefinidamente", async () => {
		const settled = jest.fn();
		getNativeEventData(TechnosEvents.onSyncFinished).then(settled, settled);
		jest.advanceTimersByTime(10 * 60 * 1000);
		await Promise.resolve();
		expect(settled).not.toHaveBeenCalled();
		expect(mockListenerCount("onSyncFinished")).toBe(1);

		mockEmit("onSyncFinished", {});
		await Promise.resolve();
		expect(settled).toHaveBeenCalledWith({});
	});
});

describe("requestNativeEventData", () => {
	it("inscreve antes do comando, então um evento síncrono não se perde", async () => {
		const command = jest.fn(() => {
			mockEmit("onHistoryPedometer", { historypedometer: [day] });
			return Promise.resolve();
		});

		await expect(requestNativeEventData(TechnosEvents.onHistoryPedometer, command, 20000)).resolves.toEqual({
			historypedometer: [day],
		});
		expect(command).toHaveBeenCalledTimes(1);
		expect(mockListenerCount("onHistoryPedometer")).toBe(0);
	});

	it("rejeita com o erro do comando (com code) e remove a inscrição", async () => {
		const error = Object.assign(new Error("sem sono"), { code: "NO_DATA" });
		const promise = requestNativeEventData(TechnosEvents.onHistorySleep, () => Promise.reject(error), 20000);

		await expect(promise).rejects.toBe(error);
		expect(getErrorCode(error)).toBe("NO_DATA");
		expect(mockListenerCount("onHistorySleep")).toBe(0);
	});

	it("rejeita se o comando lançar de forma síncrona", async () => {
		const promise = requestNativeEventData(TechnosEvents.onHistorySleep, () => {
			throw new Error("boom");
		});
		await expect(promise).rejects.toThrow("boom");
		expect(mockListenerCount("onHistorySleep")).toBe(0);
	});

	it("rejeita no timeout quando o comando resolve mas o evento não vem", async () => {
		const promise = requestNativeEventData(TechnosEvents.onHistorySleep, () => Promise.resolve(), 500);
		await Promise.resolve();
		jest.advanceTimersByTime(500);
		await expect(promise).rejects.toThrow("Timeout Error: getDataFromWatch - onHistorySleep");
		expect(mockListenerCount("onHistorySleep")).toBe(0);
	});
});

describe("getErrorCode", () => {
	it("só reconhece códigos do módulo", () => {
		expect(getErrorCode({ code: "TIMEOUT" })).toBe("TIMEOUT");
		expect(getErrorCode({ code: "E_SOMETHING" })).toBeNull();
		expect(getErrorCode(new Error("x"))).toBeNull();
		expect(getErrorCode(null)).toBeNull();
	});
});

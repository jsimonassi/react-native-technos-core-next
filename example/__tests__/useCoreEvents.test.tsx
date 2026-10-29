import React from "react";
import ReactTestRenderer, { act } from "react-test-renderer";
import {
	TechnosCore,
	mockEmit,
	mockListenerCount,
	mockReset,
} from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";
import type { LogEvent, TechnosEventName } from "react-native-technos-core-next";
import { technosEventNames } from "react-native-technos-core-next";
import { useCoreEvents, type CoreEvents, type UseCoreEventsOptions } from "../src/hooks/useCoreEvents";

let current: CoreEvents;

const Probe = ({ options }: { options?: UseCoreEventsOptions }) => {
	current = useCoreEvents(options);
	return null;
};

const render = async (options: UseCoreEventsOptions = { logFlushMs: 0 }) => {
	let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
	await act(async () => {
		renderer = ReactTestRenderer.create(<Probe options={options} />);
	});
	if (!renderer) {
		throw new Error("render failed");
	}
	return renderer;
};

const logEntry = (index: number, extra: Partial<LogEvent> = {}): LogEvent => ({
	ts: 1_000 + index,
	level: "INFO",
	tag: "Test/log",
	message: `entry ${index}`,
	dir: null,
	hex: null,
	...extra,
});

beforeEach(() => {
	mockReset();
});

describe("useCoreEvents", () => {
	it("inscreve em todos os eventos e remove tudo ao desmontar", async () => {
		const renderer = await render();
		technosEventNames.forEach((name: TechnosEventName) => expect(mockListenerCount(name)).toBe(1));

		await act(async () => {
			renderer.unmount();
		});
		technosEventNames.forEach((name: TechnosEventName) => expect(mockListenerCount(name)).toBe(0));
	});

	it("guarda os relógios da busca sem repetir deviceId e com o RSSI mais recente", async () => {
		await render();
		act(() => {
			mockEmit("onScannedDevice", {
				name: "fitGPS",
				deviceId: "AA:BB:CC:DD:EE:01",
				rssi: -70,
				bleName: "Mormaii_fitGPS",
				profileId: "fitgps",
			});
			mockEmit("onScannedDevice", {
				name: "fitGPS",
				deviceId: "AA:BB:CC:DD:EE:02",
				rssi: -80,
				bleName: "Mormaii_fitGPS",
				profileId: "fitgps",
			});
			mockEmit("onScannedDevice", {
				name: "fitGPS",
				deviceId: "AA:BB:CC:DD:EE:01",
				rssi: -55,
				bleName: "Mormaii_fitGPS",
				profileId: "fitgps",
			});
		});

		expect(current.state.devices.map(device => [device.deviceId, device.rssi])).toEqual([
			["AA:BB:CC:DD:EE:01", -55],
			["AA:BB:CC:DD:EE:02", -80],
		]);

		act(() => current.clearDevices());
		expect(current.state.devices).toEqual([]);
	});

	it("guarda o último estado de conexão, bateria, firmware e passos", async () => {
		await render();
		act(() => {
			mockEmit("onConnectStateChanged", { state: 1, sessionState: "HANDSHAKING", phase: "BIND" });
			mockEmit("onConnectStateChanged", { state: 2, sessionState: "READY", phase: null });
			mockEmit("onBatteryStatus", { percentage: 85, charging: false, battery: "85%" });
			mockEmit("onFirmwareInfo", { version: "1.0.7", braceletType: 0, platformCode: 0, deviceId: "AA" });
			mockEmit("onPedometer", {
				pedometer: 4321,
				calorie: 150,
				distance: 3000,
				date: "2026-10-28T00:00:00-03:00",
			});
		});

		expect(current.state.connection).toEqual({ state: 2, sessionState: "READY", phase: null });
		expect(current.state.battery?.percentage).toBe(85);
		expect(current.state.firmwareInfo?.version).toBe("1.0.7");
		expect(current.state.pedometer?.pedometer).toBe(4321);
		expect(current.state.receivedAt.onBatteryStatus).toEqual(expect.any(Number));
	});

	it("acompanha o sync do início ao fim e marca falha quando o erro é do sync", async () => {
		await render();
		act(() => {
			mockEmit("onSyncStarted", {});
			mockEmit("onSyncProgress", { progress: 50 });
		});
		expect(current.state.sync).toMatchObject({ status: "running", progress: 50 });

		act(() => mockEmit("onSyncFinished", {}));
		expect(current.state.sync).toMatchObject({ status: "finished", progress: 100 });

		act(() => {
			mockEmit("onSyncStarted", {});
			mockEmit("onError", {
				requestId: 7,
				code: "TIMEOUT",
				message: "05/41 sem resposta",
				method: "syncDataHistory",
			});
		});
		expect(current.state.sync.status).toBe("failed");
		expect(current.state.sync.error?.code).toBe("TIMEOUT");
		expect(current.state.lastError?.code).toBe("TIMEOUT");
	});

	it("não encerra o sync por erro de outro comando", async () => {
		await render();
		act(() => {
			mockEmit("onSyncStarted", {});
			mockEmit("onError", { requestId: 3, code: "NOT_READY", message: "x", method: "getBatteryStatus" });
		});
		expect(current.state.sync.status).toBe("running");
		expect(current.state.lastError?.method).toBe("getBatteryStatus");

		act(() => current.clearError());
		expect(current.state.lastError).toBeNull();
	});

	it("mantém o log como ring de 2000, do mais novo para o mais antigo", async () => {
		await render();
		act(() => {
			for (let index = 0; index < 2005; index++) {
				mockEmit("onLog", logEntry(index));
			}
		});

		expect(current.logs).toHaveLength(2000);
		expect(current.logs[0].message).toBe("entry 2004");
		expect(current.logs[1999].message).toBe("entry 5");
		expect(new Set(current.logs.map(row => row.id)).size).toBe(2000);
	});

	it("agrupa as entradas de log antes de renderizar quando logFlushMs > 0", async () => {
		jest.useFakeTimers();
		try {
			await render({ logFlushMs: 150 });
			act(() => {
				mockEmit("onLog", logEntry(1));
				mockEmit("onLog", logEntry(2, { dir: "TX", hex: "AB00" }));
			});
			expect(current.logs).toHaveLength(0);

			act(() => {
				jest.advanceTimersByTime(150);
			});
			expect(current.logs.map(row => row.message)).toEqual(["entry 2", "entry 1"]);
		} finally {
			jest.useRealTimers();
		}
	});

	it("carrega o retrato do log nativo ao montar e limpa nos dois lados", async () => {
		TechnosCore.getLogs.mockResolvedValueOnce([logEntry(2), logEntry(1)]);
		await render();
		expect(TechnosCore.getLogs).toHaveBeenCalledWith(2000);
		expect(current.logs.map(row => row.message)).toEqual(["entry 2", "entry 1"]);

		act(() => current.clearLogs());
		expect(current.logs).toEqual([]);
		expect(TechnosCore.clearLogs).toHaveBeenCalledTimes(1);
	});

	it("recarrega o log trocando o conteúdo pelo retrato do nativo", async () => {
		await render();
		act(() => mockEmit("onLog", logEntry(9)));
		TechnosCore.getLogs.mockResolvedValueOnce([logEntry(3)]);

		await act(async () => {
			await current.reloadLogs();
		});
		expect(current.logs.map(row => row.message)).toEqual(["entry 3"]);
	});
});

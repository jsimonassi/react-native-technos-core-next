import React from "react";
import { Alert, Vibration, type AlertButton } from "react-native";
import ReactTestRenderer, { act } from "react-test-renderer";
import {
	TechnosCore,
	mockEmit,
	mockReset,
} from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";
import App from "../App";

jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// Junta o texto dos nós nativos "Text" (o componente Text do RN renderiza um nó com esse nome no Jest).
const renderedText = (renderer: ReactTestRenderer.ReactTestRenderer): string =>
	renderer.root
		.findAll(node => (node.type as unknown) === "Text")
		.flatMap(node => node.children)
		.filter((child): child is string => typeof child === "string")
		.join(" ");

beforeEach(() => {
	mockReset();
	// A FlatList da aba Log agenda renders com setTimeout; com timers falsos eles rodam dentro do act.
	jest.useFakeTimers();
	// O App loga o initialize e cada estado para o console do Xcode; aqui só polui a saída.
	jest.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
	jest.useRealTimers();
	jest.restoreAllMocks();
});

it("renderiza as quatro abas, inicializa o módulo e mostra o estado vindo do evento", async () => {
	let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
	await act(async () => {
		renderer = ReactTestRenderer.create(<App />);
	});
	if (!renderer) {
		throw new Error("render failed");
	}

	expect(TechnosCore.initialize).toHaveBeenCalled();
	expect(renderer.root.findByProps({ testID: "tab-connection" })).toBeTruthy();
	expect(renderer.root.findByProps({ testID: "tab-data" })).toBeTruthy();
	expect(renderer.root.findByProps({ testID: "tab-settings" })).toBeTruthy();
	expect(renderer.root.findByProps({ testID: "tab-log" })).toBeTruthy();

	await act(async () => {
		mockEmit("onConnectStateChanged", { state: 2, sessionState: "READY", phase: null });
		mockEmit("onScannedDevice", {
			name: "fitGPS",
			deviceId: "AA:BB:CC:DD:EE:FF",
			rssi: -60,
			bleName: "Mormaii_fitGPS",
			profileId: "fitgps",
		});
	});
	expect(renderedText(renderer)).toContain("Conectado");
	expect(renderedText(renderer)).toContain("AA:BB:CC:DD:EE:FF");
	expect(renderedText(renderer)).toContain("READY");

	await act(async () => {
		renderer?.root.findByProps({ testID: "device-AA:BB:CC:DD:EE:FF" }).props.onPress();
	});
	expect(TechnosCore.pairDevice).toHaveBeenCalledWith("AA:BB:CC:DD:EE:FF", "fitGPS");

	await act(async () => {
		renderer?.root.findByProps({ testID: "tab-log" }).props.onPress();
		jest.runOnlyPendingTimers();
	});

	await act(async () => {
		renderer?.unmount();
	});
});

it("aba Ajustes: manda os valores fictícios no formato do Condor, lista os eventos do relógio e vibra no onFindPhone", async () => {
	let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
	await act(async () => {
		renderer = ReactTestRenderer.create(<App />);
	});
	if (!renderer) {
		throw new Error("render failed");
	}
	const press = async (testID: string) => {
		await act(async () => {
			renderer?.root.findByProps({ testID }).props.onPress();
		});
	};

	await press("tab-settings");
	expect(renderedText(renderer)).toContain("Eventos do relógio");
	expect(renderedText(renderer)).toContain("Cenário fase2-ajustes");

	await press("setting-set12HourFormat-12h");
	expect(TechnosCore.set12HourFormat).toHaveBeenCalledWith(true);

	await press("setting-setDistanceUnit-mi");
	expect(TechnosCore.setDistanceUnit).toHaveBeenCalledWith({ distance_unit: "miles" });

	await press("setting-setHeartRateAutomaticCheck-on");
	expect(TechnosCore.setHeartRateAutomaticCheck).toHaveBeenCalledWith(true, "00:00", "23:59", 5);

	await press("setting-setWalkReminder-off");
	expect(TechnosCore.setWalkReminder).toHaveBeenCalledWith(expect.objectContaining({ onOff: false }));

	await press("setting-setAlarm-three");
	const alarms = TechnosCore.setAlarm.mock.calls[0][0];
	expect(alarms.map(alarm => [alarm.enable, alarm.repeat])).toEqual([
		[true, "1111100"],
		[true, "1111111"],
		[true, "0000000"],
	]);

	await press("setting-manageNotifications-noWhatsApp");
	expect(TechnosCore.manageNotifications).toHaveBeenCalledWith(expect.objectContaining({ WhatsApp: false }), false);

	TechnosCore.setScreenTime.mockRejectedValueOnce(
		Object.assign(new Error("Not supported by sma"), { code: "NOT_SUPPORTED" }),
	);
	await press("setting-setScreenTime-10s");
	expect(TechnosCore.setScreenTime).toHaveBeenCalledWith(10);
	expect(renderedText(renderer)).toContain("NOT_SUPPORTED");

	const vibrate = jest.spyOn(Vibration, "vibrate");
	const cancel = jest.spyOn(Vibration, "cancel");
	await act(async () => {
		mockEmit("onFindPhone", { status: "1" });
		mockEmit("onTakeAPicture", {});
	});
	expect(vibrate).toHaveBeenCalledTimes(1);
	expect(renderedText(renderer)).toContain("onFindPhone");
	expect(renderedText(renderer)).toContain("onTakeAPicture");
	expect(renderedText(renderer)).toContain("Procurando o telefone");

	await act(async () => {
		mockEmit("onFindPhone", { status: "0" });
	});
	expect(cancel).toHaveBeenCalled();

	await act(async () => {
		renderer?.unmount();
	});
});

it("aba Ajustes: o reset de fábrica só sai depois da confirmação", async () => {
	let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
	await act(async () => {
		renderer = ReactTestRenderer.create(<App />);
	});
	if (!renderer) {
		throw new Error("render failed");
	}
	const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});

	await act(async () => {
		renderer?.root.findByProps({ testID: "setting-resetDevice-reset" }).props.onPress();
	});
	expect(alert).toHaveBeenCalledTimes(1);
	expect(TechnosCore.resetDevice).not.toHaveBeenCalled();

	const buttons = (alert.mock.calls[0][2] ?? []) as AlertButton[];
	const cancel = buttons.find(button => button.style === "cancel");
	const confirm = buttons.find(button => button.style === "destructive");
	await act(async () => {
		cancel?.onPress?.();
	});
	expect(TechnosCore.resetDevice).not.toHaveBeenCalled();

	await act(async () => {
		confirm?.onPress?.();
	});
	expect(TechnosCore.resetDevice).toHaveBeenCalledTimes(1);
	expect(TechnosCore.forgetDevice).not.toHaveBeenCalled();

	await act(async () => {
		renderer?.unmount();
	});
});

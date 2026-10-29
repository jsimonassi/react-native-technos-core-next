import React from "react";
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
});

afterEach(() => {
	jest.useRealTimers();
});

it("renderiza as três abas, inicializa o módulo e mostra o estado vindo do evento", async () => {
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

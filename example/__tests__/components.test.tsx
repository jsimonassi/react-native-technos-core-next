/**
 * Testa os componentes do Core que o app Condor importa (`TechnosNativeChronometer`, `TechnosNativeMap`,
 * `TechnosMapStyles` e `TechnosNativeActionTimer`), por enquanto reservas em JS: existem como valor na raiz e no mock
 * (o `styled(X)` do styled-components, que o Condor faz no nível do módulo, lança com `X` indefinido), renderizam o texto
 * inicial dos componentes nativos do Core e repassam as props de `View`.
 */
import React from "react";
import ReactTestRenderer, { act } from "react-test-renderer";
import {
	TechnosMapStyles,
	TechnosNativeActionTimer,
	TechnosNativeChronometer,
	TechnosNativeMap,
	type TechnosNativeChronometerProps,
	type TechnosNativeMapProps,
} from "react-native-technos-core-next/src/index";
import * as mockRoot from "react-native-technos-core-next";

// A raiz importa o spec, que chama o TurboModuleRegistry no import; os componentes não usam o módulo nativo.
jest.mock("react-native-technos-core-next/src/specs/NativeCoreNext", () => ({ __esModule: true, default: {} }));

type RenderedNode = ReactTestRenderer.ReactTestRendererJSON;

const render = (element: React.ReactElement): RenderedNode => {
	let renderer: ReactTestRenderer.ReactTestRenderer | undefined;
	act(() => {
		renderer = ReactTestRenderer.create(element);
	});
	const json = renderer?.toJSON();
	if (!json || Array.isArray(json)) {
		throw new Error("expected a single rendered node");
	}
	return json;
};

const onlyChild = (node: RenderedNode): RenderedNode => {
	expect(node.children).toHaveLength(1);
	const child = node.children?.[0];
	if (!child || typeof child === "string") {
		throw new Error("expected an element child");
	}
	return child;
};

describe("componentes do Core (reservas)", () => {
	it("a raiz e o mock exportam os componentes como valor", () => {
		for (const [name, component] of Object.entries({
			TechnosNativeChronometer,
			TechnosNativeMap,
			TechnosNativeActionTimer,
		})) {
			expect([name, typeof component]).toEqual([name, "function"]);
			expect([name, (mockRoot as Record<string, unknown>)[name]]).toEqual([name, component]);
		}
		expect(mockRoot.TechnosMapStyles).toBe(TechnosMapStyles);
	});

	it("TechnosMapStyles tem os membros e os textos do Core", () => {
		expect({ ...TechnosMapStyles }).toEqual({
			MORMAII: "mormaii",
			TOUCH: "touch",
			TECHNOS: "technos",
			CONDOR: "condor",
		});
	});

	it("TechnosNativeChronometer mostra o texto inicial do Core e repassa as props de View", () => {
		const props: TechnosNativeChronometerProps = {
			chronometerStyle: "condor",
			fontSize: "normal",
			color: "#123456",
			textCenter: true,
			testID: "chronometer",
			style: { flex: 1 },
		};
		const view = render(<TechnosNativeChronometer {...props} />);
		expect(view.type).toBe("View");
		expect(view.props).toEqual({ testID: "chronometer", style: { flex: 1 } });
		const text = onlyChild(view);
		expect(text.type).toBe("Text");
		expect(text.children).toEqual(["00:00:00"]);
		expect(text.props.style).toEqual({
			fontSize: 18,
			lineHeight: 27,
			color: "#123456",
			fontWeight: "bold",
			textAlign: "center",
		});
	});

	it("TechnosNativeChronometer sem horas mostra 00:00, branco e no tamanho padrão para fontSize desconhecido", () => {
		const view = render(
			<TechnosNativeChronometer
				chronometerStyle="touch"
				fontSize={"huge" as TechnosNativeChronometerProps["fontSize"]}
				hideHours
			/>,
		);
		const text = onlyChild(view);
		expect(text.children).toEqual(["00:00"]);
		expect(text.props.style).toEqual({
			fontSize: 24,
			lineHeight: 28,
			color: "#FFFFFF",
			fontWeight: "normal",
			textAlign: "left",
		});
	});

	it("TechnosNativeActionTimer mostra 00:00, centralizado no estilo technos", () => {
		const view = render(<TechnosNativeActionTimer chronometerStyle="technos" fontSize="big" testID="timer" />);
		expect(view.props).toEqual({ testID: "timer" });
		const text = onlyChild(view);
		expect(text.children).toEqual(["00:00"]);
		expect(text.props.style).toMatchObject({ fontSize: 24, textAlign: "center", color: "#FFFFFF" });
	});

	it("TechnosNativeMap é uma View vazia que descarta as props do mapa", () => {
		const props: TechnosNativeMapProps = {
			mapMode: "dark",
			mapStyle: TechnosMapStyles.CONDOR,
			mapPadding: [0, 0, 0, 0],
			zoom: 15,
			foundDeviceList: [{ name: "Relógio de teste", latitude: 1.5, longitude: 2.5 }],
			locationData: { locations: [{ latitude: 1.5, longitude: 2.5, speed: 0 }], showPinsWithKmDistance: 1 },
			testID: "map",
			style: { flex: 1 },
		};
		const view = render(<TechnosNativeMap {...props} />);
		expect(view.type).toBe("View");
		expect(view.props).toEqual({ testID: "map", style: { flex: 1 } });
		expect(view.children).toBeNull();
	});
});

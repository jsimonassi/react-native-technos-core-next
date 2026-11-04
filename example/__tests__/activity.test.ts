/**
 * Testa o contrato JS da fase 3 (históricos de FC, estresse, SpO2 e treinos e a atividade iniciada pelo app): o repasse
 * do wrapper real (`src/index.ts`) a um TurboModule falso, o `observed()`, o `{}` do `stopActivityV2` sem argumento, a
 * tabela `TechnosCore.activityTypes` contra a do Core `v4.3.57`, os enums de valor importados da raiz e do mock, e os
 * 10 eventos no spec, em `technosEventNames` e no mock. O Jest falha o teste sozinho quando uma Promise rejeita sem
 * tratamento.
 */
import {
	ActionType,
	PlanType,
	TechnosActivityErrorCode,
	TechnosActivityOrigin,
	TechnosActivityV2Status,
	TechnosCore,
	TechnosEvents,
	errorCodes,
	technosEventNames,
	utils,
} from "react-native-technos-core-next/src/index";
import * as mockRoot from "react-native-technos-core-next";
import {
	TechnosCore as MockTechnosCore,
	TechnosEvents as MockTechnosEvents,
	mockEmit,
	mockListenerCount,
	mockReset,
} from "react-native-technos-core-next/src/__mocks__/react-native-technos-core-next";
import type {
	HistoryHeartRateEvent,
	HistoryStressEvent,
	TechnosActivityByTypeStartV2,
	TechnosActivityByTypeStop,
	TechnosActivityHistoryV2Activity,
	TechnosEventMap,
	TechnosEventName,
} from "react-native-technos-core-next";

jest.mock("react-native-technos-core-next/src/specs/NativeCoreNext", () => {
	const voidMethods = [
		"getHistoryHeartRate",
		"getHistoryStress",
		"getHistorySpO2",
		"getHistoryActivityV2",
		"startActivityByTypeV2",
		"pauseActivityV2",
		"resumeActivityV2",
		"stopActivityV2",
	];
	const methods: Record<string, jest.Mock> = Object.fromEntries(
		voidMethods.map(name => [name, jest.fn(() => Promise.resolve())]),
	);
	methods.checkIosBackgroundLocationPermission = jest.fn(() => Promise.resolve("granted"));
	methods.onHistoryHeartRate = jest.fn(() => ({ remove: jest.fn() }));
	methods.onActivityCompletedV2 = jest.fn(() => ({ remove: jest.fn() }));
	return { __esModule: true, default: methods };
});

type FakeNative = Record<string, jest.Mock>;

const native = (): FakeNative =>
	jest.requireMock<{ default: FakeNative }>("react-native-technos-core-next/src/specs/NativeCoreNext").default;

/** Espera os microtasks e um ciclo de timers reais: tempo para o Jest notar uma rejeição sem tratamento. */
const settle = () => new Promise<void>(resolve => setTimeout(() => resolve(), 20));

const nativeError = (code: string) => Object.assign(new Error(`${code} from native`), { code });

/** Os 10 eventos da fase 3, na ordem do spec. */
const PHASE3_EVENTS: readonly TechnosEventName[] = [
	"onHistoryHeartRate",
	"onHistoryStress",
	"onHistorySpo2",
	"onHistoryActivityV2",
	"onActivityStartedV2",
	"onActivityStatusV2",
	"onActivityUpdateV2",
	"onActivityCompletedV2",
	"onActivityError",
	"onActivityRealTimeSpeed",
];

/**
 * `TechnosCore.activityTypes` do Core atual, na ordem de lá: gerado uma vez a partir de
 * `git -C TechnosWareCore show v4.3.57:src/NativeModules/index.ts` (linhas 45-229, 171 entradas). Não edite à mão.
 */
const CORE_V4_3_57_ACTIVITY_TYPES: Record<string, number> = {
	walk: 1,
	run: 2,
	cycling: 3,
	hiking: 4,
	climb: 6,
	other: 8,
	fitness: 9,
	spinning: 10,
	treadmill: 12,
	yoga: 18,
	basketball: 21,
	soccer: 22,
	volleyball: 23,
	tennisball: 24,
	dancing: 29,
	pilates: 30,
	ellipticalMachine: 31,
	rowing: 32,
	stairClimber: 33,
	stairClimbing: 34,
	poolSwimming: 54,
	seaSwimming: 55,
	beachTennis: 75,
	surf: 170,
	footvolley: 187,
	sup: 188,
	crossfit: 198,
	treadmillRunning: 200,
	treadmillWalk: 201,
	acrobaticTissue: 202,
	hiit: 203,
	ballet: 204,
	coreTraining: 205,
	abdominal: 206,
	gymWorkout: 207,
	aerobics: 208,
	slackline: 209,
	kravMaga: 210,
	capoeira: 211,
	judo: 212,
	pullUp: 213,
	weightlifting: 214,
	squat: 215,
	jumpRope: 216,
	functionalTraining: 217,
	zumba: 218,
	boxing: 219,
	martialArts: 220,
	taiChi: 221,
	taekwondo: 222,
	karate: 223,
	jazz: 224,
	fencing: 225,
	archery: 226,
	gymnastics: 227,
	sailling: 228,
	parallel_bars: 229,
	shotPut: 230,
	bowling: 231,
	beachVolley: 232,
	tableTennis: 233,
	frescoball: 234,
	hockey: 235,
	squash: 236,
	softball: 237,
	handball: 238,
	motocross: 239,
	baseball: 240,
	futsal: 241,
	syncSwim: 242,
	muayThai: 243,
	tapDance: 244,
	breakdance: 245,
	stretching: 246,
	athletics: 247,
	altinha: 248,
	shuttlecock: 249,
	darts: 250,
	horseRiding: 251,
	bocce: 252,
	fishing: 253,
	foilSurfing: 254,
	skating: 256,
	snowBoarding: 257,
	alpineSkiing: 258,
	athleticMarch: 259,
	obstacleRace: 261,
	relayRace: 262,
	poleDance: 263,
	windsurfing: 264,
	kayaking: 265,
	wakeboard: 266,
	golf: 267,
	wrestling: 268,
	kickboxing: 269,
	kungFu: 270,
	mountaineering: 271,
	skateboarding: 272,
	rappel: 273,
	americanFootball: 274,
	parkour: 275,
	bmx: 276,
	freeTraining: 277,
	strengthTraining: 278,
	artisticGymnastics: 279,
	jump: 280,
	mma: 282,
	barExercise: 283,
	jiuJitsu: 284,
	juiJitsu: 255,
	hipHop: 285,
	speedSkating: 286,
	trampoline: 288,
	sandboard: 289,
	skinboarding: 290,
	sandSoccer: 291,
	kickUps: 292,
	step: 293,
	polo: 294,
	rugby: 295,
	calisthenics: 296,
	hawaiianCanoe: 297,
	kitesurfing: 298,
	rafting: 299,
	skiing: 300,
	bodyboarding: 301,
	downHill: 302,
	mountainCycling: 303,
	badminton: 304,
	sailing: 305,
	atv: 306,
	paragliding: 307,
	triathlon: 308,
	trailRunning: 309,
	stepper: 310,
	flexibility: 311,
	physicalTraining: 312,
	wallBall: 313,
	dumbbells: 314,
	deadlift: 315,
	upperBody: 316,
	burpee: 317,
	back: 318,
	lowerBody: 319,
	bellyDance: 321,
	latinDance: 322,
	streetDance: 323,
	folkDance: 324,
	kendo: 326,
	cricket: 327,
	billiards: 328,
	beachSoccer: 329,
	mobility: 330,
	embaixadinha: 331,
	hulaHoop: 332,
	kiteFlying: 333,
	frisbee: 334,
	equestrian: 335,
	motorsport: 336,
	tugOfWar: 337,
	abdomenTraining: 338,
	keepyUppie: 339,
	rowingMachine: 340,
	waterPolo: 341,
	canoeing: 342,
	physiotherapy: 343,
	acrobatics: 344,
	diving: 345,
	otherAquatic: 346,
	beachFunction: 260,
	beachFunctionalTraining: 281,
};

/** Atividade sintética do app (valores fictícios), no formato do `WorkoutPayloadMapper`. */
const phoneActivity: TechnosActivityHistoryV2Activity = {
	type: 1,
	status: TechnosActivityV2Status.STOPPED,
	day: 2,
	month: 11,
	year: 2026,
	hour: 10,
	minute: 0,
	second: 0,
	watchDistanceInMeters: 4200,
	gpsDistanceInMeters: 0,
	steps: 3500,
	cadence: 117,
	calories: 250,
	averageBpm: 135,
	secondsDuration: 1780,
	locationEnabled: false,
	startDate: "2026-11-02T10:00:00-03:00",
	accuracy: -1,
	gpsSpeedKmH: 0,
	watchSpeedKmH: 8.49,
	minAveragePace: 7,
	secondsAveragePace: 3,
	avgFrequency: 0,
	stepSize: 0,
	jumpRopeTripped: 0,
	jumpRopeTotalJumps: 0,
	jumpRopeMaxConsecutiveJumps: 0,
	elevationGainInMeters: 0,
	activityOrigin: TechnosActivityOrigin.PHONE,
	vo2Max: 31,
	recoveryTimeDate: "2026-11-02T16:29:40-03:00",
	bpmList: [135],
	paceByKm: [],
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe("TechnosCore (fase 3): repasse ao nativo", () => {
	const start: TechnosActivityByTypeStartV2 = { type: 2, locationEnabled: false, hasSpeedometer: false };
	const forceStop: TechnosActivityByTypeStop = { forceStop: true };

	const cases: [string, () => Promise<unknown>, string, unknown[]][] = [
		["getHistoryHeartRate", () => TechnosCore.getHistoryHeartRate(3), "getHistoryHeartRate", [3]],
		["getHistoryStress", () => TechnosCore.getHistoryStress(3), "getHistoryStress", [3]],
		["getHistorySpO2", () => TechnosCore.getHistorySpO2(3), "getHistorySpO2", [3]],
		["getHistoryActivityV2", () => TechnosCore.getHistoryActivityV2(), "getHistoryActivityV2", []],
		["startActivityByTypeV2", () => TechnosCore.startActivityByTypeV2(start), "startActivityByTypeV2", [start]],
		["pauseActivityV2", () => TechnosCore.pauseActivityV2(), "pauseActivityV2", []],
		["resumeActivityV2", () => TechnosCore.resumeActivityV2(), "resumeActivityV2", []],
		["stopActivityV2 (forceStop)", () => TechnosCore.stopActivityV2(forceStop), "stopActivityV2", [forceStop]],
		[
			"checkIosBackgroundLocationPermission",
			() => TechnosCore.checkIosBackgroundLocationPermission(),
			"checkIosBackgroundLocationPermission",
			[],
		],
	];

	it.each(cases)("%s", async (_label, call, method, args) => {
		await call();
		expect(native()[method]).toHaveBeenCalledTimes(1);
		expect(native()[method].mock.calls[0]).toEqual(args);
		// O dicionário chega ao nativo como veio (mesmo objeto), sem cópia no JS.
		args.forEach((arg, index) => {
			if (typeof arg === "object" && arg !== null) {
				expect(native()[method].mock.calls[0][index]).toBe(arg);
			}
		});
	});

	it("os métodos Promise<void> resolvem com undefined", async () => {
		await expect(TechnosCore.getHistoryHeartRate(3)).resolves.toBeUndefined();
		await expect(TechnosCore.startActivityByTypeV2(start)).resolves.toBeUndefined();
		await expect(TechnosCore.stopActivityV2()).resolves.toBeUndefined();
	});

	it("checkIosBackgroundLocationPermission devolve o texto do nativo", async () => {
		await expect(TechnosCore.checkIosBackgroundLocationPermission()).resolves.toBe("granted");
	});

	it("stopActivityV2 sem argumento manda {} ao nativo, como o shim iOS espera", async () => {
		await TechnosCore.stopActivityV2();
		await TechnosCore.stopActivityV2(undefined);
		expect(native().stopActivityV2.mock.calls).toEqual([[{}], [{}]]);
	});
});

describe("TechnosCore (fase 3): observed()", () => {
	const directCalls: [string, () => Promise<unknown>][] = [
		["getHistoryHeartRate", () => TechnosCore.getHistoryHeartRate(3)],
		["getHistoryStress", () => TechnosCore.getHistoryStress(3)],
		["getHistorySpO2", () => TechnosCore.getHistorySpO2(3)],
		["getHistoryActivityV2", () => TechnosCore.getHistoryActivityV2()],
		["startActivityByTypeV2", () => TechnosCore.startActivityByTypeV2({ type: 1, locationEnabled: false })],
		["pauseActivityV2", () => TechnosCore.pauseActivityV2()],
		["resumeActivityV2", () => TechnosCore.resumeActivityV2()],
		["stopActivityV2", () => TechnosCore.stopActivityV2()],
		["checkIosBackgroundLocationPermission", () => TechnosCore.checkIosBackgroundLocationPermission()],
	];

	// O app Condor chama todos sem await (Smartwatch.ts:113-160, 258-260).
	it.each(directCalls)("%s sem await não gera rejeição sem tratamento", async (method, call) => {
		native()[method].mockReturnValueOnce(Promise.reject(nativeError(errorCodes.NOT_READY)));
		call();
		await settle();
		expect(native()[method]).toHaveBeenCalledTimes(1);
	});

	it("com await, rejeita com o code do nativo", async () => {
		native().checkIosBackgroundLocationPermission.mockReturnValueOnce(
			Promise.reject(nativeError(errorCodes.NOT_SUPPORTED)),
		);
		const error = await TechnosCore.checkIosBackgroundLocationPermission().catch((reason: unknown) => reason);
		expect(utils.errors.getErrorCode(error)).toBe("NOT_SUPPORTED");

		native().startActivityByTypeV2.mockReturnValueOnce(Promise.reject(nativeError(errorCodes.LOW_BATTERY)));
		await expect(TechnosCore.startActivityByTypeV2({ type: 2, locationEnabled: false })).rejects.toMatchObject({
			code: "LOW_BATTERY",
		});
	});
});

describe("TechnosCore.activityTypes", () => {
	it("é a tabela do Core v4.3.57, com os mesmos nomes, códigos e ordem", () => {
		expect(Object.entries(TechnosCore.activityTypes)).toEqual(Object.entries(CORE_V4_3_57_ACTIVITY_TYPES));
	});

	it("o mock usa a mesma tabela", () => {
		expect(MockTechnosCore.activityTypes).toBe(TechnosCore.activityTypes);
	});

	it("tem os tipos que o app Condor lê e os dois códigos duplicados do Core", () => {
		const types = TechnosCore.activityTypes;
		expect([types.walk, types.run, types.cycling, types.treadmillRunning, types.spinning]).toEqual([1, 2, 3, 200, 10]);
		expect([types.beachTennis, types.poolSwimming, types.sup, types.freeTraining]).toEqual([75, 54, 188, 277]);
		expect([types.functionalTraining, types.back, types.lowerBody]).toEqual([217, 318, 319]);
		expect([types.jiuJitsu, types.juiJitsu, types.beachFunctionalTraining, types.beachFunction]).toEqual([
			284, 255, 281, 260,
		]);
		const codes = Object.values(types);
		expect(new Set(codes).size).toBe(codes.length);
	});
});

describe("enums de valor das atividades", () => {
	it("têm os membros, números e textos do Core", () => {
		expect({ ...TechnosActivityV2Status }).toEqual({
			STOPPED: 0,
			START_REQUESTED: 1,
			STARTED: 2,
			RESUME: 3,
			PAUSED: 4,
			WATCH_STOPPED: 5,
			0: "STOPPED",
			1: "START_REQUESTED",
			2: "STARTED",
			3: "RESUME",
			4: "PAUSED",
			5: "WATCH_STOPPED",
		});
		expect({ ...TechnosActivityOrigin }).toEqual({ WATCH: "Watch", PHONE: "Phone" });
		expect(TechnosActivityErrorCode.ACTIVITY_GENERIC_ERROR).toBe(-1);
		expect(TechnosActivityErrorCode.SUCCESS).toBe(0);
		expect(TechnosActivityErrorCode.ACTIVITY_ALREADY_RUNNING).toBe(1);
		expect(TechnosActivityErrorCode.DEVICE_WITH_LOW_BATTERY).toBe(2);
		expect(TechnosActivityErrorCode.DEVICE_IS_CHARGING).toBe(3);
		expect(TechnosActivityErrorCode.DEVICE_USING_ALEXA).toBe(4);
		expect([
			PlanType.Run3Km,
			PlanType.Run5Km,
			PlanType.Run10Km,
			PlanType.HalfMarathonTrainingPhase2,
			PlanType.MarathonTrainingPhase2,
		]).toEqual([1, 2, 3, 4, 5]);
		expect([ActionType.FastWalking, ActionType.Running, ActionType.MediumPaceRunning, ActionType.FastRunning]).toEqual(
			[1, 2, 3, 4],
		);
	});

	it("o mock exporta os mesmos objetos que a raiz", () => {
		expect(mockRoot.TechnosActivityV2Status).toBe(TechnosActivityV2Status);
		expect(mockRoot.TechnosActivityOrigin).toBe(TechnosActivityOrigin);
		expect(mockRoot.TechnosActivityErrorCode).toBe(TechnosActivityErrorCode);
		expect(mockRoot.PlanType).toBe(PlanType);
		expect(mockRoot.ActionType).toBe(ActionType);
		expect(mockRoot.TechnosActivityV2Status.STOPPED).toBe(0);
		expect(mockRoot.TechnosActivityOrigin.PHONE).toBe("Phone");
		expect(mockRoot.TechnosActivityErrorCode.DEVICE_WITH_LOW_BATTERY).toBe(2);
		expect(mockRoot.PlanType.Run3Km).toBe(1);
	});

	it("servem ao switch de estado que o app Condor faz", () => {
		const toApp = (status: TechnosActivityV2Status): string => {
			switch (status) {
				case TechnosActivityV2Status.STARTED:
					return "STARTED";
				case TechnosActivityV2Status.PAUSED:
					return "PAUSED";
				case TechnosActivityV2Status.STOPPED:
					return "STOPPED";
				default:
					return "NONE";
			}
		};
		expect(toApp(phoneActivity.status)).toBe("STOPPED");
		expect(toApp({ ...phoneActivity, status: TechnosActivityV2Status.PAUSED }.status)).toBe("PAUSED");
	});
});

describe("eventos da fase 3", () => {
	const testPath = expect.getState().testPath ?? "";
	const fs = jest.requireActual<{ readFileSync(path: string, encoding: "utf8"): string }>("fs");
	const path = jest.requireActual<{ resolve(...segments: string[]): string; dirname(file: string): string }>("path");
	const specSource = fs.readFileSync(path.resolve(path.dirname(testPath), "../../src/specs/NativeCoreNext.ts"), "utf8");

	it("technosEventNames segue os emissores do spec, na mesma ordem", () => {
		const declared = Array.from(specSource.matchAll(/readonly (\w+): CodegenTypes\.EventEmitter/g), match => match[1]);
		expect(declared).toEqual([...technosEventNames]);
		expect(technosEventNames).toEqual(expect.arrayContaining([...PHASE3_EVENTS]));
	});

	it("todo método do spec existe no TechnosCore e no mock", () => {
		const methods = Array.from(specSource.matchAll(/^\t(\w+)\(.*\): [^;]+;$/gm), match => match[1]);
		expect(methods).toEqual(
			expect.arrayContaining([
				"getHistoryHeartRate",
				"getHistoryStress",
				"getHistorySpO2",
				"getHistoryActivityV2",
				"startActivityByTypeV2",
				"pauseActivityV2",
				"resumeActivityV2",
				"stopActivityV2",
				"checkIosBackgroundLocationPermission",
			]),
		);
		for (const method of methods) {
			expect([method, typeof (TechnosCore as Record<string, unknown>)[method]]).toEqual([method, "function"]);
			expect([method, typeof (MockTechnosCore as Record<string, unknown>)[method]]).toEqual([method, "function"]);
		}
	});

	it("TechnosEvents usa os emissores do spec", () => {
		const handler = jest.fn();
		TechnosEvents.onHistoryHeartRate(handler);
		TechnosEvents.onActivityCompletedV2(handler);
		expect(native().onHistoryHeartRate).toHaveBeenCalledWith(handler);
		expect(native().onActivityCompletedV2).toHaveBeenCalledWith(handler);
	});

	it("o errorCodes tem o LOW_BATTERY da fase 3", () => {
		expect(errorCodes.LOW_BATTERY).toBe("LOW_BATTERY");
		expect(TechnosCore.errorCodes.LOW_BATTERY).toBe("LOW_BATTERY");
	});
});

describe("mock (fase 3)", () => {
	beforeEach(() => {
		mockReset();
	});

	it("tem um emissor para cada nome de technosEventNames", () => {
		expect(Object.keys(MockTechnosEvents)).toEqual([...technosEventNames]);
		for (const name of technosEventNames) {
			const subscription = MockTechnosEvents[name](jest.fn());
			expect([name, mockListenerCount(name)]).toEqual([name, 1]);
			subscription.remove();
		}
	});

	it("entrega os payloads dos eventos novos", () => {
		const heartRate: HistoryHeartRateEvent = {
			historyheartrate: [
				{
					date: "2026-11-02",
					items: {
						avgValues: [{ timestamp: "2026-11-02T12:00:00-03:00", value: 97, min: 70, max: 150 }],
						otherValues: [],
					},
				},
			],
		};
		const stress: HistoryStressEvent = {
			historystress: [
				{
					date: "2026-11-02",
					items: {
						avgValues: [
							{ timestamp: "2026-11-02T10:00:00-03:00", value: 35, min: 30, max: 40, stressValues: [30, 40] },
						],
						otherValues: [],
					},
				},
			],
		};
		const received: Partial<{ [K in TechnosEventName]: TechnosEventMap[K] }> = {};
		MockTechnosEvents.onHistoryHeartRate(event => {
			received.onHistoryHeartRate = event;
		});
		MockTechnosEvents.onHistoryStress(event => {
			received.onHistoryStress = event;
		});
		MockTechnosEvents.onHistorySpo2(event => {
			received.onHistorySpo2 = event;
		});
		MockTechnosEvents.onActivityCompletedV2(event => {
			received.onActivityCompletedV2 = event;
		});
		MockTechnosEvents.onActivityError(event => {
			received.onActivityError = event;
		});

		mockEmit("onHistoryHeartRate", heartRate);
		mockEmit("onHistoryStress", stress);
		mockEmit("onHistorySpo2", { historyspo2: [] });
		mockEmit("onActivityCompletedV2", phoneActivity);
		mockEmit("onActivityError", { errorCode: TechnosActivityErrorCode.ACTIVITY_GENERIC_ERROR });

		expect(received).toEqual({
			onHistoryHeartRate: heartRate,
			onHistoryStress: stress,
			onHistorySpo2: { historyspo2: [] },
			onActivityCompletedV2: phoneActivity,
			onActivityError: { errorCode: -1 },
		});
	});

	it("os métodos da fase 3 têm os valores padrão, também depois do mockReset", async () => {
		MockTechnosCore.checkIosBackgroundLocationPermission.mockResolvedValueOnce("granted");
		mockReset();
		await expect(MockTechnosCore.getHistoryHeartRate(3)).resolves.toBeUndefined();
		await expect(MockTechnosCore.getHistoryStress(3)).resolves.toBeUndefined();
		await expect(MockTechnosCore.getHistorySpO2(3)).resolves.toBeUndefined();
		await expect(MockTechnosCore.getHistoryActivityV2()).resolves.toBeUndefined();
		await expect(MockTechnosCore.startActivityByTypeV2({ type: 1, locationEnabled: false })).resolves.toBeUndefined();
		await expect(MockTechnosCore.pauseActivityV2()).resolves.toBeUndefined();
		await expect(MockTechnosCore.resumeActivityV2()).resolves.toBeUndefined();
		await expect(MockTechnosCore.stopActivityV2()).resolves.toBeUndefined();
		await expect(MockTechnosCore.checkIosBackgroundLocationPermission()).resolves.toBe("denied");
	});
});

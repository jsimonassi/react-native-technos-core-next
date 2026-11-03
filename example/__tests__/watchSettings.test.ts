/**
 * Testa os métodos da fase 2 do wrapper real (`src/index.ts`) sobre um TurboModule falso: o repasse exato dos argumentos
 * no formato do app Condor, o padrão do `manageNotifications` e o `observed()` (sem `await` não gera rejeição sem
 * tratamento; com `await` rejeita com o `code`). O Jest falha o teste sozinho quando uma Promise rejeita sem tratamento.
 */
import { TechnosCore, errorCodes, utils } from "react-native-technos-core-next/src/index";
import type {
	TechnosAlarmSet,
	TechnosContactItem,
	TechnosWeatherListUpdateItem,
	TechnosWorldClockSet,
} from "react-native-technos-core-next";
import { observed } from "react-native-technos-core-next/src/utils/promise";

jest.mock("react-native-technos-core-next/src/specs/NativeCoreNext", () => {
	const promiseMethods = [
		"resetDevice",
		"setUserInfo",
		"setGoalsV2",
		"set12HourFormat",
		"setTemperatureUnit",
		"setDistanceUnit",
		"setScreenTime",
		"setDeviceBatterySaving",
		"setSosHelp",
		"setGestureControlV2",
		"setMenstrual",
		"setHeartRateAutomaticCheck",
		"setStressAutomaticCheck",
		"setNotDisturb",
		"setWaterReminderV2",
		"setWalkReminder",
		"setAlarm",
		"setWorldClock",
		"manageNotifications",
		"setAddressBook",
		"syncWeather",
		"vibrateDevice",
		"openCameraMode",
		"closeCameraMode",
	];
	return {
		__esModule: true,
		default: Object.fromEntries(promiseMethods.map(name => [name, jest.fn(() => Promise.resolve())])),
	};
});

type FakeNative = Record<string, jest.Mock>;

const native = (): FakeNative =>
	jest.requireMock<{ default: FakeNative }>("react-native-technos-core-next/src/specs/NativeCoreNext").default;

/** Espera os microtasks e um ciclo de timers reais: tempo para o Jest notar uma rejeição sem tratamento. */
const settle = () => new Promise<void>(resolve => setTimeout(() => resolve(), 20));

const nativeError = (code: string) => Object.assign(new Error(`${code} from native`), { code });

const alarms: TechnosAlarmSet[] = [
	{ position: "1", enable: true, hour: 6, minute: 45, repeat: "1111100", day: 2, month: 11, year: 2026, type: 0 },
	{ position: "2", enable: false, hour: 7, minute: 0, repeat: "0000000" },
];
const worldClocks: TechnosWorldClockSet[] = [
	{ name: "Tóquio", utcOffsetMinutes: 540, latitude: 35.6762, longitude: 139.6503 },
];
const contacts: TechnosContactItem[] = [{ name: "Ana Teste", phoneNumber: "+55 (00) 90000-0001" }];
const weather: TechnosWeatherListUpdateItem[] = [
	{
		max: 28,
		min: 18,
		uvi: 0,
		rain: 0,
		temperature: 25,
		visibility: 0,
		humidity: 60,
		wind: 10,
		icon: 1,
		datetime: "2026-11-02T12:00:00-03:00",
		locationName: "Teste",
		sunrise: "2026-11-02T06:00:00-03:00",
	},
];
const everyDay = {
	monday: true,
	tuesday: true,
	wednesday: true,
	thursday: true,
	friday: true,
	saturday: true,
	sunday: true,
};

beforeEach(() => {
	jest.clearAllMocks();
});

describe("TechnosCore (fase 2): repasse ao nativo", () => {
	// Cada caso: chamada no wrapper, método nativo e argumentos que ele tem de receber, sem cópia nem conversão.
	const userInfo = { year: 1996, month: 5, day: 10, weight: 60, height: 165.5, gender: "f" };
	const goals = { steps: 8000, calories: 350, distance: 3000, exerciseTimeInMinutes: 45, movementTimeInHours: 12 };
	const distanceUnit = { distance_unit: "miles" };
	const gesture = { enabled: true, startHour: "07:30", endHour: "23:00" };
	const menstrual = {
		enabled: true,
		reminder: true,
		menstrualCycleLength: 28,
		menstrualPeriodLength: 5,
		lastMenstrualPeriodYear: 2026,
		lastMenstrualPeriodMonth: 2,
		lastMenstrualPeriodDay: 9,
	};
	const stress = {
		enabled: true,
		excessiveStressEnabled: false,
		startHour: "08:00",
		endHour: "22:00",
		interval: 30,
		repeat: everyDay,
	};
	const notDisturb = { enabled: true, startHour: "22:00", endHour: "07:30", repeat: everyDay };
	const water = { enabled: true, startHour: "10:02", interval: 10, reminderCount: 8 };
	const walk = { onOff: false, startHour: "10:00", endHour: "22:00", interval: 60 };
	const noAlarms: TechnosAlarmSet[] = [];
	const noWeather: TechnosWeatherListUpdateItem[] = [];
	const notificationsOn = { WhatsApp: true };
	const notificationsOff = { CALLS: false };

	const cases: [string, () => Promise<void>, string, unknown[]][] = [
		["setUserInfo", () => TechnosCore.setUserInfo(userInfo), "setUserInfo", [userInfo]],
		["setGoalsV2", () => TechnosCore.setGoalsV2(goals), "setGoalsV2", [goals]],
		["set12HourFormat (true = 12 h)", () => TechnosCore.set12HourFormat(true), "set12HourFormat", [true]],
		["set12HourFormat (false = 24 h)", () => TechnosCore.set12HourFormat(false), "set12HourFormat", [false]],
		["setTemperatureUnit", () => TechnosCore.setTemperatureUnit("f"), "setTemperatureUnit", ["f"]],
		[
			"setDistanceUnit (dicionário)",
			() => TechnosCore.setDistanceUnit(distanceUnit),
			"setDistanceUnit",
			[distanceUnit],
		],
		["setScreenTime", () => TechnosCore.setScreenTime(10), "setScreenTime", [10]],
		["setDeviceBatterySaving", () => TechnosCore.setDeviceBatterySaving(true), "setDeviceBatterySaving", [true]],
		["setSosHelp", () => TechnosCore.setSosHelp(false), "setSosHelp", [false]],
		["setGestureControlV2", () => TechnosCore.setGestureControlV2(gesture), "setGestureControlV2", [gesture]],
		["setMenstrual", () => TechnosCore.setMenstrual(menstrual), "setMenstrual", [menstrual]],
		[
			"setHeartRateAutomaticCheck (4 posicionais)",
			() => TechnosCore.setHeartRateAutomaticCheck(true, "00:00", "23:59", 5),
			"setHeartRateAutomaticCheck",
			[true, "00:00", "23:59", 5],
		],
		[
			"setStressAutomaticCheck",
			() => TechnosCore.setStressAutomaticCheck(stress),
			"setStressAutomaticCheck",
			[stress],
		],
		["setNotDisturb", () => TechnosCore.setNotDisturb(notDisturb), "setNotDisturb", [notDisturb]],
		["setWaterReminderV2", () => TechnosCore.setWaterReminderV2(water), "setWaterReminderV2", [water]],
		["setWalkReminder (onOff)", () => TechnosCore.setWalkReminder(walk), "setWalkReminder", [walk]],
		["setAlarm (lista, chave enable)", () => TechnosCore.setAlarm(alarms), "setAlarm", [alarms]],
		["setAlarm (lista vazia)", () => TechnosCore.setAlarm(noAlarms), "setAlarm", [noAlarms]],
		["setWorldClock", () => TechnosCore.setWorldClock(worldClocks), "setWorldClock", [worldClocks]],
		[
			"manageNotifications (padrão true, como no Core)",
			() => TechnosCore.manageNotifications(notificationsOn),
			"manageNotifications",
			[notificationsOn, true],
		],
		[
			"manageNotifications (false explícito, como o app Condor)",
			() => TechnosCore.manageNotifications(notificationsOff, false),
			"manageNotifications",
			[notificationsOff, false],
		],
		["setAddressBook", () => TechnosCore.setAddressBook(contacts), "setAddressBook", [contacts]],
		["syncWeather", () => TechnosCore.syncWeather(weather), "syncWeather", [weather]],
		["syncWeather (lista vazia)", () => TechnosCore.syncWeather(noWeather), "syncWeather", [noWeather]],
		["vibrateDevice", () => TechnosCore.vibrateDevice(), "vibrateDevice", []],
		["openCameraMode", () => TechnosCore.openCameraMode(), "openCameraMode", []],
		["closeCameraMode", () => TechnosCore.closeCameraMode(), "closeCameraMode", []],
		["resetDevice", () => TechnosCore.resetDevice(), "resetDevice", []],
	];

	it.each(cases)("%s", async (_label, call, method, args) => {
		await expect(call()).resolves.toBeUndefined();
		expect(native()[method]).toHaveBeenCalledTimes(1);
		expect(native()[method].mock.calls[0]).toEqual(args);
		// O dicionário e as listas chegam ao nativo como vieram (mesmo objeto), sem cópia no JS.
		args.forEach((arg, index) => {
			if (typeof arg === "object" && arg !== null) {
				expect(native()[method].mock.calls[0][index]).toBe(arg);
			}
		});
	});
});

describe("observed()", () => {
	const directCalls: [string, () => Promise<void>][] = [
		[
			"setUserInfo",
			() => TechnosCore.setUserInfo({ year: 1996, month: 5, day: 10, weight: 60, height: 165, gender: "f" }),
		],
		["syncWeather", () => TechnosCore.syncWeather(weather)],
		["vibrateDevice", () => TechnosCore.vibrateDevice()],
		["openCameraMode", () => TechnosCore.openCameraMode()],
		["closeCameraMode", () => TechnosCore.closeCameraMode()],
		["resetDevice", () => TechnosCore.resetDevice()],
	];

	it.each(directCalls)("%s sem await não gera rejeição sem tratamento", async (method, call) => {
		native()[method].mockReturnValueOnce(Promise.reject(nativeError(errorCodes.NOT_READY)));
		call();
		await settle();
		expect(native()[method]).toHaveBeenCalledTimes(1);
	});

	it("com await, rejeita com o code do nativo", async () => {
		native().setTemperatureUnit.mockReturnValueOnce(Promise.reject(nativeError(errorCodes.TIMEOUT)));
		await expect(TechnosCore.setTemperatureUnit("c")).rejects.toMatchObject({ code: "TIMEOUT" });

		native().setAlarm.mockReturnValueOnce(Promise.reject(nativeError(errorCodes.NOT_SUPPORTED)));
		const error = await TechnosCore.setAlarm([]).catch((reason: unknown) => reason);
		expect(utils.errors.getErrorCode(error)).toBe("NOT_SUPPORTED");
	});

	it("devolve a mesma Promise e não muda o valor", async () => {
		const promise = Promise.resolve(42);
		expect(observed(promise)).toBe(promise);
		await expect(observed(promise)).resolves.toBe(42);
		expect(utils.promise.observed).toBe(observed);
	});

	it("marca a rejeição como tratada sem engolir para quem espera", async () => {
		const rejected = observed(Promise.reject(nativeError(errorCodes.DISCONNECTED)));
		await settle();
		await expect(rejected).rejects.toMatchObject({ code: "DISCONNECTED" });
	});
});

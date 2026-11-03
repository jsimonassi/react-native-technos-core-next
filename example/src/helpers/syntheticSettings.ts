import type {
	TechnosAlarmSet,
	TechnosContactItem,
	TechnosDistanceUnitUpdate,
	TechnosGestureControlSetV2,
	TechnosGoalsSet,
	TechnosManageNotificationsUpdate,
	TechnosMenstrualDataUpdate,
	TechnosNotDisturbSet,
	TechnosRepeatWeekdays,
	TechnosStressAutomaticUpdate,
	TechnosUserInfoSet,
	TechnosWalkReminderUpdate,
	TechnosWaterReminderUpdate,
	TechnosWeatherListUpdateItem,
	TechnosWorldClockSet,
} from "react-native-technos-core-next";

/*
 * Catálogo único dos valores da aba Ajustes, nos formatos que o app Condor manda ao Core (chaves `enable` no alarme,
 * `onOff` no sedentarismo e `enabled` no resto; `repeat` como string no alarme e objeto nos outros; mês 1-12 no perfil
 * e 0-11 no ciclo). Tudo é fictício: perfil, ciclo, contatos e clima não são de ninguém, e os telefones usam o DDD 00,
 * que não existe (uma ligação de teste pelo relógio nunca chega a alguém). As cidades do relógio mundial são dado
 * público. As gravações da fase 2 vão virar fixtures do Repo 1, e o `CrpPhase2FixtureTest` de lá (ainda não existe;
 * D17, fatia S9, ADR 39 do Repo 1) vai conferir os TX contra estes valores: mudou um valor aqui depois disso, mude lá.
 * Hoje nenhum teste do Repo 1 lê este arquivo; os vetores de lá (`Phase2CrpVectors`, `Phase2JsSamples`) são próprios.
 */

const pad2 = (value: number): string => String(value).padStart(2, "0");

/** `HH:mm` de uma data no fuso do telefone, o formato das janelas do Core. */
export const hhmm = (date: Date): string => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;

/** A mesma data deslocada em minutos. */
export const addMinutes = (date: Date, minutes: number): Date => new Date(date.getTime() + minutes * 60_000);

/** ISO-8601 com o offset do telefone (`2026-11-02T06:00:00-03:00`), o formato do `sunrise` que o app Condor manda. */
export const isoWithOffset = (date: Date): string => {
	const offset = -date.getTimezoneOffset();
	const sign = offset >= 0 ? "+" : "-";
	const abs = Math.abs(offset);
	return (
		`${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
		`T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}` +
		`${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`
	);
};

const atTime = (base: Date, hours: number, minutes: number, dayOffset = 0): Date =>
	new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hours, minutes, 0, 0);

/** Todos os dias ligados, como os padrões do app Condor. */
const everyDay: TechnosRepeatWeekdays = {
	monday: true,
	tuesday: true,
	wednesday: true,
	thursday: true,
	friday: true,
	saturday: true,
	sunday: true,
};

/** Estresse como o app Condor manda: o `INITIAL_STATE` dele tem `notifyFlag`, que o tipo do Core não declara. */
type CondorStressPayload = TechnosStressAutomaticUpdate & { notifyFlag: number };

/** Perfil fictício: 165 cm, 60 kg, nascimento em 1996-05-10 (mês 1-12), gênero `"f"`. */
const userInfo: TechnosUserInfoSet = { year: 1996, month: 5, day: 10, weight: 60, height: 165, gender: "f" };

/** Metas: 8000 passos, 350 kcal, 45 min; distância e horas de movimento nos padrões do app Condor (não vão ao CRP). */
const goals: TechnosGoalsSet = {
	steps: 8000,
	calories: 350,
	distance: 3000,
	exerciseTimeInMinutes: 45,
	movementTimeInHours: 12,
};

const distanceKm: TechnosDistanceUnitUpdate = { distance_unit: "km" };
const distanceMiles: TechnosDistanceUnitUpdate = { distance_unit: "miles" };

/** Opções de tempo de tela, em segundos (a tela do app Condor vai de 5 a 30; 20 e 25 fecham a faixa do `7D`). */
const screenTimes = [5, 10, 20, 25, 30] as const;

const gestureOn: TechnosGestureControlSetV2 = { enabled: true, startHour: "07:30", endHour: "23:00" };
const gestureOff: TechnosGestureControlSetV2 = { enabled: false, startHour: "07:30", endHour: "23:00" };

/** Gesto ligado numa janela que não inclui a hora atual (de daqui a 2 h a daqui a 3 h): levantar o pulso não acende. */
const gestureOutsideNow = (now: Date): TechnosGestureControlSetV2 => ({
	enabled: true,
	startHour: hhmm(addMinutes(now, 120)),
	endHour: hhmm(addMinutes(now, 180)),
});

/** Ciclo fictício: 28 dias, 5 de menstruação, início em 9 de março (mês 2, 0-11), lembretes às 10:00. */
const menstrualOn: TechnosMenstrualDataUpdate = {
	enabled: true,
	reminder: true,
	lastMenstrualPeriodDay: 9,
	lastMenstrualPeriodMonth: 2,
	lastMenstrualPeriodYear: 2026,
	menstrualCycleLength: 28,
	menstrualPeriodLength: 5,
	ovulationDistanceFromNextMenstrualPeriod: 14,
	fertileWindowStartDistanceFromOvulationDay: 5,
	fertileWindowEndDistanceFromOvulationDay: 1,
	reminderMenstrualPeriod: 1,
	reminderOvulation: 1,
	reminderHour: 10,
	reminderMinute: 0,
};

/** Silenciar como o app Condor (`buildMenstrualWatchSilencePayload`): desligado, com a data de hoje e 28/5 dias. */
const menstrualSilenced = (now: Date): TechnosMenstrualDataUpdate => ({
	enabled: false,
	reminder: false,
	lastMenstrualPeriodDay: now.getDate(),
	lastMenstrualPeriodMonth: now.getMonth(),
	lastMenstrualPeriodYear: now.getFullYear(),
	menstrualCycleLength: 28,
	menstrualPeriodLength: 5,
	reminderMenstrualPeriod: 1,
	reminderOvulation: 1,
	reminderHour: 10,
	reminderMinute: 0,
});

/** Janela e intervalo que a tela de frequência cardíaca do app Condor sempre manda. */
const heartRate = { startHour: "00:00", endHour: "23:59", interval: 5 } as const;

const stressBase: CondorStressPayload = {
	enabled: true,
	excessiveStressEnabled: false,
	startHour: "08:00",
	endHour: "22:00",
	interval: 30,
	repeat: everyDay,
	notifyFlag: 3,
};
const stressOn: CondorStressPayload = { ...stressBase, enabled: true };
const stressOff: CondorStressPayload = { ...stressBase, enabled: false };

/** Não perturbe automático como o app Condor manda (o manual usa 00:00-23:59 sem `repeat`). */
const notDisturbOn: TechnosNotDisturbSet = { enabled: true, startHour: "22:00", endHour: "07:30", repeat: everyDay };
const notDisturbOff: TechnosNotDisturbSet = { enabled: false, startHour: "22:00", endHour: "07:30", repeat: everyDay };

/** Não perturbe numa janela que inclui a hora atual (de 1 min atrás a daqui a 1 h): o ícone aparece na hora. */
const notDisturbNow = (now: Date): TechnosNotDisturbSet => ({
	enabled: true,
	startHour: hhmm(addMinutes(now, -1)),
	endHour: hhmm(addMinutes(now, 60)),
	repeat: everyDay,
});

/** Lembrete de água começando daqui a 2 min, a cada 10 min (o relógio deve vibrar no horário). */
const waterOn = (now: Date, reminderCount = 8): TechnosWaterReminderUpdate => ({
	enabled: true,
	startHour: hhmm(addMinutes(now, 2)),
	endHour: "23:59",
	interval: 10,
	reminderCount,
	repeat: everyDay,
});

/** Desligado, com os padrões do app Condor. */
const waterOff: TechnosWaterReminderUpdate = {
	enabled: false,
	startHour: "08:00",
	endHour: "20:00",
	interval: 60,
	reminderCount: 0,
	repeat: everyDay,
};

/** Sedentarismo com os padrões do app Condor (`DEFAULT_MOVEMENT_REMINDER` passado pelo mapper dele). */
const walkBase: TechnosWalkReminderUpdate = {
	onOff: true,
	startHour: "10:00",
	endHour: "22:00",
	repeat: everyDay,
	notifyType: 1,
	stepPerHour: 100,
	movementHourTimeGoal: 12,
	interval: 60,
};
const walkOn: TechnosWalkReminderUpdate = { ...walkBase, onOff: true };
const walkOff: TechnosWalkReminderUpdate = { ...walkBase, onOff: false };

/**
 * Três alarmes como o app Condor monta (`position` a partir de 1, `enable`, `repeat` de segunda a domingo, a data de
 * criação com mês 1-12 e `type` 0): segunda a sexta 06:45, todo dia 07:00 e um único daqui a 2 min.
 */
const alarms = (now: Date): TechnosAlarmSet[] => {
	const created = { day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear(), type: 0 };
	const soon = addMinutes(now, 2);
	return [
		{ position: "1", enable: true, hour: 6, minute: 45, repeat: "1111100", ...created },
		{ position: "2", enable: true, hour: 7, minute: 0, repeat: "1111111", ...created },
		{
			position: "3",
			enable: true,
			hour: soon.getHours(),
			minute: soon.getMinutes(),
			repeat: "0000000",
			...created,
		},
	];
};

/** Cidades sem horário de verão hoje (o offset fixo fica certo); Buenos Aires tem latitude e longitude negativas. */
const tokyo: TechnosWorldClockSet = { name: "Tóquio", utcOffsetMinutes: 540, latitude: 35.6762, longitude: 139.6503 };
const buenosAires: TechnosWorldClockSet = {
	name: "Buenos Aires",
	utcOffsetMinutes: -180,
	latitude: -34.6037,
	longitude: -58.3816,
};
const worldClocks = {
	two: [tokyo, buenosAires],
	one: [tokyo],
	none: [] as TechnosWorldClockSet[],
};

/** Dois contatos fictícios, como o app Condor manda (número formatado, um com `+`); DDD 00 não existe. */
const contacts: TechnosContactItem[] = [
	{ name: "Ana Teste", phoneNumber: "+55 (00) 90000-0001" },
	{ name: "José Exemplo", phoneNumber: "(00) 90000-0002" },
];

/** Um dia de previsão: ícone (`condition_id` da API do app), mínima e máxima em °C. */
interface ForecastDay {
	icon: number;
	min: number;
	max: number;
}

/**
 * Previsão de 7 dias contando hoje: sol 18/28, chuva 17/23, nublado 16/24, encoberto 15/22, frio (neblina) 12/19, neve
 * −3/2 e névoa seca 20/30 (ícones da tabela `WeatherAPIV3` do Core: 1, 18, 4, 6, 31, 22 e 5). A neve testa a
 * temperatura negativa.
 */
const forecast: readonly ForecastDay[] = [
	{ icon: 1, min: 18, max: 28 },
	{ icon: 18, min: 17, max: 23 },
	{ icon: 4, min: 16, max: 24 },
	{ icon: 6, min: 15, max: 22 },
	{ icon: 31, min: 12, max: 19 },
	{ icon: 22, min: -3, max: 2 },
	{ icon: 5, min: 20, max: 30 },
];

/**
 * Clima fictício como o app Condor monta (`useWeatherData`): hoje com 25 °C, sol, cidade `"Teste"` e nascer e pôr do
 * sol às 06:00 e 18:00 de hoje; os dias seguintes só com mínima, máxima e ícone (temperatura 0).
 */
const weather = (now: Date): TechnosWeatherListUpdateItem[] =>
	forecast.map((day, index) => ({
		max: day.max,
		min: day.min,
		uvi: 0,
		rain: 0,
		temperature: index === 0 ? 25 : 0,
		visibility: 0,
		humidity: index === 0 ? 60 : 0,
		wind: index === 0 ? 10 : 0,
		icon: day.icon,
		datetime: isoWithOffset(atTime(now, 12, 0, index)),
		locationName: "Teste",
		...(index === 0
			? { sunrise: isoWithOffset(atTime(now, 6, 0)), sunset: isoWithOffset(atTime(now, 18, 0)) }
			: {}),
	}));

/** Todas as notificações: as chaves fixas do app Condor e alguns apps da lista do Condor Reebok. */
const notificationsAll: TechnosManageNotificationsUpdate = {
	ALL_APPS: true,
	CALLS: true,
	SMS: true,
	CALENDAR: true,
	OTHERS: true,
	WhatsApp: true,
	"WhatsApp Business": true,
	Instagram: true,
	Facebook: true,
	Messenger: true,
	Telegram: true,
	Gmail: true,
	Outlook: true,
	LinkedIn: true,
	YouTube: true,
	X: true,
};

/** O mesmo, com o WhatsApp desligado (no iPhone, uma mensagem dele deixa de aparecer no relógio). */
const notificationsWithoutWhatsApp: TechnosManageNotificationsUpdate = { ...notificationsAll, WhatsApp: false };

/** Catálogo da aba Ajustes. Os itens que dependem da hora recebem `now`. */
export const syntheticSettings = {
	userInfo,
	goals,
	distanceKm,
	distanceMiles,
	screenTimes,
	gestureOn,
	gestureOff,
	gestureOutsideNow,
	menstrualOn,
	menstrualSilenced,
	heartRate,
	stressOn,
	stressOff,
	notDisturbOn,
	notDisturbOff,
	notDisturbNow,
	waterOn,
	waterOff,
	walkOn,
	walkOff,
	alarms,
	worldClocks,
	contacts,
	weather,
	notificationsAll,
	notificationsWithoutWhatsApp,
} as const;

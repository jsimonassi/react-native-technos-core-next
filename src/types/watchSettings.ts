/**
 * Formatos de entrada dos ajustes, mensagens e interações da fase 2, com os nomes e campos do Core atual
 * (`TechnosWareCore` `v4.3.57`, `src/NativeModules/type/watchSettings.ts` e `src/NativeModules/type/device.ts`), para o
 * app Condor trocar de pacote sem renomear tipos.
 *
 * A chave do liga/desliga muda por método, como no Core e no app Condor: `enable` no item de alarme, `onOff` no
 * lembrete de sedentarismo e `enabled` nos demais. O `repeat` é uma string de 7 caracteres no alarme e um objeto de
 * dias nos outros. O JS só repassa: a conversão para o protocolo (booleano como número, nulo, `"HH:mm"`,
 * arredondamento) mora no `SettingsMapper` do `:bridge` do `technos-watch-protocol` (Repo 1), que rejeita entrada
 * malformada com `INVALID_ARGUMENT`. O que cada campo vira no Condor Reebok está em `docs/api-js.md`.
 */

/**
 * Dias da semana do `repeat` em objeto (estresse, não perturbe, água e sedentarismo). Nome novo, só para não repetir o
 * objeto: o Core declara o mesmo objeto dentro de cada tipo. O Condor Reebok ignora os dias desses ajustes.
 */
export interface TechnosRepeatWeekdays {
	monday: boolean;
	tuesday: boolean;
	wednesday: boolean;
	thursday: boolean;
	friday: boolean;
	saturday: boolean;
	sunday: boolean;
}

/** Entrada de `setUserInfo`, igual ao `TechnosUserInfoSet` do Core (`watchSettings.ts:270-277`). */
export interface TechnosUserInfoSet {
	year: number;
	/** Mês do nascimento, de 1 a 12 (o `setMenstrual` usa 0 a 11, como no Core). */
	month: number;
	day: number;
	/** Quilos; arredondado e saturado em 0-255 no Condor Reebok. */
	weight: number;
	/** Centímetros; pode ser fracionário (o app Condor converte de metros), arredondado e saturado em 0-255. */
	height: number;
	/**
	 * `"m"`, `"f"` ou `"o"` (o app Condor manda a primeira letra de "Masculino", "Feminino" ou "Outro"), sem diferenciar
	 * maiúsculas. Vazio vale `"o"` (feminino no Condor Reebok, como nos dois Cores); outra string rejeita
	 * `INVALID_ARGUMENT`.
	 */
	gender: string;
}

/** Entrada de `setGoalsV2`, igual ao `TechnosGoalsSet` do Core (`watchSettings.ts:279-285`). */
export interface TechnosGoalsSet {
	calories: number;
	/** Metros. O Condor Reebok não grava meta de distância. */
	distance: number;
	steps: number;
	/** Ignorado no Condor Reebok. */
	movementTimeInHours: number;
	/** Pode ser fracionário (o app Condor multiplica horas por 60); arredondado. */
	exerciseTimeInMinutes: number;
}

/** Entrada de `setDistanceUnit`, igual ao `TechnosDistanceUnitUpdate` do Core (`watchSettings.ts:170-172`). */
export interface TechnosDistanceUnitUpdate {
	/** `"km"` ou `"miles"` (também `"mi"` e `"mile"`), sem diferenciar maiúsculas; outro valor: `INVALID_ARGUMENT`. */
	distance_unit: string;
}

/** Entrada de `setGestureControlV2` (levantar o pulso para acender), igual ao Core (`watchSettings.ts:343-347`). */
export interface TechnosGestureControlSetV2 {
	enabled: boolean;
	/** `"HH:mm"`. */
	startHour: string;
	/** `"HH:mm"`. */
	endHour: string;
}

/** Um ciclo anterior em `TechnosMenstrualDataUpdate.menstrualHistory`, igual ao Core (`watchSettings.ts:94-102`). */
export interface TechnosMenstrualHistoryEntry {
	startYear: number;
	startMonth: number;
	startDay: number;
	endYear: number;
	endMonth: number;
	endDay: number;
	cycleDays?: number;
}

/** Entrada de `setMenstrual`, igual ao `TechnosMenstrualDataUpdate` do Core (`watchSettings.ts:104-122`). */
export interface TechnosMenstrualDataUpdate {
	enabled: boolean;
	/** Duração da menstruação, em dias. */
	menstrualPeriodLength: number;
	/** Duração do ciclo, em dias. */
	menstrualCycleLength: number;
	/** Não vai para o Condor Reebok (o comando não tem ano). */
	lastMenstrualPeriodYear: number;
	/** Mês do início da última menstruação, de **0 a 11** (o `moment().month()` do app Condor), contrato do Core. */
	lastMenstrualPeriodMonth: number;
	lastMenstrualPeriodDay: number;
	lastMenstrualPeriodEndYear?: number;
	lastMenstrualPeriodEndMonth?: number;
	lastMenstrualPeriodEndDay?: number;
	/** Ignorado no Condor Reebok. */
	menstrualHistory?: TechnosMenstrualHistoryEntry[];
	reminderMenstrualPeriod?: number;
	reminderOvulation?: number;
	/** Hora dos lembretes, de 0 a 23; 0 quando ausente. */
	reminderHour?: number;
	/** Minuto dos lembretes, de 0 a 59; 0 quando ausente. */
	reminderMinute?: number;
	/** Ignorado no Condor Reebok. */
	ovulationDistanceFromNextMenstrualPeriod?: number;
	/** Ignorado no Condor Reebok. */
	fertileWindowStartDistanceFromOvulationDay?: number;
	/** Ignorado no Condor Reebok. */
	fertileWindowEndDistanceFromOvulationDay?: number;
	/**
	 * Liga os lembretes no relógio; sem o campo, valem os de `enabled`. Novo no tipo: o Core não o declara, mas o app
	 * Condor já o manda (`CrpMenstrualPayload`, `GTE-CondorSmart/src/types/app/entities/MenstrualCycle.ts:67-71`).
	 */
	reminder?: boolean;
}

/** Entrada de `setStressAutomaticCheck`, igual ao `TechnosStressAutomaticUpdate` do Core (`watchSettings.ts:4-19`). */
export interface TechnosStressAutomaticUpdate {
	/** Ignorado no Condor Reebok. */
	startHour: string;
	/** Ignorado no Condor Reebok. */
	endHour: string;
	enabled: boolean;
	/** Ignorado no Condor Reebok. */
	interval: number;
	/** Ignorado no Condor Reebok. */
	excessiveStressEnabled: boolean;
	/** Ignorado no Condor Reebok. */
	repeat: TechnosRepeatWeekdays;
}

/** Entrada de `setNotDisturb`, igual ao `TechnosNotDisturbSet` do Core (`watchSettings.ts:244-258`). */
export interface TechnosNotDisturbSet {
	enabled: boolean;
	/** `"HH:mm"`; vazio ou ausente vale 00:00 naquele campo (regra dos dois Cores). */
	startHour?: string;
	/** `"HH:mm"`; vazio ou ausente vale 00:00 naquele campo. */
	endHour?: string;
	/** Só `true` explícito vira o dia inteiro (00:00-23:59). */
	alwaysOn?: boolean;
	/** Ignorado no Condor Reebok. */
	repeat?: TechnosRepeatWeekdays;
}

/** Entrada de `setWaterReminderV2`, igual ao `TechnosWaterReminderUpdate` do Core (`watchSettings.ts:128-143`). */
export interface TechnosWaterReminderUpdate {
	enabled: boolean;
	/** `"HH:mm"`; vazio ou ausente vale 08:00 (como o Core). */
	startHour?: string;
	/** Ignorado no Condor Reebok. */
	endHour?: string;
	/** Minutos entre lembretes, de 1 a 255. */
	interval: number;
	/** Quantidade de lembretes por dia, de 0 a 255; repassada como veio. */
	reminderCount?: number;
	/** Ignorado no Condor Reebok. */
	repeat?: TechnosRepeatWeekdays;
}

/** Entrada de `setWalkReminder` (lembrete de sedentarismo), igual ao do Core (`watchSettings.ts:27-44`). */
export interface TechnosWalkReminderUpdate {
	/** O liga/desliga deste método se chama `onOff`, não `enabled`. É o único campo que o Condor Reebok usa. */
	onOff: boolean;
	startHour?: string;
	endHour?: string;
	stepPerHour?: number;
	/** `NotifyType` do Core: 1 alerta, 2 silencioso. Aqui é `number`, porque `src/types` não exporta valores. */
	notifyType?: number;
	movementHourTimeGoal?: number;
	/**
	 * Minutos. O Condor Reebok não grava; o nativo nunca rejeita por ele (um texto numérico, como o que o backend do app
	 * Condor guarda, é lido, e qualquer outro valor vale 0). O mesmo vale para o `stepPerHour`.
	 */
	interval?: number;
	repeat?: TechnosRepeatWeekdays;
}

/** Um alarme de `setAlarm`, igual ao `TechnosAlarmSet` do Core (`watchSettings.ts:69-82`). */
export interface TechnosAlarmSet {
	/**
	 * Sete caracteres `"0"`/`"1"`, de segunda a domingo (`"1111100"` = segunda a sexta). `"0000000"` é um alarme único,
	 * na próxima ocorrência da hora; os sete dias viram "todo dia".
	 */
	repeat: string;
	/** Ignorado no Condor Reebok (o id é a posição na lista). */
	position: string;
	/** Liga o alarme. A chave é `enable`, não `enabled` (o app Condor manda `!!item.enable`). */
	enable?: boolean;
	/** Ignorado no Condor Reebok (a data do alarme único é calculada no envio). */
	day?: number;
	/** Ignorado no Condor Reebok. */
	month?: number;
	/** Ignorado no Condor Reebok. */
	year?: number;
	hour?: number;
	minute?: number;
	/** Ignorado no Condor Reebok. */
	type?: number;
	/** Ignorado no Condor Reebok. */
	snoozeDuration?: number;
	/** Ignorado no Condor Reebok. */
	snoozeRepeat?: number;
	/** Ignorado no Condor Reebok. */
	alarmName?: string;
}

/** Uma cidade de `setWorldClock`, igual ao `TechnosWorldClockSet` do Core (`watchSettings.ts:336-341`). */
export interface TechnosWorldClockSet {
	/** Não vazio; cortado em 40 bytes UTF-8 sem partir caractere. */
	name: string;
	/** Fuso da cidade em minutos a leste de UTC, com o horário de verão do momento do envio. */
	utcOffsetMinutes: number;
	latitude: number;
	longitude: number;
}

/**
 * Entrada de `manageNotifications`, igual ao `TechnosManageNotificationsUpdate` do Core (`watchSettings.ts:51-53`):
 * nome do app (como o app Condor mostra, ex.: `"WhatsApp"`) ou chave fixa (`"CALLS"`, `"SMS"`, `"CALENDAR"`,
 * `"OTHERS"`, `"ALL_APPS"`, `"ALARM"`) → ligado. Sem diferenciar maiúsculas; a tabela está em `docs/api-js.md`.
 */
export interface TechnosManageNotificationsUpdate {
	[key: string]: boolean;
}

/**
 * Um contato de `setAddressBook`, igual ao `TechnosContactItem` do Core (`src/NativeModules/type/device.ts`). O Core
 * não exporta este tipo da raiz; aqui ele é exportado.
 */
export interface TechnosContactItem {
	name: string;
	/** Como o app tem (parênteses, espaços e traços são removidos no envio; o `+` inicial fica). */
	phoneNumber: string;
}

/**
 * Um dia de `syncWeather`, igual ao `TechnosWeatherListUpdateItem` do Core (`watchSettings.ts:174-190`). O item 0 é
 * hoje; os seguintes são a previsão (o Condor Reebok usa os 7 primeiros, contando hoje).
 */
export interface TechnosWeatherListUpdateItem {
	max: number;
	min: number;
	/** Ignorado no Condor Reebok. */
	uvi: number;
	/** Ignorado no Condor Reebok. */
	rain: number;
	/** Só a do item 0 vai para o relógio. */
	temperature: number;
	/** Ignorado no Condor Reebok. */
	visibility: number;
	/** Ignorado no Condor Reebok. */
	humidity: number;
	/** Ignorado no Condor Reebok. */
	wind: number;
	/** `condition_id` da API de clima do app (1 a 3 sol, 18 chuva...), traduzido pela tabela do Core. */
	icon: number;
	/** Ignorado no Condor Reebok. */
	datetime: string;
	/** Ignorado no Condor Reebok. */
	aqi?: number;
	/** Nome da cidade; só o do item 0 vai para o relógio. Vazio: o relógio não recebe o "hoje". */
	locationName: string;
	/** ISO-8601 com offset (o app Condor manda `undefined` quando a API não tem); só o `HH:mm` depois do `T` é usado. */
	sunrise?: string;
	/** ISO-8601 com offset; só o `HH:mm` depois do `T` é usado. */
	sunset?: string;
	/** `"c"` (padrão) ou `"f"`: em `"f"`, as temperaturas do item são convertidas para °C antes de guardar. */
	temperatureUnit?: string;
}

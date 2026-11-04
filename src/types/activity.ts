/**
 * Tipos das atividades e dos treinos (fase 3), cópias literais das interfaces do Core atual (`TechnosWareCore`
 * `v4.3.57`, `type/eventData/activity.ts`, `type/watchSettings.ts:192-210` e `type/exerciseGoals.ts`), com os mesmos
 * nomes, campos, tipos e opcionais, para o app Condor trocar de pacote sem mudar os tipos.
 *
 * O objeto de atividade é montado pelo `WorkoutPayloadMapper` do `:bridge` (Repo 1). Os comentários de campo dizem o
 * que o Core Next manda quando difere do que o tipo permite; não torne obrigatório nem remova um campo daqui: o
 * contrato é o do Core. Os enums de valor (`TechnosActivityV2Status`, `TechnosActivityOrigin`,
 * `TechnosActivityErrorCode`, `ActionType`, `TechnosExerciseGoalTypes`) moram em `../activityEnums.ts`.
 */
import type {
	ActionType,
	TechnosActivityErrorCode,
	TechnosActivityOrigin,
	TechnosActivityV2Status,
	TechnosExerciseGoalTypes,
} from "../activityEnums";

/** `onHistoryActivityV2`: treinos ainda não confirmados por `deletedSavedData` (categoria `ACTIVITY`). */
export interface TechnosActivityHistoryV2 {
	historyactivity: TechnosActivityHistoryV2Activity[];
}

/**
 * Objeto de atividade de `onHistoryActivityV2`, `onActivityStartedV2`, `onActivityStatusV2`, `onActivityUpdateV2` e
 * `onActivityCompletedV2`, igual ao do Core (`type/eventData/activity.ts:17-78`).
 *
 * Datas ISO-8601 com o offset do telefone (`"2026-11-02T10:00:00-03:00"`), nas duas plataformas.
 */
export interface TechnosActivityHistoryV2Activity {
	/** Código Technos do esporte (`TechnosCore.activityTypes`). */
	type: number;
	status: TechnosActivityV2Status;
	/** Componentes do início, no fuso do telefone. */
	day: number;
	month: number;
	year: number;
	hour: number;
	minute: number;
	second: number;
	/** Distância medida pelo relógio. */
	watchDistanceInMeters: number;
	/** Sempre 0: o Core Next não usa o GPS do celular (DP-127). */
	gpsDistanceInMeters: number;
	steps: number;
	/** Passos por minuto, pela duração ativa. */
	cadence: number;
	calories: number;
	/** Tempo ativo, sem as pausas (DP-115). */
	secondsDuration: number;
	/** Sempre `false` (DP-127). */
	locationEnabled: boolean;
	startDate: string;
	/** Sempre -1. */
	accuracy: number;
	/** Nunca vem: sem GPS (DP-127). */
	locations?: TechnosActivityHistoryV2ActivityLocation[];

	/** Média das leituras válidas; 0 sem leitura. */
	averageBpm: number;
	/** Não vem (F3-D11). */
	maxBpm?: number;
	/** Não vem (F3-D11). */
	minBpm?: number;

	minAveragePace: number;
	secondsAveragePace: number;
	/** Não vem. */
	minutesMaxPace?: number;
	/** Não vem. */
	secondsMaxPace?: number;

	/** Sempre 0 (DP-127). */
	gpsSpeedKmH: number;
	watchSpeedKmH: number;
	/** Não vem. */
	maxSpeedKmH?: number;

	/** Sempre 0. */
	stepSize?: number;

	/** Sempre 0. */
	jumpRopeTripped?: number;
	/** Sempre 0. */
	jumpRopeTotalJumps?: number;
	/** Sempre 0. */
	jumpRopeMaxConsecutiveJumps?: number;
	/** Não vem. */
	jumpRopeLatestConsecutiveJumps?: number;

	/** Sempre 0. */
	avgFrequency?: number;
	/** Natação: não vem (DP-116). */
	avgSwolf?: number;
	/** Natação: não vem (DP-116). */
	swimmingStrokeCount?: number;
	/** Natação: não vem (DP-116). */
	swimmingStrokeStyle?: number;
	/** Natação: não vem (DP-116). */
	tripsNumber?: number;
	/** Natação: não vem (DP-116). */
	poolSize?: number;

	/** Não vem. */
	altitudeInMeters?: number;
	/** Sempre 0. */
	elevationGainInMeters?: number;
	/** Média da frequência cardíaca em grupos de 6 leituras (regra do Core Android). */
	bpmList?: number[];

	activityOrigin: TechnosActivityOrigin;

	/** Não vem (F3-D11). */
	heartRateZones?: TechnosActivityHistoryV2ActivityHeartRateZone;
	/** Não vem. */
	aerobicTrainingEffect?: number;
	/** Estimativa pela fórmula do Core Android, com o perfil de `setUserInfo` ou os padrões dele. */
	vo2Max?: number;
	/** Fim estimado da recuperação, ISO com offset; `""` sem estimativa. */
	recoveryTimeDate?: string;
	/** Sempre `[]` (DP-127). */
	paceByKm?: TechnosActivityHistoryV2ActivityPaceByKm[];

	/** Não vem: o Core Next não tem planos de corrida. */
	sportPlan?: TechnosActivityHistoryV2SportPlan;
	/** Não vem (F3-D11). */
	exerciseGoal?: TechnosActivityGoalData;
}

/** Ponto da rota, igual ao do Core. O Core Next não manda rota (DP-127). */
export interface TechnosActivityHistoryV2ActivityLocation {
	latitude: number;
	longitude: number;
	speed: number;
	accuracy?: number;
	altitude: number;
}

/** Tempo em cada zona de frequência cardíaca, igual ao do Core. O Core Next não manda. */
export interface TechnosActivityHistoryV2ActivityHeartRateZone {
	warmUpTime: number;
	fatBurningTime: number;
	aerobicExerciseTime: number;
	anaerobicExerciseTime: number;
	extremeExerciseTime: number;
}

/** Ritmo por quilômetro, igual ao do Core. O Core Next manda sempre a lista vazia. */
export interface TechnosActivityHistoryV2ActivityPaceByKm {
	secondsDuration: number;
	minutesPace: number;
	secondsPace: number;
	distanceInKm: number;
	averageBpm: number;
}

/** Resumo do plano de corrida da atividade, igual ao do Core. O Core Next não manda. */
export interface TechnosActivityHistoryV2SportPlan {
	planType: number;
	activityBpmControl: number;
	sportPlanActionsResume: TechnosActivityHistoryV2SportPlanActionsResume[];
}

/** Um passo do resumo do plano de corrida, igual ao do Core. */
export interface TechnosActivityHistoryV2SportPlanActionsResume {
	actionBpmControl: number;
	time: number;
	type: ActionType;
	spentTime: number;
}

/** Meta da atividade e se foi atingida, igual à do Core. O Core Next não manda. */
export interface TechnosActivityGoalData {
	hasHitGoal: boolean;
	goalType: TechnosExerciseGoalTypes;
	goalValue: number;
}

/** `onActivityError`, igual ao do Core. Valores emitidos em {@link TechnosActivityErrorCode}. */
export interface TechnosActivityError {
	errorCode: TechnosActivityErrorCode;
}

/** `onActivityRealTimeSpeed`, igual ao do Core. Declarado, mas o Core Next nunca emite (sem GPS, DP-127). */
export interface TechnosActivityRealTimeSpeed {
	speedKmH: number;
}

/**
 * Entrada de `startActivityByTypeV2`, igual à do Core (`type/watchSettings.ts:200-210`). Só `type` (obrigatório,
 * inteiro), `locationEnabled` e `hasSpeedometer` são lidos; o resto (metas e FC máxima) é ignorado (F3-D15).
 */
export interface TechnosActivityByTypeStartV2 {
	/** Código Technos do esporte (`TechnosCore.activityTypes`). */
	type: number;
	locationEnabled: boolean;
	hasSpeedometer?: boolean;
	hrMaxEnabled?: boolean;
	hrMaxValue?: number;
	distanceInMetersGoal?: number;
	caloriesGoal?: number;
	durationInSecondsGoal?: number;
	exerciseGoal?: TechnosUserExerciseGoal;
}

/**
 * Entrada de `stopActivityV2`, igual à do Core (`type/watchSettings.ts:196-198`). `forceStop: true` encerra a
 * atividade só no telefone, sem evento e sem registro (F3-D18).
 */
export interface TechnosActivityByTypeStop {
	forceStop?: boolean;
}

/** Unidade de uma meta de exercício, igual à do Core (`type/exerciseGoals.ts:10-15`). */
export type TechnosExerciseGoalUnit = "kcal" | "seconds" | "ppm" | "meters" | "minPerKm";

/** Tipo de alerta de uma meta de exercício, igual ao do Core. */
export type TechnosAlertType = "time" | "distance";

/** Alerta de uma meta de exercício, igual ao do Core. */
export interface TechnosExerciseGoalAlertItem {
	alertType: TechnosAlertType;
	soundActive: boolean;
	vibrationActive: boolean;
	triggerValue: number;
}

/** Meta de exercício do usuário (`exerciseGoal` de `startActivityByTypeV2`), igual à do Core. Ignorada. */
export interface TechnosUserExerciseGoal {
	id: string;
	goalType: TechnosExerciseGoalTypes;
	goalValue: number;
	unit: TechnosExerciseGoalUnit;
	formattedValue: string;
	alerts: TechnosExerciseGoalAlertItem[];
}

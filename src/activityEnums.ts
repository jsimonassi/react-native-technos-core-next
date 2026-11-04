/**
 * Enums de valor das atividades, cópias dos enums do Core atual (`TechnosWareCore` `v4.3.57`), com os mesmos membros,
 * números e textos.
 *
 * São `enum` de TypeScript (valor e tipo ao mesmo tempo), e não só tipos, porque o app Condor os usa em tempo de
 * execução: o `mapCoreActivityStatusToApp` faz `switch` em {@link TechnosActivityV2Status}
 * (`mappers/entities/activity.ts:279-293`), o `constants/Exercises/index.ts` lê {@link PlanType} no nível do módulo e
 * o cartão do plano de treino compara {@link ActionType}. Este arquivo não importa o módulo nativo: o mock oficial e os
 * tipos de `types/activity.ts` usam os mesmos enums. Não use `const enum`: o Babel do React Native não o compila.
 */

/**
 * Estado de uma atividade (`status` de `TechnosActivityHistoryV2Activity`), igual ao do Core
 * (`type/eventData/activity.ts:8-15`).
 *
 * Na atividade iniciada pelo app o Core Next emite `STARTED` (`onActivityStartedV2` e as atualizações), `PAUSED` e
 * `RESUME` (`onActivityStatusV2` e as atualizações depois da retomada) e `STOPPED` (`onActivityCompletedV2` e os
 * treinos de `onHistoryActivityV2`). `START_REQUESTED` só existe dentro do nativo, e `WATCH_STOPPED` não sai: o fim
 * pelo relógio também fecha com `STOPPED`.
 */
export enum TechnosActivityV2Status {
	STOPPED = 0,
	START_REQUESTED = 1,
	STARTED = 2,
	RESUME = 3,
	PAUSED = 4,
	WATCH_STOPPED = 5,
}

/**
 * Origem de uma atividade (`activityOrigin`), igual à do Core (`type/eventData/activity.ts:117-120`): `"Watch"` para um
 * treino iniciado no relógio e `"Phone"` para a atividade iniciada pelo app.
 */
export enum TechnosActivityOrigin {
	WATCH = "Watch",
	PHONE = "Phone",
}

/**
 * `errorCode` de `onActivityError`, igual ao do Core (`type/eventData/activity.ts:150-157`).
 *
 * O Core Next emite só `ACTIVITY_GENERIC_ERROR` (-1: sem conexão, modelo sem atividade pelo app, argumento inválido ou
 * relógio sem resposta ao início em 10 s), `ACTIVITY_ALREADY_RUNNING` (1) e `DEVICE_WITH_LOW_BATTERY` (2). Os outros
 * existem por compatibilidade.
 */
export enum TechnosActivityErrorCode {
	ACTIVITY_GENERIC_ERROR = -1,
	SUCCESS = 0,
	ACTIVITY_ALREADY_RUNNING = 1,
	DEVICE_WITH_LOW_BATTERY = 2,
	DEVICE_IS_CHARGING = 3,
	DEVICE_USING_ALEXA = 4,
}

/**
 * Tipo do plano de corrida, igual ao do Core (`type/sportsPlan.ts:8-14`). O Core Next não tem planos de corrida; o enum
 * existe porque o app Condor o lê no import de `constants/Exercises` e no cartão do plano.
 */
export enum PlanType {
	Run3Km = 1,
	Run5Km,
	Run10Km,
	HalfMarathonTrainingPhase2,
	MarathonTrainingPhase2,
}

/**
 * Ação de um passo do plano de corrida, igual à do Core (`type/sportsPlan.ts:1-6`). É o tipo de
 * `TechnosActivityHistoryV2SportPlanActionsResume.type`, e o app Condor compara os valores no cartão do plano
 * (`SportPlanModal`, `utils/sportPlan.ts`). O Core Next nunca manda `sportPlan`.
 */
export enum ActionType {
	FastWalking = 1,
	Running,
	MediumPaceRunning,
	FastRunning,
}

/**
 * Tipo de meta de exercício, igual ao do Core (`type/exerciseGoals.ts:1-8`). É usado só pelos tipos copiados do Core
 * (`TechnosUserExerciseGoal` e `TechnosActivityGoalData`); a raiz o exporta só como tipo, como o Core, cuja raiz não o
 * exporta. O Core Next ignora as metas do início e nunca manda `exerciseGoal`.
 */
export enum TechnosExerciseGoalTypes {
	Calories = "calories",
	Time = "time",
	Cadence = "cadence",
	Distance = "distance",
	Pace = "pace",
	None = "none",
}

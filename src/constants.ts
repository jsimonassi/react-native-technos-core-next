import type { TechnosEventName } from "./types/emitter";

/**
 * Constantes públicas da biblioteca.
 *
 * Este arquivo não importa o módulo nativo: o mock oficial (`src/__mocks__`) e os testes usam os mesmos valores
 * sem precisar do TurboModule.
 */

/**
 * Códigos de `onConnectStateChanged.state`, com os mesmos nomes e valores do Core atual
 * (`TechnosWareCore/src/NativeModules/index.ts:22-30`), para o mapeamento de estado do app Mormaii
 * (`usePairingData`) continuar igual.
 *
 * O módulo novo emite `disconnect`, `connecting`, `connected` e `disconnectedBluetoothOff` e, com uma atividade
 * iniciada pelo app em andamento e o relógio fora de alcance, `disconnectOnActivity` (fase 3; volta a `connected` na
 * reconexão). `inDFU` e `unknown` existem por compatibilidade (a PoC não tem DFU). Por enquanto (fase 3 em andamento)
 * o `disconnectOnActivity` não sai: a atividade iniciada pelo app ainda não está ligada.
 */
export const deviceConnectStates = {
	inDFU: -2,
	unknown: -1,
	disconnect: 0,
	connecting: 1,
	connected: 2,
	disconnectOnActivity: 3,
	disconnectedBluetoothOff: 4,
} as const;

/** Um dos valores de {@link deviceConnectStates}. */
export type DeviceConnectState = (typeof deviceConnectStates)[keyof typeof deviceConnectStates];

/**
 * Categorias aceitas por `TechnosCore.deletedSavedData`, iguais às do Core atual
 * (`TechnosWareCore/src/NativeModules/index.ts:33-43`), inclusive o nome `HEART_HERT`.
 *
 * Têm efeito `PEDOMETER` e `SLEEP` (por dia), `HEART_HERT` e `STRESS` (pela hora local de `registered_at`) e
 * `ACTIVITY` (pelo treino cujo início casa com `registered_at`, com 1 s de tolerância). As outras categorias, `SPO2`
 * inclusive, são aceitas e ignoradas pelo nativo. Por enquanto (fase 3 em andamento) só `PEDOMETER` e `SLEEP` têm
 * efeito: `HEART_HERT`, `STRESS` e `ACTIVITY` ainda são ignoradas, com um WARN no log (`Ignoring category N`).
 */
export const deletedCategory = {
	SLEEP: 0,
	ACTIVITY: 1,
	STRESS: 2,
	SPO2: 3,
	HEART_HERT: 4,
	PEDOMETER: 5,
	ACTIVITY_MONITOR: 6,
	CALORIE: 7,
	BODY_ENERGY: 8,
} as const;

/** Um dos valores de {@link deletedCategory}. */
export type DeletedCategory = (typeof deletedCategory)[keyof typeof deletedCategory];

/**
 * Códigos de erro de `onError.code` e do `code` das Promises rejeitadas.
 *
 * Os quinze primeiros vêm do módulo de protocolo (`WatchErrorCodes.kt` do `technos-watch-protocol`); os cinco
 * últimos nascem no nativo (`HostErrorCodes.kt` do `:bridge` do mesmo repositório): antes de a sessão ser chamada ou,
 * no caso de `CLASSIC_BOND_FAILED`, num pedido ao sistema que não é da sessão. Mudou uma das duas listas nativas, mude
 * aqui e em `docs/api-js.md`.
 */
export const errorCodes = {
	/** O comando exige conexão pronta e o relógio não está conectado. */
	NOT_READY: "NOT_READY",
	/** O relógio não corresponde a nenhum perfil conhecido. */
	UNSUPPORTED_DEVICE: "UNSUPPORTED_DEVICE",
	/** O relógio não apareceu dentro do tempo de conexão do primeiro pareamento (30 s no fitGPS). */
	CONNECT_TIMEOUT: "CONNECT_TIMEOUT",
	/** O relógio conectou, mas não expõe nenhum serviço GATT que o perfil conhece. */
	GATT_NOT_SUPPORTED: "GATT_NOT_SUPPORTED",
	/** BIND ou LOGIN recusados ou sem resposta. */
	HANDSHAKE_FAILED: "HANDSHAKE_FAILED",
	/** O relógio não confirmou ou não respondeu um comando a tempo. */
	TIMEOUT: "TIMEOUT",
	/** Frame com CRC ou estrutura inválidos. */
	PROTOCOL: "PROTOCOL",
	/** Não há registros (ex.: sono no fitGPS). */
	NO_DATA: "NO_DATA",
	/** Uma operação GATT falhou no Android. */
	TRANSPORT: "TRANSPORT",
	/** O link caiu com o comando em andamento. */
	DISCONNECTED: "DISCONNECTED",
	/**
	 * O telefone guarda um vínculo Bluetooth que o relógio já apagou (o relógio foi pareado com outro telefone depois),
	 * e o sistema recusa a conexão até o usuário esquecer o relógio nas configurações de Bluetooth do telefone (no
	 * iPhone, Ajustes > Bluetooth > "Esquecer este dispositivo"); o app não consegue fazer isso. Sai em `pairDevice` e
	 * `startPairingAttempt`, e com `method` `null` quando a reconexão automática para por isso: `requestId` -1 se a
	 * sessão reconectava depois de uma queda, e um id interno se o nativo pediu a reconexão (`initialize`, volta ao
	 * primeiro plano, Bluetooth religado). O nativo não repete a tentativa; tenta uma vez a cada um desses gatilhos.
	 * Hoje só o iOS detecta (`CBError.peerRemovedPairingInformation`; ADR 23 do `technos-watch-protocol`).
	 */
	PAIRING_REMOVED: "PAIRING_REMOVED",
	/**
	 * O comando foi cancelado por desconexão, `forgetDevice`, reload do JS ou por um `pairDevice`/`startPairingAttempt`
	 * mais novo. Na fase 3, também o `startActivityByTypeV2` cujo prazo de 10 s venceu com o pedido ainda na fila (por
	 * enquanto não acontece: a atividade iniciada pelo app ainda não está ligada).
	 */
	CANCELLED: "CANCELLED",
	/** Reservado: a sessão não emite (um pareamento novo cancela o anterior com `CANCELLED`, ADR 13 do Repo 1). */
	BUSY: "BUSY",
	/**
	 * O modelo conectado não tem o ajuste ou a ação pedida (na fase 2, todo ajuste, mensagem e interação no fitGPS e no
	 * Life Ultra GPS, e o `resetDevice` neles; na fase 3, a atividade iniciada pelo app neles e o
	 * `checkIosBackgroundLocationPermission` no Android). Sai antes de qualquer escrita no relógio; desconectado, vale o
	 * `NOT_READY`. No Core atual o equivalente é a rejeição `"-1"`/`"Not implemented"`.
	 */
	NOT_SUPPORTED: "NOT_SUPPORTED",
	/**
	 * Bateria do relógio baixa demais para iniciar a atividade (no Condor Reebok, abaixo de 11%, lida antes de qualquer
	 * escrita; DP-119). O relógio não recebe nada, e o `startActivityByTypeV2` também emite `onActivityError` com
	 * `errorCode` 2 (`TechnosActivityErrorCode.DEVICE_WITH_LOW_BATTERY`). Fase 3; por enquanto não sai, porque a
	 * atividade iniciada pelo app ainda não está ligada.
	 */
	LOW_BATTERY: "LOW_BATTERY",
	/** Permissão de Bluetooth não concedida (`BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`, ou localização abaixo do Android 12). */
	PERMISSION_DENIED: "PERMISSION_DENIED",
	/** O Bluetooth do telefone está desligado. */
	BLUETOOTH_OFF: "BLUETOOTH_OFF",
	/** Argumento inválido (ex.: `deviceId` que não é um MAC). */
	INVALID_ARGUMENT: "INVALID_ARGUMENT",
	/** Falha de arquivo (histórico local ou exportação do log). */
	IO_ERROR: "IO_ERROR",
	/**
	 * O vínculo Bluetooth clássico que o Condor Reebok usa para chamadas e música não foi criado: o usuário recusou o
	 * diálogo do sistema ou as duas tentativas do Android acabaram. Sai só em `onError`, com `requestId` -1 e `method`
	 * `"classicBond"` (o pedido nasce quando a conexão fica pronta, não num método JS; nenhuma Promise rejeita). A conexão
	 * BLE continua pronta. O nativo não pede de novo até o próximo `pairDevice`. No iPhone nunca sai: o app não cria esse
	 * vínculo (o usuário pareia em Ajustes > Bluetooth).
	 */
	CLASSIC_BOND_FAILED: "CLASSIC_BOND_FAILED",
} as const;

/** Um dos valores de {@link errorCodes}. */
export type ErrorCode = (typeof errorCodes)[keyof typeof errorCodes];

/**
 * Níveis aceitos por `TechnosCore.setLogLevel`, na ordem do `LogLevel` do módulo de protocolo.
 * Entradas abaixo do nível escolhido deixam de ir para o `onLog` e para o arquivo exportado.
 */
export const logLevels = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
} as const;

/** Um dos valores numéricos de {@link logLevels}. */
export type LogLevelValue = (typeof logLevels)[keyof typeof logLevels];

/** Nome de um nível de log, como aparece em `LogEvent.level`. */
export type LogLevelName = keyof typeof logLevels;

/**
 * Nomes de todos os eventos do módulo, na ordem do spec. Útil para inscrever em tudo (app de exemplo, mock).
 */
export const technosEventNames: readonly TechnosEventName[] = [
	"onScannedDevice",
	"onConnectStateChanged",
	"onDeviceInfo",
	"onFirmwareInfo",
	"onBatteryStatus",
	"onPedometer",
	"onHistoryPedometer",
	"onHistorySleep",
	"onSyncStarted",
	"onSyncProgress",
	"onSyncFinished",
	"onFindPhone",
	"onTakeAPicture",
	"onOpenCameraMode",
	"onDeviceRequestedCameraMode",
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
	"onError",
	"onLog",
];

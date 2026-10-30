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
 * O módulo novo só emite `disconnect`, `connecting`, `connected` e `disconnectedBluetoothOff`;
 * `inDFU`, `unknown` e `disconnectOnActivity` existem por compatibilidade (a PoC não tem DFU nem atividade).
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
 * Na PoC só `PEDOMETER` e `SLEEP` têm efeito; as outras categorias são aceitas e ignoradas pelo nativo.
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
 * Os treze primeiros vêm do módulo de protocolo (`WatchErrorCodes.kt` do `technos-watch-protocol`); os quatro
 * últimos nascem no nativo antes de a sessão ser chamada (`HostErrorCodes.kt` do `:bridge` do mesmo repositório).
 * Mudou uma das duas listas nativas, mude aqui e em `docs/api-js.md`.
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
	 * `startPairingAttempt`, e com `requestId` -1 e `method` `null` quando a reconexão automática para por isso. O
	 * nativo não tenta de novo sozinho. Hoje só o iOS detecta (`CBError.peerRemovedPairingInformation`; ADR 23 do
	 * `technos-watch-protocol`).
	 */
	PAIRING_REMOVED: "PAIRING_REMOVED",
	/** O comando foi cancelado por desconexão, `forgetDevice`, reload do JS ou por um `pairDevice`/`startPairingAttempt` mais novo. */
	CANCELLED: "CANCELLED",
	/** Reservado: a sessão não emite (um pareamento novo cancela o anterior com `CANCELLED`, ADR 13 do Repo 1). */
	BUSY: "BUSY",
	/** Permissão de Bluetooth não concedida (`BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`, ou localização abaixo do Android 12). */
	PERMISSION_DENIED: "PERMISSION_DENIED",
	/** O Bluetooth do telefone está desligado. */
	BLUETOOTH_OFF: "BLUETOOTH_OFF",
	/** Argumento inválido (ex.: `deviceId` que não é um MAC). */
	INVALID_ARGUMENT: "INVALID_ARGUMENT",
	/** Falha de arquivo (histórico local ou exportação do log). */
	IO_ERROR: "IO_ERROR",
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
	"onError",
	"onLog",
];

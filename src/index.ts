/**
 * Ponto de entrada da biblioteca `react-native-technos-core-next`.
 *
 * Mantém os nomes do Core atual (`TechnosCore`, `TechnosEvents`, `utils`, `deviceConnectStates`,
 * `deletedCategory`) para o app Mormaii trocar de pacote mudando o import. A referência completa de cada método e
 * evento, com payloads de exemplo e diferenças em relação ao Core atual, está em `docs/api-js.md`.
 */
import { deletedCategory, deviceConnectStates, errorCodes, logLevels, type LogLevelValue } from "./constants";
import NativeCoreNext from "./specs/NativeCoreNext";
import type { TechnosEventEmitter, TechnosEventEmitters, TechnosEventMap } from "./types/emitter";
import type { LastPairedDevice, LogEvent, SavedItemDelete } from "./types/events";
import { utils } from "./utils";
import { groupSavedItemsByCategory } from "./utils/savedData";

/**
 * Comandos do módulo nativo.
 *
 * Regra geral (igual ao spec): comandos que falam com o relógio devolvem `Promise<void>` que resolve quando o
 * relógio confirma e rejeita com um dos {@link errorCodes} (leia com `utils.errors.getErrorCode`). Toda rejeição
 * também sai em `TechnosEvents.onError`. O dado lido chega pelo evento correspondente, como no Core atual.
 *
 * Diferença principal em relação ao Core atual: lá os comandos são `void` e falhas são silenciosas; aqui quase todos
 * devolvem Promise. Código que ignora o retorno continua funcionando, mas convém tratar a rejeição para não gerar
 * "Possible unhandled promise rejection".
 */
export const TechnosCore = {
	/** Mesmos códigos de `onConnectStateChanged.state` do Core atual. */
	deviceConnectStates,
	/** Mesmas categorias de `deletedSavedData` do Core atual. */
	deletedCategory,
	/** Códigos de erro das rejeições e de `onError`. Também exportado na raiz. */
	errorCodes,
	/** Níveis de `setLogLevel`. Também exportado na raiz. */
	logLevels,

	/**
	 * Cria o grafo nativo (sessão, transporte, logger) e, se houver relógio pareado salvo, pede a reconexão.
	 * Antes, emite `onConnectStateChanged` com o estado atual (o nativo sobrevive ao reload do JS): chame depois de
	 * se inscrever. Idempotente: pode ser chamado a cada abertura do app. Novo; substitui os `initXxxSDK` do Core atual.
	 */
	initialize: (): Promise<void> => NativeCoreNext.initialize(),

	/**
	 * Alias de {@link TechnosCore.initialize}, com o nome que o app Mormaii usa para o fitGPS
	 * (`Smartwatch.init` → `initSMASDK`).
	 */
	initSMASDK: (): Promise<void> => NativeCoreNext.initSMASDK(),

	/**
	 * Procura relógios por 7 s. Cada relógio de um modelo suportado vira um `onScannedDevice`, uma vez por endereço
	 * por busca (o Core atual emite a cada anúncio). Não há evento de fim de busca. Sem permissão ou com o Bluetooth
	 * desligado, não lança: emite `onError` com `method: "scan"` (`PERMISSION_DENIED` ou `BLUETOOTH_OFF`).
	 */
	scan: (): void => NativeCoreNext.scan(),

	/** Interrompe a busca antes dos 7 s. Novo. */
	stopScan: (): void => NativeCoreNext.stopScan(),

	/**
	 * Primeiro pareamento com um relógio vindo de `onScannedDevice`.
	 *
	 * Resolve quando a conexão fica pronta (`onConnectStateChanged` com `state = connected`). O BIND espera até
	 * 60 s pela confirmação na tela do relógio. Rejeita na hora com `PERMISSION_DENIED`, `BLUETOOTH_OFF`,
	 * `INVALID_ARGUMENT` ou `UNSUPPORTED_DEVICE`; depois, com `CANCELLED`, `TRANSPORT`, `CONNECT_TIMEOUT`, `GATT_NOT_SUPPORTED`,
	 * `HANDSHAKE_FAILED`, `DISCONNECTED` ou `PAIRING_REMOVED` (o usuário tem de esquecer o relógio nas configurações de
	 * Bluetooth do telefone; hoje só o iOS detecta). No Core atual é `void` e não informa falha.
	 *
	 * @param deviceId MAC do relógio (`onScannedDevice.deviceId`).
	 * @param name `onScannedDevice.name` (ex.: `"fitGPS"`).
	 */
	pairDevice: (deviceId: string, name: string): Promise<void> => NativeCoreNext.pairDevice(deviceId, name),

	/**
	 * Reconecta ao relógio já pareado (handshake curto, sem confirmação no relógio). Resolve assim que a reconexão é
	 * pedida; a conexão de fato é anunciada por `onConnectStateChanged`, e pode demorar se o relógio estiver longe.
	 * Rejeita na hora pelos mesmos motivos de {@link TechnosCore.pairDevice}; falhas posteriores só saem em `onError`
	 * com `method: "startPairingAttempt"`. No Core atual é `void` e, para SMA, equivale a `pairDevice`.
	 */
	startPairingAttempt: (deviceId: string, name: string): Promise<void> =>
		NativeCoreNext.startPairingAttempt(deviceId, name),

	/**
	 * Desconecta sem esquecer o relógio: o pareamento salvo e o histórico local continuam.
	 * Diferente do Core atual, onde `disconnectCurrentDevice` também desfaz o vínculo e apaga dados (use
	 * {@link TechnosCore.forgetDevice} para isso).
	 */
	disconnectCurrentDevice: (): Promise<void> => NativeCoreNext.disconnectCurrentDevice(),

	/**
	 * Desconecta, desfaz o vínculo no relógio (UNBIND, se conectado), esquece o pareamento salvo e apaga o histórico
	 * local. Equivale ao `disconnectCurrentDevice` do Core atual. Novo.
	 */
	forgetDevice: (): Promise<void> => NativeCoreNext.forgetDevice(),

	/** `true` quando a sessão está pronta para comandos (conectada, inclusive durante sync). */
	isConnected: (): Promise<boolean> => NativeCoreNext.isConnected(),

	/**
	 * Último relógio pareado, ou `null` se não há pareamento salvo. Use com
	 * {@link TechnosCore.startPairingAttempt} para reconectar. Novo (no app Mormaii isso vive no cache do app).
	 */
	getLastPairedDevice: async (): Promise<LastPairedDevice | null> => {
		const device = (await NativeCoreNext.getLastPairedDevice()) as LastPairedDevice | null | undefined;
		return device ?? null;
	},

	/**
	 * Lê firmware e identificação do relógio (comando VERSION). Emite `onDeviceInfo` e resolve em seguida.
	 * No Core atual não existe para SMA (o Android manda um comando de alarme).
	 */
	getDeviceInfo: (): Promise<void> => NativeCoreNext.getDeviceInfo(),

	/** Lê a versão do firmware (mesma leitura de `getDeviceInfo`). Emite `onFirmwareInfo`, no formato do Core atual. */
	getFirmwareInfo: (): Promise<void> => NativeCoreNext.getFirmwareInfo(),

	/** Lê a bateria. Emite `onBatteryStatus`, no formato do Core atual, e resolve em seguida. */
	getBatteryStatus: (): Promise<void> => NativeCoreNext.getBatteryStatus(),

	/**
	 * Acerta o relógio com a hora local do telefone. O nativo também faz isso sozinho logo depois de cada conexão.
	 * Novo (no Core atual só acontece no login).
	 */
	setTime: (): Promise<void> => NativeCoreNext.setTime(),

	/** Lê os passos recentes do relógio e emite `onPedometer` com o total de hoje. Novo. */
	refreshSteps: (): Promise<void> => NativeCoreNext.refreshSteps(),

	/**
	 * Lê o histórico do relógio (passos e sono) e grava localmente. Emite `onSyncStarted`, `onSyncProgress` e
	 * `onSyncFinished`; resolve depois de `onSyncFinished` e rejeita com o erro que interrompeu o sync (também em
	 * `onError`). No Core atual o sync do SMA é simulado (só emite os eventos com atraso).
	 */
	syncDataHistory: (): Promise<void> => NativeCoreNext.syncDataHistory(),

	/**
	 * Emite `onHistoryPedometer` com os totais por dia gravados localmente, sem os dias já confirmados por
	 * {@link TechnosCore.deletedSavedData}, e resolve. Sem dados emite a lista vazia. Não fala com o relógio:
	 * chame `syncDataHistory` antes.
	 *
	 * @param daysBefore quantos dias antes de hoje incluir (hoje sempre entra). O Core atual ignora este valor no
	 * Android.
	 */
	getHistoryPedometer: (daysBefore: number): Promise<void> => NativeCoreNext.getHistoryPedometer(daysBefore),

	/**
	 * Emite `onHistorySleep` com as noites gravadas localmente, ou rejeita com `NO_DATA` (e emite `onError`) quando
	 * não há sono. Exploratório no fitGPS: o Core atual nunca emitiu sono para SMA.
	 */
	getHistorySleep: (): Promise<void> => NativeCoreNext.getHistorySleep(),

	/**
	 * Marca registros como já enviados ao backend; os dias deles deixam de sair em `getHistoryPedometer` e
	 * `getHistorySleep`. Mesmo formato de entrada do Core atual.
	 *
	 * Os itens são agrupados por categoria e cada grupo vai numa chamada nativa. O Core atual usa a categoria do
	 * primeiro item para a lista inteira. Lista vazia não chama o nativo.
	 *
	 * @param items registros a confirmar; de `registered_at` só o dia local é usado.
	 */
	deletedSavedData: (items: readonly SavedItemDelete[]): void => {
		for (const group of groupSavedItemsByCategory(items)) {
			NativeCoreNext.deletedSavedData(group.items, group.category);
		}
	},

	/**
	 * Últimas entradas do log nativo, da mais nova para a mais antiga (o nativo guarda até 2000). Novo.
	 *
	 * @param limit quantidade máxima de entradas.
	 */
	getLogs: async (limit: number): Promise<LogEvent[]> => (await NativeCoreNext.getLogs(limit)) as LogEvent[],

	/**
	 * Grava o log e a gravação dos frames em arquivos `.jsonl` e devolve o caminho absoluto da gravação de frames
	 * (formato de fixture); o log fica ao lado, com o mesmo carimbo. Rejeita com `IO_ERROR`. Novo; substitui o
	 * `shareLogs` do Core atual.
	 */
	exportLogs: (): Promise<string> => NativeCoreNext.exportLogs(),

	/** Esvazia o log em memória do nativo. Novo. */
	clearLogs: (): void => NativeCoreNext.clearLogs(),

	/**
	 * Nível mínimo do log nativo. Novo.
	 *
	 * @param level um dos {@link logLevels}.
	 */
	setLogLevel: (level: LogLevelValue): void => NativeCoreNext.setLogLevel(level),
};

const typed = <K extends keyof TechnosEventMap>(name: K): TechnosEventEmitter<TechnosEventMap[K]> =>
	NativeCoreNext[name] as unknown as TechnosEventEmitter<TechnosEventMap[K]>;

/**
 * Emissores de eventos do módulo nativo, tipados com os formatos de `src/types/events.ts`.
 *
 * Uso: `const sub = TechnosEvents.onBatteryStatus(e => ...); sub.remove();`. Mesmos nomes do Core atual;
 * `onDeviceInfo`, `onError` e `onLog` são novos.
 */
export const TechnosEvents: TechnosEventEmitters = {
	/** Um relógio suportado apareceu na busca. */
	onScannedDevice: typed("onScannedDevice"),
	/** O estado da conexão mudou. */
	onConnectStateChanged: typed("onConnectStateChanged"),
	/** Resposta de `getDeviceInfo`. */
	onDeviceInfo: typed("onDeviceInfo"),
	/** Resposta de `getFirmwareInfo`. */
	onFirmwareInfo: typed("onFirmwareInfo"),
	/** Resposta de `getBatteryStatus`. */
	onBatteryStatus: typed("onBatteryStatus"),
	/** Total de passos de hoje, depois de `refreshSteps` ou quando o relógio avisa que os dados mudaram. */
	onPedometer: typed("onPedometer"),
	/** Resposta de `getHistoryPedometer`. */
	onHistoryPedometer: typed("onHistoryPedometer"),
	/** Resposta de `getHistorySleep`. */
	onHistorySleep: typed("onHistorySleep"),
	/** Início de `syncDataHistory`. */
	onSyncStarted: typed("onSyncStarted"),
	/** Progresso de `syncDataHistory`, de 0 a 100. */
	onSyncProgress: typed("onSyncProgress"),
	/** Fim com sucesso de `syncDataHistory`. */
	onSyncFinished: typed("onSyncFinished"),
	/** Falha de um comando (toda rejeição) ou do link. */
	onError: typed("onError"),
	/** Cada entrada do log nativo, inclusive os pacotes GATT em hex. */
	onLog: typed("onLog"),
};

export { deletedCategory, deviceConnectStates, errorCodes, logLevels, technosEventNames } from "./constants";
export type { DeletedCategory, DeviceConnectState, ErrorCode, LogLevelName, LogLevelValue } from "./constants";
export { utils };
export type { TechnosCoreError } from "./utils/errors";
export type { SavedItemsGroup } from "./utils/savedData";
export type * from "./types";

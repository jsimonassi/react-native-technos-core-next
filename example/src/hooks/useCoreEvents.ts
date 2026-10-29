import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
	TechnosCore,
	TechnosEvents,
	technosEventNames,
	type LogEvent,
	type TechnosEventEmitter,
	type TechnosEventMap,
	type TechnosEventName,
	type TechnosEventSubscription,
} from "react-native-technos-core-next";
import { LOG_RING_SIZE, mergeSnapshot, prependNewest, type LogRow } from "../helpers/logBuffer";
import { coreReducer, initialCoreState, type CoreEventAction, type CoreState } from "./coreState";

/** Opções de {@link useCoreEvents}. */
export interface UseCoreEventsOptions {
	/** Tamanho do ring de log no JS. Padrão: 2000, igual ao nativo. */
	logCapacity?: number;
	/**
	 * Intervalo para agrupar entradas de `onLog` antes de renderizar. Durante o sync o relógio gera dezenas de
	 * pacotes por segundo; agrupar evita um render por pacote. `0` desliga o agrupamento (usado nos testes).
	 */
	logFlushMs?: number;
	/** Carrega as entradas que o nativo já tinha (`getLogs`) ao montar. Padrão: `true`. */
	loadInitialLogs?: boolean;
}

/** O que {@link useCoreEvents} devolve. */
export interface CoreEvents {
	state: CoreState;
	/** Log, da entrada mais nova para a mais antiga. */
	logs: LogRow[];
	clearDevices: () => void;
	clearError: () => void;
	/** Esvazia o log no JS e no nativo. */
	clearLogs: () => void;
	/** Troca o log do JS pelo retrato atual do nativo. */
	reloadLogs: () => Promise<void>;
}

const subscribe = <K extends TechnosEventName>(
	name: K,
	handler: (payload: TechnosEventMap[K]) => void,
): TechnosEventSubscription => (TechnosEvents[name] as TechnosEventEmitter<TechnosEventMap[K]>)(handler);

/**
 * Inscreve em todos os eventos do módulo e guarda o último valor de cada um, mais o log em um ring.
 *
 * Deve ser usado uma vez, no topo do app: as abas recebem fatias do estado por props.
 */
export const useCoreEvents = (options: UseCoreEventsOptions = {}): CoreEvents => {
	const { logCapacity = LOG_RING_SIZE, logFlushMs = 150, loadInitialLogs = true } = options;
	const [state, dispatch] = useReducer(coreReducer, initialCoreState);
	const [logs, setLogs] = useState<LogRow[]>([]);
	const pending = useRef<LogEvent[]>([]);
	const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const nextId = useRef(1);

	const toRows = useCallback(
		(entries: readonly LogEvent[]): LogRow[] => entries.map(entry => ({ ...entry, id: nextId.current++ })),
		[],
	);

	const flush = useCallback(() => {
		flushTimer.current = null;
		const batch = pending.current;
		pending.current = [];
		if (batch.length === 0) {
			return;
		}
		const rows = toRows(batch);
		setLogs(current => prependNewest(current, rows, logCapacity));
	}, [logCapacity, toRows]);

	useEffect(() => {
		const subscriptions: TechnosEventSubscription[] = technosEventNames
			.filter(name => name !== "onLog")
			.map(name =>
				subscribe(name, payload => {
					dispatch({ type: "event", name, payload, at: Date.now() } as CoreEventAction);
				}),
			);

		subscriptions.push(
			subscribe("onLog", entry => {
				pending.current.push(entry);
				if (logFlushMs <= 0) {
					flush();
				} else if (flushTimer.current === null) {
					flushTimer.current = setTimeout(flush, logFlushMs);
				}
			}),
		);

		return () => {
			subscriptions.forEach(subscription => subscription.remove());
			if (flushTimer.current !== null) {
				clearTimeout(flushTimer.current);
				flushTimer.current = null;
			}
		};
	}, [flush, logFlushMs]);

	useEffect(() => {
		if (!loadInitialLogs) {
			return;
		}
		let cancelled = false;
		TechnosCore.getLogs(logCapacity)
			.then(snapshot => {
				if (!cancelled) {
					const rows = toRows(snapshot);
					setLogs(current => mergeSnapshot(current, rows, logCapacity));
				}
			})
			.catch(() => {
				// Sem retrato inicial a aba Log só começa vazia; as entradas seguintes continuam chegando por onLog.
			});
		return () => {
			cancelled = true;
		};
	}, [loadInitialLogs, logCapacity, toRows]);

	const clearDevices = useCallback(() => dispatch({ type: "clearDevices" }), []);
	const clearError = useCallback(() => dispatch({ type: "clearError" }), []);

	const clearLogs = useCallback(() => {
		pending.current = [];
		setLogs([]);
		TechnosCore.clearLogs();
	}, []);

	const reloadLogs = useCallback(async () => {
		const snapshot = await TechnosCore.getLogs(logCapacity);
		pending.current = [];
		setLogs(toRows(snapshot).slice(0, logCapacity));
	}, [logCapacity, toRows]);

	return useMemo(
		() => ({ state, logs, clearDevices, clearError, clearLogs, reloadLogs }),
		[state, logs, clearDevices, clearError, clearLogs, reloadLogs],
	);
};

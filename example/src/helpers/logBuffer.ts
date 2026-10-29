import { logLevels, type LogEvent, type LogLevelName } from "react-native-technos-core-next";

/** Tamanho do ring de log no JS, igual ao do `RingLogger` nativo. */
export const LOG_RING_SIZE = 2000;

/** Uma entrada do log com um id estável para a `FlatList`. */
export interface LogRow extends LogEvent {
	id: number;
}

/** Filtros da aba Log. */
export interface LogFilter {
	/** Texto procurado em tag, mensagem e hex, sem diferenciar maiúsculas. */
	text: string;
	/** Nível mínimo exibido. */
	minLevel: LogLevelName;
	/** Mostra só os pacotes GATT (TX/RX). */
	framesOnly: boolean;
}

/**
 * Acrescenta entradas novas ao ring, que fica da mais nova para a mais antiga (formato da `FlatList` invertida e de
 * `getLogs`), cortando no limite.
 *
 * @param current ring atual, mais nova primeiro.
 * @param incoming entradas novas em ordem de chegada (mais antiga primeiro).
 */
export const prependNewest = (current: readonly LogRow[], incoming: readonly LogRow[], capacity: number): LogRow[] => {
	const newestFirst = incoming.slice().reverse();
	return newestFirst.concat(current).slice(0, capacity);
};

/**
 * Junta o retrato do nativo (`getLogs`) com o que chegou por `onLog` enquanto o retrato era lido: o que é mais novo
 * que o retrato fica na frente, o resto vem do retrato.
 */
export const mergeSnapshot = (current: readonly LogRow[], snapshot: readonly LogRow[], capacity: number): LogRow[] => {
	const newestInSnapshot = snapshot.length > 0 ? snapshot[0].ts : Number.NEGATIVE_INFINITY;
	const newer = current.filter(row => row.ts > newestInSnapshot);
	return newer.concat(snapshot).slice(0, capacity);
};

/** Aplica os filtros da aba Log. */
export const filterLogs = (rows: readonly LogRow[], filter: LogFilter): LogRow[] => {
	const min = logLevels[filter.minLevel];
	const needle = filter.text.trim().toLowerCase();
	return rows.filter(row => {
		if ((logLevels[row.level] ?? 0) < min) {
			return false;
		}
		if (filter.framesOnly && row.dir === null) {
			return false;
		}
		if (needle.length === 0) {
			return true;
		}
		return (
			row.tag.toLowerCase().includes(needle) ||
			row.message.toLowerCase().includes(needle) ||
			(row.hex ?? "").toLowerCase().includes(needle)
		);
	});
};

/**
 * Converte entradas (mais nova primeiro) em texto `.jsonl` em ordem cronológica, uma entrada por linha, sem o `id`
 * local.
 */
export const toJsonl = (rows: readonly LogRow[]): string =>
	rows
		.slice()
		.reverse()
		.map(row =>
			JSON.stringify({
				ts: row.ts,
				level: row.level,
				tag: row.tag,
				message: row.message,
				dir: row.dir,
				hex: row.hex,
			}),
		)
		.join("\n");

/** Hex contínuo em pares separados por espaço (`"AB0000"` → `"AB 00 00"`), para leitura. */
export const spacedHex = (hex: string): string => hex.replace(/(..)(?=.)/g, "$1 ");

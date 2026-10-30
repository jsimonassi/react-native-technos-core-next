import { deviceConnectStates, errorCodes, utils } from "react-native-technos-core-next";

/** Rótulo em português de `onConnectStateChanged.state`. */
export const connectStateLabel = (state: number | null | undefined): string => {
	switch (state) {
		case deviceConnectStates.inDFU:
			return "Modo DFU";
		case deviceConnectStates.unknown:
			return "Desconhecido";
		case deviceConnectStates.disconnect:
			return "Desconectado";
		case deviceConnectStates.connecting:
			return "Conectando";
		case deviceConnectStates.connected:
			return "Conectado";
		case deviceConnectStates.disconnectOnActivity:
			return "Desconectado (atividade)";
		case deviceConnectStates.disconnectedBluetoothOff:
			return "Bluetooth desligado";
		case null:
		case undefined:
			return "Sem estado";
		default:
			return `Estado ${state}`;
	}
};

/** Tom de cor do estado, para o badge. */
export type StateTone = "success" | "warning" | "danger" | "muted";

/** Tom do badge para cada código de estado. */
export const connectStateTone = (state: number | null | undefined): StateTone => {
	switch (state) {
		case deviceConnectStates.connected:
			return "success";
		case deviceConnectStates.connecting:
			return "warning";
		case deviceConnectStates.disconnectedBluetoothOff:
		case deviceConnectStates.inDFU:
			return "danger";
		default:
			return "muted";
	}
};

/** Rótulo de `SleepItem.typeItem` (1 acordado, 2 leve, 3 profundo, 4 REM). */
export const sleepTypeLabel = (typeItem: number): string => {
	switch (typeItem) {
		case 1:
			return "Acordado";
		case 2:
			return "Leve";
		case 3:
			return "Profundo";
		case 4:
			return "REM";
		default:
			return `Tipo ${typeItem}`;
	}
};

const pad = (value: number, size = 2): string => String(value).padStart(size, "0");

/** `HH:MM:SS` no fuso do telefone. */
export const formatClock = (date: Date): string =>
	`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** `HH:MM:SS.mmm` de um epoch em milissegundos, para o log. */
export const formatLogTime = (ts: number): string => {
	const date = new Date(ts);
	return `${formatClock(date)}.${pad(date.getMilliseconds(), 3)}`;
};

/** `HH:MM` de uma data ISO, ou a própria string se não for uma data. */
export const formatIsoTime = (iso: string): string => {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? iso : `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const weekdays = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/**
 * `ter 28/10` de uma data ISO. Usa o dia escrito na própria string (`yyyy-MM-dd`), não o fuso do telefone, porque
 * o nativo já manda o início do dia local.
 */
export const formatIsoDay = (iso: string): string => {
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
	if (!match) {
		return iso;
	}
	const [, year, month, day] = match;
	const weekday = weekdays[new Date(Number(year), Number(month) - 1, Number(day)).getDay()];
	return `${weekday} ${day}/${month}`;
};

/** `yyyy-MM-dd` de hoje no fuso do telefone. */
export const todayKey = (now: Date = new Date()): string =>
	`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

/** JSON indentado com tabs, para os blocos de payload cru. */
export const prettyJson = (value: unknown): string => JSON.stringify(value, null, "\t");

/**
 * O que a pessoa tem de fazer para um código de erro que o app não resolve sozinho, ou `null`. Hoje só
 * `PAIRING_REMOVED`: o iPhone guarda um vínculo Bluetooth que o relógio apagou, e só os Ajustes o removem.
 */
export const errorHint = (code: string | null | undefined): string | null =>
	code === errorCodes.PAIRING_REMOVED
		? "Esqueça o relógio em Ajustes > Bluetooth do iPhone e tente parear de novo."
		: null;

/** Mensagem curta de um erro: `CODE: mensagem` quando veio do nativo, com a dica de {@link errorHint} na frente. */
export const describeError = (error: unknown): string => {
	const code = utils.errors.getErrorCode(error);
	const message = error instanceof Error ? error.message : String(error);
	const hint = errorHint(code);
	const described = code ? `${code}: ${message}` : message;
	return hint ? `${hint}\n${described}` : described;
};

/** Metros em quilômetros com duas casas (`1234` → `"1,23 km"`). */
export const formatKm = (meters: number): string => `${(meters / 1000).toFixed(2).replace(".", ",")} km`;

/** Número com separador de milhar brasileiro (`12345` → `"12.345"`). */
export const formatInt = (value: number): string => String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

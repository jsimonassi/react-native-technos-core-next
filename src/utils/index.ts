import * as errors from "./errors";
import * as events from "./events";
import * as savedData from "./savedData";

/**
 * Utilitários sem estado, no mesmo formato do `utils` do Core atual (`utils.events.getNativeEventData`).
 * Não dependem do módulo nativo e funcionam com o mock oficial.
 */
export const utils = {
	/** Transformar eventos em Promises (`getNativeEventData`, `requestNativeEventData`). */
	events,
	/** Ler o código de erro de Promises rejeitadas pelo nativo. */
	errors,
	/** Preparar a lista de `deletedSavedData`. */
	savedData,
};

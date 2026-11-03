import * as errors from "./errors";
import * as events from "./events";
import * as promise from "./promise";
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
	/** `observed`, que os métodos da fase 2 usam para não gerar "unhandled promise rejection" sem `await`. Novo. */
	promise,
};

import { errorCodes, type ErrorCode } from "../constants";

/**
 * Erro de uma Promise rejeitada pelo módulo nativo.
 *
 * No Android o TurboModule rejeita com `promise.reject(code, message)`, e o React Native entrega um `Error`
 * com a propriedade `code`. Use {@link getErrorCode} para ler o código sem depender da forma exata.
 */
export interface TechnosCoreError extends Error {
	/** Um dos {@link errorCodes}. */
	code: ErrorCode;
}

const knownCodes = new Set<string>(Object.values(errorCodes));

/**
 * Devolve o código de erro do módulo (`"TIMEOUT"`, `"NOT_READY"`...) de um erro qualquer, ou `null` se o erro
 * não veio do nativo (ex.: o timeout de `getNativeEventData`, que é um `Error` sem `code`).
 */
export const getErrorCode = (error: unknown): ErrorCode | null => {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return null;
	}
	const code = (error as { code: unknown }).code;
	return typeof code === "string" && knownCodes.has(code) ? (code as ErrorCode) : null;
};

/** `true` quando o erro veio do módulo nativo com um dos {@link errorCodes}. */
export const isTechnosCoreError = (error: unknown): error is TechnosCoreError => getErrorCode(error) !== null;

import type { TechnosEventEmitter, TechnosEventSubscription } from "../types/emitter";

/**
 * Espera o próximo disparo de um evento e devolve o payload numa Promise.
 *
 * Mesma semântica do `getNativeEventData` do Core atual (`TechnosWareCore/src/utils/events.ts:3-20`), que o app
 * Mormaii usa depois de cada comando (ex.: `getHistoryPedometer(3)` e depois `onHistoryPedometer`, com 20 s):
 * - resolve com o primeiro evento que chegar depois da chamada e remove a inscrição;
 * - com `timeoutMs` (maior que zero), rejeita com `Error("Timeout Error: getDataFromWatch - <nome>")` se nada chegar
 *   a tempo, também removendo a inscrição;
 * - sem `timeoutMs` (ou com `0`), espera indefinidamente.
 *
 * A inscrição acontece na chamada: chame antes do comando que provoca o evento, ou use
 * {@link requestNativeEventData}, que já faz isso na ordem certa.
 *
 * @param emitter um dos emissores de `TechnosEvents`.
 * @param timeoutMs tempo máximo de espera em milissegundos.
 */
export const getNativeEventData = <T>(emitter: TechnosEventEmitter<T>, timeoutMs?: number): Promise<T> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	return new Promise<T>((resolve, reject) => {
		const subscription = emitter(event => {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
			subscription.remove();
			resolve(event);
		});

		if (timeoutMs) {
			timeoutId = setTimeout(() => {
				subscription.remove();
				reject(new Error(`Timeout Error: getDataFromWatch - ${emitter.name}`));
			}, timeoutMs);
		}
	});
};

/**
 * Executa um comando e espera o evento que ele produz, sem perder o evento nem deixar inscrição pendurada.
 *
 * Novo (o Core atual não tem). Resolve o padrão "comando + evento" do módulo:
 * 1. inscreve no `emitter` antes de chamar `command`, para não perder um evento rápido;
 * 2. se `command` rejeitar (ex.: `NO_DATA`, `NOT_READY`), remove a inscrição e rejeita com o mesmo erro,
 *    preservando o `code` vindo do nativo;
 * 3. senão, resolve com o primeiro evento, ou rejeita como {@link getNativeEventData} se `timeoutMs` estourar.
 *
 * O tempo conta a partir da chamada, não do fim do comando.
 *
 * @param emitter emissor do evento esperado (ex.: `TechnosEvents.onHistoryPedometer`).
 * @param command função que dispara o comando (ex.: `() => TechnosCore.getHistoryPedometer(3)`).
 * @param timeoutMs tempo máximo de espera em milissegundos; sem valor, espera indefinidamente.
 */
export const requestNativeEventData = <T>(
	emitter: TechnosEventEmitter<T>,
	command: () => Promise<unknown> | void,
	timeoutMs?: number,
): Promise<T> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	let subscription: TechnosEventSubscription | undefined;
	let settled = false;

	return new Promise<T>((resolve, reject) => {
		const finish = (action: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
			subscription?.remove();
			action();
		};

		subscription = emitter(event => finish(() => resolve(event)));

		if (timeoutMs) {
			timeoutId = setTimeout(
				() => finish(() => reject(new Error(`Timeout Error: getDataFromWatch - ${emitter.name}`))),
				timeoutMs,
			);
		}

		try {
			Promise.resolve(command()).catch((error: unknown) => finish(() => reject(error)));
		} catch (error) {
			finish(() => reject(error));
		}
	});
};

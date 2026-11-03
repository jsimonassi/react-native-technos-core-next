/**
 * Marca a Promise como observada e a devolve sem mudar nada: quem faz `await` (ou `.catch`) continua recebendo a
 * rejeição com o `code`, e quem chama sem `await` não gera "Possible unhandled promise rejection".
 *
 * Existe para os métodos da fase 2 (`docs/api-js.md`, regra 3): no Core atual vários deles são `void` ou chamados sem
 * `await` pelo app Condor (`setUserInfo`, `syncWeather`, `vibrateDevice`, a câmera), e aqui toda falha já sai em
 * `TechnosEvents.onError`. Só cobre a Promise devolvida pelo `TechnosCore`: um wrapper `async` do app que chama sem
 * `await` cria outra Promise, e essa continua sem tratamento.
 *
 * @param promise Promise do módulo nativo.
 * @returns a mesma Promise.
 */
export const observed = <T>(promise: Promise<T>): Promise<T> => {
	promise.catch(() => {});
	return promise;
};

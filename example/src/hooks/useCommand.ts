import { useCallback, useState } from "react";
import { describeError } from "../helpers/format";

/** Situação de um comando disparado pela tela. */
export interface CommandState<R> {
	pending: boolean;
	/** Mensagem do último erro (`CODE: mensagem`), ou `null`. */
	error: string | null;
	/** Resultado da última execução com sucesso. */
	result: R | undefined;
	/** Epoch millis do último sucesso. */
	doneAt: number | null;
}

/** {@link CommandState} mais a função que executa o comando. */
export interface Command<A extends unknown[], R> extends CommandState<R> {
	run: (...args: A) => Promise<R | undefined>;
	reset: () => void;
}

const idle = { pending: false, error: null, result: undefined, doneAt: null };

/**
 * Embrulha um comando assíncrono do módulo para a tela mostrar spinner, erro e hora do último sucesso.
 * `run` nunca rejeita: o erro fica em `error`.
 */
export const useCommand = <A extends unknown[], R>(command: (...args: A) => Promise<R>): Command<A, R> => {
	const [state, setState] = useState<CommandState<R>>(idle);

	const run = useCallback(
		async (...args: A): Promise<R | undefined> => {
			setState(current => ({ ...current, pending: true, error: null }));
			try {
				const result = await command(...args);
				setState({ pending: false, error: null, result, doneAt: Date.now() });
				return result;
			} catch (error) {
				setState(current => ({ ...current, pending: false, error: describeError(error) }));
				return undefined;
			}
		},
		[command],
	);

	const reset = useCallback(() => setState(idle), []);

	return { ...state, run, reset };
};

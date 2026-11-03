import { useEffect } from "react";
import { Vibration } from "react-native";
import type { FindPhoneEvent } from "react-native-technos-core-next";

/** Padrão da vibração (espera, vibra, pausa...), tocado uma vez por `onFindPhone` com `status: "1"`. */
export const FIND_PHONE_VIBRATION = [0, 600, 300, 600, 300, 600];

/**
 * Só no app de exemplo: vibra o telefone quando o relógio começa a procurá-lo (`onFindPhone` com `status: "1"`) e para
 * com `"0"`. O app Condor toca um som; aqui a vibração basta para ver o evento no aparelho. Não repete sozinha, para
 * não ficar vibrando se o `"0"` não chegar. No Android exige a permissão `VIBRATE` no manifesto do exemplo.
 *
 * @param event último `onFindPhone`, ou `null`.
 * @param receivedAt quando ele chegou (muda a cada evento, mesmo com o mesmo `status`).
 */
export const useFindPhoneVibration = (event: FindPhoneEvent | null, receivedAt: number | undefined): void => {
	useEffect(() => {
		if (!event || receivedAt === undefined) {
			return;
		}
		if (event.status === "1") {
			Vibration.vibrate(FIND_PHONE_VIBRATION);
		} else {
			Vibration.cancel();
		}
	}, [event, receivedAt]);
};

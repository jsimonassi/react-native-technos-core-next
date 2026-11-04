import React from "react";
import { Text, View, type ViewProps } from "react-native";
import { timerTextStyle, type ChronometerStyle } from "./timerText";

/**
 * Props do cronômetro, cópia literal de `TechnosNativeChronometerProps` do Core atual (`TechnosWareCore` `v4.3.57`,
 * `src/NativeComponents/components/TechnosNativeChronometer/index.tsx:6-13`).
 */
export interface TechnosNativeChronometerProps extends ViewProps {
	chronometerStyle: ChronometerStyle;
	color?: string;
	fontSize: "extraSmall" | "small" | "normal" | "big" | "extraBig" | "extraLarge";
	fontWeight?: "normal" | "bold";
	textCenter?: boolean;
	hideHours?: boolean;
}

/**
 * Cronômetro da atividade iniciada pelo app, por enquanto como reserva (stub): mostra sempre o texto inicial do
 * cronômetro nativo do Core, `00:00:00` (`00:00` com `hideHours`), com o tamanho, a cor e o alinhamento das props; as
 * props de `View` (`style`, `testID`...) vão para a `View` que o envolve. No Core atual é o componente nativo
 * `TechnosNativeChronometer`, que o nativo atualiza a cada segundo da atividade.
 *
 * Existe para o app Condor importar e estilizar (`styled(TechnosNativeChronometer)` no nível do módulo) sem quebrar:
 * a versão que conta pelo `onActivityUpdateV2` vem com a atividade iniciada pelo app (F3-D25 da especificação da fase
 * 3), que hoje termina em `onActivityError` -1 antes de qualquer atualização.
 */
export const TechnosNativeChronometer = ({
	chronometerStyle,
	color,
	fontSize,
	fontWeight,
	textCenter,
	hideHours,
	...viewProps
}: TechnosNativeChronometerProps) => (
	<View {...viewProps}>
		<Text style={timerTextStyle({ chronometerStyle, color, fontSize, fontWeight, textCenter })}>
			{hideHours ? "00:00" : "00:00:00"}
		</Text>
	</View>
);

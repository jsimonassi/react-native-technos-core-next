import React from "react";
import { Text, View, type ViewProps } from "react-native";
import { timerTextStyle, type ChronometerStyle } from "./timerText";

/**
 * Props do contador de ação, cópia literal de `TechnosActionTimerProps` do Core atual (`TechnosWareCore` `v4.3.57`,
 * `src/NativeComponents/components/TechnosNativeActionTimer/index.tsx:6-10`). Como lá, a raiz não exporta o tipo.
 */
export interface TechnosActionTimerProps extends ViewProps {
	chronometerStyle: ChronometerStyle;
	color?: string;
	fontSize: "small" | "normal" | "big" | "extraBig";
}

/**
 * Contador regressivo de cada ação do plano de treino, por enquanto como reserva (stub): mostra sempre `00:00`, o
 * texto inicial do contador nativo do Core, com o tamanho e a cor das props (centralizado no estilo `technos`, como
 * lá); as props de `View` vão para a `View` que o envolve. No Core atual é o componente nativo
 * `TechnosNativeActionTimer`, atualizado pelo plano de treino da atividade, que o Core Next não tem.
 */
export const TechnosNativeActionTimer = ({
	chronometerStyle,
	color,
	fontSize,
	...viewProps
}: TechnosActionTimerProps) => (
	<View {...viewProps}>
		<Text style={timerTextStyle({ chronometerStyle, color, fontSize, textCenter: chronometerStyle === "technos" })}>
			00:00
		</Text>
	</View>
);

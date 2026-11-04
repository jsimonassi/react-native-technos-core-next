import type { TextStyle } from "react-native";

/** Estilo visual dos cronômetros, igual ao do Core atual (`src/NativeComponents/type/technosNativeChronometer.ts:1`). */
export type ChronometerStyle = "mormaii" | "touch" | "technos" | "condor";

/**
 * Tamanho e altura de linha do texto de cada `fontSize` dos cronômetros nativos do Core atual, em sp, como no Android
 * (`TechnosNativeChronometerView.kt:82-94` e `TechnosNativeActionTimerView.kt:57-68` do `v4.3.57`); valor desconhecido
 * vale `big`, como lá.
 */
const TYPOGRAPHY: Readonly<Record<string, Pick<TextStyle, "fontSize" | "lineHeight">>> = {
	extraSmall: { fontSize: 12, lineHeight: 18 },
	small: { fontSize: 14, lineHeight: 21 },
	normal: { fontSize: 18, lineHeight: 27 },
	big: { fontSize: 24, lineHeight: 28 },
	extraBig: { fontSize: 32, lineHeight: 38 },
	extraLarge: { fontSize: 48, lineHeight: 57 },
};

/** O que decide o texto de um cronômetro (as props visuais do Core). */
export interface TimerTextOptions {
	chronometerStyle: ChronometerStyle;
	fontSize: string;
	color?: string;
	fontWeight?: "normal" | "bold";
	textCenter?: boolean;
}

/**
 * Estilo do texto de um cronômetro: tamanho pela tabela do Core, a cor pedida (branco sem ela, o padrão do nativo) e
 * negrito, como as fontes dos estilos `mormaii`, `technos` e `condor` (o `touch` não muda a fonte). A fonte própria de
 * cada estilo (Gotham-Bold no `condor`) não é aplicada: depende de o app ter a fonte.
 */
export const timerTextStyle = (options: TimerTextOptions): TextStyle => ({
	...(TYPOGRAPHY[options.fontSize] ?? TYPOGRAPHY.big),
	color: options.color || "#FFFFFF",
	fontWeight: options.fontWeight ?? (options.chronometerStyle === "touch" ? "normal" : "bold"),
	textAlign: options.textCenter ? "center" : "left",
});

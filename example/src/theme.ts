import { useColorScheme } from "react-native";

/** Cores do app de exemplo. Duas paletas, escolhidas pelo tema do sistema. */
export interface Palette {
	background: string;
	surface: string;
	surfaceAlt: string;
	border: string;
	text: string;
	textMuted: string;
	primary: string;
	onPrimary: string;
	danger: string;
	warning: string;
	success: string;
	info: string;
	code: string;
}

const light: Palette = {
	background: "#F2F4F7",
	surface: "#FFFFFF",
	surfaceAlt: "#E8ECF1",
	border: "#D0D5DD",
	text: "#101828",
	textMuted: "#475467",
	primary: "#0B6E99",
	onPrimary: "#FFFFFF",
	danger: "#B42318",
	warning: "#B54708",
	success: "#067647",
	info: "#175CD3",
	code: "#1D2939",
};

const dark: Palette = {
	background: "#0C111D",
	surface: "#161B26",
	surfaceAlt: "#1F242F",
	border: "#333741",
	text: "#F5F5F6",
	textMuted: "#94969C",
	primary: "#36A2D3",
	onPrimary: "#0C111D",
	danger: "#F97066",
	warning: "#FDB022",
	success: "#47CD89",
	info: "#84ADFF",
	code: "#CECFD2",
};

/** Paleta do tema atual do sistema. */
export const usePalette = (): Palette => (useColorScheme() === "dark" ? dark : light);

/** `true` quando o sistema está em modo escuro. */
export const useIsDark = (): boolean => useColorScheme() === "dark";

/** Fonte monoespaçada para hex, JSON e log. */
export const monospace = "monospace";

import React, { useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { monospace, usePalette, type Palette } from "../theme";

/** Variantes de {@link Button}. */
export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps {
	title: string;
	onPress: () => void;
	variant?: ButtonVariant;
	loading?: boolean;
	disabled?: boolean;
	compact?: boolean;
	testID?: string;
}

/** Botão com spinner e estado desabilitado. */
export const Button = ({
	title,
	onPress,
	variant = "primary",
	loading = false,
	disabled = false,
	compact = false,
	testID,
}: ButtonProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const inactive = disabled || loading;
	const variantStyle = {
		primary: styles.buttonPrimary,
		danger: styles.buttonDanger,
		secondary: styles.buttonSecondary,
	}[variant];
	const textStyle = variant === "secondary" ? styles.buttonTextSecondary : styles.buttonTextFilled;
	return (
		<Pressable
			testID={testID}
			accessibilityRole="button"
			accessibilityState={{ disabled: inactive, busy: loading }}
			onPress={onPress}
			disabled={inactive}
			style={({ pressed }) => [
				styles.button,
				compact && styles.buttonCompact,
				variantStyle,
				inactive && styles.buttonDisabled,
				pressed && styles.buttonPressed,
			]}
		>
			{loading ? (
				<ActivityIndicator size="small" color={variant === "secondary" ? palette.primary : palette.onPrimary} />
			) : (
				<Text style={[styles.buttonText, textStyle]}>{title}</Text>
			)}
		</Pressable>
	);
};

/** Linha de botões que quebra quando não cabe. */
export const ButtonRow = ({ children }: { children: ReactNode }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return <View style={styles.buttonRow}>{children}</View>;
};

interface CardProps {
	title: string;
	subtitle?: string;
	right?: ReactNode;
	children?: ReactNode;
	style?: StyleProp<ViewStyle>;
}

/** Bloco com título. */
export const Card = ({ title, subtitle, right, children, style }: CardProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<View style={[styles.card, style]}>
			<View style={styles.cardHeader}>
				<View style={styles.cardTitleBox}>
					<Text style={styles.cardTitle}>{title}</Text>
					{subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
				</View>
				{right}
			</View>
			{children}
		</View>
	);
};

/** Par rótulo/valor. O valor é selecionável para copiar. */
export const Field = ({ label, value }: { label: string; value: ReactNode }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<View style={styles.field}>
			<Text style={styles.fieldLabel}>{label}</Text>
			<Text selectable style={styles.fieldValue}>
				{value === null || value === undefined || value === "" ? "—" : value}
			</Text>
		</View>
	);
};

/** Texto de apoio. */
export const Muted = ({ children }: { children: ReactNode }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return <Text style={styles.muted}>{children}</Text>;
};

/** Mensagem de erro, selecionável. */
export const ErrorText = ({ message }: { message: string | null | undefined }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	if (!message) {
		return null;
	}
	return (
		<Text selectable style={styles.error}>
			{message}
		</Text>
	);
};

/** Aviso destacado. */
export const Hint = ({ children }: { children: ReactNode }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<View style={styles.hint}>
			<Text style={styles.hintText}>{children}</Text>
		</View>
	);
};

/** Barra de progresso de 0 a 100. */
export const ProgressBar = ({ progress, tone = "primary" }: { progress: number; tone?: "primary" | "danger" }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const width = `${Math.max(0, Math.min(100, progress))}%` as const;
	return (
		<View
			style={styles.progressTrack}
			accessibilityRole="progressbar"
			accessibilityValue={{ min: 0, max: 100, now: progress }}
		>
			<View style={[styles.progressFill, tone === "danger" && styles.progressFillDanger, { width }]} />
		</View>
	);
};

/** Bloco de JSON cru, selecionável e em fonte monoespaçada. */
export const JsonBlock = ({ value }: { value: string }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<View style={styles.codeBox}>
			<Text selectable style={styles.code}>
				{value}
			</Text>
		</View>
	);
};

/** Opção selecionável em um grupo (filtros). */
export const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[styles.chip, selected && styles.chipSelected]}
		>
			<Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
		</Pressable>
	);
};

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		button: {
			minHeight: 40,
			paddingHorizontal: 14,
			borderRadius: 8,
			alignItems: "center",
			justifyContent: "center",
		},
		buttonCompact: {
			minHeight: 32,
			paddingHorizontal: 10,
		},
		buttonPrimary: {
			backgroundColor: palette.primary,
		},
		buttonDanger: {
			backgroundColor: palette.danger,
		},
		buttonSecondary: {
			backgroundColor: palette.surface,
			borderWidth: 1,
			borderColor: palette.border,
		},
		buttonDisabled: {
			opacity: 0.5,
		},
		buttonPressed: {
			opacity: 0.8,
		},
		buttonText: {
			fontSize: 14,
			fontWeight: "600",
		},
		buttonTextFilled: {
			color: palette.onPrimary,
		},
		buttonTextSecondary: {
			color: palette.primary,
		},
		buttonRow: {
			flexDirection: "row",
			flexWrap: "wrap",
			gap: 8,
		},
		card: {
			backgroundColor: palette.surface,
			borderRadius: 12,
			borderWidth: StyleSheet.hairlineWidth,
			borderColor: palette.border,
			padding: 14,
			gap: 10,
		},
		cardHeader: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			gap: 8,
		},
		cardTitleBox: {
			flex: 1,
			gap: 2,
		},
		cardTitle: {
			color: palette.text,
			fontSize: 16,
			fontWeight: "700",
		},
		field: {
			flexDirection: "row",
			justifyContent: "space-between",
			gap: 12,
		},
		fieldLabel: {
			color: palette.textMuted,
			fontSize: 13,
		},
		fieldValue: {
			color: palette.text,
			fontSize: 13,
			fontWeight: "500",
			flexShrink: 1,
			textAlign: "right",
		},
		muted: {
			color: palette.textMuted,
			fontSize: 13,
		},
		error: {
			color: palette.danger,
			fontSize: 13,
		},
		hint: {
			backgroundColor: palette.surfaceAlt,
			borderLeftWidth: 3,
			borderLeftColor: palette.warning,
			borderRadius: 6,
			padding: 10,
		},
		hintText: {
			color: palette.text,
			fontSize: 13,
		},
		progressTrack: {
			height: 8,
			borderRadius: 4,
			backgroundColor: palette.surfaceAlt,
			overflow: "hidden",
		},
		progressFill: {
			height: 8,
			borderRadius: 4,
			backgroundColor: palette.primary,
		},
		progressFillDanger: {
			backgroundColor: palette.danger,
		},
		codeBox: {
			backgroundColor: palette.surfaceAlt,
			borderRadius: 8,
			padding: 10,
		},
		code: {
			color: palette.code,
			fontFamily: monospace,
			fontSize: 12,
		},
		chip: {
			paddingHorizontal: 10,
			paddingVertical: 6,
			borderRadius: 16,
			borderWidth: 1,
			borderColor: palette.border,
			backgroundColor: palette.surface,
		},
		chipSelected: {
			backgroundColor: palette.primary,
			borderColor: palette.primary,
		},
		chipText: {
			color: palette.text,
			fontSize: 12,
			fontWeight: "600",
		},
		chipTextSelected: {
			color: palette.onPrimary,
		},
	});

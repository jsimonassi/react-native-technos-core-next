import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePalette, type Palette } from "../theme";

/** Uma aba da barra inferior. */
export interface TabItem<K extends string> {
	key: K;
	label: string;
	/** Texto pequeno ao lado do rótulo (ex.: quantidade de entradas do log). */
	badge?: string;
}

interface TabBarProps<K extends string> {
	tabs: readonly TabItem<K>[];
	active: K;
	onChange: (key: K) => void;
}

/** Barra de abas simples, sem biblioteca de navegação. */
export const TabBar = <K extends string>({ tabs, active, onChange }: TabBarProps<K>) => {
	const palette = usePalette();
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	return (
		<View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
			{tabs.map(tab => {
				const selected = tab.key === active;
				return (
					<Pressable
						key={tab.key}
						testID={`tab-${tab.key}`}
						accessibilityRole="tab"
						accessibilityState={{ selected }}
						onPress={() => onChange(tab.key)}
						style={styles.tab}
					>
						<View style={[styles.indicator, selected && styles.indicatorActive]} />
						<Text style={[styles.label, selected && styles.labelActive]}>
							{tab.label}
							{tab.badge ? <Text style={styles.badge}>{` ${tab.badge}`}</Text> : null}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
};

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		bar: {
			flexDirection: "row",
			backgroundColor: palette.surface,
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: palette.border,
		},
		tab: {
			flex: 1,
			alignItems: "center",
			paddingBottom: 6,
			gap: 8,
		},
		indicator: {
			alignSelf: "stretch",
			height: 3,
			backgroundColor: "transparent",
		},
		indicatorActive: {
			backgroundColor: palette.primary,
		},
		label: {
			color: palette.textMuted,
			fontSize: 14,
			fontWeight: "600",
		},
		labelActive: {
			color: palette.primary,
		},
		badge: {
			color: palette.textMuted,
			fontSize: 11,
			fontWeight: "500",
		},
	});

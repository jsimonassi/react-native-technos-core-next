import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { ConnectStateChangedEvent } from "react-native-technos-core-next";
import { connectStateLabel, connectStateTone, type StateTone } from "../helpers/format";
import { usePalette, type Palette } from "../theme";

interface StateBadgeProps {
	connection: ConnectStateChangedEvent | null;
	/** Mostra também `sessionState` e `phase`. */
	detailed?: boolean;
}

const toneColor = (palette: Palette, tone: StateTone): string => {
	switch (tone) {
		case "success":
			return palette.success;
		case "warning":
			return palette.warning;
		case "danger":
			return palette.danger;
		case "muted":
			return palette.textMuted;
	}
};

/** Estado da conexão: código de `deviceConnectStates`, rótulo e, no modo detalhado, estado da sessão e fase. */
export const StateBadge = ({ connection, detailed = false }: StateBadgeProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const state = connection?.state ?? null;
	const color = toneColor(palette, connectStateTone(state));
	return (
		<View style={styles.row} accessibilityLabel={`Estado: ${connectStateLabel(state)}`}>
			<View style={[styles.badge, { borderColor: color }]}>
				<View style={[styles.dot, { backgroundColor: color }]} />
				<Text style={[styles.label, { color }]}>
					{connectStateLabel(state)}
					{state !== null ? ` (${state})` : ""}
				</Text>
			</View>
			{detailed && connection ? (
				<Text selectable style={styles.detail}>
					{connection.sessionState}
					{connection.phase ? ` · ${connection.phase}` : ""}
				</Text>
			) : null}
		</View>
	);
};

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		row: {
			flexDirection: "row",
			alignItems: "center",
			flexWrap: "wrap",
			gap: 8,
		},
		badge: {
			flexDirection: "row",
			alignItems: "center",
			gap: 6,
			borderWidth: 1,
			borderRadius: 14,
			paddingHorizontal: 10,
			paddingVertical: 4,
		},
		dot: {
			width: 8,
			height: 8,
			borderRadius: 4,
		},
		label: {
			fontSize: 13,
			fontWeight: "700",
		},
		detail: {
			color: palette.textMuted,
			fontSize: 12,
			fontWeight: "600",
		},
	});

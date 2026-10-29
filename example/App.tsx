import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { TechnosCore } from "react-native-technos-core-next";
import { StateBadge } from "./src/components/StateBadge";
import { TabBar, type TabItem } from "./src/components/TabBar";
import { describeError } from "./src/helpers/format";
import { useCoreEvents } from "./src/hooks/useCoreEvents";
import { usePermissions } from "./src/hooks/usePermissions";
import { ConnectionScreen, type InitState } from "./src/screens/ConnectionScreen";
import { DataScreen } from "./src/screens/DataScreen";
import { LogScreen } from "./src/screens/LogScreen";
import { useIsDark, usePalette, type Palette } from "./src/theme";

type TabKey = "connection" | "data" | "log";

const useInitialize = (permissionsGranted: boolean): InitState => {
	const [status, setStatus] = useState<InitState["status"]>("pending");
	const [error, setError] = useState<string | null>(null);
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		let cancelled = false;
		setStatus("pending");
		setError(null);
		// `initialize` é idempotente; roda de novo quando as permissões chegam para o nativo já enxergar o Bluetooth.
		TechnosCore.initialize()
			.then(() => {
				if (!cancelled) {
					setStatus("ready");
				}
			})
			.catch(reason => {
				if (!cancelled) {
					setStatus("failed");
					setError(describeError(reason));
				}
			});
		return () => {
			cancelled = true;
		};
	}, [permissionsGranted, attempt]);

	const retry = useCallback(() => setAttempt(value => value + 1), []);
	return useMemo(() => ({ status, error, retry }), [status, error, retry]);
};

const AppContent = () => {
	const palette = usePalette();
	const isDark = useIsDark();
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const core = useCoreEvents();
	const permissions = usePermissions();
	const init = useInitialize(permissions.status === "granted");
	const [tab, setTab] = useState<TabKey>("connection");

	const tabs: TabItem<TabKey>[] = useMemo(
		() => [
			{ key: "connection", label: "Conexão" },
			{ key: "data", label: "Dados" },
			{ key: "log", label: "Log", badge: core.logs.length > 0 ? String(core.logs.length) : undefined },
		],
		[core.logs.length],
	);

	return (
		<View style={[styles.root, { paddingTop: insets.top }]}>
			<StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={palette.surface} />
			<View style={styles.header}>
				<Text style={styles.title}>Technos Core Next</Text>
				<StateBadge connection={core.state.connection} />
			</View>
			{/* As três abas ficam montadas para não perder resultados ao trocar; só a ativa aparece. */}
			<View style={[styles.page, tab !== "connection" && styles.hidden]}>
				<ConnectionScreen
					state={core.state}
					permissions={permissions}
					init={init}
					onClearDevices={core.clearDevices}
					onClearError={core.clearError}
				/>
			</View>
			<View style={[styles.page, tab !== "data" && styles.hidden]}>
				<DataScreen state={core.state} />
			</View>
			<View style={[styles.page, tab !== "log" && styles.hidden]}>
				<LogScreen logs={core.logs} onClear={core.clearLogs} onReload={core.reloadLogs} />
			</View>
			<TabBar tabs={tabs} active={tab} onChange={setTab} />
		</View>
	);
};

/** App de exemplo do `react-native-technos-core-next`: abas Conexão, Dados e Log. */
const App = () => (
	<SafeAreaProvider>
		<AppContent />
	</SafeAreaProvider>
);

export default App;

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: palette.background,
		},
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			paddingHorizontal: 16,
			paddingVertical: 10,
			backgroundColor: palette.surface,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: palette.border,
		},
		title: {
			color: palette.text,
			fontSize: 18,
			fontWeight: "800",
		},
		page: {
			flex: 1,
		},
		hidden: {
			display: "none",
		},
	});

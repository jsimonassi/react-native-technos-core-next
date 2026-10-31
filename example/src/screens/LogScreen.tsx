import React, { memo, useCallback, useMemo, useState } from "react";
import {
	FlatList,
	Platform,
	Share,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
	type ListRenderItem,
} from "react-native";
import { TechnosCore, logLevels, type LogLevelName } from "react-native-technos-core-next";
import { Button, ButtonRow, Chip, ErrorText, Muted } from "../components/ui";
import { buildPullCommand, exportedFiles } from "../helpers/adb";
import { describeError, formatLogTime } from "../helpers/format";
import { filterLogs, spacedHex, toJsonl, type LogRow } from "../helpers/logBuffer";
import { monospace, usePalette, type Palette } from "../theme";

/**
 * Entradas mandadas no Share. O Share do React Native só manda texto no Android (não anexa arquivo), e um texto
 * grande demais estoura o limite de transação do Binder ao montar o Intent.
 */
const SHARE_MAX_ENTRIES = 500;

const levelNames = Object.keys(logLevels) as LogLevelName[];

interface LogScreenProps {
	logs: LogRow[];
	onClear: () => void;
	onReload: () => Promise<void>;
}

interface ExportResult {
	/** Caminho devolvido por `exportLogs` (gravação de frames). */
	path: string;
	/** Um comando `adb` por arquivo da exportação (frames e log); vazio no iOS, onde os arquivos saem pelo app Arquivos. */
	commands: string[];
}

const isIos = Platform.OS === "ios";

const LogScreenView = ({ logs, onClear, onReload }: LogScreenProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const [text, setText] = useState("");
	const [minLevel, setMinLevel] = useState<LogLevelName>("DEBUG");
	const [showHex, setShowHex] = useState(true);
	const [framesOnly, setFramesOnly] = useState(false);
	const [nativeLevel, setNativeLevel] = useState<LogLevelName>("DEBUG");
	const [exported, setExported] = useState<ExportResult | null>(null);
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const visible = useMemo(() => filterLogs(logs, { text, minLevel, framesOnly }), [logs, text, minLevel, framesOnly]);

	const levelColor = useCallback(
		(level: LogLevelName): string => {
			switch (level) {
				case "ERROR":
					return palette.danger;
				case "WARN":
					return palette.warning;
				case "INFO":
					return palette.info;
				case "DEBUG":
					return palette.textMuted;
			}
		},
		[palette],
	);

	const exportLogs = useCallback(() => {
		setExporting(true);
		setError(null);
		TechnosCore.exportLogs()
			.then(path =>
				setExported({ path, commands: isIos ? [] : exportedFiles(path).map(file => buildPullCommand(file)) }),
			)
			.catch(reason => setError(describeError(reason)))
			.finally(() => setExporting(false));
	}, []);

	const share = useCallback(() => {
		setError(null);
		const entries = logs.slice(0, SHARE_MAX_ENTRIES);
		Share.share({ title: "corenext-log.jsonl", message: toJsonl(entries) }).catch(reason =>
			setError(describeError(reason)),
		);
	}, [logs]);

	/** No iOS o Share aceita um arquivo: a gravação de frames sai inteira (AirDrop para o Mac, Arquivos, e-mail). */
	const shareFile = useCallback(() => {
		if (!exported) {
			return;
		}
		setError(null);
		Share.share({ url: `file://${exported.path}` }).catch(reason => setError(describeError(reason)));
	}, [exported]);

	const reload = useCallback(() => {
		setError(null);
		onReload().catch(reason => setError(describeError(reason)));
	}, [onReload]);

	const applyNativeLevel = useCallback((level: LogLevelName) => {
		setNativeLevel(level);
		TechnosCore.setLogLevel(logLevels[level]);
	}, []);

	const renderItem: ListRenderItem<LogRow> = useCallback(
		({ item }) => (
			<View style={styles.row}>
				<Text selectable style={styles.line}>
					<Text style={styles.time}>{formatLogTime(item.ts)} </Text>
					<Text style={[styles.level, { color: levelColor(item.level) }]}>{item.level.padEnd(5)} </Text>
					{item.dir ? <Text style={item.dir === "TX" ? styles.tx : styles.rx}>{`${item.dir} `}</Text> : null}
					<Text style={styles.tag}>{item.tag} </Text>
					<Text style={styles.message}>{item.message}</Text>
				</Text>
				{showHex && item.hex ? (
					<Text selectable style={styles.hex}>
						{spacedHex(item.hex)}
					</Text>
				) : null}
			</View>
		),
		[levelColor, showHex, styles],
	);

	return (
		<View style={styles.container}>
			<View style={styles.toolbar}>
				<TextInput
					value={text}
					onChangeText={setText}
					placeholder="Filtrar por tag, mensagem ou hex"
					placeholderTextColor={palette.textMuted}
					autoCapitalize="none"
					autoCorrect={false}
					style={styles.input}
				/>
				<View style={styles.chips}>
					<Muted>Nível:</Muted>
					{levelNames.map(level => (
						<Chip
							key={level}
							label={`${level}+`}
							selected={minLevel === level}
							onPress={() => setMinLevel(level)}
						/>
					))}
				</View>
				<View style={styles.switches}>
					<View style={styles.switchItem}>
						<Switch value={showHex} onValueChange={setShowHex} />
						<Muted>Hex dos frames</Muted>
					</View>
					<View style={styles.switchItem}>
						<Switch value={framesOnly} onValueChange={setFramesOnly} />
						<Muted>Só pacotes</Muted>
					</View>
				</View>
				<ButtonRow>
					<Button compact variant="secondary" title="Clear" onPress={onClear} />
					<Button compact variant="secondary" title="Recarregar" onPress={reload} />
					<Button compact title="Export" loading={exporting} onPress={exportLogs} />
					<Button compact title="Share" onPress={share} disabled={logs.length === 0} />
				</ButtonRow>
				<View style={styles.chips}>
					<Muted>Nível nativo:</Muted>
					{levelNames.map(level => (
						<Chip
							key={level}
							label={level}
							selected={nativeLevel === level}
							onPress={() => applyNativeLevel(level)}
						/>
					))}
				</View>
				{nativeLevel !== "DEBUG" ? (
					<Muted>
						Pacotes TX/RX/READ são DEBUG no nativo: acima de DEBUG eles saem do log, mas continuam na
						gravação de frames.
					</Muted>
				) : null}
				{exported ? (
					<View style={styles.exportBox}>
						<Muted>Gravação de frames exportada (toque e segure para copiar):</Muted>
						<Text selectable style={styles.exportText}>
							{exported.path}
						</Text>
						{isIos ? (
							<>
								<Muted>
									No iPhone: app Arquivos → No meu iPhone → CoreNextExample → corenext (frames e log),
									ou compartilhe a gravação:
								</Muted>
								<ButtonRow>
									<Button
										compact
										variant="secondary"
										title="Compartilhar arquivo"
										onPress={shareFile}
									/>
								</ButtonRow>
							</>
						) : (
							<>
								<Muted>No computador, com o celular no USB (frames e log):</Muted>
								<Text selectable style={styles.exportText}>
									{exported.commands.join("\n")}
								</Text>
							</>
						)}
					</View>
				) : null}
				<ErrorText message={error} />
				<Muted>
					{`${visible.length} de ${logs.length} entradas (máx. 2000). Share manda as últimas ${SHARE_MAX_ENTRIES} como .jsonl em texto.`}
				</Muted>
			</View>
			<FlatList
				inverted
				data={visible}
				keyExtractor={item => String(item.id)}
				renderItem={renderItem}
				initialNumToRender={30}
				maxToRenderPerBatch={30}
				windowSize={11}
				style={styles.list}
				ListEmptyComponent={
					<View style={styles.empty}>
						<Muted>Sem entradas.</Muted>
					</View>
				}
			/>
		</View>
	);
};

/** Aba Log: entradas de `onLog` com filtros, exportação e compartilhamento. */
export const LogScreen = memo(LogScreenView);

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		container: {
			flex: 1,
		},
		toolbar: {
			padding: 12,
			gap: 8,
			backgroundColor: palette.surface,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: palette.border,
		},
		input: {
			borderWidth: 1,
			borderColor: palette.border,
			borderRadius: 8,
			paddingHorizontal: 10,
			paddingVertical: 8,
			color: palette.text,
			backgroundColor: palette.background,
			fontSize: 14,
		},
		chips: {
			flexDirection: "row",
			flexWrap: "wrap",
			alignItems: "center",
			gap: 6,
		},
		switches: {
			flexDirection: "row",
			gap: 16,
		},
		switchItem: {
			flexDirection: "row",
			alignItems: "center",
			gap: 4,
		},
		exportBox: {
			gap: 4,
			padding: 8,
			borderRadius: 8,
			backgroundColor: palette.surfaceAlt,
		},
		exportText: {
			color: palette.text,
			fontFamily: monospace,
			fontSize: 12,
		},
		list: {
			flex: 1,
			backgroundColor: palette.background,
		},
		row: {
			paddingHorizontal: 12,
			paddingVertical: 4,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: palette.border,
		},
		line: {
			fontFamily: monospace,
			fontSize: 11,
			color: palette.text,
		},
		time: {
			color: palette.textMuted,
		},
		level: {
			fontWeight: "700",
		},
		tx: {
			color: palette.primary,
			fontWeight: "700",
		},
		rx: {
			color: palette.success,
			fontWeight: "700",
		},
		tag: {
			color: palette.info,
		},
		message: {
			color: palette.text,
		},
		hex: {
			fontFamily: monospace,
			fontSize: 11,
			color: palette.code,
			paddingLeft: 12,
		},
		empty: {
			padding: 24,
			alignItems: "center",
		},
	});

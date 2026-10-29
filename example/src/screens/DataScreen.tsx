import React, { memo, useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import {
	TechnosCore,
	TechnosEvents,
	deletedCategory,
	errorCodes,
	utils,
	type HistoryPedometerEvent,
	type HistorySleepEvent,
	type SavedItemDelete,
} from "react-native-technos-core-next";
import { Button, ButtonRow, Card, ErrorText, Hint, JsonBlock, Muted, ProgressBar } from "../components/ui";
import {
	describeError,
	formatClock,
	formatInt,
	formatIsoDay,
	formatIsoTime,
	formatKm,
	prettyJson,
	sleepTypeLabel,
	todayKey,
} from "../helpers/format";
import type { CoreState } from "../hooks/coreState";
import { useCommand } from "../hooks/useCommand";
import { usePalette, type Palette } from "../theme";

/** Mesmo tempo que o app Mormaii usa para esperar eventos (`useSyncStepsRunner`, 20 s). */
const EVENT_TIMEOUT_MS = 20000;

/** Dias pedidos em "Passos", como o app Mormaii (`PedometerHistory`, `getHistoryPedometer(3)`). */
const STEPS_DAYS_BEFORE = 3;

interface DataScreenProps {
	state: CoreState;
}

interface Received<T> {
	event: T;
	at: number;
}

const readSteps = (): Promise<HistoryPedometerEvent> =>
	utils.events.requestNativeEventData(
		TechnosEvents.onHistoryPedometer,
		() => TechnosCore.getHistoryPedometer(STEPS_DAYS_BEFORE),
		EVENT_TIMEOUT_MS,
	);

const readSleep = (): Promise<HistorySleepEvent> =>
	utils.events.requestNativeEventData(
		TechnosEvents.onHistorySleep,
		() => TechnosCore.getHistorySleep(),
		EVENT_TIMEOUT_MS,
	);

const syncStatusLabel: Record<CoreState["sync"]["status"], string> = {
	idle: "Nenhum sync nesta sessão do app",
	running: "Sincronizando…",
	finished: "Concluído",
	failed: "Falhou",
};

const DataScreenView = ({ state }: DataScreenProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const sync = useCommand(TechnosCore.syncDataHistory);
	const [steps, setSteps] = useState<Received<HistoryPedometerEvent> | null>(null);
	const [stepsError, setStepsError] = useState<string | null>(null);
	const [stepsPending, setStepsPending] = useState(false);
	const [confirmedMessage, setConfirmedMessage] = useState<string | null>(null);
	const [sleep, setSleep] = useState<Received<HistorySleepEvent> | null>(null);
	const [sleepError, setSleepError] = useState<string | null>(null);
	const [sleepNoData, setSleepNoData] = useState(false);
	const [sleepPending, setSleepPending] = useState(false);

	const loadSteps = useCallback(() => {
		setStepsPending(true);
		setStepsError(null);
		setConfirmedMessage(null);
		readSteps()
			.then(event => setSteps({ event, at: Date.now() }))
			.catch(error => setStepsError(describeError(error)))
			.finally(() => setStepsPending(false));
	}, []);

	const loadSleep = useCallback(() => {
		setSleepPending(true);
		setSleepError(null);
		setSleepNoData(false);
		readSleep()
			.then(event => setSleep({ event, at: Date.now() }))
			.catch(error => {
				if (utils.errors.getErrorCode(error) === errorCodes.NO_DATA) {
					setSleep(null);
					setSleepNoData(true);
				} else {
					setSleepError(describeError(error));
				}
			})
			.finally(() => setSleepPending(false));
	}, []);

	const pastDays = useMemo(() => {
		const today = todayKey();
		return (steps?.event.historypedometer ?? []).filter(day => !day.date.startsWith(today));
	}, [steps]);

	const confirmPastDays = useCallback(() => {
		const items: SavedItemDelete[] = pastDays.map(day => ({
			category: deletedCategory.PEDOMETER,
			registered_at: day.date,
		}));
		TechnosCore.deletedSavedData(items);
		setConfirmedMessage(`${items.length} dia(s) confirmados. Toque em "Passos" de novo: eles não devem voltar.`);
	}, [pastDays]);

	const syncRunning = state.sync.status === "running" || sync.pending;

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Card
				title="Sync"
				subtitle={syncStatusLabel[state.sync.status]}
				right={<Button compact title="Sync" loading={syncRunning} onPress={() => sync.run()} />}
			>
				<ProgressBar
					progress={state.sync.progress}
					tone={state.sync.status === "failed" ? "danger" : "primary"}
				/>
				<View style={styles.syncRow}>
					<Muted>{`${state.sync.progress}%`}</Muted>
					<Muted>
						{state.sync.startedAt ? `início ${formatClock(new Date(state.sync.startedAt))}` : ""}
						{state.sync.finishedAt ? ` · fim ${formatClock(new Date(state.sync.finishedAt))}` : ""}
					</Muted>
				</View>
				<ErrorText
					message={
						sync.error ??
						(state.sync.error ? `${state.sync.error.code}: ${state.sync.error.message}` : null)
					}
				/>
			</Card>

			<Card
				title={`Passos (${STEPS_DAYS_BEFORE} dias)`}
				subtitle={
					steps
						? `onHistoryPedometer às ${formatClock(new Date(steps.at))}`
						: "getHistoryPedometer(3) do histórico local"
				}
				right={<Button compact title="Passos" loading={stepsPending} onPress={loadSteps} />}
			>
				<ErrorText message={stepsError} />
				{steps && steps.event.historypedometer.length === 0 ? (
					<Muted>Lista vazia: rode o Sync antes ou todos os dias já foram confirmados.</Muted>
				) : null}
				{steps?.event.historypedometer.map(day => (
					<View key={day.date} style={styles.dayRow}>
						<Text style={styles.dayLabel}>{formatIsoDay(day.date)}</Text>
						<Text style={styles.dayValue}>{`${formatInt(day.pedometer)} passos`}</Text>
						<Text style={styles.dayMeta}>{`${day.calorie} kcal · ${formatKm(day.distance)}`}</Text>
					</View>
				))}
				{pastDays.length > 0 ? (
					<ButtonRow>
						<Button
							compact
							variant="secondary"
							title={`Confirmar envio de ${pastDays.length} dia(s) anteriores`}
							onPress={confirmPastDays}
						/>
					</ButtonRow>
				) : null}
				{confirmedMessage ? <Muted>{confirmedMessage}</Muted> : null}
				{steps ? <JsonBlock value={prettyJson(steps.event)} /> : null}
			</Card>

			<Card
				title="Sono (exploratório)"
				subtitle={
					sleep
						? `onHistorySleep às ${formatClock(new Date(sleep.at))}`
						: "getHistorySleep() do histórico local"
				}
				right={<Button compact title="Sono" loading={sleepPending} onPress={loadSleep} />}
			>
				<Hint>
					O fitGPS nunca teve sono em produção. O esperado é onHistorySleep ou o erro NO_DATA; o que não pode
					é ficar sem resposta.
				</Hint>
				{sleepNoData ? (
					<Text style={styles.noData}>NO_DATA: o relógio não entregou registros de sono.</Text>
				) : null}
				<ErrorText message={sleepError} />
				{sleep && sleep.event.historysleep.length === 0 ? <Muted>Lista vazia.</Muted> : null}
				{sleep?.event.historysleep.map(night => (
					<View key={`${night.date}-${night.sleep.start}`} style={styles.night}>
						<Text style={styles.dayLabel}>
							{`${formatIsoDay(night.date)} · ${formatIsoTime(night.sleep.start)}–${formatIsoTime(
								night.sleep.end,
							)}`}
						</Text>
						<Text style={styles.dayMeta}>
							{`total ${night.sleep.totalSleepMinutes} min · leve ${night.sleep.lightSleepMinutes} · profundo ${night.sleep.deepSleepMinutes} · acordado ${night.sleep.wakeUpMinutes} · REM ${night.sleep.remSleepMinutes}`}
						</Text>
						{night.sleep.items.map(item => (
							<Text key={`${item.startItem}-${item.typeItem}`} style={styles.stage}>
								{`${formatIsoTime(item.startItem)}–${formatIsoTime(item.endItem)}  ${sleepTypeLabel(
									item.typeItem,
								)}`}
							</Text>
						))}
					</View>
				))}
				{sleep ? <JsonBlock value={prettyJson(sleep.event)} /> : null}
			</Card>
		</ScrollView>
	);
};

/** Aba Dados: sync com progresso, passos dos últimos dias e sono exploratório. */
export const DataScreen = memo(DataScreenView);

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		content: {
			padding: 16,
			gap: 12,
		},
		syncRow: {
			flexDirection: "row",
			justifyContent: "space-between",
		},
		dayRow: {
			flexDirection: "row",
			alignItems: "baseline",
			flexWrap: "wrap",
			gap: 8,
			paddingVertical: 4,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: palette.border,
		},
		dayLabel: {
			color: palette.text,
			fontSize: 14,
			fontWeight: "700",
			minWidth: 72,
		},
		dayValue: {
			color: palette.text,
			fontSize: 14,
			fontWeight: "600",
		},
		dayMeta: {
			color: palette.textMuted,
			fontSize: 12,
		},
		night: {
			gap: 4,
			paddingVertical: 6,
			borderBottomWidth: StyleSheet.hairlineWidth,
			borderBottomColor: palette.border,
		},
		stage: {
			color: palette.text,
			fontSize: 12,
			paddingLeft: 8,
		},
		noData: {
			color: palette.warning,
			fontSize: 13,
			fontWeight: "600",
		},
	});

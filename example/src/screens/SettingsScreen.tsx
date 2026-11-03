import React, { memo, useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { TechnosCore } from "react-native-technos-core-next";
import { Button, ButtonRow, Card, ErrorText, Hint, Muted, type ButtonVariant } from "../components/ui";
import { describeError, formatClock, formatLogTime } from "../helpers/format";
import { syntheticSettings as synthetic } from "../helpers/syntheticSettings";
import type { CoreState, WatchEventEntry } from "../hooks/coreState";
import { monospace, usePalette, type Palette } from "../theme";

/** Um botão de um ajuste: uma variante do catálogo fictício. */
interface SettingOption {
	id: string;
	label: string;
	/** Chamado no toque; os valores que dependem da hora são montados aqui, não no render. */
	run: () => Promise<void>;
	variant?: ButtonVariant;
}

/** Um cartão da aba: um método (ou um par, como a câmera) com as suas variantes. */
interface SettingItem {
	/** Chave do estado e do `testID` (`setting-<key>-<option>`). */
	key: string;
	title: string;
	/** Método(s) do `TechnosCore` que o cartão chama. */
	methods: string;
	detail?: string;
	options: SettingOption[];
}

/** Um cenário de validação: um export por cenário (`example/README.md`). */
interface SettingSection {
	scenario: string;
	title: string;
	items: SettingItem[];
}

const now = (): Date => new Date();

const sections: readonly SettingSection[] = [
	{
		scenario: "fase2-ajustes",
		title: "Ajustes",
		items: [
			{
				key: "set12HourFormat",
				title: "Formato de hora",
				methods: "set12HourFormat",
				detail: "true = 12 h (AM/PM), como no Core.",
				options: [
					{ id: "12h", label: "12 h", run: () => TechnosCore.set12HourFormat(true) },
					{ id: "24h", label: "24 h", run: () => TechnosCore.set12HourFormat(false) },
				],
			},
			{
				key: "setTemperatureUnit",
				title: "Unidade de temperatura",
				methods: "setTemperatureUnit",
				detail: "Resolve quando o relógio confirma (8C); depois o nativo reenvia o último clima.",
				options: [
					{ id: "c", label: "°C", run: () => TechnosCore.setTemperatureUnit("c") },
					{ id: "f", label: "°F", run: () => TechnosCore.setTemperatureUnit("f") },
				],
			},
			{
				key: "setDistanceUnit",
				title: "Unidade de distância",
				methods: "setDistanceUnit",
				options: [
					{ id: "km", label: "km", run: () => TechnosCore.setDistanceUnit(synthetic.distanceKm) },
					{ id: "mi", label: "mi", run: () => TechnosCore.setDistanceUnit(synthetic.distanceMiles) },
				],
			},
			{
				key: "setScreenTime",
				title: "Tempo de tela",
				methods: "setScreenTime",
				detail: "Cronometre quanto tempo a tela fica acesa.",
				options: synthetic.screenTimes.map(seconds => ({
					id: `${seconds}s`,
					label: `${seconds} s`,
					run: () => TechnosCore.setScreenTime(seconds),
				})),
			},
			{
				key: "setDeviceBatterySaving",
				title: "Economia de bateria",
				methods: "setDeviceBatterySaving",
				detail: "Resolve no eco A4 do relógio.",
				options: [
					{ id: "on", label: "Ligar", run: () => TechnosCore.setDeviceBatterySaving(true) },
					{ id: "off", label: "Desligar", run: () => TechnosCore.setDeviceBatterySaving(false) },
				],
			},
			{
				key: "setSosHelp",
				title: "SOS",
				methods: "setSosHelp",
				options: [
					{ id: "on", label: "Ligar", run: () => TechnosCore.setSosHelp(true) },
					{ id: "off", label: "Desligar", run: () => TechnosCore.setSosHelp(false) },
				],
			},
			{
				key: "setGestureControlV2",
				title: "Gesto (levantar o pulso)",
				methods: "setGestureControlV2",
				options: [
					{
						id: "on",
						label: "07:30-23:00",
						run: () => TechnosCore.setGestureControlV2(synthetic.gestureOn),
					},
					{
						id: "outside",
						label: "Fora da hora atual",
						variant: "secondary",
						run: () => TechnosCore.setGestureControlV2(synthetic.gestureOutsideNow(now())),
					},
					{ id: "off", label: "Desligado", run: () => TechnosCore.setGestureControlV2(synthetic.gestureOff) },
				],
			},
			{
				key: "setMenstrual",
				title: "Ciclo menstrual",
				methods: "setMenstrual",
				detail: "Fictício: ciclo de 28 dias, 5 de menstruação, início em 9 de março (mês 2 no fio), lembrete às 10:00.",
				options: [
					{ id: "on", label: "Ciclo fictício", run: () => TechnosCore.setMenstrual(synthetic.menstrualOn) },
					{
						id: "silence",
						label: "Silenciar",
						run: () => TechnosCore.setMenstrual(synthetic.menstrualSilenced(now())),
					},
				],
			},
			{
				key: "setHeartRateAutomaticCheck",
				title: "Frequência cardíaca automática",
				methods: "setHeartRateAutomaticCheck",
				detail: "Os quatro argumentos da tela do app Condor (00:00-23:59, 5 min); a janela não vai ao relógio.",
				options: [
					{
						id: "on",
						label: "5 min",
						run: () =>
							TechnosCore.setHeartRateAutomaticCheck(
								true,
								synthetic.heartRate.startHour,
								synthetic.heartRate.endHour,
								synthetic.heartRate.interval,
							),
					},
					{
						id: "off",
						label: "Desligado",
						run: () =>
							TechnosCore.setHeartRateAutomaticCheck(
								false,
								synthetic.heartRate.startHour,
								synthetic.heartRate.endHour,
								synthetic.heartRate.interval,
							),
					},
				],
			},
			{
				key: "setStressAutomaticCheck",
				title: "Estresse automático",
				methods: "setStressAutomaticCheck",
				detail: "Resolve quando o relógio confirma o estado (B9 11 01).",
				options: [
					{ id: "on", label: "Ligar", run: () => TechnosCore.setStressAutomaticCheck(synthetic.stressOn) },
					{
						id: "off",
						label: "Desligar",
						run: () => TechnosCore.setStressAutomaticCheck(synthetic.stressOff),
					},
				],
			},
			{
				key: "setNotDisturb",
				title: "Não perturbe",
				methods: "setNotDisturb",
				options: [
					{
						id: "now",
						label: "Agora até +1 h",
						variant: "secondary",
						run: () => TechnosCore.setNotDisturb(synthetic.notDisturbNow(now())),
					},
					{ id: "on", label: "22:00-07:30", run: () => TechnosCore.setNotDisturb(synthetic.notDisturbOn) },
					{ id: "off", label: "Desligado", run: () => TechnosCore.setNotDisturb(synthetic.notDisturbOff) },
				],
			},
			{
				key: "setWaterReminderV2",
				title: "Lembrete de água",
				methods: "setWaterReminderV2",
				detail: "Começa daqui a 2 min, a cada 10 min; o relógio deve vibrar no horário.",
				options: [
					{
						id: "on",
						label: "Agora + 2 min",
						run: () => TechnosCore.setWaterReminderV2(synthetic.waterOn(now())),
					},
					{
						id: "count0",
						label: "Agora + 2 min, count 0",
						variant: "secondary",
						run: () => TechnosCore.setWaterReminderV2(synthetic.waterOn(now(), 0)),
					},
					{ id: "off", label: "Desligado", run: () => TechnosCore.setWaterReminderV2(synthetic.waterOff) },
				],
			},
			{
				key: "setWalkReminder",
				title: "Sedentarismo",
				methods: "setWalkReminder",
				detail: "Chave onOff; resolve quando o relógio confirma (2D).",
				options: [
					{ id: "on", label: "Ligar", run: () => TechnosCore.setWalkReminder(synthetic.walkOn) },
					{ id: "off", label: "Desligar", run: () => TechnosCore.setWalkReminder(synthetic.walkOff) },
				],
			},
			{
				key: "setUserInfo",
				title: "Perfil",
				methods: "setUserInfo",
				options: [
					{
						id: "profile",
						label: "165 cm, 60 kg, 1996-05-10",
						run: () => TechnosCore.setUserInfo(synthetic.userInfo),
					},
				],
			},
			{
				key: "setGoalsV2",
				title: "Metas",
				methods: "setGoalsV2",
				options: [
					{
						id: "goals",
						label: "8000 passos, 350 kcal, 45 min",
						run: () => TechnosCore.setGoalsV2(synthetic.goals),
					},
				],
			},
		],
	},
	{
		scenario: "fase2-mensagens",
		title: "Mensagens",
		items: [
			{
				key: "manageNotifications",
				title: "Notificações (filtro)",
				methods: "manageNotifications",
				detail: "Toque primeiro em Tudo e anote no log a resposta ao B9 14 00. Só o filtro no relógio: no Android não há encaminhamento nesta fase.",
				options: [
					{
						id: "all",
						label: "Tudo",
						run: () => TechnosCore.manageNotifications(synthetic.notificationsAll, false),
					},
					{
						id: "noWhatsApp",
						label: "Sem WhatsApp",
						run: () => TechnosCore.manageNotifications(synthetic.notificationsWithoutWhatsApp, false),
					},
				],
			},
			{
				key: "setWorldClock",
				title: "Relógio mundial",
				methods: "setWorldClock",
				detail: "Tóquio e Buenos Aires; depois só Tóquio; depois nenhuma.",
				options: [
					{ id: "two", label: "2 cidades", run: () => TechnosCore.setWorldClock(synthetic.worldClocks.two) },
					{ id: "one", label: "1 cidade", run: () => TechnosCore.setWorldClock(synthetic.worldClocks.one) },
					{ id: "none", label: "Nenhuma", run: () => TechnosCore.setWorldClock(synthetic.worldClocks.none) },
				],
			},
			{
				key: "setAlarm",
				title: "Alarmes",
				methods: "setAlarm",
				detail: "Segunda a sexta 06:45, todo dia 07:00 e um único daqui a 2 min.",
				options: [
					{ id: "three", label: "3 alarmes", run: () => TechnosCore.setAlarm(synthetic.alarms(now())) },
					{ id: "clear", label: "Limpar", run: () => TechnosCore.setAlarm([]) },
				],
			},
			{
				key: "setAddressBook",
				title: "Contatos",
				methods: "setAddressBook",
				detail: "Dois contatos fictícios (DDD 00, que não existe; um número com +). O F2 05 (suporte ao +) não tem botão: não há método nativo para ele; confira na tela do relógio se o + aparece.",
				options: [
					{ id: "two", label: "2 contatos", run: () => TechnosCore.setAddressBook(synthetic.contacts) },
					{ id: "clear", label: "Limpar", run: () => TechnosCore.setAddressBook([]) },
				],
			},
			{
				key: "syncWeather",
				title: "Clima",
				methods: "syncWeather",
				detail: "Fictício: 25 °C, sol, cidade Teste, nascer 06:00 e pôr 18:00, previsão de 7 dias.",
				options: [
					{
						id: "test",
						label: "25 °C, sol, Teste",
						run: () => TechnosCore.syncWeather(synthetic.weather(now())),
					},
					{ id: "empty", label: "Lista vazia", variant: "secondary", run: () => TechnosCore.syncWeather([]) },
				],
			},
		],
	},
	{
		scenario: "fase2-interacoes",
		title: "Interações",
		items: [
			{
				key: "vibrateDevice",
				title: "Vibrar",
				methods: "vibrateDevice",
				options: [{ id: "vibrate", label: "Vibrar", run: () => TechnosCore.vibrateDevice() }],
			},
			{
				key: "camera",
				title: "Câmera",
				methods: "openCameraMode / closeCameraMode",
				detail: "Com a câmera aberta, o disparo no relógio dá onTakeAPicture; com ela fechada, onDeviceRequestedCameraMode.",
				options: [
					{ id: "open", label: "Abrir câmera", run: () => TechnosCore.openCameraMode() },
					{ id: "close", label: "Fechar câmera", run: () => TechnosCore.closeCameraMode() },
				],
			},
		],
	},
];

/** Situação de um cartão: o botão em andamento, o último sucesso e o último erro. */
interface ItemStatus {
	pending: string | null;
	lastLabel: string | null;
	doneAt: number | null;
	error: string | null;
}

const idleStatus: ItemStatus = { pending: null, lastLabel: null, doneAt: null, error: null };

const watchEventPayload = (entry: WatchEventEntry): string => {
	const text = JSON.stringify(entry.payload);
	return text === "{}" ? "" : ` ${text}`;
};

interface SettingsScreenProps {
	state: CoreState;
}

const SettingsScreenView = ({ state }: SettingsScreenProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});

	const update = useCallback((key: string, change: (current: ItemStatus) => ItemStatus) => {
		setStatuses(current => ({ ...current, [key]: change(current[key] ?? idleStatus) }));
	}, []);

	const run = useCallback(
		(key: string, option: SettingOption) => {
			update(key, current => ({ ...current, pending: option.id, error: null }));
			option
				.run()
				.then(() => update(key, () => ({ ...idleStatus, lastLabel: option.label, doneAt: Date.now() })))
				.catch(error =>
					update(key, current => ({
						...current,
						pending: null,
						error: `${option.label}: ${describeError(error)}`,
					})),
				);
		},
		[update],
	);

	const resetOption: SettingOption = useMemo(
		() => ({ id: "reset", label: "Reset de fábrica", run: () => TechnosCore.resetDevice() }),
		[],
	);

	const confirmReset = useCallback(() => {
		Alert.alert(
			"Reset de fábrica do relógio?",
			"Apaga os dados e os ajustes do relógio (Condor Reebok, comando 51 02). Não esquece o pareamento salvo no app, não apaga o histórico local e não remove o vínculo Bluetooth do sistema: para isso, use Forget na aba Conexão. O fitGPS e o Life Ultra GPS respondem NOT_SUPPORTED.",
			[
				{ text: "Cancelar", style: "cancel" },
				{ text: "Resetar", style: "destructive", onPress: () => run("resetDevice", resetOption) },
			],
		);
	}, [resetOption, run]);

	const resetStatus = statuses.resetDevice ?? idleStatus;

	return (
		<ScrollView contentContainerStyle={styles.content}>
			<Hint>
				Valores fictícios, no formato que o app Condor manda. Só o Condor Reebok executa; o fitGPS e o Life
				Ultra GPS respondem NOT_SUPPORTED (menos Clima → Lista vazia, que resolve sem TX com qualquer relógio).
				Um cenário por export: Clear na aba Log, os botões do cenário, Export.
			</Hint>

			<Card
				title="Eventos do relógio"
				subtitle={`${state.watchEvents.length} recebido(s) nesta sessão do app`}
				right={
					state.findPhone?.status === "1" ? <Text style={styles.findPhone}>Procurando o telefone</Text> : null
				}
			>
				<Muted>
					onFindPhone, onTakeAPicture, onDeviceRequestedCameraMode e onOpenCameraMode. Só neste app, o
					onFindPhone com status "1" também vibra o telefone.
				</Muted>
				{state.watchEvents.length === 0 ? <Muted>Nenhum evento ainda.</Muted> : null}
				{state.watchEvents.map(entry => (
					<Text key={entry.id} selectable style={styles.eventRow}>
						{`${formatLogTime(entry.at)}  ${entry.name}${watchEventPayload(entry)}`}
					</Text>
				))}
			</Card>

			{sections.map(section => (
				<View key={section.scenario} style={styles.section}>
					<Text style={styles.sectionTitle}>{section.title}</Text>
					<Muted>{`Cenário ${section.scenario}`}</Muted>
					{section.items.map(item => {
						const status = statuses[item.key] ?? idleStatus;
						return (
							<Card
								key={item.key}
								title={item.title}
								subtitle={
									status.doneAt
										? `${item.methods} · ok: ${status.lastLabel} às ${formatClock(
												new Date(status.doneAt),
										  )}`
										: item.methods
								}
							>
								{item.detail ? <Muted>{item.detail}</Muted> : null}
								<ButtonRow>
									{item.options.map(option => (
										<Button
											key={option.id}
											compact
											testID={`setting-${item.key}-${option.id}`}
											title={option.label}
											variant={option.variant}
											loading={status.pending === option.id}
											disabled={status.pending !== null && status.pending !== option.id}
											onPress={() => run(item.key, option)}
										/>
									))}
								</ButtonRow>
								<ErrorText message={status.error} />
							</Card>
						);
					})}
				</View>
			))}

			<Card
				title="Reset de fábrica"
				subtitle={
					resetStatus.doneAt
						? `resetDevice · enviado às ${formatClock(new Date(resetStatus.doneAt))}`
						: "resetDevice"
				}
			>
				<Muted>
					Separado do Forget: reseta o relógio e não esquece o pareamento. Pede confirmação antes de enviar.
				</Muted>
				<ButtonRow>
					<Button
						compact
						testID="setting-resetDevice-reset"
						title="Reset de fábrica"
						variant="danger"
						loading={resetStatus.pending !== null}
						onPress={confirmReset}
					/>
				</ButtonRow>
				<ErrorText message={resetStatus.error} />
			</Card>
		</ScrollView>
	);
};

/** Aba Ajustes: um botão por comando da fase 2 com valores fictícios, os eventos do relógio e o reset de fábrica. */
export const SettingsScreen = memo(SettingsScreenView);

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		content: {
			padding: 16,
			gap: 12,
		},
		section: {
			gap: 8,
		},
		sectionTitle: {
			color: palette.text,
			fontSize: 18,
			fontWeight: "800",
			marginTop: 8,
		},
		eventRow: {
			color: palette.code,
			fontFamily: monospace,
			fontSize: 12,
		},
		findPhone: {
			color: palette.warning,
			fontSize: 13,
			fontWeight: "700",
		},
	});

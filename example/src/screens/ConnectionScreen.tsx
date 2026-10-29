import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { TechnosCore, type LastPairedDevice, type ScannedDeviceEvent } from "react-native-technos-core-next";
import { StateBadge } from "../components/StateBadge";
import { Button, ButtonRow, Card, ErrorText, Field, Hint, Muted } from "../components/ui";
import { describeError, formatClock, formatInt, formatIsoDay, formatKm } from "../helpers/format";
import type { CoreState } from "../hooks/coreState";
import { useCommand } from "../hooks/useCommand";
import type { PermissionsState, PermissionStatus } from "../hooks/usePermissions";
import { monospace, usePalette, type Palette } from "../theme";

/** Duração do scan nativo (`scan()` no spec); não há evento de fim de busca. */
const SCAN_DURATION_MS = 7000;

/** Situação do `initialize` disparado pelo App. */
export interface InitState {
	status: "pending" | "ready" | "failed";
	error: string | null;
	retry: () => void;
}

interface ConnectionScreenProps {
	state: CoreState;
	permissions: PermissionsState;
	init: InitState;
	onClearDevices: () => void;
	onClearError: () => void;
}

const permissionLabel: Record<PermissionStatus, string> = {
	checking: "Verificando…",
	granted: "Concedidas",
	denied: "Negadas",
	blocked: "Bloqueadas (libere nas configurações)",
	unavailable: "Não se aplica (só Android nesta PoC)",
};

const formatAt = (at: number | undefined | null): string | undefined =>
	at ? `atualizado às ${formatClock(new Date(at))}` : undefined;

const getDeviceAndFirmware = async (): Promise<void> => {
	// A sessão executa um comando por vez; em sequência o erro de cada um fica claro.
	await TechnosCore.getDeviceInfo();
	await TechnosCore.getFirmwareInfo();
};

const setTimeAndStamp = async (): Promise<Date> => {
	const sentAt = new Date();
	await TechnosCore.setTime();
	return sentAt;
};

const ConnectionScreenView = ({ state, permissions, init, onClearDevices, onClearError }: ConnectionScreenProps) => {
	const palette = usePalette();
	const styles = useMemo(() => makeStyles(palette), [palette]);
	const [scanning, setScanning] = useState(false);
	const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [pairingId, setPairingId] = useState<string | null>(null);
	const [pairMessage, setPairMessage] = useState<string | null>(null);
	const [pairError, setPairError] = useState<string | null>(null);
	const [lastPaired, setLastPaired] = useState<LastPairedDevice | null>(null);

	const disconnect = useCommand(TechnosCore.disconnectCurrentDevice);
	const forget = useCommand(TechnosCore.forgetDevice);
	const reconnect = useCommand(
		useCallback(async (): Promise<LastPairedDevice> => {
			const device = await TechnosCore.getLastPairedDevice();
			if (!device) {
				throw new Error("Nenhum relógio pareado salvo");
			}
			await TechnosCore.startPairingAttempt(device.deviceId, device.name);
			return device;
		}, []),
	);
	const connectedCheck = useCommand(TechnosCore.isConnected);
	const deviceInfo = useCommand(getDeviceAndFirmware);
	const battery = useCommand(TechnosCore.getBatteryStatus);
	const time = useCommand(setTimeAndStamp);
	const steps = useCommand(TechnosCore.refreshSteps);

	const refreshLastPaired = useCallback(() => {
		TechnosCore.getLastPairedDevice()
			.then(setLastPaired)
			.catch(() => setLastPaired(null));
	}, []);

	useEffect(() => {
		if (init.status === "ready") {
			refreshLastPaired();
		}
	}, [init.status, refreshLastPaired]);

	useEffect(
		() => () => {
			if (scanTimer.current !== null) {
				clearTimeout(scanTimer.current);
			}
		},
		[],
	);

	const stopScan = useCallback(() => {
		if (scanTimer.current !== null) {
			clearTimeout(scanTimer.current);
			scanTimer.current = null;
		}
		TechnosCore.stopScan();
		setScanning(false);
	}, []);

	const startScan = useCallback(() => {
		onClearDevices();
		TechnosCore.scan();
		setScanning(true);
		if (scanTimer.current !== null) {
			clearTimeout(scanTimer.current);
		}
		scanTimer.current = setTimeout(() => {
			scanTimer.current = null;
			setScanning(false);
		}, SCAN_DURATION_MS);
	}, [onClearDevices]);

	const pair = useCallback(
		(device: ScannedDeviceEvent) => {
			if (scanning) {
				stopScan();
			}
			setPairingId(device.deviceId);
			setPairMessage(null);
			setPairError(null);
			TechnosCore.pairDevice(device.deviceId, device.name)
				.then(() => {
					setPairMessage(`Pareado com ${device.name} às ${formatClock(new Date())}`);
					refreshLastPaired();
				})
				.catch(error => setPairError(describeError(error)))
				.finally(() => setPairingId(null));
		},
		[refreshLastPaired, scanning, stopScan],
	);

	const confirmForget = useCallback(() => {
		Alert.alert(
			"Esquecer relógio?",
			"Desfaz o vínculo no relógio (UNBIND), apaga o pareamento salvo e o histórico local.",
			[
				{ text: "Cancelar", style: "cancel" },
				{
					text: "Esquecer",
					style: "destructive",
					onPress: () => {
						forget.run().then(refreshLastPaired);
					},
				},
			],
		);
	}, [forget, refreshLastPaired]);

	const { battery: batteryEvent, deviceInfo: info, firmwareInfo, pedometer, receivedAt } = state;

	return (
		<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
			<Card title="Permissões" subtitle={permissionLabel[permissions.status]}>
				{permissions.details.map(detail => (
					<Field
						key={detail.permission}
						label={`${detail.label}${detail.required ? "" : " (opcional)"}`}
						value={detail.result}
					/>
				))}
				{permissions.status === "denied" ? (
					<ButtonRow>
						<Button title="Pedir permissões" onPress={() => permissions.request()} />
					</ButtonRow>
				) : null}
				{permissions.status === "blocked" ? (
					<ButtonRow>
						<Button
							title="Abrir configurações"
							variant="secondary"
							onPress={() => Linking.openSettings()}
						/>
					</ButtonRow>
				) : null}
			</Card>

			<Card
				title="Módulo"
				subtitle={
					init.status === "ready" ? "Inicializado" : init.status === "pending" ? "Inicializando…" : "Falhou"
				}
				right={init.status === "failed" ? <Button compact title="Tentar de novo" onPress={init.retry} /> : null}
			>
				<ErrorText message={init.error} />
			</Card>

			<Card title="Estado" subtitle={formatAt(receivedAt.onConnectStateChanged)}>
				<StateBadge connection={state.connection} detailed />
				{state.lastError ? (
					<View style={styles.errorBox}>
						<Text selectable style={styles.errorText}>
							{`Último erro: ${state.lastError.code}${
								state.lastError.method ? ` em ${state.lastError.method}` : ""
							}\n${state.lastError.message}`}
						</Text>
						<Button compact variant="secondary" title="Limpar" onPress={onClearError} />
					</View>
				) : null}
				<Field
					label="Último pareado"
					value={lastPaired ? `${lastPaired.name} · ${lastPaired.deviceId}` : "nenhum"}
				/>
				<ButtonRow>
					<Button
						title="Disconnect"
						variant="secondary"
						loading={disconnect.pending}
						onPress={() => disconnect.run()}
					/>
					<Button title="Forget" variant="danger" loading={forget.pending} onPress={confirmForget} />
					<Button title="Reconnect last" loading={reconnect.pending} onPress={() => reconnect.run()} />
					<Button
						title="isConnected()"
						variant="secondary"
						loading={connectedCheck.pending}
						onPress={() => connectedCheck.run()}
					/>
				</ButtonRow>
				{connectedCheck.doneAt ? (
					<Muted>{`isConnected() = ${String(connectedCheck.result)} às ${formatClock(
						new Date(connectedCheck.doneAt),
					)}`}</Muted>
				) : null}
				{reconnect.doneAt && reconnect.result ? (
					<Muted>{`Reconexão pedida para ${reconnect.result.name}; o estado acima mostra quando conectar.`}</Muted>
				) : null}
				<ErrorText message={disconnect.error ?? forget.error ?? reconnect.error ?? connectedCheck.error} />
			</Card>

			<Card
				title="Busca"
				subtitle={scanning ? "Procurando por 7 s…" : `${state.devices.length} relógio(s) encontrado(s)`}
				right={
					scanning ? (
						<Button compact variant="secondary" title="Stop" onPress={stopScan} />
					) : (
						<Button compact title="Scan" onPress={startScan} disabled={pairingId !== null} />
					)
				}
			>
				{pairingId ? (
					<Hint>Confirme no relógio se ele pedir. O primeiro pareamento espera até 60 s.</Hint>
				) : null}
				{state.devices.length === 0 && !scanning ? <Muted>Toque em Scan com o relógio por perto.</Muted> : null}
				{state.devices.map(device => {
					const isPairing = pairingId === device.deviceId;
					return (
						<Pressable
							key={device.deviceId}
							testID={`device-${device.deviceId}`}
							accessibilityRole="button"
							accessibilityLabel={`Parear ${device.name}`}
							disabled={pairingId !== null}
							onPress={() => pair(device)}
							style={({ pressed }) => [styles.deviceRow, pressed && styles.deviceRowPressed]}
						>
							<View style={styles.deviceText}>
								<Text style={styles.deviceName}>{device.name}</Text>
								<Text style={styles.deviceMeta}>{`${device.bleName} · ${device.profileId}`}</Text>
								<Text selectable style={styles.deviceId}>
									{device.deviceId}
								</Text>
							</View>
							{isPairing ? (
								<ActivityIndicator color={palette.primary} />
							) : (
								<Text style={styles.rssi}>{`${device.rssi} dBm`}</Text>
							)}
						</Pressable>
					);
				})}
				{pairMessage ? <Text style={styles.success}>{pairMessage}</Text> : null}
				<ErrorText message={pairError} />
			</Card>

			<Card
				title="Relógio"
				subtitle={formatAt(receivedAt.onDeviceInfo ?? receivedAt.onFirmwareInfo)}
				right={<Button compact title="Ler" loading={deviceInfo.pending} onPress={() => deviceInfo.run()} />}
			>
				<Field label="Firmware" value={info?.firmware ?? firmwareInfo?.version} />
				<Field label="Versão BLE" value={info?.bleVersion} />
				<Field label="Nome BLE" value={info?.bleName} />
				<Field label="Perfil" value={info?.profileId} />
				<Field label="Endereço" value={info?.deviceId ?? firmwareInfo?.deviceId} />
				<Field
					label="onFirmwareInfo"
					value={
						firmwareInfo
							? `${firmwareInfo.version} · braceletType ${firmwareInfo.braceletType} · platformCode ${firmwareInfo.platformCode}`
							: undefined
					}
				/>
				<ErrorText message={deviceInfo.error} />
			</Card>

			<Card
				title="Bateria"
				subtitle={formatAt(receivedAt.onBatteryStatus)}
				right={<Button compact title="Ler" loading={battery.pending} onPress={() => battery.run()} />}
			>
				<Text style={styles.bigNumber}>{batteryEvent ? `${batteryEvent.percentage}%` : "—"}</Text>
				<Field label="charging" value={batteryEvent ? String(batteryEvent.charging) : undefined} />
				<Field label="battery (legado)" value={batteryEvent?.battery} />
				<ErrorText message={battery.error} />
			</Card>

			<Card
				title="Hora"
				subtitle="Envia a hora local do telefone"
				right={<Button compact title="Set time" loading={time.pending} onPress={() => time.run()} />}
			>
				{time.result ? <Muted>{`Hora enviada: ${formatClock(time.result)} (confira no relógio)`}</Muted> : null}
				<ErrorText message={time.error} />
			</Card>

			<Card
				title="Passos de hoje"
				subtitle={formatAt(receivedAt.onPedometer)}
				right={<Button compact title="Refresh steps" loading={steps.pending} onPress={() => steps.run()} />}
			>
				<Text style={styles.bigNumber}>{pedometer ? formatInt(pedometer.pedometer) : "—"}</Text>
				<Field label="Calorias" value={pedometer ? `${pedometer.calorie} kcal` : undefined} />
				<Field label="Distância" value={pedometer ? formatKm(pedometer.distance) : undefined} />
				<Field label="Dia" value={pedometer ? formatIsoDay(pedometer.date) : undefined} />
				<ErrorText message={steps.error} />
			</Card>
		</ScrollView>
	);
};

/** Aba Conexão: permissões, busca, pareamento, estado e leituras rápidas. */
export const ConnectionScreen = memo(ConnectionScreenView);

const makeStyles = (palette: Palette) =>
	StyleSheet.create({
		content: {
			padding: 16,
			gap: 12,
		},
		errorBox: {
			flexDirection: "row",
			alignItems: "center",
			gap: 8,
		},
		errorText: {
			flex: 1,
			color: palette.danger,
			fontSize: 13,
		},
		deviceRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingVertical: 10,
			paddingHorizontal: 12,
			borderRadius: 10,
			backgroundColor: palette.surfaceAlt,
		},
		deviceRowPressed: {
			opacity: 0.7,
		},
		deviceText: {
			flex: 1,
			gap: 2,
		},
		deviceName: {
			color: palette.text,
			fontSize: 15,
			fontWeight: "700",
		},
		deviceMeta: {
			color: palette.textMuted,
			fontSize: 12,
		},
		deviceId: {
			color: palette.textMuted,
			fontFamily: monospace,
			fontSize: 12,
		},
		rssi: {
			color: palette.text,
			fontSize: 13,
			fontWeight: "600",
		},
		success: {
			color: palette.success,
			fontSize: 13,
			fontWeight: "600",
		},
		bigNumber: {
			color: palette.text,
			fontSize: 32,
			fontWeight: "800",
		},
	});

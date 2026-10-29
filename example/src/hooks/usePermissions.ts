import { useCallback, useEffect, useRef, useState } from "react";
import { PermissionsAndroid, Platform, type Permission } from "react-native";

/** Situação das permissões de Bluetooth. */
export type PermissionStatus = "checking" | "granted" | "denied" | "blocked" | "unavailable";

/** Resultado de uma permissão. */
export interface PermissionDetail {
	permission: Permission;
	/** Rótulo curto para a tela. */
	label: string;
	/** `true` quando a falta dela impede scan ou conexão. */
	required: boolean;
	result: "granted" | "denied" | "never_ask_again" | "unknown";
}

/** O que {@link usePermissions} devolve. */
export interface PermissionsState {
	/** Situação das permissões obrigatórias (as de Bluetooth). */
	status: PermissionStatus;
	details: PermissionDetail[];
	/** Pede as permissões que faltam. Resolve `true` se as obrigatórias foram concedidas. */
	request: () => Promise<boolean>;
}

interface PermissionSpec {
	permission: Permission;
	label: string;
	required: boolean;
}

/**
 * Permissões por nível de API.
 *
 * A partir do Android 12 (API 31) o scan e a conexão BLE pedem `BLUETOOTH_SCAN` e `BLUETOOTH_CONNECT`. O manifest do
 * módulo (`android/src/main/AndroidManifest.xml`) declara `BLUETOOTH_SCAN` com `usesPermissionFlags="neverForLocation"`,
 * por isso localização não é pedida aqui; sem esse flag o scan não devolve resultados sem `ACCESS_FINE_LOCATION`.
 * Abaixo do 31 o scan BLE depende de `ACCESS_FINE_LOCATION` (a mesma regra de `BlePermissions.kt` no nativo). `POST_NOTIFICATIONS` (API 33+) só serve para a
 * notificação do serviço de sync: pela documentação do Android 13, sem ela o serviço roda e a notificação fica só
 * no gerenciador de tarefas, fora da gaveta.
 */
export const permissionsForApi = (apiLevel: number): PermissionSpec[] => {
	const { PERMISSIONS } = PermissionsAndroid;
	if (apiLevel < 31) {
		return [{ permission: PERMISSIONS.ACCESS_FINE_LOCATION, label: "Localização (scan BLE)", required: true }];
	}
	const specs: PermissionSpec[] = [
		{ permission: PERMISSIONS.BLUETOOTH_SCAN, label: "Bluetooth: busca", required: true },
		{ permission: PERMISSIONS.BLUETOOTH_CONNECT, label: "Bluetooth: conexão", required: true },
	];
	if (apiLevel >= 33) {
		specs.push({ permission: PERMISSIONS.POST_NOTIFICATIONS, label: "Notificações (sync)", required: false });
	}
	return specs;
};

/** Situação geral a partir dos resultados das obrigatórias. */
export const summarizePermissions = (details: readonly PermissionDetail[]): PermissionStatus => {
	const required = details.filter(detail => detail.required);
	if (required.every(detail => detail.result === "granted")) {
		return "granted";
	}
	if (required.some(detail => detail.result === "never_ask_again")) {
		return "blocked";
	}
	return "denied";
};

const apiLevel = (): number => (typeof Platform.Version === "number" ? Platform.Version : Number(Platform.Version));

/**
 * Verifica as permissões de Bluetooth ao montar e pede uma vez as que faltam. Fora do Android devolve
 * `unavailable` (a PoC não tem host iOS).
 */
export const usePermissions = (): PermissionsState => {
	const isAndroid = Platform.OS === "android";
	const [details, setDetails] = useState<PermissionDetail[]>([]);
	const [status, setStatus] = useState<PermissionStatus>(isAndroid ? "checking" : "unavailable");
	const askedOnMount = useRef(false);

	const update = useCallback((next: PermissionDetail[]) => {
		setDetails(next);
		setStatus(summarizePermissions(next));
	}, []);

	const request = useCallback(async (): Promise<boolean> => {
		if (!isAndroid) {
			return false;
		}
		const specs = permissionsForApi(apiLevel());
		const results = await PermissionsAndroid.requestMultiple(specs.map(spec => spec.permission));
		const next: PermissionDetail[] = specs.map(spec => ({
			...spec,
			result: results[spec.permission] ?? "unknown",
		}));
		update(next);
		return summarizePermissions(next) === "granted";
	}, [isAndroid, update]);

	useEffect(() => {
		if (!isAndroid) {
			return;
		}
		let cancelled = false;
		const specs = permissionsForApi(apiLevel());
		Promise.all(specs.map(spec => PermissionsAndroid.check(spec.permission)))
			.then(granted => {
				if (cancelled) {
					return;
				}
				const next: PermissionDetail[] = specs.map((spec, index) => ({
					...spec,
					result: granted[index] ? "granted" : "denied",
				}));
				update(next);
				if (summarizePermissions(next) !== "granted" && !askedOnMount.current) {
					askedOnMount.current = true;
					request().catch(() => setStatus("denied"));
				}
			})
			.catch(() => {
				if (!cancelled) {
					setStatus("denied");
				}
			});
		return () => {
			cancelled = true;
		};
	}, [isAndroid, request, update]);

	return { status, details, request };
};

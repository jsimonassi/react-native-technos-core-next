import { buildPullCommand, exportedFiles } from "../src/helpers/adb";
import {
	connectStateLabel,
	describeError,
	errorHint,
	formatInt,
	formatIsoDay,
	formatKm,
	todayKey,
} from "../src/helpers/format";
import { filterLogs, mergeSnapshot, prependNewest, spacedHex, toJsonl, type LogRow } from "../src/helpers/logBuffer";
import { coreReducer, initialCoreState } from "../src/hooks/coreState";
import { permissionsForApi, summarizePermissions } from "../src/hooks/usePermissions";

const row = (id: number, extra: Partial<LogRow> = {}): LogRow => ({
	id,
	ts: id,
	level: "INFO",
	tag: "Tag",
	message: `m${id}`,
	dir: null,
	hex: null,
	...extra,
});

describe("logBuffer", () => {
	it("prependNewest põe as novas na frente, invertidas, e corta no limite", () => {
		expect(prependNewest([row(2), row(1)], [row(3), row(4)], 3).map(item => item.id)).toEqual([4, 3, 2]);
	});

	it("mergeSnapshot mantém só o que é mais novo que o retrato", () => {
		const current = [row(12), row(8)];
		const snapshot = [row(10), row(9), row(8)];
		expect(mergeSnapshot(current, snapshot, 10).map(item => item.id)).toEqual([12, 10, 9, 8]);
	});

	it("filterLogs filtra por nível mínimo, texto e frames", () => {
		const rows = [
			row(1, { level: "DEBUG", message: "scan start" }),
			row(2, { level: "WARN", message: "retry" }),
			row(3, { level: "INFO", dir: "TX", hex: "AB000005", message: "seq=5 02/08 BATTERY" }),
		];
		expect(filterLogs(rows, { text: "", minLevel: "INFO", framesOnly: false }).map(item => item.id)).toEqual([
			2, 3,
		]);
		expect(filterLogs(rows, { text: "ab0000", minLevel: "DEBUG", framesOnly: false }).map(item => item.id)).toEqual(
			[3],
		);
		expect(filterLogs(rows, { text: "", minLevel: "DEBUG", framesOnly: true }).map(item => item.id)).toEqual([3]);
	});

	it("toJsonl gera uma linha por entrada em ordem cronológica, sem o id local", () => {
		const text = toJsonl([row(2), row(1)]);
		const lines = text.split("\n").map(line => JSON.parse(line));
		expect(lines.map(line => line.ts)).toEqual([1, 2]);
		expect(lines[0]).toEqual({ ts: 1, level: "INFO", tag: "Tag", message: "m1", dir: null, hex: null });
	});

	it("spacedHex separa em pares", () => {
		expect(spacedHex("AB00002519FB")).toBe("AB 00 00 25 19 FB");
		expect(spacedHex("A")).toBe("A");
	});
});

describe("format", () => {
	it("rótulos de estado cobrem deviceConnectStates", () => {
		expect(connectStateLabel(2)).toBe("Conectado");
		expect(connectStateLabel(4)).toBe("Bluetooth desligado");
		expect(connectStateLabel(null)).toBe("Sem estado");
		expect(connectStateLabel(9)).toBe("Estado 9");
	});

	it("formatIsoDay usa o dia escrito na string", () => {
		expect(formatIsoDay("2026-10-28T00:00:00-03:00")).toBe("qua 28/10");
	});

	it("números no formato brasileiro", () => {
		expect(formatInt(12345)).toBe("12.345");
		expect(formatKm(1234)).toBe("1,23 km");
		expect(todayKey(new Date(2026, 0, 5))).toBe("2026-01-05");
	});

	it("PAIRING_REMOVED ganha a dica dos Ajustes; os outros erros ficam como estão", () => {
		const hint = "Esqueça o relógio em Ajustes > Bluetooth do iPhone e tente parear de novo.";
		expect(errorHint("PAIRING_REMOVED")).toBe(hint);
		expect(errorHint("HANDSHAKE_FAILED")).toBeNull();
		expect(errorHint(null)).toBeNull();
		const removed = Object.assign(new Error("the watch erased the Bluetooth pairing"), { code: "PAIRING_REMOVED" });
		expect(describeError(removed)).toBe(`${hint}\nPAIRING_REMOVED: the watch erased the Bluetooth pairing`);
		const timeout = Object.assign(new Error("no connection after 30000 ms"), { code: "CONNECT_TIMEOUT" });
		expect(describeError(timeout)).toBe("CONNECT_TIMEOUT: no connection after 30000 ms");
	});
});

describe("adb", () => {
	const external =
		"/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/frames-20261028-143000.jsonl";

	it("acha o log ao lado da gravação de frames", () => {
		expect(exportedFiles(external)).toEqual([
			external,
			"/storage/emulated/0/Android/data/br.com.grupotechnos.corenext.example/files/corenext/logs-20261028-143000.jsonl",
		]);
		expect(exportedFiles("/x/other.jsonl")).toEqual(["/x/other.jsonl"]);
	});

	it("usa adb pull no armazenamento externo e run-as na área interna", () => {
		expect(buildPullCommand(external)).toBe(`adb pull "${external}"`);
		expect(buildPullCommand("/data/user/0/br.com.grupotechnos.corenext.example/files/corenext/logs-1.jsonl")).toBe(
			'adb exec-out run-as br.com.grupotechnos.corenext.example cat "/data/user/0/br.com.grupotechnos.corenext.example/files/corenext/logs-1.jsonl" > logs-1.jsonl',
		);
	});
});

describe("permissões", () => {
	it("pede localização abaixo do Android 12 e as de Bluetooth a partir dele", () => {
		expect(permissionsForApi(30).map(spec => spec.permission)).toEqual(["android.permission.ACCESS_FINE_LOCATION"]);
		expect(permissionsForApi(31).map(spec => spec.permission)).toEqual([
			"android.permission.BLUETOOTH_SCAN",
			"android.permission.BLUETOOTH_CONNECT",
		]);
		expect(permissionsForApi(33).map(spec => spec.permission)).toContain("android.permission.POST_NOTIFICATIONS");
	});

	it("notificação negada não bloqueia; never_ask_again bloqueia", () => {
		const specs = permissionsForApi(33);
		const withResult = (results: string[]) =>
			specs.map((spec, index) => ({
				...spec,
				result: results[index] as "granted" | "denied" | "never_ask_again",
			}));
		expect(summarizePermissions(withResult(["granted", "granted", "denied"]))).toBe("granted");
		expect(summarizePermissions(withResult(["granted", "denied", "granted"]))).toBe("denied");
		expect(summarizePermissions(withResult(["never_ask_again", "denied", "granted"]))).toBe("blocked");
	});
});

describe("coreReducer", () => {
	it("erro sem método durante o sync encerra o sync", () => {
		const running = coreReducer(initialCoreState, { type: "event", name: "onSyncStarted", payload: {}, at: 1 });
		const failed = coreReducer(running, {
			type: "event",
			name: "onError",
			payload: { requestId: -1, code: "DISCONNECTED", message: "link caiu", method: null },
			at: 2,
		});
		expect(failed.sync).toMatchObject({ status: "failed", finishedAt: 2 });
	});

	it("progresso fica entre 0 e 100", () => {
		const state = coreReducer(initialCoreState, {
			type: "event",
			name: "onSyncProgress",
			payload: { progress: 140 },
			at: 1,
		});
		expect(state.sync.progress).toBe(100);
	});
});

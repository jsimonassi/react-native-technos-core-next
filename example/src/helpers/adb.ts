/** `applicationId` do app de exemplo (`example/android/app/build.gradle`). */
export const APPLICATION_ID = "br.com.grupotechnos.corenext.example";

const basename = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/**
 * Arquivos de uma exportação. `exportLogs` devolve a gravação de frames (`frames-<carimbo>.jsonl`) e grava o log ao
 * lado com o mesmo carimbo (`logs-<carimbo>.jsonl`), como faz `AndroidCoreHost.exportLogs` no Android.
 */
export const exportedFiles = (framesPath: string): string[] => {
	const name = basename(framesPath);
	if (!name.startsWith("frames-")) {
		return [framesPath];
	}
	const dir = framesPath.slice(0, framesPath.length - name.length);
	return [framesPath, `${dir}logs-${name.slice("frames-".length)}`];
};

/**
 * Comando para copiar um arquivo do aparelho para a pasta atual do computador.
 *
 * O nativo grava em `getExternalFilesDir` (`/storage/emulated/0/Android/data/<pacote>/files/...`), que sai com
 * `adb pull`. Se cair no fallback da área interna (`/data/user/0/<pacote>/...`), `adb pull` não lê num aparelho sem
 * root; aí só `run-as`, que funciona porque o build de debug é `debuggable`.
 */
export const buildPullCommand = (devicePath: string, applicationId: string = APPLICATION_ID): string => {
	const isInternal = devicePath.startsWith("/data/user/") || devicePath.startsWith("/data/data/");
	if (isInternal) {
		return `adb exec-out run-as ${applicationId} cat "${devicePath}" > ${basename(devicePath)}`;
	}
	return `adb pull "${devicePath}"`;
};

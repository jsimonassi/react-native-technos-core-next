/**
 * Estilo do mapa, cópia do enum `TechnosMapStyles` do Core atual (`TechnosWareCore` `v4.3.57`,
 * `src/NativeComponents/components/TechnosNativeMap/types.ts:10-15`), com os mesmos membros e textos.
 *
 * É `enum` de TypeScript (valor e tipo ao mesmo tempo) porque o app Condor lê `TechnosMapStyles.CONDOR` em tempo de
 * execução, no `attrs` do mapa estilizado (`componentsV2/Maps/MormaiiNativeMap/styles.ts:4-7`). Não importa o módulo
 * nativo: o mock oficial usa o mesmo enum.
 */
export enum TechnosMapStyles {
	MORMAII = "mormaii",
	TOUCH = "touch",
	TECHNOS = "technos",
	CONDOR = "condor",
}

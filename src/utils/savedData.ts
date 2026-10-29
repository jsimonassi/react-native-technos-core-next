import type { SavedItemDelete } from "../types/events";

/** Itens de `deletedSavedData` de uma única categoria. */
export interface SavedItemsGroup {
	category: number;
	items: SavedItemDelete[];
}

/**
 * Agrupa os itens por categoria, mantendo a ordem da primeira aparição de cada categoria e a ordem dos itens.
 *
 * O spec nativo recebe uma categoria por chamada (`deletedSavedData(items, category)`), como no Core atual.
 * O wrapper do Core atual (`TechnosWareCore/src/NativeModules/index.ts:763-768`) usa a categoria do primeiro item
 * para a lista toda; aqui cada categoria vira uma chamada, para uma lista mista não marcar dias na categoria errada.
 */
export const groupSavedItemsByCategory = (items: readonly SavedItemDelete[]): SavedItemsGroup[] => {
	const groups = new Map<number, SavedItemDelete[]>();
	for (const item of items) {
		const group = groups.get(item.category);
		if (group) {
			group.push(item);
		} else {
			groups.set(item.category, [item]);
		}
	}
	return Array.from(groups, ([category, groupItems]) => ({ category, items: groupItems }));
};

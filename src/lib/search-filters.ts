export interface SearchFilterOption {
	value: string;
	label: string;
	count: number;
}

export interface SearchFilterGroup {
	id: string;
	label: string;
	options: SearchFilterOption[];
}

export type SearchFilterSelections = Record<string, string[]>;

export interface ActiveSearchFilter {
	groupId: string;
	value: string;
	label: string;
}

export function selectedFilterCount(selections: SearchFilterSelections): number {
	return Object.values(selections).reduce((total, values) => total + values.length, 0);
}

export function activeSearchFilters(
	groups: SearchFilterGroup[],
	selections: SearchFilterSelections
): ActiveSearchFilter[] {
	return groups.flatMap((group) =>
		(selections[group.id] ?? []).map((value) => ({
			groupId: group.id,
			value,
			label: group.options.find((option) => option.value === value)?.label ?? value
		}))
	);
}

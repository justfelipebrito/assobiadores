import { toDate } from '@batalha/utils';

export type SortDirection = 'asc' | 'desc';

export type SortState<Key extends string> = {
  key: Key;
  direction: SortDirection;
};

export type SortSelectors<T, Key extends string> = Record<Key, (row: T) => unknown>;

function normalizeSortValue(value: unknown) {
  const date = toDate(value);
  if (date) return date.getTime();
  if (typeof value === 'string') return value.toLocaleLowerCase('pt-BR');
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value == null ? '' : String(value).toLocaleLowerCase('pt-BR');
}

export function compareSortValues(left: unknown, right: unknown) {
  const normalizedLeft = normalizeSortValue(left);
  const normalizedRight = normalizeSortValue(right);

  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

export function sortRows<T, Key extends string>(
  rows: T[],
  sort: SortState<Key>,
  selectors: SortSelectors<T, Key>,
) {
  const selector = selectors[sort.key];
  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) => {
    const result = compareSortValues(selector(left), selector(right));
    return result * direction;
  });
}

export function getNextSortState<Key extends string>(
  current: SortState<Key>,
  key: Key,
): SortState<Key> {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

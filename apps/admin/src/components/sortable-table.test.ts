import { describe, expect, it } from 'vitest';
import { getNextSortState, sortRows } from './sortable-table';

describe('sortable table helpers', () => {
  it('sorts rows by selected column and direction', () => {
    const rows = [
      { name: 'Carla', points: 20 },
      { name: 'Ana', points: 10 },
      { name: 'Bruno', points: 30 },
    ];

    expect(
      sortRows(rows, { key: 'name', direction: 'asc' }, { name: (row) => row.name }),
    ).toEqual([
      { name: 'Ana', points: 10 },
      { name: 'Bruno', points: 30 },
      { name: 'Carla', points: 20 },
    ]);

    expect(
      sortRows(rows, { key: 'points', direction: 'desc' }, { points: (row) => row.points }),
    ).toEqual([
      { name: 'Bruno', points: 30 },
      { name: 'Carla', points: 20 },
      { name: 'Ana', points: 10 },
    ]);
  });

  it('toggles direction for the active key and starts new keys ascending', () => {
    expect(getNextSortState({ key: 'name', direction: 'asc' }, 'name')).toEqual({
      key: 'name',
      direction: 'desc',
    });
    expect(getNextSortState({ key: 'name', direction: 'desc' }, 'points')).toEqual({
      key: 'points',
      direction: 'asc',
    });
  });
});

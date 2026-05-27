import { describe, test, expect } from 'bun:test';
import React from 'react';
import { render } from '@testing-library/react';
import { ColumnDef } from '@tanstack/react-table';
import { NTable } from '../../src/components/table/NTable';

interface Row { id: string; name: string; }

const data: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

const columns: ColumnDef<Row, any>[] = [
  { accessorKey: 'name', header: 'Name' },
];

function TableWrapper(props: { rowClassName?: string }) {
  return (
    <div style={{ height: 600 }}>
      <NTable
        data={data}
        columns={columns}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        dynamicHeight={false}
        showPagination={false}
        classNames={props.rowClassName ? { row: props.rowClassName } : undefined}
        {...({} as any)}
      />
    </div>
  );
}

describe('NTable classNames.row', () => {
  test('classNames.row is applied to every data row', () => {
    const { container } = render(<TableWrapper rowClassName="cursor-pointer group" />);
    const rows = container.querySelectorAll('tr[data-row="true"]');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of Array.from(rows)) {
      expect(row.className).toContain('cursor-pointer');
      expect(row.className).toContain('group');
    }
  });

  test('classNames.row is NOT applied to empty-state row', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <NTable
          data={[]}
          columns={columns}
          availableModes={['table']}
          mode="table"
          showCheckbox={false}
          showViewToggle={false}
          dynamicHeight={false}
          showPagination={false}
          classNames={{ row: 'cursor-pointer group' }}
          renderEmpty={() => <div>No results</div>}
        />
      </div>,
    );
    // empty-state row has no data-row attribute
    const dataRows = container.querySelectorAll('tr[data-row="true"]');
    expect(dataRows.length).toBe(0);
  });
});
/* eslint-disable @typescript-eslint/no-explicit-any --
   This file's whole job is to accept the old, untyped column shape so existing
   callers keep working. `any` is the compatibility surface, not an oversight —
   new code uses DataTable directly, which is generic over the row type. */
import React from 'react';
import { DataTable, type Column as DataColumn } from '@/components/ui/DataTable';

/**
 * DEPRECATED — an adapter, kept so the pages already using it pick up the new
 * table treatment without being rewritten.
 *
 * It maps the old column shape onto <DataTable/>, which is where sorting, the
 * register's margin rule, the sticky header, the mobile card fallback and the
 * empty/loading states now live. New code should use DataTable directly: it
 * gives typed rows, per-column alignment, and control over how a row collapses
 * into a card on a phone.
 */
interface Column {
    header: React.ReactNode;
    accessor?: string;
    render?: (row: any) => React.ReactNode;
    className?: string;
    sortable?: boolean;
    sortKey?: string;
}

interface TableProps {
    columns: Column[];
    data: any[];
    loading?: boolean;
    emptyMessage?: string;
    defaultSortColumn?: string;
    defaultSortDirection?: 'asc' | 'desc';
}

/** "Status"/"Actions" read better pinned to the top-right corner of a card. */
function cardRole(header: React.ReactNode, index: number): DataColumn<any>['card'] {
    const text = typeof header === 'string' ? header.toLowerCase() : '';
    if (text === 'status' || text === 'actions' || text === 'action') return 'trailing';
    // The card needs a headline, but an "ID" column makes a poor one — so when
    // the first column is an id, the second one leads instead.
    if (index === 0 && text !== 'id' && text !== '#') return 'title';
    if (index === 1 && text !== 'id') return 'title';
    return 'field';
}

const Table: React.FC<TableProps> = ({
    columns,
    data,
    loading = false,
    emptyMessage = 'No data found',
    defaultSortColumn,
    defaultSortDirection = 'asc',
}) => {
    const mapped: DataColumn<any>[] = React.useMemo(() => {
        // Only the first column that qualifies becomes the card's headline; any
        // later candidate falls back to a labelled field. Resolved up front so
        // the map below stays a pure transform.
        const titleIndex = columns.findIndex((col, i) => cardRole(col.header, i) === 'title');

        return columns.map((col, index) => {
            const key = col.sortKey || col.accessor || `col-${index}`;
            const role = cardRole(col.header, index);
            const card = role === 'title' && index !== titleIndex ? 'field' : role;
            return {
                key,
                header: col.header,
                accessor: col.accessor ? (row: any) => row[col.accessor!] : undefined,
                render: col.render ? (row: any) => col.render!(row) : undefined,
                sortValue: (row: any) => row[col.sortKey || col.accessor || ''],
                sortable: col.sortable,
                className: col.className,
                card,
            };
        });
    }, [columns]);

    return (
        <DataTable
            columns={mapped}
            data={data}
            loading={loading}
            emptyMessage={emptyMessage}
            defaultSort={
                defaultSortColumn
                    ? { key: defaultSortColumn, direction: defaultSortDirection }
                    : undefined
            }
        />
    );
};

export default Table;

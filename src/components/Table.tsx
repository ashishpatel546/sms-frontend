import React from 'react';

interface Column {
    header: string;
    accessor?: string; // Key to access data
    render?: (row: any) => React.ReactNode; // Custom render function
    className?: string; // Custom class for header/cell
    sortable?: boolean; // Enable sorting for this column
    sortKey?: string; // Key to sort by if different from accessor (or if accessor is missing)
}

interface TableProps {
    columns: Column[];
    data: any[];
    loading?: boolean;
    emptyMessage?: string;
    defaultSortColumn?: string;
    defaultSortDirection?: 'asc' | 'desc';
}

const Table: React.FC<TableProps> = ({
    columns,
    data,
    loading = false,
    emptyMessage = "No data found",
    defaultSortColumn,
    defaultSortDirection = 'asc'
}) => {
    const [sortConfig, setSortConfig] = React.useState<{ key: string | null; direction: 'asc' | 'desc' }>({
        key: defaultSortColumn || null,
        direction: defaultSortDirection,
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = React.useMemo(() => {
        if (!sortConfig.key || !data) return data;

        return [...data].sort((a, b) => {
            const aValue = a[sortConfig.key!];
            const bValue = b[sortConfig.key!];

            if (aValue < bValue) {
                return sortConfig.direction === 'asc' ? -1 : 1;
            }
            if (aValue > bValue) {
                return sortConfig.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }, [data, sortConfig]);

    if (loading) {
        return <div className="p-4 text-center text-gray-500">Loading...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="p-4 text-center text-gray-500">{emptyMessage}</div>;
    }

    return (
        <div className="overflow-x-auto relative shadow-md sm:rounded-lg border border-gray-200">
            <table className="w-full text-sm text-left text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        {columns.map((col, index) => {
                            const sortKey = col.sortKey || col.accessor;
                            const isSorted = sortConfig.key === sortKey;

                            return (
                                <th
                                    key={index}
                                    scope="col"
                                    className={`py-3 px-6 ${col.className || ''} ${col.sortable ? 'cursor-pointer hover:bg-gray-100 select-none group' : ''}`}
                                    onClick={() => col.sortable && sortKey && handleSort(sortKey)}
                                >
                                    <div className="flex items-center gap-1">
                                        {col.header}
                                        {col.sortable && (
                                            <span className="text-gray-400">
                                                {isSorted ? (
                                                    sortConfig.direction === 'asc' ? '↑' : '↓'
                                                ) : (
                                                    <span className="opacity-0 group-hover:opacity-50">↕</span>
                                                )}
                                            </span>
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {sortedData.map((row, rowIndex) => (
                        <tr key={rowIndex} className="bg-white border-b hover:bg-gray-50">
                            {columns.map((col, colIndex) => (
                                <td key={colIndex} className={`py-4 px-6 ${col.className || ''}`}>
                                    {col.render
                                        ? col.render(row)
                                        : (col.accessor ? row[col.accessor] : '-')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default Table;

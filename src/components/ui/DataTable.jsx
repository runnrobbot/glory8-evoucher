import { useState, useMemo, useCallback, memo } from 'react';
import { motion } from 'framer-motion';
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Download, FileText, FileSpreadsheet, MoreHorizontal, Columns,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import EmptyState from './EmptyState';
import { exportToCSV, exportToExcel, exportTableToPDF } from '@/utils/exportUtils';

const DataTable = memo(function DataTable({
  data = [],
  columns = [],
  searchable = true,
  searchPlaceholder = 'Search...',
  sortable = true,
  selectable = false,
  onSelectionChange,
  actions,
  pagination,
  onPageChange,
  isLoading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyActionLabel,
  exportEnabled = true,
  exportFilename = 'export',
  headerActions,
  id = 'data-table',
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [visibleColumns, setVisibleColumns] = useState(
    new Set(columns.map((c) => c.key))
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebounce(searchTerm, 300);

  // Filter and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    // Search
    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      result = result.filter((row) =>
        columns.some((col) => {
          if (!col.searchable) return false;
          const value = row[col.key];
          return value && String(value).toLowerCase().includes(term);
        })
      );
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key] ?? '';
        const bVal = b[sortConfig.key] ?? '';

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();

        if (sortConfig.direction === 'asc') {
          return strA.localeCompare(strB);
        }
        return strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, debouncedSearch, sortConfig, columns]);

  // Reset to page 1 whenever search or sort changes
  const resetPage = useCallback(() => setCurrentPage(1), []);

  // Paginated slice of processedData
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(processedData.length / pageSize));
  const paginatedData = useMemo(() => {
    if (pageSize === 0) return processedData; // "All" mode
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  const handleSort = useCallback((key) => {
    if (!sortable) return;
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  }, [sortable]);

  const handleSelectAll = useCallback(() => {
    if (selectedRows.size === processedData.length) {
      setSelectedRows(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(processedData.map((r) => r.id || r.uid));
      setSelectedRows(allIds);
      onSelectionChange?.(processedData);
    }
  }, [processedData, selectedRows.size, onSelectionChange]);

  const handleSelectRow = useCallback((row) => {
    const id = row.id || row.uid;
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      onSelectionChange?.(processedData.filter((r) => next.has(r.id || r.uid)));
      return next;
    });
  }, [processedData, onSelectionChange]);

  const toggleColumn = useCallback((key) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const activeColumns = useMemo(
    () => columns.filter((c) => visibleColumns.has(c.key)),
    [columns, visibleColumns]
  );

  const handleExport = useCallback((format) => {
    const exportCols = activeColumns.filter((c) => c.key !== 'actions');
    switch (format) {
      case 'csv':
        exportToCSV(processedData, exportCols, exportFilename);
        break;
      case 'excel':
        exportToExcel(processedData, exportCols, exportFilename);
        break;
      case 'pdf':
        exportTableToPDF(processedData, exportCols, exportFilename, exportFilename);
        break;
    }
    setShowExportMenu(false);
  }, [activeColumns, processedData, exportFilename]);

  return (
    <div className="card" id={id}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          {searchable && (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="input-field pl-9 py-2 text-sm"
              />
            </div>
          )}
          {selectedRows.size > 0 && (
            <span className="text-sm text-primary-600 font-medium">
              {selectedRows.size} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {headerActions}

          {/* Column Visibility */}
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="btn-icon"
              title="Column visibility"
            >
              <Columns className="w-4 h-4" />
            </button>
            {showColumnMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowColumnMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-2 min-w-[180px]">
                  {columns.filter((c) => c.key !== 'actions').map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(col.key)}
                        onChange={() => toggleColumn(col.key)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Export */}
          {exportEnabled && (
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-icon"
                title="Export"
              >
                <Download className="w-4 h-4" />
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-[160px]">
                    <button onClick={() => handleExport('csv')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <FileText className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>
                    <button onClick={() => handleExport('pdf')} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <FileText className="w-4 h-4" /> Export PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {selectable && (
                <th className="table-header w-12">
                  <input
                    type="checkbox"
                    checked={processedData.length > 0 && selectedRows.size === processedData.length}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {activeColumns.map((col) => (
                <th
                  key={col.key}
                  className={`table-header ${sortable && col.sortable !== false ? 'cursor-pointer select-none hover:bg-slate-100' : ''}`}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {sortable && col.sortable !== false && sortConfig.key === col.key && (
                      sortConfig.direction === 'asc'
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: pageSize || 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="table-cell"><div className="skeleton h-4 w-4" /></td>}
                  {activeColumns.map((col) => (
                    <td key={col.key} className="table-cell">
                      <div className="skeleton h-4 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))
            ) : processedData.length === 0 ? (
              <tr>
                <td colSpan={activeColumns.length + (selectable ? 1 : 0)}>
                  <EmptyState
                    title={emptyTitle}
                    description={emptyDescription}
                    action={emptyAction}
                    actionLabel={emptyActionLabel}
                  />
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <motion.tr
                  key={row.id || row.uid || idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`table-row-hover ${selectedRows.has(row.id || row.uid) ? 'bg-primary-50/50' : ''}`}
                >
                  {selectable && (
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(row.id || row.uid)}
                        onChange={() => handleSelectRow(row)}
                        className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                  )}
                  {activeColumns.map((col) => (
                    <td key={col.key} className="table-cell">
                      {col.render ? col.render(row[col.key], row) : row[col.key] ?? '-'}
                    </td>
                  ))}
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Built-in Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-500">
            {processedData.length === 0
              ? 'No results'
              : pageSize === 0
              ? `Showing all ${processedData.length} results`
              : `Showing ${Math.min((currentPage - 1) * pageSize + 1, processedData.length)}–${Math.min(currentPage * pageSize, processedData.length)} of ${processedData.length} results`
            }
          </p>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            className="text-xs border border-slate-200 rounded-lg px-2 py-1 text-slate-600 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
            <option value={0}>All</option>
          </select>
        </div>

        {pageSize > 0 && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="btn-icon disabled:opacity-30"
              title="First page"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Page number pills */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-icon disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="btn-icon disabled:opacity-30"
              title="Last page"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default DataTable;

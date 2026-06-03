import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuditLogs } from '@/services/auditService';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDateTime } from '@/utils/formatters';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';

const ACTION_COLORS = {
  login: 'blue', logout: 'gray', failed_login: 'red',
  create: 'emerald', update: 'amber', delete: 'red',
  restore: 'blue', redeem: 'emerald', approve: 'emerald',
  reject: 'red', suspend: 'orange', generate: 'blue', validate: 'blue',
};

function AuditLogPage() {
  const [moduleFilter, setModuleFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', moduleFilter, actionFilter],
    queryFn: () => getAuditLogs({ pageSize: 100, filters: { module: moduleFilter || undefined, action: actionFilter || undefined } }),
    staleTime: 60 * 1000,
  });

  const columns = useMemo(() => [
    { key: 'createdAt', label: 'Timestamp', render: (val) => <span className="text-xs font-mono text-slate-500">{formatDateTime(val)}</span> },
    { key: 'userName', label: 'User', searchable: true, render: (val, row) => <div><p className="font-medium text-sm">{val}</p><p className="text-xs text-slate-400">{row.userEmail}</p></div> },
    { key: 'userRole', label: 'Role', render: (val) => <StatusBadge status={val === 'super_admin' ? 'emerald' : val === 'admin' ? 'blue' : 'gray'} label={val?.replace('_', ' ')} /> },
    { key: 'action', label: 'Action', render: (val) => <StatusBadge status={ACTION_COLORS[val] || 'gray'} label={val?.replace('_', ' ')} /> },
    { key: 'module', label: 'Module', render: (val) => <span className="capitalize text-sm">{val}</span> },
    { key: 'divisionName', label: 'Division' },
    { key: 'metadata', label: 'Details', sortable: false, render: (val) => val ? <span className="text-xs text-slate-400 line-clamp-1">{JSON.stringify(val).substring(0, 60)}</span> : '-' },
  ], []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">System activity and event tracking</p></div>
        <div className="flex items-center gap-3">
          <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="input-field py-2 text-sm w-36">
            <option value="">All Modules</option>
            {Object.values(AUDIT_MODULES).map((m) => <option key={m} value={m} className="capitalize">{m}</option>)}
          </select>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="input-field py-2 text-sm w-36">
            <option value="">All Actions</option>
            {Object.values(AUDIT_ACTIONS).map((a) => <option key={a} value={a} className="capitalize">{a.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>
      <DataTable data={data?.logs || []} columns={columns} isLoading={isLoading} searchPlaceholder="Search logs..." exportFilename="audit_logs" emptyTitle="No logs found" emptyDescription="Activity will appear here as users interact with the system." />
    </div>
  );
}

export default AuditLogPage;

import { memo } from 'react';
import { Inbox } from 'lucide-react';

const EmptyState = memo(function EmptyState({
  icon: Icon = Inbox,
  title = 'No data found',
  description = 'There are no records to display.',
  action,
  actionLabel,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 text-center max-w-sm mb-6">{description}</p>
      {action && (
        <button onClick={action} className="btn-primary">
          {actionLabel || 'Create New'}
        </button>
      )}
    </div>
  );
});

export default EmptyState;

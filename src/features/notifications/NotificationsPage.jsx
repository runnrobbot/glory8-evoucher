import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, Check, CheckCheck, Info, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { getNotifications, markAsRead, markAllAsRead } from '@/services/notificationService';
import useAuthStore from '@/store/authStore';
import useNotificationStore from '@/store/notificationStore';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { formatRelativeTime } from '@/utils/formatters';
import { toastSuccess } from '@/components/ui/Toast';

const TYPE_ICONS = { info: Info, success: CheckCircle, warning: AlertTriangle, error: AlertCircle };
const TYPE_COLORS = { info: 'text-blue-500 bg-blue-50', success: 'text-emerald-500 bg-emerald-50', warning: 'text-amber-500 bg-amber-50', error: 'text-red-500 bg-red-50' };

function NotificationsPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { setUnreadCount } = useNotificationStore();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', userProfile?.uid],
    queryFn: () => getNotifications(userProfile?.uid, { pageSize: 50 }),
    enabled: !!userProfile?.uid,
    staleTime: 30 * 1000,
  });

  const handleMarkRead = useCallback(async (id) => {
    await markAsRead(id);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const handleMarkAllRead = useCallback(async () => {
    if (!userProfile?.uid) return;
    await markAllAsRead(userProfile.uid);
    setUnreadCount(0);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toastSuccess('All notifications marked as read');
  }, [userProfile, setUnreadCount, queryClient]);

  if (isLoading) return <LoadingSpinner fullPage />;

  const notifications = data?.notifications || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Notifications</h1><p className="page-subtitle">Stay updated with system events</p></div>
        {notifications.some((n) => !n.isRead) && (
          <button onClick={handleMarkAllRead} className="btn-secondary"><CheckCheck className="w-4 h-4" /> Mark all read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications" description="You're all caught up!" />
      ) : (
        <div className="max-w-3xl space-y-2">
          {notifications.map((notif, idx) => {
            const Icon = TYPE_ICONS[notif.type] || Info;
            const colorClass = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.03 }}
                className={`card p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-all ${!notif.isRead ? 'border-l-4 border-l-primary-500' : ''}`}
                onClick={() => !notif.isRead && handleMarkRead(notif.id)}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!notif.isRead ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>{notif.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{notif.message}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                </div>
                {!notif.isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary-500 flex-shrink-0 mt-1.5" />
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default NotificationsPage;

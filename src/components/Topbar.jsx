import { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Menu, Bell, Search, LogOut, User, ChevronDown, Settings,
  Info, CheckCircle, AlertTriangle, AlertCircle, Check, CheckCheck,
} from 'lucide-react';
import useAuthStore from '@/store/authStore';
import useUIStore from '@/store/uiStore';
import useNotificationStore from '@/store/notificationStore';
import { logoutUser } from '@/services/userService';
import { subscribeToNotifications, markAsRead, markAllAsRead } from '@/services/notificationService';
import { getInitials, formatRelativeTime } from '@/utils/formatters';
import { ROLE_LABELS } from '@/utils/constants';
import { toastSuccess, toastError } from './ui/Toast';

const TYPE_ICONS = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const TYPE_COLORS = {
  info: 'text-blue-500 bg-blue-50',
  success: 'text-emerald-500 bg-emerald-50',
  warning: 'text-amber-500 bg-amber-50',
  error: 'text-red-500 bg-red-50',
};

function Topbar() {
  const navigate = useNavigate();
  const { user, userProfile, logout: storeLogout } = useAuthStore();
  const { toggleMobileSidebar, toggleGlobalSearch } = useUIStore();
  const { unreadCount, setUnreadCount } = useNotificationStore();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const userMenuRef = useRef(null);
  const notifRef = useRef(null);

  // Stable uid primitive — avoids Firestore listener churn when userProfile object ref changes
  const uid = userProfile?.uid ?? null;

  // ── Real-time unread notification subscription ───────────────────────────
  useEffect(() => {
    if (!uid) return;

    const unsubscribe = subscribeToNotifications(uid, (notifs) => {
      setNotifications(notifs);
      setUnreadCount(notifs.length);
    });

    return () => unsubscribe();
  }, [uid, setUnreadCount]);

  // ── Close menus on outside click ─────────────────────────────────────────
  useEffect(() => {
    const handleClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await logoutUser(userProfile);
      storeLogout();
      toastSuccess('Logged out successfully');
      navigate('/login');
    } catch (error) {
      toastError(error.message);
    }
  }, [userProfile, storeLogout, navigate]);

  const handleMarkRead = useCallback(async (id) => {
    await markAsRead(id);
    // Listener will re-fire and update state automatically
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!uid) return;
    await markAllAsRead(uid);
    setUnreadCount(0);
    toastSuccess('All notifications marked as read');
  }, [uid, setUnreadCount]);

  return (
    <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-slate-100">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={toggleMobileSidebar} className="btn-icon lg:hidden">
            <Menu className="w-5 h-5" />
          </button>

          {/* Search trigger */}
          <button
            onClick={toggleGlobalSearch}
            className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-sm text-slate-400 transition-colors min-w-[240px]"
          >
            <Search className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] font-medium bg-white text-slate-400 px-1.5 py-0.5 rounded border border-slate-200">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">

          {/* ── Notification Bell Dropdown ─────────────────────────────── */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifDropdown((v) => !v)}
              className="btn-icon relative"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </motion.span>
              )}
            </button>

            <AnimatePresence>
              {showNotifDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-semibold text-slate-800">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-2 text-xs font-normal text-primary-600 bg-primary-50 rounded-full px-2 py-0.5">
                          {unreadCount} unread
                        </span>
                      )}
                    </p>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllRead}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <CheckCheck className="w-3 h-3" /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* List */}
                  <div className="max-h-[360px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">You're all caught up!</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const Icon = TYPE_ICONS[notif.type] || Info;
                        const color = TYPE_COLORS[notif.type] || TYPE_COLORS.info;
                        return (
                          <button
                            key={notif.id}
                            onClick={() => handleMarkRead(notif.id)}
                            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50 last:border-0"
                          >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{notif.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                              <p className="text-[10px] text-slate-400 mt-1">{formatRelativeTime(notif.createdAt)}</p>
                            </div>
                            <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-slate-100 p-2">
                    <button
                      onClick={() => { setShowNotifDropdown(false); navigate('/notifications'); }}
                      className="w-full text-center text-xs text-primary-600 hover:text-primary-700 font-medium py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      View all notifications
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── User Menu ──────────────────────────────────────────────── */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center text-white text-xs font-bold">
                {getInitials(userProfile?.displayName)}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-slate-800 leading-tight">
                  {userProfile?.displayName || 'User'}
                </p>
                <p className="text-[11px] text-slate-400">
                  {ROLE_LABELS[userProfile?.role] || userProfile?.role}
                </p>
              </div>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50"
                >
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-800">{userProfile?.displayName}</p>
                    <p className="text-xs text-slate-400">{userProfile?.email}</p>
                  </div>
                  <button
                    onClick={() => { setShowUserMenu(false); navigate('/settings'); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                  <div className="border-t border-slate-100 mt-1 pt-1">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="w-4 h-4" /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Topbar;

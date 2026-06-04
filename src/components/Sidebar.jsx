import { memo, useCallback, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Building2, Megaphone, Ticket, ScanLine,
  BarChart3, ScrollText, Settings, ChevronLeft,
  CreditCard, X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import useAuthStore from '@/store/authStore';
import useUIStore from '@/store/uiStore';
import { PERMISSIONS } from '@/utils/constants';
import { getSettings } from '@/services/settingsService';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, path: '/', permission: null },
  { label: 'Campaigns', icon: Megaphone, path: '/campaigns', permission: 'campaigns.view' },
  { label: 'Vouchers', icon: Ticket, path: '/vouchers', permission: 'vouchers.view' },
  { label: 'Validate', icon: ScanLine, path: '/validate', permission: 'vouchers.validate' },
  { label: 'Redemptions', icon: CreditCard, path: '/redemptions', permission: 'vouchers.redeem' },
  { type: 'divider' },
  { label: 'Users', icon: Users, path: '/users', permission: 'users.view' },
  { label: 'Divisions', icon: Building2, path: '/divisions', permission: 'divisions.view' },
  { type: 'divider' },
  { label: 'Analytics', icon: BarChart3, path: '/analytics', permission: 'analytics.view' },
  { label: 'Audit Logs', icon: ScrollText, path: '/audit-logs', permission: 'audit.view' },
  { type: 'divider' },
  { label: 'Settings', icon: Settings, path: '/settings', permission: 'settings.view' },
];

const SidebarLink = memo(function SidebarLink({ item, isCollapsed }) {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
      title={isCollapsed ? item.label : undefined}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!isCollapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="truncate"
        >
          {item.label}
        </motion.span>
      )}
    </NavLink>
  );
});

function Sidebar() {
  const { userProfile } = useAuthStore();
  const { sidebarOpen, sidebarMobileOpen, toggleSidebar, closeMobileSidebar } = useUIStore();
  const location = useLocation();

  // Fetch company logo from settings, fallback to static asset
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 10 * 60 * 1000,
  });
  const logoSrc = settings?.companyLogo || '/logo-utama.png';

  // Close mobile sidebar on navigation
  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname, closeMobileSidebar]);

  const filteredItems = NAV_ITEMS.filter((item) => {
    if (item.type === 'divider') return true;
    if (!item.permission) return true;
    if (!userProfile?.role) return false;
    const perms = PERMISSIONS[userProfile.role] || [];
    return perms.includes(item.permission);
  });

  // Remove consecutive/leading/trailing dividers
  const cleanItems = filteredItems.filter((item, idx, arr) => {
    if (item.type !== 'divider') return true;
    if (idx === 0 || idx === arr.length - 1) return false;
    if (arr[idx - 1]?.type === 'divider') return false;
    return true;
  });

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 h-16 border-b border-slate-100 flex-shrink-0 ${sidebarOpen ? '' : 'justify-center'}`}>
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center bg-white">
          <img
            src={logoSrc}
            alt="Glory8 Logo"
            className="w-9 h-9 object-contain"
            onError={(e) => { e.target.src = '/logo-utama.png'; }}
          />
        </div>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="text-base font-bold text-slate-900 leading-tight">GLORY8</h1>
            <p className="text-[10px] font-semibold text-primary-600 uppercase tracking-widest">E-Voucher</p>
          </motion.div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide px-3 py-4 space-y-1">
        {cleanItems.map((item, idx) => {
          if (item.type === 'divider') {
            return <div key={`div-${idx}`} className="h-px bg-slate-100 my-3" />;
          }
          return <SidebarLink key={item.path} item={item} isCollapsed={!sidebarOpen} />;
        })}
      </nav>

      {/* Collapse Button (Desktop only) */}
      <div className="hidden lg:block border-t border-slate-100 p-3">
        <button
          onClick={toggleSidebar}
          className="sidebar-link w-full justify-center"
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ChevronLeft className={`w-5 h-5 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} />
          {sidebarOpen && <span>Collapse</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 256 : 72 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="hidden lg:flex flex-col bg-white border-r border-slate-100 h-screen sticky top-0 z-30"
      >
        {sidebarContent}
      </motion.aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
              onClick={closeMobileSidebar}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-white shadow-2xl z-50 lg:hidden"
            >
              <button
                onClick={closeMobileSidebar}
                className="absolute top-4 right-4 btn-icon"
              >
                <X className="w-5 h-5" />
              </button>
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default Sidebar;

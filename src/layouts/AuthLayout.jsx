import { Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';

function AuthLayout() {
  return (
    <div className="min-h-screen flex gradient-mesh">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-2/5 gradient-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-accent-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="relative z-10 text-center"
        >
          {/* Company Logo */}
          <div className="w-24 h-24 bg-white rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-black/20 p-2">
            <img src="/logo-utama.png" alt="Glory8 Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">GLORY8</h1>
          <div className="w-16 h-1 bg-accent-400 rounded-full mx-auto mb-4" />
          <p className="text-lg font-medium text-white/80 mb-2">E-Voucher Platform</p>
          <p className="text-sm text-white/50 max-w-sm">
            Enterprise voucher management system for campaign creation, voucher generation, validation, and redemption.
          </p>
        </motion.div>

        {/* Stats decoration */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="relative z-10 grid grid-cols-3 gap-6 mt-16"
        >
          {[
            { label: 'Campaigns', value: '∞' },
            { label: 'Vouchers', value: '∞' },
            { label: 'Secure', value: '100%' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-xs text-white/50 mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-slate-200 p-2">
              <img src="/logo-utama.png" alt="Glory8 Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">GLORY8</h1>
            <p className="text-xs font-semibold text-primary-600 uppercase tracking-widest">E-Voucher</p>
          </div>

          <Outlet />
        </motion.div>
      </div>
    </div>
  );
}

export default AuthLayout;

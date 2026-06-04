import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, UserPlus, Mail, Lock, User } from 'lucide-react';
import { bootstrapSchema } from '@/utils/validators';
import { bootstrapSuperAdmin } from '@/services/userService';
import { initializeSettings } from '@/services/settingsService';
import useAuthStore from '@/store/authStore';
import { toastSuccess, toastError } from '@/components/ui/Toast';

function BootstrapPage() {
  const navigate = useNavigate();
  const { setUserProfile, setIsBootstrapped } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(bootstrapSchema),
  });

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Create super admin
      const profile = await bootstrapSuperAdmin({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
      });

      // Initialize settings
      await initializeSettings({
        companyName: 'Ur8an',
        voucherPrefix: 'UR8',
      });

      setUserProfile(profile);
      setIsBootstrapped(true);
      toastSuccess('System initialized!', 'Super Admin account created successfully.');
      navigate('/');
    } catch (error) {
      let message = 'Setup failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      }
      toastError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, navigate, setUserProfile, setIsBootstrapped]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm border border-slate-100">
            <img src="/logo-utama.png" alt="Ur8an" className="w-6 h-6 object-contain" />
          </div>
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">Initial Setup</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900">Create Super Admin</h2>
        <p className="text-slate-500 mt-1">
          Set up the first administrator account for your organization.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label htmlFor="bootstrap-name" className="input-label">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('displayName')}
              id="bootstrap-name"
              type="text"
              placeholder="John Doe"
              className="input-field pl-10"
            />
          </div>
          {errors.displayName && <p className="input-error">{errors.displayName.message}</p>}
        </div>

        <div>
          <label htmlFor="bootstrap-email" className="input-label">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('email')}
              id="bootstrap-email"
              type="email"
              placeholder="admin@ur8an.com"
              className="input-field pl-10"
            />
          </div>
          {errors.email && <p className="input-error">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="bootstrap-password" className="input-label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('password')}
              id="bootstrap-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-field pl-10 pr-10"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="input-error">{errors.password.message}</p>}
        </div>

        <div>
          <label htmlFor="bootstrap-confirm" className="input-label">Confirm Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('confirmPassword')}
              id="bootstrap-confirm"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-field pl-10"
            />
          </div>
          {errors.confirmPassword && <p className="input-error">{errors.confirmPassword.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <UserPlus className="w-4 h-4" /> Initialize System
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

export default BootstrapPage;

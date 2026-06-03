import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, Mail, Lock } from 'lucide-react';
import { loginSchema } from '@/utils/validators';
import { loginUser } from '@/services/userService';
import useAuthStore from '@/store/authStore';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { logAudit } from '@/utils/auditLogger';
import { AUDIT_ACTIONS, AUDIT_MODULES } from '@/utils/constants';

function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setUserProfile } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const profile = await loginUser(data.email, data.password);
      setUserProfile(profile);
      toastSuccess('Welcome back!', `Logged in as ${profile.displayName}`);
      navigate('/');
    } catch (error) {
      let message = 'Login failed. Please check your credentials.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        message = 'Invalid email or password.';
      } else if (error.code === 'auth/too-many-requests') {
        message = 'Too many attempts. Please try again later.';
      } else if (error.message) {
        message = error.message;
      }

      toastError(message);

      // Log failed login
      await logAudit({
        user: { uid: 'unknown', displayName: 'Unknown', email: data.email, role: '', divisionId: '', divisionName: '' },
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        module: AUDIT_MODULES.AUTH,
        metadata: { email: data.email, error: message },
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, navigate, setUser, setUserProfile]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
        <p className="text-slate-500 mt-1">Sign in to your account to continue</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Email */}
        <div>
          <label htmlFor="login-email" className="input-label">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('email')}
              id="login-email"
              type="email"
              placeholder="nama@glory.com"
              className="input-field pl-10"
              autoComplete="email"
            />
          </div>
          {errors.email && <p className="input-error">{errors.email.message}</p>}
        </div>

        {/* Password */}
        <div>
          <label htmlFor="login-password" className="input-label">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              {...register('password')}
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="input-field pl-10 pr-10"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="input-error">{errors.password.message}</p>}
        </div>

        {/* Forgot Password */}
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            Forgot password?
          </Link>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full py-3"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              Sign In
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

export default LoginPage;

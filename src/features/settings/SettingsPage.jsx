import { useState, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { getSettings, updateSettings } from '@/services/settingsService';
import { settingsSchema } from '@/utils/validators';
import ImagePositionPicker from '@/components/ui/ImagePositionPicker';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { uploadToCloudinary, UPLOAD_FOLDERS } from '@/lib/cloudinary';
import { motion } from 'framer-motion';

const DEFAULT_LOGO = { url: '', posX: 50, posY: 50 };

function SettingsPage() {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 10 * 60 * 1000,
  });

  // ── Logo state — OUTSIDE react-hook-form to bypass Zod stripping ──────────
  const [logoState, setLogoState] = useState(DEFAULT_LOGO);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(settingsSchema),
    values: settings
      ? { companyName: settings.companyName, voucherPrefix: settings.voucherPrefix }
      : undefined,
  });

  // Restore saved logo state once settings load
  useEffect(() => {
    if (settings) {
      setLogoState({
        url: settings.companyLogo || '',
        posX: settings.logoPositionX ?? 50,
        posY: settings.logoPositionY ?? 50,
      });
    }
  }, [settings]);

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      // Read logo from separate state — NOT from Zod-parsed data
      const enriched = {
        ...data,
        companyLogo: logoState.url || null,
        logoPositionX: logoState.posX ?? 50,
        logoPositionY: logoState.posY ?? 50,
      };
      await updateSettings(enriched);
      toastSuccess('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (error) { toastError(error.message); } finally { setIsSubmitting(false); }
  }, [isSubmitting, queryClient, logoState]);

  if (isLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Settings</h1><p className="page-subtitle">System configuration</p></div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-primary-600" />
            </div>
            <div><h3 className="font-semibold text-slate-900">General Settings</h3><p className="text-sm text-slate-500">Configure system-wide settings</p></div>
          </div>

          <div>
            <label className="input-label">Company Name</label>
            <input {...register('companyName')} className="input-field" />
            {errors.companyName && <p className="input-error">{errors.companyName.message}</p>}
          </div>

          <div>
            <label className="input-label">Company Logo</label>
            <ImagePositionPicker
              value={logoState}
              onChange={setLogoState}
              aspectRatio="1/1"
              label="Upload Logo"
              onUpload={async (file) => {
                const res = await uploadToCloudinary(file, { folder: UPLOAD_FOLDERS.COMPANY_LOGO });
                return res.url;
              }}
            />
          </div>

          <div>
            <label className="input-label">Voucher Code Prefix</label>
            <input {...register('voucherPrefix')} className="input-field max-w-[200px]" placeholder="GL8" />
            {errors.voucherPrefix && <p className="input-error">{errors.voucherPrefix.message}</p>}
            <p className="text-xs text-slate-400 mt-1">Voucher codes will be formatted as: PREFIX-YEAR-SEQUENCE</p>
          </div>

          {settings && (
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-sm text-slate-500">Last Voucher Sequence: <span className="font-mono font-bold text-slate-800">{settings.lastVoucherSequence || 0}</span></p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default SettingsPage;

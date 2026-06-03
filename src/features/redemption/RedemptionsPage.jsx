import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ScanLine, CreditCard, CheckCircle } from 'lucide-react';
import { validateVoucher } from '@/services/voucherService';
import { redeemVoucher, getRedeems } from '@/services/redeemService';
import useAuthStore from '@/store/authStore';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { redeemSchema } from '@/utils/validators';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { toastSuccess, toastError } from '@/components/ui/Toast';

function RedemptionsPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const [step, setStep] = useState('code'); // code -> validate -> redeem -> success
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [redeemResult, setRedeemResult] = useState(null);

  const { data: redeemsData, isLoading } = useQuery({
    queryKey: ['redeems'],
    queryFn: () => getRedeems({ pageSize: 100 }),
    staleTime: 2 * 60 * 1000,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(redeemSchema),
  });

  const handleValidate = useCallback(async (e) => {
    e.preventDefault();
    if (!code.trim() || isValidating) return;
    setIsValidating(true);
    try {
      const res = await validateVoucher(code.trim());
      setValidationResult(res);
      if (res.valid) {
        setStep('redeem');
        reset({ customerName: '', transactionNumber: '', purchaseAmount: '', notes: '' });
      } else {
        toastError(res.message);
      }
    } catch (error) { toastError(error.message); } finally { setIsValidating(false); }
  }, [code, isValidating, reset]);

  const handleRedeem = useCallback(async (data) => {
    if (isRedeeming || !validationResult?.voucher) return;
    setIsRedeeming(true);
    try {
      const result = await redeemVoucher(validationResult.voucher.id, data, userProfile);
      setRedeemResult(result);
      setStep('success');
      toastSuccess('Voucher redeemed successfully!');
      queryClient.invalidateQueries({ queryKey: ['redeems'] });
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    } catch (error) { toastError(error.message); } finally { setIsRedeeming(false); }
  }, [isRedeeming, validationResult, userProfile, queryClient]);

  const resetFlow = useCallback(() => {
    setStep('code');
    setCode('');
    setValidationResult(null);
    setRedeemResult(null);
  }, []);

  const columns = useMemo(() => [
    { key: 'voucherCode', label: 'Voucher Code', searchable: true, render: (val) => <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{val}</span> },
    { key: 'customerName', label: 'Customer', searchable: true },
    { key: 'transactionNumber', label: 'Transaction', searchable: true },
    { key: 'purchaseAmount', label: 'Amount', render: (val) => formatCurrency(val) },
    { key: 'discountApplied', label: 'Discount', render: (val) => <span className="text-emerald-600 font-medium">{formatCurrency(val)}</span> },
    { key: 'campaignName', label: 'Campaign' },
    { key: 'redeemedByName', label: 'Redeemed By' },
    { key: 'redeemedAt', label: 'Date', render: (val) => formatDateTime(val) },
  ], []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Redemptions</h1><p className="page-subtitle">Redeem vouchers and view history</p></div>
      </div>

      {/* Redeem Flow */}
      <div className="max-w-2xl mx-auto mb-8">
        {step === 'code' && (
          <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleValidate} className="card p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Redeem Voucher</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter voucher code" className="input-field pl-11 py-3 font-mono" autoFocus />
              </div>
              <button type="submit" disabled={!code.trim() || isValidating} className="btn-primary px-6">
                {isValidating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Validate'}
              </button>
            </div>
          </motion.form>
        )}

        {step === 'redeem' && validationResult?.voucher && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-500" />
                <div>
                  <p className="font-semibold text-emerald-800">Valid Voucher: {validationResult.voucher.code}</p>
                  <p className="text-sm text-emerald-600">{validationResult.voucher.name} — {validationResult.voucher.discountType === 'percentage' ? `${validationResult.voucher.value}%` : formatCurrency(validationResult.voucher.value)} off</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit(handleRedeem)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="input-label">Customer Name</label><input {...register('customerName')} className="input-field" placeholder="Customer name" />{errors.customerName && <p className="input-error">{errors.customerName.message}</p>}</div>
                <div><label className="input-label">Transaction Number</label><input {...register('transactionNumber')} className="input-field" placeholder="TRX-001" />{errors.transactionNumber && <p className="input-error">{errors.transactionNumber.message}</p>}</div>
              </div>
              <div><label className="input-label">Purchase Amount (Rp)</label><input {...register('purchaseAmount')} type="number" className="input-field" placeholder="100000" />{errors.purchaseAmount && <p className="input-error">{errors.purchaseAmount.message}</p>}</div>
              <div><label className="input-label">Notes (optional)</label><textarea {...register('notes')} className="input-field" rows={2} /></div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={resetFlow} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isRedeeming} className="btn-primary flex-1">
                  {isRedeeming ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Redeem
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'success' && redeemResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card p-8 text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }} className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-500" />
            </motion.div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Voucher Redeemed!</h3>
            <p className="text-slate-500 mb-4">Discount of {formatCurrency(redeemResult.discountApplied)} applied</p>
            <div className="bg-slate-50 rounded-xl p-4 text-left text-sm space-y-1 mb-6">
              <p><span className="text-slate-500">Customer:</span> {redeemResult.customerName}</p>
              <p><span className="text-slate-500">Transaction:</span> {redeemResult.transactionNumber}</p>
              <p><span className="text-slate-500">Amount:</span> {formatCurrency(redeemResult.purchaseAmount)}</p>
              <p><span className="text-slate-500">Discount:</span> <span className="text-emerald-600 font-semibold">{formatCurrency(redeemResult.discountApplied)}</span></p>
            </div>
            <button onClick={resetFlow} className="btn-primary">Redeem Another</button>
          </motion.div>
        )}
      </div>

      {/* Redeem History */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Redemption History</h3>
        <DataTable data={redeemsData?.redeems || []} columns={columns} isLoading={isLoading} searchPlaceholder="Search redemptions..." exportFilename="redemptions" emptyTitle="No redemptions yet" emptyDescription="Redeem your first voucher above." />
      </div>
    </div>
  );
}

export default RedemptionsPage;

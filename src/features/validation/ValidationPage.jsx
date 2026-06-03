import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Search, CheckCircle, XCircle, AlertCircle, Clock, Camera, Keyboard } from 'lucide-react';
import { validateVoucher } from '@/services/voucherService';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatDate, formatCurrency } from '@/utils/formatters';
import { toastError } from '@/components/ui/Toast';

function ValidationPage() {
  const [mode, setMode] = useState('code'); // 'code' | 'scan'
  const [code, setCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);
  const html5QrCodeRef = useRef(null);

  const handleValidate = useCallback(async (voucherCode) => {
    if (!voucherCode?.trim() || isValidating) return;
    setIsValidating(true);
    setResult(null);

    try {
      const res = await validateVoucher(voucherCode.trim());
      setResult(res);
    } catch (error) {
      toastError(error.message);
    } finally {
      setIsValidating(false);
    }
  }, [isValidating]);

  const handleCodeSubmit = useCallback((e) => {
    e.preventDefault();
    handleValidate(code);
  }, [code, handleValidate]);

  // QR Scanner
  useEffect(() => {
    if (mode !== 'scan') {
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
        html5QrCodeRef.current = null;
      }
      return;
    }

    let scanner = null;

    const initScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        scanner = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            handleValidate(decodedText);
            scanner.stop().catch(() => {});
          },
          () => {},
        );
      } catch (error) {
        toastError('Camera access denied or not available');
        setMode('code');
      }
    };

    initScanner();

    return () => {
      if (scanner) {
        scanner.stop().catch(() => {});
      }
    };
  }, [mode, handleValidate]);

  const resultConfig = {
    valid: { icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Valid Voucher' },
    invalid: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200', label: 'Invalid Voucher' },
    expired: { icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Expired Voucher' },
    used: { icon: AlertCircle, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-200', label: 'Used Voucher' },
    suspended: { icon: XCircle, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Suspended' },
    campaign_inactive: { icon: AlertCircle, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', label: 'Campaign Inactive' },
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1 className="page-title">Validate Voucher</h1><p className="page-subtitle">Verify voucher code or scan QR</p></div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-xl">
          <button onClick={() => setMode('code')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'code' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <Keyboard className="w-4 h-4" /> Enter Code
          </button>
          <button onClick={() => setMode('scan')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${mode === 'scan' ? 'bg-white shadow-sm text-primary-700' : 'text-slate-500 hover:text-slate-700'}`}>
            <Camera className="w-4 h-4" /> Scan QR
          </button>
        </div>

        {/* Code Input */}
        {mode === 'code' && (
          <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleCodeSubmit} className="card p-6 mb-6">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter voucher code (e.g., GL8-2026-000001)"
                  className="input-field pl-11 py-3 text-lg font-mono tracking-wider"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={!code.trim() || isValidating} className="btn-primary px-6 py-3">
                {isValidating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
          </motion.form>
        )}

        {/* QR Scanner */}
        {mode === 'scan' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6 mb-6">
            <div id="qr-reader" ref={scannerRef} className="rounded-xl overflow-hidden" />
            <p className="text-sm text-slate-500 text-center mt-3">Point your camera at a QR code</p>
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence mode="wait">
          {result && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className={`card p-6 border-2 ${resultConfig[result.result]?.border || 'border-slate-200'}`}>
              <div className="flex items-center gap-4 mb-4">
                {(() => {
                  const config = resultConfig[result.result] || resultConfig.invalid;
                  const Icon = config.icon;
                  return (
                    <>
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${config.bg}`}>
                        <Icon className={`w-7 h-7 ${config.color}`} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{config.label}</h3>
                        <p className="text-sm text-slate-500">{result.message}</p>
                      </div>
                    </>
                  );
                })()}
              </div>
              {result.voucher && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Code:</span> <span className="font-mono font-bold">{result.voucher.code}</span></div>
                    <div><span className="text-slate-500">Name:</span> {result.voucher.name}</div>
                    <div><span className="text-slate-500">Value:</span> {result.voucher.discountType === 'percentage' ? `${result.voucher.value}%` : formatCurrency(result.voucher.value)}</div>
                    <div><span className="text-slate-500">Status:</span> <StatusBadge status={result.voucher.status} /></div>
                    <div><span className="text-slate-500">Campaign:</span> {result.voucher.campaignName}</div>
                    <div><span className="text-slate-500">Remaining:</span> {result.voucher.remainingUsage}/{result.voucher.usageLimit}</div>
                    <div><span className="text-slate-500">Min Purchase:</span> {formatCurrency(result.voucher.minPurchase)}</div>
                    <div><span className="text-slate-500">Expires:</span> {formatDate(result.voucher.expiredDate)}</div>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default ValidationPage;

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Layers, Copy, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher, bulkGenerateVouchers } from '@/services/voucherService';
import { getActiveCampaigns } from '@/services/campaignService';
import { getSettings } from '@/services/settingsService';
import useAuthStore from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import ImagePositionPicker from '@/components/ui/ImagePositionPicker';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { voucherSchema, bulkGenerateSchema } from '@/utils/validators';
import { VOUCHER_STATUS_LABELS } from '@/utils/constants';
import { formatDate, formatCurrency, getExpirationLabel } from '@/utils/formatters';
import { copyToClipboard } from '@/utils/exportUtils';
import { uploadToCloudinary, UPLOAD_FOLDERS } from '@/lib/cloudinary';

// ─────────────────────────────────────────────────────────────────────────────
// Build a clean, plain-text WhatsApp message for a voucher.
// No decorative emoji (avoids broken-glyph rendering) and no WhatsApp markdown
// markers (*bold* / _italic_) — those showed up literally for the recipient.
// ─────────────────────────────────────────────────────────────────────────────
function buildVoucherMessage(voucher) {
  const value = voucher.discountType === 'percentage'
    ? `${voucher.value}%`
    : `Rp ${Number(voucher.value).toLocaleString('id-ID')}`;
  const expiry = voucher.expiredDate?.toDate
    ? voucher.expiredDate.toDate().toLocaleDateString('id-ID')
    : new Date(voucher.expiredDate).toLocaleDateString('id-ID');

  return [
    voucher.name,
    ``,
    `Diskon: ${value}`,
    `Kode: ${voucher.code}`,
    `Berlaku s.d.: ${expiry}`,
    voucher.description ? `\n${voucher.description}` : '',
    voucher.terms ? `\n${voucher.terms}` : '',
  ].filter(Boolean).join('\n');
}

// Normalize an Indonesian phone number to wa.me international format (no +, no
// leading 0; local "08xx" → "628xx"). Returns '' if no digits remain.
function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return digits;
}

// ─────────────────────────────────────────────────────────────────────────────
// Default background state
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_BG = { url: '', posX: 50, posY: 50 };

// ─────────────────────────────────────────────────────────────────────────────
// Shared voucher form fields (NO <form> wrapper — parent provides it).
//
// KEY FIX: The background image state is managed OUTSIDE react-hook-form using
// a plain useState. This is necessary because Zod strips unknown fields before
// the onSubmit handler receives them, so Controller('voucherBackground') would
// always deliver an empty value. The parent passes bgState + setBgState as props.
// ─────────────────────────────────────────────────────────────────────────────
function VoucherFields({ register, errors, campaigns, bgState, setBgState }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Voucher Name</label>
          <input {...register('name')} className="input-field" placeholder="Discount 20%" />
          {errors.name && <p className="input-error">{errors.name.message}</p>}
        </div>
        <div>
          <label className="input-label">Campaign</label>
          <select {...register('campaignId')} className="input-field">
            <option value="">— Select Campaign —</option>
            {campaigns.length === 0 && <option disabled>No campaigns available</option>}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.status})</option>
            ))}
          </select>
          {errors.campaignId && <p className="input-error">{errors.campaignId.message}</p>}
        </div>
      </div>

      <div>
        <label className="input-label">Description</label>
        <textarea {...register('description')} className="input-field" rows={2} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="input-label">Value</label>
          <input {...register('value')} type="number" className="input-field" />
          {errors.value && <p className="input-error">{errors.value.message}</p>}
        </div>
        <div>
          <label className="input-label">Discount Type</label>
          <select {...register('discountType')} className="input-field">
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed Amount (Rp)</option>
          </select>
        </div>
        <div>
          <label className="input-label">Usage Limit</label>
          <input {...register('usageLimit')} type="number" className="input-field" />
          {errors.usageLimit && <p className="input-error">{errors.usageLimit.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Start Date</label>
          <input {...register('startDate')} type="date" className="input-field" />
          {errors.startDate && <p className="input-error">{errors.startDate.message}</p>}
        </div>
        <div>
          <label className="input-label">Expired Date</label>
          <input {...register('expiredDate')} type="date" className="input-field" />
          {errors.expiredDate && <p className="input-error">{errors.expiredDate.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="input-label">Min Purchase (Rp)</label>
          <input {...register('minPurchase')} type="number" className="input-field" />
        </div>
        <div>
          <label className="input-label">Max Discount (Rp)</label>
          <input {...register('maxDiscount')} type="number" className="input-field" />
        </div>
      </div>

      <div>
        <label className="input-label">Terms & Conditions</label>
        <textarea {...register('terms')} className="input-field" rows={2} placeholder="Terms and conditions..." />
      </div>

      {/* ── Background Image (state lives outside RHF to bypass Zod stripping) */}
      <div>
        <label className="input-label flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-slate-400" />
          Voucher Background Image
          <span className="text-xs font-normal text-slate-400">(opsional — tampil sebagai background voucher)</span>
        </label>
        <ImagePositionPicker
          value={bgState}
          onChange={setBgState}
          aspectRatio="16/7"
          label="Upload Background"
          onUpload={async (file) => {
            const res = await uploadToCloudinary(file, { folder: UPLOAD_FOLDERS.VOUCHER_BACKGROUND });
            return res.url;
          }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
function VouchersPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { checkPermission } = usePermission();

  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showPreview, setShowPreview] = useState(null);
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [deletingVoucher, setDeletingVoucher] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');

  // ── WhatsApp share — reveal phone field, then open wa.me on submit ────────
  const [showWaField, setShowWaField] = useState(false);
  const [waPhone, setWaPhone] = useState('');

  // ── Background state — OUTSIDE react-hook-form to bypass Zod stripping ───
  // BUG FIX: Zod's .parse() strips keys not declared in the schema, so any
  // Controller field named 'voucherBackground' (not in schema) is lost before
  // onSubmit fires. These two separate useState values are read directly in
  // the submit handlers, bypassing Zod entirely.
  const [singleBg, setSingleBg] = useState(DEFAULT_BG);  // single voucher form
  const [bulkBg, setBulkBg] = useState(DEFAULT_BG);      // bulk generate form

  // ── Data queries ────────────────────────────────────────────────────────
  const { data: vouchersData, isLoading } = useQuery({
    queryKey: ['vouchers', statusFilter, campaignFilter],
    queryFn: () => getVouchers({
      pageSize: 100,
      filters: {
        status: statusFilter || undefined,
        campaignId: campaignFilter || undefined,
      },
    }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: ['campaigns-dropdown'],
    queryFn: getActiveCampaigns,
    staleTime: 5 * 60 * 1000,
  });

  // Company logo for voucher preview
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    staleTime: 10 * 60 * 1000,
  });
  const companyLogo = settings?.companyLogo || '/logo-utama.png';

  // ── Single voucher form ──────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(voucherSchema) });

  // ── Bulk generate form ───────────────────────────────────────────────────
  const {
    register: regBulk,
    handleSubmit: handleBulk,
    reset: resetBulk,
    formState: { errors: bulkErrors },
  } = useForm({ resolver: zodResolver(bulkGenerateSchema) });

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditingVoucher(null);
    setSingleBg(DEFAULT_BG);  // reset background state
    reset({
      name: '', campaignId: '', description: '', value: '',
      discountType: 'percentage', terms: '', startDate: '', expiredDate: '',
      usageLimit: 1, minPurchase: 0, maxDiscount: 0,
    });
    setShowForm(true);
  }, [reset]);

  const openEdit = useCallback((v) => {
    setEditingVoucher(v);
    // Restore background state from saved voucher data
    setSingleBg({
      url: v.backgroundUrl || '',
      posX: v.bgPositionX ?? 50,
      posY: v.bgPositionY ?? 50,
    });
    const start = v.startDate?.toDate ? v.startDate.toDate() : new Date(v.startDate);
    const exp = v.expiredDate?.toDate ? v.expiredDate.toDate() : new Date(v.expiredDate);
    reset({
      name: v.name,
      campaignId: v.campaignId,
      description: v.description,
      value: v.value,
      discountType: v.discountType,
      terms: v.terms,
      startDate: start.toISOString().split('T')[0],
      expiredDate: exp.toISOString().split('T')[0],
      usageLimit: v.usageLimit,
      minPurchase: v.minPurchase,
      maxDiscount: v.maxDiscount,
    });
    setShowForm(true);
  }, [reset]);

  const openBulk = useCallback(() => {
    setBulkBg(DEFAULT_BG);  // reset background state
    resetBulk({
      quantity: 10,
      name: '', campaignId: '', description: '', value: '',
      discountType: 'percentage', terms: '', startDate: '', expiredDate: '',
      usageLimit: 1, minPurchase: 0, maxDiscount: 0,
    });
    setShowBulk(true);
  }, [resetBulk]);

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const campaign = campaigns.find((c) => c.id === data.campaignId);
      // Read background from separate state — NOT from Zod-parsed data
      const enriched = {
        ...data,
        campaignName: campaign?.name || '',
        backgroundUrl: singleBg.url || null,
        bgPositionX: singleBg.posX ?? 50,
        bgPositionY: singleBg.posY ?? 50,
      };
      if (editingVoucher) {
        await updateVoucher(editingVoucher.id, enriched, userProfile);
        toastSuccess('Voucher updated');
      } else {
        await createVoucher(enriched, userProfile);
        toastSuccess('Voucher created');
      }
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    } catch (error) {
      toastError(error.message || 'Failed to save voucher');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, editingVoucher, campaigns, userProfile, queryClient, singleBg]);

  const onBulkSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const campaign = campaigns.find((c) => c.id === data.campaignId);
      if (!data.campaignId || !campaign) {
        toastError('Please select a campaign before generating vouchers.');
        setIsSubmitting(false);
        return;
      }
      // Read background from separate state — NOT from Zod-parsed data
      const enriched = {
        ...data,
        campaignName: campaign.name,
        backgroundUrl: bulkBg.url || null,
        bgPositionX: bulkBg.posX ?? 50,
        bgPositionY: bulkBg.posY ?? 50,
      };
      const result = await bulkGenerateVouchers(enriched, Number(data.quantity), userProfile);
      toastSuccess(`Successfully generated ${result.length} vouchers`);
      setShowBulk(false);
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    } catch (error) {
      toastError(error.message || 'Bulk generation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, campaigns, userProfile, queryClient, bulkBg]);

  // Close the preview modal and reset the WhatsApp share field
  const closePreview = useCallback(() => {
    setShowPreview(null);
    setShowWaField(false);
    setWaPhone('');
  }, []);

  // Open WhatsApp to the entered number with the prefilled voucher message.
  // An empty number falls back to the WhatsApp contact picker.
  const sendWhatsApp = useCallback(() => {
    if (!showPreview) return;
    const text = buildVoucherMessage(showPreview);
    const phone = normalizePhone(waPhone);
    const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';
    window.open(`${base}?text=${encodeURIComponent(text)}`, '_blank');
  }, [showPreview, waPhone]);

  const handleDelete = useCallback(async () => {
    if (!deletingVoucher) return;
    try {
      await deleteVoucher(deletingVoucher.id, userProfile);
      toastSuccess('Voucher deleted');
      setDeletingVoucher(null);
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [deletingVoucher, userProfile, queryClient]);

  // ── Table columns ─────────────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: 'code', label: 'Code', searchable: true,
      render: (val) => (
        <button
          onClick={() => { copyToClipboard(val); toastSuccess('Code copied!'); }}
          className="font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg hover:bg-primary-50 hover:text-primary-700 transition-colors"
          title="Click to copy"
        >
          {val}
        </button>
      ),
    },
    { key: 'name', label: 'Name', searchable: true },
    { key: 'campaignName', label: 'Campaign', searchable: true },
    {
      key: 'value', label: 'Value',
      render: (val, row) => row.discountType === 'percentage' ? `${val}%` : formatCurrency(val),
    },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} dot /> },
    {
      key: 'remainingUsage', label: 'Remaining',
      render: (val, row) => `${val}/${row.usageLimit}`,
    },
    {
      key: 'expiredDate', label: 'Expires',
      render: (val) => {
        const exp = getExpirationLabel(val);
        return exp ? <StatusBadge status={exp.variant} label={exp.label} /> : '-';
      },
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => { setShowWaField(false); setWaPhone(''); setShowPreview(row); }} className="btn-icon" title="Preview">
            <Eye className="w-4 h-4" />
          </button>
          {checkPermission('vouchers.edit') && (
            <button onClick={() => openEdit(row)} className="btn-icon" title="Edit">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {checkPermission('vouchers.delete') && (
            <button
              onClick={() => setDeletingVoucher(row)}
              className="btn-icon text-red-500 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ], [openEdit, checkPermission]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Vouchers</h1>
          <p className="page-subtitle">Manage voucher codes</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input-field py-2 text-sm w-36"
          >
            <option value="">All Status</option>
            {Object.entries(VOUCHER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="input-field py-2 text-sm w-48"
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {checkPermission('vouchers.generate') && (
            <button onClick={openBulk} className="btn-secondary">
              <Layers className="w-4 h-4" /> Bulk Generate
            </button>
          )}
          {checkPermission('vouchers.create') && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> New Voucher
            </button>
          )}
        </div>
      </div>

      {/* Vouchers Table */}
      <DataTable
        data={vouchersData?.vouchers || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search vouchers..."
        exportFilename="vouchers"
        selectable
        emptyTitle="No vouchers"
        emptyDescription="Create your first voucher."
      />

      {/* ── Single Voucher Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingVoucher ? 'Edit Voucher' : 'New Voucher'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <VoucherFields
            register={register}
            errors={errors}
            campaigns={campaigns}
            bgState={singleBg}
            setBgState={setSingleBg}
          />
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {editingVoucher ? 'Update Voucher' : 'Create Voucher'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Bulk Generate Modal ──────────────────────────────────────────── */}
      <Modal
        isOpen={showBulk}
        onClose={() => setShowBulk(false)}
        title="Bulk Generate Vouchers"
        size="lg"
      >
        <form onSubmit={handleBulk(onBulkSubmit)} className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm text-amber-700">
              Kode voucher akan di-generate otomatis dengan format{' '}
              <span className="font-mono font-semibold">GL8-{new Date().getFullYear()}-XXXXXX</span>
            </p>
          </div>
          <div>
            <label className="input-label">Quantity <span className="text-slate-400 font-normal">(max 500)</span></label>
            <input
              {...regBulk('quantity')}
              type="number"
              className="input-field"
              min={1}
              max={500}
              placeholder="10"
            />
            {bulkErrors.quantity && <p className="input-error">{bulkErrors.quantity.message}</p>}
          </div>
          <VoucherFields
            register={regBulk}
            errors={bulkErrors}
            campaigns={campaigns}
            bgState={bulkBg}
            setBgState={setBulkBg}
          />
          {campaigns.length === 0 && !campaignsLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700">
                ⚠️ Belum ada campaign. Buat campaign terlebih dahulu sebelum generate voucher.
              </p>
            </div>
          )}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowBulk(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || campaigns.length === 0}
              className="btn-primary flex-1"
            >
              {isSubmitting && (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {isSubmitting ? 'Generating...' : 'Generate Vouchers'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Voucher Preview Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={!!showPreview}
        onClose={closePreview}
        title="Voucher Preview"
        size="lg"
      >
        {showPreview && (
          <div className="space-y-6">
            {/* Voucher Card */}
            <div
              className="rounded-2xl p-6 text-white relative overflow-hidden"
              style={{
                minHeight: 200,
                background: showPreview.backgroundUrl
                  ? 'transparent'
                  : 'linear-gradient(135deg, #0F766E 0%, #134e4a 100%)',
              }}
            >
              {/* Background image layer */}
              {showPreview.backgroundUrl && (
                <>
                  <img
                    src={showPreview.backgroundUrl}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
                    style={{
                      objectPosition: `${showPreview.bgPositionX ?? 50}% ${showPreview.bgPositionY ?? 50}%`,
                    }}
                  />
                  {/* Dark scrim for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-black/30 to-black/50" />
                </>
              )}

              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full -ml-12 -mb-12 pointer-events-none" />

              {/* Content */}
              <div className="relative z-10 flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  {/* Logo + label row */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg overflow-hidden bg-white/20 flex-shrink-0">
                      <img
                        src={companyLogo}
                        alt="Logo"
                        className="w-full h-full object-contain"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    </div>
                    <p className="text-xs text-white/70 uppercase tracking-wider font-medium">Voucher</p>
                  </div>

                  <h3 className="text-xl font-bold mb-2">{showPreview.name}</h3>
                  {showPreview.description && (
                    <p className="text-sm text-white/70 mb-4">{showPreview.description}</p>
                  )}
                  <p className="text-xs text-white/50 uppercase tracking-wide">Kode</p>
                  <p className="font-mono text-lg font-bold tracking-widest">{showPreview.code}</p>
                  <div className="mt-3 space-y-0.5">
                    <p className="text-xs text-white/50">Campaign: {showPreview.campaignName}</p>
                    <p className="text-xs text-white/50">Berlaku s.d.: {formatDate(showPreview.expiredDate)}</p>
                    {showPreview.minPurchase > 0 && (
                      <p className="text-xs text-white/50">Min. belanja: {formatCurrency(showPreview.minPurchase)}</p>
                    )}
                  </div>
                  {showPreview.terms && (
                    <p className="text-xs text-white/40 mt-3 italic line-clamp-2">{showPreview.terms}</p>
                  )}
                </div>

                <div className="flex flex-col items-center gap-3 flex-shrink-0">
                  {/* Discount value */}
                  <div className="text-center bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3">
                    <p className="text-4xl font-black leading-none">
                      {showPreview.discountType === 'percentage'
                        ? `${showPreview.value}%`
                        : formatCurrency(showPreview.value)}
                    </p>
                    <p className="text-xs text-white/60 uppercase mt-1">Diskon</p>
                  </div>

                  {/* QR Code */}
                  {showPreview.qrCode && (
                    <div className="text-center">
                      <div className="bg-white rounded-xl p-2 inline-block">
                        <img src={showPreview.qrCode} alt="QR Code" className="w-24 h-24 block" />
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Scan untuk validasi</p>
                    </div>
                  )}

                  {/* Barcode */}
                  {showPreview.barcode && (
                    <div className="text-center">
                      <div className="bg-white rounded-lg p-1.5 inline-block">
                        <img src={showPreview.barcode} alt="Barcode" className="h-10 max-w-[160px] block" />
                      </div>
                      <p className="text-[10px] text-white/50 mt-1">Barcode</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => { copyToClipboard(showPreview.code); toastSuccess('Kode disalin!'); }}
                className="btn-secondary flex-1"
              >
                <Copy className="w-4 h-4" /> Salin Kode
              </button>
              <button
                onClick={() => setShowWaField((v) => !v)}
                className="btn-primary flex-1"
                style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
              >
                <MessageCircle className="w-4 h-4" /> Share WhatsApp
              </button>
            </div>

            {/* WhatsApp phone field — revealed after clicking Share WhatsApp */}
            {showWaField && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div>
                  <label className="input-label">Nomor WhatsApp Tujuan</label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={waPhone}
                    onChange={(e) => setWaPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendWhatsApp(); }}
                    className="input-field"
                    placeholder="08xxxxxxxxxx"
                    autoFocus
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Kosongkan untuk memilih kontak langsung di WhatsApp.
                  </p>
                </div>
                <button
                  onClick={sendWhatsApp}
                  className="btn-primary w-full"
                  style={{ background: 'linear-gradient(135deg, #25D366, #128C7E)' }}
                >
                  <MessageCircle className="w-4 h-4" /> Kirim ke WhatsApp
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Dialog ────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deletingVoucher}
        onClose={() => setDeletingVoucher(null)}
        onConfirm={handleDelete}
        title="Delete Voucher"
        message={`Delete voucher "${deletingVoucher?.code}"? This action cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}

export default VouchersPage;

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Layers, Copy } from 'lucide-react';
import { getVouchers, createVoucher, updateVoucher, deleteVoucher, bulkGenerateVouchers } from '@/services/voucherService';
import { getActiveCampaigns } from '@/services/campaignService';
import useAuthStore from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { voucherSchema, bulkGenerateSchema } from '@/utils/validators';
import { VOUCHER_STATUS_LABELS, CAMPAIGN_STATUS_LABELS } from '@/utils/constants';
import { formatDate, formatCurrency, getExpirationLabel } from '@/utils/formatters';
import { copyToClipboard, shareViaWhatsApp } from '@/utils/exportUtils';

// ─────────────────────────────────────────────────────────────────────────────
// Shared voucher form fields (used by both single and bulk modals).
// NOTE: This renders ONLY the fields — NOT a <form> wrapper.
// The parent modal provides its own <form onSubmit=...>.
// ─────────────────────────────────────────────────────────────────────────────
function VoucherFields({ register, errors, campaigns }) {
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
            {campaigns.length === 0 && (
              <option disabled>No campaigns available</option>
            )}
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.status})
              </option>
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
    reset({
      name: '', campaignId: '', description: '', value: '',
      discountType: 'percentage', terms: '', startDate: '', expiredDate: '',
      usageLimit: 1, minPurchase: 0, maxDiscount: 0,
    });
    setShowForm(true);
  }, [reset]);

  const openEdit = useCallback((v) => {
    setEditingVoucher(v);
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
      const enriched = { ...data, campaignName: campaign?.name || '' };
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
  }, [isSubmitting, editingVoucher, campaigns, userProfile, queryClient]);

  const onBulkSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const campaign = campaigns.find((c) => c.id === data.campaignId);
      if (!data.campaignId || !campaign) {
        toastError('Please select a campaign before generating vouchers.');
        return;
      }
      const enriched = { ...data, campaignName: campaign.name };
      const result = await bulkGenerateVouchers(enriched, Number(data.quantity), userProfile);
      toastSuccess(`Successfully generated ${result.length} vouchers`);
      setShowBulk(false);
      queryClient.invalidateQueries({ queryKey: ['vouchers'] });
    } catch (error) {
      toastError(error.message || 'Bulk generation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, campaigns, userProfile, queryClient]);

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
          <button onClick={() => setShowPreview(row)} className="btn-icon" title="Preview">
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
          {/* Status filter */}
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

          {/* Campaign filter */}
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
          <VoucherFields register={register} errors={errors} campaigns={campaigns} />
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
        {/* IMPORTANT: Only ONE <form> here. Previously there were two nested forms
            (outer + renderVoucherForm) which caused double-submit and broken behaviour. */}
        <form onSubmit={handleBulk(onBulkSubmit)} className="space-y-4">
          {/* Info banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-sm text-amber-700">
              Voucher codes will be auto-generated with the format{' '}
              <span className="font-mono font-semibold">GL8-{new Date().getFullYear()}-XXXXXX</span>
            </p>
          </div>

          {/* Quantity — specific to bulk mode only */}
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

          {/* Shared voucher fields (no nested <form>) */}
          <VoucherFields register={regBulk} errors={bulkErrors} campaigns={campaigns} />

          {campaigns.length === 0 && !campaignsLoading && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-sm text-red-700">
                ⚠️ No campaigns found. Please create a campaign first before generating vouchers.
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

      {/* ── Voucher Preview Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={!!showPreview}
        onClose={() => setShowPreview(null)}
        title="Voucher Preview"
        size="lg"
      >
        {showPreview && (
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 rounded-2xl p-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-accent-500/10 rounded-full -ml-12 -mb-12" />
              <div className="relative z-10 flex flex-col sm:flex-row gap-6">
                <div className="flex-1">
                  <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Voucher</p>
                  <h3 className="text-xl font-bold mb-2">{showPreview.name}</h3>
                  <p className="text-sm text-white/70 mb-4">{showPreview.description}</p>
                  <p className="text-xs text-white/50">Code</p>
                  <p className="font-mono text-lg font-bold">{showPreview.code}</p>
                  <p className="text-xs text-white/50 mt-3">Campaign: {showPreview.campaignName}</p>
                  <p className="text-xs text-white/50">Expires: {formatDate(showPreview.expiredDate)}</p>
                  {showPreview.terms && (
                    <p className="text-xs text-white/40 mt-3 italic">{showPreview.terms}</p>
                  )}
                </div>
                <div className="flex flex-col items-center gap-3">
                  <div className="text-center">
                    <p className="text-4xl font-black">
                      {showPreview.discountType === 'percentage'
                        ? `${showPreview.value}%`
                        : formatCurrency(showPreview.value)}
                    </p>
                    <p className="text-xs text-white/60 uppercase">Discount</p>
                  </div>
                  {showPreview.qrCode && (
                    <img src={showPreview.qrCode} alt="QR" className="w-24 h-24 rounded-xl bg-white p-1" />
                  )}
                  {showPreview.barcode && (
                    <img src={showPreview.barcode} alt="Barcode" className="h-12 bg-white rounded-lg p-1" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { copyToClipboard(showPreview.code); toastSuccess('Code copied!'); }}
                className="btn-secondary flex-1"
              >
                <Copy className="w-4 h-4" /> Copy Code
              </button>
              <button
                onClick={() => shareViaWhatsApp(`Check out this voucher: ${showPreview.code} - ${showPreview.name}`, '')}
                className="btn-primary flex-1"
              >
                Share via WhatsApp
              </button>
            </div>
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

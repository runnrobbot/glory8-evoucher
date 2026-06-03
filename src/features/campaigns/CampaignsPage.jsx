import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, CheckCircle, Ban, Eye, Megaphone } from 'lucide-react';
import { getCampaigns, createCampaign, updateCampaign, approveCampaign, suspendCampaign, deleteCampaign } from '@/services/campaignService';
import useAuthStore from '@/store/authStore';
import { usePermission } from '@/hooks/usePermission';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import FileUpload from '@/components/ui/FileUpload';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { campaignSchema } from '@/utils/validators';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS } from '@/utils/constants';
import { formatDate } from '@/utils/formatters';
import { UPLOAD_FOLDERS } from '@/lib/cloudinary';

function CampaignsPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const { isSuperAdmin, checkPermission } = usePermission();
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const { data: campaignsData, isLoading } = useQuery({
    queryKey: ['campaigns', statusFilter],
    queryFn: () => getCampaigns({ pageSize: 100, filters: { status: statusFilter || undefined } }),
    staleTime: 2 * 60 * 1000,
  });

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    resolver: zodResolver(campaignSchema),
  });

  const openCreate = useCallback(() => {
    setEditingCampaign(null);
    reset({ name: '', code: '', description: '', bannerUrl: '', startDate: '', endDate: '', status: CAMPAIGN_STATUS.DRAFT });
    setShowForm(true);
  }, [reset]);

  const openEdit = useCallback((campaign) => {
    setEditingCampaign(campaign);
    const start = campaign.startDate?.toDate ? campaign.startDate.toDate() : new Date(campaign.startDate);
    const end = campaign.endDate?.toDate ? campaign.endDate.toDate() : new Date(campaign.endDate);
    reset({
      name: campaign.name,
      code: campaign.code,
      description: campaign.description,
      bannerUrl: campaign.bannerUrl || '',
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      status: campaign.status,
    });
    setShowForm(true);
  }, [reset]);

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingCampaign) {
        await updateCampaign(editingCampaign.id, data, userProfile);
        toastSuccess('Campaign updated');
      } else {
        await createCampaign(data, userProfile);
        toastSuccess('Campaign created');
      }
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (error) {
      toastError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, editingCampaign, userProfile, queryClient]);

  const handleApprove = useCallback(async (campaign) => {
    try {
      await approveCampaign(campaign.id, userProfile);
      toastSuccess('Campaign approved');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [userProfile, queryClient]);

  const handleSuspend = useCallback(async (campaign) => {
    try {
      await suspendCampaign(campaign.id, userProfile);
      toastSuccess('Campaign suspended');
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [userProfile, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deletingCampaign) return;
    try {
      await deleteCampaign(deletingCampaign.id, userProfile);
      toastSuccess('Campaign deleted');
      setDeletingCampaign(null);
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [deletingCampaign, userProfile, queryClient]);

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Campaign', searchable: true,
      render: (val, row) => (
        <div className="flex items-center gap-3">
          {row.bannerUrl && <img src={row.bannerUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />}
          <div>
            <p className="font-medium text-slate-800">{val}</p>
            <p className="text-xs text-slate-400">{row.code}</p>
          </div>
        </div>
      ),
    },
    { key: 'status', label: 'Status', render: (val) => <StatusBadge status={val} dot /> },
    { key: 'startDate', label: 'Start', render: (val) => formatDate(val) },
    { key: 'endDate', label: 'End', render: (val) => formatDate(val) },
    { key: 'voucherCount', label: 'Vouchers', render: (val) => val || 0 },
    { key: 'createdByName', label: 'Created By' },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          {checkPermission('campaigns.edit') && (
            <button onClick={() => openEdit(row)} className="btn-icon" title="Edit"><Pencil className="w-4 h-4" /></button>
          )}
          {isSuperAdmin && row.status === CAMPAIGN_STATUS.PENDING_APPROVAL && (
            <button onClick={() => handleApprove(row)} className="btn-icon text-emerald-500 hover:bg-emerald-50" title="Approve"><CheckCircle className="w-4 h-4" /></button>
          )}
          {isSuperAdmin && row.status === CAMPAIGN_STATUS.ACTIVE && (
            <button onClick={() => handleSuspend(row)} className="btn-icon text-orange-500 hover:bg-orange-50" title="Suspend"><Ban className="w-4 h-4" /></button>
          )}
          {checkPermission('campaigns.delete') && (
            <button onClick={() => setDeletingCampaign(row)} className="btn-icon text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      ),
    },
  ], [openEdit, handleApprove, handleSuspend, isSuperAdmin, checkPermission]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">Manage marketing campaigns</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field py-2 text-sm w-40">
            <option value="">All Status</option>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          {checkPermission('campaigns.create') && (
            <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> New Campaign</button>
          )}
        </div>
      </div>

      <DataTable data={campaignsData?.campaigns || []} columns={columns} isLoading={isLoading} searchPlaceholder="Search campaigns..." exportFilename="campaigns" emptyTitle="No campaigns" emptyDescription="Create your first campaign." />

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingCampaign ? 'Edit Campaign' : 'New Campaign'} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Campaign Name</label>
              <input {...register('name')} className="input-field" placeholder="Summer Sale 2026" />
              {errors.name && <p className="input-error">{errors.name.message}</p>}
            </div>
            <div>
              <label className="input-label">Campaign Code</label>
              <input {...register('code')} className="input-field" placeholder="SUMMER-2026" />
              {errors.code && <p className="input-error">{errors.code.message}</p>}
            </div>
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea {...register('description')} className="input-field" rows={3} placeholder="Campaign description..." />
          </div>
          <div>
            <label className="input-label">Banner Image</label>
            <Controller name="bannerUrl" control={control} render={({ field }) => (
              <FileUpload value={field.value} onChange={field.onChange} folder={UPLOAD_FOLDERS.CAMPAIGN_BANNER} label="Upload Banner" />
            )} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="input-label">Start Date</label>
              <input {...register('startDate')} type="date" className="input-field" />
              {errors.startDate && <p className="input-error">{errors.startDate.message}</p>}
            </div>
            <div>
              <label className="input-label">End Date</label>
              <input {...register('endDate')} type="date" className="input-field" />
              {errors.endDate && <p className="input-error">{errors.endDate.message}</p>}
            </div>
          </div>
          <div>
            <label className="input-label">Status</label>
            <select {...register('status')} className="input-field">
              <option value={CAMPAIGN_STATUS.DRAFT}>Draft</option>
              <option value={CAMPAIGN_STATUS.PENDING_APPROVAL}>Submit for Approval</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingCampaign ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deletingCampaign} onClose={() => setDeletingCampaign(null)} onConfirm={handleDelete} title="Delete Campaign" message={`Delete "${deletingCampaign?.name}"?`} confirmLabel="Delete" />
    </div>
  );
}

export default CampaignsPage;

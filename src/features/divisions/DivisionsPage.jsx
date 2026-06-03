import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { getDivisions, createDivision, updateDivision, deleteDivision } from '@/services/divisionService';
import useAuthStore from '@/store/authStore';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { divisionSchema } from '@/utils/validators';
import { formatDateTime } from '@/utils/formatters';

function DivisionsPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editingDivision, setEditingDivision] = useState(null);
  const [deletingDivision, setDeletingDivision] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['divisions'],
    queryFn: getDivisions,
    staleTime: 5 * 60 * 1000,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(divisionSchema),
  });

  const openCreate = useCallback(() => {
    setEditingDivision(null);
    reset({ name: '', description: '' });
    setShowForm(true);
  }, [reset]);

  const openEdit = useCallback((div) => {
    setEditingDivision(div);
    reset({ name: div.name, description: div.description });
    setShowForm(true);
  }, [reset]);

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (editingDivision) {
        await updateDivision(editingDivision.id, data, userProfile);
        toastSuccess('Division updated');
      } else {
        await createDivision(data, userProfile);
        toastSuccess('Division created');
      }
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    } catch (error) {
      toastError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, editingDivision, userProfile, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deletingDivision) return;
    try {
      await deleteDivision(deletingDivision.id, userProfile);
      toastSuccess('Division deleted');
      setDeletingDivision(null);
      queryClient.invalidateQueries({ queryKey: ['divisions'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [deletingDivision, userProfile, queryClient]);

  const columns = useMemo(() => [
    { key: 'name', label: 'Name', searchable: true },
    { key: 'description', label: 'Description', searchable: true },
    { key: 'createdByName', label: 'Created By' },
    { key: 'createdAt', label: 'Created', render: (val) => formatDateTime(val) },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEdit(row)} className="btn-icon" title="Edit"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => setDeletingDivision(row)} className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50" title="Delete"><Trash2 className="w-4 h-4" /></button>
        </div>
      ),
    },
  ], [openEdit]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Divisions</h1>
          <p className="page-subtitle">Manage organizational divisions</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Division
        </button>
      </div>

      <DataTable data={divisions} columns={columns} isLoading={isLoading} searchPlaceholder="Search divisions..." exportFilename="divisions" emptyTitle="No divisions" emptyDescription="Create your first division." emptyAction={openCreate} emptyActionLabel="Add Division" />

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingDivision ? 'Edit Division' : 'Create Division'} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="input-label">Name</label>
            <input {...register('name')} className="input-field" placeholder="e.g., Marketing" />
            {errors.name && <p className="input-error">{errors.name.message}</p>}
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea {...register('description')} className="input-field" rows={3} placeholder="Optional description" />
          </div>
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingDivision ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog isOpen={!!deletingDivision} onClose={() => setDeletingDivision(null)} onConfirm={handleDelete} title="Delete Division" message={`Delete "${deletingDivision?.name}"? Users in this division will need reassignment.`} confirmLabel="Delete" />
    </div>
  );
}

export default DivisionsPage;

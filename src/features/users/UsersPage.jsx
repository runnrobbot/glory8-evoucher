import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, RotateCcw, UserPlus } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, restoreUser } from '@/services/userService';
import { getDivisions } from '@/services/divisionService';
import useAuthStore from '@/store/authStore';
import DataTable from '@/components/ui/DataTable';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import StatusBadge from '@/components/ui/StatusBadge';
import { toastSuccess, toastError } from '@/components/ui/Toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, userEditSchema } from '@/utils/validators';
import { ROLE_OPTIONS } from '@/utils/constants';
import { formatDateTime } from '@/utils/formatters';

function UsersPage() {
  const queryClient = useQueryClient();
  const { userProfile } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers({ pageSize: 100 }),
    staleTime: 2 * 60 * 1000,
  });

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: getDivisions,
    staleTime: 10 * 60 * 1000,
  });

  const schema = editingUser ? userEditSchema : userSchema;
  const { register, handleSubmit, reset, formState: { errors }, setValue } = useForm({
    resolver: zodResolver(schema),
  });

  const openCreateForm = useCallback(() => {
    setEditingUser(null);
    reset({ email: '', displayName: '', role: 'staff', divisionId: '', password: '' });
    setShowForm(true);
  }, [reset]);

  const openEditForm = useCallback((user) => {
    setEditingUser(user);
    reset({
      displayName: user.displayName,
      role: user.role,
      divisionId: user.divisionId,
    });
    setShowForm(true);
  }, [reset]);

  const onSubmit = useCallback(async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingUser) {
        const division = divisions.find((d) => d.id === data.divisionId);
        await updateUser(editingUser.uid, {
          ...data,
          divisionName: division?.name || '',
        }, userProfile);
        toastSuccess('User updated successfully');
      } else {
        const division = divisions.find((d) => d.id === data.divisionId);
        await createUser({
          ...data,
          divisionName: division?.name || '',
        }, userProfile);
        toastSuccess('User created successfully');
      }
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      toastError(error.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, editingUser, divisions, userProfile, queryClient]);

  const handleDelete = useCallback(async () => {
    if (!deletingUser) return;
    try {
      await deleteUser(deletingUser.uid, userProfile);
      toastSuccess('User deactivated successfully');
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [deletingUser, userProfile, queryClient]);

  const handleRestore = useCallback(async (user) => {
    try {
      await restoreUser(user.uid, userProfile);
      toastSuccess('User restored successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      toastError(error.message);
    }
  }, [userProfile, queryClient]);

  const columns = useMemo(() => [
    { key: 'displayName', label: 'Name', searchable: true },
    { key: 'email', label: 'Email', searchable: true },
    {
      key: 'role', label: 'Role', searchable: true,
      render: (val) => <StatusBadge status={val === 'super_admin' ? 'emerald' : val === 'admin' ? 'blue' : 'gray'} label={val?.replace('_', ' ')} />,
    },
    { key: 'divisionName', label: 'Division', searchable: true },
    {
      key: 'isActive', label: 'Status',
      render: (val) => <StatusBadge status={val ? 'active' : 'suspended'} />,
    },
    {
      key: 'lastLoginAt', label: 'Last Login',
      render: (val) => val ? formatDateTime(val) : 'Never',
    },
    {
      key: 'actions', label: '', sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-1">
          <button onClick={() => openEditForm(row)} className="btn-icon" title="Edit">
            <Pencil className="w-4 h-4" />
          </button>
          {row.uid !== userProfile?.uid && (
            <button onClick={() => setDeletingUser(row)} className="btn-icon text-red-500 hover:text-red-700 hover:bg-red-50" title="Delete">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ], [openEditForm, userProfile?.uid]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage user accounts and permissions</p>
        </div>
        <button onClick={openCreateForm} className="btn-primary">
          <UserPlus className="w-4 h-4" /> Add User
        </button>
      </div>

      <DataTable
        data={usersData?.users || []}
        columns={columns}
        isLoading={isLoading}
        searchPlaceholder="Search users..."
        exportFilename="users"
        emptyTitle="No users found"
        emptyDescription="Get started by adding your first user."
        emptyAction={openCreateForm}
        emptyActionLabel="Add User"
      />

      {/* User Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingUser ? 'Edit User' : 'Create User'}
        size="md"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {!editingUser && (
            <div>
              <label className="input-label">Email</label>
              <input {...register('email')} type="email" className="input-field" placeholder="user@company.com" />
              {errors.email && <p className="input-error">{errors.email.message}</p>}
            </div>
          )}

          <div>
            <label className="input-label">Full Name</label>
            <input {...register('displayName')} className="input-field" placeholder="Full Name" />
            {errors.displayName && <p className="input-error">{errors.displayName.message}</p>}
          </div>

          <div>
            <label className="input-label">Role</label>
            <select {...register('role')} className="input-field">
              <option value="">Select Role</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            {errors.role && <p className="input-error">{errors.role.message}</p>}
          </div>

          <div>
            <label className="input-label">Division</label>
            <select {...register('divisionId')} className="input-field">
              <option value="">Select Division</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            {errors.divisionId && <p className="input-error">{errors.divisionId.message}</p>}
          </div>

          {!editingUser && (
            <div>
              <label className="input-label">Password</label>
              <input {...register('password')} type="password" className="input-field" placeholder="Min 6 characters" />
              {errors.password && <p className="input-error">{errors.password.message}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {editingUser ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="Deactivate User"
        message={`Are you sure you want to deactivate ${deletingUser?.displayName}? They will no longer be able to access the system.`}
        confirmLabel="Deactivate"
      />
    </div>
  );
}

export default UsersPage;

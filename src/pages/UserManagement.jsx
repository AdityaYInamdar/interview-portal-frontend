import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import toast from 'react-hot-toast'

// ─── Helper ───────────────────────────────────────────────────────────────────
// Default permission shapes — mirrors DEFAULT_MENU_PERMISSIONS in user_management.py.
// To add a new menu: add one entry here AND one entry in the nav (DashboardLayout).
// Zero table migrations needed.
const defaultPerms = {
  menu_permissions: {
    dashboard:    true,
    interviews:   false,
    tests:        false,
    questions:    false,
    candidates:   false,
    interviewers: false,
    evaluations:  false,
    analytics:    false,
    settings:     false,
    users:        false,
  },
  crud_permissions: {
    interviews:   { create: true, read: true, update: true, delete: false },
    tests:        { create: true, read: true, update: true, delete: false },
    candidates:   { create: true, read: true, update: true, delete: false },
    questions:    { create: true, read: true, update: true, delete: false },
    interviewers: { create: true, read: true, update: true, delete: false },
  },
}

// Human-readable labels for each menu key.
// Add a new entry here when you add a new menu to the app.
const MENU_LABELS = {
  dashboard:    'Dashboard',
  interviews:   'Interviews',
  tests:        'Tests',
  questions:    'Questions',
  candidates:   'Candidates',
  interviewers: 'Interviewers',
  evaluations:  'Evaluations',
  analytics:    'Analytics',
  settings:     'Settings',
  users:        'User Management',
}

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#$'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ─── Permission Matrix Component ──────────────────────────────────────────────
function PermissionMatrix({ permissions, onChange, disabled = false }) {
  // Iterate over whatever keys exist in menu_permissions — fully dynamic.
  const menuKeys = Object.keys(permissions.menu_permissions)

  const toggleMenu = (key) => {
    if (disabled) return
    onChange({
      ...permissions,
      menu_permissions: { ...permissions.menu_permissions, [key]: !permissions.menu_permissions[key] },
    })
  }

  const toggleCrud = (section, action) => {
    if (disabled) return
    onChange({
      ...permissions,
      crud_permissions: {
        ...permissions.crud_permissions,
        [section]: {
          ...permissions.crud_permissions[section],
          [action]: !permissions.crud_permissions[section][action],
        },
      },
    })
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold text-gray-700">Menu Access</h4>
      <div className="grid grid-cols-2 gap-2">
        {menuKeys.map((key) => (
          <label key={key} className={`flex items-center space-x-2 p-2 rounded border cursor-pointer ${permissions.menu_permissions[key] ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
            <input
              type="checkbox"
              checked={!!permissions.menu_permissions[key]}
              onChange={() => toggleMenu(key)}
              disabled={disabled}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">{MENU_LABELS[key] || key}</span>
          </label>
        ))}
      </div>

      <h4 className="text-sm font-semibold text-gray-700 mt-4">CRUD Permissions</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1 pr-4 text-gray-600">Section</th>
              {['create', 'read', 'update', 'delete'].map(a => (
                <th key={a} className="text-center py-1 px-2 text-gray-600 capitalize">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(permissions.crud_permissions).map((section) => (
              <tr key={section} className="border-b last:border-0">
                <td className="py-2 pr-4 capitalize text-gray-700">{section}</td>
                {['create', 'read', 'update', 'delete'].map(action => (
                  <td key={action} className="text-center py-2 px-2">
                    <input
                      type="checkbox"
                      checked={!!permissions.crud_permissions[section][action]}
                      onChange={() => toggleCrud(section, action)}
                      disabled={disabled}
                      className="rounded text-blue-600"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Add / Edit User Modal ─────────────────────────────────────────────────────
function UserModal({ user: editUser, onClose, onSave }) {
  const isEdit = !!editUser
  const [form, setForm] = useState({
    full_name: editUser?.full_name || '',
    email: editUser?.email || '',
    role: editUser?.role || 'sub_admin',
    phone: editUser?.phone || '',
    password: generatePassword(),
    permissions: editUser?.permissions
      ? {
          menu_permissions: editUser.permissions.menu_permissions
            ? { ...defaultPerms.menu_permissions, ...editUser.permissions.menu_permissions }
            : { ...defaultPerms.menu_permissions },
          crud_permissions: editUser.permissions.crud_permissions
            ? { ...defaultPerms.crud_permissions, ...editUser.permissions.crud_permissions }
            : { ...defaultPerms.crud_permissions },
        }
      : { ...defaultPerms },
  })
  const [showPassword, setShowPassword] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">{isEdit ? 'Edit User' : 'Add New User'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
              <input
                required
                value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                required
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                disabled={isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={e => set('role', e.target.value)}
                disabled={isEdit}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="sub_admin">Sub Admin</option>
                <option value="interviewer">Interviewer</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {!isEdit && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Temporary Password *</label>
                <div className="flex gap-2">
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => set('password', e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                  <button type="button" onClick={() => set('password', generatePassword())} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Regenerate
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">This password will be sent to the user's email. They should change it after first login.</p>
              </div>
            )}
          </div>

          {/* Permission matrix only for sub_admin */}
          {form.role === 'sub_admin' && (
            <div className="border border-gray-200 rounded-xl p-4">
              <PermissionMatrix
                permissions={form.permissions}
                onChange={(p) => set('permissions', p)}
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
              {isEdit ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function UserManagement() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'add' | { user }
  const [searchQuery, setSearchQuery] = useState('')

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['managed-users'],
    queryFn: () => api.get('/user-management').then(r => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (body) => api.post('/user-management', body),
    onSuccess: () => {
      toast.success('User created successfully')
      qc.invalidateQueries(['managed-users'])
      setModal(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create user'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => api.patch(`/user-management/${id}`, body),
    onSuccess: () => {
      toast.success('User updated')
      qc.invalidateQueries(['managed-users'])
      setModal(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update user'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id) => api.patch(`/user-management/${id}`, { is_active: false }),
    onSuccess: () => {
      toast.success('User deactivated')
      qc.invalidateQueries(['managed-users'])
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to deactivate user'),
  })

  const handleSave = (form) => {
    if (modal === 'add') {
      createMutation.mutate(form)
    } else {
      updateMutation.mutate({ id: modal.id, body: { full_name: form.full_name, phone: form.phone, permissions: form.permissions } })
    }
  }

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const roleBadge = (role) => {
    const styles = {
      admin: 'bg-purple-100 text-purple-700',
      sub_admin: 'bg-blue-100 text-blue-700',
      interviewer: 'bg-green-100 text-green-700',
    }
    return (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[role] || 'bg-gray-100 text-gray-600'}`}>
        {role?.replace('_', ' ')}
      </span>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage sub-admins and interviewers. Control what each user can access.</p>
          </div>
          <button
            onClick={() => setModal('add')}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-sm border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500">No users found. Add your first user above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Access</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const isActive = u.status === 'active'
                  return (
                    <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.full_name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email}</td>
                      <td className="px-4 py-3">{roleBadge(u.role)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span className={`text-xs ${isActive ? 'text-green-700' : 'text-gray-500'}`}>{isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {u.role === 'sub_admin' && u.permissions != null ? (
                          <span className="text-xs text-blue-600">
                            {Object.values(u.permissions.menu_permissions || {}).filter(Boolean).length} menus
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setModal(u)}
                            className="text-blue-600 hover:text-blue-800 text-xs font-medium border border-blue-200 px-2 py-1 rounded-lg hover:bg-blue-50"
                          >
                            Edit
                          </button>
                          {isActive && (
                            <button
                              onClick={() => {
                                if (confirm(`Deactivate ${u.full_name}? They will lose access immediately.`)) {
                                  deactivateMutation.mutate(u.id)
                                }
                              }}
                              className="text-red-600 hover:text-red-800 text-xs font-medium border border-red-200 px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <UserModal
          user={modal === 'add' ? null : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </DashboardLayout>
  )
}

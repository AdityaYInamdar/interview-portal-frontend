import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/layouts/DashboardLayout'
import api from '../services/api'
import toast from 'react-hot-toast'

const LEVELS = ['', 'intern', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'vp', 'c-level']

function DesignationModal({ designation, onClose, onSave }) {
  const [form, setForm] = useState({
    title: designation?.title || '',
    department: designation?.department || '',
    level: designation?.level || '',
    description: designation?.description || '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      if (designation?.id) {
        const res = await api.patch(`/designations/${designation.id}`, form)
        onSave(res.data, 'updated')
      } else {
        const res = await api.post('/designations/', form)
        onSave(res.data, 'created')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save designation')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {designation?.id ? 'Edit Designation' : 'New Designation'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="input"
              placeholder="e.g. Software Engineer II"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <input
                type="text"
                value={form.department}
                onChange={e => setForm(p => ({ ...p, department: e.target.value }))}
                className="input"
                placeholder="e.g. Engineering"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
              <select
                value={form.level}
                onChange={e => setForm(p => ({ ...p, level: e.target.value }))}
                className="input"
              >
                {LEVELS.map(l => (
                  <option key={l} value={l}>{l ? l.charAt(0).toUpperCase() + l.slice(1) : '— None —'}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="input"
              rows={2}
              placeholder="Optional description of the role…"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DesignationsManager() {
  const [searchParams, setSearchParams] = useSearchParams()
  const showInactive = searchParams.get('inactive') === '1'
  const searchQ = searchParams.get('q') || ''
  const setShowInactive = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set('inactive', '1') : n.delete('inactive'); return n })
  const setSearchQ = (v) => setSearchParams(prev => { const n = new URLSearchParams(prev); v ? n.set('q', v) : n.delete('q'); return n })
  const [designations, setDesignations] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | {} (new) | { ...designation } (edit)

  const fetchDesignations = async () => {
    setLoading(true)
    try {
      const res = await api.get('/designations/', { params: { active_only: !showInactive } })
      setDesignations(res.data || [])
    } catch (err) {
      toast.error('Failed to load designations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDesignations() }, [showInactive])

  const filteredDesignations = useMemo(() => {
    if (!searchQ) return designations
    const q = searchQ.toLowerCase()
    return designations.filter(d =>
      d.title?.toLowerCase().includes(q) ||
      d.department?.toLowerCase().includes(q)
    )
  }, [designations, searchQ])

  const handleSave = (designation, action) => {
    toast.success(`Designation ${action} successfully!`)
    setModal(null)
    fetchDesignations()
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Deactivate this designation? It will no longer appear in dropdowns.')) return
    try {
      await api.delete(`/designations/${id}`)
      toast.success('Designation deactivated.')
      fetchDesignations()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to deactivate')
    }
  }

  const handleRestore = async (id) => {
    try {
      await api.patch(`/designations/${id}`, { is_active: true })
      toast.success('Designation restored.')
      fetchDesignations()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to restore')
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Designations</h1>
            <p className="text-gray-600 mt-1">
              Manage job titles for your organisation. Candidates will be linked to a designation when added.
            </p>
          </div>
          <button onClick={() => setModal({})} className="btn btn-primary">
            + New Designation
          </button>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-48">
            <svg className="absolute left-2.5 top-2.5 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search designations…"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="pl-8 pr-3 py-1.5 w-full border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <input
              id="show-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              className="rounded border-gray-300 text-primary-600"
            />
            <label htmlFor="show-inactive" className="text-gray-600 cursor-pointer">Show inactive</label>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden p-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="spinner" />
            </div>
          ) : filteredDesignations.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p>No designations yet. Click <strong>+ New Designation</strong> to add the first one.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Title', 'Department', 'Level', 'Status', ''].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDesignations.map(d => (
                  <tr key={d.id} className={`hover:bg-gray-50 ${!d.is_active ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{d.title}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{d.department || '—'}</td>
                    <td className="px-6 py-4">
                      {d.level ? (
                        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800 capitalize">{d.level}</span>
                      ) : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${d.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {d.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => setModal(d)}
                          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                        >
                          Edit
                        </button>
                        {d.is_active ? (
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="text-sm text-red-500 hover:text-red-700 font-medium"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRestore(d.id)}
                            className="text-sm text-green-600 hover:text-green-800 font-medium"
                          >
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal !== null && (
        <DesignationModal
          designation={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </DashboardLayout>
  )
}

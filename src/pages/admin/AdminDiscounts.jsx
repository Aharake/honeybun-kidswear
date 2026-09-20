import { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import './Admin.css'

const EMPTY = { code: '', type: 'percent', value: '', min_subtotal: '', max_uses: '', expires_at: '', is_active: true }

function describe(c) {
  return c.type === 'percent' ? `${Number(c.value)}% off` : `$${Number(c.value).toFixed(2)} off`
}

function statusOf(c) {
  if (!c.is_active) return { label: 'Off', cls: 'badge-cancelled' }
  if (c.expires_at && new Date(c.expires_at) < new Date()) return { label: 'Expired', cls: 'badge-cancelled' }
  if (c.max_uses !== null && c.uses >= c.max_uses) return { label: 'Used up', cls: 'badge-cancelled' }
  return { label: 'Active', cls: 'badge-delivered' }
}

export default function AdminDiscounts() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const { data, error: loadError } = await supabase
      .from('discount_codes')
      .select('*')
      .order('created_at', { ascending: false })
    if (loadError) console.error(loadError)
    setCodes(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const openNew = () => {
    setForm(EMPTY)
    setEditingId(null)
    setError('')
  }

  const openEdit = (c) => {
    setForm({
      code: c.code,
      type: c.type,
      value: c.value,
      min_subtotal: Number(c.min_subtotal) || '',
      max_uses: c.max_uses ?? '',
      expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '',
      is_active: c.is_active,
    })
    setEditingId(c.id)
    setError('')
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const value = Number(form.value)
    if (form.type === 'percent' && (value <= 0 || value > 100)) {
      setError('A percentage discount must be between 1 and 100.')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      code: form.code.replace(/\s+/g, '').toUpperCase(),
      type: form.type,
      value,
      min_subtotal: Number(form.min_subtotal) || 0,
      max_uses: form.max_uses === '' ? null : Number(form.max_uses),
      expires_at: form.expires_at ? new Date(`${form.expires_at}T23:59:59`).toISOString() : null,
      is_active: form.is_active,
    }

    const request = editingId
      ? supabase.from('discount_codes').update(payload).eq('id', editingId)
      : supabase.from('discount_codes').insert([payload])
    const { error: saveError } = await request

    setSaving(false)
    if (saveError) {
      setError(saveError.message.includes('duplicate') ? 'A code with that name already exists.' : 'Could not save the code.')
      return
    }
    setForm(null)
    setEditingId(null)
    load()
  }

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete the code ${c.code}?`)) return
    const { error: deleteError } = await supabase.from('discount_codes').delete().eq('id', c.id)
    if (deleteError) {
      alert('Could not delete code.')
      return
    }
    setCodes((prev) => prev.filter((x) => x.id !== c.id))
  }

  const toggleActive = async (c) => {
    setCodes((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !x.is_active } : x)))
    await supabase.from('discount_codes').update({ is_active: !c.is_active }).eq('id', c.id)
  }

  return (
    <div>
      <div className="admin-header-row">
        <h1>Discount codes</h1>
        {!form && (
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Add code
          </button>
        )}
      </div>

      {form && (
        <form className="admin-form" style={{ marginBottom: 24 }} onSubmit={handleSubmit}>
          <h2 style={{ fontSize: '1.8rem' }}>{editingId ? 'Edit code' : 'New code'}</h2>

          <div className="field">
            <label htmlFor="code">Code customers type in</label>
            <input id="code" name="code" required placeholder="e.g. WELCOME10" value={form.code} onChange={handleChange} style={{ textTransform: 'uppercase' }} />
          </div>

          <div className="admin-form-row">
            <div className="field">
              <label htmlFor="type">Discount type</label>
              <select id="type" name="type" value={form.type} onChange={handleChange}>
                <option value="percent">Percentage off (%)</option>
                <option value="fixed">Fixed amount off ($)</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="value">{form.type === 'percent' ? 'Percent off' : 'Amount off ($)'}</label>
              <input id="value" name="value" type="number" step="0.01" min="0.01" max={form.type === 'percent' ? 100 : undefined} required value={form.value} onChange={handleChange} />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="field">
              <label htmlFor="min_subtotal">Minimum order ($, optional)</label>
              <input id="min_subtotal" name="min_subtotal" type="number" step="0.01" min="0" value={form.min_subtotal} onChange={handleChange} />
            </div>
            <div className="field">
              <label htmlFor="max_uses">Total uses allowed (optional)</label>
              <input id="max_uses" name="max_uses" type="number" min="1" placeholder="Unlimited" value={form.max_uses} onChange={handleChange} />
            </div>
          </div>

          <div className="admin-form-row">
            <div className="field">
              <label htmlFor="expires_at">Expires on (optional)</label>
              <input id="expires_at" name="expires_at" type="date" value={form.expires_at} onChange={handleChange} />
            </div>
            <div className="field admin-checkbox-field" style={{ alignSelf: 'end' }}>
              <input id="is_active" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} style={{ width: 'auto' }} />
              <label htmlFor="is_active" style={{ margin: 0 }}>Code is on</label>
            </div>
          </div>

          {error && <p className="checkout-error">{error}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create code'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : codes.length === 0 ? (
        <p>No discount codes yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Discount</th>
              <th>Min order</th>
              <th>Used</th>
              <th>Expires</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {codes.map((c) => {
              const status = statusOf(c)
              return (
                <tr key={c.id}>
                  <td><strong>{c.code}</strong></td>
                  <td>{describe(c)}</td>
                  <td>{Number(c.min_subtotal) > 0 ? `$${Number(c.min_subtotal).toFixed(2)}` : '—'}</td>
                  <td>{c.uses}{c.max_uses !== null ? ` / ${c.max_uses}` : ''}</td>
                  <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <button className="admin-badge-btn" onClick={() => toggleActive(c)} title="Click to turn on/off">
                      <span className={`badge ${status.cls}`}>{status.label}</span>
                    </button>
                  </td>
                  <td>
                    <button className="admin-icon-btn" onClick={() => openEdit(c)} aria-label="Edit">
                      <Pencil size={18} />
                    </button>
                    <button className="admin-icon-btn" onClick={() => handleDelete(c)} aria-label="Delete">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import './Admin.css'

export default function AdminSeasonal() {
  const [items, setItems] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('seasonal_collections').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('products').select('id, seasonal_collections'),
    ]).then(([cols, prods]) => {
      if (cols.error) {
        console.error(cols.error)
        setMissing(true)
      }
      const tally = {}
      ;(prods.data || []).forEach((p) => {
        ;(p.seasonal_collections || []).forEach((slug) => {
          tally[slug] = (tally[slug] || 0) + 1
        })
      })
      setItems(cols.data || [])
      setCounts(tally)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (item) => {
    const n = counts[item.slug] || 0
    const warning = n
      ? `Delete "${item.name}"? Its ${n} product${n === 1 ? '' : 's'} stay in the shop and in their Girls/Boys collection; they just leave "${item.name}".`
      : `Delete "${item.name}"?`
    if (!window.confirm(warning)) return

    const { error } = await supabase.from('seasonal_collections').delete().eq('id', item.id)
    if (error) {
      alert('Could not delete this collection.')
      return
    }
    // Take its label off the products too (best effort)
    const { data: tagged } = await supabase.from('products').select('id, seasonal_collections').contains('seasonal_collections', [item.slug])
    await Promise.all(
      (tagged || []).map((p) =>
        supabase.from('products').update({ seasonal_collections: p.seasonal_collections.filter((s) => s !== item.slug) }).eq('id', p.id)
      )
    )
    setItems((prev) => prev.filter((c) => c.id !== item.id))
  }

  return (
    <div>
      <div className="admin-header-row">
        <h1>Seasonal collections</h1>
        <Link to="/admin/seasonal/new" className="btn btn-primary">
          <Plus size={16} /> Add seasonal collection
        </Link>
      </div>
      <p className="admin-field-hint" style={{ marginBottom: 16 }}>
        Group clothes from any collection, like <strong>Winter</strong> or <strong>Eid</strong>. A product stays in Girls or Boys
        and also shows up here. Each one can have a banner on the home page.
      </p>

      {missing && (
        <p className="checkout-error" style={{ marginBottom: 16 }}>
          Your database doesn't have seasonal collections yet. Run the latest <strong>schema.sql</strong> in Supabase (SQL Editor), then reload this page.
        </p>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        !missing && <p>No seasonal collections yet. Add your first one, like "Winter".</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Products</th>
              <th>Home banner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.banner_url ? <img src={c.banner_url} alt="" className="admin-table-thumb" /> : <div className="admin-table-thumb" />}</td>
                <td>
                  {c.name}
                  {c.tagline && <span className="admin-stock-warning" style={{ color: 'var(--text-muted)' }}> · {c.tagline}</span>}
                </td>
                <td>{counts[c.slug] || 0}</td>
                <td>{c.show_on_home ? 'Shown' : 'Not shown'}</td>
                <td>
                  <span className={`badge ${c.is_active ? 'badge-delivered' : 'badge-cancelled'}`}>{c.is_active ? 'Visible' : 'Hidden'}</span>
                </td>
                <td>
                  <Link to={`/admin/seasonal/${c.id}/edit`} className="admin-icon-btn" aria-label="Edit">
                    <Pencil size={18} />
                  </Link>
                  <button className="admin-icon-btn" onClick={() => handleDelete(c)} aria-label="Delete">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

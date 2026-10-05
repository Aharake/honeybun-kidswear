import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { collectionImage } from '../../lib/collectionImages'
import './Admin.css'

export default function AdminCollections() {
  const [collections, setCollections] = useState([])
  const [counts, setCounts] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('collections').select('*').order('sort_order', { ascending: true }),
      supabase.from('products').select('category'),
    ]).then(([cols, prods]) => {
      if (cols.error) console.error(cols.error)
      const tally = {}
      ;(prods.data || []).forEach((p) => {
        tally[p.category] = (tally[p.category] || 0) + 1
      })
      setCollections(cols.data || [])
      setCounts(tally)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (col) => {
    const n = counts[col.name] || 0
    const warning = n
      ? `Delete "${col.name}"? Its ${n} product${n === 1 ? '' : 's'} will stay in your shop but won't belong to any collection until you reassign ${n === 1 ? 'it' : 'them'}.`
      : `Delete "${col.name}"?`
    if (!window.confirm(warning)) return
    const { error } = await supabase.from('collections').delete().eq('id', col.id)
    if (error) {
      alert('Could not delete collection.')
      return
    }
    setCollections((prev) => prev.filter((c) => c.id !== col.id))
  }

  return (
    <div>
      <div className="admin-header-row">
        <h1>Collections</h1>
        <Link to="/admin/collections/new" className="btn btn-primary">
          <Plus size={16} /> Add collection
        </Link>
      </div>
      <p className="admin-field-hint" style={{ marginBottom: 16 }}>
        Collections group your products (like Girls or Boys). They appear on the homepage (unless you untick "Show on the home screen"), the shop filters, and the footer.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : collections.length === 0 ? (
        <p>No collections yet. Add your first one!</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Tagline</th>
              <th>Products</th>
              <th>Order</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => {
              const image = collectionImage(c)
              return (
                <tr key={c.id}>
                  <td>{image ? <img src={image} alt="" className="admin-table-thumb" /> : <div className="admin-table-thumb" />}</td>
                  <td>{c.name}</td>
                  <td>{c.tagline}</td>
                  <td>{counts[c.name] || 0}</td>
                  <td>{c.sort_order}</td>
                  <td>
                    <span className={`badge ${c.is_active ? 'badge-delivered' : 'badge-cancelled'}`}>
                      {c.is_active ? 'Visible' : 'Hidden'}
                    </span>
                    {c.is_active && c.show_on_home === false && (
                      <span className="admin-stock-warning"> · not on home</span>
                    )}
                  </td>
                  <td>
                    <Link to={`/admin/collections/${c.id}/edit`} className="admin-icon-btn" aria-label="Edit">
                      <Pencil size={18} />
                    </Link>
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

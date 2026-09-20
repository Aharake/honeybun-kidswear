import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Trash2, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { totalStock } from '../../lib/constants'
import './Admin.css'

export default function AdminProducts() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (error) console.error(error)
    setProducts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This can't be undone.`)) return
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) {
      alert('Could not delete product.')
      return
    }
    setProducts((prev) => prev.filter((p) => p.id !== product.id))
  }

  return (
    <div>
      <div className="admin-header-row">
        <h1>Products</h1>
        <Link to="/admin/products/new" className="btn btn-primary">
          <Plus size={16} /> Add product
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : products.length === 0 ? (
        <p>No products yet. Add your first one!</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Name</th>
              <th>Collection</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="admin-table-thumb" />
                  ) : (
                    <div className="admin-table-thumb" />
                  )}
                </td>
                <td>
                  {p.name}
                  {p.product_sale_price !== null && p.product_sale_price !== undefined && (
                    <span className="admin-stock-warning"> · on sale ${Number(p.product_sale_price).toFixed(2)}</span>
                  )}
                </td>
                <td>{p.category}</td>
                <td>${Number(p.price).toFixed(2)}</td>
                <td>
                  {totalStock(p.size_stock)}
                  {p.size_stock?.some((s) => s.stock <= 0) && (
                    <span className="admin-stock-warning">
                      {' '}({p.size_stock.filter((s) => s.stock <= 0).length} size{p.size_stock.filter((s) => s.stock <= 0).length === 1 ? '' : 's'} sold out)
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${p.is_active ? 'badge-delivered' : 'badge-cancelled'}`}>
                    {p.is_active ? 'Active' : 'Hidden'}
                  </span>
                </td>
                <td>
                  <Link to={`/admin/products/${p.id}/edit`} className="admin-icon-btn" aria-label="Edit">
                    <Pencil size={18} />
                  </Link>
                  <button className="admin-icon-btn" onClick={() => handleDelete(p)} aria-label="Delete">
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

import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import './Admin.css'

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled']

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error(error)
        setOrders(data || [])
        setLoading(false)
      })
  }, [])

  const updateStatus = async (order, status) => {
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status } : o)))
    const { error } = await supabase.from('orders').update({ status }).eq('id', order.id)
    if (error) alert('Could not update order status.')
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1>Orders</h1>

      {orders.length === 0 ? (
        <p>No orders yet.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Placed</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <td>{o.order_number}</td>
                  <td>{o.customer_name}</td>
                  <td>${Number(o.total).toFixed(2)}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>
                    <select value={o.status} onChange={(e) => updateStatus(o, e.target.value)}>
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <button className="admin-icon-btn" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                      {expanded === o.id ? 'Hide' : 'View'}
                    </button>
                  </td>
                </tr>
                {expanded === o.id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--off-white)' }}>
                      <p><strong>Contact:</strong> {o.email} · {o.phone}</p>
                      <p><strong>Deliver to:</strong> {o.address}, {o.city}</p>
                      {o.notes && <p><strong>Notes:</strong> {o.notes}</p>}
                      <p style={{ marginTop: 8 }}><strong>Items:</strong></p>
                      <ul>
                        {o.items.map((item, i) => (
                          <li key={i}>{item.name} {item.size && `(${item.size})`} × {item.qty} — ${(item.price * item.qty).toFixed(2)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

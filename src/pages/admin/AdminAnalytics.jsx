import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import { getPricing } from '../../lib/pricing'
import { totalStock } from '../../lib/constants'
import { useSale } from '../../context/SaleContext'
import './Admin.css'

const CHART_COLOR = '#E0972C'
const CHART_COLOR_2 = '#8FA8C9'

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function lastNDays(n) {
  const days = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export default function AdminAnalytics() {
  const [orders, setOrders] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAllStock, setShowAllStock] = useState(false)
  const { sale } = useSale()

  useEffect(() => {
    Promise.all([supabase.from('orders').select('*'), supabase.from('products').select('*')]).then(([ord, prod]) => {
      if (ord.error) console.error(ord.error)
      if (prod.error) console.error(prod.error)
      setOrders(ord.data || [])
      setProducts(prod.data || [])
      setLoading(false)
    })
  }, [])

  // What the stock on the shelf is worth. There is no cost price in the
  // database, so this is retail value: units x selling price.
  const inventory = useMemo(() => {
    const rows = products.map((p) => {
      const units = totalStock(p.size_stock)
      const price = Number(p.price) || 0
      const current = getPricing(p, sale).current
      return {
        id: p.id,
        name: p.name,
        category: p.category || 'No collection',
        hidden: !p.is_active,
        units,
        soldOutSizes: (p.size_stock || []).filter((s) => Number(s.stock) <= 0).length,
        price,
        value: units * price,
        currentValue: units * current,
      }
    })
    const byCollection = {}
    rows.forEach((r) => {
      byCollection[r.category] = (byCollection[r.category] || 0) + r.value
    })
    return {
      rows: rows.filter((r) => r.units > 0).sort((a, b) => b.value - a.value),
      value: rows.reduce((sum, r) => sum + r.value, 0),
      currentValue: rows.reduce((sum, r) => sum + r.currentValue, 0),
      units: rows.reduce((sum, r) => sum + r.units, 0),
      productsInStock: rows.filter((r) => r.units > 0).length,
      soldOutProducts: rows.filter((r) => r.units <= 0).length,
      soldOutSizes: rows.reduce((sum, r) => sum + r.soldOutSizes, 0),
      byCollection: Object.entries(byCollection)
        .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
        .sort((a, b) => b.value - a.value),
    }
  }, [products, sale])

  const stats = useMemo(() => {
    const nonCancelled = orders.filter((o) => o.status !== 'cancelled')
    const revenue = nonCancelled.reduce((sum, o) => sum + Number(o.total), 0)
    const byStatus = orders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1
      return acc
    }, {})

    const productTotals = {}
    nonCancelled.forEach((o) => {
      (o.items || []).forEach((item) => {
        productTotals[item.name] = (productTotals[item.name] || 0) + item.qty
      })
    })
    const topProducts = Object.entries(productTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }))

    const days = lastNDays(14)
    const revenueByDay = days.map((day) => {
      const dayTotal = nonCancelled
        .filter((o) => o.created_at.slice(0, 10) === day)
        .reduce((sum, o) => sum + Number(o.total), 0)
      return { day: day.slice(5), revenue: dayTotal }
    })

    return { revenue, orderCount: orders.length, byStatus, topProducts, revenueByDay }
  }, [orders])

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1>Analytics</h1>

      <h2 className="admin-section-title">Stock on hand</h2>
      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card-featured">
          <p className="admin-stat-label">Stock value</p>
          <p className="admin-stat-value">{money(inventory.value)}</p>
          <p className="admin-stat-note">Units in stock × regular price</p>
        </div>
        {Math.abs(inventory.currentValue - inventory.value) >= 0.01 && (
          <div className="admin-stat-card">
            <p className="admin-stat-label">At today's prices</p>
            <p className="admin-stat-value">{money(inventory.currentValue)}</p>
            <p className="admin-stat-note">Counting sale prices that are live</p>
          </div>
        )}
        <div className="admin-stat-card">
          <p className="admin-stat-label">Units in stock</p>
          <p className="admin-stat-value">{inventory.units}</p>
          <p className="admin-stat-note">
            across {inventory.productsInStock} product{inventory.productsInStock === 1 ? '' : 's'}
          </p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Sold out</p>
          <p className="admin-stat-value">{inventory.soldOutSizes}</p>
          <p className="admin-stat-note">
            size{inventory.soldOutSizes === 1 ? '' : 's'}
            {inventory.soldOutProducts > 0
              ? ` · ${inventory.soldOutProducts} product${inventory.soldOutProducts === 1 ? '' : 's'} fully out`
              : ''}
          </p>
        </div>
      </div>
      <p className="admin-field-hint" style={{ marginTop: -8, marginBottom: 20 }}>
        Includes hidden products. This is retail value, because the shop does not store what you paid for each item.
      </p>

      {inventory.byCollection.length > 0 && inventory.value > 0 && (
        <div className="admin-chart-card">
          <h2>Stock value by collection</h2>
          <ResponsiveContainer width="100%" height={Math.max(120, inventory.byCollection.length * 52)}>
            <BarChart data={inventory.byCollection} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--light-gray)" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => `$${v}`} />
              <YAxis type="category" dataKey="name" width={110} fontSize={12} />
              <Tooltip formatter={(v) => money(v)} />
              <Bar dataKey="value" fill={CHART_COLOR} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="admin-chart-card">
        <h2>Where your stock value sits</h2>
        {inventory.rows.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No stock yet. Add sizes and stock to your products.</p>
        ) : (
          <>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Units</th>
                  <th>Price</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {(showAllStock ? inventory.rows : inventory.rows.slice(0, 8)).map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.name}
                      {r.hidden && <span className="admin-stock-warning"> · hidden</span>}
                    </td>
                    <td>{r.units}</td>
                    <td>{money(r.price)}</td>
                    <td>
                      <strong>{money(r.value)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventory.rows.length > 8 && (
              <button type="button" className="btn btn-secondary" style={{ marginTop: 14 }} onClick={() => setShowAllStock((v) => !v)}>
                {showAllStock ? 'Show fewer' : `Show all ${inventory.rows.length} products`}
              </button>
            )}
          </>
        )}
      </div>

      <h2 className="admin-section-title">Sales</h2>
      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <p className="admin-stat-label">Total revenue</p>
          <p className="admin-stat-value">${stats.revenue.toFixed(2)}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Total orders</p>
          <p className="admin-stat-value">{stats.orderCount}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Pending</p>
          <p className="admin-stat-value">{stats.byStatus.pending || 0}</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Delivered</p>
          <p className="admin-stat-value">{stats.byStatus.delivered || 0}</p>
        </div>
      </div>

      <div className="admin-chart-card">
        <h2>Revenue — last 14 days</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={stats.revenueByDay}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--light-gray)" />
            <XAxis dataKey="day" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
            <Line type="monotone" dataKey="revenue" stroke={CHART_COLOR} strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-chart-card">
        <h2>Top products</h2>
        {stats.topProducts.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No sales yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.topProducts} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--light-gray)" />
              <XAxis type="number" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={140} fontSize={12} />
              <Tooltip />
              <Bar dataKey="qty" fill={CHART_COLOR_2} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

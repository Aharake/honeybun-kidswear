import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import './Admin.css'

const CHART_COLOR = '#E8A7B3'
const CHART_COLOR_2 = '#8FA8C9'

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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .then(({ data, error }) => {
        if (error) console.error(error)
        setOrders(data || [])
        setLoading(false)
      })
  }, [])

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

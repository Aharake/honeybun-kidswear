import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabaseClient'
import './Admin.css'

const CHART_COLOR = '#E0972C'
const CHART_COLOR_2 = '#8FA8C9'
const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

// Calendar days in Beirut time, oldest first, so the chart has no gaps.
function lastDays(n) {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' })
  const days = []
  for (let i = n - 1; i >= 0; i--) days.push(fmt.format(new Date(Date.now() - i * 86400000)))
  return days
}

const num = (n) => Number(n || 0).toLocaleString()

export default function VisitorStats() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState(null) // null = loading
  const [state, setState] = useState('loading') // loading | ready | missing | error

  useEffect(() => {
    let active = true
    supabase.rpc('site_analytics', { p_days: days }).then(({ data: result, error }) => {
      if (!active) return
      if (error) {
        const missing = ['PGRST202', '42883', '42P01'].includes(error.code) || /site_analytics|site_events/.test(error.message)
        setState(missing ? 'missing' : 'error')
        if (!missing) console.error(error)
        return
      }
      setData(result)
      setState('ready')
    })
    return () => {
      active = false
    }
  }, [days])

  const chart = useMemo(() => {
    if (!data) return []
    const byDay = Object.fromEntries((data.by_day || []).map((d) => [d.day, d]))
    return lastDays(days).map((day) => ({
      day: day.slice(5),
      full: day,
      visits: byDay[day]?.visits || 0,
      views: byDay[day]?.views || 0,
    }))
  }, [data, days])

  const today = chart[chart.length - 1]

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: 14 }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>Visitors</h2>
        <div className="admin-range">
          {RANGES.map((r) => (
            <button key={r.days} type="button" className={days === r.days ? 'is-active' : ''} onClick={() => setDays(r.days)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {state === 'missing' && (
        <div className="admin-chart-card">
          <p style={{ color: 'var(--text-muted)' }}>
            Visitor tracking isn't switched on yet. Run the latest <strong>schema.sql</strong> in Supabase (SQL Editor) and
            this section will start counting visits.
          </p>
        </div>
      )}

      {state === 'error' && (
        <div className="admin-chart-card">
          <p style={{ color: 'var(--text-muted)' }}>Couldn't load visitor numbers right now. Try again in a moment.</p>
        </div>
      )}

      {state === 'ready' && data && (
        <>
          <div className="admin-stat-grid">
            <div className="admin-stat-card admin-stat-card-featured">
              <p className="admin-stat-label">Visits</p>
              <p className="admin-stat-value">{num(data.visits)}</p>
              <p className="admin-stat-note">{today ? `${num(today.visits)} today` : 'last ' + days + ' days'}</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Unique visitors</p>
              <p className="admin-stat-value">{num(data.visitors)}</p>
              <p className="admin-stat-note">different people / devices</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Product views</p>
              <p className="admin-stat-value">{num(data.product_views)}</p>
              <p className="admin-stat-note">{num(data.page_views)} page views in total</p>
            </div>
            <div className="admin-stat-card">
              <p className="admin-stat-label">Added to bag</p>
              <p className="admin-stat-value">{num(data.add_to_cart)}</p>
              <p className="admin-stat-note">
                {data.product_views > 0 ? `${Math.round((data.add_to_cart / data.product_views) * 100)}% of product views` : 'no views yet'}
              </p>
            </div>
          </div>
          <p className="admin-field-hint" style={{ marginTop: -8, marginBottom: 20 }}>
            A visit is one person coming to the shop in one browsing session. Your own visits while signed in as admin are not counted.
          </p>

          <div className="admin-chart-card">
            <h2>Visits per day</h2>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--light-gray)" />
                <XAxis dataKey="day" fontSize={12} interval="preserveStartEnd" minTickGap={24} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip labelFormatter={(_, p) => p?.[0]?.payload?.full} />
                <Line type="monotone" dataKey="visits" name="Visits" stroke={CHART_COLOR} strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="views" name="Page views" stroke={CHART_COLOR_2} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="admin-chart-card">
            <h2>Most viewed items</h2>
            {(data.top_products || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No product views yet in this period.</p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Item</th>
                    <th>Views</th>
                    <th>Added to bag</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_products.map((p, i) => (
                    <tr key={p.product_id}>
                      <td>
                        {p.image ? <img src={p.image} alt="" className="admin-table-thumb" /> : <div className="admin-table-thumb" />}
                      </td>
                      <td>
                        <span className="admin-rank">{i + 1}</span> {p.name}
                      </td>
                      <td>
                        <strong>{num(p.views)}</strong>
                      </td>
                      <td>{num(p.adds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {state === 'loading' && <p>Loading visitor numbers…</p>}
    </div>
  )
}

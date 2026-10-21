import { useMemo, useState } from 'react'
import { orderDeliveryFee } from '../../lib/pricing'
import './Admin.css'

const RANGES = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'all', label: 'All time', days: null },
]

const money = (n) => `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Calendar day in Beirut time, so "today" matches the shop's own day.
const beirutDay = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Beirut' }).format(date)

export default function SalesTotals({ orders }) {
  const [range, setRange] = useState('30')

  const totals = useMemo(() => {
    const days = RANGES.find((r) => r.key === range).days
    const firstDay = days ? beirutDay(new Date(Date.now() - (days - 1) * 86400000)) : null

    // Cancelled orders were never paid, so they are left out.
    const counted = orders.filter(
      (o) => o.status !== 'cancelled' && (!firstDay || beirutDay(new Date(o.created_at)) >= firstDay)
    )

    let withDelivery = 0
    let delivery = 0
    let discounts = 0
    counted.forEach((o) => {
      withDelivery += Number(o.total)
      delivery += orderDeliveryFee(o)
      discounts += Number(o.discount_amount || 0)
    })
    return {
      orders: counted.length,
      withDelivery,
      delivery,
      withoutDelivery: withDelivery - delivery,
      discounts,
    }
  }, [orders, range])

  return (
    <div>
      <div className="admin-header-row" style={{ marginBottom: 14 }}>
        <h2 className="admin-section-title" style={{ margin: 0 }}>Total sales</h2>
        <div className="admin-range">
          {RANGES.map((r) => (
            <button key={r.key} type="button" className={range === r.key ? 'is-active' : ''} onClick={() => setRange(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card admin-stat-card-featured">
          <p className="admin-stat-label">Total sales, with delivery</p>
          <p className="admin-stat-value">{money(totals.withDelivery)}</p>
          <p className="admin-stat-note">
            {totals.orders} order{totals.orders === 1 ? '' : 's'}: everything customers pay
          </p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Total sales, without delivery</p>
          <p className="admin-stat-value">{money(totals.withoutDelivery)}</p>
          <p className="admin-stat-note">just the clothes, after discounts</p>
        </div>
        <div className="admin-stat-card">
          <p className="admin-stat-label">Delivery fees</p>
          <p className="admin-stat-value">{money(totals.delivery)}</p>
          <p className="admin-stat-note">the difference between the two</p>
        </div>
      </div>
      <p className="admin-field-hint" style={{ marginTop: -8, marginBottom: 20 }}>
        Cancelled orders aren't counted.
        {totals.discounts > 0 && ` Discount codes took ${money(totals.discounts)} off these orders; that is already out of the numbers above.`}
      </p>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { salePriceFor } from '../../lib/pricing'
import SaleBanner from '../../components/SaleBanner'
import './Admin.css'

const DEFAULT_SETTINGS = {
  is_active: false,
  percent_off: 20,
  banner_title: 'The Honeybun Sale',
  banner_text: 'Sweet savings on cozy favourites — for a limited time.',
  banner_cta: 'Shop the sale',
}

function rowResult(row, percent) {
  const price = Number(row.price)
  const raw = row.sale_input === '' ? salePriceFor({ price, sale_price: null }, percent) : Number(row.sale_input)
  const valid = raw > 0 && raw < price
  return { price, salePrice: raw, valid, percentOff: valid ? Math.round((1 - raw / price) * 100) : 0 }
}

export default function AdminSale() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [rows, setRows] = useState([])
  const [original, setOriginal] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('sale_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('products').select('id, name, price, images, on_sale, sale_price').order('created_at', { ascending: false }),
    ]).then(([s, p]) => {
      if (s.error) setError('Sale settings are not set up yet — run the latest schema.sql in Supabase.')
      if (s.data) setSettings({ ...DEFAULT_SETTINGS, ...s.data })
      const mapped = (p.data || []).map((x) => ({
        id: x.id,
        name: x.name,
        price: x.price,
        image: x.images?.[0],
        on_sale: Boolean(x.on_sale),
        sale_input: x.sale_price === null || x.sale_price === undefined ? '' : String(x.sale_price),
      }))
      setRows(mapped)
      setOriginal(Object.fromEntries(mapped.map((r) => [r.id, `${r.on_sale}|${r.sale_input}`])))
      setLoading(false)
    })
  }, [])

  const percent = Number(settings.percent_off) || 0

  const previewPercent = useMemo(() => {
    const included = rows.filter((r) => r.on_sale).map((r) => rowResult(r, percent).percentOff)
    return Math.max(0, ...included) || percent
  }, [rows, percent])

  const setSetting = (name, value) => setSettings((s) => ({ ...s, [name]: value }))
  const updateRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const handleSave = async () => {
    setError('')
    setMessage('')

    if (percent < 1 || percent > 90) {
      setError('Choose a sale percentage between 1 and 90.')
      return
    }
    const bad = rows.find((r) => r.on_sale && !rowResult(r, percent).valid)
    if (bad) {
      setError(`"${bad.name}" needs a sale price that is above $0 and below its regular price.`)
      return
    }

    setSaving(true)
    const { error: settingsError } = await supabase
      .from('sale_settings')
      .update({
        is_active: settings.is_active,
        percent_off: percent,
        banner_title: settings.banner_title.trim() || DEFAULT_SETTINGS.banner_title,
        banner_text: settings.banner_text.trim(),
        banner_cta: settings.banner_cta.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)

    const changed = rows.filter((r) => `${r.on_sale}|${r.sale_input}` !== original[r.id])
    const results = await Promise.all(
      changed.map((r) =>
        supabase
          .from('products')
          .update({ on_sale: r.on_sale, sale_price: r.sale_input === '' ? null : Number(r.sale_input) })
          .eq('id', r.id)
      )
    )
    setSaving(false)

    if (settingsError || results.some((r) => r.error)) {
      setError('Something did not save. Check that the latest schema.sql has been run, then try again.')
      return
    }
    setOriginal(Object.fromEntries(rows.map((r) => [r.id, `${r.on_sale}|${r.sale_input}`])))
    setMessage(settings.is_active ? 'Saved — the sale is live on your website.' : 'Saved — the sale is switched off.')
  }

  if (loading) return <p>Loading…</p>

  const allOn = rows.length > 0 && rows.every((r) => r.on_sale)

  return (
    <div>
      <div className="admin-header-row">
        <h1>Sale</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save sale'}
        </button>
      </div>

      {error && <p className="checkout-error" style={{ marginBottom: 12 }}>{error}</p>}
      {message && <p className="admin-success">{message}</p>}

      <div className="admin-card">
        <label className="admin-switch">
          <input type="checkbox" checked={settings.is_active} onChange={(e) => setSetting('is_active', e.target.checked)} />
          <span className="admin-switch-track" />
          <span>
            <strong>{settings.is_active ? 'Sale is ON' : 'Sale is OFF'}</strong>
            <span className="admin-field-hint" style={{ display: 'block', marginBottom: 0 }}>
              When on, the banner appears on the homepage and the selected products show their sale price.
            </span>
          </span>
        </label>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">Sale banner</h2>
        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="banner_title">Headline</label>
            <input id="banner_title" value={settings.banner_title} onChange={(e) => setSetting('banner_title', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="percent_off">Default sale percentage (%)</label>
            <input id="percent_off" type="number" min="1" max="90" value={settings.percent_off} onChange={(e) => setSetting('percent_off', e.target.value)} />
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="banner_text">Banner text</label>
          <input id="banner_text" value={settings.banner_text} onChange={(e) => setSetting('banner_text', e.target.value)} />
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label htmlFor="banner_cta">Button text (leave empty for no button)</label>
          <input id="banner_cta" value={settings.banner_cta} onChange={(e) => setSetting('banner_cta', e.target.value)} />
        </div>

        <p className="admin-field-hint" style={{ marginTop: 16 }}>
          Preview — the "Up to {previewPercent}% off" badge is worked out from your selected products below.
        </p>
        <div className="admin-banner-preview">
          <SaleBanner title={settings.banner_title} text={settings.banner_text} cta={settings.banner_cta} percent={previewPercent} to="#" />
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-header-row" style={{ marginBottom: 8 }}>
          <h2 className="admin-card-title" style={{ margin: 0 }}>Products in the sale</h2>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setRows((rs) => rs.map((r) => ({ ...r, on_sale: !allOn })))}
          >
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <p className="admin-field-hint">
          Tick the products to include. They get the default percentage off — or type an exact new price to override it for one product.
        </p>

        {rows.length === 0 ? (
          <p>No products yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th></th>
                <th>Product</th>
                <th>Regular price</th>
                <th>Custom sale price</th>
                <th>Customers pay</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const res = rowResult(r, percent)
                return (
                  <tr key={r.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={r.on_sale}
                        onChange={(e) => updateRow(r.id, { on_sale: e.target.checked })}
                        aria-label={`Include ${r.name} in the sale`}
                        style={{ width: 'auto' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {r.image ? <img src={r.image} alt="" className="admin-table-thumb" /> : <div className="admin-table-thumb" />}
                        {r.name}
                      </div>
                    </td>
                    <td>${Number(r.price).toFixed(2)}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={`${salePriceFor({ price: r.price, sale_price: null }, percent).toFixed(2)} (auto)`}
                        value={r.sale_input}
                        disabled={!r.on_sale}
                        onChange={(e) => updateRow(r.id, { sale_input: e.target.value })}
                        style={{ width: 130 }}
                      />
                    </td>
                    <td>
                      {r.on_sale ? (
                        res.valid ? (
                          <span>
                            <strong>${res.salePrice.toFixed(2)}</strong> <span className="admin-stock-warning">(−{res.percentOff}%)</span>
                          </span>
                        ) : (
                          <span className="admin-stock-warning">Price must be below ${Number(r.price).toFixed(2)}</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

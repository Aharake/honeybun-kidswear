import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { DEFAULT_META_PIXEL_ID, ID_FORMATS, SETTING_KEYS, loadMarketingIds } from '../../lib/marketing'
import './Admin.css'

const FIELDS = [
  {
    name: 'meta',
    title: 'Meta Pixel ID',
    placeholder: '1234567890123456',
    help: 'Meta Events Manager → your Pixel. A 15 to 16 digit number. Lets Meta Ads see visits, add-to-bag and orders.',
    bad: 'Use only the digits, usually 15 or 16 of them.',
  },
  {
    name: 'ga4',
    title: 'Google Analytics 4 Measurement ID',
    placeholder: 'G-XXXXXXXXXX',
    help: 'analytics.google.com → Admin → Data streams → your web stream. Starts with G-.',
    bad: 'It should look like G-ABC123XYZ4.',
  },
  {
    name: 'gtm',
    title: 'Google Tag Manager Container ID',
    placeholder: 'GTM-XXXXXXX',
    help: 'tagmanager.google.com → your container. Starts with GTM-. If you use this, set Google Analytics up inside Tag Manager and leave the box above empty.',
    bad: 'It should look like GTM-ABC1234.',
  },
]

export default function AdminTracking() {
  const [saved, setSaved] = useState({ meta: '', ga4: '', gtm: '' })
  const [form, setForm] = useState({ meta: '', ga4: '', gtm: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    loadMarketingIds().then(({ ids, tableMissing: missing }) => {
      setSaved(ids)
      setForm(ids)
      setTableMissing(missing)
      setLoading(false)
    })
  }, [])

  const clean = (name, value) => (name === 'meta' ? value.replace(/\s+/g, '') : value.replace(/\s+/g, '').toUpperCase())
  const set = (name, value) => {
    setMessage('')
    setError('')
    setForm((f) => ({ ...f, [name]: clean(name, value) }))
  }
  const invalid = (name) => form[name] !== '' && !ID_FORMATS[name].test(form[name])
  const dirty = FIELDS.some((f) => form[f.name] !== saved[f.name])
  const anyInvalid = FIELDS.some((f) => invalid(f.name))

  const handleSave = async (e) => {
    e.preventDefault()
    if (anyInvalid) return
    setSaving(true)
    setError('')
    setMessage('')
    const rows = FIELDS.filter((f) => form[f.name] !== saved[f.name]).map((f) => ({
      key: SETTING_KEYS[f.name],
      value: form[f.name],
      updated_at: new Date().toISOString(),
    }))
    const { error: saveError } = await supabase.from('site_settings').upsert(rows, { onConflict: 'key' })
    setSaving(false)
    if (saveError) {
      console.error(saveError)
      setError(
        /site_settings/.test(saveError.message) || saveError.code === '42P01' || saveError.code === 'PGRST205'
          ? 'Your database is missing the tracking settings. Run the latest schema.sql in Supabase (SQL Editor), then save again.'
          : 'Could not save. Check that each ID is typed correctly and try again.'
      )
      return
    }
    setSaved({ ...form })
    setMessage('Saved. The shop uses the new settings the next time a visitor opens it.')
  }

  if (loading) return <p>Loading…</p>

  const googleConflict = form.gtm && form.ga4

  return (
    <div>
      <h1>Tracking &amp; ads</h1>
      <p className="admin-field-hint" style={{ marginBottom: 18 }}>
        Paste the IDs from Meta and Google here. The shop starts using them straight away, with no code change or redeploy.
        Leave a box empty to switch that tool off. Your own visits while signed in as admin are never counted.
      </p>

      {tableMissing && (
        <p className="checkout-error" style={{ marginBottom: 16 }}>
          Your database doesn't have the tracking settings yet. Run the latest <strong>schema.sql</strong> in Supabase (SQL Editor),
          then reload. Until then the Meta Pixel keeps using the ID it already had.
        </p>
      )}

      <form className="admin-form" onSubmit={handleSave}>
        {FIELDS.map((f) => (
          <div className="field" key={f.name}>
            <label htmlFor={`id-${f.name}`}>
              {f.title}
              <span className={`admin-status ${saved[f.name] ? 'is-on' : ''}`}>{saved[f.name] ? 'On' : 'Off'}</span>
            </label>
            <input
              id={`id-${f.name}`}
              value={form[f.name]}
              placeholder={f.placeholder}
              onChange={(e) => set(f.name, e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={invalid(f.name)}
            />
            <p className="admin-field-hint" style={{ marginBottom: 0 }}>{f.help}</p>
            {invalid(f.name) && <p className="admin-stock-warning" style={{ marginTop: 4 }}>{f.bad}</p>}
            {f.name === 'meta' && saved.meta === DEFAULT_META_PIXEL_ID && !tableMissing && (
              <p className="admin-field-hint" style={{ marginTop: 4, marginBottom: 0 }}>
                This is the Pixel the shop was set up with. Replace it any time.
              </p>
            )}
          </div>
        ))}

        {googleConflict && (
          <p className="admin-stock-warning">
            Both Google boxes are filled in. To avoid counting everything twice, the shop will use Tag Manager only and ignore
            the Google Analytics box. Put Google Analytics inside Tag Manager.
          </p>
        )}

        {error && <p className="checkout-error">{error}</p>}
        {message && <p className="admin-saved-note">{message}</p>}

        <button className="btn btn-primary" type="submit" disabled={saving || !dirty || anyInvalid}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      <div className="admin-chart-card" style={{ marginTop: 28 }}>
        <h2>What the shop sends</h2>
        <p className="admin-field-hint" style={{ marginBottom: 0 }}>
          Page views, product views, add to bag, start of checkout and completed orders, with the order value (delivery included).
          Never names, phone numbers, addresses or emails. Google gets the same events in the standard Analytics shopping format
          (view_item, add_to_cart, begin_checkout, purchase).
        </p>
      </div>
    </div>
  )
}

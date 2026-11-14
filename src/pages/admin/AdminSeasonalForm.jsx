import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { supabase, slugify, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import { resizeImage, uploadName } from '../../lib/resizeImage'
import SeasonBanner from '../../components/SeasonBanner'
import './Admin.css'

const EMPTY = { name: '', slug: '', tagline: '', banner_url: '', show_on_home: true, is_active: true, sort_order: 0 }

export default function AdminSeasonalForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [selected, setSelected] = useState(() => new Set())
  const [initial, setInitial] = useState(() => new Set())
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      const prodRes = await supabase
        .from('products')
        .select('id, name, category, images, seasonal_collections')
        .order('created_at', { ascending: false })
      const list = prodRes.data || []

      let slug = ''
      if (isEdit) {
        const { data, error: fetchError } = await supabase.from('seasonal_collections').select('*').eq('id', id).single()
        if (!active) return
        if (fetchError) {
          setError('Could not load this collection.')
        } else {
          setForm({ ...EMPTY, ...data, banner_url: data.banner_url || '' })
          slug = data.slug
        }
      }
      if (!active) return
      setProducts(list)
      const members = new Set(slug ? list.filter((p) => (p.seasonal_collections || []).includes(slug)).map((p) => p.id) : [])
      setSelected(new Set(members))
      setInitial(members)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [id, isEdit])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm((f) => ({ ...f, name, slug: isEdit ? f.slug : slugify(name) }))
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const blob = await resizeImage(file, 1600, 0.82)
    const { name, contentType } = uploadName(file, blob)
    const path = `seasonal/${form.slug || 'collection'}-${name}`
    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, blob, { contentType })
    if (uploadError) {
      setError(`Failed to upload the banner: ${uploadError.message}`)
    } else {
      const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
      setForm((f) => ({ ...f, banner_url: data.publicUrl }))
    }
    setUploading(false)
    e.target.value = ''
  }

  const toggleProduct = (productId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q)) : products
  }, [products, search])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const name = form.name.trim()
    const slug = form.slug.trim() || slugify(name)
    const payload = {
      name,
      slug,
      tagline: form.tagline.trim(),
      banner_url: form.banner_url || null,
      show_on_home: form.show_on_home,
      is_active: form.is_active,
      sort_order: Number(form.sort_order) || 0,
    }

    const request = isEdit
      ? supabase.from('seasonal_collections').update(payload).eq('id', id)
      : supabase.from('seasonal_collections').insert([payload])
    const { error: saveError } = await request
    if (saveError) {
      console.error(saveError)
      setSaving(false)
      setError(
        saveError.message.includes('duplicate')
          ? 'A seasonal collection with this name already exists.'
          : /seasonal_collections/.test(saveError.message)
          ? 'Your database is missing seasonal collections. Run the latest schema.sql in Supabase (SQL Editor), then save again.'
          : 'Could not save this collection.'
      )
      return
    }

    // Add or remove the label on every product whose tick changed
    const changed = products.filter((p) => selected.has(p.id) !== initial.has(p.id))
    const results = await Promise.all(
      changed.map((p) => {
        const current = p.seasonal_collections || []
        const next = selected.has(p.id) ? [...new Set([...current, slug])] : current.filter((s) => s !== slug)
        return supabase.from('products').update({ seasonal_collections: next }).eq('id', p.id)
      })
    )
    const failed = results.filter((r) => r.error).length
    if (failed > 0) {
      console.error(results.find((r) => r.error)?.error)
      setSaving(false)
      setError(`The collection was saved, but ${failed} product${failed === 1 ? '' : 's'} could not be updated. Run the latest schema.sql in Supabase, then try again.`)
      return
    }

    setSaving(false)
    navigate('/admin/seasonal')
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1>{isEdit ? 'Edit seasonal collection' : 'Add seasonal collection'}</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required placeholder="e.g. Winter" value={form.name} onChange={handleNameChange} />
        </div>

        <div className="field">
          <label htmlFor="tagline">Tagline (shown on the banner)</label>
          <input id="tagline" name="tagline" placeholder="e.g. Cozy layers for cold days" value={form.tagline} onChange={handleChange} />
        </div>

        <div className="field">
          <label htmlFor="banner">Banner photo</label>
          <input id="banner" type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
          <p className="admin-field-hint">A wide photo works best. The text sits over the left side.</p>
          {uploading && <p className="admin-field-hint">Uploading…</p>}
          {form.banner_url && (
            <button type="button" className="btn btn-secondary" style={{ alignSelf: 'flex-start' }} onClick={() => setForm((f) => ({ ...f, banner_url: '' }))}>
              <X size={14} /> Remove photo
            </button>
          )}
        </div>

        <div className="field">
          <label>How the banner looks</label>
          <SeasonBanner collection={{ ...form, name: form.name || 'Collection name' }} compact />
        </div>

        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="sort_order">Display order</label>
            <input id="sort_order" name="sort_order" type="number" value={form.sort_order} onChange={handleChange} />
          </div>
        </div>
        <div className="field admin-checkbox-field">
          <input id="show_on_home" name="show_on_home" type="checkbox" checked={form.show_on_home} onChange={handleChange} style={{ width: 'auto' }} />
          <label htmlFor="show_on_home" style={{ margin: 0 }}>Show the banner on the home page</label>
        </div>
        <div className="field admin-checkbox-field">
          <input id="is_active" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} style={{ width: 'auto' }} />
          <label htmlFor="is_active" style={{ margin: 0 }}>Visible in the shop</label>
        </div>

        <div className="field">
          <label>Clothes in this collection ({selected.size} chosen)</label>
          <p className="admin-field-hint">
            Tick any product, whatever its Girls or Boys collection. They stay where they are and also appear here.
          </p>
          <div className="admin-picker-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>
          <div className="admin-picker" role="group" aria-label="Products">
            {visibleProducts.length === 0 && <p className="admin-field-hint" style={{ padding: 12 }}>No products match.</p>}
            {visibleProducts.map((p) => (
              <label key={p.id} className={`admin-picker-row ${selected.has(p.id) ? 'is-selected' : ''}`}>
                <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.images?.[0] ? <img src={p.images[0]} alt="" loading="lazy" /> : <span className="admin-picker-noimg" />}
                <span className="admin-picker-name">{p.name}</span>
                <span className="admin-picker-cat">{p.category}</span>
              </label>
            ))}
          </div>
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add collection'}
        </button>
      </form>
    </div>
  )
}

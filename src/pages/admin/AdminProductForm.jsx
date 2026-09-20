import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase, slugify, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import { SIZE_OPTIONS, sortSizeStock } from '../../lib/constants'
import './Admin.css'

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compare_at_price: '',
  category: '',
  size_stock: [],
  images: [],
  is_active: true,
  saleOn: false,
  product_sale_price: '',
  hasSaleColumn: false,
}

export default function AdminProductForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [collections, setCollections] = useState([])

  useEffect(() => {
    supabase
      .from('collections')
      .select('name')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const names = (data || []).map((c) => c.name)
        setCollections(names)
        setForm((f) => (f.category ? f : { ...f, category: names[0] || '' }))
      })
  }, [])

  useEffect(() => {
    if (!isEdit) return
    supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Could not load product.')
        } else {
          setForm({
            ...EMPTY,
            ...data,
            size_stock: sortSizeStock(data.size_stock),
            saleOn: data.product_sale_price !== null && data.product_sale_price !== undefined,
            product_sale_price: data.product_sale_price ?? '',
            hasSaleColumn: 'product_sale_price' in data,
          })
        }
        setLoading(false)
      })
  }, [id, isEdit])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleNameChange = (e) => {
    const name = e.target.value
    setForm((f) => ({ ...f, name, slug: f.slugTouched ? f.slug : slugify(name) }))
  }

  const toggleSize = (size) => {
    setForm((f) => {
      const exists = f.size_stock.some((s) => s.size === size)
      const next = exists
        ? f.size_stock.filter((s) => s.size !== size)
        : sortSizeStock([...f.size_stock, { size, stock: 0 }])
      return { ...f, size_stock: next }
    })
  }

  const updateStock = (size, stock) => {
    const qty = Math.max(0, Number(stock) || 0)
    setForm((f) => ({
      ...f,
      size_stock: f.size_stock.map((s) => (s.size === size ? { ...s, stock: qty } : s)),
    }))
  }

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploading(true)
    setError('')

    const uploaded = []
    for (const file of files) {
      const path = `${form.slug || 'product'}/${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file)
      if (uploadError) {
        setError(`Failed to upload ${file.name}: ${uploadError.message}`)
        continue
      }
      const { data: publicUrlData } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
      uploaded.push(publicUrlData.publicUrl)
    }

    setForm((f) => ({ ...f, images: [...f.images, ...uploaded] }))
    setUploading(false)
    e.target.value = ''
  }

  const removeImage = (url) => {
    setForm((f) => ({ ...f, images: f.images.filter((img) => img !== url) }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const price = Number(form.price) || 0
    const salePrice = Number(form.product_sale_price)
    if (form.saleOn && !(salePrice > 0 && salePrice < price)) {
      setError(`The sale price must be more than $0 and lower than the regular price ($${price.toFixed(2)}).`)
      return
    }
    setSaving(true)

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      price,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      category: form.category,
      size_stock: form.size_stock,
      images: form.images,
      is_active: form.is_active,
      ...(form.saleOn || form.hasSaleColumn
        ? { product_sale_price: form.saleOn ? salePrice : null }
        : {}),
    }

    const request = isEdit
      ? supabase.from('products').update(payload).eq('id', id)
      : supabase.from('products').insert([payload])

    const { error: saveError } = await request

    setSaving(false)

    if (saveError) {
      setError(saveError.message.includes('duplicate') ? 'A product with this slug already exists.' : 'Could not save product.')
      return
    }

    navigate('/admin/products')
  }

  if (loading) return <p>Loading…</p>

  return (
    <div>
      <h1>{isEdit ? 'Edit product' : 'Add product'}</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required value={form.name} onChange={handleNameChange} />
        </div>

        <div className="field">
          <label htmlFor="slug">Slug (used in the product URL)</label>
          <input
            id="slug"
            name="slug"
            required
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value), slugTouched: true }))}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" rows={4} value={form.description} onChange={handleChange} />
        </div>

        <div className="field">
          <label htmlFor="price">Regular price ($)</label>
          <input id="price" name="price" type="number" step="0.01" min="0" required value={form.price} onChange={handleChange} />
        </div>

        <div className="admin-sale-box">
          <label className="admin-switch">
            <input
              type="checkbox"
              checked={form.saleOn}
              onChange={(e) => setForm((f) => ({ ...f, saleOn: e.target.checked }))}
            />
            <span className="admin-switch-track" />
            <span>
              <strong>{form.saleOn ? 'This product is on sale' : 'Put this product on sale'}</strong>
              <span className="admin-field-hint" style={{ display: 'block', marginBottom: 0 }}>
                Shows the regular price crossed out, your sale price, and a Sale tag on the photo.
              </span>
            </span>
          </label>

          {form.saleOn && (
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="product_sale_price">Sale price ($)</label>
              <input
                id="product_sale_price"
                name="product_sale_price"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.product_sale_price}
                onChange={handleChange}
              />
              {Number(form.product_sale_price) > 0 && Number(form.product_sale_price) < Number(form.price) ? (
                <p className="admin-field-hint" style={{ marginTop: 6, marginBottom: 0 }}>
                  Customers pay ${Number(form.product_sale_price).toFixed(2)} instead of ${Number(form.price).toFixed(2)} (
                  −{Math.round((1 - Number(form.product_sale_price) / Number(form.price)) * 100)}%)
                </p>
              ) : (
                form.product_sale_price !== '' && (
                  <p className="admin-stock-warning" style={{ marginTop: 6 }}>
                    Must be lower than the regular price.
                  </p>
                )
              )}
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="category">Collection</label>
          <select id="category" name="category" required value={form.category} onChange={handleChange}>
            {form.category && !collections.includes(form.category) && (
              <option value={form.category}>{form.category} (not a collection)</option>
            )}
            {collections.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {collections.length === 0 && (
            <p className="admin-field-hint">Create a collection first under Collections in the sidebar.</p>
          )}
        </div>

        <div className="field">
          <label>Sizes &amp; stock</label>
          <p className="admin-field-hint">Tap a size to offer it, then set how many you have in stock.</p>
          <div className="admin-size-checks">
            {SIZE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                className={`admin-size-check ${form.size_stock.some((x) => x.size === s) ? 'is-active' : ''}`}
                onClick={() => toggleSize(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {form.size_stock.length > 0 && (
            <div className="admin-stock-grid">
              {form.size_stock.map((s) => (
                <div className="admin-stock-row" key={s.size}>
                  <span className="admin-stock-size">{s.size}</span>
                  <input
                    type="number"
                    min="0"
                    value={s.stock}
                    onChange={(e) => updateStock(s.size, e.target.value)}
                    aria-label={`Stock for size ${s.size}`}
                  />
                  {s.stock <= 0 && <span className="badge badge-cancelled">Sold out</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field">
          <label htmlFor="images">Product photos</label>
          <input id="images" type="file" accept="image/*" multiple onChange={handleUpload} disabled={uploading} />
          {uploading && <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Uploading…</p>}
          {form.images.length > 0 && (
            <div className="admin-images">
              {form.images.map((url) => (
                <div key={url} className="admin-image-thumb">
                  <img src={url} alt="" />
                  <button type="button" className="admin-image-remove" onClick={() => removeImage(url)} aria-label="Remove image">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="field admin-checkbox-field">
          <input id="is_active" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} style={{ width: 'auto' }} />
          <label htmlFor="is_active" style={{ margin: 0 }}>Visible in shop</label>
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={saving || uploading}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add product'}
        </button>
      </form>
    </div>
  )
}

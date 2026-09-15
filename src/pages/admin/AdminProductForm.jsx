import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase, slugify, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import './Admin.css'

const SIZE_OPTIONS = ['Newborn', '0-3M', '3-6M', '6-12M', '1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y']
const CATEGORY_OPTIONS = ['Newborn', 'Girls', 'Boys', 'Accessories']

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: '',
  compare_at_price: '',
  category: CATEGORY_OPTIONS[0],
  sizes: [],
  stock: 0,
  images: [],
  is_active: true,
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
          setForm({ ...EMPTY, ...data })
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
    setForm((f) => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter((s) => s !== size) : [...f.sizes, size],
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
    setSaving(true)
    setError('')

    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      price: Number(form.price) || 0,
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      category: form.category,
      sizes: form.sizes,
      stock: Number(form.stock) || 0,
      images: form.images,
      is_active: form.is_active,
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

        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="price">Price ($)</label>
            <input id="price" name="price" type="number" step="0.01" min="0" required value={form.price} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="compare_at_price">Compare-at price ($, optional)</label>
            <input
              id="compare_at_price"
              name="compare_at_price"
              type="number"
              step="0.01"
              min="0"
              value={form.compare_at_price ?? ''}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" value={form.category} onChange={handleChange}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="stock">Stock quantity</label>
            <input id="stock" name="stock" type="number" min="0" required value={form.stock} onChange={handleChange} />
          </div>
        </div>

        <div className="field">
          <label>Available sizes</label>
          <div className="admin-size-checks">
            {SIZE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                className={`admin-size-check ${form.sizes.includes(s) ? 'is-active' : ''}`}
                onClick={() => toggleSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
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

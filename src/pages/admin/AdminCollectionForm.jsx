import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase, slugify, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import { collectionImage } from '../../lib/collectionImages'
import './Admin.css'

const EMPTY = { name: '', slug: '', tagline: '', image_url: '', sort_order: 0, is_active: true }

export default function AdminCollectionForm() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [originalName, setOriginalName] = useState('')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isEdit) return
    supabase
      .from('collections')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: fetchError }) => {
        if (fetchError) {
          setError('Could not load collection.')
        } else {
          setForm({ ...EMPTY, ...data, image_url: data.image_url || '' })
          setOriginalName(data.name)
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
    setForm((f) => ({ ...f, name, slug: f.slugTouched || isEdit ? f.slug : slugify(name) }))
  }

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const path = `collections/${form.slug || 'collection'}-${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, file)
    if (uploadError) {
      setError(`Failed to upload image: ${uploadError.message}`)
    } else {
      const { data } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path)
      setForm((f) => ({ ...f, image_url: data.publicUrl }))
    }
    setUploading(false)
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const name = form.name.trim()
    const payload = {
      name,
      slug: form.slug.trim() || slugify(name),
      tagline: form.tagline.trim(),
      image_url: form.image_url || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }

    const request = isEdit
      ? supabase.from('collections').update(payload).eq('id', id)
      : supabase.from('collections').insert([payload])

    const { error: saveError } = await request

    if (saveError) {
      setSaving(false)
      setError(saveError.message.includes('duplicate') ? 'A collection with this name or slug already exists.' : 'Could not save collection.')
      return
    }

    if (isEdit && originalName && originalName !== name) {
      await supabase.from('products').update({ category: name }).eq('category', originalName)
    }

    setSaving(false)
    navigate('/admin/collections')
  }

  if (loading) return <p>Loading…</p>

  const preview = collectionImage(form)

  return (
    <div>
      <h1>{isEdit ? 'Edit collection' : 'Add collection'}</h1>

      <form className="admin-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" required placeholder="e.g. Girls, Newborn, Summer" value={form.name} onChange={handleNameChange} />
          {isEdit && originalName && form.name.trim() !== originalName && (
            <p className="admin-field-hint">Products in "{originalName}" will move to the new name automatically.</p>
          )}
        </div>

        <div className="field">
          <label htmlFor="tagline">Tagline (shown on the homepage card)</label>
          <input id="tagline" name="tagline" placeholder="e.g. Dresses, bows & playful prints" value={form.tagline} onChange={handleChange} />
        </div>

        <div className="field">
          <label htmlFor="image">Cover photo</label>
          <input id="image" type="file" accept="image/*" onChange={handleUpload} disabled={uploading} />
          {uploading && <p className="admin-field-hint">Uploading…</p>}
          {preview && (
            <div className="admin-images">
              <div className="admin-image-thumb" style={{ width: 120, height: 150 }}>
                <img src={preview} alt="" />
                {form.image_url && (
                  <button
                    type="button"
                    className="admin-image-remove"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    aria-label="Remove photo"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="sort_order">Display order</label>
            <input id="sort_order" name="sort_order" type="number" value={form.sort_order} onChange={handleChange} />
          </div>
          <div className="field admin-checkbox-field" style={{ alignSelf: 'end' }}>
            <input id="is_active" name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} style={{ width: 'auto' }} />
            <label htmlFor="is_active" style={{ margin: 0 }}>Visible in shop</label>
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

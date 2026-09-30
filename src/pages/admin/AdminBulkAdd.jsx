import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { supabase, slugify, PRODUCT_IMAGES_BUCKET } from '../../lib/supabaseClient'
import { SIZE_OPTIONS, sortSizeStock } from '../../lib/constants'
import { resizeImage } from '../../lib/resizeImage'
import './Admin.css'

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })

export default function AdminBulkAdd() {
  const navigate = useNavigate()
  const fileInput = useRef(null)
  const rowsRef = useRef([])

  const [rows, setRows] = useState([])
  const [collections, setCollections] = useState([])
  const [category, setCategory] = useState('')
  const [defaultPrice, setDefaultPrice] = useState('')
  const [sizeStock, setSizeStock] = useState([])
  const [stockEach, setStockEach] = useState(3)
  const [publish, setPublish] = useState(false)
  const [importText, setImportText] = useState('')
  const [importMsg, setImportMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')

  rowsRef.current = rows

  useEffect(() => {
    supabase
      .from('collections')
      .select('name')
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        const names = (data || []).map((c) => c.name)
        setCollections(names)
        setCategory((c) => c || names[0] || '')
      })
    return () => rowsRef.current.forEach((r) => URL.revokeObjectURL(r.url))
  }, [])

  const addFiles = (fileList) => {
    const files = Array.from(fileList || [])
      .filter((f) => f.type.startsWith('image/'))
      .sort(byName)
    if (files.length === 0) return
    setRows((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        url: URL.createObjectURL(file),
        name: '',
        description: '',
        price: '',
        merge: false,
      })),
    ])
    setError('')
  }

  const updateRow = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRow = (id) => {
    setRows((rs) => {
      const gone = rs.find((r) => r.id === id)
      if (gone) URL.revokeObjectURL(gone.url)
      return rs.filter((r) => r.id !== id)
    })
  }

  const toggleSize = (size) => {
    setSizeStock((prev) =>
      prev.some((s) => s.size === size)
        ? prev.filter((s) => s.size !== size)
        : sortSizeStock([...prev, { size, stock: Number(stockEach) || 0 }])
    )
  }

  const applyStockToAll = (value) => {
    setStockEach(value)
    const n = Math.max(0, Number(value) || 0)
    setSizeStock((prev) => prev.map((s) => ({ ...s, stock: n })))
  }

  const applyDescriptions = () => {
    let parsed
    try {
      parsed = JSON.parse(importText)
    } catch {
      setImportMsg('That doesn\'t look like valid JSON. Paste exactly what Claude gave you.')
      return
    }
    const entries = Array.isArray(parsed)
      ? parsed.map((p) => [p?.file || p?.filename, p])
      : Object.entries(parsed || {})
    const lookup = new Map()
    entries.forEach(([key, value]) => {
      if (!key || !value) return
      const k = String(key).toLowerCase()
      lookup.set(k, value)
      lookup.set(k.replace(/\.[^.]+$/, ''), value)
    })

    let matched = 0
    const next = rows.map((r) => {
      const k = r.file.name.toLowerCase()
      const v = lookup.get(k) || lookup.get(k.replace(/\.[^.]+$/, ''))
      if (!v) return r
      matched += 1
      return {
        ...r,
        name: v.name ?? r.name,
        description: v.description ?? r.description,
        price: v.price !== undefined ? String(v.price) : r.price,
      }
    })
    setRows(next)
    setImportMsg(`Filled in ${matched} of ${rows.length} photos.`)
  }

  const handleCreate = async () => {
    setError('')
    if (rows.length === 0) return setError('Add some photos first.')
    if (!category) return setError('Choose a collection (create one under Collections if the list is empty).')
    if (sizeStock.length === 0) return setError('Pick at least one size, otherwise customers can\'t buy these.')

    const groups = []
    rows.forEach((r, i) => {
      if (i > 0 && r.merge) groups[groups.length - 1].rows.push(r)
      else groups.push({ rows: [r] })
    })
    const built = groups.map((g) => ({
      files: g.rows.map((r) => r.file),
      name: (g.rows.find((r) => r.name.trim())?.name || '').trim(),
      description: (g.rows.find((r) => r.description.trim())?.description || '').trim(),
      price: Number(g.rows.find((r) => r.price !== '')?.price ?? defaultPrice) || 0,
    }))

    const noPrice = built.findIndex((g) => !(g.price > 0))
    if (noPrice >= 0) return setError(`Product ${noPrice + 1} has no price. Set a default price at the top or a price on that row.`)
    if (publish) {
      const noName = built.findIndex((g) => !g.name)
      if (noName >= 0) return setError(`Product ${noName + 1} needs a name before you can publish it. Or switch off "Publish right away" to save drafts.`)
    }

    setBusy(true)
    try {
      const { data: existing } = await supabase.from('products').select('slug')
      const taken = new Set((existing || []).map((p) => p.slug))
      const totalFiles = built.reduce((n, g) => n + g.files.length, 0)
      let done = 0
      let untitled = 0
      const toInsert = []

      for (const g of built) {
        const name = g.name || `Untitled product ${++untitled}`
        let slug = slugify(name) || 'product'
        let n = 2
        while (taken.has(slug)) slug = `${slugify(name) || 'product'}-${n++}`
        taken.add(slug)

        const urls = []
        for (const file of g.files) {
          setProgress(`Uploading photo ${done + 1} of ${totalFiles}…`)
          const blob = await resizeImage(file)
          const path = `${slug}/${Date.now()}-${done}.jpg`
          const { error: uploadError } = await supabase.storage
            .from(PRODUCT_IMAGES_BUCKET)
            .upload(path, blob, { contentType: 'image/jpeg' })
          if (uploadError) throw new Error(`Could not upload ${file.name}: ${uploadError.message}`)
          urls.push(supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl)
          done += 1
        }

        toInsert.push({
          name,
          slug,
          description: g.description,
          price: g.price,
          category,
          size_stock: sizeStock,
          images: urls,
          is_active: publish,
        })
      }

      setProgress('Creating products…')
      const { error: insertError } = await supabase.from('products').insert(toInsert)
      if (insertError) throw new Error(insertError.message)

      rows.forEach((r) => URL.revokeObjectURL(r.url))
      navigate('/admin/products')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Something went wrong.')
      setBusy(false)
      setProgress('')
    }
  }

  const productCount = rows.filter((r, i) => i === 0 || !r.merge).length

  return (
    <div>
      <div className="admin-header-row">
        <h1>Bulk add products</h1>
      </div>
      <p className="admin-field-hint" style={{ marginBottom: 16 }}>
        Add all your photos at once, set the collection, price and sizes one time, and create every product in one go.
        Photos are shrunk automatically so your site stays fast.
      </p>

      <div className="admin-card">
        <h2 className="admin-card-title">1. Choose your photos</h2>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <div
          className="bulk-drop"
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            addFiles(e.dataTransfer.files)
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
        >
          <strong>Drop photos here or click to choose</strong>
          <span>Select as many as you like — one product is created per photo.</span>
        </div>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">2. Settings for all of them</h2>
        <div className="admin-form-row">
          <div className="field">
            <label htmlFor="bulk-collection">Collection</label>
            <select id="bulk-collection" value={category} onChange={(e) => setCategory(e.target.value)}>
              {collections.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="bulk-price">Price ($)</label>
            <input id="bulk-price" type="number" step="0.01" min="0" value={defaultPrice} onChange={(e) => setDefaultPrice(e.target.value)} />
          </div>
        </div>

        <div className="field" style={{ marginTop: 14 }}>
          <label>Sizes you have for these</label>
          <div className="admin-size-checks">
            {SIZE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                className={`admin-size-check ${sizeStock.some((x) => x.size === s) ? 'is-active' : ''}`}
                onClick={() => toggleSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="bulk-stock">
            <label htmlFor="bulk-stock">In stock, for each size</label>
            <input id="bulk-stock" type="number" min="0" value={stockEach} onChange={(e) => applyStockToAll(e.target.value)} />
          </div>
          <p className="admin-field-hint" style={{ marginTop: 6 }}>You can fine-tune stock per size later by editing any product.</p>
        </div>

        <label className="admin-switch" style={{ marginTop: 16 }}>
          <input type="checkbox" checked={publish} onChange={(e) => setPublish(e.target.checked)} />
          <span className="admin-switch-track" />
          <span>
            <strong>{publish ? 'Publish right away' : 'Save as hidden drafts'}</strong>
            <span className="admin-field-hint" style={{ display: 'block', marginBottom: 0 }}>
              {publish ? 'Customers can see and buy these as soon as they\'re created.' : 'Recommended: check the names and prices first, then show them from each product.'}
            </span>
          </span>
        </label>
      </div>

      <div className="admin-card">
        <h2 className="admin-card-title">3. Names &amp; descriptions <span className="admin-optional">(optional)</span></h2>
        <p className="admin-field-hint">
          No names yet? Give Claude the photos and it will write a name and short description for each one as a block of text. Paste it here and click Fill in.
        </p>
        <textarea
          className="bulk-import"
          rows={4}
          placeholder='{"IMG_001.jpg": {"name": "...", "description": "..."}}'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
          <button type="button" className="btn btn-secondary" onClick={applyDescriptions} disabled={!importText.trim() || rows.length === 0}>
            Fill in
          </button>
          {importMsg && <span className="admin-field-hint" style={{ margin: 0 }}>{importMsg}</span>}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="admin-card">
          <h2 className="admin-card-title">{rows.length} photo{rows.length === 1 ? '' : 's'} → {productCount} product{productCount === 1 ? '' : 's'}</h2>
          <p className="admin-field-hint">Edit anything here. Tick "Same product as above" to put a photo on the product above it instead of making a new one.</p>
          <div className="bulk-rows">
            {rows.map((r, i) => (
              <div className={`bulk-row ${r.merge ? 'is-merged' : ''}`} key={r.id}>
                <img src={r.url} alt="" className="bulk-thumb" />
                <div className="bulk-fields">
                  {r.merge ? (
                    <p className="admin-field-hint" style={{ margin: 0 }}>Extra photo for the product above · {r.file.name}</p>
                  ) : (
                    <>
                      <input
                        placeholder={`Name (${r.file.name})`}
                        value={r.name}
                        onChange={(e) => updateRow(r.id, { name: e.target.value })}
                        aria-label="Product name"
                      />
                      <textarea
                        rows={2}
                        placeholder="Short description"
                        value={r.description}
                        onChange={(e) => updateRow(r.id, { description: e.target.value })}
                        aria-label="Description"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder={defaultPrice ? `Price (default $${defaultPrice})` : 'Price ($)'}
                        value={r.price}
                        onChange={(e) => updateRow(r.id, { price: e.target.value })}
                        aria-label="Price"
                        className="bulk-price"
                      />
                    </>
                  )}
                  {i > 0 && (
                    <label className="bulk-merge">
                      <input type="checkbox" checked={r.merge} onChange={(e) => updateRow(r.id, { merge: e.target.checked })} />
                      Same product as above
                    </label>
                  )}
                </div>
                <button type="button" className="admin-icon-btn" onClick={() => removeRow(r.id)} aria-label="Remove photo">
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <p className="checkout-error" style={{ marginBottom: 12 }}>{error}</p>}

      <button className="btn btn-primary" onClick={handleCreate} disabled={busy || rows.length === 0}>
        {busy ? progress || 'Working…' : `Create ${productCount || ''} product${productCount === 1 ? '' : 's'}`}
      </button>
    </div>
  )
}

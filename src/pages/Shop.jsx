import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { sizeRank, totalStock } from '../lib/constants'
import { useCollections } from '../hooks/useCollections'
import { useColors } from '../hooks/useColors'
import { useSale } from '../context/SaleContext'
import ProductCard from '../components/ProductCard'
import './Shop.css'

const hasSizeInStock = (product, size) =>
  (product.size_stock || []).some((s) => s.size === size && Number(s.stock) > 0)

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || ''
  const onSaleOnly = searchParams.get('sale') === '1'
  const color = searchParams.get('color') || ''
  const size = searchParams.get('size') || ''
  const { sale } = useSale()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState([])
  const { palette } = useColors()
  const { collections } = useCollections()

  // What is actually in stock across the whole shop, used to offer only the
  // colours and ages that have something to buy. If the database has no
  // colours column yet, fall back to ages only.
  useEffect(() => {
    let active = true
    const load = async () => {
      let { data, error } = await supabase.from('products').select('colors, size_stock').eq('is_active', true)
      if (error) ({ data } = await supabase.from('products').select('size_stock').eq('is_active', true))
      if (active) setAvailable(data || [])
    }
    load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)

    let request = supabase.from('products').select('*').eq('is_active', true)
    if (category) request = request.eq('category', category)
    if (color) request = request.contains('colors', [color])
    if (onSaleOnly) request = request.or('on_sale.eq.true,product_sale_price.not.is.null')
    const q = searchParams.get('q')
    if (q) request = request.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    request = request.order('created_at', { ascending: false })

    request.then(({ data, error }) => {
      if (!active) return
      if (error) console.error(error)
      setProducts(data || [])
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [category, onSaleOnly, color, searchParams])

  // Colours and ages that have stock, with how many products each.
  const { colorOptions, sizeOptions } = useMemo(() => {
    const colorCounts = {}
    const sizeCounts = {}
    available.forEach((p) => {
      if (totalStock(p.size_stock) > 0) {
        ;(p.colors || []).forEach((name) => {
          colorCounts[name] = (colorCounts[name] || 0) + 1
        })
      }
      new Set((p.size_stock || []).filter((s) => Number(s.stock) > 0).map((s) => s.size)).forEach((label) => {
        sizeCounts[label] = (sizeCounts[label] || 0) + 1
      })
    })
    return {
      colorOptions: palette.filter((c) => colorCounts[c.name]).map((c) => ({ ...c, count: colorCounts[c.name] })),
      sizeOptions: Object.entries(sizeCounts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => {
          const ra = sizeRank(a.label)
          const rb = sizeRank(b.label)
          return ra === rb ? 0 : ra < rb ? -1 : 1
        }),
    }
  }, [available, palette])

  // Picking an age or a colour means "show me what I can buy": the list keeps
  // only products that are in stock in that age, or in stock at all for a colour.
  const filtering = Boolean(size || color)
  const visible = useMemo(
    () =>
      products.filter(
        (p) => (!size || hasSizeInStock(p, size)) && (!color || totalStock(p.size_stock) > 0)
      ),
    [products, size, color]
  )

  const handleSearch = (e) => {
    e.preventDefault()
    const next = new URLSearchParams(searchParams)
    if (query) next.set('q', query)
    else next.delete('q')
    setSearchParams(next)
  }

  const setCategory = (cat) => {
    const next = new URLSearchParams(searchParams)
    if (cat) next.set('category', cat)
    else next.delete('category')
    next.delete('sale')
    setSearchParams(next)
  }

  const toggleParam = (key, value, current) => {
    const next = new URLSearchParams(searchParams)
    if (value && value !== current) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('color')
    next.delete('size')
    setSearchParams(next)
  }

  const showSale = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('category')
    next.set('sale', '1')
    setSearchParams(next)
  }

  return (
    <div className="container">
      <div className="shop-header">
        <div>
          <h1>Shop All</h1>
          {!loading && (
            <p className="shop-header-sub">
              {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
              {filtering ? ' in stock' : ''} · sized 1 to 14 years
            </p>
          )}
        </div>
        <form className="shop-search" onSubmit={handleSearch}>
          <Search size={18} />
          <input
            type="text"
            placeholder="Search for onesies, dresses, hats…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="shop-filters">
        <button className={`filter-pill ${!category && !onSaleOnly ? 'is-active' : ''}`} onClick={() => setCategory('')}>
          All
        </button>
        {sale?.is_active && (
          <button className={`filter-pill filter-pill-sale ${onSaleOnly ? 'is-active' : ''}`} onClick={showSale}>
            Sale
          </button>
        )}
        {collections.map((col) => (
          <button
            key={col.id}
            className={`filter-pill ${category === col.name ? 'is-active' : ''}`}
            onClick={() => setCategory(col.name)}
          >
            {col.name}
          </button>
        ))}
      </div>

      {(sizeOptions.length > 0 || colorOptions.length > 0) && (
        <div className="shop-refine">
          {sizeOptions.length > 0 && (
            <div className="shop-refine-row">
              <span className="shop-refine-label">Age</span>
              <div className="shop-age-list">
                {sizeOptions.map((s) => (
                  <button
                    key={s.label}
                    className={`age-pill ${size === s.label ? 'is-active' : ''}`}
                    onClick={() => toggleParam('size', s.label, size)}
                    aria-pressed={size === s.label}
                    title={`${s.count} in stock in ${s.label}`}
                  >
                    {s.label}
                    <span className="age-pill-count">{s.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {colorOptions.length > 0 && (
            <div className="shop-refine-row">
              <span className="shop-refine-label">Colour</span>
              <div className="shop-color-list">
                {colorOptions.map((c) => (
                  <button
                    key={c.name}
                    className={`color-dot ${color === c.name ? 'is-active' : ''}`}
                    onClick={() => toggleParam('color', c.name, color)}
                    aria-label={`Filter by ${c.name}`}
                    aria-pressed={color === c.name}
                    title={`${c.name} · ${c.count} in stock`}
                  >
                    <span className="color-swatch" style={{ background: c.hex }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtering && (
            <button className="color-clear" onClick={clearFilters}>
              {[size, color].filter(Boolean).join(' · ')} — Clear filters
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="shop-empty">Loading products…</p>
      ) : visible.length === 0 ? (
        <p className="shop-empty">
          {filtering
            ? 'Nothing is in stock for that choice right now. Try another age or colour.'
            : 'No products found. Try a different search or category.'}
          {filtering && (
            <>
              <br />
              <button className="color-clear" onClick={clearFilters}>Clear filters</button>
            </>
          )}
        </p>
      ) : (
        <div className="product-grid">
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

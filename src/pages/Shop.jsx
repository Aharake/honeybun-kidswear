import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
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
  const [filterOpen, setFilterOpen] = useState(false)
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

  useEffect(() => {
    if (!filterOpen) return
    const onKey = (e) => e.key === 'Escape' && setFilterOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [filterOpen])

  // Picking an age or a colour means "show me what I can buy": the list keeps
  // only products that are in stock in that age, or in stock at all for a colour.
  const filtering = Boolean(size || color)
  const activeCount = (size ? 1 : 0) + (color ? 1 : 0)
  const hasFilterOptions = sizeOptions.length > 0 || colorOptions.length > 0
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

      <div className="shop-toolbar">
        {hasFilterOptions && (
          <button
            className={`filter-button ${filtering ? 'is-active' : ''}`}
            onClick={() => setFilterOpen(true)}
            aria-haspopup="dialog"
          >
            <SlidersHorizontal size={16} />
            Filter
            {activeCount > 0 && <span className="filter-button-badge">{activeCount}</span>}
          </button>
        )}
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
      </div>

      {filtering && (
        <div className="active-filters">
          {size && (
            <button className="active-chip" onClick={() => toggleParam('size', size, size)} aria-label={`Remove age ${size}`}>
              Age {size} <X size={13} />
            </button>
          )}
          {color && (
            <button className="active-chip" onClick={() => toggleParam('color', color, color)} aria-label={`Remove colour ${color}`}>
              <span className="color-swatch" style={{ background: palette.find((c) => c.name === color)?.hex || '#ccc' }} />
              {color} <X size={13} />
            </button>
          )}
          <button className="color-clear" onClick={clearFilters}>Clear all</button>
        </div>
      )}

      <div className={`filter-backdrop ${filterOpen ? 'is-open' : ''}`} onClick={() => setFilterOpen(false)} />
      <aside
        className={`filter-drawer ${filterOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Filters"
        aria-hidden={!filterOpen}
        inert={!filterOpen}
      >
        <div className="filter-drawer-head">
          <h2>Filter</h2>
          <button className="filter-drawer-close" onClick={() => setFilterOpen(false)} aria-label="Close filters">
            <X size={22} />
          </button>
        </div>

        <div className="filter-drawer-body">
          <p className="filter-drawer-note">Showing only what's in stock right now.</p>

          {sizeOptions.length > 0 && (
            <section className="filter-group">
              <h3>Age</h3>
              <div className="filter-options">
                {sizeOptions.map((s) => (
                  <button
                    key={s.label}
                    className={`age-pill ${size === s.label ? 'is-active' : ''}`}
                    onClick={() => toggleParam('size', s.label, size)}
                    aria-pressed={size === s.label}
                  >
                    {s.label}
                    <span className="age-pill-count">{s.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {colorOptions.length > 0 && (
            <section className="filter-group">
              <h3>Colour</h3>
              <div className="filter-options">
                {colorOptions.map((c) => (
                  <button
                    key={c.name}
                    className={`color-chip ${color === c.name ? 'is-active' : ''}`}
                    onClick={() => toggleParam('color', c.name, color)}
                    aria-pressed={color === c.name}
                  >
                    <span className="color-swatch" style={{ background: c.hex }} />
                    {c.name}
                    <span className="age-pill-count">{c.count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="filter-drawer-foot">
          <button className="btn btn-secondary" onClick={clearFilters} disabled={!filtering}>
            Clear all
          </button>
          <button className="btn btn-primary" onClick={() => setFilterOpen(false)}>
            Show {visible.length} {visible.length === 1 ? 'piece' : 'pieces'}
          </button>
        </div>
      </aside>

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

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCollections } from '../hooks/useCollections'
import { COLOR_OPTIONS } from '../lib/constants'
import { useSale } from '../context/SaleContext'
import ProductCard from '../components/ProductCard'
import './Shop.css'

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || ''
  const onSaleOnly = searchParams.get('sale') === '1'
  const color = searchParams.get('color') || ''
  const { sale } = useSale()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [usedColors, setUsedColors] = useState([])
  const { collections } = useCollections()

  // Only offer colours that at least one live product actually has. If the
  // database has no colours column yet this errors and the filter just hides.
  useEffect(() => {
    supabase
      .from('products')
      .select('colors')
      .eq('is_active', true)
      .then(({ data, error }) => {
        if (error) return
        const used = new Set((data || []).flatMap((p) => p.colors || []))
        setUsedColors(COLOR_OPTIONS.filter((c) => used.has(c.name)))
      })
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

  const setColor = (name) => {
    const next = new URLSearchParams(searchParams)
    if (name && name !== color) next.set('color', name)
    else next.delete('color')
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
              {products.length} {products.length === 1 ? 'piece' : 'pieces'} · sized newborn to 6 years
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

      {usedColors.length > 0 && (
        <div className="shop-color-filter">
          <span className="shop-color-label">Colour</span>
          {usedColors.map((c) => (
            <button
              key={c.name}
              className={`color-dot ${color === c.name ? 'is-active' : ''}`}
              onClick={() => setColor(c.name)}
              aria-label={`Filter by ${c.name}`}
              aria-pressed={color === c.name}
              title={c.name}
            >
              <span className="color-swatch" style={{ background: c.hex }} />
            </button>
          ))}
          {color && (
            <button className="color-clear" onClick={() => setColor('')}>
              {color} · Clear
            </button>
          )}
        </div>
      )}

      {loading ? (
        <p className="shop-empty">Loading products…</p>
      ) : products.length === 0 ? (
        <p className="shop-empty">No products found. Try a different search or category.</p>
      ) : (
        <div className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

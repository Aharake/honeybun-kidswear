import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCollections } from '../hooks/useCollections'
import { useSale } from '../context/SaleContext'
import ProductCard from '../components/ProductCard'
import './Shop.css'

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || ''
  const onSaleOnly = searchParams.get('sale') === '1'
  const { sale } = useSale()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const { collections } = useCollections()

  useEffect(() => {
    let active = true
    setLoading(true)

    let request = supabase.from('products').select('*').eq('is_active', true)
    if (category) request = request.eq('category', category)
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
  }, [category, onSaleOnly, searchParams])

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

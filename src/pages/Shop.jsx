import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import './Shop.css'

const CATEGORIES = ['Newborn', 'Girls', 'Boys', 'Accessories']

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') || ''
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    let request = supabase.from('products').select('*').eq('is_active', true)
    if (category) request = request.eq('category', category)
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
  }, [category, searchParams])

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
    setSearchParams(next)
  }

  return (
    <div className="container">
      <div className="shop-header">
        <h1>Shop All</h1>
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
        <button className={`filter-pill ${!category ? 'is-active' : ''}`} onClick={() => setCategory('')}>
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`filter-pill ${category === cat ? 'is-active' : ''}`}
            onClick={() => setCategory(cat)}
          >
            {cat}
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

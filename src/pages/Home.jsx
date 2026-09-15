import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import ProductCard from '../components/ProductCard'
import './Home.css'

const CATEGORIES = ['Newborn', 'Girls', 'Boys', 'Accessories']

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(4)
      .then(({ data }) => {
        if (active) {
          setFeatured(data || [])
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="container">
      <section className="hero">
        <p className="hero-eyebrow">NEW SEASON IS HERE</p>
        <h1 className="hero-title">Sweet, comfy clothing<br />for little ones.</h1>
        <p className="hero-sub">
          Soft fabrics, playful prints, and cozy fits — everything your little bun needs, sized from newborn to 6 years.
        </p>
        <Link to="/shop" className="btn btn-primary hero-cta">Shop the collection →</Link>
      </section>

      <section className="home-categories">
        {CATEGORIES.map((cat) => (
          <Link key={cat} to={`/shop?category=${encodeURIComponent(cat)}`} className="category-pill">
            {cat}
          </Link>
        ))}
      </section>

      <section className="home-featured">
        <h2>Freshly added</h2>
        {loading ? (
          <p className="home-empty">Loading products…</p>
        ) : featured.length === 0 ? (
          <p className="home-empty">No products yet — check back soon!</p>
        ) : (
          <div className="product-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

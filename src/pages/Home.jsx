import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import heroImage from '../assets/hero.jpg'
import { supabase } from '../lib/supabaseClient'
import { collectionImage } from '../lib/collectionImages'
import { useCollections } from '../hooks/useCollections'
import { useSale } from '../context/SaleContext'
import SaleBanner from '../components/SaleBanner'
import ProductCard from '../components/ProductCard'
import Reveal, { StaggerGroup } from '../components/Reveal'
import './Home.css'

function NewsletterSignup() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('submitting')
    const { error } = await supabase.from('newsletter_subscribers').insert([{ email: email.trim() }])
    if (error) {
      setStatus(error.code === '23505' ? 'duplicate' : 'error')
      return
    }
    setStatus('success')
    setEmail('')
  }

  return (
    <section className="newsletter">
      <Reveal className="newsletter-inner">
        <p className="hero-eyebrow">STAY IN THE LOOP</p>
        <h2>Get new arrivals in your inbox</h2>
        <p className="newsletter-sub">No spam — just cozy new drops and the occasional surprise.</p>

        {status === 'success' ? (
          <p className="newsletter-success">You're on the list! 🎉</p>
        ) : status === 'duplicate' ? (
          <p className="newsletter-success">You're already subscribed — thank you!</p>
        ) : (
          <form className="newsletter-form" onSubmit={handleSubmit}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>
              {status === 'submitting' ? 'Joining…' : 'Subscribe'}
            </button>
          </form>
        )}
        {status === 'error' && <p className="newsletter-error">Something went wrong — try again?</p>}
      </Reveal>
    </section>
  )
}

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [loading, setLoading] = useState(true)
  const { collections: allCollections } = useCollections()
  const collections = allCollections.filter((c) => c.show_on_home !== false)
  const { sale, maxPercent } = useSale()

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
    <div>
      {sale?.is_active && (
        <SaleBanner
          title={sale.banner_title}
          text={sale.banner_text}
          cta={sale.banner_cta}
          percent={maxPercent}
        />
      )}

      <section className="hero-photo">
        <img src={heroImage} alt="" className="hero-photo-bg" />
        <div className="hero-photo-scrim" />
        <div className="hero-photo-content">
          <p className="hero-eyebrow hero-anim" style={{ animationDelay: '0ms' }}>NEW SEASON IS HERE</p>
          <h1 className="hero-photo-title hero-anim" style={{ animationDelay: '90ms' }}>
            Sweet outfits for your little honey
          </h1>
          <p className="hero-photo-sub hero-anim" style={{ animationDelay: '180ms' }}>
            Soft fabrics, playful prints, and cozy fits — made for puddles, playgrounds, and everything in between.
            Sized 1 to 12 years.
          </p>
          <div className="hero-photo-ctas hero-anim" style={{ animationDelay: '270ms' }}>
            <Link to="/shop" className="btn btn-primary">Shop the collection →</Link>
            <a href="#freshly-added" className="btn btn-ghost">See what's new →</a>
          </div>
        </div>
      </section>

      <div className="container">
        {collections.length > 0 && (
          <section className="category-showcase">
            <Reveal className="section-intro">
              <p className="hero-eyebrow">EXPLORE THE COLLECTION</p>
              <h2>Shop by collection</h2>
              <p className="section-intro-sub">Pick a collection and find something sweet for your little one.</p>
            </Reveal>
            <StaggerGroup
              className="category-showcase-grid"
              style={{ '--cols': Math.min(collections.length, 4) }}
            >
              {collections.map((col) => {
                const image = collectionImage(col)
                return (
                  <Link key={col.id} to={`/shop?category=${encodeURIComponent(col.name)}`} className="category-card">
                    {image ? (
                      <img src={image} alt="" className="category-card-image" />
                    ) : (
                      <div className="category-card-image category-card-fallback">{col.name.charAt(0)}</div>
                    )}
                    <div className="category-card-scrim" />
                    <div className="category-card-body">
                      <p className="category-card-name">{col.name}</p>
                      {col.tagline && <p className="category-card-tagline">{col.tagline}</p>}
                      <span className="category-card-cta">
                        Shop now <span className="category-card-arrow">→</span>
                      </span>
                    </div>
                  </Link>
                )
              })}
            </StaggerGroup>
          </section>
        )}

        <Reveal className="home-featured" id="freshly-added">
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
        </Reveal>
      </div>

      <NewsletterSignup />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../context/CartContext'
import './ProductDetail.css'

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addItem } = useCart()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeImage, setActiveImage] = useState(0)
  const [size, setSize] = useState('')
  const [qty, setQty] = useState(1)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setProduct(data)
        setSize(data?.sizes?.[0] || '')
        setActiveImage(0)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [slug])

  if (loading) return <div className="container"><p className="shop-empty">Loading…</p></div>

  if (!product) {
    return (
      <div className="container">
        <p className="shop-empty">We couldn't find that product.</p>
        <div style={{ textAlign: 'center' }}>
          <Link to="/shop" className="btn btn-secondary">Back to shop</Link>
        </div>
      </div>
    )
  }

  const images = product.images?.length ? product.images : []
  const outOfStock = product.stock <= 0

  const handleAddToCart = () => {
    addItem(product, { size, qty })
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="container product-detail">
      <div className="product-detail-gallery">
        <div className="product-detail-main-image">
          {images[activeImage] ? (
            <img src={images[activeImage]} alt={product.name} />
          ) : (
            <div className="product-card-placeholder">🧸</div>
          )}
        </div>
        {images.length > 1 && (
          <div className="product-detail-thumbs">
            {images.map((img, i) => (
              <button
                key={img}
                className={`product-detail-thumb ${i === activeImage ? 'is-active' : ''}`}
                onClick={() => setActiveImage(i)}
              >
                <img src={img} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="product-detail-info">
        <p className="product-card-category">{product.category}</p>
        <h1>{product.name}</h1>
        <div className="product-card-price" style={{ fontSize: '2rem' }}>
          <span>${Number(product.price).toFixed(2)}</span>
          {product.compare_at_price > product.price && (
            <span className="product-card-compare">${Number(product.compare_at_price).toFixed(2)}</span>
          )}
        </div>

        {product.description && <p className="product-detail-description">{product.description}</p>}

        {product.sizes?.length > 0 && (
          <div className="product-detail-sizes">
            <p className="field-label">Size</p>
            <div className="size-options">
              {product.sizes.map((s) => (
                <button
                  key={s}
                  className={`size-pill ${size === s ? 'is-active' : ''}`}
                  onClick={() => setSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="product-detail-qty">
          <p className="field-label">Quantity</p>
          <div className="qty-stepper">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
              <Minus size={16} />
            </button>
            <span>{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} aria-label="Increase quantity">
              <Plus size={16} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary product-detail-add" onClick={handleAddToCart} disabled={outOfStock}>
          {outOfStock ? 'Out of stock' : added ? 'Added ✓' : 'Add to cart'}
        </button>

        {added && (
          <button className="btn btn-secondary product-detail-view-cart" onClick={() => navigate('/cart')}>
            View cart
          </button>
        )}
      </div>
    </div>
  )
}

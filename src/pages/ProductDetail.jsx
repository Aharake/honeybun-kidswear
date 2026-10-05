import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../context/CartContext'
import { useSale } from '../context/SaleContext'
import { getPricing } from '../lib/pricing'
import { colorHex, sortSizeStock, totalStock } from '../lib/constants'
import ImageCarousel from '../components/ImageCarousel'
import './ProductDetail.css'

export default function ProductDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { addItem, qtyInCart } = useCart()
  const { sale } = useSale()

  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
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
        const sizeStock = sortSizeStock(data?.size_stock)
        const firstInStock = sizeStock.find((s) => s.stock > 0)
        setSize((firstInStock || sizeStock[0])?.size || '')
        setQty(1)
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
  const sizeStock = sortSizeStock(product.size_stock)
  const stock = totalStock(sizeStock)
  const outOfStock = stock <= 0
  const selectedStock = sizeStock.find((s) => s.size === size)?.stock ?? 0
  const inBag = qtyInCart(product.id, size)
  const room = Math.max(0, selectedStock - inBag)
  const canAdd = Boolean(size) && room > 0
  const shownQty = Math.max(1, Math.min(qty, room))
  const pricing = getPricing(product, sale)

  const handleSelectSize = (s) => {
    setSize(s.size)
    setQty(1)
  }

  const handleAddToCart = () => {
    if (!canAdd) return
    addItem(product, { size, qty: shownQty, price: pricing.current })
    setQty(1)
    setAdded(true)
    setTimeout(() => setAdded(false), 1800)
  }

  return (
    <div className="container product-detail">
      <div className="product-detail-gallery">
        <ImageCarousel
          key={product.id}
          images={images}
          alt={product.name}
          adjust={product.image_adjust}
          badge={pricing.onSale ? `Sale −${pricing.percentOff}%` : null}
        />
      </div>

      <div className="product-detail-info">
        <p className="product-card-category">{product.category}</p>
        <h1>{product.name}</h1>
        <div className="product-card-price" style={{ fontSize: '2rem' }}>
          <span className={pricing.onSale ? 'product-card-now' : undefined}>${pricing.current.toFixed(2)}</span>
          {pricing.original && <span className="product-card-compare">${pricing.original.toFixed(2)}</span>}
          {pricing.onSale && <span className="product-detail-sale-tag">Sale −{pricing.percentOff}%</span>}
        </div>

        {product.description && <p className="product-detail-description">{product.description}</p>}

        {product.colors?.length > 0 && (
          <div className="product-detail-colors">
            <p className="field-label">Colour</p>
            <div className="product-detail-color-list">
              {product.colors.map((name) => (
                <span key={name} className="product-detail-color">
                  <span className="color-swatch" style={{ background: colorHex(name) }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {sizeStock.length > 0 && (
          <div className="product-detail-sizes">
            <p className="field-label">Size</p>
            <div className="size-options">
              {sizeStock.map((s) => (
                <button
                  key={s.size}
                  className={`size-pill ${size === s.size ? 'is-active' : ''} ${s.stock <= 0 ? 'is-sold-out' : ''}`}
                  onClick={() => handleSelectSize(s)}
                  disabled={s.stock <= 0}
                >
                  {s.size}
                  {s.stock <= 0 && <span className="size-pill-strike" aria-hidden="true" />}
                </button>
              ))}
            </div>
            {size && selectedStock > 0 && selectedStock <= 3 && (
              <p className="product-detail-low-stock">Only {selectedStock} left in size {size}</p>
            )}
            {size && selectedStock <= 0 && (
              <p className="product-detail-low-stock is-sold-out">Sold out in size {size}</p>
            )}
            {inBag > 0 && selectedStock > 0 && (
              <p className="product-detail-in-bag">
                {inBag} in your bag{room === 0 ? ' — that\'s all we have in this size' : ''}
              </p>
            )}
          </div>
        )}

        <div className="product-detail-qty">
          <p className="field-label">Quantity</p>
          <div className="qty-stepper">
            <button onClick={() => setQty(Math.max(1, shownQty - 1))} aria-label="Decrease quantity" disabled={!canAdd}>
              <Minus size={16} />
            </button>
            <span>{shownQty}</span>
            <button
              onClick={() => setQty(Math.min(room, shownQty + 1))}
              aria-label="Increase quantity"
              disabled={!canAdd || shownQty >= room}
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <button className="btn btn-primary product-detail-add" onClick={handleAddToCart} disabled={!canAdd}>
          {outOfStock
            ? 'Out of stock'
            : size && selectedStock > 0 && room === 0
            ? 'All in your bag'
            : !canAdd
            ? 'Select a size'
            : added
            ? 'Added ✓'
            : 'Add to cart'}
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

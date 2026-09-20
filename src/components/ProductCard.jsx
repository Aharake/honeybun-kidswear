import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useSale } from '../context/SaleContext'
import { getPricing } from '../lib/pricing'
import { sortSizeStock, totalStock } from '../lib/constants'
import './ProductCard.css'

export default function ProductCard({ product }) {
  const { addItem, qtyInCart } = useCart()
  const { sale } = useSale()
  const [added, setAdded] = useState(false)

  const image = product.images?.[0]
  const pricing = getPricing(product, sale)
  const sizeStock = sortSizeStock(product.size_stock)
  const stock = totalStock(sizeStock)
  const outOfStock = stock <= 0
  const nextSize = sizeStock.find((s) => s.stock > qtyInCart(product.id, s.size))
  const allInBag = !outOfStock && !nextSize

  const sizeRange =
    sizeStock.length > 1
      ? `${sizeStock[0].size} – ${sizeStock[sizeStock.length - 1].size}`
      : sizeStock.length === 1
      ? sizeStock[0].size
      : null

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!nextSize) return
    addItem(product, { size: nextSize.size, qty: 1, price: pricing.current })
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <Link to={`/product/${product.slug}`} className="product-card">
      <div className="product-card-image">
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <div className="product-card-placeholder">🧸</div>}
        {pricing.onSale && (
          <span className="product-card-badge product-card-badge-sale">Sale −{pricing.percentOff}%</span>
        )}
        {outOfStock && <span className="product-card-oos">Out of stock</span>}
      </div>
      <div className="product-card-body">
        <p className="product-card-category">
          {product.category}
          {sizeRange && <span className="product-card-sizes"> · {sizeRange}</span>}
        </p>
        <p className="product-card-name">{product.name}</p>
        <div className="product-card-price">
          <span className={pricing.onSale ? 'product-card-now' : undefined}>${pricing.current.toFixed(2)}</span>
          {pricing.original && <span className="product-card-compare">${pricing.original.toFixed(2)}</span>}
        </div>
        <button
          className="product-card-quickadd"
          onClick={handleQuickAdd}
          disabled={outOfStock || allInBag}
        >
          {outOfStock ? 'Out of stock' : allInBag ? 'All in your bag' : added ? 'Added ✓' : 'Quick add'}
        </button>
      </div>
    </Link>
  )
}

import { Link } from 'react-router-dom'
import './ProductCard.css'

export default function ProductCard({ product }) {
  const image = product.images?.[0]
  const onSale = product.compare_at_price && product.compare_at_price > product.price

  return (
    <Link to={`/product/${product.slug}`} className="product-card">
      <div className="product-card-image">
        {image ? <img src={image} alt={product.name} loading="lazy" /> : <div className="product-card-placeholder">🧸</div>}
        {onSale && <span className="product-card-sale">Sale</span>}
        {product.stock <= 0 && <span className="product-card-oos">Out of stock</span>}
      </div>
      <div className="product-card-body">
        <p className="product-card-category">{product.category}</p>
        <p className="product-card-name">{product.name}</p>
        <div className="product-card-price">
          <span>${Number(product.price).toFixed(2)}</span>
          {onSale && <span className="product-card-compare">${Number(product.compare_at_price).toFixed(2)}</span>}
        </div>
      </div>
    </Link>
  )
}

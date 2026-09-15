import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useCart } from '../context/CartContext'
import './Cart.css'

export default function Cart() {
  const { items, removeItem, updateQty, subtotal } = useCart()

  if (items.length === 0) {
    return (
      <div className="container">
        <h1>Your cart</h1>
        <p className="shop-empty">Your cart is empty.</p>
        <div style={{ textAlign: 'center' }}>
          <Link to="/shop" className="btn btn-primary">Start shopping</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container cart-page">
      <h1>Your cart</h1>

      <div className="cart-layout">
        <div className="cart-items">
          {items.map((item) => (
            <div key={`${item.productId}-${item.size}`} className="cart-item">
              <div className="cart-item-image">
                {item.image ? <img src={item.image} alt={item.name} /> : <div className="product-card-placeholder">🧸</div>}
              </div>
              <div className="cart-item-info">
                <Link to={`/product/${item.slug}`} className="cart-item-name">{item.name}</Link>
                {item.size && <p className="cart-item-size">Size: {item.size}</p>}
                <p className="cart-item-price">${item.price.toFixed(2)}</p>
              </div>
              <div className="cart-item-actions">
                <div className="qty-stepper">
                  <button onClick={() => updateQty(item.productId, item.size, item.qty - 1)} aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span>{item.qty}</span>
                  <button onClick={() => updateQty(item.productId, item.size, item.qty + 1)} aria-label="Increase quantity">
                    <Plus size={14} />
                  </button>
                </div>
                <button className="cart-item-remove" onClick={() => removeItem(item.productId, item.size)} aria-label="Remove item">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <div className="cart-summary-row">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <p className="cart-summary-note">Shipping and payment (cash on delivery) confirmed at checkout.</p>
          <Link to="/checkout" className="btn btn-primary cart-checkout-btn">Proceed to checkout →</Link>
        </div>
      </div>
    </div>
  )
}

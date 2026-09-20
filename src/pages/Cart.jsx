import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Trash2, Tag } from 'lucide-react'
import { useCart } from '../context/CartContext'
import './Cart.css'

export default function Cart() {
  const {
    items, removeItem, updateQty, subtotal, discount, discountAmount, total,
    applyCode, removeCode, stockNotice, dismissStockNotice,
  } = useCart()

  const notice = stockNotice && (
    <div className="cart-stock-notice" role="status">
      <span>{stockNotice}</span>
      <button onClick={dismissStockNotice} aria-label="Dismiss">Got it</button>
    </div>
  )
  const [codeInput, setCodeInput] = useState('')
  const [codeStatus, setCodeStatus] = useState({ busy: false, message: '' })

  const handleApply = async (e) => {
    e.preventDefault()
    if (!codeInput.trim()) return
    setCodeStatus({ busy: true, message: '' })
    const result = await applyCode(codeInput)
    setCodeStatus({ busy: false, message: result.ok ? '' : result.message })
    if (result.ok) setCodeInput('')
  }

  if (items.length === 0) {
    return (
      <div className="container">
        <h1>Your cart</h1>
        {notice}
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
      {notice}

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
                {item.maxQty !== undefined && item.qty >= item.maxQty && (
                  <p className="cart-item-limit">
                    {item.maxQty === 1 ? 'Only 1 available' : `Max ${item.maxQty} available`}
                  </p>
                )}
              </div>
              <div className="cart-item-actions">
                <div className="qty-stepper">
                  <button onClick={() => updateQty(item.productId, item.size, item.qty - 1)} aria-label="Decrease quantity">
                    <Minus size={14} />
                  </button>
                  <span>{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.productId, item.size, item.qty + 1)}
                    aria-label="Increase quantity"
                    disabled={item.maxQty !== undefined && item.qty >= item.maxQty}
                  >
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
          {discount ? (
            <div className="cart-code-applied">
              <span><Tag size={14} /> {discount.code}</span>
              <button onClick={removeCode} aria-label="Remove discount code">Remove</button>
            </div>
          ) : (
            <form className="cart-code-form" onSubmit={handleApply}>
              <input
                type="text"
                placeholder="Discount code"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                aria-label="Discount code"
              />
              <button className="btn btn-secondary" type="submit" disabled={codeStatus.busy}>
                {codeStatus.busy ? '…' : 'Apply'}
              </button>
            </form>
          )}
          {codeStatus.message && <p className="cart-code-error">{codeStatus.message}</p>}
          {discount && discountAmount === 0 && (
            <p className="cart-code-error">Spend at least ${discount.min_subtotal.toFixed(2)} to use this code.</p>
          )}

          <div className="cart-summary-line">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="cart-summary-line cart-summary-discount">
              <span>Discount</span>
              <span>−${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="cart-summary-row">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
          <p className="cart-summary-note">Shipping and payment (cash on delivery) confirmed at checkout.</p>
          <Link to="/checkout" className="btn btn-primary cart-checkout-btn">Proceed to checkout →</Link>
        </div>
      </div>
    </div>
  )
}

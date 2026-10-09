import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { supabase, generateOrderNumber } from '../lib/supabaseClient'
import './Checkout.css'

const EMPTY_FORM = { customer_name: '', email: '', phone: '', address: '', city: '', notes: '' }

export default function Checkout() {
  const { items, subtotal, discount, discountAmount, total, removeCode, clearCart, checkStock } = useCart()
  const navigate = useNavigate()
  const { user, accountsReady } = useAuth()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const orderPlaced = useRef(false)
  const prefilled = useRef(null)

  // Signed in: fill in the form from the account and their last delivery,
  // without overwriting anything they've already typed.
  useEffect(() => {
    if (!user || !accountsReady || prefilled.current === user.id) return
    prefilled.current = user.id
    const fill = (values) =>
      setForm((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || values[k] || ''])))
    fill({ email: user.email, customer_name: user.user_metadata?.full_name })
    supabase
      .from('orders')
      .select('customer_name, phone, address, city')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) fill(data[0])
      })
  }, [user, accountsReady])

  if (items.length === 0 && !orderPlaced.current) {
    return <Navigate to="/cart" replace />
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const stock = await checkStock()
    if (!stock.ok) {
      setSubmitting(false)
      setError(`${stock.message} Please review your bag and try again.`)
      return
    }

    if (discount && discountAmount > 0) {
      const { data: check } = await supabase.rpc('validate_discount_code', {
        p_code: discount.code,
        p_subtotal: subtotal,
      })
      if (!check?.valid) {
        removeCode()
        setSubmitting(false)
        setError(`${check?.message || 'Your discount code is no longer valid.'} It was removed — please check your total and try again.`)
        return
      }
    }

    const orderPayload = {
      order_number: generateOrderNumber(),
      customer_name: form.customer_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      notes: form.notes.trim(),
      items: items.map((i) => ({
        product_id: i.productId,
        name: i.name,
        price: i.price,
        qty: i.qty,
        size: i.size,
      })),
      subtotal,
      total,
      status: 'pending',
      payment_method: 'cod',
      ...(user && accountsReady ? { user_id: user.id } : {}),
      ...(discountAmount > 0 ? { discount_code: discount.code, discount_amount: discountAmount } : {}),
    }

    const { error: insertError } = await supabase.from('orders').insert([orderPayload])

    setSubmitting(false)

    if (insertError) {
      console.error(insertError)
      setError('Something went wrong placing your order. Please try again.')
      return
    }

    // Best-effort: reduce stock for the exact sizes purchased. Never blocks
    // the order — it's already placed even if this fails.
    supabase.rpc('decrement_product_stock', { items: orderPayload.items }).then(({ error: stockError }) => {
      if (stockError) console.error('Stock decrement failed:', stockError)
    })
    if (orderPayload.discount_code) {
      supabase.rpc('redeem_discount_code', { p_code: orderPayload.discount_code }).then(({ error: codeError }) => {
        if (codeError) console.error('Discount redeem failed:', codeError)
      })
    }

    orderPlaced.current = true
    clearCart()
    navigate(`/order-confirmation/${orderPayload.order_number}`, { state: { order: orderPayload } })
  }

  return (
    <div className="container checkout-page">
      <h1>Checkout</h1>
      <p className="checkout-sub">Pay with cash when your order arrives.</p>
      {accountsReady && !user && (
        <p className="checkout-account-hint">
          Want to follow your order? <Link to="/account">Sign in or create an account</Link> first — or just check out as a guest.
        </p>
      )}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="customer_name">Full name</label>
            <input id="customer_name" name="customer_name" required value={form.customer_name} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required value={form.email} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" required value={form.phone} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="address">Delivery address</label>
            <textarea
              id="address"
              name="address"
              rows={3}
              required
              placeholder="Street, building, floor/apartment, nearest landmark…"
              value={form.address}
              onChange={handleChange}
            />
          </div>
          <div className="field">
            <label htmlFor="city">City</label>
            <input id="city" name="city" required value={form.city} onChange={handleChange} />
          </div>
          <div className="field">
            <label htmlFor="notes">Order notes (optional)</label>
            <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange} />
          </div>

          {error && <p className="checkout-error">{error}</p>}

          <button className="btn btn-primary checkout-submit" type="submit" disabled={submitting}>
            {submitting ? 'Placing order…' : `Place order — Cash on delivery`}
          </button>
        </form>

        <div className="checkout-summary">
          {items.map((item) => (
            <div key={`${item.productId}-${item.size}`} className="checkout-summary-row">
              <span>{item.name} {item.size && `(${item.size})`} × {item.qty}</span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          {discountAmount > 0 && (
            <div className="checkout-summary-row">
              <span>Discount ({discount.code})</span>
              <span>−${discountAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="checkout-summary-total">
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

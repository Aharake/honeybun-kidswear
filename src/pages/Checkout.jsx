import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { supabase, generateOrderNumber } from '../lib/supabaseClient'
import './Checkout.css'

const EMPTY_FORM = { customer_name: '', email: '', phone: '', address: '', city: '', notes: '' }

export default function Checkout() {
  const { items, subtotal, clearCart } = useCart()
  const navigate = useNavigate()
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (items.length === 0) {
    return <Navigate to="/cart" replace />
  }

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

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
      total: subtotal,
      status: 'pending',
      payment_method: 'cod',
    }

    const { data, error: insertError } = await supabase
      .from('orders')
      .insert([orderPayload])
      .select()
      .single()

    setSubmitting(false)

    if (insertError) {
      console.error(insertError)
      setError('Something went wrong placing your order. Please try again.')
      return
    }

    clearCart()
    navigate(`/order-confirmation/${data.order_number}`, { state: { order: data } })
  }

  return (
    <div className="container checkout-page">
      <h1>Checkout</h1>
      <p className="checkout-sub">Pay with cash when your order arrives.</p>

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
            <input id="address" name="address" required value={form.address} onChange={handleChange} />
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
          <div className="checkout-summary-total">
            <span>Total</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

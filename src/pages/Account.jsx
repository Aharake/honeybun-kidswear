import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Package } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import './Account.css'

const STEPS = [
  { key: 'pending', label: 'Received' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'shipped', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
]

const STATUS_TEXT = {
  pending: "We've received your order and will contact you to confirm delivery.",
  confirmed: 'Your order is confirmed and being prepared.',
  shipped: 'Your order is on its way. Have the cash ready for the delivery.',
  delivered: 'Delivered. Thank you for shopping with Honeybun!',
  cancelled: 'This order was cancelled. Message us on WhatsApp if you have any questions.',
}

const EMAIL_LIMIT_MESSAGE =
  "We can't send another confirmation email right now. Please try again in about an hour, or message us on WhatsApp and we'll help."

function niceError(err) {
  const m = String(err?.message || '').toLowerCase()
  if (err?.code === 'over_email_send_rate_limit') return EMAIL_LIMIT_MESSAGE
  if (m.includes('invalid login')) return 'Wrong email or password.'
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'There is already an account with this email. Try signing in instead.'
  }
  if (m.includes('password') && m.includes('characters')) return 'Your password needs at least 6 characters.'
  if (m.includes('email not confirmed')) return 'Please confirm your email first. Check your inbox for our message.'
  if (m.includes('email rate limit')) return EMAIL_LIMIT_MESSAGE
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many tries. Please wait a few minutes and try again.'
  return 'Something went wrong. Please try again.'
}

function AuthForms() {
  const { signIn, signUp, sendPasswordReset } = useAuth()
  const [mode, setMode] = useState('signin') // signin | signup | forgot
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const switchMode = (next) => {
    setMode(next)
    setError('')
    setNotice('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')

    if (mode === 'signin') {
      const { error: err } = await signIn(email.trim(), password)
      if (err) setError(niceError(err))
    } else if (mode === 'signup') {
      if (password.length < 6) {
        setError('Your password needs at least 6 characters.')
      } else {
        const { data, error: err } = await signUp(email.trim(), password, name.trim())
        if (err) setError(niceError(err))
        else if (!data.session) {
          setNotice('Almost there! We sent a confirmation link to your email. Open it, then sign in.')
          setMode('signin')
        }
      }
    } else {
      const { error: err } = await sendPasswordReset(email.trim())
      if (err) setError(niceError(err))
      else setNotice('If there is an account with that email, a reset link is on its way.')
    }
    setBusy(false)
  }

  return (
    <div className="account-card">
      <h1>{mode === 'signup' ? 'Create your account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h1>
      <p className="account-sub">
        {mode === 'signup'
          ? 'Track your orders and keep your bag on every device.'
          : mode === 'forgot'
          ? "Enter your email and we'll send you a link to choose a new password."
          : 'Sign in to track your orders and find your bag on any device.'}
      </p>

      <form className="account-form" onSubmit={handleSubmit}>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="acc-name">Your name</label>
            <input id="acc-name" required autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="acc-email">Email</label>
          <input id="acc-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== 'forgot' && (
          <div className="field">
            <label htmlFor="acc-password">Password</label>
            <input
              id="acc-password"
              type="password"
              required
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}

        {error && <p className="checkout-error">{error}</p>}
        {notice && <p className="account-notice">{notice}</p>}

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
        </button>
      </form>

      <div className="account-links">
        {mode === 'signin' && (
          <>
            <button type="button" onClick={() => switchMode('forgot')}>Forgot your password?</button>
            <button type="button" onClick={() => switchMode('signup')}>New here? Create an account</button>
          </>
        )}
        {mode !== 'signin' && (
          <button type="button" onClick={() => switchMode('signin')}>Back to sign in</button>
        )}
      </div>

      <p className="account-guest">
        No account needed to order — you can also <Link to="/shop">keep shopping as a guest</Link>.
      </p>
    </div>
  )
}

function OrderCard({ order }) {
  const cancelled = order.status === 'cancelled'
  const stepIndex = STEPS.findIndex((s) => s.key === order.status)
  const date = new Date(order.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="account-order">
      <div className="account-order-head">
        <div>
          <p className="account-order-number">Order #{order.order_number}</p>
          <p className="account-order-date">{date}</p>
        </div>
        <span className={`badge badge-${order.status}`}>{order.status}</span>
      </div>

      {cancelled ? null : (
        <ol className="account-steps" aria-label="Order progress">
          {STEPS.map((step, i) => (
            <li key={step.key} className={i <= stepIndex ? 'is-done' : ''}>
              <span className="account-step-dot">{i <= stepIndex && <Check size={12} />}</span>
              <span className="account-step-label">{step.label}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="account-order-status-text">{STATUS_TEXT[order.status] || ''}</p>

      <div className="account-order-items">
        {(order.items || []).map((item, i) => (
          <div key={i} className="checkout-summary-row">
            <span>
              {item.name} {item.size && `(${item.size})`} × {item.qty}
            </span>
            <span>${(item.price * item.qty).toFixed(2)}</span>
          </div>
        ))}
        {Number(order.discount_amount) > 0 && (
          <div className="checkout-summary-row">
            <span>Discount ({order.discount_code})</span>
            <span>−${Number(order.discount_amount).toFixed(2)}</span>
          </div>
        )}
        <div className="checkout-summary-total">
          <span>Total · cash on delivery</span>
          <span>${Number(order.total).toFixed(2)}</span>
        </div>
      </div>
      <p className="account-order-address">
        Delivering to {order.address}, {order.city}
      </p>
    </div>
  )
}

function Orders({ user }) {
  const [orders, setOrders] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error(error)
          setFailed(true)
        }
        setOrders(data || [])
      })
    return () => {
      active = false
    }
  }, [user.id])

  if (orders === null) return <p className="account-empty">Loading your orders…</p>
  if (failed) return <p className="account-empty">We couldn't load your orders right now. Please try again in a moment.</p>
  if (orders.length === 0) {
    return (
      <div className="account-empty">
        <Package size={36} />
        <p>No orders yet. When you order while signed in, it shows up here so you can follow it.</p>
        <Link to="/shop" className="btn btn-primary">Start shopping</Link>
      </div>
    )
  }
  return (
    <div className="account-orders">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </div>
  )
}

export default function Account() {
  const { user, loading, roleChecked, accountsReady, signOut } = useAuth()

  if (loading || !roleChecked) return <div className="container account-page"><p className="account-empty">Loading…</p></div>

  if (!accountsReady) {
    return (
      <div className="container account-page">
        <div className="account-card">
          <h1>Accounts are coming soon</h1>
          <p className="account-sub">You can still order as a guest — just add what you like to your bag and check out.</p>
          <Link to="/shop" className="btn btn-primary">Shop now</Link>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container account-page">
        <AuthForms />
      </div>
    )
  }

  const name = user.user_metadata?.full_name

  return (
    <div className="container account-page">
      <div className="account-header">
        <div>
          <h1>{name ? `Hi, ${name.split(' ')[0]}` : 'Your account'}</h1>
          <p className="account-sub">{user.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={() => signOut()}>Sign out</button>
      </div>
      <h2 className="account-section-title">Your orders</h2>
      <Orders user={user} />
    </div>
  )
}

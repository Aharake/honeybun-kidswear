import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './Account.css'

// Landing page for the link in the "reset your password" email. Supabase signs
// the shopper in from the link, so all that's left is choosing a new password.
export default function ResetPassword() {
  const { user, loading, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('Your password needs at least 6 characters.')
      return
    }
    setBusy(true)
    setError('')
    const { error: err } = await updatePassword(password)
    setBusy(false)
    if (err) {
      setError('Could not change your password. The link may have expired. Request a new one.')
      return
    }
    navigate('/account', { replace: true })
  }

  if (loading) return <div className="container account-page"><p className="account-empty">Loading…</p></div>

  if (!user) {
    return (
      <div className="container account-page">
        <div className="account-card">
          <h1>This link has expired</h1>
          <p className="account-sub">Reset links only work once and for a short time. Request a fresh one from the sign-in page.</p>
          <Link to="/account" className="btn btn-primary">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container account-page">
      <div className="account-card">
        <h1>Choose a new password</h1>
        <form className="account-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="checkout-error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save password'}
          </button>
        </form>
      </div>
    </div>
  )
}

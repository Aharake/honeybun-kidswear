import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/logo.png'
import './Admin.css'

export default function AdminLogin() {
  const { user, signIn, signOut, roleChecked, isAdmin } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user && roleChecked && isAdmin) {
    return <Navigate to={location.state?.from?.pathname || '/admin'} replace />
  }

  // Signed in with a shopper account, not an admin one.
  if (user && roleChecked && !isAdmin) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <img src={logo} alt="Honeybun Kidswear" className="admin-login-logo" />
          <h1>Not an admin account</h1>
          <p className="admin-field-hint">
            You're signed in as {user.email}, which is a shopper account. Sign out to log in with the admin account instead.
          </p>
          <button className="btn btn-primary" type="button" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    const { error: signInError } = await signIn(email, password)
    setSubmitting(false)
    if (signInError) {
      setError('Invalid email or password.')
      return
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <img src={logo} alt="Honeybun Kidswear" className="admin-login-logo" />
        <h1>Admin login</h1>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

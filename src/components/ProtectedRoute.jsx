import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Admin pages. Being signed in is not enough any more: shoppers have accounts
// too, so the account also has to be on the admins list.
export default function ProtectedRoute({ children }) {
  const { user, loading, roleChecked, isAdmin } = useAuth()
  const location = useLocation()

  if (loading || (user && !roleChecked)) {
    return <div className="page container">Loading…</div>
  }

  if (!user || !isAdmin) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />
  }

  return children
}

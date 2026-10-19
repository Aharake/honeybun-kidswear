import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { trackPageView } from '../lib/track'

// Counts page views on the shop. The admin area is never counted, and neither
// is anyone signed in as an admin, so your own browsing doesn't skew the numbers.
export default function Tracker() {
  const { pathname } = useLocation()
  const { roleChecked, isAdmin } = useAuth()
  const lastPath = useRef(null)

  useEffect(() => {
    if (!roleChecked || isAdmin || pathname.startsWith('/admin')) return
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackPageView(pathname)
  }, [pathname, roleChecked, isAdmin])

  return null
}

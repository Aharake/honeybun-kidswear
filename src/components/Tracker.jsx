import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { trackPageView } from '../lib/track'
import { adPageView, blockMarketing, startMarketing } from '../lib/marketing'

// Counts page views on the shop (and sends them to the ad and analytics tools set up
// under Tracking & ads). The admin area is never counted, and neither is anyone signed in as an
// admin, so your own browsing doesn't skew the numbers or your ads.
export default function Tracker() {
  const { pathname } = useLocation()
  const { roleChecked, isAdmin } = useAuth()
  const lastPath = useRef(null)

  useEffect(() => {
    if (!roleChecked) return
    blockMarketing(isAdmin)
    if (isAdmin || pathname.startsWith('/admin')) return
    startMarketing()
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackPageView(pathname)
    adPageView(pathname)
  }, [pathname, roleChecked, isAdmin])

  return null
}

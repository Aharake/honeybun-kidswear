import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { trackPageView } from '../lib/track'
import { blockPixel, pixelPageView, startPixel } from '../lib/metaPixel'

// Counts page views on the shop (and sends them to the Meta Pixel when one is set
// up). The admin area is never counted, and neither is anyone signed in as an
// admin, so your own browsing doesn't skew the numbers or your ads.
export default function Tracker() {
  const { pathname } = useLocation()
  const { roleChecked, isAdmin } = useAuth()
  const lastPath = useRef(null)

  useEffect(() => {
    if (!roleChecked) return
    blockPixel(isAdmin)
    if (isAdmin || pathname.startsWith('/admin')) return
    startPixel()
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    trackPageView(pathname)
    pixelPageView()
  }, [pathname, roleChecked, isAdmin])

  return null
}

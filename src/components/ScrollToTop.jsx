import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// Sends every newly opened page back to the top. The back/forward buttons
// are left alone so the browser can put you where you were.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (navigationType === 'POP') return
    if (hash) {
      document.getElementById(hash.slice(1))?.scrollIntoView()
      return
    }
    window.scrollTo(0, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}

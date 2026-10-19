import { supabase } from './supabaseClient'

// Anonymous visitor tracking, kept in your own database (site_events). No
// cookies, no names, no emails: just a random code per browser so unique
// visitors can be counted.

const VISITOR_KEY = 'honeybun_visitor'
const SESSION_KEY = 'honeybun_session'

let disabled = false // set once we learn the table doesn't exist yet

function skipThisBrowser() {
  if (typeof navigator === 'undefined') return true
  if (navigator.webdriver) return true
  if (navigator.doNotTrack === '1') return true
  return /bot|crawl|spider|slurp|headless|preview/i.test(navigator.userAgent || '')
}

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(VISITOR_KEY, id)
    }
    return id
  } catch {
    return null
  }
}

export function track(type, { path, productId } = {}) {
  if (disabled || skipThisBrowser()) return
  const id = visitorId()
  if (!id) return
  supabase
    .from('site_events')
    .insert([
      {
        type,
        visitor_id: id,
        path: (path || window.location.pathname).slice(0, 300),
        ...(productId ? { product_id: productId } : {}),
      },
    ])
    .then(({ error }) => {
      if (error && (error.code === '42P01' || error.code === 'PGRST205')) disabled = true
    })
}

// Every page view; the first one in a browsing session also counts as a visit.
export function trackPageView(path) {
  try {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.setItem(SESSION_KEY, '1')
      track('visit', { path })
    }
  } catch {
    // private mode: just count the page view
  }
  track('page_view', { path })
}

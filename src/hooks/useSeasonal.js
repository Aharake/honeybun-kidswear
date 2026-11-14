import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const HINT_KEY = 'honeybun_has_banner'

// Whether the last visit showed a home-page banner. Used to hold a banner-sized
// gap while the shop is still loading, so the page doesn't jump when it appears.
export function hadBannerBefore() {
  try {
    return localStorage.getItem(HINT_KEY) === '1'
  } catch {
    return false
  }
}

// The visible seasonal collections (like Winter). Quietly returns an empty list
// until the database has the seasonal_collections table.
export function useSeasonal() {
  const [seasonal, setSeasonal] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('seasonal_collections')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        const rows = error ? [] : data || []
        setSeasonal(rows)
        setLoading(false)
        try {
          localStorage.setItem(HINT_KEY, rows.some((r) => r.show_on_home) ? '1' : '0')
        } catch {
          // private mode: no hint
        }
      })
    return () => {
      active = false
    }
  }, [])

  return { seasonal, loading }
}

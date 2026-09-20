import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useCollections() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase
      .from('collections')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error(error)
        setCollections(data || [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  return { collections, loading }
}

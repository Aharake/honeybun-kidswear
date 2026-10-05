import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { COLOR_OPTIONS } from '../lib/constants'

// Built-in colours plus any the admin added (custom_colors table). If that
// table doesn't exist yet this quietly falls back to just the built-ins.
export function useColors() {
  const [custom, setCustom] = useState([])

  const reload = useCallback(async () => {
    const { data, error } = await supabase.from('custom_colors').select('name, hex').order('created_at', { ascending: true })
    if (error) return { error }
    setCustom(data || [])
    return { error: null }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const palette = useMemo(() => {
    const builtIn = new Set(COLOR_OPTIONS.map((c) => c.name.toLowerCase()))
    return [...COLOR_OPTIONS, ...custom.filter((c) => !builtIn.has(c.name.toLowerCase())).map((c) => ({ ...c, custom: true }))]
  }, [custom])

  const hexFor = useCallback((name) => palette.find((c) => c.name === name)?.hex || '#CCCCCC', [palette])

  return { palette, hexFor, reload }
}

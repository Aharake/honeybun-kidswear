import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { getPricing } from '../lib/pricing'

const SaleContext = createContext({ sale: null, maxPercent: 0 })

export function SaleProvider({ children }) {
  const [state, setState] = useState({ sale: null, maxPercent: 0 })

  useEffect(() => {
    let active = true
    async function load() {
      const { data: sale } = await supabase.from('sale_settings').select('*').eq('id', 1).maybeSingle()
      if (!active) return
      if (!sale?.is_active) {
        setState({ sale: sale || null, maxPercent: 0 })
        return
      }
      const { data: items } = await supabase
        .from('products')
        .select('price, sale_price, on_sale, compare_at_price')
        .eq('is_active', true)
        .eq('on_sale', true)
      if (!active) return
      const maxPercent = Math.max(
        0,
        ...(items || []).map((p) => getPricing(p, sale).percentOff)
      )
      setState({ sale, maxPercent: maxPercent || sale.percent_off })
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return <SaleContext.Provider value={state}>{children}</SaleContext.Provider>
}

export function useSale() {
  return useContext(SaleContext)
}

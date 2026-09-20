export const SIZE_OPTIONS = ['Newborn', '0-3M', '3-6M', '6-12M', '1-2Y', '2-3Y', '3-4Y', '4-5Y', '5-6Y']

// sizeStock: [{ size: '0-3M', stock: 5 }, ...]
export function sortSizeStock(sizeStock) {
  return [...(sizeStock || [])].sort(
    (a, b) => SIZE_OPTIONS.indexOf(a.size) - SIZE_OPTIONS.indexOf(b.size)
  )
}

export function totalStock(sizeStock) {
  return (sizeStock || []).reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
}

export function inStockSizes(sizeStock) {
  return sortSizeStock(sizeStock).filter((s) => s.stock > 0)
}

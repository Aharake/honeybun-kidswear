export const SIZE_OPTIONS = [
  'Newborn',
  '0-3M',
  '3-6M',
  '6-12M',
  '1-2Y',
  '2-3Y',
  '3-4Y',
  '4-5Y',
  '5-6Y',
  '7-8Y',
  '8-9Y',
  '9-10Y',
  '11-12Y',
  '12-13Y',
]

// Turns a size label into a rough age in months so any size, including
// custom ones like "10-11Y", sorts youngest to oldest. Labels with no age
// in them ("One size", "S") sort last, in the order they were added.
export function sizeRank(label) {
  const text = String(label).trim().toLowerCase()
  if (text.startsWith('newborn')) return -1
  const match = text.match(/^(\d+(?:\.\d+)?)(?:\s*[-/]\s*\d+(?:\.\d+)?)?\s*(m|mo|mos|month|months|y|yr|yrs|year|years)?\b/)
  if (!match) return Infinity
  const start = Number(match[1])
  const unit = match[2] || 'y'
  return unit.startsWith('m') ? start : start * 12
}

// sizeStock: [{ size: '0-3M', stock: 5 }, ...]
export function sortSizeStock(sizeStock) {
  return [...(sizeStock || [])].sort((a, b) => {
    const ra = sizeRank(a.size)
    const rb = sizeRank(b.size)
    if (ra === rb) return 0
    return ra < rb ? -1 : 1
  })
}

export function totalStock(sizeStock) {
  return (sizeStock || []).reduce((sum, s) => sum + (Number(s.stock) || 0), 0)
}

export function inStockSizes(sizeStock) {
  return sortSizeStock(sizeStock).filter((s) => s.stock > 0)
}

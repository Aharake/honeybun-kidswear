import { supabase, PRODUCT_IMAGES_BUCKET } from './supabaseClient'
import { resizeImage } from './resizeImage'

// Photos bigger than this get shrunk.
export const BIG_PHOTO_BYTES = 350 * 1024

const MARKER = `/storage/v1/object/public/${PRODUCT_IMAGES_BUCKET}/`
const ours = (url) => typeof url === 'string' && url.includes(MARKER)

async function sizeOf(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return Number(response.headers.get('content-length')) || 0
  } catch {
    return 0
  }
}

// Looks up the file size of every product photo (six at a time).
export async function scanPhotos(products, onProgress) {
  const jobs = products.flatMap((p) => (p.images || []).filter(ours).map((url) => ({ productId: p.id, url })))
  const results = []
  let next = 0
  const worker = async () => {
    while (next < jobs.length) {
      const job = jobs[next++]
      results.push({ ...job, bytes: await sizeOf(job.url) })
      onProgress?.(results.length, jobs.length)
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  const big = results.filter((r) => r.bytes > BIG_PHOTO_BYTES)
  return {
    total: results.length,
    big,
    totalBytes: results.reduce((sum, r) => sum + r.bytes, 0),
    bigBytes: big.reduce((sum, r) => sum + r.bytes, 0),
  }
}

// Replaces each big photo with a shrunken copy and points the product at it.
// The original files stay in storage, so nothing is lost and a cart that is
// holding an old photo link still shows it.
export async function shrinkPhotos(products, bigUrls, onProgress) {
  const targets = products.filter((p) => (p.images || []).some((u) => bigUrls.has(u)))
  const totalToDo = targets.reduce((n, p) => n + p.images.filter((u) => bigUrls.has(u)).length, 0)
  let handled = 0
  let savedBytes = 0
  let shrunk = 0
  let failed = 0

  for (const product of targets) {
    const swapped = {} // old url -> new url
    for (const url of product.images) {
      if (!bigUrls.has(url)) continue
      try {
        const original = await (await fetch(url)).blob()
        const file = new File([original], 'photo', { type: original.type || 'image/png' })
        const small = await resizeImage(file)
        if (small === file || small.size >= original.size * 0.9) {
          handled += 1
          onProgress?.(handled, totalToDo)
          continue
        }
        const path = `${product.slug}/opt-${Date.now()}-${handled}.jpg`
        const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, small, { contentType: 'image/jpeg' })
        if (error) throw error
        swapped[url] = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl
        savedBytes += original.size - small.size
      } catch (error) {
        console.error('Could not shrink a photo:', error)
        failed += 1
      }
      handled += 1
      onProgress?.(handled, totalToDo)
    }

    const swaps = Object.keys(swapped).length
    if (swaps === 0) continue

    const update = { images: product.images.map((u) => swapped[u] || u) }
    // How each photo is framed is stored against its link, so move that across too.
    if ('image_adjust' in product) {
      update.image_adjust = Object.fromEntries(
        Object.entries(product.image_adjust || {}).map(([u, value]) => [swapped[u] || u, value])
      )
    }
    const { error } = await supabase.from('products').update(update).eq('id', product.id)
    if (error) {
      console.error('Could not update product photos:', error)
      failed += swaps
    } else {
      shrunk += swaps
    }
  }
  return { shrunk, failed, savedBytes }
}

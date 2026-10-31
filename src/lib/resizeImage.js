// Shrinks a photo before upload: max 1200px on the long side, as a JPEG. Phone
// photos and screenshots are often 3-10MB, which makes the shop slow, and the
// site never shows a photo wider than about 600px (1200px covers sharp phone screens).
export async function resizeImage(file, maxDim = 1200, quality = 0.82) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 300 * 1024 && file.type === 'image/jpeg') {
      bitmap.close?.()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    // A JPEG that is already small keeps its original; anything else becomes the new JPEG.
    return blob && (file.type !== 'image/jpeg' || blob.size < file.size) ? blob : file
  } catch {
    return file
  }
}

// File name and type to upload a (possibly resized) photo under.
export function uploadName(original, blob, stamp = Date.now()) {
  const base = original.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'photo'
  const ext = blob.type === 'image/jpeg' ? 'jpg' : (original.name.split('.').pop() || 'jpg').toLowerCase()
  return { name: `${stamp}-${base}.${ext}`, contentType: blob.type || original.type || 'image/jpeg' }
}

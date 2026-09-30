// Shrinks a photo before upload: max 1600px on the long side, JPEG. Phone and
// camera photos are often 5–10MB, which is slow to upload and slow to load.
export async function resizeImage(file, maxDim = 1600, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 400 * 1024 && file.type === 'image/jpeg') return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close?.()

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/**
 * Maakt van een gekozen foto een klein vierkant plaatje (data-URL), zodat het
 * met de planning mee kan synchroniseren en ook offline te zien is.
 * Het midden van de foto wordt bijgesneden tot een vierkant.
 */
export const AVATAR_SIZE = 160
/** Moet onder de grens in de database blijven (200 000 tekens). */
export const AVATAR_MAX_LENGTH = 200_000

async function loadImage(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // Valt terug op een <img>, bijvoorbeeld voor formaten die createImageBitmap niet kent.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function fileToAvatar(file: Blob, size = AVATAR_SIZE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Kies een afbeelding.')
  const image = await loadImage(file)
  const side = Math.min(image.width, image.height)
  if (!side) throw new Error('Deze afbeelding kon niet gelezen worden.')
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Deze afbeelding kon niet verwerkt worden.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size)
  if ('close' in image && typeof image.close === 'function') image.close()

  for (const quality of [0.85, 0.7, 0.5]) {
    const url = canvas.toDataURL('image/jpeg', quality)
    if (url.length <= AVATAR_MAX_LENGTH) return url
  }
  throw new Error('Deze afbeelding is te groot.')
}

/** Eén of twee hoofdletters uit de naam, voor als er geen foto is. */
export function initials(name: string): string {
  const words = name
    .replace(/['’]s\b/gi, '')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w))
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words.slice(0, 1)
  return letters.map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, '')][0] ?? '').join('').toUpperCase() || '?'
}

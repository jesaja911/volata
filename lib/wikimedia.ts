/**
 * Fetches a thumbnail photo from Wikipedia/Wikimedia Commons for a given name.
 * Tries German Wikipedia first, then English as fallback.
 */
export async function fetchWikimediaPhoto(name: string): Promise<string | null> {
  const langs = ['de', 'en']

  for (const lang of langs) {
    try {
      const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`
      const res = await fetch(url, {
        signal: AbortSignal.timeout(4000),
        headers: { 'Accept': 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        // Prefer originalimage (high-res) then thumbnail
        const src = data.originalimage?.source || data.thumbnail?.source || null
        if (src) return src
      }
    } catch {
      // Network error or timeout – continue to next language
    }
  }
  return null
}

/**
 * Returns a Wikipedia page URL for displaying as a link.
 */
export function getWikipediaUrl(name: string, lang = 'de'): string {
  return `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(name)}`
}

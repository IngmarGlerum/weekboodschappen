/**
 * De versie van de app en het herstellen van een vastgelopen, oude kopie.
 *
 * De app bewaart zichzelf in de browser (service worker), zodat hij offline opent.
 * Mislukt het bijwerken daarvan, dan blijft de browser een oude versie tonen, ook na
 * herladen of een herstart. Daarom vergelijkt de app zelf zijn versie met version.json
 * op de server, en kan hij de opgeslagen kopie helemaal weggooien en opnieuw laden.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'onbekend'

/** De versie die nu op de server staat, of null (offline, of in ontwikkeling). */
export async function fetchServerVersion(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!response.ok) return null
    const body = (await response.json()) as { version?: unknown }
    return typeof body.version === 'string' ? body.version : null
  } catch {
    return null
  }
}

/** Gooit de opgeslagen kopie van de app weg (service worker en caches) en laadt opnieuw. */
export async function hardReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((r) => r.unregister()))
    }
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    // Wat niet lukt, lukt niet; opnieuw laden helpt meestal toch.
  }
  // Een unieke parameter omzeilt elke tussenliggende cache van index.html.
  const url = new URL(window.location.href)
  url.searchParams.set('v', String(Date.now()))
  window.location.replace(url.toString())
}

/**
 * Een korte "tik" die je voelt, zoals in een to-do-app bij toevoegen en afvinken.
 *
 * - Android (Chrome, Firefox): via navigator.vibrate.
 * - iPhone: Safari kent navigator.vibrate niet. Sinds iOS 18 geeft een schakelaar
 *   (<input type="checkbox" switch>) wel een systeemtik als je hem aanklikt; dat
 *   gebruiken we met een onzichtbare schakelaar. Dit werkt alleen direct na een
 *   aanraking, dus een tweede tik na een animatie voel je op een iPhone niet altijd.
 * - Elders gebeurt er niets.
 */

/** Ondersteunt dit apparaat navigator.vibrate (Android)? */
export const canVibrate = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'

function iosTick() {
  // Zoals de bekende truc: een verse, verborgen schakelaar in <head>, aanklikken
  // via het label en weer weghalen. iOS geeft daarbij zijn eigen systeemtik.
  const label = document.createElement('label')
  label.ariaHidden = 'true'
  label.style.display = 'none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  label.appendChild(input)
  document.head.appendChild(label)
  label.click()
  document.head.removeChild(label)
}

export function tick(strength: 'light' | 'medium' = 'light') {
  try {
    if (canVibrate()) {
      navigator.vibrate(strength === 'light' ? 8 : 15)
      return
    }
    // iPhone/iPad (ook een iPad die zich als Mac voordoet): geen vibrate, wel touch.
    if (typeof document !== 'undefined' && navigator.maxTouchPoints > 0) iosTick()
  } catch {
    // Trillen is een extraatje; als het niet kan, gewoon doorgaan.
  }
}

/** Respecteer "minder beweging" van het systeem. */
export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

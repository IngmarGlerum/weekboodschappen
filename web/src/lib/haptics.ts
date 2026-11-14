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

let iosSwitch: HTMLLabelElement | null = null

function iosTick() {
  if (!iosSwitch) {
    const label = document.createElement('label')
    label.setAttribute('aria-hidden', 'true')
    label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-9999px'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.setAttribute('switch', '')
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = label
  }
  iosSwitch.click()
}

export function tick(strength: 'light' | 'medium' = 'light') {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(strength === 'light' ? 8 : 15)
      return
    }
    if (typeof document !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)) iosTick()
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

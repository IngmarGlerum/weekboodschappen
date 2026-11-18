import { Box } from '@chakra-ui/react'
import { useEffect, useRef, type ReactNode } from 'react'

interface Props {
  /** Welke pagina zichtbaar is (0 of 1). */
  index: number
  onIndexChange: (index: number) => void
  panes: [ReactNode, ReactNode]
}

const EASE = 'transform 0.32s cubic-bezier(0.22, 0.8, 0.24, 1)'

/**
 * Twee pagina's naast elkaar (Week en Lijst) die je met je vinger opzij schuift:
 * de andere pagina glijdt al mee in beeld terwijl je veegt. Loslaat je ver genoeg
 * (of snel genoeg), dan wissel je; anders veert hij terug.
 *
 * Niet vegen als: je in een invoerveld begint, je eerst even vasthoudt (dat is
 * slepen in de lijst), of je op de Lijst een item naar links veegt (verwijderen).
 */
export function SwipePager({ index, onIndexChange, panes }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const indexRef = useRef(index)
  const onChange = useRef(onIndexChange)
  indexRef.current = index
  onChange.current = onIndexChange

  function place(offset: number, animate: boolean) {
    const el = track.current
    if (!el) return
    el.style.transition = animate ? EASE : 'none'
    el.style.transform = `translate3d(calc(${-indexRef.current * 50}% + ${offset}px), 0, 0)`
  }

  // Bij wisselen via het menu: soepel naar de juiste pagina.
  useEffect(() => {
    place(0, true)
  }, [index])

  useEffect(() => {
    const el = container.current
    if (!el) return
    let start: { x: number; y: number; t: number; target: HTMLElement } | null = null
    let lock: 'x' | 'y' | 'none' | null = null
    let dx = 0

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) {
        start = null
        return
      }
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: Date.now(), target: e.target as HTMLElement }
      lock = null
      dx = 0
    }

    function onMove(e: TouchEvent) {
      if (!start || lock === 'y' || lock === 'none') return
      const t = e.touches[0]
      const mx = t.clientX - start.x
      const my = t.clientY - start.y
      if (lock === null) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) {
          lock = 'y'
          return
        }
        if (Math.abs(mx) < 10) return
        const onList = indexRef.current === 1
        const blocked =
          start.target.closest('input, textarea, [data-no-swipe]') !== null ||
          Date.now() - start.t > 280 || // vasthouden = slepen
          (onList && mx < 0 && start.target.closest('[data-row-swipe]') !== null)
        lock = blocked ? 'none' : 'x'
        if (lock === 'none') return
      }
      e.preventDefault()
      const atEdge = (indexRef.current === 0 && mx > 0) || (indexRef.current === 1 && mx < 0)
      dx = atEdge ? mx * 0.25 : mx
      place(dx, false)
    }

    function onEnd() {
      if (!start) return
      const wasX = lock === 'x'
      const dt = Math.max(1, Date.now() - start.t)
      start = null
      lock = null
      if (!wasX) return
      const width = el?.clientWidth ?? 1
      const velocity = dx / dt
      const i = indexRef.current
      let next = i
      if (i === 0 && (dx < -width * 0.25 || velocity < -0.45)) next = 1
      if (i === 1 && (dx > width * 0.25 || velocity > 0.45)) next = 0
      if (next !== i) {
        // Meteen verder glijden; de route volgt.
        indexRef.current = next
        place(0, true)
        onChange.current(next)
      } else {
        place(0, true)
      }
      dx = 0
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  return (
    <Box ref={container} as="main" flex="1" minH="0" overflow="hidden" position="relative" touchAction="pan-y">
      <Box
        ref={track}
        display="flex"
        w="200%"
        h="full"
        style={{ transform: `translate3d(${-index * 50}%, 0, 0)`, willChange: 'transform' }}
      >
        {panes.map((pane, i) => (
          <Box
            key={i}
            w="50%"
            h="full"
            overflowY="auto"
            overscrollBehaviorY="contain"
            aria-hidden={i !== index}
            inert={i !== index ? true : undefined}
          >
            <Box maxW="720px" mx="auto" px="4" pt="4" pb="96px">
              {pane}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

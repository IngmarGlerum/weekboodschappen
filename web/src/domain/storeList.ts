/**
 * De lijst (in de stijl van een to-do-app): sorteren, filteren en een plek
 * berekenen bij slepen. Puur rekenwerk, zodat het te testen is.
 */

export type SortMode = 'manual' | 'alpha' | 'created' | 'label'

export const SORT_LABELS: Record<SortMode, string> = {
  manual: 'Eigen volgorde',
  alpha: 'Alfabetisch',
  created: 'Datum toegevoegd',
  label: 'Per label',
}

export interface ListItem {
  id: string
  title: string
  done: boolean
  important: boolean
  labelId: string | null
  position: number | null
  createdAt: string | null
  completedAt: string | null
}

export interface ListLabel {
  id: string
  name: string
}

const collator = new Intl.Collator('nl', { sensitivity: 'base', numeric: true })

function byPosition(a: ListItem, b: ListItem) {
  const pa = a.position ?? Number.MAX_SAFE_INTEGER
  const pb = b.position ?? Number.MAX_SAFE_INTEGER
  return pa - pb || (a.createdAt ?? '').localeCompare(b.createdAt ?? '') || a.id.localeCompare(b.id)
}

/**
 * Open items: met ster bovenaan, daarna volgens de gekozen sortering.
 * Afgevinkte items: het laatst afgevinkte bovenaan.
 * Met een labelfilter alleen de items met dat label.
 */
export function arrangeList(
  items: ListItem[],
  mode: SortMode,
  labels: ListLabel[],
  filterLabelId: string | null = null,
): { open: ListItem[]; done: ListItem[] } {
  const visible = filterLabelId ? items.filter((i) => i.labelId === filterLabelId) : items
  const labelName = new Map(labels.map((l) => [l.id, l.name]))

  const compare = (a: ListItem, b: ListItem): number => {
    if (a.important !== b.important) return a.important ? -1 : 1
    switch (mode) {
      case 'alpha':
        return collator.compare(a.title, b.title) || byPosition(a, b)
      case 'created':
        return (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || byPosition(a, b)
      case 'label': {
        // Items zonder label (of met een verwijderd label) achteraan.
        const la = (a.labelId && labelName.get(a.labelId)) || null
        const lb = (b.labelId && labelName.get(b.labelId)) || null
        if (la !== lb) {
          if (la === null) return 1
          if (lb === null) return -1
          return collator.compare(la, lb)
        }
        return byPosition(a, b)
      }
      default:
        return byPosition(a, b)
    }
  }

  const open = visible.filter((i) => !i.done).sort(compare)
  const done = visible
    .filter((i) => i.done)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') || byPosition(a, b))
  return { open, done }
}

/**
 * De nieuwe `position` voor een item dat in `ordered` (de getoonde volgorde,
 * zonder het gesleepte item) op plek `index` wordt neergezet: het midden tussen
 * de buren, zodat alleen dit ene item verandert.
 */
export function positionAt(ordered: ListItem[], index: number): number {
  const before = ordered[index - 1]?.position ?? null
  const after = ordered[index]?.position ?? null
  if (before === null && after === null) return 1
  if (before === null) return (after as number) - 1
  if (after === null) return before + 1
  return (before + after) / 2
}

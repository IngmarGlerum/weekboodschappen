import { describe, expect, it } from 'vitest'
import { arrangeList, positionAt, type ListItem } from './storeList'

const item = (id: string, over: Partial<ListItem> = {}): ListItem => ({
  id,
  title: id,
  done: false,
  important: false,
  labelId: null,
  position: null,
  createdAt: null,
  completedAt: null,
  ...over,
})

const labels = [
  { id: 'jumbo', name: 'Jumbo' },
  { id: 'kruidvat', name: 'Kruidvat' },
]

describe('arrangeList', () => {
  const items = [
    item('kaas', { position: 3, labelId: 'jumbo', createdAt: '2026-11-01' }),
    item('Appels', { position: 1, createdAt: '2026-11-03' }),
    item('shampoo', { position: 2, labelId: 'kruidvat', important: true, createdAt: '2026-11-02' }),
    item('brood', { position: 4, done: true, completedAt: '2026-11-05T10:00' }),
    item('melk', { position: 5, done: true, completedAt: '2026-11-05T12:00' }),
  ]

  it('eigen volgorde, met ster bovenaan', () => {
    expect(arrangeList(items, 'manual', labels).open.map((i) => i.id)).toEqual(['shampoo', 'Appels', 'kaas'])
  })

  it('alfabetisch zonder op hoofdletters te letten', () => {
    expect(arrangeList(items, 'alpha', labels).open.map((i) => i.id)).toEqual(['shampoo', 'Appels', 'kaas'])
    const plain = items.map((i) => ({ ...i, important: false }))
    expect(arrangeList(plain, 'alpha', labels).open.map((i) => i.id)).toEqual(['Appels', 'kaas', 'shampoo'])
  })

  it('nieuwste eerst bij datum toegevoegd', () => {
    const plain = items.map((i) => ({ ...i, important: false }))
    expect(arrangeList(plain, 'created', labels).open.map((i) => i.id)).toEqual(['Appels', 'shampoo', 'kaas'])
  })

  it('per label, items zonder label achteraan', () => {
    const plain = items.map((i) => ({ ...i, important: false }))
    expect(arrangeList(plain, 'label', labels).open.map((i) => i.id)).toEqual(['kaas', 'shampoo', 'Appels'])
  })

  it('afgevinkt: laatst afgevinkt bovenaan', () => {
    expect(arrangeList(items, 'manual', labels).done.map((i) => i.id)).toEqual(['melk', 'brood'])
  })

  it('filter op label', () => {
    const r = arrangeList(items, 'manual', labels, 'jumbo')
    expect(r.open.map((i) => i.id)).toEqual(['kaas'])
    expect(r.done).toEqual([])
  })
})

describe('positionAt', () => {
  const ordered = [item('a', { position: 1 }), item('b', { position: 2 }), item('c', { position: 4 })]
  it('tussen twee buren in', () => {
    expect(positionAt(ordered, 1)).toBe(1.5)
    expect(positionAt(ordered, 2)).toBe(3)
  })
  it('bovenaan en onderaan', () => {
    expect(positionAt(ordered, 0)).toBe(0)
    expect(positionAt(ordered, 3)).toBe(5)
  })
  it('lege lijst', () => {
    expect(positionAt([], 0)).toBe(1)
  })
})

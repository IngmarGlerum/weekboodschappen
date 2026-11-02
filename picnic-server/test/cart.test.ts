import { beforeEach, describe, expect, it } from 'vitest'
import { addToCart, parseItems } from '../src/cart.js'
import { HttpError } from '../src/errors.js'
import { Store } from '../src/store.js'
import { createFakePicnic } from './fakePicnic.js'

const KEY = Buffer.alloc(32, 7)
const H = 'household-1'

function setup() {
  const fake = createFakePicnic()
  fake.state.accounts.set('a@b.nl', { password: 'pw', twoFactor: false })
  const login = fake.factory()
  const ready = login.login('a@b.nl', 'pw').then(() => login)
  const store = new Store(':memory:', KEY)
  return { fake, store, ready }
}

const quantity = (fake: ReturnType<typeof createFakePicnic>, id: string) => fake.state.carts.get('a@b.nl')?.get(id) ?? 0

describe('parseItems', () => {
  it('voegt dubbele producten samen', () => {
    expect(parseItems([{ productId: 's1', count: 2 }, { productId: 's1', count: 1 }])).toEqual([
      { productId: 's1', count: 3 },
    ])
  })

  it.each([
    [[]],
    [[{ productId: 's1', count: 0 }]],
    [[{ productId: 's1', count: 1.5 }]],
    [[{ productId: 's1', count: 100 }]],
    [[{ productId: '', count: 1 }]],
    [[{ productId: 's1; drop', count: 1 }]],
    ['niet een lijst'],
  ])('weigert ongeldige invoer %j', (raw) => {
    expect(() => parseItems(raw)).toThrow(HttpError)
  })
})

describe('addToCart: nooit dubbel toevoegen', () => {
  let t: ReturnType<typeof setup>
  beforeEach(() => {
    t = setup()
  })

  it('voegt producten toe en controleert het mandje', async () => {
    const api = await t.ready
    const result = await addToCart({ api, store: t.store }, H, 'req-0001-aaaa', [
      { productId: 's1001', count: 4 },
      { productId: 's1003', count: 1 },
    ])
    expect(result.replayed).toBe(false)
    expect(result.outcomes).toEqual([
      { productId: 's1001', requested: 4, added: 4, alreadyThere: 0 },
      { productId: 's1003', requested: 1, added: 1, alreadyThere: 0 },
    ])
    expect(quantity(t.fake, 's1001')).toBe(4)
  })

  it('telt bestaande producten in het mandje niet mee als "toegevoegd"', async () => {
    const api = await t.ready
    await api.addProduct('s1001', 2) // stond er al
    await addToCart({ api, store: t.store }, H, 'req-0002-aaaa', [{ productId: 's1001', count: 3 }])
    expect(quantity(t.fake, 's1001')).toBe(5)
  })

  it('geeft bij een herhaald verzoek hetzelfde resultaat zonder opnieuw toe te voegen', async () => {
    const api = await t.ready
    const items = [{ productId: 's1001', count: 2 }]
    await addToCart({ api, store: t.store }, H, 'req-0003-aaaa', items)
    const calls = t.fake.state.addCalls.length
    const again = await addToCart({ api, store: t.store }, H, 'req-0003-aaaa', items)
    expect(again.replayed).toBe(true)
    expect(t.fake.state.addCalls.length).toBe(calls)
    expect(quantity(t.fake, 's1001')).toBe(2)
  })

  it('voegt niets dubbel toe als het antwoord van Picnic verloren ging', async () => {
    const api = await t.ready
    const items = [{ productId: 's1001', count: 2 }]
    t.fake.state.loseResponseOnAdd = 1
    await expect(addToCart({ api, store: t.store }, H, 'req-0004-aaaa', items)).rejects.toThrow()
    expect(quantity(t.fake, 's1001')).toBe(2) // Picnic voerde het wél uit

    const retry = await addToCart({ api, store: t.store }, H, 'req-0004-aaaa', items)
    expect(quantity(t.fake, 's1001')).toBe(2) // en bij de herhaling niet nog eens
    expect(retry.outcomes[0]).toMatchObject({ added: 0, alreadyThere: 2 })
  })

  it('voegt na een halve mislukking alleen aan wat er nog ontbreekt toe', async () => {
    const api = await t.ready
    const items = [
      { productId: 's1001', count: 2 },
      { productId: 's1002', count: 1 },
    ]
    t.fake.state.failBeforeApplyAtCall = 2 // het tweede product mislukt
    await expect(addToCart({ api, store: t.store }, H, 'req-0005-aaaa', items)).rejects.toThrow()
    expect(quantity(t.fake, 's1001')).toBe(2)
    expect(quantity(t.fake, 's1002')).toBe(0)

    t.fake.state.failBeforeApplyAtCall = null
    await addToCart({ api, store: t.store }, H, 'req-0005-aaaa', items)
    expect(quantity(t.fake, 's1001')).toBe(2)
    expect(quantity(t.fake, 's1002')).toBe(1)
  })

  it('meldt het als Picnic bevestigt maar het mandje niet klopt, en laat een herhaling toe', async () => {
    const api = await t.ready
    const items = [{ productId: 's1001', count: 2 }]
    t.fake.state.dropAdd = true
    await expect(addToCart({ api, store: t.store }, H, 'req-0006-aaaa', items)).rejects.toMatchObject({
      code: 'cart_verification_failed',
    })

    t.fake.state.dropAdd = false
    await addToCart({ api, store: t.store }, H, 'req-0006-aaaa', items)
    expect(quantity(t.fake, 's1001')).toBe(2)
  })

  it('houdt verzoeken van verschillende huishoudens gescheiden, ook bij hetzelfde requestId', async () => {
    const api = await t.ready
    const items = [{ productId: 's1001', count: 1 }]
    await addToCart({ api, store: t.store }, 'household-1', 'req-0007-aaaa', items)
    const other = await addToCart({ api, store: t.store }, 'household-2', 'req-0007-aaaa', items)
    expect(other.replayed).toBe(false)
  })
})

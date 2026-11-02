import { PicnicError } from '../src/errors.js'
import type { CartSummary, PicnicApi, PicnicApiFactory, ProductHit } from '../src/picnic.js'

export const CATALOG: ProductHit[] = [
  { id: 's1001', name: 'Uien', brand: null, unitQuantity: '1 kg', priceCents: 129, unavailable: false },
  { id: 's1002', name: 'Halfvolle melk', brand: 'Campina', unitQuantity: '1,5 liter', priceCents: 189, unavailable: false },
  { id: 's1003', name: 'Gehakt', brand: null, unitQuantity: '500 gram', priceCents: 349, unavailable: false },
]

/**
 * Een nep-Picnic met dezelfde interface als de echte koppeling. Je kunt er fouten in laten
 * optreden (antwoord kwijt, toevoegen stilletjes negeren) om de herhaallogica te testen.
 */
export function createFakePicnic() {
  const state = {
    accounts: new Map<string, { password: string; twoFactor: boolean }>(),
    keys: new Map<string, string>(),
    carts: new Map<string, Map<string, number>>(),
    smsCode: '123456',
    nextKey: 1,
    addCalls: [] as Array<{ productId: string; count: number }>,
    /** Het toevoegen lukt bij Picnic, maar het antwoord komt nooit aan (n keer). */
    loseResponseOnAdd: 0,
    /** Het toevoegen wordt bevestigd maar niet uitgevoerd. */
    dropAdd: false,
    /** Het n-de toevoegen mislukt voordat Picnic iets doet (1 = eerste). */
    failBeforeApplyAtCall: null as number | null,
  }

  const factory: PicnicApiFactory = (initialKey) => {
    let key = initialKey
    let pendingKey: string | undefined
    let pendingEmail: string | undefined

    const email = (): string => {
      const owner = key ? state.keys.get(key) : undefined
      if (!owner) throw new PicnicError('picnic_auth_expired', 'De Picnic-koppeling is verlopen.', 409, true)
      return owner
    }
    const cartOf = (owner: string) => {
      let cart = state.carts.get(owner)
      if (!cart) state.carts.set(owner, (cart = new Map()))
      return cart
    }
    const summary = (owner: string): CartSummary => {
      const items = [...cartOf(owner)].map(([productId, quantity]) => ({
        productId,
        name: CATALOG.find((p) => p.id === productId)?.name ?? productId,
        quantity,
      }))
      return { totalCount: items.reduce((n, i) => n + i.quantity, 0), totalPriceCents: 0, items }
    }

    const api: PicnicApi = {
      async login(address, password) {
        const account = state.accounts.get(address)
        if (!account || account.password !== password) {
          throw new PicnicError('picnic_invalid_credentials', 'E-mailadres of wachtwoord klopt niet.', 422)
        }
        const issued = `key-${state.nextKey++}`
        if (account.twoFactor) {
          pendingKey = issued
          pendingEmail = address
          key = issued
          return { secondFactorRequired: true }
        }
        state.keys.set(issued, address)
        key = issued
        return { secondFactorRequired: false }
      },
      async verifySecondFactor(code) {
        if (code !== state.smsCode || !pendingKey || !pendingEmail) {
          throw new PicnicError('picnic_invalid_code', 'Die Picnic-code klopt niet.', 422)
        }
        state.keys.set(pendingKey, pendingEmail)
        key = pendingKey
      },
      authKey: () => key,
      async search(query, limit) {
        email()
        return CATALOG.filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit)
      },
      async getCart() {
        return summary(email())
      },
      async addProduct(productId, count) {
        const owner = email()
        state.addCalls.push({ productId, count })
        if (state.failBeforeApplyAtCall === state.addCalls.length) {
          throw new PicnicError('picnic_unreachable', 'Picnic is niet bereikbaar.')
        }
        if (!state.dropAdd) {
          const cart = cartOf(owner)
          cart.set(productId, (cart.get(productId) ?? 0) + count)
        }
        if (state.loseResponseOnAdd > 0) {
          state.loseResponseOnAdd--
          throw new PicnicError('picnic_unreachable', 'Picnic is niet bereikbaar.')
        }
        return summary(owner)
      },
      async logout() {
        if (key) state.keys.delete(key)
        key = undefined
      },
    }
    return api
  }

  return { state, factory }
}

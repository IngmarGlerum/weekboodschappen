import { HttpError } from './errors.js'
import type { CartSummary, PicnicApi } from './picnic.js'
import type { Baseline, Store } from './store.js'

export interface AddItem {
  productId: string
  count: number
}

export interface AddOutcome {
  productId: string
  requested: number
  /** Hoeveel er in deze poging echt is toegevoegd. */
  added: number
  /** Hoeveel er al in het mandje zat door een eerdere poging met hetzelfde verzoek. */
  alreadyThere: number
}

export interface AddResult {
  requestId: string
  outcomes: AddOutcome[]
  cart: CartSummary
}

const MAX_ITEMS = 60
const MAX_COUNT = 99

export function parseItems(raw: unknown): AddItem[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) {
    throw new HttpError(400, 'invalid_items', `Stuur 1 tot ${MAX_ITEMS} producten.`)
  }
  const merged = new Map<string, number>()
  for (const entry of raw as Array<Record<string, unknown>>) {
    const productId = entry?.productId
    const count = entry?.count
    if (typeof productId !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(productId)) {
      throw new HttpError(400, 'invalid_items', 'Ongeldig product-id.')
    }
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
      throw new HttpError(400, 'invalid_items', `Het aantal moet een geheel getal van 1 tot ${MAX_COUNT} zijn.`)
    }
    merged.set(productId, (merged.get(productId) ?? 0) + count)
  }
  return [...merged].map(([productId, count]) => ({ productId, count }))
}

const quantityIn = (cart: CartSummary, productId: string) =>
  cart.items.find((i) => i.productId === productId)?.quantity ?? 0

/**
 * Voegt producten toe aan het Picnic-mandje, zonder ooit dubbel toe te voegen.
 *
 * Een mislukte verbinding betekent niet dat Picnic het verzoek niet heeft uitgevoerd. Daarom:
 *  1. de web-app stuurt bij elke "voeg toe"-actie een `requestId` mee die bij een herhaling gelijk blijft;
 *  2. vóór het toevoegen noteren we hoeveel van elk product al in het mandje zit (de uitgangssituatie);
 *  3. bij een herhaling van hetzelfde verzoek tellen we wat er sinds die uitgangssituatie bij is
 *     gekomen en voegen we alleen het tekort toe;
 *  4. na afloop controleren we in het echte mandje dat alles erin zit.
 *
 * Beperking: past iemand tussen twee pogingen zelf het mandje aan, dan kan de telling afwijken.
 */
export async function addToCart(
  deps: { api: PicnicApi; store: Store },
  householdId: string,
  requestId: string,
  items: AddItem[],
): Promise<AddResult & { replayed: boolean }> {
  const { api, store } = deps

  const previous = store.findRequest(householdId, requestId)
  if (previous?.state === 'done' && previous.result) {
    return { ...(previous.result as AddResult), replayed: true }
  }

  let cart = await api.getCart()
  let baseline: Baseline
  if (previous?.state === 'started') {
    baseline = previous.baseline
    for (const item of items) baseline[item.productId] ??= quantityIn(cart, item.productId)
  } else {
    baseline = Object.fromEntries(items.map((i) => [i.productId, quantityIn(cart, i.productId)]))
    store.startRequest(householdId, requestId, baseline)
  }

  const outcomes: AddOutcome[] = []
  for (const item of items) {
    const alreadyThere = Math.max(0, quantityIn(cart, item.productId) - baseline[item.productId])
    const missing = Math.max(0, item.count - alreadyThere)
    if (missing > 0) cart = await api.addProduct(item.productId, missing)
    outcomes.push({ productId: item.productId, requested: item.count, added: missing, alreadyThere })
  }

  // Controle in het echte mandje; haal het opnieuw op als de laatste mutatie geen volledig mandje gaf.
  const verified = await api.getCart()
  for (const item of items) {
    const gained = quantityIn(verified, item.productId) - baseline[item.productId]
    if (gained < item.count) {
      throw new HttpError(
        502,
        'cart_verification_failed',
        'Niet alles staat in het Picnic-mandje. Probeer het opnieuw; er wordt niets dubbel toegevoegd.',
      )
    }
  }

  const result: AddResult = { requestId, outcomes, cart: verified }
  store.finishRequest(householdId, requestId, result)
  return { ...result, replayed: false }
}

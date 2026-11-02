import PicnicClient from 'picnic-api'
import { PicnicError } from './errors.js'

/**
 * De kleine, eigen laag tussen onze server en Picnic. De rest van de server kent alleen deze
 * interface. Dat houdt de onofficiële `picnic-api` op één plek (als Picnic iets wijzigt, pas je
 * alleen dit bestand aan) en maakt het testen met een nep-Picnic mogelijk.
 */

export interface ProductHit {
  id: string
  name: string
  brand: string | null
  unitQuantity: string
  /** Prijs in centen voor één stuk. */
  priceCents: number
  unavailable: boolean
}

export interface CartLine {
  productId: string
  name: string
  quantity: number
}

export interface CartSummary {
  totalCount: number
  /** Te betalen bedrag in centen. */
  totalPriceCents: number
  items: CartLine[]
}

export interface PicnicApi {
  /** Logt in. Bij 2FA is de SMS dan al onderweg en moet `verifySecondFactor` volgen. */
  login(email: string, password: string): Promise<{ secondFactorRequired: boolean }>
  verifySecondFactor(code: string): Promise<void>
  /** De sleutel waarmee een volgende keer ingelogd kan worden zonder wachtwoord. */
  authKey(): string | undefined
  search(query: string, limit: number): Promise<ProductHit[]>
  getCart(): Promise<CartSummary>
  addProduct(productId: string, count: number): Promise<CartSummary>
  logout(): Promise<void>
}

export type PicnicApiFactory = (authKey?: string) => PicnicApi

function toSummary(cart: PicnicClient.Types.cart.Cart): CartSummary {
  return {
    totalCount: cart.totalCount,
    totalPriceCents: cart.totalPrice,
    items: cart.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity })),
  }
}

/** Zet fouten van de bibliotheek om naar onze eigen foutcodes. */
async function guard<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task()
  } catch (error) {
    if (PicnicClient.isPicnicApiError(error)) {
      const status = (error as { status?: number }).status
      const code = (error as { code?: string }).code ?? 'PICNIC_ERROR'
      if (code === 'AUTH_INVALID_CRED') {
        throw new PicnicError('picnic_invalid_credentials', 'E-mailadres of wachtwoord van Picnic klopt niet.', 422)
      }
      if (code === 'OTP_NOT_VALID') {
        throw new PicnicError('picnic_invalid_code', 'Die Picnic-code klopt niet.', 422)
      }
      if (status === 401 || status === 403) {
        throw new PicnicError('picnic_auth_expired', 'De Picnic-koppeling is verlopen. Log opnieuw in.', 409, true)
      }
      throw new PicnicError('picnic_error', `Picnic gaf een foutmelding (${code}).`)
    }
    if (PicnicClient.isUnexpectedPageFormatError(error)) {
      throw new PicnicError('picnic_changed', 'Picnic heeft iets aan de app veranderd; de koppeling moet worden bijgewerkt.')
    }
    throw new PicnicError('picnic_unreachable', 'Picnic is niet bereikbaar.')
  }
}

/** De echte koppeling, op basis van de onofficiële `picnic-api`. */
export function createPicnicApiFactory(countryCode: 'NL' | 'DE' | 'FR'): PicnicApiFactory {
  return (initialKey) => {
    const client = new PicnicClient({ countryCode, authKey: initialKey })
    let key = initialKey

    return {
      login: (email, password) =>
        guard(async () => {
          const result = await client.auth.login(email, password)
          key = result.authKey
          if (result.secondFactorAuthenticationRequired) {
            await client.auth.generate2FACode('SMS')
          }
          return { secondFactorRequired: result.secondFactorAuthenticationRequired }
        }),
      verifySecondFactor: (code) =>
        guard(async () => {
          const result = await client.auth.verify2FACode(code)
          key = result.authKey
        }),
      authKey: () => key,
      search: (query, limit) =>
        guard(async () => {
          const results = await client.catalog.getSearchResults(query)
          const seen = new Set<string>()
          const hits: ProductHit[] = []
          for (const section of results.products?.sections ?? []) {
            for (const p of section.products) {
              if (seen.has(p.id)) continue
              seen.add(p.id)
              hits.push({
                id: p.id,
                name: p.name,
                brand: p.brand,
                unitQuantity: p.unitQuantity,
                priceCents: p.displayPrice,
                unavailable: p.isUnavailable,
              })
            }
          }
          return hits.slice(0, limit)
        }),
      getCart: () => guard(async () => toSummary(await client.cart.getCart())),
      addProduct: (productId, count) => guard(async () => toSummary(await client.cart.addProductToCart(productId, count))),
      logout: () =>
        guard(async () => {
          await client.auth.logout()
          key = undefined
        }),
    }
  }
}

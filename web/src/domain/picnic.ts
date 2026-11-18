/**
 * Rekenwerk voor de Picnic-koppeling: de verpakking van een product lezen
 * ("1 kg", "6 x 300 ml", "9 rollen") en uitrekenen hoeveel je er nodig hebt.
 * Puur rekenwerk, zodat het te testen is.
 */
import { normalizeName, type ListLine, type Quantity, type RefType } from './shoppingList'

export type Dimension = 'g' | 'ml' | 'stuks'

export interface Amount {
  amount: number
  dimension: Dimension
}

const UNITS: Record<string, { dimension: Dimension; factor: number }> = {
  mg: { dimension: 'g', factor: 0.001 },
  g: { dimension: 'g', factor: 1 },
  gr: { dimension: 'g', factor: 1 },
  gram: { dimension: 'g', factor: 1 },
  grams: { dimension: 'g', factor: 1 },
  kg: { dimension: 'g', factor: 1000 },
  kilo: { dimension: 'g', factor: 1000 },
  kilogram: { dimension: 'g', factor: 1000 },
  ml: { dimension: 'ml', factor: 1 },
  cl: { dimension: 'ml', factor: 10 },
  dl: { dimension: 'ml', factor: 100 },
  l: { dimension: 'ml', factor: 1000 },
  lt: { dimension: 'ml', factor: 1000 },
  liter: { dimension: 'ml', factor: 1000 },
  litre: { dimension: 'ml', factor: 1000 },
}

const toNumber = (s: string) => Number.parseFloat(s.replace(',', '.'))

/** Een hoeveelheid uit het gerecht ("500 g", "2 stuks", "1 kg") in gram, ml of stuks. */
export function toAmount(q: Quantity): Amount | null {
  if (q.amount === null) return null
  const unit = q.unit.trim().toLowerCase()
  if (unit === '' || unit === 'stuk' || unit === 'stuks' || unit === 'st') return { amount: q.amount, dimension: 'stuks' }
  const known = UNITS[unit]
  return known ? { amount: q.amount * known.factor, dimension: known.dimension } : null
}

/**
 * De inhoud van een Picnic-verpakking, uit de tekst van Picnic:
 * "1 kg", "500 gram", "1,5 liter", "6 x 300 ml", "9 rollen, In prijs verlaagd", "per stuk".
 */
export function parseUnitQuantity(text: string | null | undefined): Amount | null {
  if (!text) return null
  // Wat na ", " komt is een opmerking ("In prijs verlaagd"); een komma in een getal blijft staan.
  const main = text.split(/,\s+/)[0].trim().toLowerCase()
  if (/^(per\s+)?stuk$/.test(main)) return { amount: 1, dimension: 'stuks' }

  const multi = /^(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)$/.exec(main)
  if (multi) {
    const known = UNITS[multi[3]]
    const count = Number(multi[1])
    if (known) return { amount: count * toNumber(multi[2]) * known.factor, dimension: known.dimension }
    return { amount: count * toNumber(multi[2]), dimension: 'stuks' }
  }

  const single = /^(\d+(?:[.,]\d+)?)\s*([a-z]+)?/.exec(main)
  if (!single) return null
  const amount = toNumber(single[1])
  const unit = single[2] ?? ''
  const known = UNITS[unit]
  if (known) return { amount: amount * known.factor, dimension: known.dimension }
  // "9 rollen", "6 eieren", "4 stuks", "2 bosjes": een aantal.
  return { amount, dimension: 'stuks' }
}

/**
 * Hoeveel verpakkingen je nodig hebt voor een regel van de boodschappenlijst.
 * Kan het niet worden uitgerekend (andere eenheid, geen hoeveelheid), dan 1.
 * Altijd naar boven afgerond, en hooguit 99.
 */
export function suggestCount(parts: Quantity[], unitQuantity: string | null | undefined): number {
  const pack = parseUnitQuantity(unitQuantity)
  if (!pack || pack.amount <= 0) return 1
  let need = 0
  for (const part of parts) {
    const a = toAmount(part)
    if (!a || a.dimension !== pack.dimension) return 1
    need += a.amount
  }
  if (need <= 0) return 1
  return Math.min(99, Math.max(1, Math.ceil(need / pack.amount - 1e-9)))
}

/** De sleutel waaronder het gekozen Picnic-product van een artikel bewaard wordt. */
export function productRef(line: Pick<ListLine, 'refType' | 'refKey' | 'name'>): { refType: RefType; refKey: string } {
  // Extra's hebben elke week een nieuw id; op naam onthoud je "taart" ook volgende week.
  if (line.refType === 'extra') return { refType: 'extra', refKey: normalizeName(line.name) }
  return { refType: line.refType, refKey: line.refKey }
}

export const productRowId = (householdId: string, refType: RefType, refKey: string) =>
  `${householdId}|${refType}|${refKey}`

export function formatPrice(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return `€ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

import type { Pathfinder2CurrencyAmount } from '../../types'

const COPPER_PER_SILVER = 10
const COPPER_PER_GOLD = 100
const COPPER_PER_PLATINUM = 1_000

function whole(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0))
}

export function currencyToCopper(value: Pathfinder2CurrencyAmount) {
  return whole(value.cp)
    + whole(value.sp) * COPPER_PER_SILVER
    + whole(value.gp) * COPPER_PER_GOLD
    + whole(value.pp) * COPPER_PER_PLATINUM
}

export function currencyFromCopper(value: number): Pathfinder2CurrencyAmount {
  let remaining = whole(value)
  const pp = Math.floor(remaining / COPPER_PER_PLATINUM)
  remaining %= COPPER_PER_PLATINUM
  const gp = Math.floor(remaining / COPPER_PER_GOLD)
  remaining %= COPPER_PER_GOLD
  const sp = Math.floor(remaining / COPPER_PER_SILVER)
  const cp = remaining % COPPER_PER_SILVER
  return { cp, sp, gp, pp }
}

export function normalizeCurrency(value: Pathfinder2CurrencyAmount) {
  return currencyFromCopper(currencyToCopper(value))
}

export function addCurrency(
  left: Pathfinder2CurrencyAmount,
  right: Pathfinder2CurrencyAmount,
) {
  return currencyFromCopper(currencyToCopper(left) + currencyToCopper(right))
}

export function multiplyCurrency(
  value: Pathfinder2CurrencyAmount,
  count: number,
) {
  return currencyFromCopper(currencyToCopper(value) * whole(count))
}

export function subtractCurrency(
  left: Pathfinder2CurrencyAmount,
  right: Pathfinder2CurrencyAmount,
) {
  const result = currencyToCopper(left) - currencyToCopper(right)
  return result < 0 ? null : currencyFromCopper(result)
}

export function compareCurrency(
  left: Pathfinder2CurrencyAmount,
  right: Pathfinder2CurrencyAmount,
) {
  return Math.sign(currencyToCopper(left) - currencyToCopper(right))
}

export function formatCurrency(value: Pathfinder2CurrencyAmount) {
  const normalized = normalizeCurrency(value)
  return ([
    normalized.pp ? `${normalized.pp} пм` : '',
    normalized.gp ? `${normalized.gp} зм` : '',
    normalized.sp ? `${normalized.sp} см` : '',
    normalized.cp ? `${normalized.cp} мм` : '',
  ].filter(Boolean).join(' ') || '0 мм')
}

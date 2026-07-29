export type ParsedLegacyDisciplineCost = {
  rouseChecks: number
  willpowerSpend: number
  willpowerRatingReduction: number
  variableRouseChecks: boolean
  manualWillpower: boolean
  warnings: string[]
}

const EMPTY_COST: ParsedLegacyDisciplineCost = {
  rouseChecks: 0,
  willpowerSpend: 0,
  willpowerRatingReduction: 0,
  variableRouseChecks: false,
  manualWillpower: false,
  warnings: [],
}

function getAmountBefore(
  value: string,
  marker: RegExp,
  fallback = 1,
) {
  const match = value.match(marker)
  if (!match) return 0
  const prefix = value.slice(Math.max(0, match.index! - 24), match.index)
  const rangeStart = prefix.match(/(\d+)\s*(?:[-–—]|\.\.)\s*\d+\s*$/)?.[1]
  const amount = Number(rangeStart || prefix.match(/(\d+)\s*$/)?.[1] || fallback)
  return Math.max(1, Math.floor(amount) || fallback)
}

export function parseLegacyDisciplineCost(
  cost: unknown,
): ParsedLegacyDisciplineCost {
  if (typeof cost !== 'string') return { ...EMPTY_COST, warnings: [] }

  const normalized = cost.trim().toLocaleLowerCase('ru')
  if (
    !normalized
    || normalized === '—'
    || normalized === '-'
    || normalized === 'нет'
    || normalized === 'none'
  ) {
    return { ...EMPTY_COST, warnings: [] }
  }

  const warnings: string[] = []
  const rouseMarker = /испытани[еяй]?\s+крови|rouse\s+checks?|blood\s+trials?/i
  const willpowerMarker = /(?:пункт(?:а|ов)?|очк(?:о|а|ов)?)\s+воли|willpower\s+points?/i
  const rouseChecks = getAmountBefore(normalized, rouseMarker)
  const variableRouseChecks = rouseChecks > 0 && (
    /\d+\s*(?:[-–—]|\.\.)\s*\d+/.test(normalized)
    || /\d+\s*\+/.test(normalized)
    || /за\s+(?:кажд|цель)|per\s+(?:target|use|victim)/i.test(normalized)
    || /до\s+\d+|up\s+to\s+\d+/i.test(normalized)
  )

  const mentionsWillpower = /вол[ия]|willpower/i.test(normalized)
  const reducesWillpower = mentionsWillpower && (
    /сниж|уменьш|теря|постоян|reduc|lower|permanent/i.test(normalized)
    && /рейтинг|максим|значени|rating|maximum|value|willpower|вол/i.test(normalized)
  )
  const manualWillpower = mentionsWillpower && (
    /может|добровольн|по\s+желани|выбор|цель|против|если|\bmay\b|voluntar|at\s+will|choice|choos|target|against|\bif\b/i.test(normalized)
  )

  let willpowerSpend = reducesWillpower
    ? 0
    : getAmountBefore(normalized, willpowerMarker)
  if (!willpowerSpend && !reducesWillpower && mentionsWillpower) {
    const explicitlySpent = /потрат|стоим|расход|треб|spend|cost|requir/i.test(normalized)
    if (explicitlySpent) {
      const nearbyAmount = Number(normalized.match(/(\d+)\s*(?=[^\d]{0,20}(?:вол|willpower))/i)?.[1] || 1)
      willpowerSpend = Math.max(1, Math.floor(nearbyAmount) || 1)
    }
  }

  if (reducesWillpower) {
    warnings.push('Стоимость похожа на снижение рейтинга или максимума Воли и требует ручного решения Рассказчика.')
  }
  if (manualWillpower) {
    warnings.push('В тексте указана добровольная или зависящая от цели трата Воли; автоматически она не списывается.')
  }

  return {
    rouseChecks,
    willpowerSpend,
    willpowerRatingReduction: reducesWillpower
      ? Math.max(1, Math.floor(Number(normalized.match(/(\d+)\s*$/)?.[1] || 1)))
      : 0,
    variableRouseChecks,
    manualWillpower,
    warnings,
  }
}

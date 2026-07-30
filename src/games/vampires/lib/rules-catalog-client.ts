import { loadVersionedRulesCatalog } from '@/platform/rules/catalog-manifest'

export type VampireRulesLanguage = 'ru' | 'en'
export type VampireRulesDocument = Record<string, unknown>

const rulesPromises: Partial<
  Record<VampireRulesLanguage, Promise<VampireRulesDocument>>
> = {}

function isRulesDocument(value: unknown): value is VampireRulesDocument {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

async function loadLocalRulesFallback(language: VampireRulesLanguage) {
  const filename = language === 'en' ? 'rules_eng.json' : 'rules.json'
  const response = await fetch(`/vampires/${filename}`, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error(`Локальный ${filename} недоступен: HTTP ${response.status}.`)
  }
  const rules = await response.json() as unknown
  if (!isRulesDocument(rules)) {
    throw new Error(`Локальный ${filename} имеет неизвестный формат.`)
  }
  return rules
}

async function loadRules(language: VampireRulesLanguage) {
  try {
    const release = await loadVersionedRulesCatalog('vampires')
    const rules = release.files[language]
    if (!isRulesDocument(rules)) {
      throw new Error(`В релизе Vampire отсутствует каталог ${language}.`)
    }
    return rules
  } catch {
    return loadLocalRulesFallback(language)
  }
}

export function loadVampireRulesDocument(language: VampireRulesLanguage) {
  rulesPromises[language] ??= loadRules(language)
  return rulesPromises[language]
}

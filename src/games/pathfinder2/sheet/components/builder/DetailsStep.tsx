'use client'

import { getAncestryById } from '../../data/selectors'
import type {
  Pathfinder2CharacterDraftV4,
  Pathfinder2CharacterState,
  Pathfinder2RulesCatalog,
} from '../../types'
import type { UpdatePathfinder2V4 } from '../component-types'
import styles from '../Pathfinder2SheetPage.module.css'

export default function DetailsStep({
  draft,
  catalog,
  state,
  updateV4,
}: {
  draft: Pathfinder2CharacterDraftV4
  catalog: Pathfinder2RulesCatalog
  state: Pathfinder2CharacterState
  updateV4: UpdatePathfinder2V4
}) {
  const ancestry = getAncestryById(catalog, draft.ancestry.ancestryId)
  const grantedLanguageIds = new Set(state.languages.grantedLanguageIds)
  const allowedLanguageIds = new Set(ancestry?.languageRules.bonusLanguageIds ?? [])
  const availableLanguages = catalog.languages.filter(language => (
    !grantedLanguageIds.has(language.id)
    && (allowedLanguageIds.size === 0 || allowedLanguageIds.has(language.id))
  ))
  const deity = state.religion.deity
  const updateIdentity = (
    field: keyof Pathfinder2CharacterDraftV4['identity'],
    value: string,
  ) => updateV4(current => ({
    ...current,
    identity: { ...current.identity, [field]: value },
  }))

  return (
    <div className={styles.formStack}>
      <div className={styles.fieldGrid}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Возраст</span>
          <input value={draft.identity.age} onChange={event => updateIdentity('age', event.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Регион происхождения</span>
          <input
            value={draft.identity.regionId ?? ''}
            onChange={event => updateV4(current => ({
              ...current,
              identity: {
                ...current.identity,
                regionId: event.target.value || null,
              },
            }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Пункты героизма</span>
          <input
            type="number"
            min={0}
            value={draft.progression.heroPoints}
            onChange={event => updateV4(current => ({
              ...current,
              progression: {
                ...current.progression,
                heroPoints: Math.max(0, Math.round(Number(event.target.value) || 0)),
              },
            }), { immediate: true })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Опыт</span>
          <input
            type="number"
            min={0}
            value={draft.progression.experience}
            onChange={event => updateV4(current => ({
              ...current,
              progression: {
                ...current.progression,
                experience: Math.max(0, Math.round(Number(event.target.value) || 0)),
              },
            }), { immediate: true })}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Пол</span>
          <input value={draft.identity.gender} onChange={event => updateIdentity('gender', event.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Местоимения</span>
          <input value={draft.identity.pronouns} onChange={event => updateIdentity('pronouns', event.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Роль в группе</span>
          <input value={draft.identity.partyRole} onChange={event => updateIdentity('partyRole', event.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Вера или философия</span>
          <input
            value={draft.details.religionText}
            onChange={event => updateV4(current => ({
              ...current,
              details: { ...current.details, religionText: event.target.value },
            }))}
          />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Связи с союзниками</span>
          <textarea rows={3} value={draft.identity.connections} onChange={event => updateIdentity('connections', event.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Краткая история</span>
          <textarea rows={5} value={draft.identity.backstory} onChange={event => updateIdentity('backstory', event.target.value)} />
        </label>
        <label className={`${styles.field} ${styles.fieldWide}`}>
          <span className={styles.fieldLabel}>Заметки</span>
          <textarea
            rows={5}
            value={draft.details.notes}
            onChange={event => updateV4(current => ({
              ...current,
              details: { ...current.details, notes: event.target.value },
            }))}
          />
        </label>
      </div>
      <section className={styles.rulesSection}>
        <header>
          <div><span className={styles.choiceKicker}>Механические сведения</span><h3>Языки и божество</h3></div>
          <span className={
            state.languages.issues.length + state.religion.issues.length
              ? styles.rulesStatusError
              : styles.rulesStatusOk
          }>
            {state.languages.issues.length + state.religion.issues.length
              ? 'нужно исправить'
              : 'проверено'}
          </span>
        </header>
        {catalog.languages.length ? (
          <>
            <div className={styles.selectedChips}>
              {state.languages.grantedLanguageIds.map(languageId => (
                <span key={languageId}>
                  Автоматически · {
                    catalog.languages.find(language => language.id === languageId)?.name
                      ?? languageId
                  }
                </span>
              ))}
            </div>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>
                Дополнительные языки · {state.languages.selectedLanguageIds.length} из {
                  state.languages.choiceLimit ?? '—'
                }
              </span>
              <select
                multiple
                size={Math.min(8, Math.max(3, availableLanguages.length))}
                value={draft.details.languageChoices}
                onChange={event => updateV4(current => ({
                  ...current,
                  details: {
                    ...current.details,
                    languageChoices: Array.from(
                      event.target.selectedOptions,
                      option => option.value,
                    ),
                  },
                }), { immediate: true })}
              >
                {availableLanguages.map(language => (
                  <option key={language.id} value={language.id}>
                    {language.name}{language.rarity !== 'common' ? ` · ${language.rarity}` : ''}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <p>Каталог LanguageId не подключён; свободная строка не считается механическим выбором.</p>
        )}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Домашние языки · с подтверждением Мастера</span>
          <input
            value={draft.details.customLanguages.join(', ')}
            onChange={event => updateV4(current => ({
              ...current,
              details: {
                ...current.details,
                customLanguages: event.target.value
                  .split(',')
                  .map(value => value.trim())
                  .filter(Boolean),
              },
            }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Божество</span>
          <select
            value={draft.details.deityId ?? ''}
            disabled={!catalog.deities.length}
            onChange={event => {
              const deityId = event.target.value || null
              const selectedDeity = catalog.deities.find(entry => entry.id === deityId)
              updateV4(current => ({
                ...current,
                details: {
                  ...current.details,
                  deityId,
                  sanctification: selectedDeity
                    && !selectedDeity.sanctifications.includes(current.details.sanctification)
                    ? selectedDeity.sanctifications[0] ?? 'none'
                    : current.details.sanctification,
                },
              }), { immediate: true })
            }}
          >
            <option value="">
              {catalog.deities.length ? 'Без божества' : 'Каталог не подключён'}
            </option>
            {catalog.deities.map(deity => (
              <option key={deity.id} value={deity.id}>{deity.name}</option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Освящение</span>
          <select
            value={draft.details.sanctification}
            onChange={event => updateV4(current => ({
              ...current,
              details: {
                ...current.details,
                sanctification: event.target.value as 'holy' | 'unholy' | 'none',
              },
            }), { immediate: true })}
          >
            {(['none', 'holy', 'unholy'] as const)
              .filter(value => !deity || deity.sanctifications.includes(value))
              .map(value => (
                <option key={value} value={value}>
                  {value === 'none' ? 'Нет' : value === 'holy' ? 'Святое' : 'Нечестивое'}
                </option>
              ))}
          </select>
        </label>
        {deity ? (
          <article className={styles.selectedChoice}>
            <span className={styles.choiceKicker}>{deity.sourceBook}</span>
            <h3>{deity.name}</h3>
            <p>{deity.description.slice(0, 420)}</p>
            <p><strong>Наказы:</strong> {deity.edicts.join('; ') || 'не указаны'}</p>
            <p><strong>Табу:</strong> {deity.anathema.join('; ') || 'не указаны'}</p>
            <p><strong>Домены:</strong> {deity.domains.join(', ') || 'не указаны'}</p>
          </article>
        ) : null}
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Личные наказы · по одному на строку</span>
          <textarea
            rows={3}
            value={draft.details.personalEdicts.join('\n')}
            onChange={event => updateV4(current => ({
              ...current,
              details: {
                ...current.details,
                personalEdicts: event.target.value
                  .split('\n')
                  .map(value => value.trim())
                  .filter(Boolean),
              },
            }))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Личные табу · по одному на строку</span>
          <textarea
            rows={3}
            value={draft.details.personalAnathema.join('\n')}
            onChange={event => updateV4(current => ({
              ...current,
              details: {
                ...current.details,
                personalAnathema: event.target.value
                  .split('\n')
                  .map(value => value.trim())
                  .filter(Boolean),
              },
            }))}
          />
        </label>
      </section>
    </div>
  )
}

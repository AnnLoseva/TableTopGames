/** Data-driven random complications — not JSX branches. */
export const RANDOM_COMPLICATIONS: readonly string[] = [
  'Свидетель с телефоном оказался рядом',
  'Сирены Второго Инквизиции слышны в квартале',
  'Якорь котерии оказался под давлением',
  'Слухи о Маскараде дошли до смертных СМИ',
  'Союзный НПС требует немедленной встречи',
  'Конкурирующая стая вторгается на территорию',
  'Сбой в логистике: транспорт/документы пропали',
  'Неожиданный резонанс крови меняет кормёжку',
  'Старое обязательство Уз крови всплывает сегодня',
  'Погода/отключение связи мешает плану',
  'Кто-то из смертных узнал имя каинита',
  'Труп/улика появляется там, где её не ждали',
]

export function pickRandomComplication(rng: () => number = Math.random): string {
  const index = Math.floor(rng() * RANDOM_COMPLICATIONS.length)
  return RANDOM_COMPLICATIONS[Math.max(0, Math.min(RANDOM_COMPLICATIONS.length - 1, index))]
}

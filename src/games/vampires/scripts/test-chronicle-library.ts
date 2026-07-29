import assert from 'node:assert/strict'
import {
  buildChronicleDocuments,
  parseChronicleUpload,
  searchChronicleDocuments,
} from '../modules/chronicle-library/utils/chronicle-markdown'
import {
  PERSONAL_TRANSCRIPT_CHUNK_LENGTH,
  preparePersonalTranscript,
} from '../modules/chronicle-library/utils/personal-transcript'

const parsed = parseChronicleUpload(`---
tags: [secret]
---
# Ночь в Иерусалиме

До рассвета осталось мало времени. [[Бриджет|Бриджет Уолш]] ждёт у ворот.

## Первая сцена

> [!info] Только мастеру
> Кит знает пароль.

![[secret-map.png]]

## Вторая сцена

Герои находят знамение Геенны.
`, 'Хроника 1.md')

assert.equal(parsed.documentTitle, 'Ночь в Иерусалиме')
assert.equal(parsed.chunks.length, 3)
assert.equal(parsed.chunks[0].section_title, 'Вступление')
assert.match(parsed.chunks[0].content, /Бриджет Уолш/)
assert.doesNotMatch(parsed.chunks[0].content, /\[\[/)
assert.match(parsed.chunks[1].content, /\*\*Только мастеру\*\*/)
assert.doesNotMatch(parsed.chunks[1].content, /secret-map/)

const long = parseChronicleUpload(`# Большой файл\n\n## Сцена\n\n${'Тайна '.repeat(4_000)}`, 'large.md')
assert.ok(long.chunks.length > 1)
assert.ok(long.chunks.every(chunk => chunk.content.length <= 12_000))
assert.match(long.chunks[0].section_title, /часть 1/)

const documents = buildChronicleDocuments(parsed.chunks.map((chunk, index) => ({
  source_name: 'Хроника 1.md',
  document_title: parsed.documentTitle,
  section_title: chunk.section_title,
  chunk_index: index,
  content: chunk.content,
})))

assert.equal(documents.length, 1)
assert.match(documents[0].markdown, /^# Ночь в Иерусалиме/)
assert.match(documents[0].markdown, /## Вторая сцена/)

const hits = searchChronicleDocuments(documents, 'знамение Геенны')
assert.equal(hits.length, 1)
assert.equal(hits[0].sourceName, 'Хроника 1.md')
assert.equal(hits[0].slug, 'вторая-сцена')

const autoCaptions = `WEBVTT

00:00:01.000 --> 00:00:03.000
Добрый вечер, мы начинаем
четвёртую игровую сессию.

00:00:03.100 --> 00:00:06.000
>> Анна, напомни, где осталась
Альмериальда?

00:00:06.100 --> 00:00:09.000
>> Она всё ещё стоит у ворот
и ждёт Бриджет.

00:00:09.100 --> 00:00:12.000
В самом конце обязательно сохранить эту последнюю реплику.
`
const personal = preparePersonalTranscript(
  autoCaptions,
  '[Russian (auto-generated)] 4 [DownSub.com].txt',
)
const personalText = personal.chunks.join('\n\n')

assert.equal(personal.title, '4')
assert.equal(personal.sourceCharacters, autoCaptions.length)
assert.ok(personal.chunks.every(chunk => chunk.length <= PERSONAL_TRANSCRIPT_CHUNK_LENGTH))
assert.match(personalText, /^Добрый вечер, мы начинаем четвёртую игровую сессию\./)
assert.match(personalText, />> Анна, напомни, где осталась Альмериальда\?/)
assert.match(personalText, />> Она всё ещё стоит у ворот и ждёт Бриджет\./)
assert.match(personalText, /последнюю реплику\.$/)
assert.doesNotMatch(personalText, /-->/)

const oversizedParagraph = `Начало. ${'Очень длинная реплика без потери смысла. '.repeat(900)}Конец.`
const splitPersonal = preparePersonalTranscript(oversizedParagraph, 'session.txt')
assert.ok(splitPersonal.chunks.length > 1)
assert.ok(splitPersonal.chunks.every(chunk => chunk.length <= PERSONAL_TRANSCRIPT_CHUNK_LENGTH))
assert.match(splitPersonal.chunks[0], /^Начало\./)
assert.match(splitPersonal.chunks.at(-1) || '', /Конец\.$/)

console.log('Chronicle library parser/search tests passed.')

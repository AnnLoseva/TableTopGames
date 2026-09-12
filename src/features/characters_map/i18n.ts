import { CHARACTER_KIND_LABELS, GALLERY_CATEGORY_LABELS } from './constants'
import type {
  AttributeKey,
  CharacterKind,
  GalleryCategory,
  MapCharacter,
  MapRelationship,
  SkillKey,
} from './types'

export type MapLanguage = 'ru' | 'en'

// ---------------------------------------------------------------------------
// Static UI-chrome dictionary. Every component in this feature takes a
// `language` prop and does `const s = t(language)` to look up its own
// strings — this is the RU half; `EN` below must match its exact shape
// (enforced by `typeof RU`, so a missing/extra key in either language is a
// type error, not a silent gap at runtime).
// ---------------------------------------------------------------------------

const RU = {
  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    edit: 'Редактировать',
    delete: 'Удалить',
    close: 'Закрыть',
  },
  topBar: {
    title: 'Карта персонажей',
    subtitleEditor: 'Режим редактирования',
    subtitleChecking: 'Проверяю аккаунт…',
    subtitleViewer: 'Режим просмотра',
    exportButton: 'Экспорт',
    toViewModeButton: 'Режим просмотра',
    toEditModeButton: 'Режим редактирования',
    addCharacterButton: '+ Персонаж',
    addRelationshipButton: '+ Связь',
    rosterButton: 'Все персонажи',
    languageButton: 'EN',
    translating: (done: number, total: number) => `Перевожу… ${done}/${total}`,
  },
  loading: {
    loadingMap: 'Загружаю карту…',
    loadFailed: 'Не удалось загрузить карту. Попробуйте обновить страницу.',
    emptyEditor: 'Персонажей пока нет. Нажмите «+ Персонаж», чтобы добавить первого.',
    emptyViewer: 'На карте пока нет персонажей.',
  },
  hint: {
    base: 'Колесо мыши или щипок двумя пальцами — масштаб, перетаскивание фона — панорама',
    editorSuffix: ', перетаскивание персонажа — перемещение, правая кнопка мыши (или долгое нажатие) на персонаже — создать связь',
  },
  characterPanel: {
    ariaClose: 'Закрыть',
    ariaRemoveEvent: 'Удалить событие',
    ariaRemoveDiscipline: 'Удалить дисциплину',
    ariaRemovePhoto: 'Удалить фото',
    replacePhoto: 'Заменить фото',
    uploadPhoto: 'Загрузить фото',
    metaClan: 'Клан',
    metaGeneration: 'Поколение',
    metaPredatorType: 'Хищник',
    metaSire: 'Сир',
    conceptPlaceholder: 'Концепция',
    timelineHeading: 'Линия времени',
    birthYearLabel: 'Год рождения',
    birthYearUnset: 'не указан',
    birthDateLabelLabel: 'Дата рождения (текстом)',
    birthDateLabelPlaceholder: 'например: 12 апреля 1993',
    bornAsLabel: 'Кем родился(-ась)',
    dash: '—',
    noEvents: 'Событий не добавлено.',
    eventWhatHappened: 'Что случилось',
    eventKindNoChange: 'Вид: не менять',
    eventBecame: (kind: string) => `Стал(а): ${kind}`,
    eventStatusNoChange: 'Статус: не менять',
    eventDied: 'Погиб(ла)',
    eventAliveAgain: 'Жив(а) / воскрес(ла)',
    eventDescriptionPlaceholder: 'Описание события',
    eventFallbackTitle: 'Событие',
    eventBecameSuffix: (kind: string) => ` — стал(а) ${kind}`,
    eventDiedSuffix: ' — погиб(ла)',
    eventAliveSuffix: ' — жив(а)',
    addEventButton: '+ Событие',
    eventDateHint: 'Месяц и день — необязательное уточнение к году.',
    eventRelationshipsHeading: 'Отношения, которые появляются здесь',
    eventRelationshipsViewLabel: 'Отношения:',
    addEventRelationshipButton: '+ Линия отношений',
    eventRelDirectionOut: 'Этот персонаж → выбранный',
    eventRelDirectionIn: 'Выбранный → этот персонаж',
    eventRelDirectionMutual: 'Взаимное ↔',
    eventRelTargetPlaceholder: 'С кем',
    eventRelLabelPlaceholder: 'Название отношения',
    eventRelDescriptionPlaceholder: 'Описание отношения (необязательно)',
    eventRelNoTargets: 'Нужен хотя бы ещё один персонаж на карте.',
    eventRelAppearsNote: (date: string) => `Линия появится: ${date}`,
    eventRelUndatedNote: 'Год события не задан — линия будет видна всегда.',
    ariaRemoveEventRelationship: 'Удалить линию отношений',
    confirmRemoveEventRelationship: (label: string) => `Удалить линию отношений «${label}»? Она полностью исчезнет с карты.`,
    errorRelationshipTargetRequired: 'Выберите персонажа для линии отношений.',
    errorRelationshipLabelRequired: 'Введите название линии отношений.',
    ambitionDesireHeading: 'Амбиция и Желание',
    ambitionLabel: 'Амбиция',
    desireLabel: 'Желание',
    attributesHeading: 'Атрибуты',
    skillsHeading: 'Навыки',
    disciplinesHeading: 'Дисциплины',
    noDisciplines: 'Дисциплины не указаны.',
    disciplineNamePlaceholder: 'Название дисциплины',
    addDisciplineButton: '+ Дисциплина',
    trackersHeading: 'Трекеры',
    healthLabel: 'Здоровье',
    willpowerLabel: 'Сила воли',
    humanityLabel: 'Человечность',
    stainsLabel: 'Пятна:',
    bloodPotencyLabel: 'Потенция крови',
    touchstonesHeading: 'Точки опоры и убеждения',
    meritsFlawsHeading: 'Достоинства и недостатки',
    meritsLabel: 'Достоинства',
    flawsLabel: 'Недостатки',
    backstoryHeading: 'Предыстория',
    galleryHeading: 'Галерея',
    noPhotosViewer: 'Фото не добавлены.',
    noPhotosEditor: 'Дом, питомцы, интересные события — добавьте первое фото.',
    captionPlaceholder: 'Подпись',
    fallbackAlt: 'Фото из галереи',
    addGalleryPhoto: '+ Фото в галерею',
    confirmDelete: (name: string) => `Удалить персонажа «${name}»? Все связанные отношения тоже удалятся.`,
    errorNameRequired: 'Введите имя персонажа.',
    errorSave: 'Не удалось сохранить.',
    errorDelete: 'Не удалось удалить.',
    errorUploadImage: 'Не удалось загрузить изображение.',
    errorUploadGalleryPhoto: 'Не удалось загрузить фото.',
    errorSaveCaption: 'Не удалось сохранить подпись.',
    errorSaveCategory: 'Не удалось сохранить категорию.',
    errorRemovePhoto: 'Не удалось удалить фото.',
  },
  relationshipPanel: {
    ariaClose: 'Закрыть',
    ariaRemoveEvent: 'Удалить событие',
    mutualLabel: 'Взаимное отношение (в обе стороны)',
    directedLabel: (from: string, to: string) => `${from} → ${to}`,
    historyHeading: 'История',
    eventFallbackTitle: 'Событие',
    appearsSuffix: ' — здесь линия появляется',
    startsLabel: 'Появляется',
    alwaysVisible: 'всегда на карте (дата появления не задана)',
    fromCharacterEvent: (name: string) => `из события персонажа: ${name}`,
    kindLabel: 'Тип связи',
    directedOption: (from: string, to: string) => `Направленная (${from} → ${to})`,
    mutualOption: 'Взаимная (в обе стороны)',
    labelLabel: 'Название',
    colorLabel: 'Цвет',
    descriptionLabel: 'Описание',
    eventWhatHappened: 'Что случилось',
    appearanceNoChange: 'Появление: не отмечать',
    appearsOption: 'Здесь линия появляется',
    newLabelPlaceholder: 'Новое название с этого момента (необязательно)',
    newDescriptionPlaceholder: 'Новое описание с этого момента (необязательно)',
    addEventButton: '+ Событие',
    confirmDelete: (label: string) => `Удалить связь «${label}»?`,
    errorLabelRequired: 'Введите название отношения.',
    errorSave: 'Не удалось сохранить.',
    errorDelete: 'Не удалось удалить.',
  },
  addCharacterModal: {
    title: 'Новый персонаж',
    nameLabel: 'Имя',
    descriptionLabel: 'Описание',
    imageLabel: 'Фото (необязательно)',
    creating: 'Создаю…',
    create: 'Создать',
    cancel: 'Отмена',
    errorNameRequired: 'Введите имя персонажа.',
    errorCreateFailed: 'Не удалось создать персонажа.',
  },
  addRelationshipModal: {
    title: 'Новая связь',
    fromLabel: 'От кого',
    toLabel: 'К кому',
    kindLabel: 'Тип связи',
    directedOption: (from: string, to: string) => `Направленная${from && to ? ` (${from} → ${to})` : ''}`,
    mutualOption: 'Взаимная — одинаковая в обе стороны (команда, брак и т.п.)',
    labelLabel: 'Название',
    labelPlaceholder: 'Например: любит, боится, командир',
    colorLabel: 'Цвет стрелки',
    descriptionLabel: 'Описание',
    creating: 'Создаю…',
    create: 'Создать',
    cancel: 'Отмена',
    errorBothRequired: 'Выберите обоих персонажей.',
    errorSameCharacter: 'Персонажи должны быть разными.',
    errorLabelRequired: 'Введите название отношения.',
    errorCreateFailed: 'Не удалось создать связь.',
    needTwoCharacters: 'Сначала добавьте хотя бы двух персонажей.',
  },
  characterRosterModal: {
    title: 'Все персонажи',
    hint: 'Персонажи, ещё не рождённые на текущий год шкалы времени, не видны на карте — откройте их отсюда, например, чтобы задать дату рождения.',
    notBornYetTag: 'не рождён(а) ещё',
    close: 'Закрыть',
  },
  exportModal: {
    title: 'Экспорт карты в текст',
    hint: 'Скопируйте текст и вставьте его в чат с ИИ или куда угодно ещё — он не видит картинку, но так поймёт, кто с кем как связан.',
    copyButton: 'Скопировать',
    downloadButton: 'Скачать .txt',
    closeButton: 'Закрыть',
    copiedNote: 'Скопировано.',
    copyFailedNote: 'Не удалось скопировать автоматически — текст выделен, скопируйте его сочетанием клавиш.',
  },
  timelineControl: {
    prevEventTitle: 'Предыдущее событие',
    nextEventTitle: 'Следующее событие',
    yearLabel: 'Год',
    presentButton: 'Настоящее время',
    clearDateTitle: 'Показать весь год целиком',
  },
  trackBoxes: {
    max: 'Максимум',
  },
  mapCanvas: {
    connectHint: 'Нажмите на персонажа, к которому ведёт связь. Esc — отмена.',
    createRelationshipButton: 'Создать связь',
  },
  export: {
    docTitle: 'КАРТА ПЕРСОНАЖЕЙ — текстовый экспорт',
    legendLine1: 'Обозначения: «A → B: X» — отношение X направлено от A к B (может быть',
    legendLine2: 'другим в обратную сторону). «A ↔ B: X» — общее/взаимное отношение X,',
    legendLine3: 'одинаковое в обе стороны. У одной пары персонажей может быть сразу',
    legendLine4: 'несколько отношений.',
    charactersHeading: (n: number) => `ПЕРСОНАЖИ (${n}):`,
    relationshipsHeading: (n: number) => `ОТНОШЕНИЯ (${n}):`,
    none: '(нет)',
    generationWord: (n: string) => `поколение ${n}`,
    sireWord: (name: string) => `сир: ${name}`,
    ambitionLabel: 'Амбиция',
    desireLabel: 'Желание',
    attributesLabel: 'Атрибуты',
    skillsLabel: 'Навыки',
    disciplinesLabel: 'Дисциплины',
    healthLabel: 'Здоровье',
    willpowerLabel: 'Сила воли',
    noDamage: 'без урона',
    damageSummary: (max: number, damaged: number, sup: number, agg: number) =>
      `${damaged}/${max} повреждено (поверхностного: ${sup}, тяжёлого: ${agg})`,
    humanityLabel: 'Человечность',
    stainsWord: (n: number) => `пятна: ${n}`,
    bloodPotencyLabel: 'Потенция крови',
    touchstonesLabel: 'Точки опоры',
    meritsLabel: 'Достоинства',
    flawsLabel: 'Недостатки',
    bornLabel: 'Родился(-ась)',
    unknownBirth: 'дата неизвестна',
    timelineLabel: 'Хронология',
    eventFallback: 'Событие',
    appearsSuffix: ' — здесь линия появляется',
    startsLabel: 'Появляется',
    alwaysWord: 'всегда (дата появления не задана)',
    noEvents: 'нет',
    becameSpecies: (kind: string) => `стал(а) — ${kind}`,
    diedWord: 'погиб(ла)',
    aliveAgainWord: 'жив(а)',
    galleryLabel: 'Галерея',
    noGallery: 'нет',
  },
  timelineMarks: {
    birthPrefix: (name: string) => `Рождение: ${name}`,
    characterEvent: (name: string, title: string) => `${name}: ${title}`,
    eventFallback: 'событие',
  },
  dates: {
    monthNone: 'месяц —',
    dayPlaceholder: 'дд',
    ariaMonth: 'Месяц',
    ariaDay: 'День',
  },
}

const EN: typeof RU = {
  common: {
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
  },
  topBar: {
    title: 'Character Map',
    subtitleEditor: 'Editing mode',
    subtitleChecking: 'Checking account…',
    subtitleViewer: 'Viewing mode',
    exportButton: 'Export',
    toViewModeButton: 'Viewing mode',
    toEditModeButton: 'Editing mode',
    addCharacterButton: '+ Character',
    addRelationshipButton: '+ Relationship',
    rosterButton: 'All characters',
    languageButton: 'RU',
    translating: (done: number, total: number) => `Translating… ${done}/${total}`,
  },
  loading: {
    loadingMap: 'Loading the map…',
    loadFailed: 'Failed to load the map. Try refreshing the page.',
    emptyEditor: 'No characters yet. Click "+ Character" to add the first one.',
    emptyViewer: 'There are no characters on the map yet.',
  },
  hint: {
    base: 'Mouse wheel or two-finger pinch — zoom, drag the background — pan',
    editorSuffix: ', drag a character — move, right-click (or long-press) a character — create a relationship',
  },
  characterPanel: {
    ariaClose: 'Close',
    ariaRemoveEvent: 'Remove event',
    ariaRemoveDiscipline: 'Remove discipline',
    ariaRemovePhoto: 'Remove photo',
    replacePhoto: 'Replace photo',
    uploadPhoto: 'Upload photo',
    metaClan: 'Clan',
    metaGeneration: 'Generation',
    metaPredatorType: 'Predator type',
    metaSire: 'Sire',
    conceptPlaceholder: 'Concept',
    timelineHeading: 'Timeline',
    birthYearLabel: 'Birth year',
    birthYearUnset: 'not set',
    birthDateLabelLabel: 'Birth date (text)',
    birthDateLabelPlaceholder: 'e.g. April 12, 1993',
    bornAsLabel: 'Born as',
    dash: '—',
    noEvents: 'No events added.',
    eventWhatHappened: 'What happened',
    eventKindNoChange: "Kind: don't change",
    eventBecame: (kind: string) => `Became: ${kind}`,
    eventStatusNoChange: "Status: don't change",
    eventDied: 'Died',
    eventAliveAgain: 'Alive again / resurrected',
    eventDescriptionPlaceholder: 'Event description',
    eventFallbackTitle: 'Event',
    eventBecameSuffix: (kind: string) => ` — became ${kind}`,
    eventDiedSuffix: ' — died',
    eventAliveSuffix: ' — alive',
    addEventButton: '+ Event',
    eventDateHint: 'Month and day are an optional refinement of the year.',
    eventRelationshipsHeading: 'Relationships that start here',
    eventRelationshipsViewLabel: 'Relationships:',
    addEventRelationshipButton: '+ Relationship line',
    eventRelDirectionOut: 'This character → the chosen one',
    eventRelDirectionIn: 'The chosen one → this character',
    eventRelDirectionMutual: 'Mutual ↔',
    eventRelTargetPlaceholder: 'With whom',
    eventRelLabelPlaceholder: 'Relationship name',
    eventRelDescriptionPlaceholder: 'Relationship description (optional)',
    eventRelNoTargets: 'You need at least one more character on the map.',
    eventRelAppearsNote: (date: string) => `The line appears: ${date}`,
    eventRelUndatedNote: "The event has no year yet — the line will always be visible.",
    ariaRemoveEventRelationship: 'Remove relationship line',
    confirmRemoveEventRelationship: (label: string) => `Delete the relationship line "${label}"? It will disappear from the map entirely.`,
    errorRelationshipTargetRequired: 'Choose a character for the relationship line.',
    errorRelationshipLabelRequired: 'Enter a name for the relationship line.',
    ambitionDesireHeading: 'Ambition and Desire',
    ambitionLabel: 'Ambition',
    desireLabel: 'Desire',
    attributesHeading: 'Attributes',
    skillsHeading: 'Skills',
    disciplinesHeading: 'Disciplines',
    noDisciplines: 'No disciplines listed.',
    disciplineNamePlaceholder: 'Discipline name',
    addDisciplineButton: '+ Discipline',
    trackersHeading: 'Trackers',
    healthLabel: 'Health',
    willpowerLabel: 'Willpower',
    humanityLabel: 'Humanity',
    stainsLabel: 'Stains:',
    bloodPotencyLabel: 'Blood Potency',
    touchstonesHeading: 'Touchstones and Convictions',
    meritsFlawsHeading: 'Merits and Flaws',
    meritsLabel: 'Merits',
    flawsLabel: 'Flaws',
    backstoryHeading: 'Backstory',
    galleryHeading: 'Gallery',
    noPhotosViewer: 'No photos added.',
    noPhotosEditor: 'Home, pets, memorable events — add the first photo.',
    captionPlaceholder: 'Caption',
    fallbackAlt: 'Gallery photo',
    addGalleryPhoto: '+ Photo to gallery',
    confirmDelete: (name: string) => `Delete character "${name}"? All related relationships will be deleted too.`,
    errorNameRequired: "Enter the character's name.",
    errorSave: 'Failed to save.',
    errorDelete: 'Failed to delete.',
    errorUploadImage: 'Failed to upload the image.',
    errorUploadGalleryPhoto: 'Failed to upload the photo.',
    errorSaveCaption: 'Failed to save the caption.',
    errorSaveCategory: 'Failed to save the category.',
    errorRemovePhoto: 'Failed to remove the photo.',
  },
  relationshipPanel: {
    ariaClose: 'Close',
    ariaRemoveEvent: 'Remove event',
    mutualLabel: 'Mutual relationship (both ways)',
    directedLabel: (from: string, to: string) => `${from} → ${to}`,
    historyHeading: 'History',
    eventFallbackTitle: 'Event',
    appearsSuffix: ' — the line appears here',
    startsLabel: 'Appears',
    alwaysVisible: 'always on the map (no appearance date set)',
    fromCharacterEvent: (name: string) => `from a character event: ${name}`,
    kindLabel: 'Relationship type',
    directedOption: (from: string, to: string) => `Directed (${from} → ${to})`,
    mutualOption: 'Mutual (both ways)',
    labelLabel: 'Name',
    colorLabel: 'Color',
    descriptionLabel: 'Description',
    eventWhatHappened: 'What happened',
    appearanceNoChange: "Appearance: don't mark",
    appearsOption: 'The line appears here',
    newLabelPlaceholder: 'New name from this point on (optional)',
    newDescriptionPlaceholder: 'New description from this point on (optional)',
    addEventButton: '+ Event',
    confirmDelete: (label: string) => `Delete the relationship "${label}"?`,
    errorLabelRequired: 'Enter a name for the relationship.',
    errorSave: 'Failed to save.',
    errorDelete: 'Failed to delete.',
  },
  addCharacterModal: {
    title: 'New character',
    nameLabel: 'Name',
    descriptionLabel: 'Description',
    imageLabel: 'Photo (optional)',
    creating: 'Creating…',
    create: 'Create',
    cancel: 'Cancel',
    errorNameRequired: "Enter the character's name.",
    errorCreateFailed: 'Failed to create the character.',
  },
  addRelationshipModal: {
    title: 'New relationship',
    fromLabel: 'From',
    toLabel: 'To',
    kindLabel: 'Relationship type',
    directedOption: (from: string, to: string) => `Directed${from && to ? ` (${from} → ${to})` : ''}`,
    mutualOption: 'Mutual — the same both ways (team, marriage, etc.)',
    labelLabel: 'Name',
    labelPlaceholder: 'e.g.: loves, fears, commands',
    colorLabel: 'Arrow color',
    descriptionLabel: 'Description',
    creating: 'Creating…',
    create: 'Create',
    cancel: 'Cancel',
    errorBothRequired: 'Choose both characters.',
    errorSameCharacter: 'The characters must be different.',
    errorLabelRequired: 'Enter a name for the relationship.',
    errorCreateFailed: 'Failed to create the relationship.',
    needTwoCharacters: 'Add at least two characters first.',
  },
  characterRosterModal: {
    title: 'All characters',
    hint: "Characters not yet born by the timeline's current year aren't visible on the map — open them from here, for example, to set a birth date.",
    notBornYetTag: 'not born yet',
    close: 'Close',
  },
  exportModal: {
    title: 'Export the map as text',
    hint: "Copy the text and paste it into a chat with an AI or anywhere else — it can't see the picture, but this way it will understand who's connected to whom.",
    copyButton: 'Copy',
    downloadButton: 'Download .txt',
    closeButton: 'Close',
    copiedNote: 'Copied.',
    copyFailedNote: "Couldn't copy automatically — the text is selected, copy it with a keyboard shortcut.",
  },
  timelineControl: {
    prevEventTitle: 'Previous event',
    nextEventTitle: 'Next event',
    yearLabel: 'Year',
    presentButton: 'Present day',
    clearDateTitle: 'Show the whole year',
  },
  trackBoxes: {
    max: 'Max',
  },
  mapCanvas: {
    connectHint: 'Click the character this relationship points to. Esc — cancel.',
    createRelationshipButton: 'Create relationship',
  },
  export: {
    docTitle: 'CHARACTER MAP — text export',
    legendLine1: 'Legend: "A → B: X" — relationship X points from A to B (it may',
    legendLine2: 'be different in the other direction). "A ↔ B: X" — a shared/mutual',
    legendLine3: 'relationship X, the same both ways. Any pair of characters may have',
    legendLine4: 'several relationships at once.',
    charactersHeading: (n: number) => `CHARACTERS (${n}):`,
    relationshipsHeading: (n: number) => `RELATIONSHIPS (${n}):`,
    none: '(none)',
    generationWord: (n: string) => `generation ${n}`,
    sireWord: (name: string) => `sire: ${name}`,
    ambitionLabel: 'Ambition',
    desireLabel: 'Desire',
    attributesLabel: 'Attributes',
    skillsLabel: 'Skills',
    disciplinesLabel: 'Disciplines',
    healthLabel: 'Health',
    willpowerLabel: 'Willpower',
    noDamage: 'no damage',
    damageSummary: (max: number, damaged: number, sup: number, agg: number) =>
      `${damaged}/${max} damaged (${sup} superficial, ${agg} aggravated)`,
    humanityLabel: 'Humanity',
    stainsWord: (n: number) => `stains: ${n}`,
    bloodPotencyLabel: 'Blood Potency',
    touchstonesLabel: 'Touchstones',
    meritsLabel: 'Merits',
    flawsLabel: 'Flaws',
    bornLabel: 'Born',
    unknownBirth: 'date unknown',
    timelineLabel: 'Timeline',
    eventFallback: 'Event',
    appearsSuffix: ' — the line appears here',
    startsLabel: 'Appears',
    alwaysWord: 'always (no appearance date set)',
    noEvents: 'none',
    becameSpecies: (kind: string) => `became — ${kind}`,
    diedWord: 'died',
    aliveAgainWord: 'alive',
    galleryLabel: 'Gallery',
    noGallery: 'none',
  },
  timelineMarks: {
    birthPrefix: (name: string) => `Birth: ${name}`,
    characterEvent: (name: string, title: string) => `${name}: ${title}`,
    eventFallback: 'event',
  },
  dates: {
    monthNone: 'month —',
    dayPlaceholder: 'dd',
    ariaMonth: 'Month',
    ariaDay: 'Day',
  },
}

export type MapStrings = typeof RU

const MAP_STRINGS: Record<MapLanguage, MapStrings> = { ru: RU, en: EN }

export function t(language: MapLanguage): MapStrings {
  return MAP_STRINGS[language]
}

// ---------------------------------------------------------------------------
// Fixed sheet vocabulary (attribute/skill/kind/gallery-category names). These
// are UI chrome, not owner-authored content, so they're hand-translated here
// rather than run through the AI translation pipeline. Reuses the RU key
// order already defined in `constants.ts`.
// ---------------------------------------------------------------------------

const ATTRIBUTE_LABELS_EN: Record<AttributeKey, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  stamina: 'Stamina',
  charisma: 'Charisma',
  manipulation: 'Manipulation',
  composure: 'Composure',
  intelligence: 'Intelligence',
  wits: 'Wits',
  resolve: 'Resolve',
}

const SKILL_LABELS_EN: Record<SkillKey, string> = {
  athletics: 'Athletics',
  brawl: 'Brawl',
  craft: 'Craft',
  drive: 'Drive',
  firearms: 'Firearms',
  larceny: 'Larceny',
  melee: 'Melee',
  stealth: 'Stealth',
  survival: 'Survival',
  animalKen: 'Animal Ken',
  etiquette: 'Etiquette',
  insight: 'Insight',
  intimidation: 'Intimidation',
  leadership: 'Leadership',
  performance: 'Performance',
  persuasion: 'Persuasion',
  streetwise: 'Streetwise',
  subterfuge: 'Subterfuge',
  academics: 'Academics',
  awareness: 'Awareness',
  finance: 'Finance',
  investigation: 'Investigation',
  medicine: 'Medicine',
  occult: 'Occult',
  politics: 'Politics',
  science: 'Science',
  technology: 'Technology',
}

const GROUP_TITLES_EN: Record<string, string> = {
  'Физические': 'Physical',
  'Социальные': 'Social',
  'Ментальные': 'Mental',
}

const CHARACTER_KIND_LABELS_EN: Record<CharacterKind, string> = {
  human: 'Human',
  vampire: 'Vampire',
  ghost: 'Ghost',
}

const GALLERY_CATEGORY_LABELS_EN: Record<GalleryCategory, string> = {
  house: 'House',
  pet: 'Pet',
  event: 'Event',
  other: 'Other',
}

// Month names for the optional date on a timeline event. Russian needs two
// cases: nominative for "март 2026" (month + year) and genitive for
// "12 марта 2026" (day + month + year); English uses one list for both.
const MONTHS_RU_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

const MONTHS_RU_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** `month` is 1-based, as stored on events. Out-of-range input returns ''. */
export function monthName(month: number, language: MapLanguage, form: 'nominative' | 'genitive' = 'nominative'): string {
  const index = month - 1
  if (index < 0 || index > 11) return ''
  if (language === 'en') return MONTHS_EN[index]
  return form === 'genitive' ? MONTHS_RU_GENITIVE[index] : MONTHS_RU_NOMINATIVE[index]
}

/** Every month, for the month `<select>` in the event editors. */
export function monthOptions(language: MapLanguage): { value: number; label: string }[] {
  return Array.from({ length: 12 }, (_, index) => ({ value: index + 1, label: monthName(index + 1, language) }))
}

export function attributeLabel(key: AttributeKey, language: MapLanguage, ruLabel: string): string {
  return language === 'en' ? ATTRIBUTE_LABELS_EN[key] : ruLabel
}

export function skillLabel(key: SkillKey, language: MapLanguage, ruLabel: string): string {
  return language === 'en' ? SKILL_LABELS_EN[key] : ruLabel
}

export function groupTitle(ruTitle: string, language: MapLanguage): string {
  return language === 'en' ? (GROUP_TITLES_EN[ruTitle] ?? ruTitle) : ruTitle
}

export function characterKindLabel(kind: CharacterKind, language: MapLanguage): string {
  return language === 'en' ? CHARACTER_KIND_LABELS_EN[kind] : CHARACTER_KIND_LABELS[kind]
}

export function galleryCategoryLabel(category: GalleryCategory, language: MapLanguage): string {
  return language === 'en' ? GALLERY_CATEGORY_LABELS_EN[category] : GALLERY_CATEGORY_LABELS[category]
}

// ---------------------------------------------------------------------------
// Dynamic content: cached-translation lookup + staleness hashing.
// ---------------------------------------------------------------------------

/** `localizeCharacter`/`localizeRelationship` return the same shape with text
 * leaves swapped, so `timeline.ts`'s pure functions (which only ever read
 * year/kind/alive/color, never match on text) work unchanged on the result. */
export function localizeCharacter(character: MapCharacter, language: MapLanguage): MapCharacter {
  if (language === 'ru') return character
  const tr = character.translationEn
  if (!tr) return character
  const sheet = character.sheet
  return {
    ...character,
    name: tr.name || character.name,
    description: tr.description || character.description,
    sheet: {
      ...sheet,
      concept: tr.concept || sheet.concept,
      clan: tr.clan || sheet.clan,
      generation: tr.generation || sheet.generation,
      predatorType: tr.predatorType || sheet.predatorType,
      sire: tr.sire || sheet.sire,
      ambition: tr.ambition || sheet.ambition,
      desire: tr.desire || sheet.desire,
      touchstones: tr.touchstones || sheet.touchstones,
      merits: tr.merits || sheet.merits,
      flaws: tr.flaws || sheet.flaws,
      birthDateLabel: tr.birthDateLabel || sheet.birthDateLabel,
      disciplines: sheet.disciplines.map(discipline => ({
        ...discipline,
        name: tr.disciplines?.[discipline.id] || discipline.name,
      })),
      events: sheet.events.map(event => ({
        ...event,
        title: tr.events?.[event.id]?.title || event.title,
        description: tr.events?.[event.id]?.description || event.description,
      })),
      gallery: sheet.gallery.map(item => ({
        ...item,
        caption: tr.gallery?.[item.id] || item.caption,
      })),
    },
  }
}

export function localizeRelationship(relationship: MapRelationship, language: MapLanguage): MapRelationship {
  if (language === 'ru') return relationship
  const tr = relationship.translationEn
  if (!tr) return relationship
  return {
    ...relationship,
    label: tr.label || relationship.label,
    description: tr.description || relationship.description,
    events: relationship.events.map(event => {
      const override = tr.events?.[event.id]
      if (!override) return event
      return {
        ...event,
        title: override.title || event.title,
        label: event.label !== undefined ? (override.label || event.label) : event.label,
        description: event.description !== undefined ? (override.description || event.description) : event.description,
      }
    }),
  }
}

/** Small deterministic string hash (FNV-1a) — no `crypto.subtle` needed, and it
 * only ever has to match itself (computed the same way at translate time and
 * at staleness-check time), never anything external. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

export function computeCharacterSourceHash(character: MapCharacter): string {
  const sheet = character.sheet
  return fnv1a(JSON.stringify([
    character.name,
    character.description,
    sheet.concept,
    sheet.clan,
    sheet.generation,
    sheet.predatorType,
    sheet.sire,
    sheet.ambition,
    sheet.desire,
    sheet.touchstones,
    sheet.merits,
    sheet.flaws,
    sheet.birthDateLabel,
    sheet.disciplines.map(d => [d.id, d.name]),
    sheet.events.map(e => [e.id, e.title, e.description]),
    sheet.gallery.map(g => [g.id, g.caption]),
  ]))
}

export function computeRelationshipSourceHash(relationship: MapRelationship): string {
  return fnv1a(JSON.stringify([
    relationship.label,
    relationship.description,
    relationship.events.map(e => [e.id, e.title, e.label, e.description]),
  ]))
}

export function isCharacterTranslationStale(character: MapCharacter): boolean {
  return !character.translationEn || character.translationEn.sourceHash !== computeCharacterSourceHash(character)
}

export function isRelationshipTranslationStale(relationship: MapRelationship): boolean {
  return !relationship.translationEn || relationship.translationEn.sourceHash !== computeRelationshipSourceHash(relationship)
}

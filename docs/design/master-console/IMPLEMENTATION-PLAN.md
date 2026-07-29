# План внедрения по небольшим PR

Каждый пункт — отдельный reviewable PR. Следующий не начинается в предыдущем;
`/vampires/table` master/player smoke и type/build gates сохраняются на каждом шаге.

1. **Reference follow-up.** Приложить шесть MHTML, провести визуальный/DOM-аудит
   и закрыть пометки в `REFERENCE-MAP.md`. Только docs/assets.
2. **Auth decision + migration design.** Выбрать Supabase Auth migration,
   спроектировать chronicles/members, threat model, rollback и тестовую матрицу.
   Production flow пока не менять.
3. **Identity foundation.** Добавить Auth и server-verified session параллельно
   legacy compatibility, миграцию identities и tests; убрать browser-readable
   password dependency только после backfill.
4. **Chronicle membership + RLS.** Ввести chronicles/members, закрыть anon
   grants/policies, room-scoped helpers и security integration tests. Не добавлять
   master domain data до зелёных negative tests.
5. **Master data foundation.** Отдельные SQL migrations/constants/types/mappers/
   APIs для layouts/actions/notes и private/public projection pattern; обновить
   DECISIONS и persistence docs.
6. **Console contract + route shell.** Зарегистрировать `master-console` в Hub,
   добавить `/vampires/master`, contribution registry, permission boundary, desktop shell
   и loading/error/empty states без feature implementations.
7. **Layout engine.** CRUD/presets/windows/deep links/detach, persistence version
   и multi-window sync. Не хранить domain data в layout JSON.
8. **Shared room runtime extraction.** Извлечь только недостающие route-neutral
   hooks/services из table orchestrator. Добавить contract tests; не менять UI
   `/vampires/table`.
9. **Master rolls/right rail.** Переиспользовать rolls API/components, добавить
   безопасный hidden-roll contract, history, warnings/action log и явный publish.
10. **Overview module.** Session/night domain, coterie summary, scenes and
    consequences read models; macros пока registry stubs без опасных mutations.
11. **Scenes module.** Переиспользовать scene/layer/media/music UI/API; добавить
    private drafts/interactive objects и transactional publish/reveal.
12. **Actors module.** ChronicleActor + separate ActorPrivateFields, character
    links, preview and roll adapter. Не дублировать character sheet storage.
13. **Lore module.** Categories/entries/entity links, search/export providers,
    private revisions и explicit player publication; reuse reference renderer.
14. **Blood bonds module.** Bonds/events, actor links, warnings and timeline;
    private-only MVP, reveal отдельным последующим PR при необходимости.
15. **Session log module.** Structured feed + JournalEditor, automatic adapters,
    corrective entries and redacted export.
16. **Macro/command/undo layer.** Typed registry, shortcuts/conflict handling,
    confirmations, transactional action log and per-command compensation. Не
    обещать generic undo. *(command palette MVP + dangerous confirm: done in PROMPT 13)*
17. **Search/export hardening.** Provider aggregation filters permissions before
    indexing/rendering; exports default to redacted, secret export explicit.
    *(global search providers + deep links: done in PROMPT 13; export hardening later)*
18. **Desktop QA and rollout.** 1920×1080/1440×900/<1400, keyboard/a11y,
    reconnect/conflict, two-window tests, performance budgets and staged flag.

## Definition of done для feature PR

- module boundaries и imports соответствуют `ARCHITECTURE.md`;
- private data отсутствуют в player REST/realtime/storage tests;
- loading/empty/error/offline/permission states реализованы;
- изменения используют constants/types/mappers/API, не hardcoded schema;
- `npm run lint`, `npm run build`, релевантные tests и master/player `/vampires/table`
  smoke реально выполнены или честно отмечены как недоступные;
- schema/route/architecture docs обновлены по `docs/ai/UPDATE-RULES.md`.


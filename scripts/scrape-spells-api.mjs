#!/usr/bin/env node
/**
 * Сборщик описаний заклинаний через API pf2.ru.
 *
 * Использует /api/spells/{id} для получения русских описаний.
 * Сопоставляет slug'и (нормализуя дефисы/пробелы) с spells.json.
 *
 * Использование:
 *   node scripts/scrape-spells-api.mjs
 */

import { readFile, writeFile } from 'node:fs/promises';
import { request } from 'playwright';

const SPELLS_PATH = new URL('../src/games/pathfinder2/Rules/spells.json', import.meta.url);
const API_BASE = 'https://pf2.ru/api/spells/';
const MAX_ID = 2010;
const BATCH_SAVE = 100;

/** Normalize slug for matching: lowercase, remove non-alphanumeric */
function normalize(slug) {
  return slug.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Strip HTML tags and decode entities */
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  console.log('=== Сборщик описаний через API pf2.ru ===\n');

  const data = JSON.parse(await readFile(SPELLS_PATH, 'utf-8'));
  const allSpells = [...data.cantrips, ...data.spells];

  // Build lookup by normalized slug
  const bySlug = new Map();
  for (const s of allSpells) {
    const norm = normalize(s.id);
    // Also try without trailing/leading changes
    bySlug.set(norm, s);
    // Store English name normalized too (for matching "abyssal plague" vs "abyssal-plague")
    bySlug.set(normalize(s.nameEn), s);
  }

  const withoutDesc = allSpells.filter(s => !s.description).length;
  console.log(`Всего в JSON: ${allSpells.length}`);
  console.log(`Без описания: ${withoutDesc}`);
  console.log(`Загружаем API (ID 1–${MAX_ID})...\n`);

  const api = await request.newContext({
    baseURL: 'https://pf2.ru',
    extraHTTPHeaders: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    },
  });

  let fetched = 0;
  let matched = 0;
  let errors = 0;

  for (let id = 1; id <= MAX_ID; id++) {
    try {
      const resp = await api.get(`/api/spells/${id}`);
      if (resp.status() !== 200) continue;

      const raw = await resp.text();
      const spell = JSON.parse(JSON.parse(raw));
      fetched++;

      // Extract slug from URL
      const urlSlug = (spell.url || '').replace(/^\/spells?\//, '');
      const normSlug = normalize(urlSlug);

      // Find match in our data
      const match = bySlug.get(normSlug);
      if (match && !match.description) {
        // Extract description from text_output, stripping structured headers
        let desc = stripHtml(spell.text_output || '');

        // Remove structured fields we already have in JSON
        // (Source, Traditions, Cast, etc. — but keep the actual description)
        // Clean: remove header lines like "Источник ...", "Традиции ..."
        desc = desc
          .replace(/^Источник\s+.+?(?=\s+(?:Традиции|Сотворение|Дистанция|Длительность|Область|Цели|Испытание|Покровитель|Круг|Кровавая|Требования|Триггер|Усиление|Защита|Божество|Мистический))\s*/i, '')
          .replace(/^Традиции\s+.+?(?=\s+(?:Сотворение|Дистанция|Длительность|Область|Цели|Испытание|Покровитель|Круг|Кровавая|Требования|Триггер|Усиление|Защита|Божество|Мистический))\s*/i, '')
          .replace(/^Сотворение\s+.+?(?=\s+(?:Дистанция|Длительность|Область|Цели|Испытание|Требования|Триггер|Усиление))\s*/i, '')
          .replace(/^Дистанция\s+.+?(?=\s+(?:Длительность|Область|Цели|Испытание|Требования|Триггер|Усиление))\s*/i, '')
          .replace(/^Длительность\s+.+?(?=\s+(?:Область|Цели|Испытание|Требования|Триггер|Усиление))\s*/i, '')
          .replace(/^Область\s+.+?(?=\s+(?:Цели|Испытание|Требования|Триггер|Усиление))\s*/i, '')
          .replace(/^Цели?\s+.+?(?=\s+(?:Испытание|Требования|Триггер|Усиление|Спасбросок))\s*/i, '')
          .trim();

        if (desc.length > 20) {
          match.description = desc;
          matched++;
          if (matched % 25 === 0) {
            process.stdout.write(`  ${matched}✓ `);
          }
        }
      }

      if (fetched % BATCH_SAVE === 0) {
        await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');
        process.stdout.write(`\n  💾 ${fetched}/${MAX_ID} (${matched} сопоставлено)\n`);
      }
    } catch (err) {
      errors++;
      if (errors <= 5) {
        console.error(`  Ошибка ID ${id}: ${err.message.slice(0, 60)}`);
      }
    }
  }

  // Final save
  await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  const remaining = allSpells.filter(s => !s.description).length;
  console.log(`\n\n=== Готово! ===`);
  console.log(`Загружено из API: ${fetched}`);
  console.log(`Сопоставлено: ${matched}`);
  console.log(`Осталось без описания: ${remaining}`);
  console.log(`Ошибок: ${errors}`);
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});

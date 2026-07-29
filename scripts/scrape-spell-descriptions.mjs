#!/usr/bin/env node
/**
 * Сборщик описаний заклинаний с pf2.ru
 *
 * Использование:
 *   node scripts/scrape-spell-descriptions.mjs
 *
 * Заходит на pf2.ru/spells/<id> для каждого заклинания из spells.json,
 * извлекает русское описание и сохраняет обратно в JSON.
 *
 * Поддерживает докачку: пропускает заклинания, у которых уже есть description.
 * Задержка между запросами: ~1.5 сек (rate limiting).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const SPELLS_PATH = new URL('../src/games/pathfinder2/Rules/spells.json', import.meta.url);
const DELAY_MS = 1500; // задержка между запросами
const BATCH_SIZE = 50; // сохранять прогресс каждые N заклинаний

/**
 * Загружает страницу заклинания с pf2.ru
 * Использует стандартный fetch с User-Agent браузера.
 */
async function fetchSpellPage(spellId) {
  const url = `https://pf2.ru/spells/${spellId}`;
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  };

  const resp = await fetch(url, { headers, redirect: 'follow' });
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  return resp.text();
}

/**
 * Извлекает описание из HTML страницы pf2.ru.
 * Ищет блок с описанием заклинания.
 */
function extractDescription(html, spellId) {
  // Пытаемся найти JSON-LD или structured data
  const jsonLdMatch = html.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      if (data.description) return data.description;
    } catch {}
  }

  // Пробуем найти мета-описание
  const metaMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  if (metaMatch) return metaMatch[1];

  // Ищем основной контент страницы
  // Паттерны для pf2.ru (Next.js/React)
  const contentPatterns = [
    /<div[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/,
    /<main[^>]*>([\s\S]*?)<\/main>/,
    /"description"\s*:\s*"([^"]+)"/,
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match) {
      // Извлекаем текст, убирая HTML-теги
      const text = match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 20) return text;
    }
  }

  return null;
}

/**
 * Ждет указанное количество миллисекунд.
 */
function delay(ms) {
  return sleep(ms);
}

async function main() {
  console.log('=== Сборщик описаний заклинаний с pf2.ru ===\n');

  // Загружаем spells.json
  const data = JSON.parse(await readFile(SPELLS_PATH, 'utf-8'));

  // Собираем все заклинания в один список
  const allSpells = [...data.cantrips, ...data.spells];
  const total = allSpells.length;

  // Фильтруем те, у которых ещё нет описания
  const toScrape = allSpells.filter(s => !s.description);
  console.log(`Всего заклинаний: ${total}`);
  console.log(`Уже с описанием: ${total - toScrape.length}`);
  console.log(`Осталось собрать: ${toScrape.length}\n`);

  if (toScrape.length === 0) {
    console.log('Все описания уже собраны!');
    return;
  }

  let scraped = 0;
  let failed = 0;

  for (let i = 0; i < toScrape.length; i++) {
    const spell = toScrape[i];
    const progress = `[${i + 1}/${toScrape.length}]`;

    try {
      console.log(`${progress} Загружаем: ${spell.nameEn} (${spell.id})...`);
      const html = await fetchSpellPage(spell.id);

      // Проверяем, не попали ли на страницу проверки безопасности
      if (html.includes('Проверка безопасности') || html.includes('captcha') || html.includes('cf-')) {
        console.log(`  ⚠️  Сработала защита. Пропускаем (будет повторно при следующем запуске).`);
        failed++;
        // Увеличиваем задержку при обнаружении защиты
        await delay(DELAY_MS * 5);
        continue;
      }

      const description = extractDescription(html, spell.id);

      if (description) {
        spell.description = description;
        console.log(`  ✅ Описание получено (${description.length} симв.)`);
        scraped++;
      } else {
        console.log(`  ⚠️  Описание не найдено на странице.`);
        failed++;
      }
    } catch (err) {
      console.log(`  ❌ Ошибка: ${err.message}`);
      failed++;
    }

    // Сохраняем прогресс каждые BATCH_SIZE заклинаний
    if ((i + 1) % BATCH_SIZE === 0) {
      await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`  💾 Прогресс сохранён (${scraped} описаний, ${failed} ошибок)\n`);
    }

    // Задержка между запросами
    await delay(DELAY_MS);
  }

  // Финальное сохранение
  await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n=== Готово! ===`);
  console.log(`Собрано описаний: ${scraped}`);
  console.log(`Ошибок/пропусков: ${failed}`);
  console.log(`Файл сохранён: ${SPELLS_PATH}`);
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});

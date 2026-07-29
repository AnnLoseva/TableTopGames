#!/usr/bin/env node
/**
 * Сборщик описаний заклинаний с pf2.ru через Playwright (headless Chromium).
 *
 * Установка:
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Использование:
 *   node scripts/scrape-spells-pw.mjs
 *
 * Обходит JS-защиту pf2.ru с помощью настоящего браузера.
 * Извлекает русские описания и сохраняет в spells.json.
 * Поддерживает докачку — пропускает заклинания, у которых уже есть description.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const SPELLS_PATH = new URL('../src/games/pathfinder2/Rules/spells.json', import.meta.url);
const BASE_URL = 'https://pf2.ru/spells/';
const BATCH_SAVE = 25; // сохранять каждые N заклинаний
const DELAY_MS = 1000; // задержка между заклинаниями

/**
 * Извлекает описание из HTML-контента страницы заклинания.
 */
function extractDescription(text) {
  if (!text || text.length < 10) return null;

  // Убираем лишние пробелы
  text = text.replace(/\s+/g, ' ').trim();

  // Фильтруем явно не-описания
  const skipPatterns = [
    /^Проверка безопасности/i,
    /^Подождите/i,
    /^Название \/ Name/i,
    /^Дескрипторы/i,
    /^\d+$/,
  ];
  for (const p of skipPatterns) {
    if (p.test(text)) return null;
  }

  // Минимальная длина для осмысленного описания
  if (text.length < 30) return null;

  return text;
}

async function main() {
  console.log('=== Сборщик описаний заклинаний (Playwright) ===\n');

  // Загружаем spells.json
  const data = JSON.parse(await readFile(SPELLS_PATH, 'utf-8'));
  const allSpells = [...data.cantrips, ...data.spells];
  const total = allSpells.length;
  const toScrape = allSpells.filter(s => !s.description);

  console.log(`Всего заклинаний: ${total}`);
  console.log(`Уже с описанием: ${total - toScrape.length}`);
  console.log(`Осталось собрать: ${toScrape.length}\n`);

  if (toScrape.length === 0) {
    console.log('Все описания уже собраны!');
    return;
  }

  // Запускаем браузер
  console.log('Запускаем Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    locale: 'ru-RU',
  });

  const page = await context.newPage();

  let scraped = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < toScrape.length; i++) {
    const spell = toScrape[i];
    const url = BASE_URL + spell.id;
    const progress = `[${i + 1}/${toScrape.length}]`;

    try {
      process.stdout.write(`${progress} ${spell.name} → `);

      // Загружаем страницу
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });

      // Берём ПЕРВЫЙ div.item-output — это русская версия описания
      // (второй .item-output — английская)
      let contentText = '';
      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        // first() = русский вариант
        contentText = await page.locator('.item-output').first().textContent();
      } catch {
        // fallback: пробуем другие селекторы
        try {
          contentText = await page.locator('article').first().textContent();
        } catch {
          contentText = await page.$eval('body', el => el.textContent || '');
        }
      }

      const description = extractDescription(contentText);

      if (description) {
        spell.description = description;
        scraped++;
        console.log(`✅ (${description.length} симв.)`);
      } else {
        failed++;
        console.log(`⚠️ не найдено`);
        errors.push(spell.id);
      }
    } catch (err) {
      failed++;
      console.log(`❌ ${err.message.slice(0, 60)}`);
      errors.push(spell.id);
    }

    // Сохраняем прогресс
    if ((i + 1) % BATCH_SAVE === 0) {
      await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`  💾 Сохранено (${scraped}✓ / ${failed}✗)\n`);
    }

    await page.waitForTimeout(DELAY_MS);
  }

  // Закрываем браузер
  await browser.close();

  // Финальное сохранение
  await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n=== Готово! ===`);
  console.log(`Собрано: ${scraped}`);
  console.log(`Ошибок:  ${failed}`);
  if (errors.length > 0 && errors.length <= 20) {
    console.log(`Проблемные ID: ${errors.join(', ')}`);
  }
  console.log(`Файл:    ${SPELLS_PATH}`);
}

main().catch(err => {
  console.error('Критическая ошибка:', err);
  process.exit(1);
});

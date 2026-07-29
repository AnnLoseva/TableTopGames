#!/usr/bin/env node
/**
 * Докачка описаний для оставшихся 143 заклинаний.
 * Использует страницы pf2.ru (не API), URL с пробелами.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const SPELLS_PATH = new URL('../src/games/pathfinder2/Rules/spells.json', import.meta.url);
const BATCH = 25;

async function main() {
  const data = JSON.parse(await readFile(SPELLS_PATH, 'utf-8'));
  const allSpells = [...data.cantrips, ...data.spells];
  const missing = allSpells.filter(s => !s.description);

  console.log(`Осталось без описания: ${missing.length}\n`);
  if (missing.length === 0) { console.log('Всё готово!'); return; }

  // Build URL: use nameEn with spaces (matching pf2.ru format)
  // The pf2.ru URL uses the English name with spaces, lowercased
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ru-RU' });

  // Block analytics
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('yandex') || url.includes('analytics') || url.includes('mc.yandex')) {
      route.abort();
    } else { route.continue(); }
  });

  let scraped = 0;
  let failed = 0;

  for (let i = 0; i < missing.length; i++) {
    const spell = missing[i];
    // pf2.ru uses English name with spaces, lowercase
    const urlSlug = spell.nameEn.toLowerCase().trim();
    const url = 'https://pf2.ru/spells/' + encodeURIComponent(urlSlug);
    const progress = `[${i + 1}/${missing.length}]`;

    try {
      process.stdout.write(`${progress} ${spell.name} → `);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Wait for .item-output (Russian version = first)
      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        const desc = await page.locator('.item-output').first().textContent();

        if (desc && desc.length > 30 && !desc.startsWith('PATHFINDER 2E') && !desc.includes('Глава 1. Введение')) {
          spell.description = desc.replace(/\s+/g, ' ').trim();
          scraped++;
          console.log(`✅ (${spell.description.length} симв.)`);
        } else {
          failed++;
          console.log('⚠️ пусто/навигация');
        }
      } catch {
        failed++;
        console.log('⚠️ нет .item-output');
      }
    } catch (err) {
      failed++;
      console.log(`❌ ${err.message.slice(0, 50)}`);
    }

    if ((i + 1) % BATCH === 0) {
      await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`  💾 ${scraped}✓ / ${failed}✗\n`);
    }

    await page.waitForTimeout(300);
  }

  await browser.close();
  await writeFile(SPELLS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  const remaining = allSpells.filter(s => !s.description).length;
  console.log(`\n=== Готово ===`);
  console.log(`Собрано: ${scraped}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Осталось без описания: ${remaining}`);
}

main().catch(err => { console.error(err); process.exit(1); });

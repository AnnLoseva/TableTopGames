#!/usr/bin/env node
/** Scrape alchemical items from pf2.ru equipment pages */

import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TARGET = new URL('../src/games/pathfinder2/Rules/alchemical-items.json', import.meta.url);
const BATCH = 20;

const TABS = [
  { tab: 'alchemical-bombs', cat: 'Алхимические Бомбы' },
  { tab: 'alchemical-elixirs', cat: 'Алхимические Эликсиры' },
  { tab: 'alchemical-poisons', cat: 'Алхимические Яды' },
  { tab: 'alchemical-tools', cat: 'Алхимические Инструменты' },
  { tab: 'bottled-monstrosities', cat: 'Монстры в бутылке' },
  { tab: 'alchemical-food', cat: 'Алхимическая еда' },
];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log('=== Сборщик алхимических предметов ===\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 1600, height: 1000 } });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('yandex') || url.includes('analytics')) route.abort();
    else route.continue();
  });

  // Step 1: Collect all slugs from each tab
  const allItems = new Map(); // slug → { russianName, category }

  for (const { tab, cat } of TABS) {
    console.log(`Загружаем вкладку: ${cat}...`);
    await page.goto(`https://pf2.ru/alchemical-items?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const links = await page.$$eval('a[href*="/equipment/"]', els =>
      els.map(el => ({ href: el.href, text: el.textContent.trim() }))
    );

    let count = 0;
    for (const l of links) {
      const slug = decodeURIComponent(l.href.split('/equipment/')[1]);
      if (!slug || slug.length < 2) continue;
      // Skip English names (they're duplicates of Russian)
      if (/^[A-Z]/.test(l.text) && !/[А-Яа-яЁё]/.test(l.text)) continue;
      if (!allItems.has(slug)) {
        allItems.set(slug, { name: l.text, category: cat, slug });
        count++;
      }
    }
    console.log(`  → ${count} новых предметов`);
  }

  console.log(`\nВсего уникальных предметов: ${allItems.size}\n`);

  // Step 2: Scrape each item page
  const items = [...allItems.values()];
  const results = [];
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const url = 'https://pf2.ru/equipment/' + encodeURIComponent(item.slug);
    const progress = `[${i + 1}/${items.length}]`;

    try {
      process.stdout.write(`${progress} ${item.name} → `);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        const descRaw = await page.locator('.item-output').first().textContent();
        const desc = stripHtml(descRaw);

        if (desc && desc.length > 20 && !desc.startsWith('PATHFINDER 2E')) {
          // Extract level from text like "Предмет 5" or "Яд 3"
          const lvMatch = desc.match(/(?:Предмет|Яд|Бомба|Эликсир|Инструмент)\s+(\d+)/);
          const level = lvMatch ? parseInt(lvMatch[1]) : null;

          // Extract source
          const srcMatch = desc.match(/Источник\s+(.+?)(?=\s+(?:Цена|Сотворение|Активация|Дистанция|Область|Цели|Длительность|$))/);
          const sourceBook = srcMatch ? srcMatch[1].replace(/<[^>]+>/g, '').trim() : null;

          results.push({
            id: item.slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name: item.name,
            nameEn: item.slug.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            level,
            category: item.category,
            description: desc,
            sourceBook,
          });

          console.log(`✅ (${desc.length} симв.)`);
        } else {
          failed++;
          console.log('⚠️ плохой контент');
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
      console.log(`  💾 ${results.length}✓ / ${failed}✗\n`);
    }

    await page.waitForTimeout(300);
  }

  await browser.close();

  // Sort by level then name
  results.sort((a, b) => (a.level || 99) - (b.level || 99) || a.name.localeCompare(b.name));

  const output = {
    title: 'Алхимические предметы Pathfinder 2e (Remastered)',
    source: 'https://pf2.ru/alchemical-items',
    baseSource: 'Archives of Nethys, Player Core, Player Core 2',
    version: '2026-07',
    note: 'Все названия и описания на русском языке. Категории: бомбы, эликсиры, яды, инструменты, монстры в бутылке, алхимическая еда.',
    items: results,
  };

  await writeFile(TARGET, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n=== Готово! ===`);
  console.log(`Собрано: ${results.length}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Файл: ${TARGET}`);
}

main().catch(err => { console.error(err); process.exit(1); });

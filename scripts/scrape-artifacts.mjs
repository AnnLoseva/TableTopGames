#!/usr/bin/env node
/** Scrape artifacts from pf2.ru */

import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TARGET = new URL('../src/games/pathfinder2/Rules/artifacts.json', import.meta.url);

const SLUGS = [
  'ursine avenger hood', 'gelid shard', 'wandering pipe', 'immaculate instrument',
  'final scalecloak', 'forgotten signet', "freedom's flame", 'scale of igroon',
  'perfected robes', "ghosthand's comet", 'palette of colors', 'skyhammer',
  'throne of cardis', "trickster's mandolin", 'arcane reality', "eulactis's halo",
  'forsaken phylactery', 'gloom arc', 'halcyon heart', 'mirror of reflected pleasures',
  'ovinrbaane', 'briar', 'final blade', 'lich phylactery', 'orbs of dragonkind',
  'philosopher stone', 'sphere of annihilation', 'staff of the magi', 'deck of many things'
];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\s+/g, ' ').trim();
}

async function main() {
  console.log(`=== Сборщик артефактов (${SLUGS.length} шт.) ===\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ru-RU' });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('yandex') || url.includes('analytics')) route.abort();
    else route.continue();
  });

  const results = [];
  let failed = 0;

  for (let i = 0; i < SLUGS.length; i++) {
    const slug = SLUGS[i];
    const url = 'https://pf2.ru/equipment/' + encodeURIComponent(slug);
    const progress = `[${i + 1}/${SLUGS.length}]`;

    try {
      process.stdout.write(`${progress} ${slug} → `);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        const descRaw = await page.locator('.item-output').first().textContent();
        const desc = stripHtml(descRaw);

        if (desc && desc.length > 30 && !desc.startsWith('PATHFINDER 2E')) {
          const title = await page.title();
          const nameMatch = title.match(/^(.+?)\s*-\s*pf2/);
          const name = nameMatch ? nameMatch[1].trim() : slug;

          const lvMatch = desc.match(/Артефакт\s+(\d+)/);
          const level = lvMatch ? parseInt(lvMatch[1]) : null;

          const srcMatch = desc.match(/Источник\s+(.+?)(?=\s+(?:Цена|Активация|Дистанция|Область|Цели|Длительность|$))/);
          const sourceBook = srcMatch ? srcMatch[1].replace(/<[^>]+>/g, '').trim() : null;

          results.push({
            id: slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
            name,
            nameEn: slug.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            level,
            description: desc,
            sourceBook,
          });

          console.log(`✅ ${name} (${desc.length} симв.)`);
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

    await page.waitForTimeout(300);
  }

  await browser.close();

  results.sort((a, b) => (a.level || 99) - (b.level || 99) || a.name.localeCompare(b.name));

  const output = {
    title: 'Артефакты Pathfinder 2e (Remastered)',
    source: 'https://pf2.ru/artifacts',
    baseSource: 'Archives of Nethys, GM Core',
    version: '2026-07',
    note: 'Все названия и описания на русском языке.',
    artifacts: results,
  };

  await writeFile(TARGET, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\nСобрано: ${results.length} / Ошибок: ${failed}`);
  console.log(`Файл: ${TARGET}`);
}

main().catch(err => { console.error(err); process.exit(1); });

#!/usr/bin/env node
/** Scrape armor from pf2.ru - table + detail pages */

import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TARGET = new URL('../src/games/pathfinder2/Rules/armor.json', import.meta.url);

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\s+/g, ' ').trim();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ru-RU', viewport: { width: 1600, height: 1000 } });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('yandex') || url.includes('analytics')) route.abort();
    else route.continue();
  });

  // Step 1: Parse table
  console.log('Загружаем таблицу брони...');
  await page.goto('https://pf2.ru/armor?tab=armor', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);

  const rows = await page.$$('table tbody tr');
  console.log(`Строк в таблице: ${rows.length}`);

  const armor = [];
  for (const row of rows) {
    const text = (await row.textContent()).replace(/\s+/g, ' ').trim();
    if (!text || text.length < 10) continue;

    // Parse: Name / EnglishName [traits...] Item/Предмет N [stats...] Source
    const nameEnMatch = text.match(/\/\s*(.+?)(?:Удобная|Броня|Предмет|$)/);
    const nameMatch = text.match(/^(.+?)\s*\/\s*/);
    const name = nameMatch ? nameMatch[1].trim() : text.split('/')[0].trim();
    const nameEn = nameEnMatch ? nameEnMatch[1].trim() : '';

    const lvMatch = text.match(/Предмет\s+(\d+)/);
    const level = lvMatch ? parseInt(lvMatch[1]) : null;

    const srcMatch = text.match(/(Основная книга[^.]+|Хранилище сокровищ|Ярость стихий|Война Бессмертных|Путеводитель[^.]+|Руководство[^.]+|Зловещие[^.]+|Круговорот[^.]+|Prey for Death|Dark Archive|Secrets of Magic|Pathfinder[^.]*)$/);
    const sourceBook = srcMatch ? srcMatch[0].trim() : null;

    armor.push({ name, nameEn, level, sourceBook });
  }

  console.log(`Распарсено: ${armor.length}`);

  // Step 2: Get detail page slugs
  const links = await page.$$eval('a[href*="/equipment/"]', els =>
    els.map(el => ({ href: el.href, text: el.textContent.trim() }))
  );
  const slugs = new Map();
  for (const l of links) {
    const slug = decodeURIComponent(l.href.split('/equipment/')[1]);
    if (slug && slug.length > 2 && /[А-Яа-яЁё]/.test(l.text) && !slugs.has(slug)) {
      slugs.set(slug, l.text);
    }
  }
  console.log(`Детальных страниц: ${slugs.size}\n`);

  // Step 3: Fetch descriptions from detail pages
  const slugArr = [...slugs.keys()];
  let enriched = 0;
  let failed = 0;

  for (let i = 0; i < slugArr.length; i++) {
    const slug = slugArr[i];
    const url = 'https://pf2.ru/equipment/' + encodeURIComponent(slug);
    const progress = `[${i + 1}/${slugArr.length}]`;

    try {
      process.stdout.write(`${progress} ${slugs.get(slug)} → `);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        const descRaw = await page.locator('.item-output').first().textContent();
        const desc = stripHtml(descRaw);

        if (desc && desc.length > 30 && !desc.startsWith('PATHFINDER 2E')) {
          // Find matching armor item by name
          const rusName = slugs.get(slug);
          const match = armor.find(a => a.name === rusName);
          if (match) {
            match.description = desc;
            match.id = slug.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

            // Parse additional fields from description
            const catMatch = desc.match(/Тип брони\s+(.+?)(?=\s+(?:Цена|Источник|$))/);
            if (catMatch) match.category = catMatch[1].trim();

            const acMatch = desc.match(/Бонус КБ\s+\+?(\d+)/);
            if (acMatch) match.acBonus = parseInt(acMatch[1]);

            const dexMatch = desc.match(/Макс. Ловк\s+\+?(\d+)/);
            if (dexMatch) match.dexCap = parseInt(dexMatch[1]);

            enriched++;
          }
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

    if ((i + 1) % 20 === 0) {
      console.log(`  💾 ${enriched}✓ / ${failed}✗\n`);
    }
    await page.waitForTimeout(200);
  }

  await browser.close();

  // Add IDs for items without detail pages
  for (const a of armor) {
    if (!a.id) {
      a.id = (a.nameEn || a.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
  }

  armor.sort((a, b) => (a.level || 99) - (b.level || 99));

  const withDesc = armor.filter(a => a.description).length;
  const output = {
    title: 'Броня Pathfinder 2e (Remastered)',
    source: 'https://pf2.ru/armor',
    baseSource: 'Archives of Nethys, Player Core, GM Core, Treasure Vault',
    version: '2026-07',
    note: `Все названия на русском. ${withDesc}/${armor.length} с полными русскими описаниями.`,
    armor,
  };

  await writeFile(TARGET, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n=== Готово ===`);
  console.log(`Всего: ${armor.length}`);
  console.log(`С описанием: ${withDesc}`);
  console.log(`Ошибок: ${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });

#!/usr/bin/env node
/** Scrape all rituals from pf2.ru and save as rituals.json */

import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const TARGET = new URL('../src/games/pathfinder2/Rules/rituals.json', import.meta.url);
const BATCH = 20;

// All 76 ritual slugs from pf2.ru page
const RITUAL_SLUGS = [
  'angelic messenger', 'demonic pact', 'diabolic pact', 'power of the beasts',
  'inveigle', 'animate object', 'consecrate', 'bonding meal', 'heartbond',
  'create undead', 'geas', 'wild allegiance', 'band of heroes', 'butterfly bender',
  'reincarnate', 'rune trap', 'seed of mercy', 'phantasmal custodians', 'rest eternal',
  'atone', 'wild feast', 'plant growth', 'shadow double', 'blight',
  'astral projection', 'resurrect', 'call spirit', 'entreat thunderbird',
  'world in shadow', 'mind swap', 'planar servitor', 'fortifying brew',
  'feast of supplication', 'the unseeing blade master', 'kaiju ward', 'commune',
  'ward domain', 'primal call', 'awaken animal', 'binding circle', 'city of sin',
  'gathering call', 'collective memories', 'teleportation circle', 'unbearable cacophony',
  'planar displacement', 'imprisonment', 'embodied font', 'awaken curse', 'freedom',
  'create demiplane', 'control weather', 'void harvest', 'clone', 'curse of calamity',
  "ocean's roar", 'fantastic facade', 'wish', 'perfection of essence', 'daemonic pact',
  'abyssal pact', 'div pact', 'infernal pact', 'lucky month', 'unseen custodians',
  'awaken portal', 'rite of the blood crown', 'extract brain', 'amity cycle',
  'incarnate ancestry', "heroes' feast", 'bountiful oasis', 'elemental servitor',
  'commune with nature', 'sky signs', 'word of recall'
];

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/\s+/g, ' ').trim();
}

function parseRitual(descText) {
  // Extract level from text like "Ритуал 2"
  const levelMatch = descText.match(/Ритуал\s+(\d+)/);
  const level = levelMatch ? parseInt(levelMatch[1]) : null;

  // Extract traits: look for common trait patterns
  const traitsMatch = descText.match(/^((?:Необычный|Редкий|Уникальный)\s+)?(.+?)(?=Источник)/s);
  const traits = [];
  if (descText.includes('Необычный')) traits.push('Необычный');

  // Extract cast time
  const castMatch = descText.match(/Сотворение\s+(.+?)(?=\s+(?:Дистанция|Область|Цели|Длительность|Источник|$))/);
  const cast = castMatch ? castMatch[1].trim() : null;

  // Extract source
  const srcMatch = descText.match(/Источник\s+(.+?)(?=\s+(?:Сотворение|Традиции|Дистанция|Область|Цели|Длительность|$))/);
  const sourceBook = srcMatch ? srcMatch[1].replace(/<[^>]+>/g, '').trim() : null;

  return { level, traits, cast, sourceBook };
}

async function main() {
  console.log('=== Сборщик ритуалов pf2.ru ===\n');
  console.log(`Ритуалов для сбора: ${RITUAL_SLUGS.length}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'ru-RU' });

  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.includes('yandex') || url.includes('analytics')) route.abort();
    else route.continue();
  });

  const rituals = [];
  let failed = 0;

  for (let i = 0; i < RITUAL_SLUGS.length; i++) {
    const slug = RITUAL_SLUGS[i];
    const url = 'https://pf2.ru/rituals/' + encodeURIComponent(slug);
    const progress = `[${i + 1}/${RITUAL_SLUGS.length}]`;

    try {
      process.stdout.write(`${progress} ${slug} → `);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Get Russian name and description from .item-output
      try {
        await page.waitForSelector('.item-output', { timeout: 5000 });
        const descRaw = await page.locator('.item-output').first().textContent();
        const desc = stripHtml(descRaw);

        if (desc && desc.length > 30 && !desc.startsWith('PATHFINDER 2E')) {
          // Get name from page title
          const title = await page.title();
          const nameMatch = title.match(/^(.+?)\s*-\s*pf2/);
          const name = nameMatch ? nameMatch[1].trim() : slug;

          const { level, traits, cast, sourceBook } = parseRitual(desc);

          rituals.push({
            id: slug.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            name,
            nameEn: slug.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            level,
            cast,
            traits,
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

    if ((i + 1) % BATCH === 0) {
      console.log(`  💾 ${rituals.length}✓ / ${failed}✗\n`);
    }

    await page.waitForTimeout(300);
  }

  await browser.close();

  // Build final output
  const output = {
    title: 'Ритуалы Pathfinder 2e (Remastered) — Полный справочник',
    source: 'https://pf2.ru/rituals',
    baseSource: 'Archives of Nethys (2e.aonprd.com), Player Core, Secrets of Magic, Dark Archive',
    version: '2026-07',
    note: 'Все названия и описания на русском языке.',
    rituals,
  };

  await writeFile(TARGET, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n=== Готово! ===`);
  console.log(`Собрано: ${rituals.length}`);
  console.log(`Ошибок: ${failed}`);
  console.log(`Файл: ${TARGET}`);
}

main().catch(err => { console.error(err); process.exit(1); });

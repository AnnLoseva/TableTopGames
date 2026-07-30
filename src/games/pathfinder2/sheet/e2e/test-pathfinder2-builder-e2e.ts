import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import process from 'node:process'
import { chromium, type Browser } from 'playwright'

const STORAGE_KEY = 'pathfinder2-character-draft-v4'
const LEGACY_STORAGE_KEY = 'pathfinder2-character-draft-v3'
const PORT = Number(process.env.PATHFINDER2_E2E_PORT ?? 43127)
const suppliedBaseUrl = process.env.PATHFINDER2_E2E_BASE_URL
const baseUrl = suppliedBaseUrl ?? `http://127.0.0.1:${PORT}`
const routeUrl = new URL('/pathfinder2/sheet', baseUrl).toString()
const projectRoot = process.cwd()

let server: ChildProcess | null = null
let serverOutput = ''

function rememberServerOutput(chunk: Buffer | string) {
  serverOutput = `${serverOutput}${chunk.toString()}`.slice(-12_000)
}

async function waitForServer(url: string) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`Next.js dev server stopped early.\n${serverOutput}`)
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The local dev server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`Next.js dev server did not become ready.\n${serverOutput}`)
}

async function launchLocalBrowser(): Promise<Browser> {
  const executablePath = process.env.PATHFINDER2_E2E_CHROME_EXECUTABLE
  if (executablePath) {
    return chromium.launch({ executablePath, headless: true })
  }

  try {
    return await chromium.launch({ channel: 'chrome', headless: true })
  } catch (channelError) {
    try {
      return await chromium.launch({ headless: true })
    } catch (bundledError) {
      throw new Error(
        [
          'Playwright could not launch Chrome or its bundled Chromium.',
          'Set PATHFINDER2_E2E_CHROME_EXECUTABLE to a local browser executable.',
          `Chrome channel: ${String(channelError)}`,
          `Bundled Chromium: ${String(bundledError)}`,
        ].join('\n'),
      )
    }
  }
}

async function run() {
  if (!suppliedBaseUrl) {
    server = spawn(
      process.execPath,
      [
        'node_modules/next/dist/bin/next',
        'dev',
        '--hostname',
        '127.0.0.1',
        '--port',
        String(PORT),
      ],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    server.stdout?.on('data', rememberServerOutput)
    server.stderr?.on('data', rememberServerOutput)
    await waitForServer(routeUrl)
  }

  const browser = await launchLocalBrowser()
  const context = await browser.newContext({
    viewport: { width: 1024, height: 768 },
  })
  const page = await context.newPage()
  const browserErrors: string[] = []

  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', error => browserErrors.push(error.message))

  try {
    const response = await page.goto(routeUrl, { waitUntil: 'networkidle' })
    assert.equal(response?.status(), 200, 'The Pathfinder route should return HTTP 200.')
    await page.getByRole('button', { name: 'Создание персонажа' }).waitFor()
    console.log('✓ route renders and hydrates')

    await page.getByRole('button', { name: 'Создание персонажа' }).click()
    const stepNavigation = page.getByRole('navigation', {
      name: 'Шаги создания персонажа',
    })
    assert.equal(
      await stepNavigation.getByRole('button').count(),
      11,
      'The builder should expose all eleven creation steps.',
    )
    console.log('✓ builder exposes eleven steps')

    const nameInput = page.getByLabel('Имя персонажа')
    await nameInput.fill('E2E Pathfinder Hero')
    await page.getByLabel('Концепция').fill('Проверка локального сохранения.')
    await page.getByRole('button', { name: 'Высокий уровень' }).click()
    await page.getByLabel('Целевой уровень').selectOption('5')
    await page.waitForFunction(
      ({ key }) => {
        const value = window.localStorage.getItem(key)
        if (!value) return false
        const parsed = JSON.parse(value)
        return parsed.identity?.name === 'E2E Pathfinder Hero'
          && parsed.progression?.targetLevel === 5
      },
      { key: STORAGE_KEY },
    )
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Создание персонажа' }).click()
    assert.equal(await page.getByLabel('Имя персонажа').inputValue(), 'E2E Pathfinder Hero')
    assert.equal(await page.getByLabel('Целевой уровень').inputValue(), '5')
    console.log('✓ schema-v4 draft survives reload')

    await stepNavigation.getByRole('button', { name: /Народ/ }).click()
    const galleryTrigger = page.getByRole('button', {
      name: 'Открыть галерею народов',
    })
    await galleryTrigger.click()
    const dialog = page.getByRole('dialog', { name: 'Выбор народа' })
    await dialog.waitFor({ state: 'visible' })
    assert.equal(
      await dialog.locator('img[alt^="Карточка народа"]').count(),
      50,
      'Every ancestry should render its local artwork.',
    )
    await dialog.getByLabel('Характеристика').selectOption('intelligence')
    assert.equal(await dialog.locator('[data-choice-id="elf"]').count(), 1)
    assert.equal(await dialog.locator('[data-choice-id="gnome"]').count(), 0)
    await dialog.getByLabel('Характеристика').selectOption('')
    assert.equal(
      await dialog
        .locator('img[alt="Карточка народа «Кентавр»"]')
        .getAttribute('src'),
      '/pathfinder2/ancestries/centaur.png?v=e281bc58',
      'The updated centaur artwork should use a cache-busting URL.',
    )
    const closeButton = page.getByRole('button', { name: 'Закрыть каталог' })
    await closeButton.waitFor({ state: 'visible' })
    assert.equal(
      await closeButton.evaluate(element => element === document.activeElement),
      true,
      'The modal should move focus to its close control.',
    )
    assert.equal(
      await page.evaluate(() => document.body.style.overflow),
      'hidden',
      'The modal should lock background scrolling.',
    )
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'hidden' })
    assert.equal(
      await galleryTrigger.evaluate(element => element === document.activeElement),
      true,
      'Closing the modal should restore focus to its trigger.',
    )
    console.log('✓ choice dialog focus, Escape and scroll lock work')

    await stepNavigation.getByRole('button', { name: /Класс/ }).click()
    await page.getByRole('button', { name: 'Открыть галерею классов' }).click()
    const classDialog = page.getByRole('dialog', { name: 'Выбор класса' })
    assert.equal(
      await classDialog.locator('img[alt^="Карточка класса"]').count(),
      21,
      'Every class with local artwork should render it.',
    )
    for (const classIdWithoutArtwork of [
      'commander',
      'guardian',
      'magus',
      'psychic',
      'summoner',
      'thaumaturge',
    ]) {
      const card = classDialog.locator(`[data-choice-id="${classIdWithoutArtwork}"]`)
      assert.equal(
        await card.count(),
        1,
        `${classIdWithoutArtwork} has real class data and should still appear (as a text-only card).`,
      )
      assert.equal(
        await card.locator('img').count(),
        0,
        `${classIdWithoutArtwork} has no local artwork yet and must fall back to a text-only card.`,
      )
    }
    for (const [classId, expectedSource] of Object.entries({
      champion: '/pathfinder2/classes/champion.png?v=463e9a39',
      exemplar: '/pathfinder2/classes/exemplar.png?v=497f77a1',
      fighter: '/pathfinder2/classes/fighter.png?v=dceb8215',
      oracle: '/pathfinder2/classes/oracle.png?v=3e1f4277',
    })) {
      assert.equal(
        await classDialog
          .locator(`[data-choice-id="${classId}"] img`)
          .getAttribute('src'),
        expectedSource,
        `${classId} should use the updated cache-busting artwork URL.`,
      )
    }
    await classDialog.getByLabel('Характеристика').selectOption('intelligence')
    assert.equal(await classDialog.locator('[data-choice-id="wizard"]').count(), 1)
    assert.equal(await classDialog.locator('[data-choice-id="bard"]').count(), 0)
    await classDialog.getByLabel('Характеристика').selectOption('')
    await page.keyboard.press('Escape')
    await classDialog.waitFor({ state: 'hidden' })
    console.log('✓ all supplied ancestry and class artworks are connected')

    await stepNavigation.getByRole('button', { name: /Предыстория/ }).click()
    await page.getByRole('button', { name: 'Открыть галерею предысторий' }).click()
    const backgroundDialog = page.getByRole('dialog', { name: 'Выбор предыстории' })
    await backgroundDialog.getByLabel('Характеристика').selectOption('intelligence')
    assert.equal(await backgroundDialog.locator('[data-choice-id="scholar"]').count(), 1)
    assert.equal(await backgroundDialog.locator('[data-choice-id="sailor"]').count(), 0)
    await backgroundDialog.getByRole('searchbox').fill('Учёный')
    await backgroundDialog.locator('[data-choice-id="scholar"]').click()
    await backgroundDialog.getByRole('button', { name: 'Подтвердить выбор' }).click()
    await stepNavigation.getByRole('button', { name: /Итоговые характеристики/ }).click()
    const limitedBoostLabel = page.getByText(
      'Ограниченное повышение: Интеллект или Мудрость',
      { exact: true },
    )
    await limitedBoostLabel.waitFor()
    const limitedBoostChoices = limitedBoostLabel.locator('+ div')
    assert.equal(
      await limitedBoostChoices.getByRole('button', {
        name: 'ИНТ Интеллект',
        exact: true,
      }).isEnabled(),
      true,
    )
    assert.equal(
      await limitedBoostChoices.getByRole('button', {
        name: 'МДР Мудрость',
        exact: true,
      }).isEnabled(),
      true,
    )
    assert.equal(
      await limitedBoostChoices.getByRole('button', { name: /СИЛ Сила/ }).isDisabled(),
      true,
    )
    console.log('✓ ability filter works for ancestries, backgrounds and classes')
    console.log('✓ Scholar background exposes its two limited ability boosts')

    await stepNavigation.getByRole('button', { name: /Снаряжение/ }).click()
    await page.getByRole('searchbox', {
      name: /Поиск по названию, ID, источнику или черте/,
    }).fill('Беруши')
    const earplugsCard = page.locator('article').filter({ hasText: 'Беруши' }).first()
    await earplugsCard.getByRole('button', { name: 'Купить' }).click()
    await page.getByText('Беруши: добавлено в инвентарь.').waitFor()
    await page.waitForFunction(key => {
      const value = window.localStorage.getItem(key)
      if (!value) return false
      return JSON.parse(value).inventory?.entries?.length === 1
    }, STORAGE_KEY)
    await page.getByRole('button', { name: 'Вернуть', exact: true }).click()
    await page.getByText('Покупка отменена, стоимость возвращена.').waitFor()
    await page.waitForFunction(key => {
      const value = window.localStorage.getItem(key)
      if (!value) return false
      return JSON.parse(value).inventory?.entries?.length === 0
    }, STORAGE_KEY)
    console.log('✓ catalog shop purchases and refunds by stable item ID')

    await stepNavigation.getByRole('button', { name: /Проверка/ }).click()
    const catalogAudit = page.getByRole('region', {
      name: 'Готовность справочников',
    })
    const auditText = await catalogAudit.innerText()
    assert.match(auditText, /Черты народов · подключено/)
    assert.match(auditText, /Прогрессия классов 1–20 · подключено/)
    assert.match(auditText, /Снаряжение · подключено/)
    assert.match(auditText, /Заклинания · подключено/)
    assert.equal(
      await page.getByRole('button', { name: 'Завершить создание' }).isDisabled(),
      true,
      'An incomplete character must not pass the completion gate.',
    )
    console.log('✓ connected rule catalogs are visible while character decisions still gate completion')

    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }))
    assert.ok(
      layout.scrollWidth <= layout.viewport,
      `The iPad viewport must not scroll horizontally (${layout.scrollWidth} > ${layout.viewport}).`,
    )
    console.log('✓ 1024×768 layout has no horizontal overflow')

    await page.evaluate(({ currentKey, legacyKey }) => {
      window.localStorage.removeItem(currentKey)
      window.localStorage.setItem(legacyKey, JSON.stringify({
        schemaVersion: 3,
        name: 'Мигрированный E2E герой',
        player: 'E2E',
        concept: 'Legacy draft',
        notes: 'Строка из schema v3',
      }))
    }, { currentKey: STORAGE_KEY, legacyKey: LEGACY_STORAGE_KEY })
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Создание персонажа' }).click()
    assert.equal(
      await page.getByLabel('Имя персонажа').inputValue(),
      'Мигрированный E2E герой',
    )
    const migratedSchema = await page.evaluate(key => {
      const value = window.localStorage.getItem(key)
      return value ? JSON.parse(value).schemaVersion : null
    }, STORAGE_KEY)
    assert.equal(migratedSchema, 4, 'A schema-v3 draft should be persisted as schema v4.')
    console.log('✓ schema-v3 draft migrates without losing identity text')

    assert.deepEqual(
      browserErrors,
      [],
      `The browser console should stay clean:\n${browserErrors.join('\n')}`,
    )
    console.log('✓ browser console has no errors')
    console.log('Pathfinder 2 builder E2E: 11 checks passed.')
  } finally {
    await context.close()
    await browser.close()
  }
}

run()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    server?.kill('SIGTERM')
  })

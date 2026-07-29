import { promises as fs } from 'node:fs'
import path from 'node:path'

type Category = 'source' | 'style' | 'data' | 'asset' | 'legacy' | 'empty'

type FileInfo = {
  path: string
  absolutePath: string
  lines: number
  sizeKb: number
  category: Category
  extension: string
  isText: boolean
  content?: string
}

const root = process.cwd()
const ignoredDirs = new Set(['node_modules', '.next', '.git', '.claude', '.codex-tools', '.vercel', 'coverage', 'dist', 'out'])
const ignoredExactPaths = new Set([
  'public/vampires/rules.json',
  'public/vampires/rules_eng.json',
  'public/vampires/reference/VtM_v5_new.md',
  'public/vampires/reference/VtM_v5_new_eng.md',
  'public/vampires/reference/vtm-v5',
])
const textExtensions = new Set([
  '.css',
  '.csv',
  '.html',
  '.js',
  '.jsx',
  '.json',
  '.md',
  '.mjs',
  '.sql',
  '.svg',
  '.ts',
  '.tsx',
  '.txt',
])
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx'])
const styleExtensions = new Set(['.css', '.scss'])
const dataExtensions = new Set(['.csv', '.json', '.md', '.sql', '.txt'])
const publicCodeExtensions = new Set(['.css', '.html', '.js', '.jsx', '.mjs', '.ts', '.tsx'])
const rootEntrypoints = new Set([
  'next.config.mjs',
  'next-env.d.ts',
])

function toProjectPath(absolutePath: string) {
  return path.relative(root, absolutePath).split(path.sep).join('/')
}

function isIgnored(projectPath: string) {
  if (ignoredExactPaths.has(projectPath)) return true
  if (/^public\/vampires\/reference\/.*\.(md|pdf)$/i.test(projectPath)) return true
  return false
}

function isLikelyText(buffer: Buffer, extension: string) {
  if (textExtensions.has(extension)) return true
  return !buffer.subarray(0, 512).includes(0)
}

function countLines(content: string) {
  if (!content) return 0
  return content.split(/\r\n|\r|\n/).length
}

function onlyEmptyTodoModule(content: string) {
  const withoutComments = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .trim()

  return /TODO/i.test(content) && (withoutComments === '' || withoutComments === 'export {}')
}

function categoryFor(projectPath: string, extension: string, content: string | undefined): Category {
  if (content !== undefined && (content.trim() === '' || onlyEmptyTodoModule(content))) return 'empty'
  if (/^public\/vampires\/(main|supabase|vtm-health|vtm-humanity|creation-wizard|i18n-runtime|i18n-dictionary)\.js$/.test(projectPath)) {
    return 'legacy'
  }
  if (projectPath === 'public/vampires/old-sheet.html' || projectPath.startsWith('public/legacy-sheet/')) return 'legacy'
  if (styleExtensions.has(extension) || /Styles\.tsx$/.test(projectPath)) return 'style'
  if (sourceExtensions.has(extension)) return 'source'
  if (dataExtensions.has(extension)) return 'data'
  return 'asset'
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue

    const absolutePath = path.join(directory, entry.name)
    const projectPath = toProjectPath(absolutePath)

    if (isIgnored(projectPath)) continue

    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath))
    } else if (entry.isFile()) {
      files.push(absolutePath)
    }
  }

  return files
}

async function inspectFile(absolutePath: string): Promise<FileInfo> {
  const buffer = await fs.readFile(absolutePath)
  const projectPath = toProjectPath(absolutePath)
  const extension = path.extname(absolutePath).toLowerCase()
  const isText = isLikelyText(buffer, extension)
  const content = isText ? buffer.toString('utf8') : undefined

  return {
    path: projectPath,
    absolutePath,
    lines: content === undefined ? 0 : countLines(content),
    sizeKb: Math.round((buffer.byteLength / 1024) * 10) / 10,
    category: categoryFor(projectPath, extension, content),
    extension,
    isText,
    content,
  }
}

function formatTable(files: FileInfo[]) {
  if (files.length === 0) return 'No files found.'

  const rows = files.map(file => [
    file.path,
    String(file.lines),
    file.sizeKb.toFixed(1),
    file.category,
  ])

  return [
    '| path | lines | size KB | category |',
    '| --- | ---: | ---: | --- |',
    ...rows.map(row => `| ${row[0]} | ${row[1]} | ${row[2]} | ${row[3]} |`),
  ].join('\n')
}

function formatList(files: FileInfo[]) {
  if (files.length === 0) return '- None'
  return files.map(file => `- ${file.path} (${file.lines} lines, ${file.sizeKb.toFixed(1)} KB, ${file.category})`).join('\n')
}

function importSpecifiers(content: string) {
  const specifiers = new Set<string>()
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[^'"]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[^'"]+?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(content)) !== null) {
      specifiers.add(match[1])
    }
  }

  return [...specifiers]
}

function resolveImport(fromFile: FileInfo, specifier: string, allPaths: Set<string>) {
  if (!specifier.startsWith('.') && !specifier.startsWith('@/')) return undefined

  const base = specifier.startsWith('@/')
    ? path.join(root, specifier.slice(2))
    : path.resolve(path.dirname(fromFile.absolutePath), specifier)

  const candidates = [
    base,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css'].map(extension => `${base}${extension}`),
    ...['index.ts', 'index.tsx', 'index.js', 'index.jsx', 'index.css'].map(file => path.join(base, file)),
  ].map(candidate => toProjectPath(candidate))

  return candidates.find(candidate => allPaths.has(candidate))
}

function findPotentiallyUnusedFiles(files: FileInfo[]) {
  const allPaths = new Set(files.map(file => file.path))
  const importedPaths = new Set<string>()

  for (const file of files) {
    if (!file.content) continue
    for (const specifier of importSpecifiers(file.content)) {
      const resolved = resolveImport(file, specifier, allPaths)
      if (resolved) importedPaths.add(resolved)
    }
  }

  return files
    .filter(file => file.category === 'source' || file.category === 'style')
    .filter(file => !file.path.startsWith('app/'))
    .filter(file => !file.path.startsWith('scripts/'))
    .filter(file => !file.path.startsWith('games/vampires/scripts/'))
    .filter(file => !file.path.startsWith('public/'))
    .filter(file => !rootEntrypoints.has(file.path))
    .filter(file => !file.path.endsWith('.d.ts'))
    .filter(file => !importedPaths.has(file.path))
    .sort((first, second) => first.path.localeCompare(second.path))
}

async function main() {
  const absolutePaths = await collectFiles(root)
  const files = (await Promise.all(absolutePaths.map(inspectFile)))
    .sort((first, second) => second.sizeKb - first.sizeKb)

  const largestFiles = files.slice(0, 25)
  const filesOver500 = files.filter(file => file.lines > 500)
  const filesOver1000 = files.filter(file => file.lines > 1000)
  const emptyTodoFiles = files.filter(file => file.content !== undefined && onlyEmptyTodoModule(file.content))
  const publicCodeFiles = files
    .filter(file => file.path.startsWith('public/') && publicCodeExtensions.has(file.extension))
    .sort((first, second) => second.sizeKb - first.sizeKb)
  const potentiallyUnused = findPotentiallyUnusedFiles(files)

  console.log('# Project structure audit')
  console.log('')
  console.log(`Scanned files: ${files.length}`)
  console.log(`Ignored: ${[...ignoredExactPaths].join(', ')}, public/vampires/reference/*.md, ${[...ignoredDirs].join(', ')}`)
  console.log('')
  console.log('## Largest files')
  console.log(formatTable(largestFiles))
  console.log('')
  console.log('## Files over 500 lines')
  console.log(formatList(filesOver500))
  console.log('')
  console.log('## Files over 1000 lines')
  console.log(formatList(filesOver1000))
  console.log('')
  console.log('## Empty TODO files')
  console.log(formatList(emptyTodoFiles))
  console.log('')
  console.log('## Code files in public')
  console.log(formatList(publicCodeFiles))
  console.log('')
  console.log('## Potentially unused files')
  console.log('Heuristic: source/style files outside app, game scripts, and public with no local import found.')
  console.log(formatList(potentiallyUnused))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})

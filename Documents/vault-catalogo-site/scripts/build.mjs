import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const srcDir = path.join(projectRoot, 'src');
const distDir = path.join(projectRoot, 'dist');

const vaultRoot = process.env.VAULT_PATH || '/home/faux/Documents/vault-faux';

const CATEGORY_CONFIG = [
  { key: 'filmes', label: 'Filmes', dir: 'Filmes', exclude: ['galeria', 'template'] },
  { key: 'series', label: 'Series', dir: '📺 Series', exclude: ['galeria', 'template'] },
  { key: 'livros', label: 'Livros', dir: '📚 Livros', exclude: ['galeria', 'template'] },
  { key: 'games', label: 'Games', dir: '🎮 Games', exclude: ['galeria', 'template'] },
  { key: 'musicas', label: 'Musicas', dir: 'Musicas/Albums', exclude: ['galeria', 'template', 'readme'] },
  { key: 'outros', label: 'Outros', dir: 'Catalogo/Outros', exclude: ['galeria', 'template', 'readme'] }
];

const CREATOR_KEYS = ['diretor', 'criador', 'autor', 'artista', 'desenvolvedora', 'publicadora'];
const DATE_KEYS = ['data_assistido', 'data_lido', 'data_jogado', 'data_ouvido', 'data_registro'];

await build();

async function build() {
  await assertVaultExists(vaultRoot);
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(path.join(distDir, 'assets'), { recursive: true });

  const items = [];

  for (const category of CATEGORY_CONFIG) {
    const categoryDir = path.join(vaultRoot, category.dir);
    const files = await listMarkdownFiles(categoryDir);

    for (const filePath of files) {
      const baseName = path.basename(filePath, '.md');
      if (shouldSkip(baseName, category.exclude)) {
        continue;
      }

      const raw = await fs.readFile(filePath, 'utf8');
      const { frontmatter, body } = parseDocument(raw);
      const title = getTitle(frontmatter, body, baseName);
      const rating = toNumber(frontmatter.nota);
      const genres = toArray(frontmatter.genero);
      const tags = toArray(frontmatter.tags);
      const year = getYear(frontmatter);
      const creator = getCreator(frontmatter);
      const date = getDate(frontmatter);
      const notes = extractNotes(body);

      const imageRaw = frontmatter.poster ?? frontmatter.capa ?? null;
      const imagePath = await copyImageIfExists({
        imageRaw,
        notePath: filePath,
        categoryKey: category.key,
        title,
      });

      items.push({
        id: slug(`${category.key}-${baseName}`),
        category: category.key,
        categoryLabel: category.label,
        title,
        creator,
        year,
        genres,
        rating,
        status: normalizeString(frontmatter.status),
        date,
        notes,
        tags,
        image: imagePath,
        links: {
          imdb: normalizeString(frontmatter.imdb),
          spotify: normalizeString(frontmatter.spotify),
          isbn: normalizeString(frontmatter.isbn),
          metacritic: normalizeString(frontmatter.metacritic),
        },
        sourcePath: toPosix(path.relative(vaultRoot, filePath)),
      });
    }
  }

  const categoriesSummary = CATEGORY_CONFIG.map((category) => {
    const count = items.filter((item) => item.category === category.key).length;
    return {
      key: category.key,
      label: category.label,
      count,
    };
  });

  const data = {
    generatedAt: new Date().toISOString(),
    vaultRoot,
    meta: {
      totalItems: items.length,
      categories: categoriesSummary,
    },
    items,
  };

  await copyStaticFiles();
  await fs.writeFile(
    path.join(distDir, 'data.js'),
    `window.__CATALOGO_DATA__ = ${JSON.stringify(data, null, 2)};\n`,
    'utf8'
  );

  console.log(`Build concluido com ${items.length} item(ns).`);
  console.log(`Saida: ${distDir}`);
}

async function assertVaultExists(dir) {
  try {
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) {
      throw new Error('VAULT_PATH nao e diretorio');
    }
  } catch (error) {
    throw new Error(`Vault nao encontrado em: ${dir}`);
  }
}

async function copyStaticFiles() {
  const files = ['index.html', 'styles.css', 'app.js'];
  await Promise.all(
    files.map(async (file) => {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(distDir, file);
      await fs.copyFile(srcPath, destPath);
    })
  );
}

async function copyImageIfExists({ imageRaw, notePath, categoryKey, title }) {
  if (!imageRaw || typeof imageRaw !== 'string') {
    return null;
  }

  const imageSource = path.resolve(path.dirname(notePath), imageRaw);

  try {
    const stat = await fs.stat(imageSource);
    if (!stat.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  const ext = path.extname(imageSource) || '.jpg';
  const safeFileName = `${slug(`${categoryKey}-${title}`)}${ext.toLowerCase()}`;
  const destination = path.join(distDir, 'assets', safeFileName);
  await fs.copyFile(imageSource, destination);
  return `assets/${safeFileName}`;
}

async function listMarkdownFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map((entry) => path.join(dir, entry.name));
}

function parseDocument(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { frontmatter: {}, body: raw };
  }

  const frontmatterText = match[1];
  const body = raw.slice(match[0].length);
  return {
    frontmatter: parseFrontmatter(frontmatterText),
    body,
  };
}

function parseFrontmatter(text) {
  const frontmatter = {};
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }

    const separator = line.indexOf(':');
    if (separator < 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    frontmatter[key] = parseValue(rawValue);
  }

  return frontmatter;
}

function parseValue(rawValue) {
  if (!rawValue) {
    return null;
  }

  if (isQuoted(rawValue)) {
    return rawValue.slice(1, -1);
  }

  if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
    return splitArray(rawValue.slice(1, -1)).map((value) => {
      if (isQuoted(value)) {
        return value.slice(1, -1).trim();
      }
      return value.trim();
    }).filter(Boolean);
  }

  if (/^\d+(\.\d+)?$/.test(rawValue)) {
    return Number(rawValue);
  }

  if (rawValue === 'true') {
    return true;
  }

  if (rawValue === 'false') {
    return false;
  }

  return rawValue;
}

function splitArray(text) {
  const values = [];
  let current = '';
  let quote = null;

  for (const char of text) {
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      current += char;
      continue;
    }

    if (char === quote) {
      quote = null;
      current += char;
      continue;
    }

    if (char === ',' && !quote) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

function getTitle(frontmatter, body, fallback) {
  if (typeof frontmatter.album === 'string' && frontmatter.album.trim()) {
    return frontmatter.album.trim();
  }

  const heading = body.match(/^#\s+(.+)$/m);
  if (heading) {
    return heading[1].trim();
  }

  return fallback;
}

function getCreator(frontmatter) {
  for (const key of CREATOR_KEYS) {
    const value = normalizeString(frontmatter[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function getYear(frontmatter) {
  const year = toNumber(frontmatter.ano);
  if (year) {
    return year;
  }

  const start = toNumber(frontmatter.ano_inicio);
  const end = toNumber(frontmatter.ano_fim);

  if (start && end) {
    return `${start}-${end}`;
  }

  if (start) {
    return String(start);
  }

  return null;
}

function getDate(frontmatter) {
  for (const key of DATE_KEYS) {
    const value = normalizeString(frontmatter[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function extractNotes(body) {
  const block = body.match(/##\s+.*Minhas Notas[\s\S]*?(?=\n##\s+|\n---\n|$)/i);
  const source = block ? block[0] : body;

  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && !line.startsWith('![') && !line.startsWith('**Status:**'));

  if (!lines.length) {
    return null;
  }

  const text = lines
    .join(' ')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return null;
  }

  return text.slice(0, 280);
}

function shouldSkip(baseName, excludeTerms) {
  const name = baseName.toLowerCase();
  return excludeTerms.some((term) => name.includes(term));
}

function toArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  const normalized = normalizeString(value);
  return normalized ? [normalized] : [];
}

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string' && value.trim()) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  return null;
}

function normalizeString(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function slug(value) {
  return value
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function isQuoted(value) {
  return (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  );
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

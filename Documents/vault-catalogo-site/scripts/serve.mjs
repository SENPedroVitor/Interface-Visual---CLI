import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const buildScriptPath = path.join(__dirname, 'build.mjs');

const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
const vaultRoot = process.env.VAULT_PATH || '/home/faux/Documents/vault-faux';
const omdbApiKey = process.env.OMDB_API_KEY || process.env.IMDB_API_KEY || '';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

const CATEGORY_SETTINGS = {
  filmes: {
    label: 'Filmes',
    noteDir: 'Filmes',
    coverDir: 'Filmes/Capas',
    coverRelativePrefix: 'Capas/',
    defaultStatus: 'para assistir',
    defaultTags: ['filme', 'cinema']
  },
  series: {
    label: 'Series',
    noteDir: '📺 Series',
    coverDir: '📺 Series/Capas',
    coverRelativePrefix: 'Capas/',
    defaultStatus: 'para assistir',
    defaultTags: ['serie', 'tv']
  },
  livros: {
    label: 'Livros',
    noteDir: '📚 Livros',
    coverDir: '📚 Livros/Capas',
    coverRelativePrefix: 'Capas/',
    defaultStatus: 'para ler',
    defaultTags: ['livro', 'leitura']
  },
  games: {
    label: 'Games',
    noteDir: '🎮 Games',
    coverDir: '🎮 Games/Capas',
    coverRelativePrefix: 'Capas/',
    defaultStatus: 'para jogar',
    defaultTags: ['game', 'jogos']
  },
  musicas: {
    label: 'Musicas',
    noteDir: 'Musicas/Albums',
    coverDir: 'Musicas/Capas',
    coverRelativePrefix: '../Capas/',
    defaultStatus: 'para ouvir',
    defaultTags: ['musica', 'album']
  },
  outros: {
    label: 'Outros',
    noteDir: 'Catalogo/Outros',
    coverDir: 'Catalogo/Outros/Capas',
    coverRelativePrefix: 'Capas/',
    defaultStatus: 'pendente',
    defaultTags: ['catalogo', 'outros']
  }
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url || '/', `http://localhost:${port}`);

  try {
    if (requestUrl.pathname.startsWith('/api/')) {
      await handleApi(req, res, requestUrl);
      return;
    }

    await serveStatic(requestUrl, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: 'Erro interno do servidor' });
  }
});

server.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`Servidor local: http://${displayHost}:${port}`);
});

async function handleApi(req, res, url) {
  try {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      sendJson(res, 200, {
        vaultRoot,
        providers: {
          omdbConfigured: Boolean(omdbApiKey)
        },
        categories: Object.entries(CATEGORY_SETTINGS).map(([key, settings]) => ({
          key,
          label: settings.label,
          defaultStatus: settings.defaultStatus
        }))
      });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/metadata/search') {
      const category = normalizeCategory(url.searchParams.get('category'));
      const query = (url.searchParams.get('q') || '').trim();

      if (!category || !CATEGORY_SETTINGS[category]) {
        sendJson(res, 400, { error: 'Categoria invalida' });
        return;
      }

      if (!query) {
        sendJson(res, 400, { error: 'Informe uma busca' });
        return;
      }

      const results = await searchMetadata({ category, query });
      sendJson(res, 200, { results });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/items') {
      const body = await readJsonBody(req);
      const result = await createCatalogItem(body);
      sendJson(res, 201, result);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/rebuild') {
      await runBuild();
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'Endpoint nao encontrado' });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const message = error.message || 'Erro interno';
    sendJson(res, status, { error: message });
  }
}

async function serveStatic(url, res) {
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const normalized = path
    .normalize(requestPath)
    .replace(/^\/+/, '')
    .replace(/^\.+[\\/]/, '');
  const filePath = path.join(distDir, normalized);

  if (!filePath.startsWith(distDir)) {
    sendText(res, 403, 'Acesso negado');
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    res.end(file);
  } catch {
    sendText(res, 404, 'Arquivo nao encontrado');
  }
}

async function searchMetadata({ category, query }) {
  if (category === 'livros') {
    return searchOpenLibrary(query);
  }

  if (category === 'musicas') {
    return searchITunesAlbums(query);
  }

  return searchOmdb(query, category);
}

async function searchOmdb(query, category) {
  ensureOmdbConfigured();

  if (/^tt\d{6,10}$/i.test(query)) {
    const detail = await fetchOmdbDetails(query);
    return detail ? [detail] : [];
  }

  const typeHint = category === 'filmes' ? 'movie' : category === 'series' ? 'series' : '';
  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', omdbApiKey);
  url.searchParams.set('s', query);
  if (typeHint) {
    url.searchParams.set('type', typeHint);
  }

  const payload = await fetchJson(url.toString());
  if (!payload || payload.Response === 'False' || !Array.isArray(payload.Search)) {
    return [];
  }

  const limited = payload.Search.slice(0, 6);
  const detailed = await Promise.all(
    limited.map(async (entry) => {
      try {
        return await fetchOmdbDetails(entry.imdbID);
      } catch {
        return null;
      }
    })
  );

  return detailed.filter(Boolean);
}

async function fetchOmdbDetails(imdbId) {
  ensureOmdbConfigured();

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', omdbApiKey);
  url.searchParams.set('i', imdbId);
  url.searchParams.set('plot', 'full');

  const payload = await fetchJson(url.toString());
  if (!payload || payload.Response === 'False') {
    return null;
  }

  const yearValue = pickYear(payload.Year);
  const genres = parseCommaList(payload.Genre);
  const creator = firstNonEmpty([
    payload.Director,
    payload.Writer,
    payload.Actors
  ]);

  const statusHint =
    payload.Type === 'series'
      ? 'para assistir'
      : payload.Type === 'movie'
        ? 'para assistir'
        : 'pendente';

  return {
    id: payload.imdbID,
    provider: 'omdb',
    sourceId: payload.imdbID,
    sourceUrl: payload.imdbID ? `https://www.imdb.com/title/${payload.imdbID}/` : null,
    title: cleanValue(payload.Title),
    year: yearValue,
    creator,
    genres,
    synopsis: cleanValue(payload.Plot),
    imageUrl: normalizeImageUrl(payload.Poster),
    rating: parseImdbRating(payload.imdbRating),
    statusHint,
    extras: {
      type: cleanValue(payload.Type),
      runtime: cleanValue(payload.Runtime),
      totalSeasons: toNumber(payload.totalSeasons),
      language: cleanValue(payload.Language),
      country: cleanValue(payload.Country)
    }
  };
}

async function searchOpenLibrary(query) {
  const url = new URL('https://openlibrary.org/search.json');
  url.searchParams.set('title', query);
  url.searchParams.set('limit', '8');

  const payload = await fetchJson(url.toString());
  if (!payload || !Array.isArray(payload.docs)) {
    return [];
  }

  return payload.docs
    .filter((doc) => doc.title)
    .slice(0, 8)
    .map((doc) => {
      const sourceId = cleanValue(doc.key);
      const firstIsbn = Array.isArray(doc.isbn) ? cleanValue(doc.isbn[0]) : null;

      return {
        id: sourceId || slug(doc.title),
        provider: 'openlibrary',
        sourceId,
        sourceUrl: sourceId ? `https://openlibrary.org${sourceId}` : null,
        title: cleanValue(doc.title),
        year: toNumber(doc.first_publish_year),
        creator: Array.isArray(doc.author_name) ? cleanValue(doc.author_name[0]) : null,
        genres: Array.isArray(doc.subject) ? doc.subject.slice(0, 4).map(cleanValue).filter(Boolean) : [],
        synopsis: null,
        imageUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
        rating: null,
        statusHint: 'para ler',
        extras: {
          isbn: firstIsbn,
          pages: toNumber(doc.number_of_pages_median)
        }
      };
    });
}

async function searchITunesAlbums(query) {
  const url = new URL('https://itunes.apple.com/search');
  url.searchParams.set('term', query);
  url.searchParams.set('entity', 'album');
  url.searchParams.set('limit', '8');

  const payload = await fetchJson(url.toString());
  if (!payload || !Array.isArray(payload.results)) {
    return [];
  }

  return payload.results
    .filter((entry) => entry.collectionName)
    .slice(0, 8)
    .map((entry) => {
      const year = entry.releaseDate ? new Date(entry.releaseDate).getFullYear() : null;
      return {
        id: String(entry.collectionId || slug(entry.collectionName)),
        provider: 'itunes',
        sourceId: cleanValue(String(entry.collectionId || '')),
        sourceUrl: cleanValue(entry.collectionViewUrl),
        title: cleanValue(entry.collectionName),
        year: Number.isFinite(year) ? year : null,
        creator: cleanValue(entry.artistName),
        genres: cleanValue(entry.primaryGenreName) ? [entry.primaryGenreName] : [],
        synopsis: cleanValue(entry.copyright),
        imageUrl: normalizeItunesArtwork(entry.artworkUrl100),
        rating: null,
        statusHint: 'para ouvir',
        extras: {
          trackCount: toNumber(entry.trackCount)
        }
      };
    });
}

async function createCatalogItem(payload) {
  const category = normalizeCategory(payload.category);
  if (!category || !CATEGORY_SETTINGS[category]) {
    throw createHttpError(400, 'Categoria invalida');
  }

  const settings = CATEGORY_SETTINGS[category];
  const title = cleanValue(payload.title);
  if (!title) {
    throw createHttpError(400, 'Titulo e obrigatorio');
  }

  const noteDir = path.join(vaultRoot, settings.noteDir);
  const coverDir = path.join(vaultRoot, settings.coverDir);

  await fs.mkdir(noteDir, { recursive: true });
  await fs.mkdir(coverDir, { recursive: true });

  const imageFromClient = cleanValue(payload.imageUrl);
  const metadata = typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {};
  const imageUrl = imageFromClient || cleanValue(metadata.imageUrl);

  const titleSlug = slug(title);
  let coverRelative = null;
  if (imageUrl) {
    try {
      const savedName = await downloadCover({ imageUrl, coverDir, titleSlug });
      coverRelative = `${settings.coverRelativePrefix}${savedName}`;
    } catch (error) {
      console.error('Falha ao baixar capa:', error.message);
    }
  }

  const markdown = buildMarkdown({
    category,
    settings,
    title,
    coverRelative,
    payload,
    metadata
  });

  const baseFileName = sanitizeFileName(title);
  const targetPath = await resolveUniquePath(noteDir, `${baseFileName}.md`);
  await fs.writeFile(targetPath, markdown, 'utf8');

  await runBuild();

  return {
    ok: true,
    created: toPosix(path.relative(vaultRoot, targetPath)),
    title
  };
}

function buildMarkdown({ category, settings, title, coverRelative, payload, metadata }) {
  const genres = parseCsvOrArray(payload.genres);
  const tags = parseCsvOrArray(payload.tags);
  const mergedTags = uniqueStrings([...settings.defaultTags, ...tags]);

  const creator = cleanValue(payload.creator) || cleanValue(metadata.creator) || '';
  const year = normalizeYear(payload.year ?? metadata.year);
  const status = cleanValue(payload.status) || settings.defaultStatus;
  const rating = normalizeRating(payload.rating ?? metadata.rating);
  const notes = cleanValue(payload.notes) || cleanValue(metadata.synopsis) || '';
  const sourceId = cleanValue(payload.sourceId) || cleanValue(metadata.sourceId) || '';
  const sourceUrl = cleanValue(payload.sourceUrl) || cleanValue(metadata.sourceUrl) || '';
  const date = cleanValue(payload.date) || '';

  switch (category) {
    case 'filmes':
      return formatFilmNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, sourceUrl });
    case 'series':
      return formatSeriesNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, metadata, sourceUrl });
    case 'livros':
      return formatBookNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, metadata, sourceUrl });
    case 'games':
      return formatGameNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, sourceUrl });
    case 'musicas':
      return formatMusicNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, metadata, sourceUrl });
    case 'outros':
    default:
      return formatOtherNote({ title, coverRelative, mergedTags, creator, year, genres, rating, status, date, sourceId, notes, sourceUrl });
  }
}

function formatFilmNote(ctx) {
  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `poster: ${yamlString(ctx.coverRelative || '')}`,
    `diretor: ${yamlString(ctx.creator)}`,
    `ano: ${yamlNumberish(ctx.year)}`,
    `genero: ${yamlArray(ctx.genres)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_assistido: ${yamlDate(ctx.date)}`,
    `imdb: ${yamlString(ctx.sourceId)}`,
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Diretor:** ${ctx.creator || '-'}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**IMDb:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Sinopse',
    '',
    ctx.notes || 'Sem sinopse por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

function formatSeriesNote(ctx) {
  const yearStart = typeof ctx.year === 'string' && ctx.year.includes('-') ? ctx.year.split('-')[0] : ctx.year;
  const yearEnd = typeof ctx.year === 'string' && ctx.year.includes('-') ? ctx.year.split('-')[1] : '';
  const seasons = toNumber(ctx.metadata?.extras?.totalSeasons);

  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `poster: ${yamlString(ctx.coverRelative || '')}`,
    `criador: ${yamlString(ctx.creator)}`,
    `ano_inicio: ${yamlNumberish(yearStart)}`,
    `ano_fim: ${yamlNumberish(yearEnd)}`,
    `temporadas: ${yamlNumberish(seasons)}`,
    'episodios: ',
    `genero: ${yamlArray(ctx.genres)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_assistido: ${yamlDate(ctx.date)}`,
    `imdb: ${yamlString(ctx.sourceId)}`,
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Criador(a):** ${ctx.creator || '-'}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**IMDb:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Sinopse',
    '',
    ctx.notes || 'Sem sinopse por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

function formatBookNote(ctx) {
  const pages = toNumber(ctx.metadata?.extras?.pages);

  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `capa: ${yamlString(ctx.coverRelative || '')}`,
    `autor: ${yamlString(ctx.creator)}`,
    `ano: ${yamlNumberish(ctx.year)}`,
    `genero: ${yamlArray(ctx.genres)}`,
    `paginas: ${yamlNumberish(pages)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_lido: ${yamlDate(ctx.date)}`,
    `isbn: ${yamlString(ctx.sourceId)}`,
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Autor:** ${ctx.creator || '-'}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**Fonte:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Resumo',
    '',
    ctx.notes || 'Sem resumo por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

function formatGameNote(ctx) {
  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `capa: ${yamlString(ctx.coverRelative || '')}`,
    `desenvolvedora: ${yamlString(ctx.creator)}`,
    'publicadora: ""',
    `ano: ${yamlNumberish(ctx.year)}`,
    'plataforma: []',
    `genero: ${yamlArray(ctx.genres)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_jogado: ${yamlDate(ctx.date)}`,
    'metacritic: ""',
    `imdb: ${yamlString(ctx.sourceId)}`,
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Desenvolvedora:** ${ctx.creator || '-'}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**Fonte:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Sobre',
    '',
    ctx.notes || 'Sem resumo por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

function formatMusicNote(ctx) {
  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `poster: ${yamlString(ctx.coverRelative || '')}`,
    `artista: ${yamlString(ctx.creator)}`,
    `album: ${yamlString(ctx.title)}`,
    `ano: ${yamlNumberish(ctx.year)}`,
    `genero: ${yamlArray(ctx.genres)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_ouvido: ${yamlDate(ctx.date)}`,
    `spotify: ${yamlString(ctx.sourceUrl || '')}`,
    'faixas_favoritas: []',
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Artista:** ${ctx.creator || '-'}`,
    `**Album:** ${ctx.title}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**Fonte:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Sobre',
    '',
    ctx.notes || 'Sem descricao por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

function formatOtherNote(ctx) {
  return [
    '---',
    `tags: ${yamlArray(ctx.mergedTags)}`,
    `capa: ${yamlString(ctx.coverRelative || '')}`,
    `criador: ${yamlString(ctx.creator)}`,
    `ano: ${yamlNumberish(ctx.year)}`,
    `genero: ${yamlArray(ctx.genres)}`,
    `nota: ${yamlNumberish(ctx.rating)}`,
    `status: ${yamlString(ctx.status)}`,
    `data_registro: ${yamlDate(ctx.date)}`,
    `fonte: ${yamlString(ctx.sourceUrl || ctx.sourceId || '')}`,
    '---',
    '',
    `# ${ctx.title}`,
    '',
    ...(ctx.coverRelative ? [`![Capa](${ctx.coverRelative})`, ''] : []),
    `**Criador(a):** ${ctx.creator || '-'}`,
    `**Ano:** ${ctx.year || '-'}`,
    `**Genero:** ${ctx.genres.join(', ') || '-'}`,
    ...(ctx.sourceUrl ? [`**Fonte:** ${ctx.sourceUrl}`] : []),
    '',
    '---',
    '',
    '## Sobre',
    '',
    ctx.notes || 'Sem descricao por enquanto.',
    '',
    '## Minhas Notas',
    '',
    ctx.notes || 'Adicionar anotacoes pessoais.',
    '',
    '## Avaliacao',
    '',
    `**Nota:** ${ctx.rating ?? ''}/10`,
    '',
    '---',
    '',
    `**Status:** \`${ctx.status}\``,
    ''
  ].join('\n');
}

async function runBuild() {
  await execFileAsync('node', [buildScriptPath], {
    cwd: projectRoot,
    env: {
      ...process.env,
      VAULT_PATH: vaultRoot
    }
  });
}

async function downloadCover({ imageUrl, coverDir, titleSlug }) {
  const response = await fetchWithTimeout(imageUrl);
  if (!response.ok) {
    throw new Error(`Download de capa falhou (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = detectImageExtension({
    contentType: response.headers.get('content-type'),
    imageUrl
  });

  const fileName = `${titleSlug}${extension}`;
  const destination = path.join(coverDir, fileName);
  await fs.writeFile(destination, buffer);
  return fileName;
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw createHttpError(502, `Falha na consulta remota (${response.status})`);
  }

  return response.json();
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createHttpError(504, 'Timeout ao consultar servico externo');
    }
    throw createHttpError(502, 'Erro de rede ao consultar servico externo');
  } finally {
    clearTimeout(timer);
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      throw createHttpError(413, 'Payload muito grande');
    }
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw createHttpError(400, 'JSON invalido');
  }
}

function ensureOmdbConfigured() {
  if (!omdbApiKey) {
    throw createHttpError(
      400,
      'OMDB_API_KEY nao configurada. Defina a chave no servico para usar busca automatica de filme/serie/game.'
    );
  }
}

function normalizeCategory(value) {
  if (!value) {
    return null;
  }
  return String(value).trim().toLowerCase();
}

function normalizeYear(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string') {
    const cleaned = value.trim();
    if (!cleaned) {
      return null;
    }
    if (/^\d{4}$/.test(cleaned)) {
      return Number(cleaned);
    }
    const range = cleaned.match(/^(\d{4})\s*[-/]\s*(\d{4})$/);
    if (range) {
      return `${range[1]}-${range[2]}`;
    }
    const first = cleaned.match(/\d{4}/);
    return first ? Number(first[0]) : cleaned;
  }

  return null;
}

function normalizeRating(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.max(0, Math.min(10, Number(number.toFixed(1))));
}

function parseImdbRating(value) {
  if (!value || value === 'N/A') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null;
}

function pickYear(value) {
  if (!value || value === 'N/A') {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  const range = raw.match(/^(\d{4})\s*[-\u2013]\s*(\d{4}|)$/);
  if (range) {
    return range[2] ? `${range[1]}-${range[2]}` : Number(range[1]);
  }

  const first = raw.match(/\d{4}/);
  return first ? Number(first[0]) : null;
}

function parseCsvOrArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return uniqueStrings(value.map(cleanValue).filter(Boolean));
  }

  return uniqueStrings(
    String(value)
      .split(',')
      .map((entry) => cleanValue(entry))
      .filter(Boolean)
  );
}

function parseCommaList(value) {
  if (!value || value === 'N/A') {
    return [];
  }
  return value
    .split(',')
    .map((entry) => cleanValue(entry))
    .filter(Boolean);
}

function cleanValue(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'N/A') {
    return null;
  }
  return trimmed;
}

function uniqueStrings(values) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(value);
    }
  }

  return out;
}

function normalizeImageUrl(value) {
  const cleaned = cleanValue(value);
  if (!cleaned || cleaned === 'N/A') {
    return null;
  }
  return cleaned;
}

function normalizeItunesArtwork(value) {
  const cleaned = cleanValue(value);
  if (!cleaned) {
    return null;
  }
  return cleaned.replace(/100x100bb/i, '600x600bb');
}

function detectImageExtension({ contentType, imageUrl }) {
  const byHeader = String(contentType || '').toLowerCase();
  if (byHeader.includes('image/png')) {
    return '.png';
  }
  if (byHeader.includes('image/webp')) {
    return '.webp';
  }
  if (byHeader.includes('image/gif')) {
    return '.gif';
  }

  try {
    const ext = path.extname(new URL(imageUrl).pathname).toLowerCase();
    if (['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
      return ext === '.jpeg' ? '.jpg' : ext;
    }
  } catch {
    // Ignore malformed URL and fallback to jpg.
  }

  return '.jpg';
}

function sanitizeFileName(text) {
  return text
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveUniquePath(dir, fileName) {
  const extension = path.extname(fileName);
  const stem = fileName.slice(0, -extension.length);

  let attempt = 0;
  while (attempt < 500) {
    const candidate = attempt === 0 ? `${stem}${extension}` : `${stem} (${attempt + 1})${extension}`;
    const fullPath = path.join(dir, candidate);

    try {
      await fs.access(fullPath);
      attempt += 1;
    } catch {
      return fullPath;
    }
  }

  throw createHttpError(500, 'Nao foi possivel gerar nome unico para o arquivo');
}

function slug(value) {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function yamlString(value) {
  const safe = String(value || '').replace(/"/g, '\\"');
  return `"${safe}"`;
}

function yamlArray(values) {
  if (!values.length) {
    return '[]';
  }
  const escaped = values.map((value) => `"${String(value).replace(/"/g, '\\"')}"`);
  return `[${escaped.join(', ')}]`;
}

function yamlNumberish(value) {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  return String(value);
}

function yamlDate(value) {
  if (!value) {
    return '';
  }
  return String(value);
}

function firstNonEmpty(values) {
  for (const value of values) {
    const cleaned = cleanValue(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return null;
}

function toNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

process.on('uncaughtException', (error) => {
  console.error('Erro nao tratado:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Promise rejeitada:', error);
});

server.on('request', (_req, res) => {
  res.on('error', (error) => {
    console.error('Erro de resposta:', error.message);
  });
});

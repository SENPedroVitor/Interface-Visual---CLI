const data = window.__CATALOGO_DATA__ || { items: [], meta: { totalItems: 0, categories: [] } };

const STATUS_OPTIONS = {
  filmes: ['para assistir', 'assistido', 'abandonado'],
  series: ['para assistir', 'assistido', 'abandonado'],
  livros: ['para ler', 'lido', 'abandonado'],
  games: ['para jogar', 'jogado', 'dropado'],
  musicas: ['para ouvir', 'ouvido', 'pausado'],
  outros: ['pendente', 'concluido']
};

const state = {
  category: 'todos',
  status: 'todos',
  query: '',
  sort: 'rating_desc',
  metadataResults: [],
  selectedMetadata: null
};

const categoryChips = document.getElementById('categoryChips');
const statusFilter = document.getElementById('statusFilter');
const sortSelect = document.getElementById('sortSelect');
const searchInput = document.getElementById('searchInput');
const summary = document.getElementById('summary');
const catalogGrid = document.getElementById('catalogGrid');

const providerInfo = document.getElementById('providerInfo');
const addCategory = document.getElementById('addCategory');
const metadataQuery = document.getElementById('metadataQuery');
const metadataSearchBtn = document.getElementById('metadataSearchBtn');
const metadataResults = document.getElementById('metadataResults');
const applyMetadataBtn = document.getElementById('applyMetadataBtn');
const addTitle = document.getElementById('addTitle');
const addCreator = document.getElementById('addCreator');
const addYear = document.getElementById('addYear');
const addGenres = document.getElementById('addGenres');
const addTags = document.getElementById('addTags');
const addStatus = document.getElementById('addStatus');
const addRating = document.getElementById('addRating');
const addDate = document.getElementById('addDate');
const addSourceId = document.getElementById('addSourceId');
const addSourceUrl = document.getElementById('addSourceUrl');
const addImageUrl = document.getElementById('addImageUrl');
const addNotes = document.getElementById('addNotes');
const saveItemBtn = document.getElementById('saveItemBtn');
const addMessage = document.getElementById('addMessage');

init();
render();

async function init() {
  renderCategoryChips();
  populateStatusFilter();
  initComposer();

  searchInput.addEventListener('input', (event) => {
    state.query = event.target.value.trim().toLowerCase();
    render();
  });

  statusFilter.addEventListener('change', (event) => {
    state.status = event.target.value;
    render();
  });

  sortSelect.addEventListener('change', (event) => {
    state.sort = event.target.value;
    render();
  });

  await loadConfig();
}

function initComposer() {
  updateAddStatusOptions();
  clearMetadataResults();

  addCategory.addEventListener('change', () => {
    updateAddStatusOptions();
    clearMetadataResults();
  });

  metadataSearchBtn.addEventListener('click', onMetadataSearch);
  applyMetadataBtn.addEventListener('click', onApplyMetadata);
  saveItemBtn.addEventListener('click', onSaveItem);
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    providerInfo.textContent = payload.providers?.omdbConfigured
      ? 'OMDb ativo para filme/serie/game.'
      : 'OMDb nao configurado: filme/serie/game vao depender de preenchimento manual.';
  } catch {
    providerInfo.textContent = 'Nao foi possivel validar provedores agora.';
  }
}

function updateAddStatusOptions() {
  const category = addCategory.value;
  const options = STATUS_OPTIONS[category] || ['pendente'];

  addStatus.innerHTML = options
    .map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(capitalize(status))}</option>`)
    .join('');

  addStatus.value = options[0];
}

async function onMetadataSearch() {
  const category = addCategory.value;
  const query = metadataQuery.value.trim();

  if (!query) {
    setMessage('Digite um titulo ou ID para buscar.', 'error');
    return;
  }

  setLoading(metadataSearchBtn, true, 'Buscando...');
  setMessage('Buscando metadados...', 'info');

  try {
    const params = new URLSearchParams({ category, q: query });
    const response = await fetch(`/api/metadata/search?${params.toString()}`);
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || 'Falha na busca de metadados');
    }

    state.metadataResults = Array.isArray(payload.results) ? payload.results : [];

    if (!state.metadataResults.length) {
      clearMetadataResults();
      setMessage('Nenhum resultado automatico encontrado. Preencha manualmente.', 'error');
      return;
    }

    metadataResults.innerHTML = state.metadataResults
      .map((result, index) => {
        const label = `${result.title || 'Sem titulo'}${result.year ? ` (${result.year})` : ''}${result.creator ? ` - ${result.creator}` : ''}`;
        return `<option value="${index}">${escapeHtml(label)}</option>`;
      })
      .join('');

    metadataResults.disabled = false;
    applyMetadataBtn.disabled = false;
    metadataResults.value = '0';
    state.selectedMetadata = state.metadataResults[0];
    setMessage('Resultados carregados. Clique em Aplicar.', 'success');
  } catch (error) {
    setMessage(error.message || 'Erro ao buscar metadados.', 'error');
  } finally {
    setLoading(metadataSearchBtn, false, 'Buscar');
  }
}

function onApplyMetadata() {
  const index = Number(metadataResults.value);
  const selected = state.metadataResults[index];

  if (!selected) {
    setMessage('Selecione um resultado para aplicar.', 'error');
    return;
  }

  state.selectedMetadata = selected;

  addTitle.value = selected.title || addTitle.value;
  addCreator.value = selected.creator || addCreator.value;
  addYear.value = selected.year || addYear.value;
  addGenres.value = (selected.genres || []).join(', ');

  if (!addRating.value && selected.rating !== null && selected.rating !== undefined) {
    addRating.value = selected.rating;
  }

  if (!addNotes.value && selected.synopsis) {
    addNotes.value = selected.synopsis;
  }

  addSourceId.value = selected.sourceId || '';
  addSourceUrl.value = selected.sourceUrl || '';

  if (!addImageUrl.value && selected.imageUrl) {
    addImageUrl.value = selected.imageUrl;
  }

  if (selected.statusHint && addStatus.querySelector(`option[value="${cssEscape(selected.statusHint)}"]`)) {
    addStatus.value = selected.statusHint;
  }

  setMessage('Metadados aplicados no formulario.', 'success');
}

async function onSaveItem() {
  const category = addCategory.value;
  const title = addTitle.value.trim();

  if (!title) {
    setMessage('Titulo e obrigatorio para salvar.', 'error');
    return;
  }

  const payload = {
    category,
    title,
    creator: addCreator.value.trim(),
    year: addYear.value.trim(),
    genres: addGenres.value.trim(),
    tags: addTags.value.trim(),
    status: addStatus.value,
    rating: addRating.value,
    date: addDate.value,
    sourceId: addSourceId.value.trim(),
    sourceUrl: addSourceUrl.value.trim(),
    imageUrl: addImageUrl.value.trim(),
    notes: addNotes.value.trim(),
    metadata: state.selectedMetadata || null
  };

  setLoading(saveItemBtn, true, 'Salvando...');
  setMessage('Criando nota no Obsidian e atualizando catalogo...', 'info');

  try {
    const response = await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Erro ao salvar item');
    }

    setMessage(`Salvo em ${result.created}. Recarregando...`, 'success');
    setTimeout(() => {
      window.location.reload();
    }, 900);
  } catch (error) {
    setMessage(error.message || 'Falha ao salvar item.', 'error');
  } finally {
    setLoading(saveItemBtn, false, 'Salvar no Obsidian');
  }
}

function clearMetadataResults() {
  state.metadataResults = [];
  state.selectedMetadata = null;
  metadataResults.innerHTML = '<option value="">Sem resultados</option>';
  metadataResults.disabled = true;
  applyMetadataBtn.disabled = true;
}

function setMessage(text, type) {
  addMessage.textContent = text;
  if (type === 'error') {
    addMessage.style.color = '#9b1a1a';
  } else if (type === 'success') {
    addMessage.style.color = '#1b6f3b';
  } else {
    addMessage.style.color = '#5a5145';
  }
}

function setLoading(button, active, loadingLabel) {
  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent;
  }
  button.disabled = active;
  button.textContent = active ? loadingLabel : button.dataset.defaultLabel;
}

function renderCategoryChips() {
  const allChip = makeChip({ key: 'todos', label: `Todos (${data.meta.totalItems})` });
  categoryChips.append(allChip);

  for (const category of data.meta.categories || []) {
    categoryChips.append(makeChip(category));
  }
}

function makeChip(category) {
  const button = document.createElement('button');
  button.dataset.key = category.key;
  button.type = 'button';
  button.className = `chip${state.category === category.key ? ' active' : ''}`;
  button.textContent = category.count !== undefined ? `${category.label} (${category.count})` : category.label;

  button.addEventListener('click', () => {
    state.category = category.key;
    refreshActiveChip();
    render();
  });

  return button;
}

function refreshActiveChip() {
  categoryChips.querySelectorAll('.chip').forEach((chip) => {
    const isActive = chip.dataset.key === state.category;
    chip.classList.toggle('active', isActive);
  });
}

function populateStatusFilter() {
  const statuses = Array.from(new Set(data.items.map((item) => item.status).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  );

  statusFilter.innerHTML = '';

  const allOption = document.createElement('option');
  allOption.value = 'todos';
  allOption.textContent = 'Todos';
  statusFilter.append(allOption);

  for (const status of statuses) {
    const option = document.createElement('option');
    option.value = status;
    option.textContent = capitalize(status);
    statusFilter.append(option);
  }

  statusFilter.value = state.status;
}

function render() {
  const filtered = sortItems(filterItems(data.items));
  renderSummary(filtered.length);
  renderGrid(filtered);
  refreshActiveChip();
}

function filterItems(items) {
  return items.filter((item) => {
    if (state.category !== 'todos' && item.category !== state.category) {
      return false;
    }

    if (state.status !== 'todos' && item.status !== state.status) {
      return false;
    }

    if (!state.query) {
      return true;
    }

    const haystack = [
      item.title,
      item.creator,
      item.categoryLabel,
      item.status,
      item.notes,
      (item.genres || []).join(' '),
      (item.tags || []).join(' ')
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(state.query);
  });
}

function sortItems(items) {
  const cloned = [...items];

  switch (state.sort) {
    case 'rating_asc':
      return cloned.sort((a, b) => numberValue(a.rating) - numberValue(b.rating));
    case 'date_desc':
      return cloned.sort((a, b) => dateValue(b.date) - dateValue(a.date));
    case 'year_desc':
      return cloned.sort((a, b) => yearValue(b.year) - yearValue(a.year));
    case 'title_asc':
      return cloned.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    case 'rating_desc':
    default:
      return cloned.sort((a, b) => numberValue(b.rating) - numberValue(a.rating));
  }
}

function renderSummary(totalFiltered) {
  const total = data.meta.totalItems || 0;
  const generatedAt = data.generatedAt ? new Date(data.generatedAt).toLocaleString('pt-BR') : 'n/d';
  summary.textContent = `Mostrando ${totalFiltered} de ${total} item(ns). Ultima atualizacao: ${generatedAt}.`;
}

function renderGrid(items) {
  if (!items.length) {
    catalogGrid.innerHTML = '<div class="empty">Nenhum item encontrado com esses filtros.</div>';
    return;
  }

  catalogGrid.innerHTML = items
    .map((item, index) => {
      const stars = item.rating ? `${'★'.repeat(Math.max(1, Math.round(item.rating / 2)))} (${item.rating}/10)` : 'Sem nota';
      const year = item.year || 'Ano n/d';
      const creator = item.creator || 'Autor(a) n/d';
      const genres = item.genres?.length ? item.genres.join(', ') : 'Genero n/d';
      const status = item.status ? capitalize(item.status) : 'Status n/d';
      const placeholder = categoryEmoji(item.category);
      const note = item.notes ? escapeHtml(item.notes) : 'Sem anotacao ainda.';
      const imageSrc = item.image ? `./${encodeURI(item.image)}` : null;

      return `
        <article class="card" style="animation-delay: ${Math.min(index * 24, 320)}ms">
          <div class="cover${imageSrc ? ' has-image' : ''}"${imageSrc ? ` style="background-image:url('${imageSrc}')"` : ''}>
            ${
              imageSrc
                ? `<img src="${imageSrc}" alt="${escapeHtml(item.title)}" loading="lazy" />`
                : `<span class="placeholder">${placeholder}</span>`
            }
          </div>
          <div class="body">
            <h2 class="title">${escapeHtml(item.title)}</h2>
            <p class="meta"><strong>${escapeHtml(item.categoryLabel)}</strong> • ${escapeHtml(status)}</p>
            <p class="meta">${escapeHtml(String(year))} • ${escapeHtml(creator)}</p>
            <p class="meta">${escapeHtml(genres)}</p>
            <div class="badges">
              <span class="badge">${escapeHtml(stars)}</span>
              ${item.date ? `<span class="badge">${escapeHtml(item.date)}</span>` : ''}
            </div>
            <p class="notes">${note}</p>
            <p class="source">${escapeHtml(item.sourcePath)}</p>
          </div>
        </article>
      `;
    })
    .join('');
}

function categoryEmoji(category) {
  switch (category) {
    case 'filmes':
      return '🎬';
    case 'series':
      return '📺';
    case 'livros':
      return '📚';
    case 'games':
      return '🎮';
    case 'musicas':
      return '🎵';
    case 'outros':
      return '🗂️';
    default:
      return '⭐';
  }
}

function numberValue(value) {
  return Number.isFinite(value) ? value : -1;
}

function dateValue(value) {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function yearValue(value) {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const firstYear = value.match(/\d{4}/);
    return firstYear ? Number(firstYear[0]) : 0;
  }

  return 0;
}

function capitalize(text) {
  if (!text) {
    return '';
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') {
    return window.CSS.escape(value);
  }
  return value.replaceAll('"', '\\"');
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

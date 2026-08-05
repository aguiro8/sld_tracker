const DEFAULT_CATEGORY_ID = 1;
const DEFAULT_GROUP_ID = 2576;
const GROUP_OVERRIDES = {
  660745: 17667,
};

const PROXY_CANDIDATES = [
  'https://proxy.cors.sh/',
  'https://corsproxy.io/?',
];
const PRICE_ENDPOINT = `https://tcgcsv.com/tcgplayer/${DEFAULT_CATEGORY_ID}/${DEFAULT_GROUP_ID}/prices`;

const groupLabel = document.getElementById('groupLabel');
if (groupLabel) {
  groupLabel.textContent = `category ${DEFAULT_CATEGORY_ID} / group ${DEFAULT_GROUP_ID}`;
}

const resultsBody = document.getElementById('resultsBody');
const statusMessage = document.getElementById('statusMessage');
const resultCount = document.getElementById('resultCount');
const totalValue = document.getElementById('totalValue');
const summaryCount = document.getElementById('summaryCount');
const unmatchedRowsStat = document.getElementById('unmatchedRowsStat');
const unmatchedRows = document.getElementById('unmatchedRows');
const refreshButton = document.getElementById('refreshButton');
const sortButtons = document.querySelectorAll('.sort-button');

const lookupCache = new Map();
let currentRows = [];
let currentSortKey = 'name';
let currentSortDirection = 'asc';
let imagePreview = null;

function parseCsvContents(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] || '';
    });
    return row;
  });
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function money(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return `$${Number(value).toFixed(2)}`;
}

function getImageUrl(row) {
  const candidates = [
    row['Image URL'],
    row['image URL'],
    row['ImageURL'],
    row.imageUrl,
    row.image_url,
    row['Image URL '],
  ];

  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function ensureImagePreview() {
  if (imagePreview) {
    return imagePreview;
  }

  imagePreview = document.createElement('div');
  imagePreview.className = 'image-preview';
  imagePreview.setAttribute('aria-hidden', 'true');

  const img = document.createElement('img');
  img.alt = 'Item preview';
  imagePreview.appendChild(img);
  document.body.appendChild(imagePreview);
  return imagePreview;
}

function updateImagePreview(event, imageUrl) {
  if (!imageUrl) {
    return;
  }

  const preview = ensureImagePreview();
  const img = preview.querySelector('img');
  img.src = imageUrl;
  preview.classList.add('visible');
  preview.setAttribute('aria-hidden', 'false');

  const padding = 16;
  let left = event.clientX + padding;
  let top = event.clientY + padding;
  const previewRect = preview.getBoundingClientRect();
  const maxLeft = window.innerWidth - previewRect.width - padding;
  const maxTop = window.innerHeight - previewRect.height - padding;

  left = Math.min(left, maxLeft);
  top = Math.min(top, maxTop);

  preview.style.left = `${Math.max(padding, left)}px`;
  preview.style.top = `${Math.max(padding, top)}px`;
}

function hideImagePreview() {
  if (!imagePreview) {
    return;
  }

  imagePreview.classList.remove('visible');
  imagePreview.setAttribute('aria-hidden', 'true');
  imagePreview.querySelector('img').removeAttribute('src');
}

function sumTotal(quantity, market) {
  if (market === null || market === undefined || market === '') return '—';
  return `$${(Number(quantity) * Number(market)).toFixed(2)}`;
}

async function fetchPricesForGroup(groupId) {
  const endpoint = `https://tcgcsv.com/tcgplayer/${DEFAULT_CATEGORY_ID}/${groupId}/prices`;

  if (lookupCache.has(groupId)) {
    return lookupCache.get(groupId);
  }

  statusMessage.textContent = `Fetching ${endpoint}…`;
  let lastError = null;

  for (const proxyBase of PROXY_CANDIDATES) {
    const proxyUrl = `${proxyBase}${endpoint}`;
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`Unable to fetch prices for group ${groupId}: ${response.status}`);
      }

      const payload = await response.json();
      const results = Array.isArray(payload)
        ? payload
        : Array.isArray(payload.results)
          ? payload.results
          : Array.isArray(payload.data)
            ? payload.data
            : null;

      if (!Array.isArray(results)) {
        throw new Error(`Unexpected JSON shape for group ${groupId}`);
      }

      lookupCache.set(groupId, results);
      return results;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Unable to load TCGCSV prices for group ${groupId}. ${lastError?.message || 'Proxy fetch failed.'}`);
}

function resolveGroupId(productId) {
  return GROUP_OVERRIDES[productId] || DEFAULT_GROUP_ID;
}

function compareValues(a, b, key) {
  if (key === 'market') {
    const aValue = Number(a.match?.marketPrice || 0);
    const bValue = Number(b.match?.marketPrice || 0);
    return aValue - bValue;
  }

  if (key === 'quantity' || key === 'tcgplayer_id' || key === 'groupId') {
    const aValue = Number(a[key] ?? a.groupId ?? 0);
    const bValue = Number(b[key] ?? b.groupId ?? 0);
    return aValue - bValue;
  }

  const aValue = String(a[key] ?? '').toLowerCase();
  const bValue = String(b[key] ?? '').toLowerCase();
  return aValue.localeCompare(bValue);
}

function sortRows(rows, sortKey, direction) {
  const directionMultiplier = direction === 'asc' ? 1 : -1;
  const sorted = [...rows].sort((a, b) => compareValues(a, b, sortKey) * directionMultiplier);
  return sorted;
}

function updateSortIndicators() {
  sortButtons.forEach((button) => {
    const indicator = button.querySelector('.sort-indicator');
    if (!indicator) return;

    if (button.dataset.sortKey === currentSortKey) {
      indicator.textContent = currentSortDirection === 'asc' ? '▲' : '▼';
    } else {
      indicator.textContent = '↕';
    }
  });
}

function updateSummary(rows) {
  if (summaryCount) {
    summaryCount.textContent = String(rows.length);
  }

  const matchedCount = rows.filter((row) => row.match).length;
  const unmatchedCount = rows.length - matchedCount;

  if (unmatchedRowsStat && unmatchedRows) {
    unmatchedRows.textContent = String(unmatchedCount);
    unmatchedRowsStat.classList.toggle('hidden', unmatchedCount === 0);
  }

  if (!totalValue) return;

  const value = rows.reduce((sum, row) => {
    const market = Number(row.match?.marketPrice || 0);
    const quantity = Number(row.quantity || 0);
    return sum + (market * quantity);
  }, 0);

  totalValue.textContent = money(value);
}

function renderRows(rows, priceList) {
  resultsBody.innerHTML = '';
  currentRows = rows.map((row) => {
    const productId = Number(row.tcgplayer_id);
    const groupId = resolveGroupId(productId);
    const matches = priceList.filter((priceRow) => Number(priceRow.productId) === productId);
    const chosenMatch = matches[0] || null;
    return { ...row, groupId, match: chosenMatch };
  });

  const totalRows = currentRows.length;
  resultCount.textContent = `${totalRows} item${totalRows === 1 ? '' : 's'}`;
  updateSummary(currentRows);

  const sortedRows = sortRows(currentRows, currentSortKey, currentSortDirection);
  sortedRows.forEach((row) => {
    const productId = Number(row.tcgplayer_id);
    const chosenMatch = row.match;
    const productLink = `https://www.tcgplayer.com/product/${productId}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.name || '—'}</td>
      <td>${money(chosenMatch?.marketPrice)}</td>
      <td>${row.quantity || '0'}</td>
      <td><a href="${productLink}" target="_blank" rel="noreferrer">${productId || '—'}</a></td>
    `;

    const imageUrl = getImageUrl(row);
    if (imageUrl) {
      tr.setAttribute('data-image-url', imageUrl);
      tr.addEventListener('mouseenter', (event) => updateImagePreview(event, imageUrl));
      tr.addEventListener('mousemove', (event) => updateImagePreview(event, imageUrl));
      tr.addEventListener('mouseleave', hideImagePreview);
    }
    resultsBody.appendChild(tr);
  });

  updateSortIndicators();
}

async function processRows(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    const productId = Number(row.tcgplayer_id);
    if (!productId) return;
    const groupId = resolveGroupId(productId);
    const original = grouped.get(groupId) || [];
    original.push(row);
    grouped.set(groupId, original);
  });

  const allResults = [];
  for (const [groupId, groupRows] of grouped.entries()) {
    const priceList = await fetchPricesForGroup(groupId);
    groupRows.forEach((row) => {
      const productId = Number(row.tcgplayer_id);
      const match = priceList.find((priceRow) => Number(priceRow.productId) === productId);
      allResults.push({ ...row, groupId, match });
    });
  }

  renderRows(rows, allResults.map((entry) => entry.match).filter(Boolean));
  statusMessage.textContent = `${allResults.length} rows checked against TCGCSV JSON.`;
}

async function loadLocalCsv() {
  const response = await fetch('sld.csv');
  if (!response.ok) {
    throw new Error('Unable to read sld.csv from the site root.');
  }

  const csvText = await response.text();
  const rows = parseCsvContents(csvText);
  if (!rows.length) {
    statusMessage.textContent = 'No valid rows found in sld.csv.';
    return;
  }

  await processRows(rows);
}

sortButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const sortKey = button.dataset.sortKey;
    if (currentSortKey === sortKey) {
      currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortKey = sortKey;
      currentSortDirection = 'asc';
    }

    renderRows(currentRows, currentRows.map((row) => row.match).filter(Boolean));
  });
});

refreshButton.addEventListener('click', async () => {
  statusMessage.textContent = 'Loading CSV…';
  try {
    await loadLocalCsv();
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadLocalCsv();
  } catch (error) {
    statusMessage.textContent = error.message;
  }
});

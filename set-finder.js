/* ============================================================
   MTG SET FINDER
   ============================================================ */


/* ------------------------------------------------------------
   DOM
   ------------------------------------------------------------ */

const cardInput =
  document.getElementById("cardInput");

const analyzeButton =
  document.getElementById("analyzeButton");

const clearButton =
  document.getElementById("clearButton");

const finishPreference =
  document.getElementById("finishPreference");

const paperOnlyCheckbox =
  document.getElementById("paperOnly");

const excludeSecretLairCheckbox =
  document.getElementById("excludeSecretLair");

const excludePromosCheckbox =
  document.getElementById("excludePromos");

const excludeFunnyCheckbox =
  document.getElementById("excludeFunny");

const excludeMemorabiliaCheckbox =
  document.getElementById("excludeMemorabilia");

const excludeTokensCheckbox =
  document.getElementById("excludeTokens");

const excludeMinigamesCheckbox =
  document.getElementById("excludeMinigames");

const excludeBoxCheckbox =
  document.getElementById("excludeBox");

const excludeAlchemyCheckbox =
  document.getElementById("excludeAlchemy");

const excludeDigitalCheckbox =
  document.getElementById("excludeDigital");


const progressArea =
  document.getElementById("progressArea");

const progressBarFill =
  document.getElementById("progressBarFill");

const statusMessage =
  document.getElementById("statusMessage");


const resultsSection =
  document.getElementById("resultsSection");

const setResults =
  document.getElementById("setResults");


const cardCount =
  document.getElementById("cardCount");

const copyCount =
  document.getElementById("copyCount");

const setCount =
  document.getElementById("setCount");

const unmatchedCount =
  document.getElementById("unmatchedCount");


const bestSet =
  document.getElementById("bestSet");

const bestSetName =
  document.getElementById("bestSetName");

const bestSetStats =
  document.getElementById("bestSetStats");


const unmatchedArea =
  document.getElementById("unmatchedArea");

const unmatchedCardsList =
  document.getElementById("unmatchedCards");


const clearSetsButton =
  document.getElementById("clearSetsButton");

const selectedSetCount =
  document.getElementById("selectedSetCount");

const coveredCardCount =
  document.getElementById("coveredCardCount");

const remainingCardCount =
  document.getElementById("remainingCardCount");

const selectedSetsCost =
  document.getElementById("selectedSetsCost");

const coverageBarFill =
  document.getElementById("coverageBarFill");

const coveragePercent =
  document.getElementById("coveragePercent");

const selectedSetsList =
  document.getElementById("selectedSetsList");

const remainingCardsList =
  document.getElementById("remainingCardsList");

const remainingRecommendation =
  document.getElementById("remainingRecommendation");


const optimizeFewestButton =
  document.getElementById("optimizeFewestButton");

const optimizeCostButton =
  document.getElementById("optimizeCostButton");

const optimizeValueButton =
  document.getElementById("optimizeValueButton");


const assignmentSetSummary =
  document.getElementById("assignmentSetSummary");

const assignmentTableBody =
  document.getElementById("assignmentTableBody");

const exportCsvButton =
  document.getElementById("exportCsvButton");

const exportTextButton =
  document.getElementById("exportTextButton");


const setFilter =
  document.getElementById("setFilter");

const setTypeFilter =
  document.getElementById("setTypeFilter");

const minimumCoverage =
  document.getElementById("minimumCoverage");

const selectedOnlyFilter =
  document.getElementById("selectedOnlyFilter");

const visibleSetCount =
  document.getElementById("visibleSetCount");


const refreshBulkButton =
  document.getElementById("refreshBulkButton");

const deleteBulkButton =
  document.getElementById("deleteBulkButton");

const bulkStatus =
  document.getElementById("bulkStatus");

const bulkProgressArea =
  document.getElementById("bulkProgressArea");

const bulkProgressMessage =
  document.getElementById("bulkProgressMessage");

const bulkProgressBar =
  document.getElementById("bulkProgressBar");


const imagePreview =
  document.getElementById("setFinderImagePreview");

const previewImage =
  document.getElementById("setFinderPreviewImage");


/* ------------------------------------------------------------
   Constants
   ------------------------------------------------------------ */

const DB_NAME =
  "mtg-set-finder";

const DB_VERSION =
  3;

const CARD_STORE =
  "cards";

const META_STORE =
  "meta";

const CACHE_META_KEY =
  "activeBulkCache";

const STATE_KEY =
  "mtg-set-finder-state-v3";

const EXPENSIVE_THRESHOLD =
  25;

const API_DELAY_MS =
  550;

const BULK_BATCH_SIZE =
  750;


/* ------------------------------------------------------------
   Runtime state
   ------------------------------------------------------------ */

let dbPromise = null;

let isRunning = false;
let isImportingBulk = false;

let currentDeck = [];
let currentCardNames = [];
let currentQuantityMap =
  new Map();

let currentRankedSets = [];
let currentUnmatchedCards = [];

const selectedSetCodes =
  new Set();

let selectedSetOrder = [];

/*
 * card name -> manually selected set code
 */
const manualAssignments =
  new Map();

/*
 * Sort state for ranking table.
 */
let rankingSort = {
  key: "count",
  direction: "desc"
};


/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    restoreSavedState();
    installEventHandlers();
    installImagePreviewHandlers();
    await updateBulkStatus();
  }
);


/* ============================================================
   EVENT HANDLERS
   ============================================================ */

function installEventHandlers() {
  analyzeButton.addEventListener(
    "click",
    analyzeCards
  );

  clearButton.addEventListener(
    "click",
    clearDeck
  );

  clearSetsButton.addEventListener(
    "click",
    clearSelectedSets
  );

  refreshBulkButton.addEventListener(
    "click",
    () => refreshBulkDatabase()
  );

  deleteBulkButton.addEventListener(
    "click",
    deleteBulkDatabase
  );

  optimizeFewestButton.addEventListener(
    "click",
    optimizeFewestSets
  );

  optimizeCostButton.addEventListener(
    "click",
    optimizeLowestCardCost
  );

  optimizeValueButton.addEventListener(
    "click",
    optimizeBestValue
  );

  exportCsvButton.addEventListener(
    "click",
    exportCsv
  );

  exportTextButton.addEventListener(
    "click",
    exportText
  );


  /*
   * Ranking filters.
   */
  setFilter.addEventListener(
    "input",
    renderSetTable
  );

  setTypeFilter.addEventListener(
    "change",
    renderSetTable
  );

  minimumCoverage.addEventListener(
    "input",
    renderSetTable
  );

  selectedOnlyFilter.addEventListener(
    "change",
    renderSetTable
  );


  /*
   * Sortable headers.
   */
  document
    .querySelectorAll(
      ".sortable-header"
    )
    .forEach(header => {
      header.addEventListener(
        "click",
        () => {
          const key =
            header.dataset.sort;

          if (
            rankingSort.key === key
          ) {
            rankingSort.direction =
              rankingSort.direction ===
              "asc"
                ? "desc"
                : "asc";
          } else {
            rankingSort.key =
              key;

            rankingSort.direction =
              defaultSortDirection(
                key
              );
          }

          renderSetTable();
        }
      );
    });


  /*
   * Persist deck text.
   */
  cardInput.addEventListener(
    "input",
    debounce(
      saveState,
      250
    )
  );


  /*
   * Settings that affect analysis.
   */
  [
    finishPreference,
    paperOnlyCheckbox,
    excludeSecretLairCheckbox,
    excludePromosCheckbox,
    excludeFunnyCheckbox,
    excludeMemorabiliaCheckbox,
    excludeTokensCheckbox,
    excludeMinigamesCheckbox,
    excludeBoxCheckbox,
    excludeAlchemyCheckbox,
    excludeDigitalCheckbox
  ].forEach(control => {
    control.addEventListener(
      "change",
      saveState
    );
  });
}


/* ============================================================
   SAVED STATE
   ============================================================ */

function saveState() {
  const data = {
    deckText:
      cardInput.value,

    finishPreference:
      finishPreference.value,

    filters: {
      paperOnly:
        paperOnlyCheckbox.checked,

      excludeSecretLair:
        excludeSecretLairCheckbox.checked,

      excludePromos:
        excludePromosCheckbox.checked,

      excludeFunny:
        excludeFunnyCheckbox.checked,

      excludeMemorabilia:
        excludeMemorabiliaCheckbox.checked,

      excludeTokens:
        excludeTokensCheckbox.checked,

      excludeMinigames:
        excludeMinigamesCheckbox.checked,

      excludeBox:
        excludeBoxCheckbox.checked,

      excludeAlchemy:
        excludeAlchemyCheckbox.checked,

      excludeDigital:
        excludeDigitalCheckbox.checked
    },

    selectedSetOrder:
      [...selectedSetOrder],

    manualAssignments:
      Object.fromEntries(
        manualAssignments.entries()
      )
  };

  try {
    localStorage.setItem(
      STATE_KEY,
      JSON.stringify(data)
    );
  } catch (error) {
    console.warn(
      "Unable to save app state.",
      error
    );
  }
}


function restoreSavedState() {
  let data = null;

  try {
    const raw =
      localStorage.getItem(
        STATE_KEY
      );

    if (raw) {
      data =
        JSON.parse(raw);
    }
  } catch (error) {
    console.warn(
      "Unable to restore app state.",
      error
    );
  }

  if (!data) {
    return;
  }

  if (
    typeof data.deckText ===
    "string"
  ) {
    cardInput.value =
      data.deckText;
  }

  if (
    data.finishPreference
  ) {
    finishPreference.value =
      data.finishPreference;
  }

  const filters =
    data.filters || {};

  setCheckboxIfDefined(
    paperOnlyCheckbox,
    filters.paperOnly
  );

  setCheckboxIfDefined(
    excludeSecretLairCheckbox,
    filters.excludeSecretLair
  );

  setCheckboxIfDefined(
    excludePromosCheckbox,
    filters.excludePromos
  );

  setCheckboxIfDefined(
    excludeFunnyCheckbox,
    filters.excludeFunny
  );

  setCheckboxIfDefined(
    excludeMemorabiliaCheckbox,
    filters.excludeMemorabilia
  );

  setCheckboxIfDefined(
    excludeTokensCheckbox,
    filters.excludeTokens
  );

  setCheckboxIfDefined(
    excludeMinigamesCheckbox,
    filters.excludeMinigames
  );

  setCheckboxIfDefined(
    excludeBoxCheckbox,
    filters.excludeBox
  );

  setCheckboxIfDefined(
    excludeAlchemyCheckbox,
    filters.excludeAlchemy
  );

  setCheckboxIfDefined(
    excludeDigitalCheckbox,
    filters.excludeDigital
  );

  /*
   * We store these now and restore them
   * after deck analysis confirms the sets
   * actually exist in the current data.
   */
  if (
    Array.isArray(
      data.selectedSetOrder
    )
  ) {
    selectedSetOrder =
      [...data.selectedSetOrder];
  }

  selectedSetCodes.clear();

  for (
    const setCode
    of selectedSetOrder
  ) {
    selectedSetCodes.add(
      setCode
    );
  }

  manualAssignments.clear();

  if (
    data.manualAssignments
  ) {
    for (
      const [name, code]
      of Object.entries(
        data.manualAssignments
      )
    ) {
      manualAssignments.set(
        name,
        code
      );
    }
  }
}


function setCheckboxIfDefined(
  element,
  value
) {
  if (
    typeof value ===
    "boolean"
  ) {
    element.checked =
      value;
  }
}


/* ============================================================
   INDEXEDDB
   ============================================================ */

function openDatabase() {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise =
    new Promise(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            DB_NAME,
            DB_VERSION
          );

        request.onerror =
          () => {
            reject(
              request.error
            );
          };

        request.onupgradeneeded =
          event => {
            const db =
              event.target.result;

            /*
             * Recreate cards store when
             * upgrading from an older schema.
             */
            if (
              db.objectStoreNames.contains(
                CARD_STORE
              )
            ) {
              db.deleteObjectStore(
                CARD_STORE
              );
            }

            const cardStore =
              db.createObjectStore(
                CARD_STORE,
                {
                  keyPath: "key"
                }
              );

            cardStore.createIndex(
              "cacheName",
              [
                "cacheId",
                "nameNorm"
              ],
              {
                unique: false
              }
            );

            cardStore.createIndex(
              "cacheId",
              "cacheId",
              {
                unique: false
              }
            );

            if (
              !db.objectStoreNames.contains(
                META_STORE
              )
            ) {
              db.createObjectStore(
                META_STORE,
                {
                  keyPath: "key"
                }
              );
            }
          };

        request.onsuccess =
          () => {
            resolve(
              request.result
            );
          };
      }
    );

  return dbPromise;
}


async function idbGetMeta(
  key
) {
  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const tx =
        db.transaction(
          META_STORE,
          "readonly"
        );

      const request =
        tx
          .objectStore(
            META_STORE
          )
          .get(key);

      request.onsuccess =
        () => {
          resolve(
            request.result ||
            null
          );
        };

      request.onerror =
        () => {
          reject(
            request.error
          );
        };
    }
  );
}


async function idbPutMeta(
  value
) {
  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const tx =
        db.transaction(
          META_STORE,
          "readwrite"
        );

      tx.objectStore(
        META_STORE
      ).put(value);

      tx.oncomplete =
        () => resolve();

      tx.onerror =
        () =>
          reject(tx.error);
    }
  );
}


async function putCardBatch(
  cards
) {
  if (
    cards.length === 0
  ) {
    return;
  }

  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const tx =
        db.transaction(
          CARD_STORE,
          "readwrite"
        );

      const store =
        tx.objectStore(
          CARD_STORE
        );

      for (
        const card
        of cards
      ) {
        store.put(card);
      }

      tx.oncomplete =
        () => resolve();

      tx.onerror =
        () =>
          reject(tx.error);
    }
  );
}


async function getCardsByName(
  cacheId,
  cardName
) {
  const db =
    await openDatabase();

  const normalized =
    normalizeCardName(
      cardName
    );

  return new Promise(
    (resolve, reject) => {
      const tx =
        db.transaction(
          CARD_STORE,
          "readonly"
        );

      const index =
        tx
          .objectStore(
            CARD_STORE
          )
          .index(
            "cacheName"
          );

      const range =
        IDBKeyRange.only([
          cacheId,
          normalized
        ]);

      const request =
        index.getAll(
          range
        );

      request.onsuccess =
        () =>
          resolve(
            request.result ||
            []
          );

      request.onerror =
        () =>
          reject(
            request.error
          );
    }
  );
}


async function deleteCacheRecords(
  cacheId
) {
  if (!cacheId) {
    return;
  }

  const db =
    await openDatabase();

  return new Promise(
    (resolve, reject) => {
      const tx =
        db.transaction(
          CARD_STORE,
          "readwrite"
        );

      const store =
        tx.objectStore(
          CARD_STORE
        );

      const index =
        store.index(
          "cacheId"
        );

      const request =
        index.openKeyCursor(
          IDBKeyRange.only(
            cacheId
          )
        );

      request.onsuccess =
        event => {
          const cursor =
            event.target.result;

          if (!cursor) {
            return;
          }

          store.delete(
            cursor.primaryKey
          );

          cursor.continue();
        };

      tx.oncomplete =
        () => resolve();

      tx.onerror =
        () =>
          reject(tx.error);
    }
  );
}


async function clearIndexedDb() {
  if (dbPromise) {
    const db =
      await dbPromise;

    db.close();
  }

  dbPromise = null;

  return new Promise(
    (resolve, reject) => {
      const request =
        indexedDB.deleteDatabase(
          DB_NAME
        );

      request.onsuccess =
        () => resolve();

      request.onerror =
        () =>
          reject(
            request.error
          );

      request.onblocked =
        () => {
          reject(
            new Error(
              "Database deletion is blocked by another open tab."
            )
          );
        };
    }
  );
}


/* ============================================================
   BULK DATA
   ============================================================ */

async function updateBulkStatus() {
  try {
    const meta =
      await idbGetMeta(
        CACHE_META_KEY
      );

    if (!meta) {
      bulkStatus.innerHTML =
        "<strong>No local database.</strong> Download Scryfall data before analyzing.";
      return;
    }

    const ageMs =
      Date.now() -
      new Date(
        meta.importedAt
      ).getTime();

    const ageHours =
      ageMs /
      (
        1000 *
        60 *
        60
      );

    const freshness =
      ageHours <= 24
        ? "Fresh"
        : "Cached";

    bulkStatus.innerHTML =
      `<strong>${freshness}</strong> · ` +
      `${formatNumber(meta.cardCount || 0)} printings · ` +
      `Scryfall update ${escapeHtml(meta.updatedAt || "unknown")} · ` +
      `imported ${formatDateTime(meta.importedAt)}`;
  } catch (error) {
    console.error(error);

    bulkStatus.textContent =
      "Unable to inspect the local Scryfall database.";
  }
}


async function ensureBulkDatabase() {
  const meta =
    await idbGetMeta(
      CACHE_META_KEY
    );

  if (meta?.cacheId) {
    return meta;
  }

  await refreshBulkDatabase();

  const refreshed =
    await idbGetMeta(
      CACHE_META_KEY
    );

  if (!refreshed) {
    throw new Error(
      "The local Scryfall database could not be created."
    );
  }

  return refreshed;
}


async function refreshBulkDatabase() {
  if (
    isImportingBulk
  ) {
    return;
  }

  if (
    typeof DecompressionStream ===
    "undefined"
  ) {
    alert(
      "This browser does not support streaming gzip decompression. Use a current version of Chrome, Edge, Firefox, or Safari."
    );

    return;
  }

  isImportingBulk = true;

  refreshBulkButton.disabled =
    true;

  deleteBulkButton.disabled =
    true;

  analyzeButton.disabled =
    true;

  bulkProgressArea.classList.remove(
    "hidden"
  );

  bulkProgressBar.style.width =
    "0%";

  bulkProgressMessage.textContent =
    "Requesting Scryfall bulk-data information…";

  try {
    const oldMeta =
      await idbGetMeta(
        CACHE_META_KEY
      );

    /*
     * Scryfall supports looking up a
     * bulk_data object by type.
     */
    const metaResponse =
      await fetch(
        "https://api.scryfall.com/bulk-data/default_cards"
      );

    if (!metaResponse.ok) {
      throw new Error(
        `Unable to retrieve Scryfall bulk metadata (${metaResponse.status}).`
      );
    }

    const bulkMeta =
      await metaResponse.json();

    const downloadUri =
      bulkMeta.jsonl_download_uri ||
      bulkMeta.download_uri;

    if (!downloadUri) {
      throw new Error(
        "Scryfall did not return a bulk download URI."
      );
    }

    const cacheId =
      [
        bulkMeta.id,
        bulkMeta.updated_at
      ]
        .filter(Boolean)
        .join("|");

    /*
     * If already current, don't download again.
     */
    if (
      oldMeta?.cacheId ===
      cacheId
    ) {
      bulkProgressMessage.textContent =
        "Your local database is already current.";

      bulkProgressBar.style.width =
        "100%";

      await updateBulkStatus();

      return;
    }

    bulkProgressMessage.textContent =
      "Downloading Scryfall bulk data…";

    const response =
      await fetch(
        downloadUri
      );

    if (!response.ok) {
      throw new Error(
        `Bulk download failed (${response.status}).`
      );
    }

    if (!response.body) {
      throw new Error(
        "Streaming downloads are not supported by this browser."
      );
    }

    const compressedSize =
      Number(
        bulkMeta.compressed_size ||
        0
      );

    const contentLength =
      Number(
        response.headers.get(
          "content-length"
        ) ||
        compressedSize ||
        0
      );

    /*
     * Track compressed download bytes while
     * passing chunks into the decompressor.
     */
    let downloadedBytes = 0;

    const progressStream =
      new TransformStream({
        transform(
          chunk,
          controller
        ) {
          downloadedBytes +=
            chunk.byteLength;

          if (
            contentLength > 0
          ) {
            /*
             * Reserve last 20% of the bar
             * for parsing/indexing.
             */
            const percent =
              Math.min(
                80,
                (
                  downloadedBytes /
                  contentLength
                ) *
                  80
              );

            bulkProgressBar.style.width =
              `${percent.toFixed(1)}%`;
          }

          controller.enqueue(
            chunk
          );
        }
      });

    const decompressed =
      response.body
        .pipeThrough(
          progressStream
        )
        .pipeThrough(
          new DecompressionStream(
            "gzip"
          )
        );

    const reader =
      decompressed.getReader();

    const decoder =
      new TextDecoder();

    let textBuffer = "";
    let batch = [];

    let importedCards = 0;
    let parsedLines = 0;

    while (true) {
      const {
        done,
        value
      } =
        await reader.read();

      if (done) {
        break;
      }

      textBuffer +=
        decoder.decode(
          value,
          {
            stream: true
          }
        );

      let newlineIndex;

      while (
        (
          newlineIndex =
            textBuffer.indexOf(
              "\n"
            )
        ) !== -1
      ) {
        const line =
          textBuffer
            .slice(
              0,
              newlineIndex
            )
            .trim();

        textBuffer =
          textBuffer.slice(
            newlineIndex + 1
          );

        if (!line) {
          continue;
        }

        parsedLines++;

        let card;

        try {
          card =
            JSON.parse(
              line
            );
        } catch (error) {
          console.warn(
            "Skipping malformed bulk-data line.",
            error
          );

          continue;
        }

        const compact =
          compactBulkCard(
            card,
            cacheId
          );

        if (!compact) {
          continue;
        }

        batch.push(
          compact
        );

        if (
          batch.length >=
          BULK_BATCH_SIZE
        ) {
          await putCardBatch(
            batch
          );

          importedCards +=
            batch.length;

          batch = [];

          /*
           * Parsing progress cannot be known
           * exactly from compressed byte size,
           * so pulse through 80–98%.
           */
          const pulse =
            80 +
            (
              (
                importedCards /
                5000
              ) %
              18
            );

          bulkProgressBar.style.width =
            `${Math.min(
              98,
              pulse
            )}%`;

          bulkProgressMessage.textContent =
            `Indexing ${formatNumber(importedCards)} printings…`;
        }
      }
    }

    textBuffer +=
      decoder.decode();

    const finalLine =
      textBuffer.trim();

    if (finalLine) {
      try {
        const card =
          JSON.parse(
            finalLine
          );

        const compact =
          compactBulkCard(
            card,
            cacheId
          );

        if (compact) {
          batch.push(
            compact
          );
        }
      } catch (error) {
        console.warn(
          "Unable to parse final bulk-data line.",
          error
        );
      }
    }

    if (
      batch.length > 0
    ) {
      await putCardBatch(
        batch
      );

      importedCards +=
        batch.length;
    }

    const newMeta = {
      key:
        CACHE_META_KEY,

      cacheId,

      bulkId:
        bulkMeta.id,

      updatedAt:
        bulkMeta.updated_at,

      importedAt:
        new Date().toISOString(),

      cardCount:
        importedCards,

      downloadUri
    };

    /*
     * Only switch active cache after the
     * entire import completed successfully.
     */
    await idbPutMeta(
      newMeta
    );

    bulkProgressBar.style.width =
      "100%";

    bulkProgressMessage.textContent =
      `Finished indexing ${formatNumber(importedCards)} printings.`;

    /*
     * Remove old cache after new one is active.
     */
    if (
      oldMeta?.cacheId &&
      oldMeta.cacheId !==
        cacheId
    ) {
      deleteCacheRecords(
        oldMeta.cacheId
      ).catch(
        error =>
          console.warn(
            "Unable to clean up old cache.",
            error
          )
      );
    }

    await updateBulkStatus();
  } catch (error) {
    console.error(error);

    bulkProgressMessage.textContent =
      `Bulk-data import failed: ${error.message}`;

    alert(
      `Scryfall database import failed.\n\n${error.message}`
    );
  } finally {
    isImportingBulk = false;

    refreshBulkButton.disabled =
      false;

    deleteBulkButton.disabled =
      false;

    analyzeButton.disabled =
      false;
  }
}


function compactBulkCard(
  card,
  cacheId
) {
  if (
    !card ||
    !card.id ||
    !card.name ||
    !card.set
  ) {
    return null;
  }

  const image =
    getImageUris(
      card
    );

  return {
    key:
      `${cacheId}:${card.id}`,

    cacheId,

    id:
      card.id,

    name:
      card.name,

    nameNorm:
      normalizeCardName(
        card.name
      ),

    set:
      card.set,

    setName:
      card.set_name ||
      card.set,

    setType:
      card.set_type ||
      "",

    games:
      Array.isArray(
        card.games
      )
        ? card.games
        : [],

    digital:
      Boolean(
        card.digital
      ),

    promo:
      Boolean(
        card.promo
      ),

    prices: {
      usd:
        card.prices?.usd ??
        null,

      usdFoil:
        card.prices?.usd_foil ??
        null,

      usdEtched:
        card.prices?.usd_etched ??
        null
    },

    finishes:
      card.finishes || [],

    collectorNumber:
      card.collector_number ||
      "",

    rarity:
      card.rarity ||
      "",

    releasedAt:
      card.released_at ||
      "",

    scryfallUri:
      card.scryfall_uri ||
      "",

    imageSmall:
      image.small ||
      image.thumb ||
      "",

    imageNormal:
      image.normal ||
      image.grid ||
      image.small ||
      image.thumb ||
      ""
  };
}


function getImageUris(
  card
) {
  if (
    card.image_uris
  ) {
    return card.image_uris;
  }

  if (
    Array.isArray(
      card.card_faces
    )
  ) {
    for (
      const face
      of card.card_faces
    ) {
      if (
        face.image_uris
      ) {
        return face.image_uris;
      }
    }
  }

  return {};
}


async function deleteBulkDatabase() {
  if (
    !confirm(
      "Delete the locally cached Scryfall database? Your saved deck text will remain."
    )
  ) {
    return;
  }

  try {
    await clearIndexedDb();

    bulkProgressArea.classList.add(
      "hidden"
    );

    bulkStatus.innerHTML =
      "<strong>No local database.</strong> Download Scryfall data before analyzing.";
  } catch (error) {
    alert(
      `Unable to delete the local database: ${error.message}`
    );
  }
}


/* ============================================================
   DECK PARSING
   ============================================================ */

function parseManaBoxList(
  text
) {
  const quantities =
    new Map();

  const lines =
    text
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);

  for (
    let line
    of lines
  ) {
    if (
      isSectionHeading(
        line
      )
    ) {
      continue;
    }

    let quantity = 1;

    const quantityMatch =
      line.match(
        /^(\d+)\s*x?\s+/i
      );

    if (
      quantityMatch
    ) {
      quantity =
        Number(
          quantityMatch[1]
        ) || 1;

      line =
        line.slice(
          quantityMatch[0]
            .length
        );
    }

    /*
     * Remove set + collector notation:
     *
     * Sol Ring (CMM) 396
     */
    line =
      line.replace(
        /\s+\([A-Za-z0-9]+\)\s+[A-Za-z0-9★]+(?:\s+.*)?$/,
        ""
      );

    /*
     * Remove ManaBox foil markers.
     */
    line =
      line.replace(
        /\s+\*(?:F|E)\*$/i,
        ""
      );

    line =
      line.trim();

    if (!line) {
      continue;
    }

    const existing =
      quantities.get(
        line
      ) || 0;

    quantities.set(
      line,
      existing +
        quantity
    );
  }

  return [
    ...quantities.entries()
  ].map(
    ([name, quantity]) => ({
      name,
      quantity
    })
  );
}


function isSectionHeading(
  line
) {
  const normalized =
    line
      .toLowerCase()
      .replace(/:$/, "")
      .trim();

  const headings =
    new Set([
      "commander",
      "commanders",
      "mainboard",
      "main board",
      "sideboard",
      "side board",
      "maybeboard",
      "maybe board",
      "considering",
      "companion",
      "deck"
    ]);

  return headings.has(
    normalized
  );
}


function normalizeCardName(
  value
) {
  return String(
    value || ""
  )
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}


/* ============================================================
   ANALYSIS
   ============================================================ */

async function analyzeCards() {
  if (
    isRunning ||
    isImportingBulk
  ) {
    return;
  }

  const deck =
    parseManaBoxList(
      cardInput.value
    );

  if (
    deck.length === 0
  ) {
    alert(
      "No card names were found."
    );

    return;
  }

  isRunning = true;

  analyzeButton.disabled =
    true;

  clearButton.disabled =
    true;

  analyzeButton.textContent =
    "Analyzing…";

  progressArea.classList.remove(
    "hidden"
  );

  progressBarFill.style.width =
    "0%";

  try {
    const cacheMeta =
      await ensureBulkDatabase();

    currentDeck =
      deck;

    currentCardNames =
      deck.map(
        item =>
          item.name
      );

    currentQuantityMap =
      new Map(
        deck.map(
          item => [
            item.name,
            item.quantity
          ]
        )
      );

    currentUnmatchedCards =
      [];

    currentRankedSets =
      [];

    const sets =
      new Map();

    for (
      let index = 0;
      index < deck.length;
      index++
    ) {
      const entry =
        deck[index];

      statusMessage.textContent =
        `Reading ${index + 1} of ${deck.length}: ${entry.name}`;

      progressBarFill.style.width =
        `${
          (
            index /
            deck.length
          ) *
          100
        }%`;

      const printings =
        await getCardsByName(
          cacheMeta.cacheId,
          entry.name
        );

      if (
        printings.length === 0
      ) {
        currentUnmatchedCards.push(
          entry.name
        );

        continue;
      }

      addPrintingsToSets(
        sets,
        entry.name,
        printings
      );

      /*
       * Yield periodically so UI stays responsive.
       */
      if (
        index % 20 === 0
      ) {
        await sleep(0);
      }
    }

    currentRankedSets =
      rankSets(
        sets,
        deck.length
      );

    /*
     * Remove selections that no longer exist.
     */
    selectedSetOrder =
      selectedSetOrder.filter(
        code =>
          currentRankedSets.some(
            set =>
              set.code ===
              code
          )
      );

    selectedSetCodes.clear();

    for (
      const code
      of selectedSetOrder
    ) {
      selectedSetCodes.add(
        code
      );
    }

    /*
     * Remove invalid manual assignments.
     */
    for (
      const [cardName, code]
      of manualAssignments
    ) {
      const set =
        getSetByCode(
          code
        );

      if (
        !set ||
        !set.cards.some(
          card =>
            card.name ===
            cardName
        )
      ) {
        manualAssignments.delete(
          cardName
        );
      }
    }

    populateSetTypeFilter();

    renderResults();

    progressBarFill.style.width =
      "100%";

    statusMessage.textContent =
      "Analysis complete.";

    resultsSection.classList.remove(
      "hidden"
    );

    saveState();
  } catch (error) {
    console.error(error);

    statusMessage.textContent =
      `Analysis failed: ${error.message}`;

    alert(
      `Unable to analyze the deck.\n\n${error.message}`
    );
  } finally {
    isRunning = false;

    analyzeButton.disabled =
      false;

    clearButton.disabled =
      false;

    analyzeButton.textContent =
      "Analyze Deck";
  }
}


/* ============================================================
   PRINTING FILTERS / PRICES
   ============================================================ */

function printingAllowed(
  printing
) {
  if (
    paperOnlyCheckbox.checked &&
    !printing.games?.includes(
      "paper"
    )
  ) {
    return false;
  }

  if (
    excludeDigitalCheckbox.checked &&
    printing.digital
  ) {
    return false;
  }

  if (
    excludeSecretLairCheckbox.checked &&
    isSecretLairPrinting(
      printing
    )
  ) {
    return false;
  }

  if (
    excludePromosCheckbox.checked &&
    printing.promo
  ) {
    return false;
  }

  const type =
    printing.setType;

  if (
    excludeFunnyCheckbox.checked &&
    type === "funny"
  ) {
    return false;
  }

  if (
    excludeMemorabiliaCheckbox.checked &&
    type ===
      "memorabilia"
  ) {
    return false;
  }

  if (
    excludeTokensCheckbox.checked &&
    type === "token"
  ) {
    return false;
  }

  if (
    excludeMinigamesCheckbox.checked &&
    type === "minigame"
  ) {
    return false;
  }

  if (
    excludeBoxCheckbox.checked &&
    type === "box"
  ) {
    return false;
  }

  if (
    excludeAlchemyCheckbox.checked &&
    type === "alchemy"
  ) {
    return false;
  }

  return true;
}


function isSecretLairPrinting(
  printing
) {
  const code =
    String(
      printing.set || ""
    ).toLowerCase();

  const name =
    String(
      printing.setName || ""
    ).toLowerCase();

  return (
    code === "sld" ||
    name.includes(
      "secret lair"
    )
  );
}


function parsePrice(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number.parseFloat(
      value
    );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function getPreferredPrice(
  printing
) {
  const normal =
    parsePrice(
      printing.prices?.usd
    );

  const foil =
    parsePrice(
      printing.prices?.usdFoil
    );

  const etched =
    parsePrice(
      printing.prices?.usdEtched
    );

  const preference =
    finishPreference.value;

  const available =
    [];

  if (
    normal !== null
  ) {
    available.push({
      price:
        normal,

      finish:
        "normal"
    });
  }

  if (
    foil !== null
  ) {
    available.push({
      price:
        foil,

      finish:
        "foil"
    });
  }

  if (
    etched !== null
  ) {
    available.push({
      price:
        etched,

      finish:
        "etched"
    });
  }

  if (
    available.length ===
    0
  ) {
    return null;
  }

  if (
    preference ===
    "cheapest"
  ) {
    return available.sort(
      (a, b) =>
        a.price -
        b.price
    )[0];
  }

  const preferred =
    available.find(
      item =>
        item.finish ===
        preference
    );

  if (preferred) {
    return preferred;
  }

  /*
   * Preference unavailable:
   * use cheapest remaining finish.
   */
  return available.sort(
    (a, b) =>
      a.price -
      b.price
  )[0];
}


/* ============================================================
   BUILD SET DATA
   ============================================================ */

function addPrintingsToSets(
  sets,
  cardName,
  printings
) {
  const bestPerSet =
    new Map();

  for (
    const printing
    of printings
  ) {
    if (
      !printingAllowed(
        printing
      )
    ) {
      continue;
    }

    const priceInfo =
      getPreferredPrice(
        printing
      );

    const existing =
      bestPerSet.get(
        printing.set
      );

    if (!existing) {
      bestPerSet.set(
        printing.set,
        {
          printing,
          priceInfo
        }
      );

      continue;
    }

    /*
     * Prefer priced records.
     */
    if (
      !existing.priceInfo &&
      priceInfo
    ) {
      bestPerSet.set(
        printing.set,
        {
          printing,
          priceInfo
        }
      );

      continue;
    }

    /*
     * Same set with multiple collector variants:
     * keep cheapest matching preferred finish.
     */
    if (
      existing.priceInfo &&
      priceInfo &&
      priceInfo.price <
        existing.priceInfo.price
    ) {
      bestPerSet.set(
        printing.set,
        {
          printing,
          priceInfo
        }
      );
    }
  }

  for (
    const [
      setCode,
      result
    ]
    of bestPerSet
  ) {
    const printing =
      result.printing;

    const priceInfo =
      result.priceInfo;

    if (
      !sets.has(
        setCode
      )
    ) {
      sets.set(
        setCode,
        {
          code:
            setCode,

          name:
            printing.setName,

          setType:
            printing.setType,

          cards:
            new Map()
        }
      );
    }

    sets
      .get(
        setCode
      )
      .cards
      .set(
        cardName,
        {
          name:
            cardName,

          quantity:
            currentQuantityMap.get(
              cardName
            ) || 1,

          price:
            priceInfo?.price ??
            null,

          finish:
            priceInfo?.finish ??
            null,

          collectorNumber:
            printing.collectorNumber,

          rarity:
            printing.rarity,

          scryfallUri:
            printing.scryfallUri,

          imageSmall:
            printing.imageSmall,

          imageNormal:
            printing.imageNormal,

          printingId:
            printing.id
        }
      );
  }
}


function rankSets(
  sets,
  totalUniqueCards
) {
  return [
    ...sets.values()
  ]
    .map(
      set => {
        const cards =
          [
            ...set.cards.values()
          ].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name
              )
          );

        const priced =
          cards.filter(
            card =>
              card.price !==
              null
          );

        const totalCost =
          priced.reduce(
            (sum, card) =>
              sum +
              (
                card.price *
                card.quantity
              ),
            0
          );

        const expensiveCards =
          priced
            .filter(
              card =>
                card.price >=
                EXPENSIVE_THRESHOLD
            )
            .sort(
              (a, b) =>
                b.price -
                a.price
            );

        return {
          code:
            set.code,

          name:
            set.name,

          setType:
            set.setType,

          cards,

          count:
            cards.length,

          totalCost,

          pricedCount:
            priced.length,

          missingPriceCount:
            cards.length -
            priced.length,

          expensiveCards,

          coverage:
            totalUniqueCards === 0
              ? 0
              : cards.length /
                totalUniqueCards
        };
      }
    )
    .sort(
      (a, b) => {
        if (
          b.count !==
          a.count
        ) {
          return (
            b.count -
            a.count
          );
        }

        return (
          a.totalCost -
          b.totalCost
        );
      }
    )
    .map(
      (set, index) => ({
        ...set,
        rank:
          index + 1
      })
    );
}


/* ============================================================
   RESULTS
   ============================================================ */

function renderResults() {
  cardCount.textContent =
    currentDeck.length;

  copyCount.textContent =
    currentDeck.reduce(
      (sum, entry) =>
        sum +
        entry.quantity,
      0
    );

  setCount.textContent =
    currentRankedSets.length;

  unmatchedCount.textContent =
    currentUnmatchedCards.length;

  renderBestSet();

  renderSetTable();

  renderUnmatchedCards();

  updateDeckBuilder();
}


function renderBestSet() {
  if (
    currentRankedSets.length ===
    0
  ) {
    bestSet.classList.add(
      "hidden"
    );

    return;
  }

  const set =
    currentRankedSets[0];

  bestSetName.textContent =
    `${set.name} (${set.code.toUpperCase()})`;

  bestSetStats.innerHTML =
    "";

  const coverage =
    document.createElement(
      "div"
    );

  coverage.textContent =
    `${set.count} of ${currentDeck.length} unique cards · ${(set.coverage * 100).toFixed(1)}% coverage`;

  const cost =
    document.createElement(
      "div"
    );

  cost.textContent =
    `Estimated assigned value if sourced from this set: ${formatCurrency(set.totalCost)}`;

  bestSetStats.append(
    coverage,
    cost
  );

  if (
    set.expensiveCards.length >
    0
  ) {
    const heading =
      document.createElement(
        "strong"
      );

    heading.textContent =
      " Expensive printings:";

    const list =
      document.createElement(
        "ul"
      );

    for (
      const card
      of set.expensiveCards
        .slice(0, 5)
    ) {
      const li =
        document.createElement(
          "li"
        );

      li.textContent =
        `${card.name} — ${formatCurrency(card.price)}`;

      list.appendChild(
        li
      );
    }

    bestSetStats.append(
      heading,
      list
    );
  }

  bestSet.classList.remove(
    "hidden"
  );
}


/* ============================================================
   SET TABLE FILTER / SORT
   ============================================================ */

function populateSetTypeFilter() {
  const previous =
    setTypeFilter.value;

  const types =
    [
      ...new Set(
        currentRankedSets
          .map(
            set =>
              set.setType
          )
          .filter(Boolean)
      )
    ].sort();

  setTypeFilter.innerHTML =
    '<option value="">All set types</option>';

  for (
    const type
    of types
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      type;

    option.textContent =
      prettifySetType(
        type
      );

    setTypeFilter.appendChild(
      option
    );
  }

  if (
    types.includes(
      previous
    )
  ) {
    setTypeFilter.value =
      previous;
  }
}


function getVisibleSets() {
  const search =
    setFilter.value
      .trim()
      .toLowerCase();

  const type =
    setTypeFilter.value;

  const minCoverage =
    Number(
      minimumCoverage.value ||
      0
    );

  const coverageResult =
    calculateSelectedCoverage();

  const covered =
    coverageResult.coveredCards;

  let sets =
    currentRankedSets.map(
      set => ({
        ...set,

        newCards:
          selectedSetCodes.has(
            set.code
          )
            ? 0
            : set.cards.filter(
                card =>
                  !covered.has(
                    card.name
                  )
              ).length
      })
    );

  sets =
    sets.filter(
      set => {
        if (
          search &&
          !set.name
            .toLowerCase()
            .includes(
              search
            ) &&
          !set.code
            .toLowerCase()
            .includes(
              search
            )
        ) {
          return false;
        }

        if (
          type &&
          set.setType !==
            type
        ) {
          return false;
        }

        if (
          set.coverage *
            100 <
          minCoverage
        ) {
          return false;
        }

        if (
          selectedOnlyFilter.checked &&
          !selectedSetCodes.has(
            set.code
          )
        ) {
          return false;
        }

        return true;
      }
    );

  sets.sort(
    compareRankingRows
  );

  return sets;
}


function compareRankingRows(
  a,
  b
) {
  const key =
    rankingSort.key;

  let left;
  let right;

  switch (key) {
    case "rank":
      left =
        a.rank;

      right =
        b.rank;
      break;

    case "name":
      left =
        a.name.toLowerCase();

      right =
        b.name.toLowerCase();
      break;

    case "code":
      left =
        a.code.toLowerCase();

      right =
        b.code.toLowerCase();
      break;

    case "newCards":
      left =
        a.newCards;

      right =
        b.newCards;
      break;

    case "coverage":
      left =
        a.coverage;

      right =
        b.coverage;
      break;

    case "totalCost":
      left =
        a.totalCost;

      right =
        b.totalCost;
      break;

    case "count":
    default:
      left =
        a.count;

      right =
        b.count;
      break;
  }

  let result;

  if (
    typeof left ===
      "string" &&
    typeof right ===
      "string"
  ) {
    result =
      left.localeCompare(
        right
      );
  } else {
    result =
      left -
      right;
  }

  return rankingSort.direction ===
    "asc"
    ? result
    : -result;
}


function defaultSortDirection(
  key
) {
  if (
    key === "name" ||
    key === "code" ||
    key === "rank"
  ) {
    return "asc";
  }

  return "desc";
}


function renderSetTable() {
  if (
    !setResults
  ) {
    return;
  }

  setResults.innerHTML =
    "";

  const visible =
    getVisibleSets();

  visibleSetCount.textContent =
    `${visible.length} of ${currentRankedSets.length} sets`;

  updateSortArrows();

  for (
    const set
    of visible
  ) {
    setResults.appendChild(
      buildSetRow(
        set
      )
    );
  }
}


function updateSortArrows() {
  document
    .querySelectorAll(
      ".sortable-header"
    )
    .forEach(header => {
      const arrow =
        header.querySelector(
          ".sort-arrow"
        );

      if (!arrow) {
        return;
      }

      if (
        header.dataset.sort ===
        rankingSort.key
      ) {
        arrow.textContent =
          rankingSort.direction ===
          "asc"
            ? "↑"
            : "↓";
      } else {
        arrow.textContent =
          "";
      }
    });
}


function buildSetRow(
  set
) {
  const row =
    document.createElement(
      "tr"
    );

  /*
   * Select
   */
  const selectCell =
    document.createElement(
      "td"
    );

  const checkbox =
    document.createElement(
      "input"
    );

  checkbox.type =
    "checkbox";

  checkbox.className =
    "set-select";

  checkbox.dataset.setCode =
    set.code;

  checkbox.checked =
    selectedSetCodes.has(
      set.code
    );

  checkbox.addEventListener(
    "change",
    () => {
      toggleSetSelection(
        set.code,
        checkbox.checked
      );
    }
  );

  selectCell.appendChild(
    checkbox
  );


  const rankCell =
    textCell(
      set.rank
    );

  const nameCell =
    textCell(
      set.name
    );

  const codeCell =
    textCell(
      set.code.toUpperCase()
    );

  codeCell.className =
    "set-code";


  const countCell =
    textCell(
      `${set.count} / ${currentDeck.length}`
    );


  const newCell =
    textCell(
      set.newCards
    );

  if (
    set.newCards > 0
  ) {
    newCell.classList.add(
      "new-card-count"
    );
  }


  const coverageCell =
    textCell(
      `${(set.coverage * 100).toFixed(1)}%`
    );


  const costCell =
    textCell(
      formatCurrency(
        set.totalCost
      )
    );

  if (
    set.missingPriceCount >
    0
  ) {
    const note =
      document.createElement(
        "div"
      );

    note.className =
      "price-note";

    note.textContent =
      `${set.missingPriceCount} unpriced`;

    costCell.appendChild(
      note
    );
  }


  const detailsCell =
    document.createElement(
      "td"
    );

  const details =
    document.createElement(
      "details"
    );

  details.className =
    "card-details";

  const summary =
    document.createElement(
      "summary"
    );

  summary.textContent =
    `Show ${set.count} cards`;

  details.appendChild(
    summary
  );


  if (
    set.expensiveCards.length >
    0
  ) {
    const box =
      document.createElement(
        "div"
      );

    box.className =
      "expensive-box";

    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      `Expensive printings ($${EXPENSIVE_THRESHOLD}+ each)`;

    box.appendChild(
      title
    );

    const ul =
      document.createElement(
        "ul"
      );

    for (
      const card
      of set.expensiveCards
    ) {
      const li =
        document.createElement(
          "li"
        );

      li.textContent =
        `${card.name}: ${formatCurrency(card.price)} (${card.finish || "unknown"})`;

      ul.appendChild(
        li
      );
    }

    box.appendChild(
      ul
    );

    details.appendChild(
      box
    );
  }


  const innerTable =
    document.createElement(
      "table"
    );

  innerTable.className =
    "inner-card-table";

  innerTable.innerHTML =
    `
      <thead>
        <tr>
          <th>Qty</th>
          <th>Card</th>
          <th>Price</th>
          <th>Finish</th>
          <th>Rarity</th>
          <th>Collector #</th>
        </tr>
      </thead>
    `;

  const tbody =
    document.createElement(
      "tbody"
    );

  for (
    const card
    of set.cards
  ) {
    const tr =
      document.createElement(
        "tr"
      );

    tr.appendChild(
      textCell(
        card.quantity
      )
    );

    const cardCell =
      createCardLinkCell(
        card
      );

    tr.appendChild(
      cardCell
    );

    const priceCell =
      textCell(
        formatCurrency(
          card.price
        )
      );

    if (
      card.price !== null &&
      card.price >=
        EXPENSIVE_THRESHOLD
    ) {
      priceCell.classList.add(
        "expensive-price"
      );
    }

    tr.appendChild(
      priceCell
    );

    tr.appendChild(
      textCell(
        card.finish ||
        "N/A"
      )
    );

    tr.appendChild(
      textCell(
        card.rarity ||
        "N/A"
      )
    );

    tr.appendChild(
      textCell(
        card.collectorNumber ||
        "N/A"
      )
    );

    tbody.appendChild(
      tr
    );
  }

  innerTable.appendChild(
    tbody
  );

  details.appendChild(
    innerTable
  );

  detailsCell.appendChild(
    details
  );


  row.append(
    selectCell,
    rankCell,
    nameCell,
    codeCell,
    countCell,
    newCell,
    coverageCell,
    costCell,
    detailsCell
  );

  return row;
}


/* ============================================================
   SET SELECTION / MANUAL ASSIGNMENT
   ============================================================ */

function toggleSetSelection(
  setCode,
  selected
) {
  if (selected) {
    if (
      !selectedSetCodes.has(
        setCode
      )
    ) {
      selectedSetCodes.add(
        setCode
      );

      selectedSetOrder.push(
        setCode
      );
    }
  } else {
    selectedSetCodes.delete(
      setCode
    );

    selectedSetOrder =
      selectedSetOrder.filter(
        code =>
          code !==
          setCode
      );

    /*
     * Remove manual assignments to
     * deselected set.
     */
    for (
      const [cardName, code]
      of manualAssignments
    ) {
      if (
        code ===
        setCode
      ) {
        manualAssignments.delete(
          cardName
        );
      }
    }
  }

  saveState();

  renderSetTable();

  updateDeckBuilder();
}


function clearSelectedSets() {
  selectedSetCodes.clear();

  selectedSetOrder = [];

  manualAssignments.clear();

  saveState();

  renderSetTable();

  updateDeckBuilder();
}


function getSetByCode(
  code
) {
  return (
    currentRankedSets.find(
      set =>
        set.code ===
        code
    ) ||
    null
  );
}


function getCardFromSet(
  set,
  cardName
) {
  return (
    set?.cards.find(
      card =>
        card.name ===
        cardName
    ) ||
    null
  );
}


function getEligibleSelectedSetsForCard(
  cardName
) {
  const result = [];

  for (
    const code
    of selectedSetOrder
  ) {
    const set =
      getSetByCode(
        code
      );

    if (
      getCardFromSet(
        set,
        cardName
      )
    ) {
      result.push(
        set
      );
    }
  }

  return result;
}


/* ============================================================
   COVERAGE / ASSIGNMENT
   ============================================================ */

function calculateSelectedCoverage() {
  const coveredCards =
    new Map();

  const assignmentsBySet =
    new Map();

  let totalCost = 0;

  for (
    const deckCard
    of currentDeck
  ) {
    const cardName =
      deckCard.name;

    const eligible =
      getEligibleSelectedSetsForCard(
        cardName
      );

    if (
      eligible.length === 0
    ) {
      continue;
    }

    let chosenSet =
      null;

    const manualCode =
      manualAssignments.get(
        cardName
      );

    if (manualCode) {
      chosenSet =
        eligible.find(
          set =>
            set.code ===
            manualCode
        ) ||
        null;
    }

    /*
     * Otherwise first selected set wins.
     */
    if (!chosenSet) {
      chosenSet =
        eligible[0];
    }

    const card =
      getCardFromSet(
        chosenSet,
        cardName
      );

    if (!card) {
      continue;
    }

    const assignment = {
      ...card,

      sourceSet:
        chosenSet.code,

      sourceSetName:
        chosenSet.name,

      quantity:
        deckCard.quantity
    };

    coveredCards.set(
      cardName,
      assignment
    );

    if (
      !assignmentsBySet.has(
        chosenSet.code
      )
    ) {
      assignmentsBySet.set(
        chosenSet.code,
        []
      );
    }

    assignmentsBySet
      .get(
        chosenSet.code
      )
      .push(
        assignment
      );

    if (
      assignment.price !==
      null
    ) {
      totalCost +=
        assignment.price *
        assignment.quantity;
    }
  }

  const remainingCards =
    currentDeck.filter(
      deckCard =>
        !coveredCards.has(
          deckCard.name
        )
    );

  const selectedSets =
    selectedSetOrder
      .map(
        code => {
          const set =
            getSetByCode(
              code
            );

          if (!set) {
            return null;
          }

          const assignedCards =
            assignmentsBySet.get(
              code
            ) || [];

          const contributionCost =
            assignedCards.reduce(
              (sum, card) =>
                sum +
                (
                  (
                    card.price ||
                    0
                  ) *
                  card.quantity
                ),
              0
            );

          return {
            set,

            assignedCards,

            contributionCost,

            matchedCards:
              set.cards.length,

            overlapCount:
              set.cards.filter(
                card =>
                  coveredCards.has(
                    card.name
                  ) &&
                  coveredCards.get(
                    card.name
                  )
                    .sourceSet !==
                  code
              ).length
          };
        }
      )
      .filter(Boolean);

  return {
    coveredCards,
    remainingCards,
    selectedSets,
    assignmentsBySet,
    totalCost
  };
}


/* ============================================================
   BUILDER
   ============================================================ */

function updateDeckBuilder() {
  const result =
    calculateSelectedCoverage();

  const total =
    currentDeck.length;

  const covered =
    result.coveredCards.size;

  selectedSetCount.textContent =
    selectedSetOrder.length;

  coveredCardCount.textContent =
    `${covered} / ${total}`;

  remainingCardCount.textContent =
    result.remainingCards.length;

  selectedSetsCost.textContent =
    formatCurrency(
      result.totalCost
    );

  const percent =
    total === 0
      ? 0
      : (
          covered /
          total
        ) *
        100;

  coverageBarFill.style.width =
    `${percent}%`;

  coveragePercent.textContent =
    `${percent.toFixed(1)}% covered`;

  renderSelectedSets(
    result
  );

  renderRemainingCards(
    result
  );

  updateNextRecommendation(
    result
  );

  renderFinalAssignment(
    result
  );
}


function renderSelectedSets(
  result
) {
  selectedSetsList.innerHTML =
    "";

  if (
    result.selectedSets.length ===
    0
  ) {
    selectedSetsList.innerHTML =
      '<p class="empty-message">No sets selected yet.</p>';

    return;
  }

  result.selectedSets.forEach(
    (entry, index) => {
      const wrapper =
        document.createElement(
          "div"
        );

      wrapper.className =
        "selected-set-item";

      const header =
        document.createElement(
          "div"
        );

      header.className =
        "selected-set-header";

      const title =
        document.createElement(
          "div"
        );

      title.className =
        "selected-set-name";

      title.textContent =
        `${index + 1}. ${entry.set.name} (${entry.set.code.toUpperCase()})`;

      const remove =
        document.createElement(
          "button"
        );

      remove.type =
        "button";

      remove.textContent =
        "Remove";

      remove.addEventListener(
        "click",
        () => {
          toggleSetSelection(
            entry.set.code,
            false
          );
        }
      );

      header.append(
        title,
        remove
      );

      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "selected-set-meta";

      meta.textContent =
        `${entry.assignedCards.length} assigned · ` +
        `${formatCurrency(entry.contributionCost)} · ` +
        `${entry.overlapCount} overlaps`;

      wrapper.append(
        header,
        meta
      );

      selectedSetsList.appendChild(
        wrapper
      );
    }
  );
}


function renderRemainingCards(
  result
) {
  remainingCardsList.innerHTML =
    "";

  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  if (
    result.remainingCards.length ===
    0
  ) {
    const complete =
      document.createElement(
        "div"
      );

    complete.className =
      "complete-message";

    complete.textContent =
      "All cards are covered.";

    remainingCardsList.appendChild(
      complete
    );

    return;
  }

  for (
    const deckCard
    of result.remainingCards
  ) {
    const row =
      document.createElement(
        "div"
      );

    row.className =
      "remaining-card";

    const name =
      document.createElement(
        "span"
      );

    name.textContent =
      deckCard.quantity > 1
        ? `${deckCard.quantity}× ${deckCard.name}`
        : deckCard.name;

    const availability =
      currentRankedSets.filter(
        set =>
          getCardFromSet(
            set,
            deckCard.name
          )
      ).length;

    const count =
      document.createElement(
        "span"
      );

    count.className =
      "price-note";

    count.textContent =
      `${availability} sets`;

    row.append(
      name,
      count
    );

    remainingCardsList.appendChild(
      row
    );
  }
}


/* ============================================================
   NEXT SET RECOMMENDATION
   ============================================================ */

function updateNextRecommendation(
  result
) {
  remainingRecommendation.innerHTML =
    "";

  if (
    result.remainingCards.length ===
    0
  ) {
    remainingRecommendation.classList.add(
      "hidden"
    );

    return;
  }

  const remainingNames =
    new Set(
      result.remainingCards.map(
        card =>
          card.name
      )
    );

  let best = null;

  for (
    const set
    of currentRankedSets
  ) {
    if (
      selectedSetCodes.has(
        set.code
      )
    ) {
      continue;
    }

    const cards =
      set.cards.filter(
        card =>
          remainingNames.has(
            card.name
          )
      );

    if (
      cards.length === 0
    ) {
      continue;
    }

    const cost =
      cards.reduce(
        (sum, card) =>
          sum +
          (
            (
              card.price ||
              0
            ) *
            (
              currentQuantityMap.get(
                card.name
              ) ||
              1
            )
          ),
        0
      );

    const candidate = {
      set,
      cards,
      cost
    };

    if (
      !best ||
      cards.length >
        best.cards.length ||
      (
        cards.length ===
          best.cards.length &&
        cost <
          best.cost
      )
    ) {
      best =
        candidate;
    }
  }

  if (!best) {
    remainingRecommendation.classList.add(
      "hidden"
    );

    return;
  }

  const text =
    document.createElement(
      "div"
    );

  text.innerHTML =
    `<strong>Best next set:</strong> ` +
    `${escapeHtml(best.set.name)} ` +
    `(${escapeHtml(best.set.code.toUpperCase())}) ` +
    `adds ${best.cards.length} cards for about ` +
    `${escapeHtml(formatCurrency(best.cost))}.`;

  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.textContent =
    `Add ${best.set.code.toUpperCase()}`;

  button.style.marginTop =
    "10px";

  button.addEventListener(
    "click",
    () => {
      toggleSetSelection(
        best.set.code,
        true
      );
    }
  );

  remainingRecommendation.append(
    text,
    button
  );

  remainingRecommendation.classList.remove(
    "hidden"
  );
}


/* ============================================================
   AUTOMATIC OPTIMIZATION
   ============================================================ */

/*
 * Greedy set cover:
 * choose set adding most uncovered cards.
 */
function optimizeFewestSets() {
  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  clearPlanWithoutRender();

  const uncovered =
    new Set(
      currentCardNames
    );

  while (
    uncovered.size > 0
  ) {
    let best = null;

    for (
      const set
      of currentRankedSets
    ) {
      if (
        selectedSetCodes.has(
          set.code
        )
      ) {
        continue;
      }

      const newCards =
        set.cards.filter(
          card =>
            uncovered.has(
              card.name
            )
        );

      if (
        newCards.length ===
        0
      ) {
        continue;
      }

      const cost =
        calculateCardsCost(
          newCards
        );

      if (
        !best ||
        newCards.length >
          best.newCards.length ||
        (
          newCards.length ===
            best.newCards.length &&
          cost <
            best.cost
        )
      ) {
        best = {
          set,
          newCards,
          cost
        };
      }
    }

    if (!best) {
      break;
    }

    selectedSetCodes.add(
      best.set.code
    );

    selectedSetOrder.push(
      best.set.code
    );

    for (
      const card
      of best.newCards
    ) {
      uncovered.delete(
        card.name
      );
    }
  }

  finishOptimization();
}


/*
 * Lowest per-card printing cost.
 *
 * Select the set containing the cheapest
 * allowed printing for each card, then
 * manually assign that card to that set.
 */
function optimizeLowestCardCost() {
  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  clearPlanWithoutRender();

  for (
    const deckCard
    of currentDeck
  ) {
    let bestSet = null;
    let bestCard = null;

    for (
      const set
      of currentRankedSets
    ) {
      const card =
        getCardFromSet(
          set,
          deckCard.name
        );

      if (
        !card ||
        card.price === null
      ) {
        continue;
      }

      if (
        !bestCard ||
        card.price <
          bestCard.price
      ) {
        bestSet =
          set;

        bestCard =
          card;
      }
    }

    /*
     * If no priced printing exists,
     * at least choose the first set
     * containing the card.
     */
    if (!bestSet) {
      bestSet =
        currentRankedSets.find(
          set =>
            getCardFromSet(
              set,
              deckCard.name
            )
        ) ||
        null;
    }

    if (!bestSet) {
      continue;
    }

    if (
      !selectedSetCodes.has(
        bestSet.code
      )
    ) {
      selectedSetCodes.add(
        bestSet.code
      );

      selectedSetOrder.push(
        bestSet.code
      );
    }

    manualAssignments.set(
      deckCard.name,
      bestSet.code
    );
  }

  finishOptimization();
}


/*
 * Greedy cost / newly covered card.
 */
function optimizeBestValue() {
  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  clearPlanWithoutRender();

  const uncovered =
    new Set(
      currentCardNames
    );

  while (
    uncovered.size > 0
  ) {
    let best = null;

    for (
      const set
      of currentRankedSets
    ) {
      if (
        selectedSetCodes.has(
          set.code
        )
      ) {
        continue;
      }

      const cards =
        set.cards.filter(
          card =>
            uncovered.has(
              card.name
            )
        );

      if (
        cards.length ===
        0
      ) {
        continue;
      }

      const cost =
        calculateCardsCost(
          cards
        );

      const ratio =
        cost /
        cards.length;

      if (
        !best ||
        ratio <
          best.ratio ||
        (
          ratio ===
            best.ratio &&
          cards.length >
            best.cards.length
        )
      ) {
        best = {
          set,
          cards,
          cost,
          ratio
        };
      }
    }

    if (!best) {
      break;
    }

    selectedSetCodes.add(
      best.set.code
    );

    selectedSetOrder.push(
      best.set.code
    );

    for (
      const card
      of best.cards
    ) {
      uncovered.delete(
        card.name
      );
    }
  }

  finishOptimization();
}


function calculateCardsCost(
  cards
) {
  return cards.reduce(
    (sum, card) =>
      sum +
      (
        (
          card.price ||
          0
        ) *
        (
          currentQuantityMap.get(
            card.name
          ) ||
          1
        )
      ),
    0
  );
}


function clearPlanWithoutRender() {
  selectedSetCodes.clear();

  selectedSetOrder = [];

  manualAssignments.clear();
}


function finishOptimization() {
  saveState();

  renderSetTable();

  updateDeckBuilder();
}


/* ============================================================
   FINAL ASSIGNMENT
   ============================================================ */

function renderFinalAssignment(
  result
) {
  assignmentTableBody.innerHTML =
    "";

  assignmentSetSummary.innerHTML =
    "";


  /*
   * Per-set summary.
   */
  if (
    result.selectedSets.length ===
    0
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "assignment-set-card";

    empty.textContent =
      "Select or optimize sets to create a sourcing plan.";

    assignmentSetSummary.appendChild(
      empty
    );
  } else {
    for (
      const entry
      of result.selectedSets
    ) {
      const box =
        document.createElement(
          "div"
        );

      box.className =
        "assignment-set-card";

      const title =
        document.createElement(
          "div"
        );

      title.className =
        "assignment-set-name";

      title.textContent =
        `${entry.set.name} (${entry.set.code.toUpperCase()})`;

      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "assignment-set-meta";

      const copyTotal =
        entry.assignedCards.reduce(
          (sum, card) =>
            sum +
            card.quantity,
          0
        );

      meta.textContent =
        `${entry.assignedCards.length} unique · ` +
        `${copyTotal} copies · ` +
        `${formatCurrency(entry.contributionCost)}`;

      box.append(
        title,
        meta
      );

      assignmentSetSummary.appendChild(
        box
      );
    }
  }


  /*
   * Card rows.
   */
  for (
    const deckCard
    of currentDeck
  ) {
    const assignment =
      result.coveredCards.get(
        deckCard.name
      );

    const row =
      document.createElement(
        "tr"
      );

    if (!assignment) {
      row.classList.add(
        "uncovered-row"
      );
    }


    /*
     * Quantity
     */
    row.appendChild(
      textCell(
        deckCard.quantity
      )
    );


    /*
     * Card
     */
    if (assignment) {
      row.appendChild(
        createCardLinkCell(
          assignment
        )
      );
    } else {
      row.appendChild(
        textCell(
          deckCard.name
        )
      );
    }


    /*
     * Status
     */
    const statusCell =
      textCell(
        assignment
          ? "Covered"
          : "Not covered"
      );

    statusCell.className =
      assignment
        ? "assignment-covered"
        : "assignment-uncovered";

    row.appendChild(
      statusCell
    );


    /*
     * Manual assignment dropdown.
     */
    const assignedSetCell =
      document.createElement(
        "td"
      );

    if (assignment) {
      const eligible =
        getEligibleSelectedSetsForCard(
          deckCard.name
        );

      if (
        eligible.length > 1
      ) {
        const select =
          document.createElement(
            "select"
          );

        select.className =
          "assignment-select";

        for (
          const set
          of eligible
        ) {
          const option =
            document.createElement(
              "option"
            );

          option.value =
            set.code;

          option.textContent =
            `${set.name} (${set.code.toUpperCase()})`;

          option.selected =
            set.code ===
            assignment.sourceSet;

          select.appendChild(
            option
          );
        }

        select.addEventListener(
          "change",
          () => {
            manualAssignments.set(
              deckCard.name,
              select.value
            );

            saveState();

            updateDeckBuilder();
          }
        );

        assignedSetCell.appendChild(
          select
        );
      } else {
        assignedSetCell.textContent =
          assignment.sourceSetName;
      }
    } else {
      assignedSetCell.textContent =
        "—";
    }

    row.appendChild(
      assignedSetCell
    );


    /*
     * Code
     */
    row.appendChild(
      textCell(
        assignment
          ? assignment.sourceSet
              .toUpperCase()
          : "—"
      )
    );


    /*
     * Price each
     */
    const eachCell =
      textCell(
        assignment
          ? formatCurrency(
              assignment.price
            )
          : "—"
      );

    if (
      assignment?.price >=
      EXPENSIVE_THRESHOLD
    ) {
      eachCell.classList.add(
        "expensive-price"
      );
    }

    row.appendChild(
      eachCell
    );


    /*
     * Line total
     */
    row.appendChild(
      textCell(
        assignment?.price !==
        null &&
        assignment?.price !==
        undefined
          ? formatCurrency(
              assignment.price *
              deckCard.quantity
            )
          : "—"
      )
    );


    row.appendChild(
      textCell(
        assignment?.finish ||
        "—"
      )
    );

    row.appendChild(
      textCell(
        assignment?.rarity ||
        "—"
      )
    );

    row.appendChild(
      textCell(
        assignment?.collectorNumber ||
        "—"
      )
    );

    assignmentTableBody.appendChild(
      row
    );
  }
}


/* ============================================================
   EXPORT
   ============================================================ */

function exportCsv() {
  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  const result =
    calculateSelectedCoverage();

  const rows = [
    [
      "Quantity",
      "Card",
      "Status",
      "Assigned Set",
      "Set Code",
      "Price Each",
      "Line Total",
      "Finish",
      "Rarity",
      "Collector Number",
      "Scryfall URL"
    ]
  ];

  for (
    const deckCard
    of currentDeck
  ) {
    const card =
      result.coveredCards.get(
        deckCard.name
      );

    rows.push([
      deckCard.quantity,

      deckCard.name,

      card
        ? "Covered"
        : "Not covered",

      card?.sourceSetName ||
        "",

      card?.sourceSet
        ?.toUpperCase() ||
        "",

      card?.price ??
        "",

      card?.price !==
        null &&
      card?.price !==
        undefined
        ? (
            card.price *
            deckCard.quantity
          ).toFixed(2)
        : "",

      card?.finish ||
        "",

      card?.rarity ||
        "",

      card?.collectorNumber ||
        "",

      card?.scryfallUri ||
        ""
    ]);
  }

  const csv =
    rows
      .map(
        row =>
          row
            .map(
              csvEscape
            )
            .join(",")
      )
      .join("\r\n");

  downloadTextFile(
    "mtg-set-plan.csv",
    csv,
    "text/csv;charset=utf-8"
  );
}


function exportText() {
  if (
    currentDeck.length ===
    0
  ) {
    return;
  }

  const result =
    calculateSelectedCoverage();

  const lines = [];

  lines.push(
    "MTG SET FINDER PLAN"
  );

  lines.push(
    "==================="
  );

  lines.push("");

  lines.push(
    `Selected sets: ${selectedSetOrder.length}`
  );

  lines.push(
    `Covered: ${result.coveredCards.size}/${currentDeck.length}`
  );

  lines.push(
    `Estimated cost: ${formatCurrency(result.totalCost)}`
  );

  lines.push("");

  for (
    const entry
    of result.selectedSets
  ) {
    lines.push(
      `${entry.set.name} (${entry.set.code.toUpperCase()})`
    );

    lines.push(
      "-".repeat(
        Math.min(
          60,
          entry.set.name.length +
          10
        )
      )
    );

    for (
      const card
      of entry.assignedCards
    ) {
      const quantity =
        card.quantity > 1
          ? `${card.quantity}x `
          : "";

      lines.push(
        `${quantity}${card.name} — ${formatCurrency(card.price)} — ${card.finish || "N/A"} — #${card.collectorNumber || "N/A"}`
      );
    }

    lines.push("");
  }

  if (
    result.remainingCards.length >
    0
  ) {
    lines.push(
      "NOT COVERED"
    );

    lines.push(
      "-----------"
    );

    for (
      const card
      of result.remainingCards
    ) {
      lines.push(
        `${card.quantity}x ${card.name}`
      );
    }

    lines.push("");
  }

  downloadTextFile(
    "mtg-set-plan.txt",
    lines.join("\n"),
    "text/plain;charset=utf-8"
  );
}


function csvEscape(
  value
) {
  const text =
    String(
      value ??
      ""
    );

  if (
    /[",\r\n]/.test(
      text
    )
  ) {
    return (
      '"' +
      text.replaceAll(
        '"',
        '""'
      ) +
      '"'
    );
  }

  return text;
}


function downloadTextFile(
  filename,
  content,
  type
) {
  const blob =
    new Blob(
      [content],
      {
        type
      }
    );

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    filename;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    1000
  );
}


/* ============================================================
   IMAGE HOVER PREVIEW
   ============================================================ */

function installImagePreviewHandlers() {
  document.addEventListener(
    "mouseover",
    event => {
      const target =
        event.target.closest(
          "[data-card-image]"
        );

      if (!target) {
        return;
      }

      const url =
        target.dataset.cardImage;

      if (!url) {
        return;
      }

      previewImage.src =
        url;

      imagePreview.classList.add(
        "visible"
      );

      positionImagePreview(
        event
      );
    }
  );

  document.addEventListener(
    "mousemove",
    event => {
      if (
        imagePreview.classList.contains(
          "visible"
        )
      ) {
        positionImagePreview(
          event
        );
      }
    }
  );

  document.addEventListener(
    "mouseout",
    event => {
      const target =
        event.target.closest(
          "[data-card-image]"
        );

      if (!target) {
        return;
      }

      imagePreview.classList.remove(
        "visible"
      );

      previewImage.removeAttribute(
        "src"
      );
    }
  );
}


function positionImagePreview(
  event
) {
  const padding = 18;

  const width =
    260;

  const height =
    360;

  let left =
    event.clientX +
    padding;

  let top =
    event.clientY +
    padding;

  if (
    left +
      width >
    window.innerWidth
  ) {
    left =
      event.clientX -
      width -
      padding;
  }

  if (
    top +
      height >
    window.innerHeight
  ) {
    top =
      window.innerHeight -
      height -
      padding;
  }

  imagePreview.style.left =
    `${Math.max(
      padding,
      left
    )}px`;

  imagePreview.style.top =
    `${Math.max(
      padding,
      top
    )}px`;
}


/* ============================================================
   UNMATCHED
   ============================================================ */

function renderUnmatchedCards() {
  unmatchedCardsList.innerHTML =
    "";

  if (
    currentUnmatchedCards.length ===
    0
  ) {
    unmatchedArea.classList.add(
      "hidden"
    );

    return;
  }

  for (
    const name
    of currentUnmatchedCards
  ) {
    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      name;

    unmatchedCardsList.appendChild(
      li
    );
  }

  unmatchedArea.classList.remove(
    "hidden"
  );
}


/* ============================================================
   CLEAR
   ============================================================ */

function clearDeck() {
  if (
    isRunning ||
    isImportingBulk
  ) {
    return;
  }

  cardInput.value =
    "";

  currentDeck = [];
  currentCardNames = [];

  currentQuantityMap =
    new Map();

  currentRankedSets = [];
  currentUnmatchedCards = [];

  selectedSetCodes.clear();

  selectedSetOrder = [];

  manualAssignments.clear();

  resultsSection.classList.add(
    "hidden"
  );

  progressArea.classList.add(
    "hidden"
  );

  setResults.innerHTML =
    "";

  assignmentTableBody.innerHTML =
    "";

  assignmentSetSummary.innerHTML =
    "";

  cardCount.textContent =
    "0";

  copyCount.textContent =
    "0";

  setCount.textContent =
    "0";

  unmatchedCount.textContent =
    "0";

  saveState();
}


/* ============================================================
   UI HELPERS
   ============================================================ */

function createCardLinkCell(
  card
) {
  const td =
    document.createElement(
      "td"
    );

  if (
    card.scryfallUri
  ) {
    const link =
      document.createElement(
        "a"
      );

    link.href =
      card.scryfallUri;

    link.target =
      "_blank";

    link.rel =
      "noopener noreferrer";

    link.textContent =
      card.name;

    if (
      card.imageNormal ||
      card.imageSmall
    ) {
      link.dataset.cardImage =
        card.imageNormal ||
        card.imageSmall;

      link.classList.add(
        "card-preview-link"
      );
    }

    td.appendChild(
      link
    );
  } else {
    td.textContent =
      card.name;
  }

  return td;
}


function textCell(
  value
) {
  const td =
    document.createElement(
      "td"
    );

  td.textContent =
    String(
      value ??
      ""
    );

  return td;
}


function formatCurrency(
  value
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {
    return "N/A";
  }

  return Number(
    value
  ).toLocaleString(
    "en-US",
    {
      style:
        "currency",

      currency:
        "USD"
    }
  );
}


function formatNumber(
  value
) {
  return Number(
    value ||
    0
  ).toLocaleString(
    "en-US"
  );
}


function formatDateTime(
  value
) {
  if (!value) {
    return "unknown";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
}


function prettifySetType(
  type
) {
  return String(
    type
  )
    .replaceAll(
      "_",
      " "
    )
    .replace(
      /\b\w/g,
      char =>
        char.toUpperCase()
    );
}


function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}


function sleep(
  ms
) {
  return new Promise(
    resolve =>
      setTimeout(
        resolve,
        ms
      )
  );
}


function debounce(
  fn,
  delay
) {
  let timer = null;

  return (
    ...args
  ) => {
    clearTimeout(
      timer
    );

    timer =
      setTimeout(
        () =>
          fn(...args),
        delay
      );
  };
}
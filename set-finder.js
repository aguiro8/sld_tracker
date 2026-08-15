const cardInput = document.getElementById("cardInput");

const analyzeButton = document.getElementById("analyzeButton");
const clearButton = document.getElementById("clearButton");

const paperOnlyCheckbox = document.getElementById("paperOnly");
const excludeSecretLairCheckbox =
  document.getElementById("excludeSecretLair");
const excludePromosCheckbox =
  document.getElementById("excludePromos");

const progressArea = document.getElementById("progressArea");
const progressBarFill = document.getElementById("progressBarFill");
const statusMessage = document.getElementById("statusMessage");

const resultsSection = document.getElementById("resultsSection");
const setResults = document.getElementById("setResults");

const cardCount = document.getElementById("cardCount");
const setCount = document.getElementById("setCount");
const unmatchedCount = document.getElementById("unmatchedCount");

const bestSet = document.getElementById("bestSet");
const bestSetName = document.getElementById("bestSetName");
const bestSetStats = document.getElementById("bestSetStats");

const unmatchedArea = document.getElementById("unmatchedArea");
const unmatchedCardsList =
  document.getElementById("unmatchedCards");

let isRunning = false;


/*
 * Scryfall currently limits /cards/search to
 * 2 requests per second.
 *
 * 550 ms gives us a little safety margin.
 */
const SCRYFALL_DELAY_MS = 550;


/*
 * ------------------------------------------------------------
 * Event listeners
 * ------------------------------------------------------------
 */

analyzeButton.addEventListener("click", analyzeCards);

clearButton.addEventListener("click", () => {
  if (isRunning) {
    return;
  }

  cardInput.value = "";

  setResults.innerHTML = "";

  resultsSection.classList.add("hidden");
  progressArea.classList.add("hidden");
  bestSet.classList.add("hidden");
  unmatchedArea.classList.add("hidden");

  cardCount.textContent = "0";
  setCount.textContent = "0";
  unmatchedCount.textContent = "0";

  progressBarFill.style.width = "0%";
  statusMessage.textContent = "Waiting...";
});


/*
 * ------------------------------------------------------------
 * Main analysis
 * ------------------------------------------------------------
 */

async function analyzeCards() {
  if (isRunning) {
    return;
  }

  const cardNames = parseManaBoxList(cardInput.value);

  if (cardNames.length === 0) {
    alert("No card names were found in the list.");
    return;
  }

  isRunning = true;

  analyzeButton.disabled = true;
  clearButton.disabled = true;

  analyzeButton.textContent = "Searching...";

  resetResults();

  progressArea.classList.remove("hidden");
  resultsSection.classList.remove("hidden");

  cardCount.textContent = cardNames.length;

  /*
   * Map format:
   *
   * {
   *   "cmm" => {
   *      code: "cmm",
   *      name: "Commander Masters",
   *      setType: "masters",
   *      cards: Set(...)
   *   }
   * }
   */
  const sets = new Map();

  const unmatchedCards = [];

  try {
    for (let index = 0; index < cardNames.length; index++) {
      const cardName = cardNames[index];

      updateProgress(
        index,
        cardNames.length,
        `Searching ${index + 1} of ${cardNames.length}: ${cardName}`
      );

      try {
        const printings = await getPrintings(cardName);

        if (printings.length === 0) {
          unmatchedCards.push(cardName);
        } else {
          addPrintingsToSets(
            sets,
            cardName,
            printings
          );
        }
      } catch (error) {
        console.error(
          `Could not look up "${cardName}":`,
          error
        );

        unmatchedCards.push(cardName);
      }

      /*
       * Wait between cards so we don't exceed Scryfall's
       * /cards/search API limit.
       *
       * We don't need to wait after the final card.
       */
      if (index < cardNames.length - 1) {
        await delay(SCRYFALL_DELAY_MS);
      }
    }

    const rankedSets = rankSets(
      sets,
      cardNames.length
    );

    renderResults(
      rankedSets,
      cardNames.length,
      unmatchedCards
    );

    updateProgress(
      cardNames.length,
      cardNames.length,
      "Done."
    );
  } catch (error) {
    console.error(error);

    statusMessage.textContent =
      `Something went wrong: ${error.message}`;
  } finally {
    isRunning = false;

    analyzeButton.disabled = false;
    clearButton.disabled = false;

    analyzeButton.textContent = "Find Best Sets";
  }
}


/*
 * ------------------------------------------------------------
 * Parse ManaBox / deck list
 * ------------------------------------------------------------
 */

function parseManaBoxList(text) {
  const names = new Set();

  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (let line of lines) {
    /*
     * Ignore some common deck section headings.
     */
    if (isSectionHeading(line)) {
      continue;
    }

    /*
     * Remove leading quantities:
     *
     * 1 Sol Ring
     * 4 Counterspell
     * 4x Counterspell
     * 4 x Counterspell
     */
    line = line.replace(
      /^\d+\s*x?\s+/i,
      ""
    );

    /*
     * Remove common ManaBox / Moxfield-style
     * set and collector number:
     *
     * Sol Ring (CMM) 396
     * Counterspell (DMR) 45
     *
     * Also allows:
     *
     * Sol Ring (CMM) 396 *F*
     */
    line = line.replace(
      /\s+\([A-Za-z0-9]+\)\s+[A-Za-z0-9★]+(?:\s+.*)?$/,
      ""
    );

    /*
     * Remove trailing foil markers that may remain.
     */
    line = line.replace(
      /\s+\*(?:F|E)\*$/i,
      ""
    );

    line = line.trim();

    if (!line) {
      continue;
    }

    names.add(line);
  }

  return [...names];
}


function isSectionHeading(line) {
  const normalized = line
    .toLowerCase()
    .replace(/:$/, "")
    .trim();

  const headings = new Set([
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

  return headings.has(normalized);
}


/*
 * ------------------------------------------------------------
 * Scryfall
 * ------------------------------------------------------------
 */

async function getPrintings(cardName) {
  /*
   * !"Card Name"
   *
   * Scryfall's ! operator performs an exact-name search.
   *
   * unique=prints tells Scryfall not to collapse all the
   * different printings into one result.
   */
  const query = `!"${cardName}"`;

  let url =
    "https://api.scryfall.com/cards/search" +
    `?unique=prints&order=released&q=${encodeURIComponent(query)}`;

  const printings = [];

  while (url) {
    const response = await fetch(url);

    /*
     * Scryfall returns 404 when a search has no results.
     */
    if (response.status === 404) {
      return [];
    }

    /*
     * Respect rate-limit errors rather than immediately
     * hammering the API again.
     */
    if (response.status === 429) {
      throw new Error(
        "Scryfall rate limit reached. Wait about 30 seconds and try again."
      );
    }

    if (!response.ok) {
      throw new Error(
        `Scryfall returned HTTP ${response.status}`
      );
    }

    const data = await response.json();

    if (Array.isArray(data.data)) {
      printings.push(...data.data);
    }

    /*
     * Scryfall search results are paginated.
     */
    if (data.has_more && data.next_page) {
      /*
       * Pagination is another /cards/search request,
       * so wait before requesting the next page.
       */
      await delay(SCRYFALL_DELAY_MS);

      url = data.next_page;
    } else {
      url = null;
    }
  }

  return printings;
}


/*
 * ------------------------------------------------------------
 * Convert printings into set statistics
 * ------------------------------------------------------------
 */

function addPrintingsToSets(
  sets,
  cardName,
  printings
) {
  const paperOnly =
    paperOnlyCheckbox.checked;

  const excludeSecretLair =
    excludeSecretLairCheckbox.checked;

  const excludePromos =
    excludePromosCheckbox.checked;

  /*
   * A card may have multiple printings, art treatments,
   * collector numbers, etc. in the same set.
   *
   * We only want that card to count ONCE for that set.
   */
  const setsForThisCard = new Set();

  for (const printing of printings) {
    /*
     * Paper-only filter.
     */
    if (
      paperOnly &&
      !printing.games?.includes("paper")
    ) {
      continue;
    }

    /*
     * Exclude Secret Lair if requested.
     *
     * Scryfall uses set_type = "box" for Secret Lair,
     * so checking the set code/name is safer for this
     * specific purpose.
     */
    if (
      excludeSecretLair &&
      isSecretLairPrinting(printing)
    ) {
      continue;
    }

    /*
     * Optional broad promo exclusion.
     */
    if (
      excludePromos &&
      printing.set_type === "promo"
    ) {
      continue;
    }

    const setCode = printing.set;

    if (!setCode) {
      continue;
    }

    /*
     * Do not count the same card twice in one set.
     */
    if (setsForThisCard.has(setCode)) {
      continue;
    }

    setsForThisCard.add(setCode);

    if (!sets.has(setCode)) {
      sets.set(setCode, {
        code: setCode,
        name:
          printing.set_name ||
          setCode.toUpperCase(),
        setType:
          printing.set_type ||
          "",
        cards: new Set()
      });
    }

    sets
      .get(setCode)
      .cards
      .add(cardName);
  }
}


function isSecretLairPrinting(printing) {
  const code =
    String(printing.set || "")
      .toLowerCase();

  const name =
    String(printing.set_name || "")
      .toLowerCase();

  /*
   * SLD is the main Secret Lair Drop set code.
   * We also check the name in case Scryfall adds
   * related Secret Lair set codes later.
   */
  return (
    code === "sld" ||
    name.includes("secret lair")
  );
}


/*
 * ------------------------------------------------------------
 * Ranking
 * ------------------------------------------------------------
 */

function rankSets(
  sets,
  totalCards
) {
  return [...sets.values()]
    .map(set => {
      const count =
        set.cards.size;

      return {
        code: set.code,
        name: set.name,
        setType: set.setType,
        cards: [...set.cards].sort(
          (a, b) =>
            a.localeCompare(b)
        ),
        count,
        coverage:
          totalCards === 0
            ? 0
            : count / totalCards
      };
    })
    .sort((a, b) => {
      /*
       * Primary sort:
       * Most matching cards first.
       */
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      /*
       * Secondary sort:
       * Alphabetical set name.
       */
      return a.name.localeCompare(
        b.name
      );
    });
}


/*
 * ------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------
 */

function renderResults(
  rankedSets,
  totalCards,
  unmatchedCards
) {
  setResults.innerHTML = "";

  setCount.textContent =
    rankedSets.length;

  unmatchedCount.textContent =
    unmatchedCards.length;

  if (rankedSets.length > 0) {
    renderBestSet(
      rankedSets[0],
      totalCards
    );
  } else {
    bestSet.classList.add("hidden");
  }

  rankedSets.forEach(
    (set, index) => {
      const row =
        document.createElement("tr");

      const coveragePercent =
        (
          set.coverage * 100
        ).toFixed(1);

      /*
       * Create each cell separately rather than inserting
       * untrusted card names directly with innerHTML.
       */
      const rankCell =
        document.createElement("td");

      rankCell.textContent =
        index + 1;


      const nameCell =
        document.createElement("td");

      nameCell.textContent =
        set.name;


      const codeCell =
        document.createElement("td");

      codeCell.className =
        "set-code";

      codeCell.textContent =
        set.code.toUpperCase();


      const countCell =
        document.createElement("td");

      countCell.textContent =
        `${set.count} / ${totalCards}`;


      const coverageCell =
        document.createElement("td");

      coverageCell.textContent =
        `${coveragePercent}%`;


      const cardsCell =
        document.createElement("td");

      const details =
        document.createElement("details");

      details.className =
        "card-details";

      const summary =
        document.createElement("summary");

      summary.textContent =
        `Show ${set.count} cards`;

      const cardList =
        document.createElement("ul");

      cardList.className =
        "card-list";

      for (const cardName of set.cards) {
        const item =
          document.createElement("li");

        item.textContent =
          cardName;

        cardList.appendChild(item);
      }

      details.appendChild(summary);
      details.appendChild(cardList);

      cardsCell.appendChild(details);

      row.appendChild(rankCell);
      row.appendChild(nameCell);
      row.appendChild(codeCell);
      row.appendChild(countCell);
      row.appendChild(coverageCell);
      row.appendChild(cardsCell);

      setResults.appendChild(row);
    }
  );

  renderUnmatchedCards(
    unmatchedCards
  );
}


function renderBestSet(
  set,
  totalCards
) {
  const percentage =
    (
      set.count /
      totalCards *
      100
    ).toFixed(1);

  bestSetName.textContent =
    `${set.name} (${set.code.toUpperCase()})`;

  bestSetStats.textContent =
    `${set.count} of ${totalCards} cards — ${percentage}% coverage`;

  bestSet.classList.remove("hidden");
}


function renderUnmatchedCards(
  unmatchedCards
) {
  unmatchedCardsList.innerHTML = "";

  if (unmatchedCards.length === 0) {
    unmatchedArea.classList.add(
      "hidden"
    );

    return;
  }

  for (
    const cardName
    of unmatchedCards
  ) {
    const item =
      document.createElement("li");

    item.textContent =
      cardName;

    unmatchedCardsList.appendChild(
      item
    );
  }

  unmatchedArea.classList.remove(
    "hidden"
  );
}


/*
 * ------------------------------------------------------------
 * UI helpers
 * ------------------------------------------------------------
 */

function resetResults() {
  setResults.innerHTML = "";

  bestSet.classList.add("hidden");
  unmatchedArea.classList.add("hidden");

  bestSetName.textContent = "";
  bestSetStats.textContent = "";

  cardCount.textContent = "0";
  setCount.textContent = "0";
  unmatchedCount.textContent = "0";

  progressBarFill.style.width = "0%";
}


function updateProgress(
  current,
  total,
  message
) {
  statusMessage.textContent =
    message;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          current /
          total *
          100
        );

  progressBarFill.style.width =
    `${percentage}%`;
}


function delay(ms) {
  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );
}
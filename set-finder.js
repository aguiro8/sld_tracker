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

const SCRYFALL_DELAY_MS = 550;

/*
 * Change this threshold if you want.
 *
 * Cards at or above this price are considered
 * "expensive" for the summary.
 */
const EXPENSIVE_THRESHOLD = 25;


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
    if (isSectionHeading(line)) {
      continue;
    }

    line = line.replace(
      /^\d+\s*x?\s+/i,
      ""
    );

    line = line.replace(
      /\s+\([A-Za-z0-9]+\)\s+[A-Za-z0-9★]+(?:\s+.*)?$/,
      ""
    );

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
  const query = `!"${cardName}"`;

  let url =
    "https://api.scryfall.com/cards/search" +
    `?unique=prints&order=released&q=${encodeURIComponent(query)}`;

  const printings = [];

  while (url) {
    const response = await fetch(url);

    if (response.status === 404) {
      return [];
    }

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

    if (data.has_more && data.next_page) {
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
 * Price helpers
 * ------------------------------------------------------------
 */

/*
 * Scryfall prices are strings or null:
 *
 * {
 *   usd: "2.15",
 *   usd_foil: "5.20",
 *   usd_etched: null
 * }
 *
 * This returns the cheapest available USD price
 * for the specific printing.
 */
function getCheapestPrintingPrice(printing) {
  const priceOptions = [];

  const usd =
    parsePrice(printing.prices?.usd);

  const usdFoil =
    parsePrice(printing.prices?.usd_foil);

  const usdEtched =
    parsePrice(printing.prices?.usd_etched);

  if (usd !== null) {
    priceOptions.push({
      price: usd,
      finish: "normal"
    });
  }

  if (usdFoil !== null) {
    priceOptions.push({
      price: usdFoil,
      finish: "foil"
    });
  }

  if (usdEtched !== null) {
    priceOptions.push({
      price: usdEtched,
      finish: "etched"
    });
  }

  if (priceOptions.length === 0) {
    return null;
  }

  priceOptions.sort(
    (a, b) => a.price - b.price
  );

  return priceOptions[0];
}


function parsePrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number.parseFloat(value);

  return Number.isFinite(number)
    ? number
    : null;
}


function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(value)
  ) {
    return "N/A";
  }

  return value.toLocaleString(
    "en-US",
    {
      style: "currency",
      currency: "USD"
    }
  );
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
   * Store the cheapest printing for this card
   * within each set.
   */
  const bestPrintingPerSet = new Map();

  for (const printing of printings) {
    if (
      paperOnly &&
      !printing.games?.includes("paper")
    ) {
      continue;
    }

    if (
      excludeSecretLair &&
      isSecretLairPrinting(printing)
    ) {
      continue;
    }

    if (
      excludePromos &&
      printing.promo === true
    ) {
      continue;
    }

    const setCode =
      printing.set;

    if (!setCode) {
      continue;
    }

    const priceInfo =
      getCheapestPrintingPrice(printing);

    const existing =
      bestPrintingPerSet.get(setCode);

    /*
     * If we haven't seen this set yet,
     * store this printing.
     */
    if (!existing) {
      bestPrintingPerSet.set(
        setCode,
        {
          printing,
          priceInfo
        }
      );

      continue;
    }

    /*
     * Prefer a printing with a known price
     * over one with no price.
     */
    if (
      !existing.priceInfo &&
      priceInfo
    ) {
      bestPrintingPerSet.set(
        setCode,
        {
          printing,
          priceInfo
        }
      );

      continue;
    }

    /*
     * If both have prices,
     * keep the cheaper one.
     */
    if (
      existing.priceInfo &&
      priceInfo &&
      priceInfo.price <
        existing.priceInfo.price
    ) {
      bestPrintingPerSet.set(
        setCode,
        {
          printing,
          priceInfo
        }
      );
    }
  }

  /*
   * Add the chosen printing for each set.
   */
  for (
    const [setCode, result]
    of bestPrintingPerSet.entries()
  ) {
    const printing =
      result.printing;

    const priceInfo =
      result.priceInfo;

    if (!sets.has(setCode)) {
      sets.set(
        setCode,
        {
          code: setCode,
          name:
            printing.set_name ||
            setCode.toUpperCase(),
          setType:
            printing.set_type || "",
          cards: new Map()
        }
      );
    }

    sets
      .get(setCode)
      .cards
      .set(
        cardName,
        {
          name: cardName,

          price:
            priceInfo
              ? priceInfo.price
              : null,

          finish:
            priceInfo
              ? priceInfo.finish
              : null,

          collectorNumber:
            printing.collector_number || "",

          rarity:
            printing.rarity || "",

          scryfallUri:
            printing.scryfall_uri || "",

          purchaseUri:
            printing.purchase_uris?.tcgplayer || "",

          printingId:
            printing.id || ""
        }
      );
  }
}


function isSecretLairPrinting(printing) {
  const code =
    String(printing.set || "")
      .toLowerCase();

  const name =
    String(printing.set_name || "")
      .toLowerCase();

  return (
    code === "sld" ||
    name.includes("secret lair")
  );
}


/*
 * ------------------------------------------------------------
 * Ranking and totals
 * ------------------------------------------------------------
 */

function rankSets(
  sets,
  totalCards
) {
  return [...sets.values()]
    .map(set => {
      const cards =
        [...set.cards.values()]
          .sort(
            (a, b) =>
              a.name.localeCompare(b.name)
          );

      const pricedCards =
        cards.filter(
          card =>
            card.price !== null
        );

      const totalCost =
        pricedCards.reduce(
          (sum, card) =>
            sum + card.price,
          0
        );

      const averagePrice =
        pricedCards.length === 0
          ? null
          : totalCost /
            pricedCards.length;

      const expensiveCards =
        pricedCards
          .filter(
            card =>
              card.price >=
              EXPENSIVE_THRESHOLD
          )
          .sort(
            (a, b) =>
              b.price - a.price
          );

      const mostExpensive =
        [...pricedCards]
          .sort(
            (a, b) =>
              b.price - a.price
          )
          .slice(0, 5);

      const count =
        cards.length;

      return {
        code:
          set.code,

        name:
          set.name,

        setType:
          set.setType,

        cards,

        count,

        pricedCount:
          pricedCards.length,

        missingPriceCount:
          cards.length -
          pricedCards.length,

        totalCost,

        averagePrice,

        expensiveCards,

        mostExpensive,

        coverage:
          totalCards === 0
            ? 0
            : count /
              totalCards
      };
    })
    .sort(
      (a, b) => {
        /*
         * Most cards first.
         */
        if (
          b.count !==
          a.count
        ) {
          return (
            b.count -
            a.count
          );
        }

        /*
         * If coverage ties,
         * show cheaper set first.
         */
        if (
          a.totalCost !==
          b.totalCost
        ) {
          return (
            a.totalCost -
            b.totalCost
          );
        }

        return (
          a.name.localeCompare(
            b.name
          )
        );
      }
    );
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
          set.coverage *
          100
        ).toFixed(1);


      /*
       * Rank
       */
      const rankCell =
        document.createElement("td");

      rankCell.textContent =
        index + 1;


      /*
       * Set name
       */
      const nameCell =
        document.createElement("td");

      nameCell.textContent =
        set.name;


      /*
       * Set code
       */
      const codeCell =
        document.createElement("td");

      codeCell.className =
        "set-code";

      codeCell.textContent =
        set.code.toUpperCase();


      /*
       * Card count
       */
      const countCell =
        document.createElement("td");

      countCell.textContent =
        `${set.count} / ${totalCards}`;


      /*
       * Coverage
       */
      const coverageCell =
        document.createElement("td");

      coverageCell.textContent =
        `${coveragePercent}%`;


      /*
       * Total estimated cost
       */
      const costCell =
        document.createElement("td");

      costCell.textContent =
        formatCurrency(
          set.totalCost
        );

      if (
        set.missingPriceCount > 0
      ) {
        const note =
          document.createElement("div");

        note.className =
          "price-note";

        note.textContent =
          `${set.missingPriceCount} without price`;

        costCell.appendChild(
          note
        );
      }


      /*
       * Individual cards / expensive printings
       */
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

      details.appendChild(
        summary
      );


      /*
       * Expensive cards summary
       */
      if (
        set.expensiveCards.length >
        0
      ) {
        const expensiveBox =
          document.createElement("div");

        expensiveBox.className =
          "expensive-box";

        const heading =
          document.createElement("strong");

        heading.textContent =
          `Expensive printings ($${EXPENSIVE_THRESHOLD}+):`;

        expensiveBox.appendChild(
          heading
        );

        const expensiveList =
          document.createElement("ul");

        for (
          const card
          of set.expensiveCards
        ) {
          const item =
            document.createElement("li");

          item.textContent =
            `${card.name}: ${formatCurrency(card.price)} (${card.finish})`;

          expensiveList.appendChild(
            item
          );
        }

        expensiveBox.appendChild(
          expensiveList
        );

        details.appendChild(
          expensiveBox
        );
      }


      /*
       * Full card table
       */
      const cardTable =
        document.createElement("table");

      cardTable.className =
        "inner-card-table";

      const thead =
        document.createElement("thead");

      const headerRow =
        document.createElement("tr");

      [
        "Card",
        "Price",
        "Finish",
        "Rarity",
        "Collector #"
      ].forEach(label => {
        const th =
          document.createElement("th");

        th.textContent =
          label;

        headerRow.appendChild(
          th
        );
      });

      thead.appendChild(
        headerRow
      );

      cardTable.appendChild(
        thead
      );

      const tbody =
        document.createElement("tbody");

      for (
        const card
        of set.cards
      ) {
        const cardRow =
          document.createElement("tr");


        const nameTd =
          document.createElement("td");

        if (card.scryfallUri) {
          const link =
            document.createElement("a");

          link.href =
            card.scryfallUri;

          link.target =
            "_blank";

          link.rel =
            "noopener noreferrer";

          link.textContent =
            card.name;

          nameTd.appendChild(
            link
          );
        } else {
          nameTd.textContent =
            card.name;
        }


        const priceTd =
          document.createElement("td");

        priceTd.textContent =
          formatCurrency(
            card.price
          );

        if (
          card.price !== null &&
          card.price >=
            EXPENSIVE_THRESHOLD
        ) {
          priceTd.classList.add(
            "expensive-price"
          );
        }


        const finishTd =
          document.createElement("td");

        finishTd.textContent =
          card.finish || "N/A";


        const rarityTd =
          document.createElement("td");

        rarityTd.textContent =
          card.rarity || "N/A";


        const collectorTd =
          document.createElement("td");

        collectorTd.textContent =
          card.collectorNumber ||
          "N/A";


        cardRow.appendChild(
          nameTd
        );

        cardRow.appendChild(
          priceTd
        );

        cardRow.appendChild(
          finishTd
        );

        cardRow.appendChild(
          rarityTd
        );

        cardRow.appendChild(
          collectorTd
        );

        tbody.appendChild(
          cardRow
        );
      }

      cardTable.appendChild(
        tbody
      );

      details.appendChild(
        cardTable
      );

      cardsCell.appendChild(
        details
      );


      row.appendChild(
        rankCell
      );

      row.appendChild(
        nameCell
      );

      row.appendChild(
        codeCell
      );

      row.appendChild(
        countCell
      );

      row.appendChild(
        coverageCell
      );

      row.appendChild(
        costCell
      );

      row.appendChild(
        cardsCell
      );

      setResults.appendChild(
        row
      );
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

  bestSetStats.innerHTML = "";

  const coverageLine =
    document.createElement("div");

  coverageLine.textContent =
    `${set.count} of ${totalCards} cards — ${percentage}% coverage`;

  bestSetStats.appendChild(
    coverageLine
  );


  const costLine =
    document.createElement("div");

  costLine.textContent =
    `Estimated total: ${formatCurrency(set.totalCost)}`;

  bestSetStats.appendChild(
    costLine
  );


  if (
    set.averagePrice !== null
  ) {
    const averageLine =
      document.createElement("div");

    averageLine.textContent =
      `Average card price: ${formatCurrency(set.averagePrice)}`;

    bestSetStats.appendChild(
      averageLine
    );
  }


  if (
    set.missingPriceCount > 0
  ) {
    const missingLine =
      document.createElement("div");

    missingLine.textContent =
      `${set.missingPriceCount} card(s) had no USD price`;

    bestSetStats.appendChild(
      missingLine
    );
  }


  if (
    set.mostExpensive.length >
    0
  ) {
    const expensiveTitle =
      document.createElement("strong");

    expensiveTitle.textContent =
      "Most expensive:";

    bestSetStats.appendChild(
      expensiveTitle
    );

    const list =
      document.createElement("ul");

    for (
      const card
      of set.mostExpensive
    ) {
      const item =
        document.createElement("li");

      item.textContent =
        `${card.name}: ${formatCurrency(card.price)} (${card.finish})`;

      list.appendChild(
        item
      );
    }

    bestSetStats.appendChild(
      list
    );
  }

  bestSet.classList.remove(
    "hidden"
  );
}


function renderUnmatchedCards(
  unmatchedCards
) {
  unmatchedCardsList.innerHTML =
    "";

  if (
    unmatchedCards.length ===
    0
  ) {
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

  bestSet.classList.add(
    "hidden"
  );

  unmatchedArea.classList.add(
    "hidden"
  );

  bestSetName.textContent = "";
  bestSetStats.textContent = "";

  cardCount.textContent = "0";
  setCount.textContent = "0";
  unmatchedCount.textContent = "0";

  progressBarFill.style.width =
    "0%";
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
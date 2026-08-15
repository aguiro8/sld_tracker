const cardInput =
  document.getElementById("cardInput");

const analyzeButton =
  document.getElementById("analyzeButton");

const clearButton =
  document.getElementById("clearButton");

const paperOnlyCheckbox =
  document.getElementById("paperOnly");

const excludeSecretLairCheckbox =
  document.getElementById("excludeSecretLair");

const excludePromosCheckbox =
  document.getElementById("excludePromos");

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


const SCRYFALL_DELAY_MS = 550;
const EXPENSIVE_THRESHOLD = 25;


let isRunning = false;

let currentRankedSets = [];
let currentCardNames = [];

const selectedSetCodes =
  new Set();


/*
 * ------------------------------------------------------------
 * Events
 * ------------------------------------------------------------
 */

analyzeButton.addEventListener(
  "click",
  analyzeCards
);


clearButton.addEventListener(
  "click",
  () => {
    if (isRunning) {
      return;
    }

    cardInput.value = "";

    currentRankedSets = [];
    currentCardNames = [];

    selectedSetCodes.clear();

    setResults.innerHTML = "";

    resultsSection.classList.add(
      "hidden"
    );

    progressArea.classList.add(
      "hidden"
    );

    bestSet.classList.add(
      "hidden"
    );

    unmatchedArea.classList.add(
      "hidden"
    );

    cardCount.textContent = "0";
    setCount.textContent = "0";
    unmatchedCount.textContent = "0";

    progressBarFill.style.width =
      "0%";

    statusMessage.textContent =
      "Waiting...";

    updateDeckBuilder();
  }
);


clearSetsButton.addEventListener(
  "click",
  () => {
    selectedSetCodes.clear();

    document
      .querySelectorAll(".set-select")
      .forEach(
        checkbox => {
          checkbox.checked = false;
        }
      );

    updateDeckBuilder();
  }
);


/*
 * ------------------------------------------------------------
 * Main analysis
 * ------------------------------------------------------------
 */

async function analyzeCards() {
  if (isRunning) {
    return;
  }

  const cardNames =
    parseManaBoxList(
      cardInput.value
    );

  if (cardNames.length === 0) {
    alert(
      "No card names were found in the list."
    );

    return;
  }

  currentCardNames =
    cardNames;

  currentRankedSets = [];

  selectedSetCodes.clear();

  isRunning = true;

  analyzeButton.disabled = true;
  clearButton.disabled = true;

  analyzeButton.textContent =
    "Searching...";

  resetResults();

  progressArea.classList.remove(
    "hidden"
  );

  resultsSection.classList.remove(
    "hidden"
  );

  cardCount.textContent =
    cardNames.length;

  const sets =
    new Map();

  const unmatchedCards = [];

  try {
    for (
      let index = 0;
      index < cardNames.length;
      index++
    ) {
      const cardName =
        cardNames[index];

      updateProgress(
        index,
        cardNames.length,
        `Searching ${index + 1} of ${cardNames.length}: ${cardName}`
      );

      try {
        const printings =
          await getPrintings(
            cardName
          );

        if (
          printings.length === 0
        ) {
          unmatchedCards.push(
            cardName
          );
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

        unmatchedCards.push(
          cardName
        );
      }

      if (
        index <
        cardNames.length - 1
      ) {
        await delay(
          SCRYFALL_DELAY_MS
        );
      }
    }

    const rankedSets =
      rankSets(
        sets,
        cardNames.length
      );

    currentRankedSets =
      rankedSets;

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

    analyzeButton.textContent =
      "Find Best Sets";
  }
}


/*
 * ------------------------------------------------------------
 * Parse ManaBox / deck list
 * ------------------------------------------------------------
 */

function parseManaBoxList(text) {
  const names =
    new Set();

  const lines =
    text
      .split(/\r?\n/)
      .map(
        line =>
          line.trim()
      )
      .filter(Boolean);

  for (let line of lines) {
    if (
      isSectionHeading(line)
    ) {
      continue;
    }

    /*
     * Remove quantity:
     *
     * 1 Sol Ring
     * 4 Counterspell
     * 4x Counterspell
     */
    line =
      line.replace(
        /^\d+\s*x?\s+/i,
        ""
      );

    /*
     * Remove:
     *
     * (CMM) 396
     * (DMR) 45
     */
    line =
      line.replace(
        /\s+\([A-Za-z0-9]+\)\s+[A-Za-z0-9★]+(?:\s+.*)?$/,
        ""
      );

    /*
     * Remove foil markers.
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

    names.add(line);
  }

  return [...names];
}


function isSectionHeading(line) {
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


/*
 * ------------------------------------------------------------
 * Scryfall
 * ------------------------------------------------------------
 */

async function getPrintings(
  cardName
) {
  const query =
    `!"${cardName}"`;

  let url =
    "https://api.scryfall.com/cards/search" +
    `?unique=prints&order=released&q=${encodeURIComponent(query)}`;

  const printings = [];

  while (url) {
    const response =
      await fetch(url);

    if (
      response.status === 404
    ) {
      return [];
    }

    if (
      response.status === 429
    ) {
      throw new Error(
        "Scryfall rate limit reached. Wait and try again."
      );
    }

    if (!response.ok) {
      throw new Error(
        `Scryfall returned HTTP ${response.status}`
      );
    }

    const data =
      await response.json();

    if (
      Array.isArray(
        data.data
      )
    ) {
      printings.push(
        ...data.data
      );
    }

    if (
      data.has_more &&
      data.next_page
    ) {
      await delay(
        SCRYFALL_DELAY_MS
      );

      url =
        data.next_page;
    } else {
      url = null;
    }
  }

  return printings;
}


/*
 * ------------------------------------------------------------
 * Prices
 * ------------------------------------------------------------
 */

function parsePrice(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number.parseFloat(
      value
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}


function getCheapestPrintingPrice(
  printing
) {
  const options = [];

  const normal =
    parsePrice(
      printing.prices?.usd
    );

  const foil =
    parsePrice(
      printing.prices?.usd_foil
    );

  const etched =
    parsePrice(
      printing.prices?.usd_etched
    );

  if (normal !== null) {
    options.push({
      price: normal,
      finish: "normal"
    });
  }

  if (foil !== null) {
    options.push({
      price: foil,
      finish: "foil"
    });
  }

  if (etched !== null) {
    options.push({
      price: etched,
      finish: "etched"
    });
  }

  if (
    options.length === 0
  ) {
    return null;
  }

  options.sort(
    (a, b) =>
      a.price - b.price
  );

  return options[0];
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
 * Build set/card relationships
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
   * For each set, choose the cheapest
   * printing of this card.
   */
  const bestPrintingPerSet =
    new Map();

  for (
    const printing
    of printings
  ) {
    if (
      paperOnly &&
      !printing.games?.includes(
        "paper"
      )
    ) {
      continue;
    }

    if (
      excludeSecretLair &&
      isSecretLairPrinting(
        printing
      )
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
      getCheapestPrintingPrice(
        printing
      );

    const existing =
      bestPrintingPerSet.get(
        setCode
      );

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

  for (
    const [setCode, result]
    of bestPrintingPerSet.entries()
  ) {
    const printing =
      result.printing;

    const priceInfo =
      result.priceInfo;

    if (
      !sets.has(setCode)
    ) {
      sets.set(
        setCode,
        {
          code:
            setCode,

          name:
            printing.set_name ||
            setCode.toUpperCase(),

          setType:
            printing.set_type || "",

          cards:
            new Map()
        }
      );
    }

    sets
      .get(setCode)
      .cards
      .set(
        cardName,
        {
          name:
            cardName,

          price:
            priceInfo
              ? priceInfo.price
              : null,

          finish:
            priceInfo
              ? priceInfo.finish
              : null,

          collectorNumber:
            printing.collector_number ||
            "",

          rarity:
            printing.rarity ||
            "",

          scryfallUri:
            printing.scryfall_uri ||
            "",

          printingId:
            printing.id ||
            ""
        }
      );
  }
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
      printing.set_name || ""
    ).toLowerCase();

  return (
    code === "sld" ||
    name.includes(
      "secret lair"
    )
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
    .map(
      set => {
        const cards =
          [...set.cards.values()]
            .sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name
                )
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
                b.price -
                a.price
            );

        const mostExpensive =
          [...pricedCards]
            .sort(
              (a, b) =>
                b.price -
                a.price
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
 * Main result rendering
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

  if (
    rankedSets.length > 0
  ) {
    renderBestSet(
      rankedSets[0],
      totalCards
    );
  } else {
    bestSet.classList.add(
      "hidden"
    );
  }

  rankedSets.forEach(
    (set, index) => {
      const row =
        document.createElement(
          "tr"
        );

      /*
       * SELECT
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


      /*
       * RANK
       */
      const rankCell =
        document.createElement(
          "td"
        );

      rankCell.textContent =
        index + 1;


      /*
       * SET NAME
       */
      const nameCell =
        document.createElement(
          "td"
        );

      nameCell.textContent =
        set.name;


      /*
       * CODE
       */
      const codeCell =
        document.createElement(
          "td"
        );

      codeCell.className =
        "set-code";

      codeCell.textContent =
        set.code.toUpperCase();


      /*
       * CARDS
       */
      const countCell =
        document.createElement(
          "td"
        );

      countCell.textContent =
        `${set.count} / ${totalCards}`;


      /*
       * NEW CARDS
       */
      const newCardsCell =
        document.createElement(
          "td"
        );

      newCardsCell.className =
        "new-cards-cell";

      newCardsCell.dataset.setCode =
        set.code;

      newCardsCell.textContent =
        set.count;


      /*
       * COVERAGE
       */
      const coverageCell =
        document.createElement(
          "td"
        );

      coverageCell.textContent =
        `${(
          set.coverage *
          100
        ).toFixed(1)}%`;


      /*
       * COST
       */
      const costCell =
        document.createElement(
          "td"
        );

      costCell.textContent =
        formatCurrency(
          set.totalCost
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
          `${set.missingPriceCount} without price`;

        costCell.appendChild(
          note
        );
      }


      /*
       * DETAILS
       */
      const cardsCell =
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
        set.expensiveCards
          .length > 0
      ) {
        const expensiveBox =
          document.createElement(
            "div"
          );

        expensiveBox.className =
          "expensive-box";

        const heading =
          document.createElement(
            "strong"
          );

        heading.textContent =
          `Expensive printings ($${EXPENSIVE_THRESHOLD}+):`;

        expensiveBox.appendChild(
          heading
        );

        const list =
          document.createElement(
            "ul"
          );

        for (
          const card
          of set.expensiveCards
        ) {
          const item =
            document.createElement(
              "li"
            );

          item.textContent =
            `${card.name}: ${formatCurrency(card.price)} (${card.finish})`;

          list.appendChild(
            item
          );
        }

        expensiveBox.appendChild(
          list
        );

        details.appendChild(
          expensiveBox
        );
      }

      const cardTable =
        document.createElement(
          "table"
        );

      cardTable.className =
        "inner-card-table";

      const thead =
        document.createElement(
          "thead"
        );

      const headerRow =
        document.createElement(
          "tr"
        );

      [
        "Card",
        "Price",
        "Finish",
        "Rarity",
        "Collector #"
      ].forEach(
        label => {
          const th =
            document.createElement(
              "th"
            );

          th.textContent =
            label;

          headerRow.appendChild(
            th
          );
        }
      );

      thead.appendChild(
        headerRow
      );

      cardTable.appendChild(
        thead
      );

      const tbody =
        document.createElement(
          "tbody"
        );

      for (
        const card
        of set.cards
      ) {
        const cardRow =
          document.createElement(
            "tr"
          );

        const nameTd =
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

          nameTd.appendChild(
            link
          );
        } else {
          nameTd.textContent =
            card.name;
        }

        const priceTd =
          document.createElement(
            "td"
          );

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
          document.createElement(
            "td"
          );

        finishTd.textContent =
          card.finish ||
          "N/A";

        const rarityTd =
          document.createElement(
            "td"
          );

        rarityTd.textContent =
          card.rarity ||
          "N/A";

        const collectorTd =
          document.createElement(
            "td"
          );

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
        selectCell
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
        newCardsCell
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

  updateDeckBuilder();
}


/*
 * ------------------------------------------------------------
 * Best set
 * ------------------------------------------------------------
 */

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

  bestSetStats.innerHTML =
    "";

  const coverageLine =
    document.createElement(
      "div"
    );

  coverageLine.textContent =
    `${set.count} of ${totalCards} cards — ${percentage}% coverage`;

  bestSetStats.appendChild(
    coverageLine
  );

  const costLine =
    document.createElement(
      "div"
    );

  costLine.textContent =
    `Estimated total: ${formatCurrency(set.totalCost)}`;

  bestSetStats.appendChild(
    costLine
  );

  if (
    set.averagePrice !== null
  ) {
    const averageLine =
      document.createElement(
        "div"
      );

    averageLine.textContent =
      `Average card price: ${formatCurrency(set.averagePrice)}`;

    bestSetStats.appendChild(
      averageLine
    );
  }

  if (
    set.mostExpensive
      .length > 0
  ) {
    const title =
      document.createElement(
        "strong"
      );

    title.textContent =
      "Most expensive:";

    bestSetStats.appendChild(
      title
    );

    const list =
      document.createElement(
        "ul"
      );

    for (
      const card
      of set.mostExpensive
    ) {
      const item =
        document.createElement(
          "li"
        );

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


/*
 * ------------------------------------------------------------
 * Set selection / coverage
 * ------------------------------------------------------------
 */

function toggleSetSelection(
  setCode,
  selected
) {
  if (selected) {
    selectedSetCodes.add(
      setCode
    );
  } else {
    selectedSetCodes.delete(
      setCode
    );
  }

  updateDeckBuilder();
}


function calculateSelectedCoverage() {
  const coveredCards =
    new Map();

  const selectedSets = [];

  let totalCost = 0;

  /*
   * Process in ranking order.
   *
   * The first selected set that covers a card
   * becomes the source for that card.
   */
  for (
    const set
    of currentRankedSets
  ) {
    if (
      !selectedSetCodes.has(
        set.code
      )
    ) {
      continue;
    }

    const newCards = [];
    const duplicates = [];

    let contributionCost = 0;

    for (
      const card
      of set.cards
    ) {
      if (
        coveredCards.has(
          card.name
        )
      ) {
        duplicates.push(
          card
        );

        continue;
      }

      coveredCards.set(
        card.name,
        {
          ...card,
          sourceSet:
            set.code
        }
      );

      newCards.push(
        card
      );

      if (
        card.price !== null
      ) {
        totalCost +=
          card.price;

        contributionCost +=
          card.price;
      }
    }

    selectedSets.push({
      set,
      newCards,
      duplicates,
      contributionCost
    });
  }

  const remainingCards =
    currentCardNames.filter(
      cardName =>
        !coveredCards.has(
          cardName
        )
    );

  return {
    coveredCards,
    selectedSets,
    remainingCards,
    totalCost
  };
}


function updateDeckBuilder() {
  const result =
    calculateSelectedCoverage();

  const totalCards =
    currentCardNames.length;

  const covered =
    result.coveredCards.size;

  const remaining =
    result.remainingCards.length;

  selectedSetCount.textContent =
    selectedSetCodes.size;

  coveredCardCount.textContent =
    `${covered} / ${totalCards}`;

  remainingCardCount.textContent =
    remaining;

  selectedSetsCost.textContent =
    formatCurrency(
      result.totalCost
    );

  const percent =
    totalCards === 0
      ? 0
      : (
          covered /
          totalCards *
          100
        );

  coverageBarFill.style.width =
    `${percent}%`;

  coveragePercent.textContent =
    `${percent.toFixed(1)}% covered`;

  renderSelectedSets(
    result.selectedSets
  );

  renderRemainingCards(
    result.remainingCards
  );

  updateNewCardCounts(
    result.coveredCards
  );

  updateNextRecommendation(
    result.remainingCards
  );
}


/*
 * ------------------------------------------------------------
 * Selected set plan
 * ------------------------------------------------------------
 */

function renderSelectedSets(
  selectedSets
) {
  selectedSetsList.innerHTML =
    "";

  if (
    selectedSets.length === 0
  ) {
    const message =
      document.createElement(
        "p"
      );

    message.className =
      "empty-message";

    message.textContent =
      "No sets selected yet.";

    selectedSetsList.appendChild(
      message
    );

    return;
  }

  selectedSets.forEach(
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

      const name =
        document.createElement(
          "div"
        );

      name.className =
        "selected-set-name";

      name.textContent =
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
          selectedSetCodes.delete(
            entry.set.code
          );

          const checkbox =
            document.querySelector(
              `.set-select[data-set-code="${entry.set.code}"]`
            );

          if (checkbox) {
            checkbox.checked =
              false;
          }

          updateDeckBuilder();
        }
      );

      header.appendChild(
        name
      );

      header.appendChild(
        remove
      );

      const meta =
        document.createElement(
          "div"
        );

      meta.className =
        "selected-set-meta";

      const newCount =
        document.createElement(
          "span"
        );

      newCount.className =
        "new-card-count";

      newCount.textContent =
        `${entry.newCards.length} new cards`;

      const duplicateCount =
        document.createElement(
          "span"
        );

      duplicateCount.className =
        "duplicate-count";

      duplicateCount.textContent =
        ` · ${entry.duplicates.length} already covered`;

      const cost =
        document.createElement(
          "span"
        );

      cost.textContent =
        ` · ${formatCurrency(entry.contributionCost)} contribution`;

      meta.appendChild(
        newCount
      );

      meta.appendChild(
        duplicateCount
      );

      meta.appendChild(
        cost
      );

      wrapper.appendChild(
        header
      );

      wrapper.appendChild(
        meta
      );

      selectedSetsList.appendChild(
        wrapper
      );
    }
  );
}


/*
 * ------------------------------------------------------------
 * Remaining cards
 * ------------------------------------------------------------
 */

function renderRemainingCards(
  remainingCards
) {
  remainingCardsList.innerHTML =
    "";

  if (
    currentCardNames.length === 0
  ) {
    return;
  }

  if (
    remainingCards.length === 0
  ) {
    const complete =
      document.createElement(
        "div"
      );

    complete.className =
      "complete-message";

    complete.textContent =
      "All cards are covered by your selected sets.";

    remainingCardsList.appendChild(
      complete
    );

    return;
  }

  for (
    const cardName
    of remainingCards
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
      cardName;

    const availability =
      document.createElement(
        "span"
      );

    const availableSetCount =
      currentRankedSets.filter(
        set =>
          set.cards.some(
            card =>
              card.name ===
              cardName
          )
      ).length;

    availability.textContent =
      `${availableSetCount} sets`;

    availability.className =
      "price-note";

    row.appendChild(
      name
    );

    row.appendChild(
      availability
    );

    remainingCardsList.appendChild(
      row
    );
  }
}


/*
 * ------------------------------------------------------------
 * Dynamic "new cards" column
 * ------------------------------------------------------------
 */

function updateNewCardCounts(
  coveredCards
) {
  for (
    const set
    of currentRankedSets
  ) {
    let newCards = 0;

    for (
      const card
      of set.cards
    ) {
      if (
        !coveredCards.has(
          card.name
        )
      ) {
        newCards++;
      }
    }

    if (
      selectedSetCodes.has(
        set.code
      )
    ) {
      newCards = 0;
    }

    const cell =
      document.querySelector(
        `.new-cards-cell[data-set-code="${set.code}"]`
      );

    if (!cell) {
      continue;
    }

    cell.textContent =
      newCards;

    if (
      newCards > 0
    ) {
      cell.classList.add(
        "new-card-count"
      );
    } else {
      cell.classList.remove(
        "new-card-count"
      );
    }
  }
}


/*
 * ------------------------------------------------------------
 * Best next set
 * ------------------------------------------------------------
 */

function updateNextRecommendation(
  remainingCards
) {
  remainingRecommendation.innerHTML =
    "";

  if (
    remainingCards.length === 0 ||
    currentRankedSets.length === 0
  ) {
    remainingRecommendation.classList.add(
      "hidden"
    );

    return;
  }

  const remainingSet =
    new Set(
      remainingCards
    );

  let bestSet = null;
  let bestNewCards = [];
  let bestCost = null;

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
          remainingSet.has(
            card.name
          )
      );

    const newCardCost =
      newCards.reduce(
        (sum, card) =>
          sum +
          (
            card.price ??
            0
          ),
        0
      );

    if (
      newCards.length >
      bestNewCards.length
    ) {
      bestSet =
        set;

      bestNewCards =
        newCards;

      bestCost =
        newCardCost;

      continue;
    }

    /*
     * Tie-break:
     * same number of new cards,
     * cheaper contribution wins.
     */
    if (
      newCards.length ===
        bestNewCards.length &&
      newCards.length > 0 &&
      (
        bestCost === null ||
        newCardCost <
          bestCost
      )
    ) {
      bestSet =
        set;

      bestNewCards =
        newCards;

      bestCost =
        newCardCost;
    }
  }

  if (
    !bestSet ||
    bestNewCards.length === 0
  ) {
    remainingRecommendation.classList.add(
      "hidden"
    );

    return;
  }

  const title =
    document.createElement(
      "strong"
    );

  title.textContent =
    "Best next set: ";

  const text =
    document.createElement(
      "span"
    );

  text.textContent =
    `${bestSet.name} (${bestSet.code.toUpperCase()}) adds ${bestNewCards.length} remaining cards for about ${formatCurrency(bestCost)}.`;

  const button =
    document.createElement(
      "button"
    );

  button.type =
    "button";

  button.style.marginTop =
    "10px";

  button.textContent =
    `Add ${bestSet.code.toUpperCase()}`;

  button.addEventListener(
    "click",
    () => {
      selectedSetCodes.add(
        bestSet.code
      );

      const checkbox =
        document.querySelector(
          `.set-select[data-set-code="${bestSet.code}"]`
        );

      if (checkbox) {
        checkbox.checked =
          true;
      }

      updateDeckBuilder();
    }
  );

  remainingRecommendation.appendChild(
    title
  );

  remainingRecommendation.appendChild(
    text
  );

  remainingRecommendation.appendChild(
    document.createElement(
      "br"
    )
  );

  remainingRecommendation.appendChild(
    button
  );

  remainingRecommendation.classList.remove(
    "hidden"
  );
}


/*
 * ------------------------------------------------------------
 * Unmatched
 * ------------------------------------------------------------
 */

function renderUnmatchedCards(
  unmatchedCards
) {
  unmatchedCardsList.innerHTML =
    "";

  if (
    unmatchedCards.length === 0
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
      document.createElement(
        "li"
      );

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

  cardCount.textContent =
    currentCardNames.length;

  setCount.textContent = "0";
  unmatchedCount.textContent = "0";

  progressBarFill.style.width =
    "0%";

  updateDeckBuilder();
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
      setTimeout(
        resolve,
        ms
      )
  );
}
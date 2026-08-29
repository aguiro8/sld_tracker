async function getLatestSLDReleaseGroups() {
    let url = new URL("https://api.scryfall.com/cards/search");

    url.searchParams.set("q", "set:sld");
    url.searchParams.set("unique", "prints");
    url.searchParams.set("order", "released");
    url.searchParams.set("dir", "desc");

    const groups = new Map();

    while (url) {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Scryfall request failed: ${response.status}`);
        }

        const payload = await response.json();

        for (const card of payload.data) {
            if (!groups.has(card.released_at)) {
                groups.set(card.released_at, []);
            }

            groups.get(card.released_at).push(card);
        }

        url = payload.has_more
            ? new URL(payload.next_page)
            : null;
    }

    return Array.from(groups.entries());
}

const resultsEl = document.getElementById("sld-results");
const statusEl = document.getElementById("statusMessage");

function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
}

function groupCardsByCollectorSequence(cards) {
    const sortedCards = [...cards].sort((left, right) => {
        return Number(left.collector_number) - Number(right.collector_number);
    });
    const groups = [];

    for (const card of sortedCards) {
        const cardNumber = Number(card.collector_number);
        const currentGroup = groups.at(-1);
        const previousNumber = currentGroup && Number(currentGroup.at(-1).collector_number);

        if (!currentGroup || !Number.isFinite(cardNumber) || cardNumber !== previousNumber + 1) {
            groups.push([card]);
        } else {
            currentGroup.push(card);
        }
    }

    return groups;
}

function collectorRange(cards) {
    const first = cards[0].collector_number;
    const last = cards.at(-1).collector_number;
    return first === last ? `Collector #${first}` : `Collector #${first}-${last}`;
}

async function getScryfallDropGroups() {
    const response = await fetch("https://scryfall.com/sets/sld");
    if (!response.ok) {
        throw new Error(`Scryfall set page failed: ${response.status}`);
    }

    const html = await response.text();
    const documentFragment = new DOMParser().parseFromString(html, "text/html");

    return [...documentFragment.querySelectorAll("h2.card-grid-header")].map(heading => {
        const link = heading.querySelector("a[href*='/search?']");
        const query = link ? new URL(link.getAttribute("href"), "https://scryfall.com").searchParams.get("q") || "" : "";
        const ranges = [...query.matchAll(/cn[≥>=](\S+)\s+cn[≤<=](\S+)/g)].map(match => ({
            start: Number(match[1]),
            end: Number(match[2]) - 1
        }));
        const exactNumbers = [...query.matchAll(/cn:"([^"]+)"/g)].map(match => match[1]);

        return {
            name: heading.id
                .split("-")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" "),
            displayName: heading.querySelector(".card-grid-header-content")?.childNodes[0]?.textContent.trim() || heading.id,
            ranges,
            exactNumbers
        };
    });
}

function findDropGroup(card, dropGroups) {
    return dropGroups.find(group => {
        if (group.exactNumbers.includes(card.collector_number)) {
            return true;
        }

        const number = Number(card.collector_number);
        return group.ranges.some(range => Number.isFinite(number) && number >= range.start && number <= range.end);
    });
}

async function loadLatestSecretLairs() {
    try {
        const [groups, dropGroups] = await Promise.all([
            getLatestSLDReleaseGroups(),
            getScryfallDropGroups()
        ]);
        resultsEl.innerHTML = "";

        for (const [releaseDate, cards] of groups) {
            const section = document.createElement("section");
            section.className = "secret-value-group";

            const heading = document.createElement("h2");
            heading.textContent = releaseDate;
            section.appendChild(heading);

            const namedGroups = new Map();
            const unnamedCards = [];

            for (const card of cards) {
                const dropGroup = findDropGroup(card, dropGroups);
                if (dropGroup) {
                    if (!namedGroups.has(dropGroup.displayName)) {
                        namedGroups.set(dropGroup.displayName, []);
                    }
                    namedGroups.get(dropGroup.displayName).push(card);
                } else {
                    unnamedCards.push(card);
                }
            }

            const cardGroups = [...namedGroups.entries()];
            for (const cardGroup of groupCardsByCollectorSequence(unnamedCards)) {
                cardGroups.push([collectorRange(cardGroup), cardGroup]);
            }

            for (const [groupName, cardGroup] of cardGroups) {
                const rangeHeading = document.createElement("h3");
                rangeHeading.textContent = groupName;
                section.appendChild(rangeHeading);

                const list = document.createElement("ul");
                for (const card of cardGroup) {
                    const item = document.createElement("li");
                    item.innerHTML = `
                        <img src="${escapeHtml(card.image_uris?.normal ?? card.image_uris?.small ?? "")}" alt="${escapeHtml(card.name)}" loading="lazy">
                        <strong>${escapeHtml(card.name)}</strong>
                        <span>Collector #${escapeHtml(card.collector_number)}</span>
                        <span>USD: ${escapeHtml(card.prices?.usd ?? "N/A")}</span>
                        <span>Foil: ${escapeHtml(card.prices?.usd_foil ?? "N/A")}</span>
                        <a href="${escapeHtml(card.scryfall_uri)}" target="_blank" rel="noopener noreferrer">View on Scryfall</a>
                    `;
                    list.appendChild(item);
                }
                section.appendChild(list);
            }

            resultsEl.appendChild(section);
        }

        statusEl.textContent = `${groups.reduce((total, [, cards]) => total + cards.length, 0)} cards across ${groups.length} release dates`;
    } catch (error) {
        console.error(error);
        statusEl.textContent = "Unable to load Secret Lair data.";
        resultsEl.textContent = "Try refreshing the page to request the latest data.";
    }
}

loadLatestSecretLairs();
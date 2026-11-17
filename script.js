// script.js
// Frontend logic: fetch data from OUR server (/api/coins), show it in the
// table, and handle search, pagination and automatic refresh.

// ---------- Settings ----------
const REFRESH_INTERVAL_MS = 60 * 1000; // refresh every 60 seconds
const SEARCH_DELAY_MS = 400;           // wait for the user to stop typing
const MAX_PAGES = 50;                  // 50 pages x 20 coins = top 1000 coins

// ---------- Page elements ----------
const searchInput = document.getElementById("search-input");
const listTitle = document.getElementById("list-title");
const lastUpdated = document.getElementById("last-updated");
const errorBox = document.getElementById("error-box");
const errorText = document.getElementById("error-text");
const retryButton = document.getElementById("retry-button");
const loading = document.getElementById("loading");
const emptyMessage = document.getElementById("empty-message");
const tableWrapper = document.getElementById("table-wrapper");
const coinList = document.getElementById("coin-list");
const pagination = document.getElementById("pagination");
const prevButton = document.getElementById("prev-button");
const nextButton = document.getElementById("next-button");
const pageInfo = document.getElementById("page-info");

// ---------- App state ----------
let currentPage = 1;
let searchQuery = "";
let latestRequestId = 0; // used to ignore outdated responses
let searchTimer = null;

// ---------- Formatting helpers ----------
const usdWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatPrice(price) {
  if (price === null || price === undefined) return "—";
  // Cheap coins need more decimals to be readable.
  const digits = price < 1 ? 6 : 2;
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

function formatBigNumber(value) {
  if (value === null || value === undefined) return "—";
  return usdWhole.format(value);
}

function formatChange(change) {
  if (change === null || change === undefined) {
    return { text: "—", className: "" };
  }
  const sign = change > 0 ? "+" : "";
  return {
    text: `${sign}${change.toFixed(2)}%`,
    className: change >= 0 ? "positive" : "negative",
  };
}

// Escape text from the API before putting it into HTML (safety).
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text ?? "");
  return div.innerHTML;
}

// ---------- Show / hide parts of the page ----------
function showLoading(isLoading) {
  loading.hidden = !isLoading;
}

function showError(message) {
  errorText.textContent = message;
  errorBox.hidden = false;
}

function hideError() {
  errorBox.hidden = true;
}

function clearTable() {
  coinList.innerHTML = "";
  tableWrapper.hidden = true;
  emptyMessage.hidden = true;
  pagination.hidden = true;
}

// ---------- Drawing the table ----------
function renderCoins(coins) {
  coinList.innerHTML = "";
  emptyMessage.hidden = true;

  if (coins.length === 0) {
    tableWrapper.hidden = true;
    emptyMessage.hidden = false;
    return;
  }

  const rows = coins.map((coin) => {
    const change = formatChange(coin.price_change_percentage_24h);
    return `
      <tr>
        <td class="coin-td">
          <div class="coin-cell">
            <img src="${escapeHtml(coin.image)}" alt="" loading="lazy" />
            <div>
              <div class="coin-name">${escapeHtml(coin.name)}</div>
              <div class="coin-symbol">${escapeHtml(coin.symbol)}</div>
            </div>
          </div>
        </td>
        <td class="num" data-label="Price">${formatPrice(coin.current_price)}</td>
        <td class="num ${change.className}" data-label="24h change">${change.text}</td>
        <td class="num" data-label="Market cap">${formatBigNumber(coin.market_cap)}</td>
        <td class="num" data-label="24h volume">${formatBigNumber(coin.total_volume)}</td>
      </tr>
    `;
  });

  coinList.innerHTML = rows.join("");
  tableWrapper.hidden = false;
}

function updatePagination() {
  // Pagination only applies to the normal list, not to search results.
  if (searchQuery || tableWrapper.hidden) {
    pagination.hidden = true;
    return;
  }
  pagination.hidden = false;
  pageInfo.textContent = `Page ${currentPage} of ${MAX_PAGES}`;
  prevButton.disabled = currentPage <= 1;
  nextButton.disabled = currentPage >= MAX_PAGES;
}

function updateTitle() {
  listTitle.textContent = searchQuery
    ? `Results for “${searchQuery}”`
    : "Top cryptocurrencies by market cap";
}

// ---------- Loading data ----------
// silent = true is used for the automatic refresh: no spinner, and the
// current table stays visible while new data loads.
async function loadCoins(silent = false) {
  const requestId = ++latestRequestId;

  hideError();
  if (!silent) {
    clearTable();
    showLoading(true);
  }

  try {
    const params = new URLSearchParams({ page: currentPage });
    if (searchQuery) params.set("query", searchQuery);

    const response = await fetch(`/api/coins?${params}`);
    const data = await response.json().catch(() => ({}));

    // A newer request was started, so ignore this old answer.
    if (requestId !== latestRequestId) return;

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong. Please try again.");
    }

    renderCoins(data);
    updatePagination();
    lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;
  } catch (error) {
    if (requestId !== latestRequestId) return;

    // fetch() itself failed (server stopped, no connection)
    const message =
      error instanceof TypeError
        ? "Cannot reach the server. Make sure it is running and you are online."
        : error.message;
    showError(message);
  } finally {
    if (requestId === latestRequestId) showLoading(false);
  }
}

// ---------- Events ----------
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value.trim();
    currentPage = 1;
    updateTitle();
    loadCoins();
  }, SEARCH_DELAY_MS);
});

prevButton.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    loadCoins();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

nextButton.addEventListener("click", () => {
  if (currentPage < MAX_PAGES) {
    currentPage++;
    loadCoins();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});

retryButton.addEventListener("click", () => loadCoins());

// ---------- Start the app ----------
loadCoins();

// Refresh every 60 seconds (skipped while the tab is in the background,
// which saves API calls).
setInterval(() => {
  if (!document.hidden) loadCoins(true);
}, REFRESH_INTERVAL_MS);

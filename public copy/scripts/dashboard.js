/**
 * Dashboard page behaviors: statistics, tables, and UI updates.
 * - Reads unified `meno_events` storage and computes daily stats.
 * - Renders three summary cards and today's items tables.
 * - Updates progress, rotates quotes, and keeps UI in sync.
 */

// CONSTANTS
const QUOTE_INTERVAL_MS = 6000; // Rotate quotes every 6 seconds
const STORE_KEY = 'meno_events'; // LocalStorage key for all event data

// DOM ELEMENT REFERENCES
const progressBar = document.querySelector('.progress-bar');
const percentageTxt = document.querySelector('.percentage');
const tasksCardCount = document.querySelector('.stat-right .stat:nth-child(2) span:last-child');
const mealsCardCount = document.querySelector('.stat-right .stat:nth-child(3) span:last-child');
const plansCardCount = document.querySelector('.stat-right .stat:nth-child(4) span:last-child');

const todaysTasksTbody = document.querySelector('#dashboard .today .table:nth-child(1) tbody');
const todaysMealsTbody = document.querySelector('#dashboard .today .table:nth-child(2) tbody');
const todaysShoppingTbody = document.querySelector('#dashboard .today .table:nth-child(3) tbody');

const quoteEl = document.querySelector('.quote') || document.querySelector('.daily-quote');

/*
 * STORAGE UTILITIES
 */

// Creates a standardized date key for storage
function makeDateKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/*
 * PROGRESS DIAL FUNCTIONS
 */

// Rotates the progress dial based on completion percentage
function rotateProgress(perc) {
  if (!progressBar) return;

  if (perc > 100) perc = 100;
  if (perc < 0) perc = 0;

  const start = -225, mid = -135, end = -45;
  let rot = perc <= 50
    ? start + (mid - start) * (perc / 50)
    : mid + (end - mid) * ((perc - 50) / 50);

  progressBar.style.transform = `rotate(${rot}deg)`;
  if (percentageTxt) percentageTxt.textContent = `${perc}%`;
}

/*
 * DATA RETRIEVAL FUNCTIONS
 */

// Retrieves today's data organized by type
function getTodayData() {
  const key = makeDateKey();
  const store = readStore();
  const todays = store[key] || [];

  const events = todays.filter(it => (it.type || 'event') === 'event');
  const meals = todays.filter(it => it.type === 'meal');
  const plans = todays.filter(it => it.type === 'shopping');

  return { events, meals, plans, raw: todays };
}

// Calculates overview statistics for today
function calculateTodayOverview() {
  const { events, meals, plans } = getTodayData();

  const eventsTotal = events.length;
  const eventsDone = events.filter(it => !!it.completed).length;

  const mealsTotal = meals.length;
  const mealsDone = meals.filter(it => !!it.completed).length;

  const plansTotal = plans.length;
  const plansDone = plans.filter(it => !!it.completed).length;

  const grandTotal = eventsTotal + mealsTotal + plansTotal;
  const grandDone = eventsDone + mealsDone + plansDone;
  const percentage = grandTotal === 0 ? 0 : Math.round((grandDone / grandTotal) * 100);

  return {
    eventsTotal, eventsDone,
    mealsTotal, mealsDone,
    plansTotal, plansDone,
    grandTotal, grandDone, percentage
  };
}

/*
 * TABLE RENDERING FUNCTIONS
 */

// Renders table rows for a given item list
function renderTableRows(container, list, typeKey) {
  if (!container) return;
  container.innerHTML = '';

  if (!list || !list.length) {
    container.innerHTML = `<tr><td colspan="${typeKey === 'events' ? 3 : 4}"><small class="muted">No items for today</small></td></tr>`;
    return;
  }

  list.forEach((item, idx) => {
    const title = escapeHtml(item.title || 'Untitled');
    const time = escapeHtml(item.time || '');
    const checkedAttr = item.completed ? 'checked' : '';

    if (typeKey === 'events') {
      container.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${title}</td>
          <td>${time}</td>
          <td style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" class="dashboard-checkbox complete-checkbox" data-type="event" data-idx="${idx}" ${checkedAttr}>
          </td>
        </tr>
      `);
    } else if (typeKey === 'meals') {
      const period = escapeHtml(item.period || '');
      container.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${title}</td>
          <td>${period}</td>
          <td style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" class="dashboard-checkbox complete-checkbox" data-type="meal" data-idx="${idx}" ${checkedAttr}>
          </td>
        </tr>
      `);
    } else if (typeKey === 'shopping') {
      const location = escapeHtml(item.location || '');
      container.insertAdjacentHTML('beforeend', `
        <tr>
          <td>${title}</td>
          <td>${location}</td>
          <td>${time}</td>
          <td style="display:flex;align-items:center;gap:12px;">
            <input type="checkbox" class="dashboard-checkbox complete-checkbox" data-type="shopping" data-idx="${idx}" ${checkedAttr}>
          </td>
        </tr>
      `);
    }
  });

  container.querySelectorAll('.dashboard-checkbox').forEach(box => {
    box.removeEventListener('change', dashboardCheckboxHandler);
    box.addEventListener('change', dashboardCheckboxHandler);
  });
}

/*
 * EVENT HANDLERS
 */

// Handles checkbox state changes for item completion
function dashboardCheckboxHandler(e) {
  const type = e.target.dataset.type;
  const idx = parseInt(e.target.dataset.idx, 10);
  if (isNaN(idx)) return;

  const key = makeDateKey();
  const store = readStore();
  const todays = store[key] || [];

  const sourceIndices = [];
  todays.forEach((it, i) => {
    const t = it.type || 'event';
    if (type === 'event' && t === 'event') sourceIndices.push(i);
    if (type === 'meal' && t === 'meal') sourceIndices.push(i);
    if (type === 'shopping' && t === 'shopping') sourceIndices.push(i);
  });

  const realIndex = sourceIndices[idx];
  if (realIndex === undefined) return;

  if (!store[key] || !store[key][realIndex]) return;
  store[key][realIndex].completed = e.target.checked;
  writeStore(store);

  refreshDashboard();
  if (typeof renderCalendar === 'function') renderCalendar();
  if (typeof renderListForCurrentFilter === 'function') renderListForCurrentFilter();
}

/*
 * UI UPDATE FUNCTIONS
 */

// Updates statistics cards with today's data
function updateStatCardsFromToday() {
  const stats = calculateTodayOverview();

  if (tasksCardCount) tasksCardCount.innerHTML = `${stats.eventsDone}<small>/${stats.eventsTotal}</small>`;
  if (mealsCardCount) mealsCardCount.innerHTML = `${stats.mealsDone}<small>/${stats.mealsTotal}</small>`;
  if (plansCardCount) plansCardCount.innerHTML = `${stats.plansDone}<small>/${stats.plansTotal}</small>`;

  rotateProgress(stats.percentage);
}

// Populates today's data tables
async function populateTodaysTables() {
  const { events, meals, plans } = getTodayData();
  renderTableRows(todaysTasksTbody, events, 'events');
  renderTableRows(todaysMealsTbody, meals, 'meals');
  renderTableRows(todaysShoppingTbody, plans, 'shopping');
}

/**
 * Main dashboard refresh function
 * Updates all dashboard UI elements when data changes
 */
async function refreshDashboard() {
  updateStatCardsFromToday();
  await populateTodaysTables();
  // reapply dashboard search after tables are (re)rendered
  const ds = document.getElementById('dashboardSearch');
  if (ds) filterDashboardTables(ds.value);
}

/**
 * SEARCH / FILTER: Dashboard tables
 * Filters today's tables by query (non-destructive)
 * Matches against each row's visible text content.
 */
function filterDashboardTables(query) {
  const q = (query || '').trim().toLowerCase();
  const tables = [todaysTasksTbody, todaysMealsTbody, todaysShoppingTbody];

  tables.forEach(tbody => {
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    // find placeholder row (the row with small.muted)
    const placeholder = rows.find(r => r.querySelector && r.querySelector('small.muted'));
    let matched = 0;

    rows.forEach(row => {
      // skip placeholder from normal matching
      if (row.querySelector && row.querySelector('small.muted')) return;
      const text = (row.textContent || '').toLowerCase();
      if (!q || text.includes(q)) {
        row.style.display = '';
        matched++;
      } else {
        row.style.display = 'none';
      }
    });

    if (placeholder) {
      if (!q) {
        placeholder.style.display = '';
        const small = placeholder.querySelector('small.muted');
        if (small) small.textContent = 'No items for today';
      } else {
        if (matched === 0) {
          placeholder.style.display = '';
          const small = placeholder.querySelector('small.muted');
          if (small) small.textContent = 'No results';
        } else {
          placeholder.style.display = 'none';
        }
      }
    }
  });
}

// attach search input handler (if present in view)
const dashboardSearch = document.getElementById('dashboardSearch');
if (dashboardSearch) {
  dashboardSearch.addEventListener('input', e => filterDashboardTables(e.target.value));
}

// QUOTE ROTATION
const quotes = [
  "Today is your fresh start.",
  "Small steps lead to big change.",
  "You are building your future.",
  "Stay consistent. Results follow.",
  "Every day is progress."
];

// Rotates to a random motivational quote
function rotateQuote() {
  if (!quoteEl) return;
  const idx = Math.floor(Math.random() * quotes.length);
  const span = quoteEl.querySelector('span');
  if (span) span.textContent = quotes[idx];
  else quoteEl.textContent = quotes[idx];
}

// INITIALIZATION
window.addEventListener('load', () => {
  try {
    refreshDashboard();
    rotateQuote();
    setInterval(rotateQuote, QUOTE_INTERVAL_MS);

    window.clearAllMenoData = function () {
      localStorage.removeItem(STORE_KEY);
      alert("✓ Meno data cleared (development use only)");
      refreshDashboard();
      if (typeof renderCalendar === 'function') renderCalendar();
    };

    if (typeof setActiveNav === 'function') setActiveNav();
  } catch (e) {
    console.error("Dashboard initialization error:", e);
  }
});

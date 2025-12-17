/**
 * Responsibilities:
 * - Read and write unified storage (`meno_events`).
 * - Render calendar and list views, handle CRUD and drag/drop.
 * - Sync Google holidays via a server proxy.
 */

// Constants & API and storage constants used by this module
const STORE_KEY = 'meno_events';
const LEGACY_MEALS = 'meno_meals';
const LEGACY_PLANS = 'meno_plans';
const MIGRATED_FLAG = 'meno_events_migrated_v1';
const GOOGLE_SYNCED_FLAG = 'meno_google_synced_v1';

// DOM Elements
const calendarDays = document.getElementById("calendarDays");
const monthYear = document.getElementById("monthYear");
const selectedDateText = document.getElementById("selectedDate");
const eventList = document.getElementById("eventList");
const noEvent = document.getElementById("noEvent");
const eventForm = document.getElementById("eventForm");
const addEventBtn = document.getElementById("addEventBtn");
const cancelEvent = document.getElementById("cancelEvent");
const saveEvent = document.getElementById("saveEvent");
const eventTitle = document.getElementById("eventTitle");
const eventTime = document.getElementById("eventTime");
const toastContainer = document.getElementById("toastContainer");
const formTitle = document.querySelector('.form-title');

// Global State & Runtime state variables
let currentDate = new Date();
let selectedDate = null;
let editIndex = null;
let currentFilterType = null;
const today = new Date();

/**
 * Storage Utilities & Helpers for reading/writing and migration
 * Migrates data from legacy separate storage keys to unified storage
 * Non-destructive: preserves original legacy keys
 */
function migrateLegacyStoresIfNeeded() {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    
    const legacyMealsRaw = localStorage.getItem(LEGACY_MEALS);
    const legacyPlansRaw = localStorage.getItem(LEGACY_PLANS);
    
    if (!legacyMealsRaw && !legacyPlansRaw) {
      localStorage.setItem(MIGRATED_FLAG, '1');
      return;
    }

    const store = readStore();

    // Migrate meals
    if (legacyMealsRaw) {
      try {
        const parsed = JSON.parse(legacyMealsRaw || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([dateKey, list]) => {
            if (!Array.isArray(list)) return;
            if (!store[dateKey]) store[dateKey] = [];
            list.forEach(item => {
              const normalized = {
                title: item.title || item.name || 'Untitled',
                time: item.time || '',
                completed: !!item.completed,
                source: 'legacy_meal',
                date: dateKey,
                type: 'meal',
                ...item
              };
              store[dateKey].push(normalized);
            });
          });
        }
      } catch (e) {
        console.warn("Failed to parse legacy meals:", e);
      }
    }

    // Migrate plans
    if (legacyPlansRaw) {
      try {
        const parsed = JSON.parse(legacyPlansRaw || '{}');
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.entries(parsed).forEach(([dateKey, list]) => {
            if (!Array.isArray(list)) return;
            if (!store[dateKey]) store[dateKey] = [];
            list.forEach(item => {
              const normalized = {
                title: item.title || item.name || 'Untitled',
                time: item.time || '',
                completed: !!item.completed,
                source: 'legacy_plan',
                date: dateKey,
                type: 'shopping',
                ...item
              };
              store[dateKey].push(normalized);
            });
          });
        }
      } catch (e) {
        console.warn("Failed to parse legacy plans:", e);
      }
    }

    writeStore(store);
    localStorage.setItem(MIGRATED_FLAG, '1');
    console.info("Legacy stores migrated into meno_events (non-destructive)");
  } catch (e) {
    console.error("Migration failed:", e);
  }
}

// Creates a standardized date key for storage
function makeDateKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// Generate a short unique id for items
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

// Calendar Rendering & Generates month grid and day indicators
function renderCalendar() {
  const store = readStore();
  if (!calendarDays || !monthYear) return;

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  monthYear.textContent = currentDate.toLocaleString("default", {
    month: "long",
    year: "numeric"
  });
  
  calendarDays.innerHTML = "";

  // Add empty placeholders
  for (let i = 0; i < firstDay; i++) calendarDays.appendChild(document.createElement('div'));

  // Add day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${year}-${month + 1}-${d}`;
    const div = document.createElement('div');
    div.className = 'day';
    div.textContent = d;

    const list = store[dateKey] || [];
    const types = [...new Set(list.map(it => it.type || 'event'))];

    if (types.length) {
      div.classList.add('active');
      const order = ['event', 'meal', 'shopping'];
      const dots = document.createElement('div');
      dots.style.display = 'flex';
      dots.style.gap = '4px';
      dots.style.position = 'absolute';
      dots.style.bottom = '8px';
      
      order.forEach(t => {
        if (types.includes(t)) {
          const dot = document.createElement('div');
          dot.className = `dot dot--${t}`;
          dots.appendChild(dot);
        }
      });
      div.appendChild(dots);
    }

    div.addEventListener('click', () => selectDate(year, month, d));
    calendarDays.appendChild(div);
  }
}

// Navigates to the previous month
function goToPreviousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
  // Reset to today of the month if it exists, or first day of month
  const today = new Date();
  if (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth()) {
    selectDate(today.getFullYear(), today.getMonth(), today.getDate());
  } else {
    selectDate(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }
}

// Navigates to the next month
function goToNextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
  // Reset to today of the month if it exists, or first day of month
  const today = new Date();
  if (currentDate.getFullYear() === today.getFullYear() && currentDate.getMonth() === today.getMonth()) {
    selectDate(today.getFullYear(), today.getMonth(), today.getDate());
  } else {
    selectDate(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }
}

/*
 * Date & List Selection & Handle date selection and filtering
*/
// Selects a date and renders its items
function selectDate(y, m, d) {
  selectedDate = `${y}-${m + 1}-${d}`;
  if (selectedDateText) {
    selectedDateText.textContent = new Date(y, m, d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  }
  renderListForCurrentFilter();
}

selectDate(today.getFullYear(), today.getMonth(), today.getDate());

// Sets current filter and rerenders list
function renderListForType(filterType = null) {
  currentFilterType = filterType;
  renderListForCurrentFilter();
}

// Renders the list with current filter applied
function renderListForCurrentFilter() {
  const store = readStore();
  if (!eventList) return;

  if (!selectedDate) selectedDate = makeDateKey();

  const sourceList = store[selectedDate] || [];
  // Ensure each item has a stable id to reference it reliably
  let mutated = false;
  sourceList.forEach(it => {
    if (!it.id) {
      it.id = generateId();
      mutated = true;
    }
  });
  if (mutated) writeStore(store);
  const list = sourceList.filter(it => {
    if (!currentFilterType) return true;
    return (it.type || 'event') === currentFilterType;
  });

  if (!list.length) {
    eventList.innerHTML = `<small id="noEvent">No ${currentFilterType ? currentFilterType : 'items'} for this date</small>`;
    return;
  }

  eventList.innerHTML = '';

  list.forEach((item, filteredIndex) => {
    const li = document.createElement('li');
    li.className = 'item';
    li.draggable = true;
    // Record both filtered position and real index in the source array
    li.dataset.filteredIndex = filteredIndex;
    // Find real index by stable id
    const realIndex = sourceList.findIndex(it => it.id && item.id && it.id === item.id);
    li.dataset.realIndex = realIndex;
    // expose stable id on the element
    if (item.id) li.dataset.itemId = item.id;

    const checked = item.completed ? "checked" : "";
    const titleStyle = item.completed ? 'text-decoration: line-through; opacity:0.6;' : '';

    li.innerHTML = `
      <div class="desc">
        <span style="font-size:18px; ${titleStyle}">${escapeHtml(item.title)}</span>
        <small>${item.time ? escapeHtml(item.time) : ''}</small>
      </div>
      <div class="ctrls">
        <input type="checkbox" class="complete-checkbox" data-i="${filteredIndex}" data-id="${item.id || ''}" ${checked} title="Mark complete">
        <button class="edit-btn" data-i="${filteredIndex}" title="Edit">✎</button>
        <button class="delete-btn" data-i="${filteredIndex}" title="Delete">🗑</button>
      </div>
    `;

    li.addEventListener('dragstart', () => li.classList.add('dragging'));
    li.addEventListener('dragend', handleItemDragEnd);

    eventList.appendChild(li);
  });

  attachListHandlers(list, sourceList);
  // apply any active list search filter after rendering
  applyListSearchFilter();
}

/*
 * Apply search to currently rendered list
*/

// Applies the current search input value (if present) to the rendered list
function applyListSearchFilter() {
  // Prefer inline listSearch (legacy) but fall back to global navbar searchInput
  const input = document.getElementById('listSearch') || document.getElementById('searchInput');
  if (!eventList) return;
  const q = input && input.value ? input.value.trim().toLowerCase() : '';

  const lis = Array.from(eventList.querySelectorAll('li'));
  let anyVisible = false;

  lis.forEach(li => {
    const txt = (li.textContent || '').toLowerCase();
    if (!q || txt.includes(q)) {
      li.style.display = '';
      anyVisible = true;
    } else {
      li.style.display = 'none';
    }
  });

  // Manage noEvent placeholder
  let noEl = document.getElementById('noEvent');
  if (!noEl) {
    // if no placeholder exists, create one as needed (only when nothing visible)
    if (!anyVisible && q) {
      eventList.innerHTML = `<small id="noEvent">No ${currentFilterType ? currentFilterType : 'items'} match "${escapeHtml(q)}"</small>`;
    }
    return;
  }

  if (!q) {
    // restore default placeholder text
    noEl.style.display = anyVisible ? 'none' : '';
    noEl.textContent = `No ${currentFilterType ? currentFilterType : 'items'} for this date`;
  } else {
    if (!anyVisible) {
      noEl.style.display = '';
      noEl.textContent = `No ${currentFilterType ? currentFilterType : 'items'} match "${input.value.trim()}"`;
    } else {
      noEl.style.display = 'none';
    }
  }
}

// Attach global navbar search input to list filtering (events page)
const navSearchInput = document.getElementById('searchInput');
if (navSearchInput) {
  navSearchInput.addEventListener('input', () => applyListSearchFilter());
}

// Event Handlers - List Items & Attach handlers for check/edit/delete on list items
// Attaches event listeners to list items
function attachListHandlers(filteredList, sourceList) {
  eventList.querySelectorAll('.complete-checkbox').forEach(box => {
    box.removeEventListener('change', checkboxChangeHandler);
    box.addEventListener('change', checkboxChangeHandler);
  });

  eventList.querySelectorAll('.edit-btn').forEach(btn => {
    btn.removeEventListener('click', editButtonHandler);
    btn.addEventListener('click', editButtonHandler);
  });

  eventList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.removeEventListener('click', deleteButtonHandler);
    btn.addEventListener('click', deleteButtonHandler);
  });
}

// Handles checkbox state changes
function checkboxChangeHandler(e) {
  // Robust checkbox handler: try id -> filtered index -> reference/title fallback
  const li = e.target.closest('li');
  const box = e.target;
  const store = readStore();
  if (!selectedDate) selectedDate = makeDateKey();
  const source = store[selectedDate] || [];

  // 1) Try stable id lookup
  let id = box.dataset.id || (li && li.dataset.itemId) || '';
  let realIdx = -1;
  if (id) realIdx = source.findIndex(it => it.id === id);

  // 2) Fallback to filtered index mapping
  if (realIdx === -1) {
    const filteredIdx = parseInt(box.dataset.i, 10);
    if (!isNaN(filteredIdx)) {
      const filtered = source.filter(it => {
        if (!currentFilterType) return true;
        return (it.type || 'event') === currentFilterType;
      });
      const target = filtered[filteredIdx];
      if (target) {
        if (target.id) realIdx = source.findIndex(it => it.id === target.id);
        if (realIdx === -1) realIdx = source.findIndex(it => it === target);
      }
    }
  }

  // 3) As a last-resort try a title/type match (best-effort)
  if (realIdx === -1 && li) {
    const titleNode = li.querySelector('.desc span');
    const titleText = titleNode ? (titleNode.textContent || '').trim() : '';
    if (titleText) {
      realIdx = source.findIndex(it => ((it.title || '') === titleText) && ((it.type || 'event') === (currentFilterType || it.type || 'event')));
    }
  }

  if (realIdx === -1) return;

  source[realIdx].completed = !!box.checked;
  store[selectedDate] = source;
  writeStore(store);

  try { box.checked = !!source[realIdx].completed; } catch (err) {}

  renderCalendar();
  renderListForCurrentFilter();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

// Handles edit button clicks
function editButtonHandler(e) {
  const filteredIdx = parseInt(e.currentTarget.dataset.i, 10);
  startEdit(filteredIdx);
}

// Handles delete button clicks
function deleteButtonHandler(e) {
  const filteredIdx = parseInt(e.currentTarget.dataset.i, 10);
  deleteItem(filteredIdx);
}

// Handles drag end to reorder items
function handleItemDragEnd() {
  const store = readStore();
  const source = store[selectedDate] || [];

  const visibleLis = Array.from(eventList.querySelectorAll('li'));
  const filteredIndices = visibleLis.map(li => parseInt(li.dataset.filteredIndex, 10));

  const filteredArray = source.filter(it => {
    if (!currentFilterType) return true;
    return (it.type || 'event') === currentFilterType;
  });

  const newFilteredOrder = filteredIndices.map(idx => filteredArray[idx]).filter(Boolean);

  const merged = [];
  let replacePtr = 0;
  for (const it of source) {
    if (!currentFilterType || (it.type || 'event') === currentFilterType) {
      merged.push(newFilteredOrder[replacePtr++] || it);
    } else {
      merged.push(it);
    }
  }

  while (replacePtr < newFilteredOrder.length) merged.push(newFilteredOrder[replacePtr++]);

  store[selectedDate] = merged;
  writeStore(store);
  renderCalendar();
  renderListForCurrentFilter();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

// Item CRUD Operations: Create, edit, delete items and persist to store
// Opens edit form for an item
function startEdit(filteredIndex) {
  const store = readStore();
  const source = store[selectedDate] || [];

  const filtered = source.filter(it => {
    if (!currentFilterType) return true;
    return (it.type || 'event') === currentFilterType;
  });

  const target = filtered[filteredIndex];
  if (!target) return;

  // Prefer id-based lookup, fall back to reference equality
  let realIndex = -1;
  if (target.id) realIndex = source.findIndex(it => it.id === target.id);
  if (realIndex === -1) realIndex = source.findIndex(it => it === target);
  if (realIndex === -1) return;

  if (!eventForm || !eventTitle) return;
  eventTitle.value = target.title || '';
  if (eventTime) eventTime.value = target.time || '';
  // populate meal/shopping specific inputs when editing
  const periodEl = document.querySelector('#period');
  const classEl = document.querySelector('#class');
  const locationEl = document.querySelector('#location');
  if (periodEl) periodEl.value = target.period || '';
  if (classEl) classEl.value = target.class || '';
  if (locationEl) locationEl.value = target.location || '';
  formTitle && (formTitle.textContent = "Edit Item");
  eventForm.classList.remove('hidden');
  eventList && eventList.classList.add('hidden');
  addEventBtn && (addEventBtn.disabled = true);

  editIndex = realIndex;
  if (eventForm) eventForm.dataset.presetType = target.type || 'event';
}

// Deletes an item
function deleteItem(filteredIndex) {
  const store = readStore();
  const source = store[selectedDate] || [];

  const filtered = source.filter(it => {
    if (!currentFilterType) return true;
    return (it.type || 'event') === currentFilterType;
  });

  const target = filtered[filteredIndex];
  if (!target) return;

  // Prefer id-based lookup, fall back to reference equality
  let realIndex = -1;
  if (target.id) realIndex = source.findIndex(it => it.id === target.id);
  if (realIndex === -1) realIndex = source.findIndex(it => it === target);
  if (realIndex === -1) return;

  source.splice(realIndex, 1);
  store[selectedDate] = source;
  writeStore(store);

  renderCalendar();
  renderListForCurrentFilter();
  showToast("Deleted Item!", "delete");
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

// Opens the add form with optional preset type
function openAddForm(presetType = null) {
  if (!eventForm || !eventTitle) return;
  formTitle && (formTitle.textContent = "Add Item");
  eventForm.classList.remove('hidden');
  eventList && eventList.classList.add('hidden');
  addEventBtn && (addEventBtn.disabled = true);
  eventTitle.value = "";
  if (eventTime) eventTime.value = "";
  // Clear meal/shopping specific fields for new items
  const periodEl = document.querySelector('#period');
  const classEl = document.querySelector('#class');
  const locationEl = document.querySelector('#location');
  if (periodEl) periodEl.value = '';
  if (classEl) classEl.value = '';
  if (locationEl) locationEl.value = '';
  eventForm.dataset.presetType = presetType || '';
  editIndex = null;
}

// Saves a new or edited item
function addOrEditItem() {
  if (!eventTitle) return;
  const title = eventTitle.value.trim();
  const timeVal = eventTime ? eventTime.value.trim() : '';
  if (!title) return alert("Title required");

  const store = readStore();
  if (!selectedDate) selectedDate = makeDateKey();
  if (!store[selectedDate]) store[selectedDate] = [];

  const type = (eventForm && eventForm.dataset.presetType) ? eventForm.dataset.presetType : (currentFilterType || 'event');

  let newItem;
  if (type === "meal") {
    newItem = {
      title,
      period: document.querySelector("#period")?.value || '',
      completed: false,
      source: "local",
      date: selectedDate,
      type
    };
  } else if (type === "shopping") {
    newItem = {
      title,
      location: document.querySelector("#location")?.value || '',
      time: timeVal,
      completed: false,
      source: "local",
      date: selectedDate,
      type
    };
  } else {
    newItem = {
      title,
      time: timeVal,
      completed: false,
      source: "local",
      date: selectedDate,
      type
    };
  }

  if (editIndex !== null && typeof editIndex === 'number') {
    store[selectedDate][editIndex] = Object.assign({}, store[selectedDate][editIndex], newItem);
    showToast("Item edited successfully!", "success");
  } else {
    // ensure new items get a stable id
    newItem.id = generateId();
    store[selectedDate].push(newItem);
    showToast("Item added successfully!", "success");
  }

  addEventBtn.disabled = false;

  writeStore(store);

  eventForm && eventForm.classList.add('hidden');
  eventList && eventList.classList.remove('hidden');
  eventTitle.value = "";
  if (eventTime) eventTime.value = "";
  // clear per-type fields after save
  const periodEl = document.querySelector('#period');
  const classEl = document.querySelector('#class');
  const locationEl = document.querySelector('#location');
  if (periodEl) periodEl.value = '';
  if (classEl) classEl.value = '';
  if (locationEl) locationEl.value = '';
  editIndex = null;
  if (eventForm) eventForm.dataset.presetType = '';

  renderCalendar();
  renderListForCurrentFilter();
  if (typeof refreshDashboard === 'function') refreshDashboard();
}

// Form Listeners: Add/Edit/Cancel button handlers
if (addEventBtn) {
  addEventBtn.addEventListener('click', () => {
    openAddForm(currentFilterType || null);
  });
}

if (cancelEvent) {
  cancelEvent.addEventListener('click', () => {
    eventForm && eventForm.classList.add('hidden');
    eventList && eventList.classList.remove('hidden');
    addEventBtn && (addEventBtn.disabled = false);
    if (eventForm) eventForm.dataset.presetType = '';
    editIndex = null;
    // clear any per-type inputs when cancelling
    const periodEl = document.querySelector('#period');
    const classEl = document.querySelector('#class');
    const locationEl = document.querySelector('#location');
    if (periodEl) periodEl.value = '';
    if (classEl) classEl.value = '';
    if (locationEl) locationEl.value = '';
  });
}

if (saveEvent) {
  saveEvent.addEventListener('click', () => addOrEditItem());
}

// Drag Helpers: Helpers for drag and drop reordering
// Determines drop position during drag operations
function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll("li:not(.dragging)")];
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset, element: child };
    } else return closest;
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// Handles drag over event
function handleDragOver(e) {
  e.preventDefault();
  if (!eventList) return;
  const afterEl = getDragAfterElement(eventList, e.clientY);
  const dragging = document.querySelector('.dragging');
  if (!dragging) return;
  if (!afterEl) eventList.appendChild(dragging);
  else eventList.insertBefore(dragging, afterEl);
}

if (eventList) {
  eventList.removeEventListener('dragover', handleDragOver);
  eventList.addEventListener('dragover', handleDragOver);
}

/**
 * Fetches holidays and events from Google Calendar API for the current year
 * Appends them as user-saved events (non-destructive)
 * Only syncs once per browser session
 * 
 * IMPORTANT: Uses backend endpoint (/api/google-events) to avoid CORS issues
 * and keep API keys secure on the server side.
 */
async function fetchGoogleEvents() {
  try {
    // Skip if already synced this session
    if (sessionStorage.getItem(GOOGLE_SYNCED_FLAG)) {
      console.info("Google Calendar already synced this session.");
      return;
    }

    showToast("Syncing holidays and events…", "loading");
    
    // Call backend endpoint instead of directly calling Google API
    // This avoids CORS issues and keeps API key secure
    const resp = await fetch('/api/google-events');
    if (!resp.ok) throw new Error(`Backend returned HTTP ${resp.status}`);
    const result = await resp.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Unknown error from backend');
    }
    
    const data = { items: result.items };

    const store = readStore();
    let addedCount = 0;

    (data.items || []).forEach(ev => {
      if (!ev.start) return;

      // Parse start date (can be all-day or date-time)
      const startDate = ev.start.date || ev.start.dateTime;
      const d = new Date(startDate);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

      if (!store[key]) store[key] = [];

      // Check if this event already exists to avoid duplicates
      const eventTitle = (ev.summary || "Untitled Event").toLowerCase();
      const isDuplicate = store[key].some(item => {
        return (item.title || "").toLowerCase() === eventTitle && item.fromGoogle;
      });

      if (!isDuplicate) {
        store[key].push({
          title: ev.summary || "Untitled Event",
          desc: ev.description || "Holiday/Event from Google Calendar",
          type: "event",
          fromGoogle: true,
          completed: false,
          source: "google_calendar",
          date: key,
          time: ev.start.dateTime ? new Date(ev.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""
        });
        addedCount++;
      }
    });

    writeStore(store);
    sessionStorage.setItem(GOOGLE_SYNCED_FLAG, '1');
    
    renderCalendar();
    renderListForCurrentFilter();
    if (addedCount > 0) {
      showToast(`✓ ${addedCount} holidays/events added from Google Calendar!`, "success");
    } else {
      showToast("Google Calendar synced (no new events)", "success");
    }
    if (typeof refreshDashboard === 'function') refreshDashboard();
  } catch (err) {
    console.error("Google Events Fetch Failed:", err.message);
    showToast(`Failed to sync Google Calendar: ${err.message}`, "error");
  }
}

// Debug Utilities : Development helpers only (clearing store) 
function clearAllMenoData() {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(LEGACY_MEALS);
  localStorage.removeItem(LEGACY_PLANS);
  localStorage.removeItem(MIGRATED_FLAG);
  alert("All Meno storage cleared.");
}

// Initialization: Run on window load to set up calendar and bindings
window.addEventListener('load', () => {
  migrateLegacyStoresIfNeeded();
  renderCalendar();
  renderListForCurrentFilter();
  if (typeof fetchGoogleEvents === 'function') fetchGoogleEvents();
  if (typeof setActiveNav === 'function') setActiveNav();
  
  // Attach month navigation buttons
  const prevBtn = document.getElementById('prevMonth');
  const nextBtn = document.getElementById('nextMonth');
  if (prevBtn) prevBtn.addEventListener('click', goToPreviousMonth);
  if (nextBtn) nextBtn.addEventListener('click', goToNextMonth);
});

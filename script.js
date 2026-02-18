// --- INITIALIZATION ---
let items = JSON.parse(localStorage.getItem('taskManagerItems')) || [];
let categories = JSON.parse(localStorage.getItem('taskManagerCategories')) || [
    { id: 'goal', name: 'Goals' }, { id: 'project', name: 'Projects' }, { id: 'task', name: 'Tasks' }
];
// Settings
let tagSettings = JSON.parse(localStorage.getItem('footholdTagSettings')) || { urgentHours: 24, upcomingDays: 3 };
let showCounts = JSON.parse(localStorage.getItem('footholdShowCounts')) ?? true;

let activeFilters = new Set(['all']);
let selectedTags = new Set();
let showCompleted = false;

let searchQuery = '';
let sortBy = 'manual';
let editingId = null;
let tempSubtasks = [];
let tempReminders = []; 

// Notification Polling State (Prevent duplicate alerts in same session)
let firedNotifications = new Set(); 

// Apply settings immediately
if (!showCounts) document.body.classList.add('hide-counts');

// Init Settings Inputs (if modal is open/ready)
function initSettingsInputs() {
    if(document.getElementById('settingUrgentHours')) {
        document.getElementById('settingUrgentHours').value = tagSettings.urgentHours;
        document.getElementById('settingUpcomingDays').value = tagSettings.upcomingDays;
    }
    if(document.getElementById('settingShowCounts')) {
        document.getElementById('settingShowCounts').checked = showCounts;
    }
}

function saveData() {
    localStorage.setItem('taskManagerItems', JSON.stringify(items));
    localStorage.setItem('taskManagerCategories', JSON.stringify(categories));
}

function saveTagSettings() {
    tagSettings.urgentHours = parseInt(document.getElementById('settingUrgentHours').value) || 24;
    tagSettings.upcomingDays = parseInt(document.getElementById('settingUpcomingDays').value) || 3;
    localStorage.setItem('footholdTagSettings', JSON.stringify(tagSettings));
    renderItems();
}

function toggleCountSetting() {
    showCounts = document.getElementById('settingShowCounts').checked;
    localStorage.setItem('footholdShowCounts', JSON.stringify(showCounts));
    document.body.classList.toggle('hide-counts', !showCounts);
}

// --- GLOBAL SHORTCUTS ---
document.addEventListener('keydown', (e) => {
    const itemModal = document.getElementById('itemModal');
    const settingsModal = document.getElementById('settingsModal');
    const isAnyModalOpen = itemModal.classList.contains('active') || settingsModal.classList.contains('active');
    
    if (e.key === 'Escape') {
        closeModal();
        closeSettings();
        document.getElementById('suggestionsDropdown').style.display = 'none';
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && itemModal.classList.contains('active')) {
        if(document.getElementById('itemForm').checkValidity()) document.getElementById('itemForm').dispatchEvent(new Event('submit'));
    }

    if (e.key.toLowerCase() === 'n' && !isAnyModalOpen) {
        const activeTag = document.activeElement.tagName.toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
            e.preventDefault();
            openNewItem();
        }
    }
});

// --- SUBTASK "ENTER" FIX ---
const subInput = document.getElementById('subtaskInput');
if(subInput) {
    subInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSubtask();
        }
    });
}

// --- TAG FILTER LOGIC ---
const tagInput = document.getElementById('catFilterInput');
const suggestionsDropdown = document.getElementById('suggestionsDropdown');
const activeTagsContainer = document.getElementById('activeTagsContainer');

tagInput.addEventListener('focus', () => { renderSuggestions(); suggestionsDropdown.style.display = 'block'; });
document.addEventListener('click', (e) => { if (!tagInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) suggestionsDropdown.style.display = 'none'; });
tagInput.addEventListener('input', () => { renderSuggestions(tagInput.value); });
tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); processTagInput(tagInput.value); }
    if (e.key === 'Backspace' && tagInput.value === '' && selectedTags.size > 0) { 
        const lastTag = Array.from(selectedTags).pop(); 
        removeTag(lastTag, true); 
    }
});

function processTagInput(val) {
    const terms = val.split(',').map(t => t.trim().toLowerCase()).filter(t => t);
    terms.forEach(term => { const match = categories.find(c => c.name.toLowerCase() === term); if (match) addTag(match.id); });
    tagInput.value = ''; renderSuggestions();
}

function renderSuggestions(filterText = '') {
    const term = filterText.toLowerCase();
    const availableCats = categories.filter(c => !selectedTags.has(c.id));
    const matches = availableCats.filter(c => c.name.toLowerCase().includes(term));
    if (matches.length === 0) { suggestionsDropdown.style.display = 'none'; return; }
    
    // STOP PROPAGATION on click to keep menu open
    suggestionsDropdown.innerHTML = matches.map(c => `<div class="suggestion-item" onclick="addTag('${c.id}'); event.stopPropagation()">${c.name}</div>`).join('');
    suggestionsDropdown.style.display = 'block';
}

function toggleCategoryFilter(id) {
    const isOnlySelected = selectedTags.size === 1 && selectedTags.has(id);
    if (isOnlySelected) {
        removeTag(id, false); 
    } else {
        selectedTags.clear();
        addTag(id);
    }
}

function addTag(id) {
    selectedTags.add(id); 
    renderTags(); 
    tagInput.value = ''; 
    renderSuggestions(); 
    renderItems(); 
    updateSidebarStyles();
    const input = document.getElementById('catFilterInput');
    if(input) input.focus();
}

function removeTag(id, refocus = false) {
    selectedTags.delete(id); 
    renderTags(); 
    renderItems(); 
    updateSidebarStyles();

    if (refocus) {
        const input = document.getElementById('catFilterInput');
        if(input) {
            input.focus();
            renderSuggestions(input.value); 
        }
    }
}

function renderTags() {
    activeTagsContainer.innerHTML = Array.from(selectedTags).map(id => {
        const cat = categories.find(c => c.id === id); if (!cat) return '';
        return `<div class="filter-tag"><span>${cat.name}</span><button onclick="removeTag('${id}', true); event.stopPropagation()"><i class="fas fa-times"></i></button></div>`;
    }).join('');
}

function resetFilters() {
    selectedTags.clear(); showCompleted = false; renderTags(); renderItems(); updateSidebarStyles();
}

function toggleCompletedFilter() {
    showCompleted = !showCompleted; renderItems(); updateSidebarStyles();
}

function updateSidebarStyles() {
    const isAllActive = selectedTags.size === 0 && !showCompleted;
    const allFilterBtn = document.getElementById('allFilter');
    if (allFilterBtn) allFilterBtn.classList.toggle('active', isAllActive);
    
    const completedBtn = document.getElementById('completedFilter');
    const completedRow = completedBtn ? completedBtn.closest('.category-row') : null;
    
    if (completedBtn) {
        completedBtn.classList.toggle('active', showCompleted);
        if (completedRow) {
            completedRow.classList.toggle('active-state', showCompleted);
        }
    }

    document.querySelectorAll('.category-name').forEach(el => {
        const catId = el.closest('.category-row')?.dataset.catId;
        if(catId) el.classList.toggle('active', selectedTags.has(catId));
    });
}

// --- RENDER ITEMS ---
function getStatusBadge(item) {
    if (!item.dueDate || item.completed) return '';
    const now = new Date();
    const dueString = item.dueDate + (item.dueTime ? 'T' + item.dueTime : 'T23:59:00'); 
    const dueDate = new Date(dueString);
    const diffMs = dueDate - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffHours / 24;

    if (diffMs < 0) return `<span class="status-text past-due"><i class="fas fa-circle-exclamation"></i> Past Due</span>`;
    else if (diffHours <= tagSettings.urgentHours) return `<span class="status-text urgent"><i class="fas fa-triangle-exclamation"></i> Urgent</span>`;
    else if (diffDays <= tagSettings.upcomingDays) return `<span class="status-text upcoming"><i class="fas fa-hourglass-half"></i> Upcoming</span>`;
    return '';
}

function renderItems() {
    const grid = document.getElementById('itemsGrid');
    let filtered = items;
    
    if (showCompleted) filtered = items.filter(i => i.completed);
    else filtered = items.filter(i => !i.completed);

    if (selectedTags.size > 0) filtered = filtered.filter(i => selectedTags.has(i.type));
    if (searchQuery) filtered = filtered.filter(i => i.title.toLowerCase().includes(searchQuery) || (i.description && i.description.toLowerCase().includes(searchQuery)));

    if (sortBy === 'date') {
        filtered.sort((a, b) => {
            if (!a.dueDate) return 1; if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state"><i class="fas fa-layer-group"></i><p>${searchQuery ? 'No matches found.' : 'Clear mind. Empty list.'}</p></div>`;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        const categoryName = getCategoryName(item.type);
        const statusHtml = getStatusBadge(item);
        let progressHtml = '';
        if (item.subtasks && item.subtasks.length > 0) {
            const completed = item.subtasks.filter(s => s.completed).length;
            const pct = (completed / item.subtasks.length) * 100;
            progressHtml = `<div class="progress-container" title="${completed}/${item.subtasks.length} completed"><div class="progress-bar" style="width: ${pct}%"></div></div>`;
        }

        let dateHtml = '';
        if (item.dueDate) {
            const dateObj = new Date(item.dueDate + (item.dueTime ? 'T' + item.dueTime : ''));
            const today = new Date(); today.setHours(0,0,0,0);
            const itemDateOnly = new Date(item.dueDate);
            const isOverdue = itemDateOnly < today && !item.completed;
            
            const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            const timeStr = item.dueTime ? new Date('1970-01-01T' + item.dueTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
            // Date text is now always muted/grey
            dateHtml = `<span class="date-badge"><i class="far fa-calendar"></i> ${dateStr} ${timeStr}</span>`;
        }
        
        let notifIcon = '';
        if (item.reminders && item.reminders.length > 0 && !item.completed) {
            notifIcon = `<i class="fas fa-bell" style="font-size:10px; color:var(--text-muted); margin-left:5px;"></i>`;
        }

        const isDragEnabled = sortBy === 'manual' && !searchQuery;

        return `
        <div class="item-card ${item.completed ? 'completed-card' : ''}" ${isDragEnabled ? 'draggable="true"' : ''} data-id="${item.id}">
            <div class="item-header">
                <div class="item-title">${item.title}</div>
                <div class="item-actions">
                    <button onclick="toggleItemStatus(${item.id})" class="btn-check" title="Complete"><i class="fas ${item.completed ? 'fa-undo' : 'fa-check'}"></i></button>
                    <button onclick="editItem(${item.id})" title="Edit"><i class="fas fa-pen"></i></button>
                    <button onclick="deleteItem(${item.id})" class="btn-delete" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
            
            <div class="item-meta">
                <div>
                    <span class="item-type">${categoryName}</span>
                    ${dateHtml}
                    ${notifIcon}
                    ${statusHtml}
                </div>
            </div>

            ${progressHtml}
            ${item.description ? `<div class="item-description">${parseMarkdown(item.description)}</div>` : ''}
            ${item.subtasks.length > 0 ? `<div class="subtasks">${item.subtasks.map(st => `<div class="subtask" data-sub-id="${st.id}" onclick="toggleSubtask(${item.id}, ${st.id})"><input type="checkbox" ${st.completed ? 'checked' : ''} style="pointer-events: none;"><span>${st.text}</span></div>`).join('')}</div>` : ''}
        </div>`;
    }).join('');

    if (sortBy === 'manual' && !searchQuery) {
        const cards = document.querySelectorAll('.item-card');
        cards.forEach(card => {
            card.addEventListener('dragstart', () => { setTimeout(() => card.classList.add('dragging'), 0); });
            card.addEventListener('dragend', () => { card.classList.remove('dragging'); updateItemOrder(); stopAutoScroll(); });
            addLongPressDrag(card); 
        });
    }
}

function handleSearch(val) { searchQuery = val.toLowerCase().trim(); renderItems(); }

// --- SIDEBAR ---
function renderSidebar() {
    const container = document.getElementById('dynamicCategories');
    container.innerHTML = categories.map(cat => {
        // Calculate active counts
        const activeCount = items.filter(i => i.type === cat.id && !i.completed).length;
        
        return `
        <div class="category-row" draggable="true" data-cat-id="${cat.id}">
            <i class="fas fa-grip-vertical cat-handle"></i>
            <span class="category-name ${selectedTags.has(cat.id) ? 'active' : ''}" onclick="toggleCategoryFilter('${cat.id}')">
                ${cat.name}
                <span class="cat-count">${activeCount}</span>
            </span>
            <div class="cat-actions">
                <button class="cat-btn-mini" onclick="renameCategory('${cat.id}')"><i class="fas fa-pen"></i></button>
                <button class="cat-btn-mini delete" onclick="deleteCategory('${cat.id}')"><i class="fas fa-trash"></i></button>
                <button class="cat-btn-mini add" onclick="openNewItem('${cat.id}')"><i class="fas fa-plus"></i></button>
            </div>
        </div>
    `}).join('');
    
    updateSidebarStyles();

    container.querySelectorAll('.category-row').forEach(row => {
        row.addEventListener('mousedown', (e) => { if(e.target.classList.contains('cat-handle')) row.setAttribute('draggable', 'true'); else row.setAttribute('draggable', 'false'); });
        row.addEventListener('dragstart', () => { setTimeout(() => row.classList.add('dragging-cat'), 0); });
        row.addEventListener('dragend', () => { row.classList.remove('dragging-cat'); updateCategoryOrder(); });
        const handle = row.querySelector('.cat-handle');
        handle.addEventListener('touchstart', (e) => handleTouchStart(e, row, 'category', container), {passive: false});
    });
}

function toggleCategories() {
    const sec = document.getElementById('categoriesExpandable');
    const icon = document.getElementById('categoriesToggleIcon');
    
    if (sec.style.display === 'none') {
        sec.style.display = 'block';
        icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
    } else {
        sec.style.display = 'none';
        icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
    }
}


// --- AUTO SCROLL ENGINE ---
let scrollVelocity = 0; let scrollFrame = null;
function updateAutoScroll(y) {
    const threshold = 100; const maxSpeed = 15; const h = window.innerHeight;
    if (y < threshold) scrollVelocity = -maxSpeed * ((threshold - y) / threshold);
    else if (y > h - threshold) scrollVelocity = maxSpeed * ((y - (h - threshold)) / threshold);
    else scrollVelocity = 0;
    if (scrollVelocity !== 0 && !scrollFrame) scrollFrame = requestAnimationFrame(performAutoScroll);
    else if (scrollVelocity === 0 && scrollFrame) { cancelAnimationFrame(scrollFrame); scrollFrame = null; }
}
function performAutoScroll() {
    if (scrollVelocity === 0) { scrollFrame = null; return; }
    window.scrollBy(0, scrollVelocity); scrollFrame = requestAnimationFrame(performAutoScroll);
}
function stopAutoScroll() { scrollVelocity = 0; if (scrollFrame) { cancelAnimationFrame(scrollFrame); scrollFrame = null; } }

// --- DRAG SYSTEM ---
const catContainer = document.getElementById('dynamicCategories');
if(catContainer) {
    catContainer.addEventListener('dragover', (e) => handleVerticalDrag(e, catContainer, '.dragging-cat', '.category-row:not(.dragging-cat)'));
    catContainer.addEventListener('drop', (e) => { e.preventDefault(); updateCategoryOrder(); });
}

const subContainer = document.getElementById('subtaskList');
if(subContainer) {
    subContainer.addEventListener('dragover', (e) => handleVerticalDrag(e, subContainer, '.dragging-sub', '.modal-subtask-item:not(.dragging-sub)'));
    subContainer.addEventListener('drop', (e) => { e.preventDefault(); updateSubtaskOrder(); });
}

const grid = document.getElementById('itemsGrid');
if(grid) {
    grid.addEventListener('dragover', (e) => {
        if(sortBy !== 'manual' || searchQuery) return;
        e.preventDefault(); updateAutoScroll(e.clientY);
        const draggingItem = grid.querySelector('.dragging'); if (!draggingItem) return;
        const after = getDragAfterElement(grid, e.clientX, e.clientY);
        if (after == null) grid.appendChild(draggingItem); else grid.insertBefore(draggingItem, after);
    });
    grid.addEventListener('drop', (e) => { if(sortBy !== 'manual' || searchQuery) return; e.preventDefault(); updateItemOrder(); stopAutoScroll(); });
}

window.addEventListener('dragover', (e) => { if(document.querySelector('.dragging')) { e.preventDefault(); updateAutoScroll(e.clientY); } });
window.addEventListener('dragend', stopAutoScroll);

let touchDragItem = null; let touchClone = null; let touchOffsetX = 0; let touchOffsetY = 0; let longPressTimer = null;
function addLongPressDrag(card) {
    card.addEventListener('touchstart', (e) => {
        if(e.target.tagName === 'BUTTON' || e.target.tagName === 'I' || e.target.tagName === 'INPUT') return;
        longPressTimer = setTimeout(() => { navigator.vibrate?.(50); handleTouchStart(e, card, 'card', grid); }, 500);
    }, {passive: true});
    card.addEventListener('touchend', () => clearTimeout(longPressTimer));
    card.addEventListener('touchmove', () => clearTimeout(longPressTimer));
}
function handleTouchStart(e, item, type, container) {
    if(e.cancelable) e.preventDefault();
    touchDragItem = item;
    const touch = e.touches[0];
    const rect = item.getBoundingClientRect();
    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;
    touchClone = item.cloneNode(true);
    touchClone.classList.add('dragging-clone');
    touchClone.style.left = `${rect.left}px`;
    touchClone.style.top = `${rect.top}px`;
    touchClone.style.width = `${rect.width}px`;
    document.body.appendChild(touchClone);
    item.style.opacity = '0.3';
    const moveHandler = (ev) => handleTouchMove(ev, container, type);
    const endHandler = (ev) => handleTouchEnd(ev, item, moveHandler, endHandler, type);
    document.addEventListener('touchmove', moveHandler, {passive: false});
    document.addEventListener('touchend', endHandler);
}
function handleTouchMove(e, container, type) {
    e.preventDefault(); if(!touchClone) return;
    const touch = e.touches[0]; updateAutoScroll(touch.clientY);
    touchClone.style.left = `${touch.clientX - touchOffsetX}px`;
    touchClone.style.top = `${touch.clientY - touchOffsetY}px`;
    if (type === 'card') {
        const after = getDragAfterElement(container, touch.clientX, touch.clientY);
        if (after == null) container.appendChild(touchDragItem); else container.insertBefore(touchDragItem, after);
    } else {
        const after = getVerticalDragAfterElement(container, touch.clientY, '.category-row:not(.dragging-clone)');
        if (after == null) container.appendChild(touchDragItem); else container.insertBefore(touchDragItem, after);
    }
}
function handleTouchEnd(e, item, moveHandler, endHandler, type) {
    stopAutoScroll();
    document.removeEventListener('touchmove', moveHandler); document.removeEventListener('touchend', endHandler);
    if(touchClone) touchClone.remove(); touchClone = null; item.style.opacity = '1';
    if(type === 'card') updateItemOrder(); else updateCategoryOrder();
}
function handleVerticalDrag(e, container, dragClass, staticClass) {
    e.preventDefault(); const dragging = container.querySelector(dragClass); if (!dragging) return;
    const afterElement = getVerticalDragAfterElement(container, e.clientY, staticClass);
    if (afterElement == null) container.appendChild(dragging); else container.insertBefore(dragging, afterElement);
}
function getVerticalDragAfterElement(container, y, selector) {
    const draggableElements = [...container.querySelectorAll(selector)];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child }; else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
function getDragAfterElement(container, x, y) {
    const els = [...container.querySelectorAll('.item-card:not(.dragging)')].filter(e => e !== touchDragItem);
    return els.reduce((closest, child) => {
        const box = child.getBoundingClientRect(); const offset = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
        if (offset < closest.distance) return { distance: offset, element: child }; else return closest;
    }, { distance: Number.POSITIVE_INFINITY }).element;
}
function updateCategoryOrder() {
    const newOrderIds = [...catContainer.querySelectorAll('.category-row')].map(el => el.dataset.catId);
    const newCategories = []; newOrderIds.forEach(id => { const cat = categories.find(c => c.id === id); if (cat) newCategories.push(cat); });
    categories = newCategories; saveData();
}
function updateSubtaskOrder() {
    const rows = subContainer.querySelectorAll('.modal-subtask-item');
    const newSubtasks = []; rows.forEach(row => { const id = parseInt(row.dataset.subId); const sub = tempSubtasks.find(s => s.id === id); if (sub) newSubtasks.push(sub); });
    tempSubtasks = newSubtasks;
}
function updateItemOrder() {
    const newOrderIds = [...grid.querySelectorAll('.item-card')].map(el => parseInt(el.dataset.id));
    let indices = []; newOrderIds.forEach(id => { const idx = items.findIndex(i => i.id === id); if (idx !== -1) indices.push(idx); });
    const sortedIndices = [...indices].sort((a, b) => a - b);
    let newItems = [...items]; for (let i = 0; i < newOrderIds.length; i++) { const targetId = newOrderIds[i]; const original = items.find(item => item.id === targetId); newItems[sortedIndices[i]] = original; }
    items = newItems; saveData();
}

// --- MARKDOWN & HELPERS ---
function parseMarkdown(text) {
    if (!text) return '';
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.*?)__/g, '<u>$1</u>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');
    html = html.replace(/~~(.*?)~~/g, '<s>$1</s>');
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/\n/g, '<br>');
    return html;
}

function toggleSort() {
    if (sortBy === 'manual') { sortBy = 'date'; document.getElementById('sortLabel').textContent = 'Due Date'; } 
    else { sortBy = 'manual'; document.getElementById('sortLabel').textContent = 'Manual'; }
    renderItems();
}

function showToast(message, onUndo) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div'); toast.className = 'toast';
    let html = `<span>${message}</span>`;
    if (onUndo) html += `<button class="toast-undo">Undo</button>`;
    toast.innerHTML = html;
    if (onUndo) toast.querySelector('.toast-undo').onclick = () => { onUndo(); toast.remove(); };
    container.appendChild(toast);
    setTimeout(() => { if (toast.parentElement) toast.remove(); }, 5000);
}

// --- REMINDER LOGIC (Google Calendar Style) ---
function addReminderRow(val = 10, unit = 'minutes') {
    const list = document.getElementById('reminderList');
    const div = document.createElement('div');
    div.className = 'reminder-row';
    div.innerHTML = `
        <input type="number" class="reminder-val" value="${val}" min="1">
        <select class="reminder-unit">
            <option value="minutes" ${unit==='minutes'?'selected':''}>minutes</option>
            <option value="hours" ${unit==='hours'?'selected':''}>hours</option>
            <option value="days" ${unit==='days'?'selected':''}>days</option>
            <option value="weeks" ${unit==='weeks'?'selected':''}>weeks</option>
        </select>
        <button type="button" class="btn-remove-reminder" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
    `;
    list.appendChild(div);
}

function getRemindersFromDOM() {
    const rows = document.querySelectorAll('.reminder-row');
    return Array.from(rows).map(row => ({
        val: parseInt(row.querySelector('.reminder-val').value) || 10,
        unit: row.querySelector('.reminder-unit').value
    }));
}

// --- BROWSER NOTIFICATION POLLING ---
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop notification");
    } else if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                new Notification("Notifications Enabled", { body: "You will now receive alerts for tasks." });
            }
        });
    }
}

// Check for reminders every 30 seconds
setInterval(checkReminders, 30000);

function checkReminders() {
    if (Notification.permission !== "granted") return;

    const now = new Date();
    // Round down to current minute timestamp for easier comparison
    const currentMinuteTs = Math.floor(now.getTime() / 60000) * 60000;

    items.forEach(item => {
        if (item.completed || !item.dueDate || !item.dueTime) return;
        if (!item.reminders || item.reminders.length === 0) return;

        // Calculate Task Due Time
        const dueTime = new Date(`${item.dueDate}T${item.dueTime}`).getTime();

        item.reminders.forEach((rem, idx) => {
            let offsetMs = 0;
            if (rem.unit === 'minutes') offsetMs = rem.val * 60 * 1000;
            if (rem.unit === 'hours') offsetMs = rem.val * 60 * 60 * 1000;
            if (rem.unit === 'days') offsetMs = rem.val * 24 * 60 * 60 * 1000;
            if (rem.unit === 'weeks') offsetMs = rem.val * 7 * 24 * 60 * 60 * 1000;

            const notifyTime = dueTime - offsetMs;
            
            // Check if reminder is due NOW (within the last 60 seconds window)
            // AND check if we haven't already fired it in this session
            const uniqueNotifId = `${item.id}_${idx}`;

            if (notifyTime <= now.getTime() && notifyTime > (now.getTime() - 60000)) {
                if (!firedNotifications.has(uniqueNotifId)) {
                    new Notification(item.title, {
                        body: `Due in ${rem.val} ${rem.unit}`,
                        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">✓</text></svg>'
                    });
                    firedNotifications.add(uniqueNotifId);
                }
            }
        });
    });
}


// --- CRUD & LOGIC ---
function openNewItem(preselectedType) {
    editingId = null; tempSubtasks = [];
    document.getElementById('itemForm').reset();
    populateCategorySelect();
    if (preselectedType) document.getElementById('itemType').value = preselectedType;
    document.getElementById('modalTitle').textContent = 'New Item';
    renderTempSubtasks();
    
    // Default Reminders: Start with one (30 min)
    document.getElementById('reminderList').innerHTML = '';
    addReminderRow(30, 'minutes');

    document.getElementById('itemModal').classList.add('active');
    setTimeout(() => document.getElementById('itemTitle').focus(), 100);
}

function editItem(id) {
    const item = items.find(i => i.id === id);
    if (item) {
        editingId = id; populateCategorySelect();
        document.getElementById('itemTitle').value = item.title;
        document.getElementById('itemType').value = item.type;
        document.getElementById('itemDate').value = item.dueDate || '';
        document.getElementById('itemTime').value = item.dueTime || '';
        document.getElementById('itemDescription').value = item.description;
        tempSubtasks = [...item.subtasks];
        
        // Load Reminders
        const list = document.getElementById('reminderList');
        list.innerHTML = '';
        if(item.reminders && item.reminders.length > 0) {
            item.reminders.forEach(r => addReminderRow(r.val, r.unit));
        } else {
             // Optional: add default row if editing and none exist? Or leave empty.
        }

        document.getElementById('modalTitle').textContent = 'Edit Item';
        renderTempSubtasks();
        document.getElementById('itemModal').classList.add('active');
    }
}

function deleteItem(id) {
    const idx = items.findIndex(i => i.id === id);
    if (idx === -1) return;
    const deletedItem = items[idx];
    items.splice(idx, 1);
    saveData();
    renderItems();
    renderSidebar(); // Update counts
    showToast("Item deleted.", () => { items.splice(idx, 0, deletedItem); saveData(); renderItems(); renderSidebar(); });
}

function clearDateTime() {
    const dateInput = document.getElementById('itemDate');
    const timeInput = document.getElementById('itemTime');
    dateInput.value = '';
    timeInput.value = '';
    dateInput.setCustomValidity('');
    timeInput.setCustomValidity('');
    dateInput.removeAttribute('required');
    timeInput.removeAttribute('required');
}

function closeModal() { document.getElementById('itemModal').classList.remove('active'); setTimeout(() => { document.getElementById('itemForm').reset(); editingId = null; tempSubtasks = []; }, 200); }

document.getElementById('itemForm').onsubmit = (e) => {
    e.preventDefault();
    const reminders = getRemindersFromDOM();
    
    const item = {
        id: editingId || Date.now(),
        title: document.getElementById('itemTitle').value,
        type: document.getElementById('itemType').value,
        dueDate: document.getElementById('itemDate').value,
        dueTime: document.getElementById('itemTime').value,
        description: document.getElementById('itemDescription').value,
        subtasks: tempSubtasks,
        reminders: reminders, // Store reminders
        completed: editingId ? items.find(i => i.id === editingId).completed : false,
        notified: editingId ? items.find(i => i.id === editingId).notified : false,
        createdAt: Date.now()
    };
    
    // Save to Array
    if (editingId) items[items.findIndex(i => i.id === editingId)] = item; else items.push(item);
    
    saveData(); 

    closeModal(); 
    renderItems(); 
    renderSidebar(); 
};

function addSubtask() { const val = document.getElementById('subtaskInput').value.trim(); if(val) { tempSubtasks.push({ text: val, completed: false, id: Date.now() }); document.getElementById('subtaskInput').value=''; renderTempSubtasks(); } }
function removeSubtask(idx) { tempSubtasks.splice(idx, 1); renderTempSubtasks(); }
function renderTempSubtasks() {
    document.getElementById('subtaskList').innerHTML = tempSubtasks.map((st, idx) => `
        <div class="modal-subtask-item" draggable="true" data-sub-id="${st.id}">
            <div style="display:flex; align-items:center; width:100%;"><i class="fas fa-grip-vertical sub-handle" style="font-size:12px; color:var(--border-color); margin-right:10px; cursor:grab;"></i><span>${st.text}</span></div>
            <button type="button" onclick="removeSubtask(${idx})"><i class="fas fa-trash"></i></button>
        </div>`).join('');
    document.getElementById('subtaskList').querySelectorAll('.modal-subtask-item').forEach(row => {
        row.addEventListener('dragstart', () => { setTimeout(() => row.classList.add('dragging-sub'), 0); });
        row.addEventListener('dragend', () => { row.classList.remove('dragging-sub'); updateSubtaskOrder(); });
        const handle = row.querySelector('.sub-handle');
        handle.addEventListener('touchstart', (e) => handleTouchStart(e, row, 'subtask', document.getElementById('subtaskList')), {passive: false});
    });
}

function toggleItemStatus(id) { const item = items.find(i => i.id === id); item.completed = !item.completed; saveData(); renderItems(); renderSidebar(); if(item.completed) showToast("Item completed."); }
function toggleSubtask(itemId, subtaskId) { 
    const item = items.find(i => i.id === itemId); 
    if(item) { 
        const st = item.subtasks.find(s => s.id === subtaskId); 
        if(st) { 
            st.completed = !st.completed; saveData(); 
            const card = document.querySelector(`.item-card[data-id="${itemId}"]`);
            if(!card) { renderItems(); return; } 
            const row = card.querySelector(`.subtask[data-sub-id="${subtaskId}"] input`);
            if(row) row.checked = st.completed;
            const completed = item.subtasks.filter(s => s.completed).length;
            const pct = (completed / item.subtasks.length) * 100;
            const bar = card.querySelector('.progress-bar');
            if(bar) bar.style.width = `${pct}%`;
        } 
    } 
}

function addNewCategory() { const name = prompt("Category Name:"); if(name) { categories.push({id: 'cat_'+Date.now(), name: name.trim()}); saveData(); renderSidebar(); } }
function deleteCategory(id) { 
    if(confirm("Delete category and items?")) { 
        categories = categories.filter(c => c.id !== id); 
        items = items.filter(i => i.type !== id); 
        selectedTags.delete(id);
        saveData(); renderSidebar(); renderItems(); 
    } 
}
function renameCategory(id) { const cat = categories.find(c => c.id === id); const name = prompt("New Name:", cat.name); if(name) { cat.name = name.trim(); saveData(); renderSidebar(); } }
function populateCategorySelect() { document.getElementById('itemType').innerHTML = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join(''); }
function getCategoryName(id) { const cat = categories.find(c => c.id === id); return cat ? cat.name : 'Unknown'; }

// --- SETTINGS & THEMES ---
function openSettings() { 
    document.getElementById('settingsModal').classList.add('active'); 
    initSettingsInputs(); // Make sure inputs reflect current state
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('active'); }
function switchSettingsTab(tabId) {
    document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.settings-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
}
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = document.getElementById('themeBtn').querySelector('i');

    icon.classList.remove('fa-moon', 'fa-sun', 'fa-repeat');

    // 2. Check if it is ANY Ranny variant
    if (theme.startsWith('ranny')) {
        // Show the "Cycle/Switch" icon
        icon.classList.add('fa-repeat'); 
    } 
    // 3. Otherwise, check standard Dark themes
    else {
        const darkThemes = [
            'dark', 'dark-green', 'dark-purple', 'dark-blue', 'dark-red', 'dark-cafe'
        ];

        if (darkThemes.includes(theme)) {
            icon.classList.add('fa-moon');
        } else {
            icon.classList.add('fa-sun');
        }
    }
}
function toggleTheme() {
    const current = localStorage.getItem('theme') || 'light';
    let nextTheme = 'light';
    const themePairs = {
        'light': 'dark', 'dark': 'light',
        'light-green': 'dark-green', 'dark-green': 'light-green',
        'light-purple': 'dark-purple', 'dark-purple': 'light-purple',
        'light-blue': 'dark-blue', 'dark-blue': 'light-blue',
        'pink': 'dark-red', 'dark-red': 'pink',
        'light-cafe': 'dark-cafe', 'dark-cafe': 'light-cafe', 
        'ranny': 'ranny-red', 'ranny-red': 'ranny-orange', 'ranny-orange':'ranny-yellow', 'ranny-yellow':'ranny-mint', 'ranny-mint':'ranny-green', 'ranny-green':'ranny-cyan', 'ranny-cyan':'ranny-blue', 'ranny-blue':'ranny-purple', 'ranny-purple':'ranny'
    };
    if (themePairs[current]) nextTheme = themePairs[current];
    else nextTheme = current.includes('dark') ? 'light' : 'dark';
    setTheme(nextTheme);
}
function triggerImport() { document.getElementById('importFile').click(); }
function exportData() {
    const blob = new Blob([JSON.stringify({ items, categories, version: 1 }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'foothold-data.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function importData(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.items && data.categories && confirm('Overwrite current data?')) { items = data.items; categories = data.categories; saveData(); location.reload(); }
        } catch (error) { alert('Error parsing file.'); }
        input.value = '';
    };
    reader.readAsText(file);
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme) setTheme(savedTheme);

renderSidebar();
renderItems();
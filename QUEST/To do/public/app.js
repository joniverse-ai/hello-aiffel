const form = document.getElementById('todo-form');
const input = document.getElementById('todo-input');
const dateInput = document.getElementById('todo-date');
const categorySelect = document.getElementById('todo-category');
const tagSelectEl = document.getElementById('tag-select');
const tagDropdown = document.getElementById('tag-dropdown');
const list = document.getElementById('todo-list');
const emptyMsg = document.getElementById('empty-msg');
const filterBar = document.querySelector('.filter-bar');

const catForm = document.getElementById('cat-form');
const catInput = document.getElementById('cat-input');
const catColor = document.getElementById('cat-color');
const catList = document.getElementById('cat-list');

const tagForm = document.getElementById('tag-form');
const tagInput = document.getElementById('tag-input');
const tagColor = document.getElementById('tag-color');
const tagList = document.getElementById('tag-list');

let currentFilter = 'all';
let categories = [];
let tags = [];

// --- Date input: default to today, always open calendar on click ---
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

dateInput.value = todayStr();

dateInput.addEventListener('click', (e) => {
  e.preventDefault();
  if (typeof dateInput.showPicker === 'function') {
    dateInput.showPicker();
  }
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// --- Tag dropdown ---
tagSelectEl.addEventListener('click', (e) => {
  e.stopPropagation();
  tagDropdown.hidden = !tagDropdown.hidden;
});

document.addEventListener('click', () => { tagDropdown.hidden = true; });
tagDropdown.addEventListener('click', (e) => { e.stopPropagation(); });

function getSelectedTagIds() {
  return Array.from(tagDropdown.querySelectorAll('input:checked')).map(cb => Number(cb.value));
}

function updateTagSelectLabel() {
  const selected = getSelectedTagIds();
  const label = tagSelectEl.querySelector('.tag-select-label');
  if (selected.length === 0) {
    label.textContent = '태그 선택...';
    label.style.color = '#888';
  } else {
    const names = selected.map(id => tags.find(t => t.id === id)?.name).filter(Boolean);
    label.textContent = names.join(', ');
    label.style.color = '#333';
  }
}

function renderTagDropdown() {
  tagDropdown.innerHTML = '';
  if (tags.length === 0) {
    tagDropdown.innerHTML = '<div style="padding:0.5rem;color:#aaa;font-size:0.8rem;">태그 없음</div>';
    return;
  }
  tags.forEach(tag => {
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="checkbox" value="${tag.id}">
      <span class="dot" style="background:${tag.color || '#8b5cf6'};width:8px;height:8px;border-radius:50%;display:inline-block"></span>
      ${escapeHtml(tag.name)}
    `;
    label.querySelector('input').addEventListener('change', updateTagSelectLabel);
    tagDropdown.appendChild(label);
  });
}

// --- Render todos ---
function renderTodos(todos) {
  list.innerHTML = '';
  emptyMsg.hidden = todos.length > 0;

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (todo.completed ? ' completed' : '');

    let metaHtml = '';
    if (todo.category_name) {
      metaHtml += `<span class="todo-category-badge" style="background:${todo.category_color || '#888'}">${escapeHtml(todo.category_name)}</span>`;
    }
    if (todo.tags && todo.tags.length > 0) {
      todo.tags.forEach(tag => {
        metaHtml += `<span class="todo-tag" style="background:${tag.color || '#8b5cf6'}">${escapeHtml(tag.name)}</span>`;
      });
    }

    li.innerHTML = `
      <input type="checkbox" ${todo.completed ? 'checked' : ''}>
      <span class="todo-title">${escapeHtml(todo.title)}</span>
      <div class="todo-meta">
        ${metaHtml}
        ${todo.due_date ? `<span class="todo-due">${todo.due_date}</span>` : ''}
      </div>
      <button class="todo-delete" aria-label="삭제">&times;</button>
    `;

    li.querySelector('input[type="checkbox"]').addEventListener('change', () => {
      toggleTodo(todo.id, todo.completed ? 0 : 1);
    });

    li.querySelector('.todo-delete').addEventListener('click', () => {
      deleteTodo(todo.id);
    });

    list.appendChild(li);
  });
}

// --- Filter bar ---
function renderFilterBar() {
  filterBar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn' + (currentFilter === 'all' ? ' active' : '');
  allBtn.dataset.filter = 'all';
  allBtn.textContent = '전체';
  filterBar.appendChild(allBtn);

  const todayBtn = document.createElement('button');
  todayBtn.className = 'filter-btn' + (currentFilter === 'today' ? ' active' : '');
  todayBtn.dataset.filter = 'today';
  todayBtn.textContent = '오늘 할 일';
  filterBar.appendChild(todayBtn);

  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn cat-filter' + (currentFilter === `cat-${cat.id}` ? ' active' : '');
    btn.dataset.filter = `cat-${cat.id}`;
    const color = cat.color || '#888';
    btn.style.borderColor = color;
    if (currentFilter === `cat-${cat.id}`) {
      btn.style.background = color;
    }
    btn.textContent = cat.name;
    filterBar.appendChild(btn);
  });
}

filterBar.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-btn');
  if (!btn) return;
  currentFilter = btn.dataset.filter;
  renderFilterBar();
  fetchTodos();
});

// --- API calls ---
async function fetchTodos() {
  let query = '';
  if (currentFilter === 'today') {
    query = '?today=true';
  } else if (currentFilter.startsWith('cat-')) {
    query = '?category_id=' + currentFilter.slice(4);
  }
  const res = await fetch('/api/todos' + query);
  const todos = await res.json();
  renderTodos(todos);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = input.value.trim();
  if (!title) return;

  const body = {
    title,
    category_id: categorySelect.value ? Number(categorySelect.value) : undefined,
    due_date: dateInput.value || undefined,
    tag_ids: getSelectedTagIds(),
  };

  await fetch('/api/todos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  input.value = '';
  dateInput.value = todayStr();
  categorySelect.value = '';
  tagDropdown.querySelectorAll('input').forEach(cb => { cb.checked = false; });
  updateTagSelectLabel();
  fetchTodos();
  renderCalendar();
});

async function toggleTodo(id, completed) {
  await fetch(`/api/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  });
  fetchTodos();
  renderCalendar();
}

async function deleteTodo(id) {
  await fetch(`/api/todos/${id}`, { method: 'DELETE' });
  fetchTodos();
  renderCalendar();
}

// --- Categories ---
async function fetchCategories() {
  const res = await fetch('/api/categories');
  categories = await res.json();
  renderCategorySelect();
  renderCategoryList();
  renderFilterBar();
}

function renderCategorySelect() {
  categorySelect.innerHTML = '<option value="">카테고리 없음</option>';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

function renderCategoryList() {
  catList.innerHTML = '';
  categories.forEach(cat => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><span class="dot" style="background:${cat.color || '#888'}"></span>${escapeHtml(cat.name)}</span>
      <button class="delete-btn" aria-label="삭제">&times;</button>
    `;
    li.querySelector('.delete-btn').addEventListener('click', async () => {
      await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      fetchCategories();
      fetchTodos();
    });
    catList.appendChild(li);
  });
}

catForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = catInput.value.trim();
  if (!name) return;
  await fetch('/api/categories', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color: catColor.value }),
  });
  catInput.value = '';
  fetchCategories();
});

// --- Tags ---
async function fetchTags() {
  const res = await fetch('/api/tags');
  tags = await res.json();
  renderTagList();
  renderTagDropdown();
}

function renderTagList() {
  tagList.innerHTML = '';
  tags.forEach(tag => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span><span class="dot" style="background:${tag.color || '#8b5cf6'}"></span>${escapeHtml(tag.name)}</span>
      <button class="delete-btn" aria-label="삭제">&times;</button>
    `;
    li.querySelector('.delete-btn').addEventListener('click', async () => {
      await fetch(`/api/tags/${tag.id}`, { method: 'DELETE' });
      fetchTags();
      fetchTodos();
    });
    tagList.appendChild(li);
  });
}

tagForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = tagInput.value.trim();
  if (!name) return;
  await fetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, color: tagColor.value }),
  });
  tagInput.value = '';
  fetchTags();
});

// --- Today's goal (localStorage) ---
const goalInput = document.getElementById('goal-input');
const goalKey = 'todo-goal-' + todayStr();
goalInput.value = localStorage.getItem(goalKey) || '';
goalInput.addEventListener('input', () => {
  localStorage.setItem(goalKey, goalInput.value);
});

// --- Month calendar ---
const calendarTitle = document.getElementById('calendar-title');
const calendarWeekdays = document.getElementById('calendar-weekdays');
const calendarDays = document.getElementById('calendar-days');

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function renderCalendar() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  calendarTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

  calendarWeekdays.innerHTML = '';
  WEEKDAYS.forEach(day => {
    const el = document.createElement('div');
    el.className = 'calendar-weekday';
    el.textContent = day;
    calendarWeekdays.appendChild(el);
  });

  const res = await fetch('/api/todos');
  const todos = await res.json();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
  const dueDays = new Set(
    todos
      .filter(t => t.due_date && t.due_date.startsWith(prefix) && !t.completed)
      .map(t => Number(t.due_date.slice(8, 10)))
  );

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();

  calendarDays.innerHTML = '';
  for (let i = 0; i < firstDayOfWeek; i++) {
    const el = document.createElement('div');
    el.className = 'calendar-day empty';
    calendarDays.appendChild(el);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const el = document.createElement('div');
    el.className = 'calendar-day' + (day === today ? ' today' : '');
    el.textContent = day;
    if (dueDays.has(day)) {
      const dot = document.createElement('span');
      dot.className = 'due-dot';
      el.appendChild(dot);
    }
    calendarDays.appendChild(el);
  }
}

// --- Init ---
fetchCategories();
fetchTags();
fetchTodos();
renderCalendar();

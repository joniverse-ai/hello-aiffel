const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'todo.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    color TEXT
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    category_id INTEGER,
    due_date TEXT,
    completed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(todo_id, tag_id)
  );
`);

const queries = {
  // todos
  getAll: db.prepare(`
    SELECT t.*, c.name AS category_name, c.color AS category_color
    FROM todos t LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY t.completed ASC, t.created_at DESC
  `),
  getToday: db.prepare(`
    SELECT t.*, c.name AS category_name, c.color AS category_color
    FROM todos t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.due_date = ?
    ORDER BY t.completed ASC, t.created_at DESC
  `),
  getByCategory: db.prepare(`
    SELECT t.*, c.name AS category_name, c.color AS category_color
    FROM todos t LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.category_id = ?
    ORDER BY t.completed ASC, t.created_at DESC
  `),
  insert: db.prepare('INSERT INTO todos (title, category_id, due_date) VALUES (?, ?, ?)'),
  toggleComplete: db.prepare('UPDATE todos SET completed = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM todos WHERE id = ?'),
  getById: db.prepare('SELECT * FROM todos WHERE id = ?'),

  // categories
  getAllCategories: db.prepare('SELECT * FROM categories ORDER BY name ASC'),
  insertCategory: db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)'),
  deleteCategory: db.prepare('DELETE FROM categories WHERE id = ?'),

  // tags
  getAllTags: db.prepare('SELECT * FROM tags ORDER BY name ASC'),
  insertTag: db.prepare('INSERT INTO tags (name, color) VALUES (?, ?)'),
  deleteTag: db.prepare('DELETE FROM tags WHERE id = ?'),

  // todo_tags
  getTagsByTodoId: db.prepare(`
    SELECT tg.* FROM tags tg
    JOIN todo_tags tt ON tg.id = tt.tag_id
    WHERE tt.todo_id = ?
  `),
  addTagToTodo: db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)'),
  removeTagFromTodo: db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?'),
};

module.exports = { db, queries };

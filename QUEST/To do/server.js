require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { queries } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Todos ---

app.get('/api/todos', (req, res) => {
  let todos;
  if (req.query.today === 'true') {
    const today = new Date().toISOString().slice(0, 10);
    todos = queries.getToday.all(today);
  } else if (req.query.category_id) {
    const catId = Number(req.query.category_id);
    if (!Number.isInteger(catId) || catId <= 0) {
      return res.status(400).json({ error: '유효하지 않은 카테고리 ID입니다.' });
    }
    todos = queries.getByCategory.all(catId);
  } else {
    todos = queries.getAll.all();
  }
  todos.forEach(t => { t.tags = queries.getTagsByTodoId.all(t.id); });
  res.json(todos);
});

app.post('/api/todos', (req, res) => {
  const { title, category_id, due_date, tag_ids } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: '제목을 입력해주세요.' });
  }
  if (due_date && !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) {
    return res.status(400).json({ error: '날짜 형식이 올바르지 않습니다.' });
  }
  if (category_id !== undefined && category_id !== null) {
    const catId = Number(category_id);
    if (!Number.isInteger(catId) || catId <= 0) {
      return res.status(400).json({ error: '유효하지 않은 카테고리 ID입니다.' });
    }
  }
  const result = queries.insert.run(title.trim(), category_id || null, due_date || null);
  const todoId = result.lastInsertRowid;
  if (Array.isArray(tag_ids)) {
    tag_ids.forEach(tagId => {
      const id = Number(tagId);
      if (Number.isInteger(id) && id > 0) queries.addTagToTodo.run(todoId, id);
    });
  }
  const tags = queries.getTagsByTodoId.all(todoId);
  res.status(201).json({ id: todoId, title: title.trim(), category_id: category_id || null, due_date: due_date || null, completed: 0, tags });
});

app.patch('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  const todo = queries.getById.get(id);
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });

  const completed = req.body.completed;
  if (completed !== 0 && completed !== 1) {
    return res.status(400).json({ error: 'completed 값은 0 또는 1이어야 합니다.' });
  }
  queries.toggleComplete.run(completed, id);
  res.json({ ...todo, completed });
});

app.delete('/api/todos/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  const result = queries.delete.run(id);
  if (result.changes === 0) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.json({ success: true });
});

// --- Tags on Todos ---

app.post('/api/todos/:id/tags', (req, res) => {
  const todoId = Number(req.params.id);
  const tagId = Number(req.body.tag_id);
  if (!Number.isInteger(todoId) || todoId <= 0 || !Number.isInteger(tagId) || tagId <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  if (!queries.getById.get(todoId)) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  queries.addTagToTodo.run(todoId, tagId);
  res.json({ success: true });
});

app.delete('/api/todos/:id/tags/:tagId', (req, res) => {
  const todoId = Number(req.params.id);
  const tagId = Number(req.params.tagId);
  if (!Number.isInteger(todoId) || todoId <= 0 || !Number.isInteger(tagId) || tagId <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  queries.removeTagFromTodo.run(todoId, tagId);
  res.json({ success: true });
});

// --- Categories ---

app.get('/api/categories', (req, res) => {
  res.json(queries.getAllCategories.all());
});

app.post('/api/categories', (req, res) => {
  const { name, color } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '카테고리 이름을 입력해주세요.' });
  }
  const result = queries.insertCategory.run(name.trim(), color || null);
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), color: color || null });
});

app.delete('/api/categories/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  const result = queries.deleteCategory.run(id);
  if (result.changes === 0) return res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
  res.json({ success: true });
});

// --- Tags ---

app.get('/api/tags', (req, res) => {
  res.json(queries.getAllTags.all());
});

app.post('/api/tags', (req, res) => {
  const { name, color } = req.body;
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: '태그 이름을 입력해주세요.' });
  }
  try {
    const result = queries.insertTag.run(name.trim(), color || null);
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), color: color || null });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: '이미 존재하는 태그입니다.' });
    }
    throw err;
  }
});

app.delete('/api/tags/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: '유효하지 않은 ID입니다.' });
  }
  const result = queries.deleteTag.run(id);
  if (result.changes === 0) return res.status(404).json({ error: '태그를 찾을 수 없습니다.' });
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Todo 앱 실행 중: http://localhost:${PORT}`);
});

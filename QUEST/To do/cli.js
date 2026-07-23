#!/usr/bin/env node
const { queries } = require('./database');

const [cmd, ...args] = process.argv.slice(2);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function printTodo(t) {
  const check = t.completed ? '\x1b[9m✓\x1b[0m' : '○';
  const title = t.completed ? `\x1b[9m\x1b[2m${t.title}\x1b[0m` : t.title;
  const due = t.due_date ? `  (${t.due_date})` : '';
  const cat = t.category_name ? `  [${t.category_name}]` : '';
  console.log(`  ${String(t.id).padStart(3)}  ${check}  ${title}${cat}${due}`);
}

const commands = {
  add() {
    const title = args.join(' ').trim();
    if (!title) { console.error('사용법: todo add <할 일>'); process.exit(1); }
    const result = queries.insert.run(title, null, today());
    console.log(`추가됨 (#${result.lastInsertRowid}): ${title}`);
  },

  list() {
    const flag = args[0];
    let todos;
    if (flag === '--today' || flag === '-t') {
      todos = queries.getToday.all(today());
    } else {
      todos = queries.getAll.all();
    }
    if (todos.length === 0) { console.log('할 일이 없습니다.'); return; }
    todos.forEach(printTodo);
  },

  done() {
    const id = Number(args[0]);
    if (!Number.isInteger(id) || id <= 0) { console.error('사용법: todo done <id>'); process.exit(1); }
    const todo = queries.getById.get(id);
    if (!todo) { console.error(`#${id} 을(를) 찾을 수 없습니다.`); process.exit(1); }
    queries.toggleComplete.run(todo.completed ? 0 : 1, id);
    console.log(todo.completed ? `미완료로 변경: ${todo.title}` : `완료! ${todo.title}`);
  },

  summary() {
    const todos = queries.getToday.all(today());
    const done = todos.filter(t => t.completed);
    const pending = todos.filter(t => !t.completed);
    console.log(`\n  📋 오늘(${today()}) 요약`);
    console.log(`  완료 ${done.length}개 / 전체 ${todos.length}개\n`);
    if (done.length) { console.log('  ── 완료 ──'); done.forEach(printTodo); }
    if (pending.length) { console.log('  ── 남은 일 ──'); pending.forEach(printTodo); }
    if (!todos.length) console.log('  오늘 할 일이 없습니다.');
    console.log();
  },
};

if (!cmd || !commands[cmd]) {
  console.log('사용법: todo <add|list|done|summary>');
  console.log('  add <할 일>        할 일 추가 (마감일: 오늘)');
  console.log('  list [--today]     목록 보기 (--today: 오늘만)');
  console.log('  done <id>          완료 토글');
  console.log('  summary            오늘 완료 요약');
  process.exit(cmd ? 1 : 0);
}

commands[cmd]();

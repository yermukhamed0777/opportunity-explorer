import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
const data = JSON.parse(readFileSync('data/development.json')),
  resources = JSON.parse(readFileSync('data/resources.json'));
test('private workspace DOM workflows: onboarding, record review, plan edits, course/skill progress, comparison and privacy', async () => {
  const w = new Window({ url: 'https://app.example/' });
  w.document.body.innerHTML = '<section id="platform-panel"></section>';
  for (const key of [
    'window',
    'document',
    'location',
    'history',
    'FormData',
    'HTMLFormElement',
  ])
    globalThis[key] = key === 'window' ? w : w[key];
  globalThis.confirm = () => true;
  const tables = Object.fromEntries(
    [
      'preferences',
      'documents',
      'profile_records',
      'user_skills',
      'course_progress',
      'plans',
      'plan_items',
      'saved_searches',
      'recent_views',
    ].map((x) => [x, []]),
  );
  let counter = 0;
  const db = {
    from(table) {
      let mode = 'read',
        value,
        filters = [];
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters.push([k, v]);
          return q;
        },
        upsert(v) {
          mode = 'upsert';
          value = v;
          return q;
        },
        insert(v) {
          mode = 'insert';
          value = v;
          return q;
        },
        delete() {
          mode = 'delete';
          return q;
        },
        then(resolve, reject) {
          return Promise.resolve()
            .then(() => {
              const rows = tables[table] || [];
              if (mode === 'read')
                return {
                  data: rows
                    .filter((x) => filters.every(([k, v]) => x[k] === v))
                    .map((x) => ({ ...x })),
                };
              if (mode === 'delete') {
                tables[table] = rows.filter(
                  (x) => !filters.every(([k, v]) => x[k] === v),
                );
                return { data: [] };
              }
              const values = Array.isArray(value) ? value : [value],
                changed = [];
              for (const v of values) {
                const key = v.skill_id
                  ? 'skill_id'
                  : v.course_id
                    ? 'course_id'
                    : v.id
                      ? 'id'
                      : 'user_id';
                let old =
                  mode === 'upsert'
                    ? rows.find((x) => x[key] === v[key])
                    : null;
                if (old) Object.assign(old, v);
                else {
                  old = {
                    id: 'test-' + ++counter,
                    created_at: new Date().toISOString(),
                    ...v,
                  };
                  rows.push(old);
                }
                changed.push({ ...old });
              }
              tables[table] = rows;
              return { data: changed };
            })
            .then(resolve, reject);
        },
      };
      return q;
    },
  };
  w.PROSPECTO_DEVELOPMENT = data;
  w.PROSPECTO_RESOURCES = resources;
  w.OPPORTUNITIES = JSON.parse(
    readFileSync('data/opportunities.json'),
  ).opportunities;
  w.ProspectoAuth = {
    client: db,
    user: { id: 'owner' },
    fetch: async () => ({
      ok: true,
      json: async () => ({ deletionConfigured: false }),
    }),
  };
  w.ProspectoTracker = { setView: (v) => w.ProspectoWorkspace.render(v) };
  await import('../src/workspace.js');
  const settle = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
  };
  const render = async (v) => {
    await w.ProspectoWorkspace.render(v);
    await settle();
    assert(!w.document.querySelector('[role=alert]'), 'view failed: ' + v);
  };
  const click = async (selector) => {
    const el = w.document.querySelector(selector);
    assert(el, 'Missing ' + selector);
    el.click();
    await settle();
  };
  const submit = async (selector) => {
    const form = w.document.querySelector(selector);
    assert(form);
    form.dispatchEvent(
      new w.Event('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
  };
  await render('onboarding');
  w.document.querySelector('[name=name]').value = 'Student';
  await submit('#work-onboarding');
  assert.equal(tables.preferences[0].onboarding_step, 1);
  w.document.querySelector('[name=fields][value=mse]').checked = true;
  await submit('#work-onboarding');
  await submit('#work-onboarding');
  await submit('#work-onboarding');
  assert(tables.preferences[0].onboarding_complete);
  assert.deepEqual(tables.preferences[0].field_ids, ['mse']);
  await render('profile');
  await click('[data-work=record]');
  w.document.querySelector('[name=title]').value = 'Supervised project';
  await submit('#work-dialog form');
  assert.equal(tables.profile_records[0].title, 'Supervised project');
  assert.equal(tables.profile_records[0].ai_allowed, false);
  await render('plan');
  await click('[data-work=new-plan]');
  w.document.querySelector('[name=goal]').value = 'Build a portfolio';
  await submit('#work-dialog form');
  assert.equal(tables.plans[0].weekly_hours, 5);
  await click('[data-work=new-item]');
  w.document.querySelector('[name=title]').value = 'Analyze one dataset';
  await submit('#work-dialog form');
  assert.equal(tables.plan_items[0].title, 'Analyze one dataset');
  await render('courses');
  await click('[data-work=course]');
  await submit('#work-dialog form');
  assert.equal(tables.course_progress[0].state, 'Planned');
  await render('skills');
  await click('[data-work=skill]');
  w.document.querySelector('[name=state]').value = 'Demonstrated';
  await submit('#work-dialog form');
  assert.match(
    w.document.querySelector('[role=alert]').textContent,
    /evidence/,
  );
  w.document.querySelector('[name=evidence]').value = 'Annotated report';
  await submit('#work-dialog form');
  assert.equal(tables.user_skills[0].state, 'Demonstrated');
  await render('universities');
  await click('[data-work=compare-uni]');
  assert(w.document.querySelector('table'));
  assert.equal(w.document.querySelectorAll('thead th').length, 2);
  await render('finder');
  await submit('#work-search');
  assert(w.document.querySelector('[data-view-source]'));
  for (const v of ['dashboard', 'pathways', 'documents', 'privacy'])
    await render(v);
  assert.match(
    w.document.body.textContent,
    /Account deletion is not yet enabled/,
  );
  assert(!w.document.querySelector('[data-work=delete-account]'));
  w.document.querySelector('[name=allow_profile_ai]').checked = true;
  await submit('#work-privacy');
  assert(tables.preferences[0].allow_profile_ai);
  await w.happyDOM.close();
});

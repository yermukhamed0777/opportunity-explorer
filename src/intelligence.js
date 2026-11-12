import {
  cycleStatus,
  deadlineInfo,
  explainFit,
  stableSort,
  compareEvidence,
  visibleNotifications,
  contentTotals,
  canonicalUrl,
} from '../lib/intelligence-core.js';
const A = window.ProspectoAuth,
  db = A.client,
  uid = A.user.id,
  B = window.ProspectoWorkspace;
const records = window.PROSPECTO_INTELLIGENCE?.records || [],
  majors = window.PROSPECTO_DEVELOPMENT.majors;
const views = [
  'professionals',
  'projects',
  'research',
  'cv-library',
  'funding',
  'admissions-folders',
  'locations',
  'comparison',
  'whats-new',
  'admin',
  'saved-library',
];
B.views.push(...views);
let state = {},
  base = {},
  loaded = false,
  loading,
  view = '',
  search = '',
  field = '',
  level = '',
  selected = '',
  compareIds = [],
  undo = null;
const E = (x) =>
  String(x ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const btn = (a, t, id = '', cls = 'secondary') =>
  `<button type="button" class="${cls}" data-intel="${a}" data-id="${E(id)}">${E(t)}</button>`;
const options = (list, current = '', all = 'All') =>
  `<option value="">${E(all)}</option>` +
  list
    .map((v) => {
      const [id, name] = Array.isArray(v) ? v : [v, v];
      return `<option value="${E(id)}" ${String(id) === String(current) ? 'selected' : ''}>${E(name)}</option>`;
    })
    .join('');
const select = (label, name, list, current = '', all = 'Not specified') =>
  `<label>${E(label)}<select name="${name}">${options(list, current, all)}</select></label>`;
const input = (label, name, value = '', type = 'text', extra = '') =>
  `<label>${E(label)}<input name="${name}" type="${type}" value="${E(value)}" ${extra}></label>`;
const area = (label, name, value = '', max = 30000) =>
  `<label>${E(label)}<textarea name="${name}" maxlength="${max}" rows="5">${E(value)}</textarea></label>`;
const tag = (text, cls = '') =>
  `<span class="work-tag ${cls}">${E(text)}</span>`;
const link = (url, name) => {
  try {
    return `<a href="${E(canonicalUrl(url))}" target="_blank" rel="noopener noreferrer">${E(name)} ↗</a>`;
  } catch {
    return '<span>Official link not verified</span>';
  }
};
const sources = (r) =>
  `<div class="resource-links">${(r.sources || []).map(([label, url]) => link(url, label)).join('')}</div><p class="resource-note">Reviewed ${E(r.checkedOn)} · ${E(r.verification || 'Source-backed; conditions can change')}</p>`;
const title = (name, text) =>
  `<header class="platform-heading"><span class="eyebrow">PROSPECTOAI · CONNECT YOUR NEXT STEP</span><h1>${E(name)}</h1><p>${E(text)}</p></header>`;
const empty = (text) =>
  `<div class="work-empty"><img src="/assets/white-lion.svg" width="96" height="96" alt=""><p>${E(text)}</p></div>`;
const actions = (r) =>
  `<div class="work-actions">${btn('save', state.saved_resources?.some((x) => x.resource_id === r.id) ? 'Saved · edit notes' : 'Save to my library', r.id)}${btn('task', 'Add to my plan', r.id)}${['project', 'research'].includes(r.kind) ? btn('evidence', 'Record my evidence', r.id) : ''}</div>`;
const filters = () =>
  `<div class="intel-filterbar"><label>Search<input id="intel-search" type="search" value="${E(search)}" maxlength="120" placeholder="Search this workspace"></label><label>Field<select id="intel-field">${options(
    majors.map((x) => [x.id, x.name]),
    field,
    'All fields',
  )}</select></label><label>Level / type<select id="intel-level">${options(['Beginner', 'Intermediate', 'Advanced', 'Leadership analysis', 'Public professional profile', 'Illustrative pathway archetype'], level, 'All levels / types')}</select></label></div>`;
function list(kind) {
  return stableSort(
    records.filter(
      (r) =>
        r.kind === kind &&
        r.status !== 'Archived' &&
        (!search ||
          JSON.stringify(r).toLowerCase().includes(search.toLowerCase())) &&
        (!field || r.fieldIds?.includes(field)) &&
        (!level || r.level === level || r.contentType === level),
    ),
    {
      preferences: base.preferences,
      records: base.profile_records,
      skills: base.user_skills,
    },
  );
}
async function result(q) {
  const { data, error } = await q;
  if (error) throw Error('This change could not be saved. Please retry.');
  return data;
}
async function load(force = false) {
  base = await B.getState();
  document.body.classList.toggle(
    'reduce-motion',
    base.preferences.basic.reduceMotion !== false,
  );
  if (loaded && !force) return;
  if (loading) return loading;
  loading = (async () => {
    const names = [
      'admissions_folders',
      'admissions_items',
      'folder_documents',
      'saved_resources',
      'evidence_links',
      'notification_states',
    ];
    const rows = await Promise.all(
      names.map((n) =>
        db
          .from(n)
          .select(
            n === 'admissions_items'
              ? 'id,user_id,folder_id,kind,title,url,due_date,completed,created_at'
              : '*',
          )
          .eq('user_id', uid),
      ),
    );
    if (rows.some((x) => x.error))
      throw Error('The expanded workspace could not load. Please retry.');
    names.forEach((n, i) => (state[n] = rows[i].data || []));
    const role = await db.rpc('is_content_admin');
    state.admin = !role.error && role.data === true;
    loaded = true;
  })();
  try {
    await loading;
  } finally {
    loading = null;
  }
}
function message(text) {
  const e = document.querySelector('#intel-status');
  if (e) e.textContent = text;
}
function goto(v) {
  window.ProspectoTracker.setView(v);
  history.replaceState(null, '', '#' + v);
}
async function refresh() {
  await load(true);
  await render(view);
  await updateNoticeBadge();
}
function personCard(r) {
  return `<article class="intel-case"><div class="intel-case-label">${tag(r.contentType || 'Public professional profile')}<h2>${E(r.name)}</h2><p>${E(r.role || 'Publicly documented work')}<br>${E(r.organization || '')}</p>${btn('compare', 'Compare my stage-appropriate evidence', r.id)}</div><div><h3>Verified public facts</h3><ul>${(r.facts || []).map((f) => `<li>${E(typeof f === 'string' ? f : f.text)} ${typeof f === 'object' && f.source ? link(f.source, 'Source') : ''}</li>`).join('')}</ul><p><strong>Education:</strong> ${E(r.education || 'Not established in the cited source; no qualification is inferred.')}</p><p><strong>Previous roles:</strong> ${E(r.previousRoles || 'Not established in this source summary.')}</p><details><summary>ProspectoAI analysis · interpretation, not verified causation</summary><p>${E(r.analysis)}</p><dl>${Object.entries(
    r.analysisDetails || {},
  )
    .map(([k, v]) => `<dt>${E(k)}</dt><dd>${E(v)}</dd>`)
    .join(
      '',
    )}</dl></details><p class="resource-note">${E(r.limitations)}</p>${sources(r)}${actions(r)}</div></article>`;
}
function professionals() {
  const people = list('professional'),
    paths = list('pathway');
  return (
    title(
      'Professional Pathways',
      'Study documented work, examine leadership transitions, and compare learning archetypes without treating any biography as a guaranteed route.',
    ) +
    filters() +
    `<div class="intel-section-tabs"><a href="#public-profiles">Verified public profiles & leadership analyses</a><a href="#archetypes">Illustrative pathway archetypes</a>${btn('go', 'CV and Portfolio Library', 'cv-library')}</div><section id="public-profiles"><h2>Public profiles & leadership analyses</h2>${people.map(personCard).join('') || empty('No matching public profile. Broaden the filters.')}</section><section id="archetypes"><h2>Illustrative pathway archetypes</h2><p>Educational composites, not real people, employer endorsements or required sequences.</p>${paths.map((r) => `<article class="work-card"><div class="intel-record-head"><div>${tag('Illustrative pathway archetype')}<h3>${E(r.name)}</h3></div>${btn('compare', 'Compare my evidence', r.id)}</div><p>${E(r.education)}</p><p><strong>Foundations:</strong> ${E(r.foundations?.join(' · '))}</p><p><strong>Tools:</strong> ${E(r.tools?.join(' · '))}</p><details><summary>Projects, early roles, transitions & alternatives</summary><p>${E(r.projects?.join(' '))}</p><p>${E(r.internships)} ${E(r.research)} ${E(r.teamwork)}</p><p>${E(r.earlyRoles)} ${E(r.progression)} ${E(r.alternatives)}</p><ol>${r.samplePlan?.map((x) => `<li>${E(x.phase)}: ${E(x.task)}</li>`).join('') || ''}</ol></details>${sources(r)}${actions(r)}</article>`).join('')}</section>`
  );
}
function compareView() {
  const target = records.find(
    (r) => r.id === selected && ['professional', 'pathway'].includes(r.kind),
  );
  if (!target)
    return (
      title(
        'Compare my development',
        'Choose a professional profile or illustrative archetype first.',
      ) + btn('go', 'Choose a pathway', 'professionals')
    );
  const categories = compareEvidence(target, {
    preferences: base.preferences,
    records: base.profile_records,
    skills: base.user_skills,
  });
  return (
    title(
      'My evidence and this direction',
      target.name +
        ' · learning comparison, not a prediction or a seniority score.',
    ) +
    `<div class="work-notice">Your stage: ${E(base.preferences.basic.stage || 'Not specified')}. Early-stage learners are not expected to have senior employment history. Evidence is self-reported; the comparison does not certify proficiency.</div><div class="intel-comparison">${categories
      .map(
        (c) =>
          `<section class="work-card"><h2>${E(c.name)}</h2><h3>Your recorded evidence</h3>${c.evidence.length ? '<ul>' + c.evidence.map((x) => `<li>${E(x.title)} · ${E(x.kind)}</li>`).join('') + '</ul>' : '<p>No matching evidence recorded yet.</p>'}<p>${E(c.missing)} ${E(c.why)}</p><p><strong>Next:</strong> ${E(c.next)}</p><p>${E(c.effort)}</p><p class="resource-note">${E(c.confidence)}</p><div class="work-actions">${[
            c.projectId,
            c.courseId,
            c.opportunityId,
          ]
            .filter(Boolean)
            .map((id) => {
              const r = records.find((x) => x.id === id);
              return r ? btn('detail', r.name, id) : '';
            })
            .join(
              '',
            )}${btn('comparison-task', 'Add a learning task', c.name)}</div></section>`,
      )
      .join('')}</div>`
  );
}
function projectCard(r) {
  return `<article class="work-card"><div class="intel-record-head"><div>${tag(r.level)} ${tag(r.methodType || r.type || 'Editorial project idea')}<h2>${E(r.name)}</h2></div>${tag(r.hours || 'Set your own pace')}</div><p>${E(r.question || r.problem)}</p><p><strong>For:</strong> ${E(r.stages?.join(' · '))} · ${E(r.fieldIds?.map((id) => majors.find((m) => m.id === id)?.name || id).join(' · '))}</p><p>${E(r.background || r.why)}</p><details><summary>Method, tools, evidence & safety</summary><dl>${[
    ['Application / target user', r.application],
    ['Required knowledge', r.knowledge?.join(' · ')],
    ['Tools', r.tools?.join(' · ')],
    ['Data source', r.datasetNote],
    ['Method', r.method],
    [
      'Deliverables',
      Array.isArray(r.deliverables)
        ? r.deliverables.join(' · ')
        : r.deliverables,
    ],
    ['Safety and ethics', r.safety],
    ['Limitations', r.limitations],
    ['Extension', r.extension],
    ['Portfolio description', r.portfolioDescription],
    ['Example CV bullet (fictional)', r.cvBullet],
    ['Interview explanation (example)', r.interview],
  ]
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${E(k)}</dt><dd>${E(v)}</dd>`)
    .join('')}</dl><div class="resource-links">${(r.courseIds || [])
    .map((id) => {
      const c = records.find((x) => x.id === id);
      return c ? link(c.url || c.sources[0][1], c.name) : '';
    })
    .join('')}</div></details>${sources(r)}${actions(r)}</article>`;
}
function projects(research = false) {
  const kind = research ? 'research' : 'project';
  return (
    title(
      research ? 'Research Idea Studio' : 'CV and Portfolio Library · Projects',
      research
        ? 'Explore realistic questions using your field, stage, tools, time and access to supervision. Ideas are proposals, not claims of novelty or completed research.'
        : 'Choose a project that produces evidence you can explain. Example descriptions are educational; use them only after doing the work.',
    ) +
    filters() +
    `<div class="work-actions">${btn('go', 'Reference CV formats', 'cv-library')}${btn('go', 'My evidence', 'profile')}</div><div class="intel-projects">${list(kind).map(projectCard).join('') || empty('No matches. Broaden your field or search.')}</div>`
  );
}
function cvLibrary() {
  return (
    title(
      'CV and Portfolio Library',
      'Fictional educational examples and reference formats. Every claim in your own CV must be supported by work you actually did.',
    ) +
    `<div class="work-actions">${btn('go', 'Detailed portfolio projects', 'projects')}${btn('go', 'My confirmed evidence', 'profile')}</div><div class="intel-cv-list">${list(
      'cv',
    )
      .map(
        (r) =>
          `<article class="work-card"><h2>${E(r.name)}</h2>${tag('Educational format · not a real person')}<p>${E(r.summary)}</p><p>${E(r.goalAdvice)}</p><details><summary>Annotated sections and fictional example bullets</summary>${r.sections.map((s) => `<section><h3>${E(s.name)}</h3><p>${E(s.why)}</p><p class="intel-example">${E(s.example)}</p></section>`).join('')}<h3>Before and after</h3>${r.bullets.map((b) => `<p><strong>Weak:</strong> ${E(b.weak)}</p><p><strong>Improved fictional example:</strong> ${E(b.improved)}</p><p>${E(b.why)}</p>`).join('')}<p>${E(r.quantification)}</p><p>${E(r.academicVsIndustry)}</p></details>${sources(r)}${btn('download-cv', 'Download this reference format', r.id)}</article>`,
      )
      .join('')}</div>`
  );
}
function funding() {
  return (
    title(
      'Scholarships and Funding',
      'Check funding components and eligibility in the official notice. A programme overview is not a current open award.',
    ) +
    filters() +
    `<div class="resource-grid">${list('scholarship')
      .map((r) => {
        const fit = explainFit(r, {
          preferences: base.preferences,
          skills: base.user_skills,
        });
        return `<article class="work-card">${tag(cycleStatus(r))}<h2>${E(r.name)}</h2><p>${E(r.organization)} · ${E(r.country)}</p><p>${E(r.eligibility)}</p><p><strong>Stages:</strong> ${E(r.stages?.join(' · '))}</p><p><strong>Nationality / residence:</strong> ${E(r.nationalities?.join(' · ') || 'Check the official country-specific rules')}</p><dl>${Object.entries(
          r.funding || {},
        )
          .map(
            ([k, v]) =>
              `<dt>${E(k)}</dt><dd>${E(v === null ? 'Not verified' : v === true ? 'Listed by provider' : v === false ? 'Not included' : v)}</dd>`,
          )
          .join(
            '',
          )}</dl><p><strong>Deadline:</strong> ${E(deadlineInfo(r, tz()).text)}</p><p><strong>Official documents:</strong> ${E(r.documents?.join(' · ') || 'Check current official notice')}</p><p>${E(fit.reasons.join(' · '))}</p><p class="resource-note">${E([...fit.cautions, r.limitations].filter(Boolean).join(' '))}</p>${sources(r)}${actions(r)}</article>`;
      })
      .join('')}</div>`
  );
}
function universityView() {
  const items = list('university'),
    selectedRecords = compareIds
      .map((id) => records.find((r) => r.id === id))
      .filter(Boolean);
  return (
    title(
      'Admissions and University Explorer',
      'Explore what you could study, build and investigate, then keep your own application research in a private folder.',
    ) +
    filters() +
    `<div class="work-actions">${btn('go', 'My admissions folders', 'admissions-folders')}${btn('go', 'Country & city guides', 'locations')}${btn('go', 'Scholarships & funding', 'funding')}</div>` +
    (selectedRecords.length
      ? `<div class="work-table-wrap"><table><caption>Capability and location comparison · up to four</caption><thead><tr><th>Area</th>${selectedRecords.map((r) => `<th>${E(r.name)} ${btn('uni-compare', 'Remove', r.id, 'text-button')}</th>`).join('')}</tr></thead><tbody>${[
          ['Research & laboratories', 'research'],
          ['Student research / capstones', 'experience'],
          ['Industry, exchange & joint degrees', 'partnership'],
          ['Interdisciplinary options', 'interdisciplinary'],
          ['City, campus and living', 'locationSummary'],
          ['Career resources', 'careerServices'],
        ]
          .map(
            ([label, key]) =>
              `<tr><th>${label}</th>${selectedRecords.map((r) => `<td>${E(r[key] || 'Not established in this profile; use official links.')}</td>`).join('')}</tr>`,
          )
          .join('')}</tbody></table></div>`
      : '') +
    items
      .map(
        (r) =>
          `<article class="intel-university"><header><span class="eyebrow">${E([r.country, r.city, r.region].filter(Boolean).join(' · '))}</span><h2>${E(r.name)}</h2><p>${E(r.institutionType || 'See institution profile')} · ${E(r.campus || r.city || 'Campus details in official links')}</p></header><div class="intel-two"><section><h3>Research & laboratories</h3><p>${E(r.research)}</p><h3>Student opportunities</h3><p>${E(r.experience)}</p><h3>Partnerships & flexibility</h3><p>${E(r.partnership)}</p><p>${E(r.interdisciplinary || 'Check faculty rules for cross-disciplinary study.')}</p></section><section><h3>Admissions routes · official sources</h3><p>Requirements vary by programme and applicant background. No admission chance or eligibility guarantee is assigned.</p>${Object.entries(
            r.admissions || {},
          )
            .map(([k, u]) => `<p>${link(u, k)}</p>`)
            .join(
              '',
            )}<h3>Campus & support</h3><p>${E(r.locationSummary || 'Explore the linked location guide and official student support.')}</p><p>${E(r.careerServices || 'Consult the official careers service.')}</p>${r.locationId ? btn('detail', 'Country / city guide', r.locationId) : ''}</section></div><p class="resource-note">${E(r.note || r.limitations)}</p>${sources(r)}<div class="work-actions">${btn('uni-compare', compareIds.includes(r.id) ? 'Remove comparison' : 'Compare capabilities', r.id)}${btn('folder', 'Create / open my private folder', r.id)}${btn('task', 'Add exploration task', r.id)}</div></article>`,
      )
      .join('')
  );
}
function locations() {
  return (
    title(
      'Country and City Guides',
      'Practical starting points with dated institutional and government sources. Costs are approximate; immigration and work outcomes are never guaranteed.',
    ) +
    filters() +
    list('location')
      .map(
        (r) =>
          `<article class="work-card"><h2>${E(r.name)}</h2><p>${E(r.country)} · ${E(r.currency)}</p><dl>${Object.entries(
            r.guide || {},
          )
            .map(([k, v]) => `<dt>${E(k)}</dt><dd>${E(v)}</dd>`)
            .join(
              '',
            )}</dl><p><strong>Approximate living costs:</strong> ${E(r.costRange || 'No reliable comparable range was established; check the official budget source.')}</p><p class="resource-note">${E(r.limitations)}</p>${sources(r)}${actions(r)}</article>`,
      )
      .join('')
  );
}
function folders() {
  return (
    title(
      'My admissions folders',
      'Your programme shortlist, questions, essays, documents and decisions stay private.',
    ) +
    `<div class="work-actions">${btn('go', 'Choose a university', 'universities')}</div>${state.admissions_folders.length ? state.admissions_folders.map((f) => `<article class="work-card">${tag(f.stage)}<h2>${E(f.title)}</h2><p class="work-pre">${E(f.notes)}</p><div class="work-actions">${btn('open-folder', 'Open folder', f.id)}${btn('edit-folder', 'Edit folder', f.id)}${btn('delete-folder', 'Delete folder', f.id)}</div></article>`).join('') : empty('Choose a university and create your first private research folder.')}`
  );
}
async function folderView(id) {
  const folder = state.admissions_folders.find((f) => f.id === id);
  if (!folder) throw Error('Folder not found.');
  const items = await result(
    db
      .from('admissions_items')
      .select('*')
      .eq('user_id', uid)
      .eq('folder_id', id)
      .order('created_at'),
  );
  B.modal(
    folder.title,
    `<p>${E(folder.stage)} · ${E(folder.notes)}</p><div class="work-actions">${btn('folder-item', 'Add programme, task, essay or question', id)}${btn('attach-document', 'Attach my private document', id)}</div>${items.map((x) => `<section class="work-card">${tag(x.kind)} ${x.completed ? tag('Completed') : ''}<h3>${E(x.title)}</h3><p class="work-pre">${E(x.body)}</p>${x.url ? link(x.url, 'Official link') : ''}${x.due_date ? `<p>Personal date: ${E(x.due_date)} · verify official cut-off separately</p>` : ''}<div class="work-actions">${btn('edit-folder-item', 'Edit', x.id)}${btn('delete-folder-item', 'Delete', x.id)}</div></section>`).join('')}<h3>Linked private documents</h3>${
      state.folder_documents
        .filter((x) => x.folder_id === id)
        .map((x) => {
          const doc = base.documents.find((d) => d.id === x.document_id);
          return `<p>${E(doc?.name || 'Document no longer available')} ${btn('unlink-document', 'Remove link', id + '|' + x.document_id)}</p>`;
        })
        .join('') ||
      '<p>No documents linked. Upload PDF/DOCX files in Documents, then attach them here.</p>'
    }`,
    '',
    null,
  );
}
function folderForm(id) {
  const f = state.admissions_folders.find((x) => x.id === id);
  B.modal(
    'Edit admissions folder',
    input(
      'Folder title',
      'title',
      f.title,
      'text',
      'required maxlength="200"',
    ) +
      select(
        'Application stage',
        'stage',
        [
          'Researching',
          'Preparing',
          'Applying',
          'Submitted',
          'Interview',
          'Decision',
          'Archived',
        ],
        f.stage,
      ) +
      area('Personal notes / decision factors', 'notes', f.notes, 4999),
    'Save folder',
    async (fd) =>
      result(
        db
          .from('admissions_folders')
          .update({
            title: fd.get('title').trim(),
            stage: fd.get('stage'),
            notes: fd.get('notes'),
          })
          .eq('id', id)
          .eq('user_id', uid),
      ),
  );
}
async function itemForm(id, folderId) {
  const r = id
    ? await result(
        db
          .from('admissions_items')
          .select('*')
          .eq('id', id)
          .eq('user_id', uid)
          .single(),
      )
    : {};
  B.modal(
    id ? 'Edit folder item' : 'Add folder item',
    select(
      'Type',
      'kind',
      [
        'Programme',
        'Task',
        'Essay',
        'Question',
        'Interview',
        'Scholarship',
        'Decision factor',
        'Official link',
      ],
      r.kind || 'Task',
    ) +
      input('Title', 'title', r.title, 'text', 'required maxlength="200"') +
      area('Draft / notes / questions', 'body', r.body) +
      input(
        'Official public link (optional)',
        'url',
        r.url,
        'url',
        'maxlength="1999"',
      ) +
      input('Personal deadline (optional)', 'due_date', r.due_date, 'date') +
      `<label class="work-check"><input name="completed" type="checkbox" ${r.completed ? 'checked' : ''}>Completed by me</label>`,
    'Save private item',
    async (fd) => {
      if (fd.get('url')) canonicalUrl(fd.get('url'));
      await result(
        db.from('admissions_items').upsert({
          ...r,
          user_id: uid,
          folder_id: r.folder_id || folderId,
          kind: fd.get('kind'),
          title: fd.get('title').trim(),
          body: fd.get('body'),
          url: fd.get('url') || null,
          due_date: fd.get('due_date') || null,
          completed: fd.has('completed'),
        }),
      );
      await load(true);
    },
  );
}
function saved() {
  return (
    title(
      'My saved library',
      'Keep opportunities, learning, projects and pathways connected to your next step.',
    ) +
    (state.saved_resources.length
      ? state.saved_resources
          .map((s) => {
            const r = records.find((r) => r.id === s.resource_id);
            return `<article class="work-card">${tag(s.kind)}<h2>${E(s.title)}</h2><p class="work-pre">${E(s.notes)}</p>${r ? tag(cycleStatus(r)) : tag('Source no longer in current collection')}<div class="work-actions">${r ? btn('detail', 'Open record', r.id) : ''}${r ? btn('task', 'Add to plan', r.id) : ''}${btn('unsave', 'Remove saved item', s.resource_id)}</div></article>`;
          })
          .join('')
      : empty(
          'Save an item from Explore, Funding, Courses or Professional Pathways.',
        ))
  );
}
function whatsNew() {
  const latest = [...records]
    .sort(
      (a, b) =>
        (b.publishedAt || b.checkedOn).localeCompare(
          a.publishedAt || a.checkedOn,
        ) || a.id.localeCompare(b.id),
    )
    .slice(0, 30);
  return (
    title(
      'What’s New',
      'A stable, dated view of published additions. Source checks and factual verification are different activities.',
    ) +
    latest
      .map(
        (r) =>
          `<article class="intel-update"><div>${tag(r.kind)}<h2>${E(r.name)}</h2><p>Last verified ${E(r.checkedOn)} · ${E(['opportunity', 'scholarship'].includes(r.kind) ? cycleStatus(r) : r.kind)}</p></div>${btn('detail', 'Explore record', r.id)}</article>`,
      )
      .join('')
  );
}
function tz() {
  return (
    base.preferences?.basic?.notifications?.timezone ||
    Intl.DateTimeFormat().resolvedOptions().timeZone ||
    'UTC'
  );
}
function notices() {
  const settings = base.preferences?.basic?.notifications || {},
    items = [];
  for (const r of records.filter((r) =>
    ['opportunity', 'scholarship'].includes(r.kind),
  )) {
    const d = deadlineInfo(r, tz());
    if (
      d.verified &&
      r.finalDeadline &&
      !['Closed', 'Previous cycle', 'Archived'].includes(cycleStatus(r)) &&
      Date.parse(r.finalDeadline) - Date.now() <
        (settings.days || 30) * 86400000
    )
      items.push({
        id: 'deadline:' + r.id + ':' + (r.deadlineAt || r.finalDeadline),
        title: r.name,
        body:
          d.text +
          (d.remaining ? ' · ' + d.remaining : '') +
          ' · ' +
          d.timeZone,
        recordId: r.id,
        region: r.region,
        type: r.type || r.kind,
        verified: d.verified,
        next: 'Read the official notice and check eligibility.',
      });
  }
  for (const x of base.plan_items || [])
    if (x.due_date && x.state !== 'Completed')
      items.push({
        id: 'plan:' + x.id + ':' + x.due_date,
        title: x.title,
        body: 'Personal plan date: ' + x.due_date,
        verified: false,
        next: 'Review the next task in My Plan.',
        route: 'plan',
      });
  for (const x of state.admissions_items || [])
    if (x.due_date && !x.completed)
      items.push({
        id: 'application:' + x.id + ':' + x.due_date,
        title: x.title,
        body: 'Personal application task: ' + x.due_date,
        verified: false,
        next: 'Review missing actions in your admissions folder.',
        route: 'admissions-folders',
      });
  for (const d of base.documents || [])
    if (d.processing_state === 'Needs review' || d.processing_state === 'Error')
      items.push({
        id: 'document:' + d.id + ':' + d.processing_state,
        title: d.name,
        body:
          d.processing_state === 'Needs review'
            ? 'Extracted text awaits your review.'
            : 'Document processing needs attention.',
        verified: false,
        next: 'Review or retry extraction.',
        route: 'documents',
      });
  const newMatches = records
    .filter(
      (r) =>
        r.fieldIds?.some((id) => base.preferences.field_ids.includes(id)) &&
        r.publishedAt &&
        Date.now() - Date.parse(r.publishedAt) < 7 * 86400000,
    )
    .slice(0, 3);
  for (const r of newMatches)
    items.push({
      id: 'new:' + r.id + ':' + r.checkedOn,
      title: r.name,
      body: 'Recently published in a field you selected.',
      recordId: r.id,
      verified: false,
      next: 'Read the fit explanation and provider source.',
    });
  return visibleNotifications(
    items,
    state.notification_states || [],
    settings,
  ).sort((a, b) => a.id.localeCompare(b.id));
}
async function updateNoticeBadge() {
  const b = document.querySelector('#intel-notices');
  if (b)
    b.textContent =
      'Notifications' +
      (loaded && summaryDue(base.preferences?.basic?.notifications)
        ? ' · ' + notices().length
        : '');
}
function summaryDue(n = {}) {
  const now = new Date(),
    hour = Number(
      new Intl.DateTimeFormat('en', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: tz(),
      }).format(now),
    );
  const start = n.quietStart,
    end = n.quietEnd;
  if (
    start !== '' &&
    end !== '' &&
    start != null &&
    end != null &&
    (Number(start) <= Number(end)
      ? hour >= Number(start) && hour < Number(end)
      : hour >= Number(start) || hour < Number(end))
  )
    return false;
  const elapsed =
    Date.now() -
    Date.parse(
      localStorage.getItem('prospectoai-notice-summary:' + uid) || '1970-01-01',
    );
  return n.frequency === 'Daily summary'
    ? elapsed >= 86400000
    : n.frequency === 'Weekly summary'
      ? elapsed >= 7 * 86400000
      : true;
}
function notificationDrawer() {
  localStorage.setItem(
    'prospectoai-notice-summary:' + uid,
    new Date().toISOString(),
  );
  void updateNoticeBadge();
  const settings = base.preferences.basic.notifications || {},
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: tz(),
      }).format(new Date()),
    ),
    quiet =
      settings.quietStart !== '' &&
      settings.quietEnd !== '' &&
      settings.quietStart != null &&
      settings.quietEnd != null &&
      (Number(settings.quietStart) <= Number(settings.quietEnd)
        ? hour >= Number(settings.quietStart) &&
          hour < Number(settings.quietEnd)
        : hour >= Number(settings.quietStart) ||
          hour < Number(settings.quietEnd));
  const d = B.modal(
    'Notification center',
    `<p>${quiet ? 'Quiet hours are active. No automatic interruptions are shown; you can review this center when ready.' : 'Useful reminders, without automatic applications or messages.'}</p><div class="work-actions">${btn('notification-settings', 'Preferences')}${undo ? btn('undo', 'Undo last notice change') : ''}</div>${
      notices()
        .map(
          (n) =>
            `<article class="work-card"><h3>${E(n.title)}</h3><p>${E(n.body)}</p><p>${E(n.next)}</p><small>${n.verified ? 'Provider date recorded; verify its current notice.' : 'Personal / informational notice, not a confirmed provider cut-off.'}</small>${n.recordId ? sources(records.find((r) => r.id === n.recordId)) : ''}<div class="work-actions">${n.recordId ? btn('detail', 'Open item', n.recordId) : btn('go', 'Open workspace', n.route)}${n.recordId ? btn('task', 'Add to plan', n.recordId) : ''}${btn('dismiss', 'Dismiss', n.id)}${btn('snooze', 'Snooze 24 hours', n.id)}</div></article>`,
        )
        .join('') ||
      empty('Nothing needs attention in your current notification settings.')
    }`,
    '',
    null,
  );
  d.classList.add('intel-notification-drawer');
}
function notificationSettings() {
  const n = base.preferences.basic.notifications || {};
  B.modal(
    'Notification preferences',
    `<label class="work-check"><input type="checkbox" name="reduceMotion" ${base.preferences.basic.reduceMotion !== false ? 'checked' : ''}>Disable decorative animation</label><label class="work-check"><input type="checkbox" name="enabled" ${n.enabled !== false ? 'checked' : ''}>Enable in-app notices</label>` +
      input(
        'IANA timezone',
        'timezone',
        tz(),
        'text',
        'required maxlength="100"',
      ) +
      select(
        'Deadline window',
        'days',
        [
          ['7', '7 days'],
          ['14', '14 days'],
          ['30', '30 days'],
        ],
        String(n.days || 30),
      ) +
      select(
        'Check frequency',
        'frequency',
        ['When I open the workspace', 'Daily summary', 'Weekly summary'],
        n.frequency || 'When I open the workspace',
      ) +
      input(
        'Region filter (comma-separated; blank = all)',
        'regions',
        (n.regions || []).join(', '),
        'text',
        'maxlength="300"',
      ) +
      input(
        'Type filter (comma-separated; blank = all)',
        'types',
        (n.types || []).join(', '),
        'text',
        'maxlength="300"',
      ) +
      `<div class="work-form-grid">${input('Quiet hours start (0–23; optional)', 'quietStart', n.quietStart ?? '', 'number', 'min="0" max="23"')}${input('Quiet hours end (0–23; optional)', 'quietEnd', n.quietEnd ?? '', 'number', 'min="0" max="23"')}</div><p>Email notifications are unavailable until verified SMTP and a delivery worker are configured. In-app frequency controls summary visibility; it does not send email or push notifications.</p>`,
    'Save preferences',
    async (fd) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: fd.get('timezone') }).format(
          new Date(),
        );
      } catch {
        throw Error('Use a valid IANA timezone, for example Asia/Hong_Kong.');
      }
      const notifications = {
        enabled: fd.has('enabled'),
        timezone: fd.get('timezone'),
        days: Number(fd.get('days')),
        frequency: fd.get('frequency'),
        regions: fd
          .get('regions')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        types: fd
          .get('types')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        quietStart: fd.get('quietStart'),
        quietEnd: fd.get('quietEnd'),
      };
      await result(
        db.from('preferences').upsert({
          ...base.preferences,
          user_id: uid,
          basic: {
            ...base.preferences.basic,
            notifications,
            reduceMotion: fd.has('reduceMotion'),
          },
        }),
      );
      location.reload();
    },
  );
}
function download(text, name, type = 'text/plain') {
  const u = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function admin() {
  const response = await A.fetch('/api/admin'),
    data = await response.json();
  if (!response.ok)
    return title(
      'System Health',
      data.error || 'Administrator access required.',
    );
  state.adminData = data;
  return (
    title(
      'Administration & System Health',
      'Administrator access is checked by the server and database. Statuses describe observed capability, not secret values.',
    ) +
    `<div class="intel-health">${Object.entries(data.health)
      .map(
        ([k, v]) =>
          `<section class="work-card"><h2>${E(k)}</h2><p>${E(v)}</p></section>`,
      )
      .join(
        '',
      )}</div><section class="work-card"><h2>Database, Storage and schedules</h2><p>${data.snapshot.migrations?.length || 0} applied migrations · ${data.snapshot.storagePolicyCount} document policies</p><ul>${data.snapshot.jobs?.map((j) => `<li>${E(j.name)} · ${E(j.schedule)} · ${j.active ? 'Ready' : 'Failed: inactive'}</li>`).join('')}</ul><details><summary>Safe schema status</summary><pre class="work-extracted">${E(JSON.stringify(data.snapshot, null, 2))}</pre></details></section><section class="work-card"><h2>Content updates</h2><p>${E(data.report ? `${data.report.status} · ${data.report.runAt} · ${data.report.checked} sources checked · ${data.report.failed} failed` : 'Not configured / first source scan pending')}</p><p>${E(data.reportError || data.report?.note || 'No published content is overwritten by a failed scan.')}</p><div class="work-actions">${btn('admin-refresh', 'Run controlled source check')}${btn('admin-create', 'Stage a validated record')}${btn('export-report', 'Export content report')}</div><h3>Staged source observations · not published</h3>${
      data.report?.candidates
        ?.slice(0, 30)
        .map(
          (c) =>
            `<details><summary>${E(c.type)} · ${E(c.title)}</summary><p>${E(c.note)}</p>${link(c.sourceUrl, 'Provider source')}<pre class="work-extracted">${E(JSON.stringify(c, null, 2))}</pre>${btn('admin-create', 'Create reviewed proposal')}</details>`,
        )
        .join('') || '<p>No new source observations.</p>'
    }<h3>Review queue</h3>${data.candidates.map((c) => `<p>${tag(c.state)} ${E(c.proposal.name || c.record_id)} ${btn('review-candidate', 'Review', c.id)} ${c.state === 'Review' ? btn('reject-candidate', 'Reject', c.id) : ''}</p>`).join('') || '<p>No staged records.</p>'}</section><section class="work-card"><h2>Published content & history</h2><p>Merge duplicates by keeping one canonical record, moving any useful facts into it, and archiving the duplicate. Existing saved IDs remain available.</p>${data.records.map((r) => `<p>${tag(r.kind)} ${E(r.payload.name)} · v${r.version} ${btn('admin-edit', 'Edit / correct / archive', r.id)}</p>`).join('')}<details><summary>Recent audit history & restoration</summary>${data.versions.map((v) => `<p>${E(v.record_id)} · version ${v.version} · ${E(v.changed_at)} ${btn('restore-content', 'Restore this version', String(v.id))}</p>`).join('')}</details></section>`
  );
}
async function adminRequest(body) {
  const r = await A.fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(55000),
  });
  const d = await r.json();
  if (!r.ok) throw Error(d.error || 'Admin request failed.');
  return d;
}
function recordEditor(record, expectedVersion = 0, candidateId = null) {
  B.modal(
    'Review source-backed content',
    `<p>Confirm every factual field against the official sources. New domains must first be added to the reviewed source registry in GitHub. Uncertain records stay staged.</p>` +
      area('Record JSON', 'record', JSON.stringify(record, null, 2), 60000) +
      `<label class="work-check"><input name="attestation" type="checkbox" required>I reviewed the current official sources and corrected cycle status, eligibility and dates. Interpretation is labelled separately.</label>` +
      select(
        'Action',
        'action',
        ['Stage for review', 'Publish reviewed record'],
        'Stage for review',
      ),
    'Save review',
    async (fd) => {
      let r;
      try {
        r = JSON.parse(fd.get('record'));
      } catch {
        throw Error('Enter valid JSON.');
      }
      await adminRequest({
        action:
          fd.get('action') === 'Publish reviewed record' ? 'publish' : 'stage',
        record: r,
        expectedVersion,
        candidateId,
        attestation: fd.has('attestation'),
      });
    },
  );
}
async function render(next) {
  view = next;
  document.body.dataset.currentView = next;
  const panel = document.querySelector('#platform-panel');
  panel.innerHTML =
    '<div class="intel-skeleton" role="status" aria-label="Loading workspace"><span></span><span></span><span></span></div>';
  try {
    await load();
    if (view !== next) return;
    let html =
      next === 'professionals'
        ? professionals()
        : next === 'comparison'
          ? compareView()
          : next === 'projects'
            ? projects()
            : next === 'research'
              ? projects(true)
              : next === 'cv-library'
                ? cvLibrary()
                : next === 'funding'
                  ? funding()
                  : next === 'universities'
                    ? universityView()
                    : next === 'locations'
                      ? locations()
                      : next === 'admissions-folders'
                        ? folders()
                        : next === 'saved-library'
                          ? saved()
                          : next === 'whats-new'
                            ? whatsNew()
                            : await admin();
    if (view !== next) return;
    panel.innerHTML =
      '<p id="intel-status" class="work-status" role="status"></p>' + html;
    await updateNoticeBadge();
    const adminNav = document.querySelector('[data-view=admin]');
    if (adminNav) adminNav.hidden = !state.admin;
  } catch (e) {
    panel.innerHTML =
      title('Workspace unavailable', e.message) + btn('retry', 'Retry');
  }
}
const originalRender = B.render;
B.render = (v) =>
  views.includes(v) || v === 'universities' ? render(v) : originalRender(v);
async function detail(id) {
  const r = records.find((x) => x.id === id);
  if (!r) throw Error('This record is no longer available.');
  if (r.kind === 'university') {
    goto('universities');
    return;
  }
  if (r.kind === 'location') {
    goto('locations');
    return;
  }
  B.modal(
    r.name,
    r.kind === 'professional'
      ? personCard(r)
      : ['project', 'research'].includes(r.kind)
        ? projectCard(r)
        : `<p>${E(r.summary || r.eligibility || r.description || r.question || 'Read the official provider information.')}</p>${r.finalDeadline ? `<p>${E(deadlineInfo(r, tz()).text)}</p>` : ''}${sources(r)}${actions(r)}`,
    '',
    null,
  );
}
async function action(name, id) {
  if (name === 'go') {
    document.querySelector('#work-dialog')?.close();
    goto(id);
    return;
  }
  if (name === 'retry') return render(view);
  if (name === 'detail') return detail(id);
  if (name === 'task') {
    const r = records.find((x) => x.id === id);
    document.querySelector('#work-dialog')?.close();
    B.openTask('Prepare: ' + r.name);
    return;
  }
  if (name === 'comparison-task') {
    B.openTask('Develop evidence: ' + id);
    return;
  }
  if (name === 'compare') {
    selected = id;
    goto('comparison');
    return;
  }
  if (name === 'save') {
    const r = records.find((x) => x.id === id),
      old = state.saved_resources.find((x) => x.resource_id === id);
    B.modal(
      'Save to my library',
      `<p>${E(r.name)}</p>` +
        area('Private notes', 'notes', old?.notes || '', 3999),
      'Save item',
      async (fd) =>
        result(
          db.from('saved_resources').upsert({
            user_id: uid,
            resource_id: id,
            kind: r.kind,
            title: r.name,
            notes: fd.get('notes'),
          }),
        ),
    );
    return;
  }
  if (name === 'unsave') {
    const old = state.saved_resources.find((x) => x.resource_id === id);
    await result(
      db
        .from('saved_resources')
        .delete()
        .eq('user_id', uid)
        .eq('resource_id', id),
    );
    undo = { kind: 'saved', old };
    await refresh();
    message(
      'Saved item removed. Use Undo in the command palette to restore it.',
    );
    return;
  }
  if (name === 'command') return command();
  if (name === 'link-skill') {
    B.modal(
      'Connect evidence to a skill',
      select(
        'Confirmed profile record',
        'record_id',
        (base.profile_records || []).map((r) => [r.id, r.title]),
      ) +
        select(
          'Private document',
          'document_id',
          (base.documents || []).map((r) => [r.id, r.name]),
        ) +
        select(
          'Saved course',
          'course_id',
          (base.course_progress || []).map((r) => [
            r.course_id,
            records.find((x) => x.id === r.course_id)?.name || r.course_id,
          ]),
        ) +
        select(
          'Project direction',
          'project_id',
          records
            .filter((r) => r.kind === 'project')
            .map((r) => [r.id, r.name]),
        ) +
        area('What this evidence actually demonstrates', 'notes', '', 2000) +
        '<p>A link records your evidence; it does not externally certify proficiency. Private evidence stays private.</p>',
      'Save connection',
      async (fd) => {
        if (
          !['record_id', 'document_id', 'course_id', 'project_id'].some((k) =>
            fd.get(k),
          )
        )
          throw Error('Choose at least one artifact.');
        await result(
          db.from('evidence_links').insert({
            user_id: uid,
            target_kind: 'skill',
            target_id: id,
            record_id: fd.get('record_id') || null,
            document_id: fd.get('document_id') || null,
            course_id: fd.get('course_id') || null,
            project_id: fd.get('project_id') || null,
            notes: fd.get('notes'),
          }),
        );
      },
    );
    return;
  }

  if (name === 'evidence') {
    const r = records.find((x) => x.id === id);
    B.modal(
      'Record work I actually completed',
      `<p>This saves a profile record only after your review. An example is not evidence of work you have done.</p>` +
        input(
          'My project title',
          'title',
          r.name,
          'text',
          'required maxlength="200"',
        ) +
        area(
          'My actual contribution, artifact and limitations',
          'details',
          '',
          4000,
        ),
      'Save confirmed evidence',
      async (fd) => {
        if (!fd.get('details').trim())
          throw Error('Describe your actual work and evidence.');
        await result(
          db.rpc('record_project_evidence', {
            target_id: id,
            project_title: fd.get('title').trim(),
            details: fd.get('details'),
          }),
        );
      },
    );
    return;
  }
  if (name === 'uni-compare') {
    if (compareIds.includes(id))
      compareIds = compareIds.filter((x) => x !== id);
    else {
      if (compareIds.length === 4)
        throw Error('Compare up to four universities.');
      compareIds.push(id);
    }
    return render(view);
  }
  if (name === 'folder') {
    const r = records.find((x) => x.id === id);
    let f = state.admissions_folders.find((x) => x.university_id === id);
    if (!f) {
      const rows = await result(
        db
          .from('admissions_folders')
          .insert({ user_id: uid, university_id: id, title: r.name })
          .select(),
      );
      f = rows[0];
      await load(true);
    }
    return folderView(f.id);
  }
  if (name === 'open-folder') return folderView(id);
  if (name === 'edit-folder') return folderForm(id);
  if (name === 'delete-folder') {
    if (
      confirm(
        'Permanently delete this admissions folder and its notes? Original uploaded documents are retained.',
      )
    ) {
      await result(
        db.from('admissions_folders').delete().eq('user_id', uid).eq('id', id),
      );
      await refresh();
    }
    return;
  }
  if (name === 'folder-item') return itemForm('', id);
  if (name === 'edit-folder-item') return itemForm(id);
  if (name === 'delete-folder-item') {
    if (confirm('Delete this private folder item?')) {
      await result(
        db.from('admissions_items').delete().eq('user_id', uid).eq('id', id),
      );
      document.querySelector('#work-dialog')?.close();
      await refresh();
    }
    return;
  }
  if (name === 'attach-document') {
    B.modal(
      'Attach my private document',
      select(
        'Document',
        'document_id',
        base.documents.map((d) => [d.id, d.name]),
      ) +
        '<p>Only documents already in your private workspace can be linked.</p>',
      'Attach document',
      async (fd) => {
        if (!fd.get('document_id')) throw Error('Choose a document.');
        await result(
          db.from('folder_documents').upsert({
            user_id: uid,
            folder_id: id,
            document_id: fd.get('document_id'),
          }),
        );
      },
    );
    return;
  }
  if (name === 'unlink-document') {
    const [folder_id, document_id] = id.split('|');
    await result(
      db
        .from('folder_documents')
        .delete()
        .eq('user_id', uid)
        .eq('folder_id', folder_id)
        .eq('document_id', document_id),
    );
    document.querySelector('#work-dialog')?.close();
    await refresh();
    return;
  }
  if (name === 'download-cv') {
    const r = records.find((x) => x.id === id);
    download(
      '# ' +
        r.name +
        '\nFICTIONAL EDUCATIONAL FORMAT — USE ONLY TRUE, SUPPORTED CLAIMS\n\n' +
        r.summary +
        '\n\n' +
        r.sections
          .map((s) => s.name + '\nWhy: ' + s.why + '\nExample: ' + s.example)
          .join('\n\n') +
        '\n\n' +
        r.quantification,
      'prospectoai-cv-reference.txt',
    );
    return;
  }
  if (name === 'notices') return notificationDrawer();
  if (name === 'notification-settings') return notificationSettings();
  if (name === 'dismiss' || name === 'snooze') {
    const old = state.notification_states.find((x) => x.notice_key === id);
    undo = { kind: 'notice', key: id, old };
    await result(
      db.from('notification_states').upsert({
        user_id: uid,
        notice_key: id,
        state: name === 'dismiss' ? 'Dismissed' : 'Snoozed',
        snooze_until:
          name === 'snooze'
            ? new Date(Date.now() + 86400000).toISOString()
            : null,
      }),
    );
    document.querySelector('#work-dialog')?.close();
    await load(true);
    return notificationDrawer();
  }
  if (name === 'undo') {
    if (!undo) throw Error('No reversible action to undo.');
    if (undo.kind === 'saved')
      await result(db.from('saved_resources').upsert(undo.old));
    else if (undo.old)
      await result(db.from('notification_states').upsert(undo.old));
    else
      await result(
        db
          .from('notification_states')
          .delete()
          .eq('user_id', uid)
          .eq('notice_key', undo.key),
      );
    undo = null;
    document.querySelector('#work-dialog')?.close();
    await refresh();
    message('Last reversible action restored.');
    return;
  }
  if (name === 'admin-refresh') {
    const r = await adminRequest({ action: 'refresh' });
    await render('admin');
    message(
      'Source check completed: ' +
        r.checked +
        ' pages. Provider facts still require review.',
    );
    return;
  }
  if (name === 'admin-create')
    return recordEditor({
      id: 'new-record',
      kind: 'opportunity',
      name: '',
      status: 'Deadline not announced',
      checkedOn: new Date().toISOString().slice(0, 10),
      sources: [],
    });
  if (name === 'admin-edit') {
    const r = state.adminData.records.find((x) => x.id === id);
    return recordEditor(r.payload, r.version);
  }
  if (name === 'review-candidate') {
    const c = state.adminData.candidates.find((x) => x.id === id),
      r = state.adminData.records.find((x) => x.id === c.record_id);
    return recordEditor(c.proposal, r?.version || 0, c.id);
  }
  if (name === 'reject-candidate') {
    await adminRequest({ action: 'reject', id });
    return render('admin');
  }
  if (name === 'restore-content') {
    const v = state.adminData.versions.find((x) => String(x.id) === id),
      r = state.adminData.records.find((x) => x.id === v.record_id);
    B.modal(
      'Review restoration',
      `<p>Restore the public content from version ${v.version}. A new audit version will be created. Past dates will not become open deadlines.</p><label class="work-check"><input name="attestation" type="checkbox" required>I checked the source and reviewed this restoration.</label>`,
      'Restore reviewed content',
      async (fd) =>
        adminRequest({
          action: 'restore',
          versionId: id,
          expectedVersion: r?.version || 0,
          attestation: fd.has('attestation'),
        }),
    );
    return;
  }
  if (name === 'export-report') {
    download(
      JSON.stringify(
        {
          totals: state.adminData.totals,
          report: state.adminData.report,
          versions: state.adminData.versions,
        },
        null,
        2,
      ),
      'prospectoai-content-report.json',
      'application/json',
    );
    return;
  }
}
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-intel]');
  if (!target) return;
  target.disabled = true;
  try {
    await load();
    await action(target.dataset.intel, target.dataset.id);
  } catch (err) {
    message(err.message);
    const d = document.querySelector('#work-dialog [role=alert]');
    if (d) d.textContent = err.message;
  } finally {
    if (target.isConnected) target.disabled = false;
  }
});
let timer;
document.addEventListener('input', (e) => {
  if (e.target.id !== 'intel-search') return;
  search = e.target.value;
  const pos = e.target.selectionStart;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    await render(view);
    const input = document.querySelector('#intel-search');
    input?.focus();
    input?.setSelectionRange(pos, pos);
  }, 180);
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'intel-field') {
    field = e.target.value;
    render(view);
  }
  if (e.target.id === 'intel-level') {
    level = e.target.value;
    render(view);
  }
});
const NAV = [
  [
    'Explore',
    [
      ['dashboard', 'My dashboard'],
      ['finder', 'Opportunity finder'],
      ['funding', 'Scholarships & funding'],
      ['whats-new', 'What’s New'],
      ['saved-library', 'Saved library'],
      ['latest', 'Latest source leads'],
    ],
  ],
  [
    'Build Your Profile',
    [
      ['profile', 'My development profile'],
      ['skills', 'Skills Intelligence'],
      ['courses', 'Courses & learning'],
      ['projects', 'Portfolio projects'],
      ['research', 'Research Idea Studio'],
      ['cv-library', 'CV and Portfolio Library'],
      ['documents', 'Private documents'],
    ],
  ],
  [
    'Professional Pathways',
    [
      ['professionals', 'Public profiles & pathways'],
      ['comparison', 'My evidence comparison'],
    ],
  ],
  [
    'Admissions and Universities',
    [
      ['universities', 'Admissions & University Explorer'],
      ['admissions-folders', 'My admissions folders'],
      ['locations', 'Country & city guides'],
    ],
  ],
  [
    'My Plan',
    [
      ['plan', 'My development plan'],
      ['activities', 'My activities'],
      ['saved', 'Application tracker'],
      ['deadlines', 'Deadline view'],
      ['assistant', 'Ask ProspectoAI'],
      ['privacy', 'Privacy & account'],
      ['sources', 'Source review status'],
      ['admin', 'System Health & content'],
    ],
  ],
];
const nav = document.querySelector('.main-nav');
if (nav) {
  nav.innerHTML = NAV.map(
    ([group, items]) =>
      `<div class="intel-nav-group"><div class="intel-nav-label">${E(group)}</div>${items.map(([v, label]) => `<button class="nav-item" data-view="${v}" ${v === 'admin' ? 'hidden' : ''}><span>${E(label)}</span></button>`).join('')}</div>`,
  ).join('');
}
const toolbar =
  document.querySelector('.topbar') || document.querySelector('main');
if (toolbar) {
  const tools = document.createElement('div');
  tools.className = 'intel-global-tools';
  tools.innerHTML =
    btn('command', 'Search / commands · Ctrl K') +
    `<button class="secondary" type="button" id="intel-notices" data-intel="notices" aria-haspopup="dialog">Notifications</button>`;
  toolbar.append(tools);
}
function command() {
  B.modal(
    'Search ProspectoAI',
    `<label>Find a workspace or researched record<input id="intel-command-input" type="search" autofocus maxlength="120"></label><div id="intel-command-results"></div><p>Ctrl / ⌘ K: search · Escape: close · ?: shortcut help. Use Tab and Enter to choose results.</p>${undo ? btn('undo', 'Undo last reversible change') : ''}`,
    '',
    null,
  );
  drawCommands('');
}
function drawCommands(query) {
  const q = query.toLowerCase(),
    matches = NAV.flatMap(([, items]) => items)
      .filter(([v, label]) => v !== 'admin' || state.admin)
      .filter(([, label]) => label.toLowerCase().includes(q));
  const data =
    q.length > 1
      ? records
          .filter(
            (r) => r.status !== 'Archived' && r.name.toLowerCase().includes(q),
          )
          .slice(0, 10)
      : [];
  const box = document.querySelector('#intel-command-results');
  if (box)
    box.innerHTML =
      matches.map(([v, label]) => btn('go', label, v)).join('') +
        data
          .map((r) => btn('detail', r.name + ' · ' + r.kind, r.id))
          .join('') || '<p>No matches. Try a broader term.</p>';
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'intel-command-input') drawCommands(e.target.value);
});
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    command();
  }
  if (
    e.key === '?' &&
    !e.target.closest('input,textarea,select,[contenteditable]')
  )
    B.modal(
      'Keyboard help',
      '<p>Ctrl / ⌘ K opens search. Tab and Shift Tab move between controls. Enter activates a control. Escape closes dialogs. Plan ordering has Move earlier / later buttons for keyboard access.</p>',
      '',
      null,
    );
});
// Extended modals use the shared native dialog and refresh their own private state after saves.
const oldModal = B.modal;
B.modal = (heading, body, submit, save) =>
  oldModal(
    heading,
    body,
    submit,
    save
      ? async (...args) => {
          await save(...args);
          loaded = false;
        }
      : save,
  );
window.ProspectoIntelligence = { render, views, getRecords: () => records };

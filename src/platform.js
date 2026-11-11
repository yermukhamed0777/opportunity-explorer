import { createClient } from '@supabase/supabase-js';
const R = window.PROSPECTO_RESOURCES;
const $ = (s) => document.querySelector(s);
const E = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const link = (url, label) =>
  `<a href="${E(url)}" target="_blank" rel="noopener noreferrer">${E(label)} ↗</a>`;
let db,
  user = null,
  resourcesView = '',
  activeSearch = '',
  activeField = '',
  activeRegion = '',
  activeKind = '',
  activities = [],
  pendingTracker = null,
  syncTimer,
  syncing = Promise.resolve(),
  accountEpoch = 0,
  config = {},
  profile = {},
  activityStatus = '',
  activityKind = '',
  activitySort = 'deadline';
const messages = [];
let careerExperience = '',
  careerArrangement = '',
  careerSkills = '';
const regionOptions = [
  ...new Set([...R.universities, ...R.careers].map((x) => x.region)),
].sort();
const fieldOptions = [
  ...new Set(
    R.skills
      .flatMap((x) => x.fields)
      .concat(R.universities.flatMap((x) => x.fields)),
  ),
].sort();
function options(items, value, all) {
  return (
    `<option value="">${all}</option>` +
    items
      .map((v) => `<option ${value === v ? 'selected' : ''}>${E(v)}</option>`)
      .join('')
  );
}
function notice(text) {
  const el = $('#platform-message');
  if (el) el.textContent = text;
}
function heading(kicker, title, description) {
  return `<header class="platform-heading"><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></header>`;
}
function filters(kind) {
  return `<div class="resource-filters"><label>Search<input id="resource-search" type="search" value="${E(activeSearch)}" placeholder="Name, research area or skill…"></label><label>Field<select id="resource-field">${options(fieldOptions, activeField, 'All fields')}</select></label>${kind !== 'skills' ? `<label>Region<select id="resource-region">${options(regionOptions, activeRegion, 'All regions')}</select></label>` : ''}${kind === 'careers' ? `<label>Work arrangement<select id="career-arrangement">${options(['Remote', 'Hybrid', 'On-site'], careerArrangement, 'Any / varies')}</select></label><label>Experience<select id="career-experience">${options(['University students', 'Student / graduate / early career'], careerExperience, 'Any experience')}</select></label><label>Your skills<input id="career-skills" value="${E(careerSkills)}" placeholder="e.g. Python, CAD"></label>` : ''}${kind === 'universities' ? `<label>Experience<select id="resource-kind">${options(['Laboratories', 'Undergraduate research', 'Joint / dual degree', 'Internal dual degree', 'Prototyping'], activeKind, 'All experiences')}</select></label>` : kind === 'careers' ? `<label>Type<select id="resource-kind">${options(['Job board', 'Internship programme', 'Internship posting', 'Research placement'], activeKind, 'All types')}</select></label>` : ''}<button class="secondary" id="resource-reset">Reset</button></div>`;
}
function matches(o) {
  return (
    (!activeSearch ||
      JSON.stringify([
        o,
        ...(o.courses || []).map((id) => R.courses.find((c) => c.id === id)),
      ])
        .toLowerCase()
        .includes(activeSearch.toLowerCase())) &&
    (!activeField || o.fields.includes(activeField)) &&
    (!activeRegion || o.region === activeRegion) &&
    (!activeKind ||
      (o.tags || []).includes(activeKind) ||
      o.kind === activeKind)
  );
}
function saveTaskButton(title, id) {
  return `<button class="secondary" data-add-task="${E(title)}" data-resource="${E(id)}">+ Add to my activities</button>`;
}
function universityCard(o) {
  return `<article class="resource-card"><div class="resource-meta">${E(o.region)} · Reviewed ${o.checkedOn}</div><h2>${E(o.name)}</h2><div class="resource-tags">${o.fields.map((x) => `<span>${E(x)}</span>`).join('')}</div><h3>Labs & research</h3><p>${E(o.research)}</p><h3>What you could explore</h3><p>${E(o.experience)}</p><h3>Degree partnerships</h3><p>${E(o.partnership)}</p><p class="resource-note">${E(o.note)}</p><div class="resource-links">${o.sources.map(([l, u]) => link(u, l)).join('')}</div>${saveTaskButton('Explore ' + o.name, 'university:' + o.id)}</article>`;
}
function skillCard(o) {
  return `<article class="resource-card"><div class="resource-meta">Suggested route · ${o.roles.map(E).join(' / ')}</div><h2>${E(o.name)}</h2><h3>Essential technical skills</h3><ul>${o.skills.map((s) => `<li>${E(s)}</li>`).join('')}</ul><h3>Tools & lab techniques</h3><p>${o.tools.map(E).join(' · ')}</p><h3>Transferable skills</h3><p>${o.transferableSkills.map(E).join(' · ')}</p><h3>Learn from</h3><div class="course-list">${o.courses
    .map((id) => {
      const c = R.courses.find((x) => x.id === id);
      return `<div>${link(c.url, c.name)}<small>${E(c.provider)} · ${E(c.costType)} · checked ${c.checkedOn}</small>${saveTaskButton('Complete ' + c.name, 'course:' + c.id)}</div>`;
    })
    .join(
      '',
    )}</div><h3>Make something you can show</h3><p>${E(o.project)}</p><details><summary>A practical learning sequence</summary><ol>${o.learningPath.map((x) => `<li><strong>${E(x.level)}</strong>: ${E(x.task)}</li>`).join('')}</ol></details><h3>Projects that demonstrate progress</h3><ul>${o.skillProjects.map((x) => `<li><strong>${E(x.skill)}</strong>: ${E(x.project)}</li>`).join('')}</ul><p class="resource-note">${E(o.credentials)}</p><p class="resource-note">${E(o.assessment)}</p>${saveTaskButton('Build skills: ' + o.name, 'skill:' + o.id)}</article>`;
}
function careerCard(o) {
  return `<article class="resource-card"><div class="resource-meta">${E(o.kind)} · ${E(o.region)}</div><h2>${E(o.name)}</h2><span class="source-label">${E(o.status)}</span><p>${E(o.summary)}</p><p><strong>Work arrangement:</strong> ${E(o.arrangement)}<br><strong>Experience:</strong> ${E(o.experience)}<br><strong>Type:</strong> ${E(o.employmentType)}</p><h3>Who should check it</h3><p>${E(o.eligibility)}</p><h3>Deadlines & availability</h3><p>${E(o.deadlineNote)}</p><p class="resource-note">A source page is not a guarantee of a current vacancy, eligibility or work authorization. Reviewed ${o.checkedOn}.</p><div class="resource-links">${link(o.url, 'Open employer / programme source')}</div><button class="text-button" data-open-skills="${E(o.skills[0])}">Explore related skill paths →</button>${saveTaskButton('Check opportunities at ' + o.org, 'career:' + o.id)}</article>`;
}
function resourceList(view) {
  const key =
    view === 'skills'
      ? 'skills'
      : view === 'careers'
        ? 'careers'
        : 'universities';
  const items = R[key]
    .filter(matches)
    .filter(
      (o) =>
        view !== 'careers' ||
        ((!careerArrangement || o.arrangement === careerArrangement) &&
          (!careerExperience || o.experience === careerExperience) &&
          (!careerSkills ||
            JSON.stringify(o)
              .toLowerCase()
              .includes(careerSkills.toLowerCase()))),
    );
  const target = $('#resource-results');
  if (!target) return;
  $('#resource-count').textContent =
    `${items.length} ${key === 'skills' ? 'learning paths' : key === 'careers' ? 'career sources' : 'university profiles'}`;
  target.innerHTML = items.length
    ? items
        .map(
          view === 'skills'
            ? skillCard
            : view === 'careers'
              ? careerCard
              : universityCard,
        )
        .join('')
    : '<div class="resource-empty">No matches. Try a broader field or reset the filters.</div>';
}
function render(view) {
  resourcesView = view;
  const panel = $('#platform-panel');
  if (['skills', 'careers', 'universities'].includes(view)) {
    const headings = {
      skills: [
        'BUILD YOUR TOOLKIT',
        'Skills for your next step.',
        'Choose a major or career direction, learn a useful skill, and turn it into a project.',
      ],
      universities: [
        'FOR HIGH-SCHOOL EXPLORERS',
        'Search for universities.',
        'Discover what you could work on: laboratories, undergraduate research, prototypes and distinctive degree partnerships.',
      ],
      careers: [
        'PUT YOUR SKILLS TO WORK',
        'Explore internships & jobs.',
        'Start with official employer and research-programme sources. Check each individual posting for current availability.',
      ],
    };
    panel.innerHTML =
      heading(...headings[view]) +
      (view === 'skills'
        ? '<div class="platform-notice">Course links were checked on 11 November 2026. Course and certificate prices vary. Check university or library access for LinkedIn Learning; no free certificate is promised.</div>'
        : '') +
      filters(view) +
      '<div id="resource-count" class="resource-count"></div><div id="resource-results" class="resource-grid"></div>';
    resourceList(view);
  } else if (view === 'activities') renderActivities();
  else if (view === 'assistant') renderAssistant();
}
window.ProspectoPlatform = { render };
function setView(v) {
  activeSearch = '';
  activeField = '';
  activeRegion = '';
  activeKind = '';
  window.ProspectoTracker.setView(v);
  history.replaceState(null, '', '#' + v);
}
function accountUi(message = '') {
  const panel = $('#account-content');
  panel.innerHTML = user
    ? `<h2 id="account-title">Your private workspace</h2><p>Signed in as <strong>${E(user.email)}</strong>.</p><p>Tracker and activities sync to your account. Guest notes stay separate until you import them. Chat text is sent to the model provider only when you use AI planning; it is not saved as chat history by ProspectoAI.</p><form id="profile-form"><h3>Your direction</h3><label>Name<input name="display_name" maxlength="80" value="${E(profile.display_name || '')}"></label><label>Education level<input name="education_level" maxlength="80" value="${E(profile.education_level || '')}"></label><label>Major / career<input name="major" maxlength="120" value="${E(profile.major || '')}"></label><label>Goals<textarea name="career_goal" maxlength="500">${E(profile.career_goal || '')}</textarea></label><label>Existing skills<textarea name="skills" maxlength="1000">${E(profile.skills || '')}</textarea></label><label>Preferred location<input name="preferred_location" maxlength="120" value="${E(profile.preferred_location || '')}"></label><label>Hours per week<input name="hours_per_week" type="number" min="1" max="80" value="${E(profile.hours_per_week || '')}"></label><label>Budget<input name="budget" maxlength="120" value="${E(profile.budget || '')}"></label><label>Work / study preference<select name="arrangement">${options(['Remote', 'Hybrid', 'On-site', 'Flexible'], profile.arrangement || '', 'Not specified')}</select></label><button class="secondary">Save profile</button></form><button id="import-guest" class="secondary">Import this browser’s guest tracker</button><button id="sign-out" class="primary">Sign out</button><p id="account-status" role="status">${E(message)}</p>`
    : `<h2 id="account-title">Keep your next steps.</h2><p>Sign in to sync your tracker, activities and notes across devices.</p><form id="auth-form"><label>Email<input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254"></label><label>Password<input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="10" maxlength="128"></label><div class="auth-actions"><button class="primary" name="action" value="login">Sign in</button><button class="secondary" name="action" value="signup">Create account</button></div></form><button class="text-button" id="forgot-password">Reset password by email</button><p class="resource-note">New accounts use email confirmation. Follow the message from Supabase before signing in. Guest browsing remains available.</p><p id="account-status" role="status">${E(message)}</p>`;
}
$('#account-button').addEventListener('click', () => {
  accountUi();
  $('#account-dialog').showModal();
});
$('#account-dialog .account-close').addEventListener('click', () =>
  $('#account-dialog').close(),
);
async function initialize() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw Error('Account service unavailable.');
    config = await response.json();
    if (!config.supabaseUrl || !config.supabaseKey)
      throw Error('Account service is not configured.');
    db = createClient(config.supabaseUrl, config.supabaseKey);
    db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTimeout(() => recoveryForm(), 0);
        return;
      }
      if (event === 'TOKEN_REFRESHED') return;
      setTimeout(() => loadAccount(session?.user || null), 0);
    });
    const {
      data: { session },
      error,
    } = await db.auth.getSession();
    if (error) throw error;
    await loadAccount(session?.user || null);
  } catch {
    $('#account-button').textContent = 'Accounts temporarily unavailable';
  }
  const hash = location.hash.slice(1);
  if (
    ['skills', 'careers', 'universities', 'activities', 'assistant'].includes(
      hash,
    )
  )
    setView(hash);
}
let loadedUserId;
let accountReady = false;
async function loadAccount(nextUser) {
  if (loadedUserId === (nextUser?.id || null)) return;
  const epoch = ++accountEpoch;
  accountReady = false;
  messages.length = 0;
  loadedUserId = nextUser?.id || null;
  user = nextUser;
  activities = [];
  profile = {};
  pendingTracker = null;
  clearTimeout(syncTimer);
  $('#account-button').textContent = user
    ? 'My account'
    : 'Sign in / create account';
  if (!user) {
    window.ProspectoTracker.setCloud(null);
    if (['activities', 'assistant'].includes(resourcesView))
      render(resourcesView);
    return;
  }
  window.ProspectoTracker.setCloud({ saved: [], progress: {} });
  const [tracker, tasks, info] = await Promise.all([
    db
      .from('trackers')
      .select('saved_ids,progress')
      .eq('user_id', user.id)
      .maybeSingle(),
    db
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false }),
    db.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
  ]);
  if (epoch !== accountEpoch) return;
  if (tracker.error || tasks.error || info.error) {
    $('#account-button').textContent = 'Account sync unavailable';
    notice(
      'Your account data could not be loaded. Reload before editing. Your saved data was retained.',
    );
    return;
  }
  accountReady = true;
  profile = info.data || {};
  window.ProspectoTracker.setCloud({
    saved: tracker.data?.saved_ids || [],
    progress: tracker.data?.progress || {},
  });
  activities = tasks.data || [];
  if (['activities', 'assistant'].includes(resourcesView))
    render(resourcesView);
  if ($('#account-dialog').open)
    accountUi('Signed in. Your private workspace is ready.');
}
function queueTracker(snapshot) {
  if (!user || !db || !accountReady) return;
  pendingTracker = structuredClone(snapshot);
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => flushTracker(), 600);
}
async function flushTracker() {
  if (!pendingTracker || !user) return;
  const snapshot = pendingTracker,
    owner = user.id,
    epoch = accountEpoch;
  pendingTracker = null;
  syncing = syncing
    .catch(() => {})
    .then(async () => {
      if (epoch !== accountEpoch) return;
      const { error } = await db.from('trackers').upsert({
        user_id: owner,
        saved_ids: snapshot.saved,
        progress: snapshot.progress,
        updated_at: new Date().toISOString(),
      });
      if (epoch !== accountEpoch) return;
      if (error) {
        pendingTracker = pendingTracker || snapshot;
        document
          .querySelectorAll('.log-hint')
          .forEach(
            (e) =>
              (e.textContent =
                'Sync failed. Keep this tab open and use Retry sync in My activities.'),
          );
      } else
        document
          .querySelectorAll('.log-hint')
          .forEach((e) => (e.textContent = 'Saved to your private account.'));
    });
  await syncing;
}
document.addEventListener('prospecto-tracker-changed', (e) =>
  queueTracker(e.detail),
);
function renderActivities() {
  const panel = $('#platform-panel');
  const visible = activities
    .filter(
      (a) =>
        (!activityStatus || a.state === activityStatus) &&
        (!activityKind || a.kind === activityKind),
    )
    .sort((a, b) =>
      activitySort === 'priority'
        ? { High: 0, Medium: 1, Low: 2 }[a.priority] -
          { High: 0, Medium: 1, Low: 2 }[b.priority]
        : activitySort === 'name'
          ? a.title.localeCompare(b.title)
          : (a.due_date || '9999').localeCompare(b.due_date || '9999'),
    );
  panel.innerHTML =
    heading(
      'YOUR PRIVATE WORKSPACE',
      'A plan you can act on.',
      'Add tasks, keep useful notes and track progress. Account data is protected by ownership rules.',
    ) +
    `<p id="platform-message" class="platform-notice" role="status">${user ? 'Your activities sync to your account.' : 'Sign in to save and view your private activities.'}</p>` +
    (user
      ? `<div class="activity-actions"><button class="secondary" id="retry-sync">Retry tracker sync</button><button class="secondary" id="reload-activities">Reload activities</button></div><form id="activity-form" class="activity-form"><label>Activity title<input id="activity-title" required maxlength="200" placeholder="Prepare a research portfolio"></label><label>Due date (optional)<input id="activity-date" type="date"></label><label>Category<select id="activity-kind">${options(['Task', 'Course', 'Skill', 'University', 'Scholarship', 'Internship', 'Job', 'Research'], 'Task', 'Choose type')}</select></label><label>Priority<select id="activity-priority">${options(['Low', 'Medium', 'High'], 'Medium', 'Choose priority')}</select></label><label class="activity-wide">Notes<textarea id="activity-notes" maxlength="3000" rows="3" placeholder="One concrete next step…"></textarea></label><button class="primary">Add activity</button></form><div class="resource-filters"><label>Status<select id="activity-status-filter">${options(['Planned', 'In progress', 'Completed', 'Archived'], activityStatus, 'All statuses')}</select></label><label>Category<select id="activity-kind-filter">${options(['Task', 'Course', 'Skill', 'University', 'Scholarship', 'Internship', 'Job', 'Research'], activityKind, 'All categories')}</select></label><label>Sort<select id="activity-sort"><option value="deadline" ${activitySort === 'deadline' ? 'selected' : ''}>Upcoming deadlines</option><option value="priority" ${activitySort === 'priority' ? 'selected' : ''}>Priority</option><option value="name" ${activitySort === 'name' ? 'selected' : ''}>Name</option></select></label></div><div id="activity-list" class="activity-list">${visible.length ? visible.map((a) => `<article class="activity-card"><label>Title<input data-activity-title maxlength="200" required value="${E(a.title)}"></label><label>Due date<input data-activity-date type="date" value="${E(a.due_date || '')}"></label><label>Priority<select data-activity-priority>${options(['Low', 'Medium', 'High'], a.priority || 'Medium', 'Choose priority')}</select></label><p>${E(a.kind || 'Task')} ${a.due_date && a.due_date < new Date().toISOString().slice(0, 10) && a.state !== 'Completed' ? '· Overdue' : ''}</p><label>Status<select data-activity-status="${a.id}">${['Planned', 'In progress', 'Completed', 'Archived'].map((s) => `<option ${(a.state || 'Planned') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label><label>Notes<textarea data-activity-notes="${a.id}" maxlength="3000" rows="3">${E(a.notes)}</textarea></label><button class="secondary" data-update-activity="${a.id}">Save changes</button><button class="text-button" data-delete-activity="${a.id}">Delete activity</button></article>`).join('') : '<div class="resource-empty">Your workspace is ready. Add a task or save one from a skill, university or career card.</div>'}</div>`
      : '<button class="primary" id="activities-login">Sign in / create account</button>');
}
async function addActivity(
  title,
  resourceId = null,
  notes = '',
  due = null,
  kind = 'Task',
  priority = 'Medium',
) {
  if (!user || !accountReady) {
    accountUi(
      user
        ? 'Your account is still loading. Reload if it does not finish.'
        : 'Sign in first, then add this activity.',
    );
    $('#account-dialog').showModal();
    return false;
  }
  const owner = user.id,
    epoch = accountEpoch;
  const { data, error } = await db
    .from('activities')
    .insert({
      user_id: owner,
      title: title.trim().slice(0, 200),
      resource_id: resourceId,
      kind,
      priority,
      notes: notes.slice(0, 3000),
      due_date: due || null,
    })
    .select()
    .single();
  if (epoch !== accountEpoch) return false;
  if (error) {
    notice('Activity could not be saved. Please retry.');
    return false;
  }
  activities.push(data);
  if (resourcesView === 'activities') renderActivities();
  else {
    const toast = $('#toast');
    toast.textContent = 'Added to your private activities.';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
  return true;
}
function renderAssistant() {
  $('#platform-panel').innerHTML =
    heading(
      'ASK. EXPLORE. MAKE A PLAN.',
      'Meet your next possibility.',
      'Tell ProspectoAI what you want to learn or work on. Get relevant options and practical next steps from the researched collection.',
    ) +
    `<div class="assistant-layout"><aside class="assistant-profile"><h2>Your direction</h2><label>Stage<select id="assistant-stage">${options(['High school junior', 'Other high school', 'Pre-university gap year', 'University student', 'Master’s applicant'], '', 'Any stage')}</select></label><label>Field<select id="assistant-field">${options(fieldOptions, '', 'Any field')}</select></label><label>Existing skills<input id="assistant-skills" maxlength="300" value="${E(profile.skills || '')}"></label><label>Hours per week<input id="assistant-hours" type="number" min="1" max="80" value="${E(profile.hours_per_week || '')}"></label><label>Budget<input id="assistant-budget" maxlength="120" value="${E(profile.budget || '')}"></label><label>Preferred location<input id="assistant-location" maxlength="120" value="${E(profile.preferred_location || '')}"></label><label>Preference<select id="assistant-arrangement">${options(['Remote', 'Hybrid', 'On-site', 'Flexible'], profile.arrangement || '', 'Any arrangement')}</select></label><label>Your goal<input id="assistant-goal" maxlength="500" value="${E(profile.career_goal || '')}"></label><p>Optional filters narrow the catalog. Your message and chosen filters are sent for AI generation after you sign in.</p><p>10 AI requests per account per day, subject to the site’s daily allowance. If generation is unavailable, clearly labelled catalog search remains available.</p><button class="text-button" id="clear-chat">Clear this conversation</button></aside><div class="assistant-chat"><div id="chat-messages" class="chat-messages" aria-live="polite"></div><div class="prompt-suggestions"><button data-prompt="Find research opportunities for a high-school student interested in physics">High-school research</button><button data-prompt="Help me plan skills and internships in materials and semiconductors">Materials & semiconductors</button><button data-prompt="Find universities with laboratory and research opportunities">University research</button></div><form id="chat-form"><label for="chat-input">What would you like to explore?</label><textarea id="chat-input" maxlength="1500" required rows="3" placeholder="I’m a first-year engineering student. What could I prepare for next summer?"></textarea><button class="primary" id="chat-send">Find options & make a plan →</button></form><p class="resource-note">Answers can be wrong. Verify sources before acting. Chats are kept in this tab only and are not submitted as applications. ${user ? 'AI planning is available after account verification.' : 'Sign in for AI planning; guest mode uses catalog search.'}</p></div></div>`;
  renderMessages();
}
function renderMessages() {
  const box = $('#chat-messages');
  if (!box) return;
  box.innerHTML = messages.length
    ? ''
    : '<div class="chat-welcome"><strong>Start with your interests.</strong><p>Include your stage, subject, preferred location and available time. I’ll help you compare possibilities.</p></div>';
  for (const m of messages) {
    const div = document.createElement('article');
    div.className = 'chat-message ' + m.role;
    const label = document.createElement('strong');
    label.textContent =
      m.role === 'user'
        ? 'You'
        : m.mode === 'ai'
          ? 'ProspectoAI · AI suggestion'
          : 'ProspectoAI · catalog search';
    div.append(label);
    const text = document.createElement('p');
    text.className = 'chat-text';
    text.textContent = m.text;
    div.append(text);
    if (m.notice) {
      const small = document.createElement('p');
      small.className = 'resource-note';
      small.textContent = m.notice;
      div.append(small);
    }
    if (m.references?.length) {
      const sources = document.createElement('div');
      sources.className = 'chat-sources';
      for (const r of m.references) {
        const a = document.createElement('a');
        a.textContent = r.name + ' · ' + r.checkedOn + ' ↗';
        a.href = r.url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        sources.append(a);
      }
      div.append(sources);
    }
    if (m.role !== 'user') {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = 'Save these next steps to activities';
      b.addEventListener('click', () =>
        addActivity('Next steps from ProspectoAI', null, m.text.slice(0, 3000)),
      );
      div.append(b);
    }
    box.append(div);
  }
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'career-skills') {
    careerSkills = e.target.value;
    resourceList(resourcesView);
    return;
  }
  if (e.target.id === 'resource-search') {
    activeSearch = e.target.value;
    resourceList(resourcesView);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'career-arrangement') {
    careerArrangement = e.target.value;
    resourceList(resourcesView);
    return;
  }
  if (e.target.id === 'career-experience') {
    careerExperience = e.target.value;
    resourceList(resourcesView);
    return;
  }
  if (e.target.id === 'activity-status-filter') {
    activityStatus = e.target.value;
    renderActivities();
    return;
  }
  if (e.target.id === 'activity-kind-filter') {
    activityKind = e.target.value;
    renderActivities();
    return;
  }
  if (e.target.id === 'activity-sort') {
    activitySort = e.target.value;
    renderActivities();
    return;
  }
  if (e.target.id === 'resource-field') activeField = e.target.value;
  else if (e.target.id === 'resource-region') activeRegion = e.target.value;
  else if (e.target.id === 'resource-kind') activeKind = e.target.value;
  else return;
  resourceList(resourcesView);
});
document.addEventListener('click', async (e) => {
  const nav = e.target.closest('[data-view]');
  if (nav) {
    activeSearch = '';
    activeField = '';
    activeRegion = '';
    activeKind = '';
    if (
      ['skills', 'careers', 'universities', 'activities', 'assistant'].includes(
        nav.dataset.view,
      )
    )
      setView(nav.dataset.view);
    else {
      resourcesView = '';
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  const task = e.target.closest('[data-add-task]');
  if (task) {
    task.disabled = true;
    await addActivity(
      task.dataset.addTask,
      task.dataset.resource,
      '',
      null,
      {
        skill: 'Skill',
        university: 'University',
        career: 'Internship',
        course: 'Course',
      }[task.dataset.resource.split(':')[0]] || 'Task',
    );
    task.disabled = false;
  }
  const related = e.target.closest('[data-open-skills]');
  if (related) {
    setView('skills');
    activeSearch =
      R.skills.find((s) => s.id === related.dataset.openSkills)?.name || '';
    render('skills');
  }
  const prompt = e.target.closest('[data-prompt]');
  if (prompt) {
    $('#chat-input').value = prompt.dataset.prompt;
    $('#chat-input').focus();
  }
  if (e.target.id === 'resource-reset') {
    careerExperience = '';
    careerArrangement = '';
    careerSkills = '';
    activeSearch = '';
    activeField = '';
    activeRegion = '';
    activeKind = '';
    render(resourcesView);
  }
  if (e.target.id === 'activities-login') {
    $('#account-button').click();
  }
  if (e.target.id === 'forgot-password') {
    const email = $('#auth-email').value.trim();
    if (!email) {
      $('#account-status').textContent = 'Enter your email first.';
      return;
    }
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + '/#recovery',
    });
    $('#account-status').textContent = error
      ? error.message
      : 'If the account exists, check your email for a secure password reset link.';
  }
  if (e.target.id === 'clear-chat') {
    messages.length = 0;
    renderMessages();
  }
  if (e.target.id === 'retry-sync') {
    await flushTracker();
    notice(
      pendingTracker
        ? 'Sync failed; keep this tab open and retry.'
        : 'Tracker sync complete.',
    );
  }
  if (e.target.id === 'reload-activities' && user) {
    loadedUserId = undefined;
    await loadAccount(user);
  }
  if (e.target.id === 'sign-out') {
    await flushTracker();
    if (pendingTracker) {
      $('#account-status').textContent =
        'Sync failed. Export a tracker backup before signing out to avoid losing unsynced changes.';
      return;
    }
    const { error } = await db.auth.signOut();
    if (error) {
      $('#account-status').textContent = error.message;
      return;
    }
    await loadAccount(null);
    accountUi('Signed out. Guest mode restored.');
  }
  if (e.target.id === 'import-guest' && user) {
    try {
      const guest = window.ProspectoTracker.guest(),
        current = window.ProspectoTracker.snapshot();
      const value = {
        saved: [...new Set([...guest.saved, ...current.saved])],
        progress: { ...guest.progress, ...current.progress },
      };
      window.ProspectoTracker.setCloud(value);
      queueTracker(value);
      await flushTracker();
      $('#account-status').textContent = pendingTracker
        ? 'Import not synced yet. Retry sync before leaving.'
        : 'Guest tracker copied to your account. Existing account notes were preserved.';
    } catch {
      $('#account-status').textContent = 'Guest data could not be read.';
    }
  }
  const update = e.target.closest('[data-update-activity]'),
    del = e.target.closest('[data-delete-activity]');
  if ((update || del) && user && accountReady) {
    const epoch = accountEpoch;
    const id = (update || del).dataset[
      update ? 'updateActivity' : 'deleteActivity'
    ];
    const card = (update || del).closest('.activity-card');
    let error;
    if (update) {
      const patch = {
        title: card
          .querySelector('[data-activity-title]')
          .value.trim()
          .slice(0, 200),
        due_date: card.querySelector('[data-activity-date]').value || null,
        priority: card.querySelector('[data-activity-priority]').value,
        state: card.querySelector('[data-activity-status]').value,
        notes: card.querySelector('textarea').value,
        updated_at: new Date().toISOString(),
      };
      ({ error } = await db
        .from('activities')
        .update(patch)
        .eq('id', id)
        .eq('user_id', user.id));
      if (epoch !== accountEpoch) return;
      if (!error)
        Object.assign(
          activities.find((a) => a.id === id),
          patch,
        );
    } else {
      ({ error } = await db
        .from('activities')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id));
      if (epoch !== accountEpoch) return;
      if (!error) activities = activities.filter((a) => a.id !== id);
    }
    if (error) notice('The change could not be saved. Please retry.');
    else renderActivities();
  }
});
function recoveryForm() {
  $('#account-content').innerHTML =
    '<h2 id="account-title">Set a new password</h2><form id="recovery-form"><label>New password<input id="new-password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required></label><button class="primary">Save new password</button></form><p id="account-status" role="status"></p>';
  $('#account-dialog').showModal();
}
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'recovery-form') {
    e.preventDefault();
    const { error } = await db.auth.updateUser({
      password: $('#new-password').value,
    });
    $('#account-status').textContent = error
      ? error.message
      : 'Password updated. You can now sign in with it.';
    if (!error) e.target.reset();
    return;
  }
  if (e.target.id === 'profile-form') {
    e.preventDefault();
    if (!user) return;
    const value = Object.fromEntries(new FormData(e.target));
    value.hours_per_week = value.hours_per_week
      ? Number(value.hours_per_week)
      : null;
    const { error } = await db.from('profiles').upsert({
      ...value,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    });
    $('#account-status').textContent = error ? error.message : 'Profile saved.';
    if (!error) profile = value;
    return;
  }

  if (e.target.id === 'auth-form') {
    e.preventDefault();
    const status = $('#account-status');
    if (!db) {
      status.textContent = 'Account service is temporarily unavailable.';
      return;
    }
    const email = $('#auth-email').value.trim(),
      password = $('#auth-password').value;
    const signup = e.submitter?.value === 'signup';
    e.target.querySelectorAll('button').forEach((b) => (b.disabled = true));
    status.textContent = signup ? 'Creating your account…' : 'Signing in…';
    try {
      const result = signup
        ? await db.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: location.origin + '/' },
          })
        : await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) {
        await loadAccount(result.data.user);
        accountUi('Signed in. Your private workspace is ready.');
      } else
        status.textContent =
          'Check your email to confirm the account, then sign in. If delivery is unavailable, the site owner needs to configure Supabase email delivery.';
    } catch (err) {
      status.textContent = err.message;
    } finally {
      document
        .querySelectorAll('#auth-form button')
        .forEach((b) => (b.disabled = false));
    }
  }
  if (e.target.id === 'activity-form') {
    e.preventDefault();
    const form = e.target;
    const button = form.querySelector('button');
    button.disabled = true;
    await addActivity(
      $('#activity-title').value,
      null,
      $('#activity-notes').value,
      $('#activity-date').value,
      $('#activity-kind').value,
      $('#activity-priority').value,
    );
    button.disabled = false;
  }
  if (e.target.id === 'chat-form') {
    e.preventDefault();
    const epoch = accountEpoch;
    const input = $('#chat-input');
    const message = input.value.trim();
    if (!message) return;
    input.value = '';
    messages.push({ role: 'user', text: message });
    renderMessages();
    const button = $('#chat-send');
    button.disabled = true;
    button.textContent = 'Finding relevant options…';
    try {
      const session = db ? (await db.auth.getSession()).data.session : null;
      const context = {
        ...profile,
        stage: $('#assistant-stage').value,
        field: $('#assistant-field').value,
        skills: $('#assistant-skills').value,
        hours: $('#assistant-hours').value,
        budget: $('#assistant-budget').value,
        region: $('#assistant-location').value,
        arrangement: $('#assistant-arrangement').value,
        goal: $('#assistant-goal').value,
      };
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session
            ? { Authorization: 'Bearer ' + session.access_token }
            : {}),
        },
        body: JSON.stringify({
          message,
          profile: context,
          history: messages
            .slice(-7, -1)
            .map((m) => ({ role: m.role, content: m.text.slice(0, 1500) })),
        }),
        signal: AbortSignal.timeout(35000),
      });
      const data = await response.json();
      if (!response.ok)
        throw Error(data.error || 'Assistant temporarily unavailable.');
      if (epoch !== accountEpoch) return;
      messages.push({ role: 'assistant', ...data });
    } catch (err) {
      if (epoch !== accountEpoch) return;
      messages.push({
        role: 'assistant',
        mode: 'catalog',
        text:
          err.name === 'TimeoutError'
            ? 'This request timed out. Try again.'
            : err.message,
      });
    } finally {
      renderMessages();
      if ($('#chat-send')) {
        $('#chat-send').disabled = false;
        $('#chat-send').textContent = 'Find options & make a plan →';
      }
    }
  }
});
initialize();
document.addEventListener('prospecto-renewal-view', async () => {
  const target = $('#renewal-summary');
  if (!target) return;
  try {
    const response = await fetch('/api/renewal');
    const report = await response.json();
    if (!response.ok) throw Error(report.error);
    if (!target.isConnected) return;
    target.innerHTML = `<h2>Weekly renewal & review queue</h2><p>${E(report.note || 'Link availability is checked weekly; provider facts keep their original verification dates.')}</p><p><strong>Last run:</strong> ${E(report.lastRunAt || 'Not run yet')} · <strong>Status:</strong> ${E(report.status)}</p><p>${report.links?.length || 0} links checked · ${report.reviewQueue?.length || 0} entries awaiting review · ${report.expired?.length || 0} expired / archived opportunities retained.</p><details><summary>Items awaiting a source review</summary>${
      report.reviewQueue?.length
        ? report.reviewQueue
            .slice(0, 50)
            .map(
              (x) =>
                `<p>${link(x.url, x.name)}<br><small>${E(x.reason)} · Checked ${E(x.lastCheckedAt)}</small></p>`,
            )
            .join('')
        : '<p>No pending entries in the latest report.</p>'
    }</details><details><summary>Update history</summary>${(report.history || []).map((x) => `<p>${E(x.checkedAt)} — ${x.reachable}/${x.links} sources reachable; ${x.needsReview} review items.</p>`).join('') || '<p>No completed runs yet.</p>'}</details><p>${link('https://github.com/yermukhamed0777/opportunity-explorer/blob/main/docs/maintenance.md', 'Maintainer review workflow')}</p>`;
  } catch {
    if (target.isConnected)
      target.innerHTML =
        '<h2>Weekly source review</h2><p>The review report is unavailable. Existing listings and their original verification dates are retained.</p>';
  }
});

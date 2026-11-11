(function () {
  'use strict';
  const PROGRESS_STATES = [
    'Interested',
    'Preparing',
    'Applied',
    'Accepted',
    'Declined',
  ];
  const Core = {
    parseBackup(value, allowed) {
      if (
        !value ||
        value.version !== 1 ||
        !Array.isArray(value.saved) ||
        !value.progress ||
        typeof value.progress !== 'object' ||
        Array.isArray(value.progress)
      )
        throw new Error('Choose an ProspectoAI backup file.');
      const known = new Set(allowed),
        saved = [
          ...new Set(
            value.saved.filter((id) => typeof id === 'string' && known.has(id)),
          ),
        ],
        progress = Object.create(null);
      for (const [id, p] of Object.entries(value.progress))
        if (known.has(id) && p && typeof p === 'object')
          progress[id] = {
            status: PROGRESS_STATES.includes(p.status)
              ? p.status
              : 'Interested',
            notes: typeof p.notes === 'string' ? p.notes.slice(0, 1500) : '',
          };
      return { saved, progress };
    },
    persistTracker(storage, ids, records) {
      const keys = ['oe-shortlist-v1', 'oe-progress-v1'];
      let before;
      try {
        before = keys.map((key) => storage.getItem(key));
        storage.setItem(keys[0], JSON.stringify(ids));
        storage.setItem(keys[1], JSON.stringify(records));
        return true;
      } catch {
        if (before)
          for (let i = 0; i < keys.length; i++)
            try {
              if (before[i] === null) storage.removeItem(keys[i]);
              else storage.setItem(keys[i], before[i]);
            } catch {}
        return false;
      }
    },
    calendar(o) {
      if (
        !o.deadlineConfirmed ||
        !/^\d{4}-\d{2}-\d{2}$/.test(o.deadlineStart || '') ||
        o.deadlineStart !== o.deadlineEnd
      )
        throw new Error('No confirmed single-day deadline to export.');
      const date = new Date(o.deadlineStart + 'T00:00:00Z');
      if (date.toISOString().slice(0, 10) !== o.deadlineStart)
        throw new Error('Invalid deadline.');
      date.setUTCDate(date.getUTCDate() + 1);
      const escape = (v) =>
        String(v || '')
          .replace(/\\/g, '\\\\')
          .replace(/\r\n?|\n/g, '\\n')
          .replace(/;/g, '\\;')
          .replace(/,/g, '\\,');
      const fold = (line) => {
        let result = '',
          part = '',
          bytes = 0;
        for (const ch of line) {
          const length = new TextEncoder().encode(ch).length;
          if (bytes + length > 75) {
            result += part + '\r\n';
            part = ' ';
            bytes = 1;
          }
          part += ch;
          bytes += length;
        }
        return result + part;
      };
      const description =
        'Date reminder only; not an exact cut-off or notification guarantee. The provider date can differ from your local calendar date. ' +
        o.deadlineDetail +
        ' Funding: ' +
        o.cost +
        '. Verify: ' +
        o.sources[0][1];
      return (
        [
          'BEGIN:VCALENDAR',
          'VERSION:2.0',
          'PRODID:-//ProspectoAI//Deadline reminder//EN',
          'CALSCALE:GREGORIAN',
          'BEGIN:VEVENT',
          'UID:' + o.id + '-' + o.deadlineStart + '@prospectoai',
          'DTSTAMP:' +
            new Date()
              .toISOString()
              .replace(/[-:]/g, '')
              .replace(/\.\d{3}/, ''),
          'DTSTART;VALUE=DATE:' + o.deadlineStart.replaceAll('-', ''),
          'DTEND;VALUE=DATE:' +
            date.toISOString().slice(0, 10).replaceAll('-', ''),
          'SUMMARY:' + escape('Deadline reminder: ' + o.name),
          'DESCRIPTION:' + escape(description),
          'URL:' + o.sources[0][1],
          'END:VEVENT',
          'END:VCALENDAR',
        ]
          .map(fold)
          .join('\r\n') + '\r\n'
      );
    },
    isClosed(o, today = new Date().toISOString().slice(0, 10)) {
      return (
        o.archived === true || !!(o.finalDeadline && o.finalDeadline < today)
      );
    },
    filter(items, f, saved = new Set()) {
      const q = (f.query || '').trim().toLowerCase();
      return items.filter((o) => {
        if (!f.includeClosed && f.view !== 'saved' && Core.isClosed(o, f.today))
          return false;
        if (f.view === 'saved' && !saved.has(o.id)) return false;
        if (
          q &&
          ![o.name, o.org, o.description, ...o.fields, o.location]
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
          return false;
        if (f.type && o.type !== f.type) return false;
        if (
          f.field &&
          !o.fields.includes(f.field) &&
          !o.fields.includes('All subjects')
        )
          return false;
        if (f.stage && !o.eligibilityTags.includes(f.stage)) return false;
        if (f.access && o.access !== f.access) return false;
        if (f.location && !o.locations.includes(f.location)) return false;
        if (f.formats?.length && !f.formats.some((x) => o.formats.includes(x)))
          return false;
        if (f.cost === 'Aid' && !o.aid) return false;
        if (f.cost && f.cost !== 'Aid' && o.costGroup !== f.cost) return false;
        if (f.confirmed && !o.deadlineConfirmed) return false;
        if (f.from || f.to) {
          if (!o.deadlineStart) {
            if (!f.unknown) return false;
          } else if (
            (f.from && o.deadlineEnd < f.from) ||
            (f.to && o.deadlineStart > f.to)
          )
            return false;
        }
        return true;
      });
    },
    sort(items, mode) {
      return [...items].sort((a, b) =>
        mode === 'name'
          ? a.name.localeCompare(b.name)
          : mode === 'deadline'
            ? (a.deadlineStart || '9999').localeCompare(
                b.deadlineStart || '9999',
              )
            : mode === 'cost'
              ? { Free: 0, Funded: 0, Paid: 1, Unknown: 2 }[a.costGroup] -
                { Free: 0, Funded: 0, Paid: 1, Unknown: 2 }[b.costGroup]
              : 0,
      );
    },
  };
  globalThis.ExplorerCore = Core;
  if (typeof document === 'undefined') return;
  const icons = {
    compass: '<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 6L7 17l3-6z"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    sliders:
      '<path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    spark: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
    people:
      '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m0-16a3 3 0 0 1 0 6m3 4a5 5 0 0 1 3 5"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/>',
    columns:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
  };
  icons.globe =
    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18z"/>';
  icons.check = '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>';
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)],
    catalog = window.EXPLORER_CATALOG,
    data = window.OPPORTUNITIES;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const sourceDefaults = [
    {
      id: 'studyqa',
      name: 'StudyQA / Стадика',
      url: 'https://t.me/studyqa',
      kind: 'telegram',
    },
    {
      id: 'noborders',
      name: 'No Borders Abroad',
      url: 'https://t.me/noborders_abroad',
      kind: 'telegram',
    },
    {
      id: 'scholars4dev',
      name: 'Scholars4Dev',
      url: 'https://www.scholars4dev.com/',
      kind: 'rss',
    },
    {
      id: 'opportunitydesk',
      name: 'Opportunity Desk',
      url: 'https://opportunitydesk.org/',
      kind: 'rss',
    },
  ];
  function icon(name) {
    return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.compass}</svg>`;
  }
  function esc(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (c) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
        })[c],
    );
  }
  function dateLabel(value, withTime = false) {
    if (!value) return 'Not yet available';
    const date = new Date(value.length === 10 ? value + 'T12:00:00Z' : value);
    if (!Number.isFinite(date.valueOf())) return 'Not specified';
    return (
      new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
        timeZone: withTime ? 'Asia/Shanghai' : 'UTC',
      }).format(date) + (withTime ? ' HKT' : '')
    );
  }
  function safeLink(value) {
    try {
      const u = new URL(value);
      return u.protocol === 'https:' && !u.username && !u.password
        ? u.href
        : '#';
    } catch {
      return '#';
    }
  }
  $$('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  let cloudMode = false;
  function trackerChanged() {
    document.dispatchEvent(
      new CustomEvent('prospecto-tracker-changed', {
        detail: { saved: [...saved], progress },
      }),
    );
  }
  let view = 'explore',
    type = '',
    saved = new Set(),
    compare = new Set(),
    feed = null,
    feedState = 'loading',
    feedFallback = false,
    toastTimer,
    progress = Object.create(null);
  try {
    const stored = JSON.parse(localStorage.getItem('oe-shortlist-v1') || '[]');
    if (Array.isArray(stored))
      saved = new Set(stored.filter((id) => data.some((o) => o.id === id)));
  } catch {}
  try {
    const parsed = Core.parseBackup(
      {
        version: 1,
        saved: [...saved],
        progress: JSON.parse(localStorage.getItem('oe-progress-v1') || '{}'),
      },
      data.map((o) => o.id),
    );
    progress = parsed.progress;
  } catch {}
  const byId = (id) => data.find((o) => o.id === id);
  for (const id of ['field', 'location']) {
    const key = id === 'field' ? 'fields' : 'locations';
    [...new Set(data.flatMap((o) => o[key]))]
      .sort()
      .forEach((v) => $('#' + id).add(new Option(v, v)));
  }
  const extraRoutes = [...new Set(data.map((o) => o.access))];
  extraRoutes.forEach((v) => {
    if (![...$('#access').options].some((o) => o.value === v))
      $('#access').add(new Option(v, v));
  });
  $('#collection-date').textContent =
    'Curated collection reviewed ' + dateLabel(window.CHECKED_ON);
  const spotlight = Core.sort(
    data.filter(
      (o) =>
        !Core.isClosed(o, today) &&
        o.deadlineConfirmed &&
        o.deadlineStart >= today,
    ),
    'deadline',
  )[0];
  if (spotlight) {
    const d = new Date(spotlight.deadlineStart + 'T12:00:00Z');
    $('.radar-date').innerHTML =
      esc(
        new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' })
          .format(d)
          .toUpperCase(),
      ) +
      '<strong>' +
      d.getUTCDate() +
      '</strong>';
    $('.radar-body>div:last-child>strong').textContent = spotlight.name;
    $('.radar-body p').textContent = spotlight.deadline;
    $('.radar button').dataset.detail = spotlight.id;
  } else $('.radar').hidden = true;
  function filters() {
    return {
      query: $('#search').value,
      type,
      field: $('#field').value,
      stage: $('#stage').value,
      location: $('#location').value,
      access: $('#access').value,
      cost: $('#cost').value,
      formats: $$('[name=format]:checked').map((x) => x.value),
      from: $('#date-from').value,
      to: $('#date-to').value,
      unknown: $('#include-unknown').checked,
      includeClosed: $('#include-closed').checked,
      confirmed: $('#confirmed-only').checked,
      today,
      view,
    };
  }
  function status(o) {
    return (
      (Core.isClosed(o, today)
        ? '<span class="status closed">Closed</span>'
        : '') +
      `<span class="status ${esc(o.status)}">${esc(o.dateStatus)}</span>` +
      (o.deadlineConfirmed && o.status !== 'confirmed'
        ? '<span class="status confirmed">Deadline confirmed</span>'
        : '')
    );
  }
  function fact(label, value, i, note = '') {
    return `<div class="fact"><div class="fact-label">${icon(i)}${label}</div><div class="fact-value">${esc(value)}</div>${note ? `<p class="fact-note">${esc(note)}</p>` : ''}</div>`;
  }
  function card(o) {
    return `<article class="opp-card ${o.type.toLowerCase().replaceAll(' ', '-')}" data-id="${o.id}"><header class="card-heading"><div class="org-icon" aria-hidden="true">${esc(o.short)}</div><div class="card-title"><span class="type-tag">${esc(o.type)} · ${esc(o.cycle)}</span><h2><button class="title-button" data-detail="${o.id}">${esc(o.name)}</button></h2><div class="org-name">${esc(o.org)}</div></div><button class="bookmark ${saved.has(o.id) ? 'saved' : ''}" data-save="${o.id}" aria-label="${saved.has(o.id) ? 'Remove' : 'Save'} ${esc(o.name)}${saved.has(o.id) ? ' from shortlist' : ' to shortlist'}" aria-pressed="${saved.has(o.id)}">${icon('bookmark')}</button></header><p class="card-description">${esc(o.description)}</p><div class="status-row">${status(o)}</div><div class="eligibility-block"><div class="fact-label">${icon('people')}Who can apply</div><p>${esc(o.eligibility)}</p></div><div class="card-facts">${fact('Next deadline', o.deadline, 'calendar', o.deadlineDetail)}${fact(o.type === 'Scholarship' ? 'Funding & costs' : 'Participation cost', o.cost, 'coin', o.costNote)}${fact('Location & format', o.location, 'pin', o.formats.join(' / '))}${fact('Time & team', o.effort, 'people', o.team)}</div><div class="card-caution"><strong>Worth checking</strong><p>${esc(o.caution)}</p></div>${view === 'saved' ? trackerPanel(o) : ''}<div class="checked-stamp">Reviewed ${esc(dateLabel(o.checkedOn || window.CHECKED_ON))}</div><div class="card-bottom"><label class="check-label compare-check"><input type="checkbox" data-compare="${o.id}" ${compare.has(o.id) ? 'checked' : ''} aria-label="Compare ${esc(o.name)}">Compare</label><div class="card-links"><a href="${esc(safeLink(o.sources[0][1]))}" target="_blank" rel="noopener noreferrer">Provider source ↗</a><button class="details-btn" data-detail="${o.id}">Full details & sources →</button></div></div></article>`;
  }
  function deadlineItem(o) {
    return `<article class="deadline-item"><div class="deadline-date">${esc(o.deadline)}</div><div><h2><button class="title-button" data-detail="${o.id}">${esc(o.name)}</button></h2><div class="status-row">${status(o)}</div><p>${esc(o.deadlineDetail)}</p></div><button class="details-btn" data-detail="${o.id}">Details →</button></article>`;
  }
  function newsCard(item) {
    return `<article class="news-card"><div class="news-meta"><span>${esc(item.sourceName)}</span><time datetime="${esc(item.publishedAt)}">${esc(dateLabel(item.publishedAt))}</time></div><h2><a href="${esc(safeLink(item.url))}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h2><div class="status-row"><span class="status unverified">Source announcement · not verified</span><span class="topic-pill">${esc(item.type)}</span>${(item.degreeTags || []).map((t) => `<span class="topic-pill">Mentions ${esc(t)}</span>`).join('')}</div>${item.excerpt ? `<p class="news-excerpt">${esc(item.excerpt)}…</p>` : ''}<p class="news-disclaimer">Eligibility, award value and application dates need checking with the provider. This may be a program announcement or a scholarship roundup.</p><div class="news-links"><a class="primary-link" href="${esc(safeLink(item.url))}" target="_blank" rel="noopener noreferrer">Read original announcement ↗</a>${(
      item.links || []
    )
      .slice(0, 1)
      .map(
        (u) =>
          `<a href="${esc(safeLink(u))}" target="_blank" rel="noopener noreferrer">Linked website (unverified) ↗</a>`,
      )
      .join('')}</div></article>`;
  }
  function sourceCards() {
    return `<section id="renewal-summary" class="sources-intro"><h2>Weekly source review</h2><p>Loading source availability and review queue…</p></section><div class="sources-intro"><h2>Fresh announcements, collected automatically.</h2><p>These public channels and websites are checked by the site’s scheduled updater. No Telegram login is required. Each source is a discovery service; final requirements belong to the program provider.</p><p><strong>Schedule:</strong> Monday mornings, Hong Kong time. <strong>Last successful collection:</strong> ${esc(dateLabel(feed?.lastSuccessfulRefresh, true))}.</p></div><div class="source-grid">${(feed?.sources || sourceDefaults).map((s) => `<article class="source-card"><div class="status-row"><span class="status ${s.status === 'ok' ? 'confirmed' : s.status === 'unavailable' ? 'caution' : 'partial'}">${s.status === 'ok' ? 'Source readable' : s.status === 'unavailable' ? 'Temporarily unavailable' : 'Waiting for status'}</span></div><h3>${esc(s.name)}</h3><p>${s.kind === 'telegram' ? 'Public Telegram channel' : 'Public website RSS feed'}</p><p>${esc(s.message || 'Availability is checked when the feed is loaded.')}</p><dl><dt>Last successful fetch</dt><dd>${esc(dateLabel(s.lastSuccessAt, true))}</dd><dt>Saved announcements</dt><dd>${s.count ?? '—'}</dd></dl><a href="${esc(safeLink(s.url))}" target="_blank" rel="noopener noreferrer">Open source ↗</a></article>`).join('')}</div><div class="sources-explanation"><h3>What automatic updates do</h3><p>The updater fetches new public posts, removes duplicates, saves the results, and makes them available under Latest updates. A failed fetch keeps the last saved announcements and shows the source’s status. The curated collection keeps its original review dates until the provider details are checked again.</p><h3>Why the labels matter</h3><p>A post being new does not prove its deadline, funding claims or your eligibility. Follow the original links before applying. Automatic collection is discovery, not independent verification.</p></div>`;
  }
  function trackerPanel(o) {
    const p = progress[o.id] || { status: 'Interested', notes: '' };
    return `<section class="application-log" aria-label="Application log for ${esc(o.name)}"><h3>Your application log</h3><label for="progress-${o.id}">Application stage</label><select id="progress-${o.id}" data-progress="${o.id}">${PROGRESS_STATES.map((x) => `<option ${x === p.status ? 'selected' : ''}>${x}</option>`).join('')}</select><label for="notes-${o.id}">Private notes / next steps</label><textarea id="notes-${o.id}" data-notes="${o.id}" rows="3" maxlength="1500" placeholder="Documents to prepare, questions to ask, your next step…">${esc(p.notes)}</textarea><p class="log-hint" id="log-hint-${o.id}">Changes stay private. Guest mode saves on this device; account mode syncs to Supabase.</p></section>`;
  }
  function persistProgress(id) {
    try {
      if (!cloudMode)
        localStorage.setItem('oe-progress-v1', JSON.stringify(progress));
      trackerChanged();
      $('#log-hint-' + id).textContent = cloudMode
        ? 'Syncing to your private account…'
        : 'Saved on this device. Notes stay out of shared links and calendar files.';
    } catch {
      $('#log-hint-' + id).textContent =
        'Browser storage is unavailable. Export a backup before leaving.';
    }
  }
  function downloadFile(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function trackerSummary() {
    const selected = data.filter((o) => saved.has(o.id)),
      counts = PROGRESS_STATES.map((status) => ({
        status,
        count: selected.filter(
          (o) => (progress[o.id]?.status || 'Interested') === status,
        ).length,
      }));
    $('#tracker-summary').innerHTML = counts
      .map(
        (x) => `<div><strong>${x.count}</strong><span>${x.status}</span></div>`,
      )
      .join('');
  }
  function updateTray() {
    $('#compare-tray').hidden = !compare.size;
    $('#compare-count').textContent = compare.size + ' selected';
    $('#compare-names').textContent = [...compare]
      .map((id) => byId(id).name)
      .join(' · ');
    $('#compare-btn').disabled = compare.size < 2;
    document.body.style.paddingBottom = compare.size ? '100px' : '';
  }
  function render() {
    const platform = [
      'skills',
      'careers',
      'universities',
      'activities',
      'assistant',
    ].includes(view);
    document.body.dataset.currentView = view;
    $('#platform-panel').hidden = !platform;
    for (const selector of [
      '.hero',
      '.collection-bar',
      '.search-row',
      '.type-tabs',
      '.explore-layout',
    ])
      $(selector).hidden = platform;
    if (platform) {
      $$('.nav-item[data-view]').forEach((b) => {
        b.classList.toggle('active', b.dataset.view === view);
        b.setAttribute(
          'aria-current',
          b.dataset.view === view ? 'page' : 'false',
        );
      });
      $('#breadcrumb-title').textContent = {
        skills: 'Skills to Develop',
        careers: 'Internships & jobs',
        universities: 'Search for universities',
        activities: 'My activities',
        assistant: 'Ask ProspectoAI',
      }[view];
      $('#compare-tray').hidden = true;
      window.ProspectoPlatform?.render(view);
      return;
    }
    const isFeed = view === 'latest',
      isSources = view === 'sources',
      f = filters();
    $('#tracker-tools').hidden = view !== 'saved';
    if (view === 'saved') trackerSummary();
    $('#filters').hidden = isSources;
    $('#curated-filters').hidden = isFeed;
    $('#feed-filters').hidden = !isFeed;
    $('.type-tabs').hidden = isSources;
    $('.search-row').hidden = isSources;
    $('.sort-label').hidden = isFeed || isSources || view === 'deadlines';
    $$('.nav-item[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === view);
      b.setAttribute(
        'aria-current',
        b.dataset.view === view ? 'page' : 'false',
      );
    });
    $$('.type-tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.type === type);
      b.setAttribute('aria-pressed', b.dataset.type === type);
    });
    const activeCount = Core.filter(data, { today }).length;
    $('#catalog-count').textContent = activeCount;
    $('#nav-total').textContent = activeCount;
    $('#type-all-count').textContent = isFeed
      ? feed?.items?.length || 0
      : activeCount;
    $('#saved-count').textContent = saved.size;
    $('#feed-count').textContent =
      feedState === 'loading' ? '…' : feed?.items?.length || 0;
    const titles = {
      explore: [
        'Find opportunities.<br><em>Know what matters.</em>',
        'Scholarships, research, and competitions — with the eligibility, funding, and deadlines you need to make a decision.',
        'Explore',
      ],
      latest: [
        'Fresh announcements.<br><em>From sources you follow.</em>',
        'New posts from public channels and scholarship websites, collected automatically. Use them as leads and verify the original provider’s requirements.',
        'Latest updates',
      ],
      sources: [
        'Know where<br><em>updates come from.</em>',
        'See the connected public sources, their availability, and when announcements were last collected.',
        'Sources & updates',
      ],
      saved: [
        'Your next steps.<br><em>Worth keeping.</em>',
        'Track your application stages, write private notes, and keep a backup. Browse as a guest or sign in to sync your private tracker across devices.',
        'Application tracker',
      ],
      deadlines: [
        'Plan ahead.<br><em>Give yourself time.</em>',
        'See each opportunity’s next deadline, the exact cut-off when known, and anything that still needs confirmation.',
        'Deadline view',
      ],
    };
    $('#page-title').innerHTML = titles[view][0];
    $('#page-intro').textContent = titles[view][1];
    $('#breadcrumb-title').textContent = titles[view][2];
    $('.radar').hidden = isFeed || isSources || !spotlight;
    let items = [],
      invalid = false;
    const grid = $('#card-grid');
    $('#active-filters').innerHTML = '';
    $('#feed-notice').hidden = !isFeed;
    if (isSources) {
      $('#results-count').textContent = 'Connected public sources';
      $('#results-context').textContent = feedFallback
        ? 'Showing a saved fallback copy; live source status is unavailable.'
        : 'Status comes from the latest saved fetch.';
      grid.className = 'source-board';
      grid.innerHTML = sourceCards();
      document.dispatchEvent(new Event('prospecto-renewal-view'));
      $('#empty').hidden = true;
      updateTray();
      return;
    }
    if (isFeed) {
      const query = f.query.trim().toLowerCase(),
        source = $('#feed-source').value;
      items = (feed?.items || []).filter(
        (o) =>
          (!source || o.sourceId === source) &&
          (!type || o.type === type) &&
          (!query ||
            [o.title, o.excerpt, o.sourceName, ...(o.degreeTags || [])]
              .join(' ')
              .toLowerCase()
              .includes(query)),
      );
      $('#results-context').textContent =
        'Automatically collected announcements — not verified applications.';
      $('#feed-notice').innerHTML =
        feedState === 'loading'
          ? '<strong>Loading the latest saved announcements…</strong>'
          : feedState === 'error'
            ? '<strong>The live feed could not be loaded.</strong> The curated collection is still available. Use Sources & updates to open the public channels directly.'
            : `<strong>Last successful collection: ${esc(dateLabel(feed?.lastSuccessfulRefresh, true))}</strong><span>${feedFallback ? 'Showing a saved fallback copy. ' : ''}${feed?.refreshFailed ? 'The latest refresh failed; showing the last saved announcements. ' : ''}${feed?.sources?.some((s) => s.status === 'unavailable') ? 'Some sources are temporarily unavailable. ' : ''}Next scheduled check: Monday morning, Hong Kong time. Dates, funding and eligibility in these posts are not independently verified.</span>`;
      grid.className = 'news-grid';
      grid.innerHTML = items.map(newsCard).join('');
    } else {
      invalid = f.from && f.to && f.from > f.to;
      items = invalid
        ? []
        : Core.sort(
            Core.filter(data, f, saved),
            view === 'deadlines' ? 'deadline' : $('#sort').value,
          );
      if (view === 'saved' && $('#tracker-status').value)
        items = items.filter(
          (o) =>
            (progress[o.id]?.status || 'Interested') ===
            $('#tracker-status').value,
        );
      $('#results-context').textContent =
        view === 'saved'
          ? 'Guest data stays in this browser. Sign in for a separate private account tracker.'
          : view === 'deadlines'
            ? 'Primary next deadlines. Read the details for secondary dates.'
            : 'Read the essentials here, then compare or open the provider source.';
      const chips = [
        type,
        f.stage,
        f.field,
        f.location,
        f.access,
        ...f.formats,
        f.cost === 'Aid' ? 'Aid available' : f.cost,
        f.from ? 'From ' + f.from : '',
        f.to ? 'Through ' + f.to : '',
        f.confirmed ? 'Confirmed deadlines' : '',
        f.includeClosed ? 'Closed included' : '',
      ].filter(Boolean);
      $('#active-filters').innerHTML = chips
        .map((t) => `<span class="active-chip">${esc(t)}</span>`)
        .join('');
      grid.className = view === 'deadlines' ? 'deadline-list' : 'card-grid';
      if (view === 'deadlines') {
        const dated = items.filter((o) => o.deadlineStart),
          unknown = items.filter((o) => !o.deadlineStart);
        grid.innerHTML =
          dated.map(deadlineItem).join('') +
          (unknown.length
            ? '<h3 class="deadline-group-title">Local or unannounced deadlines</h3>' +
              unknown.map(deadlineItem).join('')
            : '');
      } else grid.innerHTML = items.map(card).join('');
    }
    $('#results-count').textContent =
      items.length +
      ' ' +
      (isFeed
        ? 'source announcements'
        : items.length === 1
          ? 'opportunity'
          : 'opportunities');
    $('#empty').hidden = !!items.length || (isFeed && feedState === 'loading');
    $('#empty-text').textContent = invalid
      ? 'The end date is before the start date. Adjust the deadline window.'
      : isFeed
        ? 'No matching source announcements are saved yet. Try another source or open its public page.'
        : view === 'saved' && !saved.size
          ? 'Use a bookmark button to start your shortlist.'
          : 'Try a broader filter or another search.';
    $('#empty-reset').textContent =
      view === 'saved' && !saved.size
        ? 'Explore opportunities'
        : 'Clear filters';
    updateTray();
  }
  function reset() {
    type = '';
    $('#tracker-status').value = '';
    $('#search').value = '';
    for (const id of [
      'field',
      'stage',
      'location',
      'cost',
      'access',
      'feed-source',
    ])
      $('#' + id).value = '';
    for (const id of ['date-from', 'date-to']) $('#' + id).value = '';
    $$('[name=format]').forEach((el) => (el.checked = false));
    $('#include-unknown').checked = true;
    $('#include-closed').checked = false;
    $('#confirmed-only').checked = false;
    render();
  }
  function toast(text) {
    $('#toast').textContent = text;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
  }
  function save(id) {
    if (
      window.ProspectoPlatform?.canEditTracker &&
      !window.ProspectoPlatform.canEditTracker()
    ) {
      toast(
        'Your private workspace is still loading. Reload if sync is unavailable.',
      );
      return;
    }
    if (saved.has(id)) saved.delete(id);
    else saved.add(id);
    let stored = true;
    try {
      if (!cloudMode)
        localStorage.setItem('oe-shortlist-v1', JSON.stringify([...saved]));
      trackerChanged();
    } catch {
      stored = false;
    }
    render();
    if ($('#detail-dialog').open) openDetail(id, false);
    toast(
      stored
        ? saved.has(id)
          ? 'Added to your shortlist.'
          : 'Removed from your shortlist.'
        : 'Saved for this session; browser storage is unavailable.',
    );
  }
  function toggleCompare(id) {
    if (compare.has(id)) compare.delete(id);
    else if (compare.size < 3) compare.add(id);
    else toast('Compare up to 3 opportunities. Remove one to add another.');
    render();
  }
  function sourceList(o) {
    return `<ul class="sources">${o.sources.map(([label, url]) => `<li><a href="${esc(safeLink(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} <span>↗</span></a></li>`).join('')}</ul><p class="source-date">Provider sources reviewed ${esc(dateLabel(o.checkedOn || window.CHECKED_ON))}. Pages can change after this date.</p>`;
  }
  function openDetail(id, show = true) {
    const o = byId(id);
    if (!o) return;
    $('#detail-content').innerHTML =
      `<div class="dialog-eyebrow">${esc(o.type)} · ${esc(o.cycle)}</div><h2 id="detail-title">${esc(o.name)}</h2><p class="detail-org">${esc(o.org)}</p><p>${esc(o.description)}</p><div class="status-row">${status(o)}</div><div class="detail-grid"><div><h3>Who can apply</h3><p>${esc(o.eligibility)}</p><p><strong>Entry route:</strong> ${esc(o.access)}</p></div><div><h3>Next deadline</h3><p><strong>${esc(o.deadline)}</strong></p><p>${esc(o.deadlineDetail)}</p></div><div><h3>Funding & costs</h3><p><strong>${esc(o.cost)}</strong></p><p>${esc(o.costNote)}</p></div><div><h3>Where, when & how</h3><p>${esc(o.location)} · ${esc(o.formats.join(' / '))}</p><p>${esc(o.schedule)}</p><p>${esc(o.effort)} · ${esc(o.team)}</p></div></div><div class="attention"><strong>Before you commit</strong><p>${esc(o.caution)}</p></div><h3>What you could take away</h3><p>${esc(o.output)}</p><p class="editorial-label">Editorial assessment; admission, publication or an award is not guaranteed.</p><h3>A useful next step</h3><p>${esc(o.next)}</p><h3>Read the original sources</h3>${sourceList(o)}<div class="detail-actions"><button class="primary" data-save="${o.id}">${saved.has(o.id) ? 'Remove from shortlist' : 'Save to tracker'}</button>${o.deadlineConfirmed && o.deadlineStart === o.deadlineEnd ? `<button class="secondary" data-calendar="${o.id}">Export deadline reminder (.ics)</button>` : ''}<button class="secondary" data-share="${o.id}">Copy opportunity link</button></div><p class="calendar-note">Calendar exports are date reminders, not exact cut-offs. Check the deadline and timezone above. Notifications depend on your calendar settings.</p>`;
    if (show) $('#detail-dialog').showModal();
  }
  function openComparison() {
    if (compare.size < 2) return;
    const items = [...compare].map(byId);
    const rows = [
      ['Type', (o) => esc(o.type)],
      ['Fields', (o) => esc(o.fields.join(' · '))],
      ['Date confidence', (o) => status(o)],
      [
        'Next deadline',
        (o) =>
          `<strong>${esc(o.deadline)}</strong><p>${esc(o.deadlineDetail)}</p>`,
      ],
      ['Eligibility', (o) => esc(o.eligibility)],
      [
        'Funding & costs',
        (o) => `<strong>${esc(o.cost)}</strong><p>${esc(o.costNote)}</p>`,
      ],
      [
        'Location & dates',
        (o) => `${esc(o.location)}<p>${esc(o.schedule)}</p>`,
      ],
      ['Time & team', (o) => `${esc(o.effort)}<p>${esc(o.team)}</p>`],
      ['Needs checking', (o) => esc(o.caution)],
      ['Potential outcome', (o) => esc(o.output)],
      [
        'Sources',
        (o) =>
          o.sources
            .map(
              ([label, url]) =>
                `<a href="${esc(safeLink(url))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`,
            )
            .join('<br>') +
          `<p>Reviewed ${esc(dateLabel(o.checkedOn || window.CHECKED_ON))}</p>`,
      ],
    ];
    $('#compare-content').innerHTML =
      `<div class="comparison-scroll"><table class="comparison"><thead><tr><th scope="col">What matters</th>${items.map((o) => `<th scope="col">${esc(o.name)}</th>`).join('')}</tr></thead><tbody>${rows.map(([label, fn]) => `<tr><th scope="row">${label}</th>${items.map((o) => `<td>${fn(o)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    $('#compare-dialog').showModal();
  }
  async function loadFeed() {
    try {
      const response = await fetch('/api/discover', {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(25000),
      });
      if (!response.ok) throw new Error('Feed unavailable');
      const json = await response.json();
      if (!Array.isArray(json.items) || !Array.isArray(json.sources))
        throw new Error('Invalid response');
      feed = json;
      feedState = 'ready';
    } catch {
      try {
        const response = await fetch('/feed-snapshot.json');
        if (!response.ok) throw new Error('No fallback');
        feed = await response.json();
        feedFallback = true;
        feedState = 'ready';
      } catch {
        feedState = 'error';
      }
    }
    if (view === 'latest' || view === 'sources') render();
    else
      $('#feed-count').textContent =
        feedState === 'loading' ? '…' : feed?.items?.length || 0;
  }
  document.addEventListener('click', (event) => {
    const detail = event.target.closest('[data-detail]'),
      sv = event.target.closest('[data-save]'),
      nav = event.target.closest('button[data-view]'),
      tab = event.target.closest('[data-type]');
    if (detail) {
      openDetail(detail.dataset.detail);
      return;
    }
    if (sv) {
      save(sv.dataset.save);
      return;
    }
    if (nav) {
      view = nav.dataset.view;
      type = '';
      render();
      window.scrollTo({ top: 0, behavior: 'instant' });
      return;
    }
    if (tab) {
      type = tab.dataset.type;
      render();
    }
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches('[data-compare]'))
      toggleCompare(event.target.dataset.compare);
    if (event.target.matches('[data-progress]')) {
      const id = event.target.dataset.progress;
      progress[id] = {
        ...(progress[id] || { notes: '' }),
        status: event.target.value,
      };
      persistProgress(id);
      trackerSummary();
      if ($('#tracker-status').value) render();
    }
  });
  document.addEventListener('input', (event) => {
    if (event.target.matches('[data-notes]')) {
      const id = event.target.dataset.notes;
      progress[id] = {
        ...(progress[id] || { status: 'Interested' }),
        notes: event.target.value.slice(0, 1500),
      };
      persistProgress(id);
    }
  });
  document.addEventListener('click', async (event) => {
    const calendar = event.target.closest('[data-calendar]'),
      share = event.target.closest('[data-share]');
    if (calendar) {
      try {
        const o = byId(calendar.dataset.calendar);
        downloadFile(
          o.id + '-deadline.ics',
          Core.calendar(o),
          'text/calendar;charset=utf-8',
        );
        toast('Date reminder exported. Check its timezone in the source.');
      } catch (error) {
        toast(error.message);
      }
    }
    if (share) {
      const url = new URL(location.origin + location.pathname);
      url.searchParams.set('opportunity', share.dataset.share);
      try {
        await navigator.clipboard.writeText(url.href);
        toast('Opportunity link copied. Your notes are private.');
      } catch {
        toast('Copy this link: ' + url.href);
      }
    }
  });
  $('#tracker-status').addEventListener('change', render);
  $('#backup-export').addEventListener('click', () => {
    downloadFile(
      'prospectoai-backup.json',
      JSON.stringify(
        {
          version: 1,
          exportedAt: new Date().toISOString(),
          saved: [...saved],
          progress,
        },
        null,
        2,
      ),
      'application/json',
    );
    toast('Backup exported. Keep this file private: it contains your notes.');
  });
  $('#backup-import').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1000000)
        throw new Error('Choose a backup smaller than 1 MB.');
      if (
        window.ProspectoPlatform?.canEditTracker &&
        !window.ProspectoPlatform.canEditTracker()
      )
        throw Error('Load your private workspace before importing.');
      const backup = Core.parseBackup(
        JSON.parse(await file.text()),
        data.map((o) => o.id),
      );
      saved = new Set([...saved, ...backup.saved]);
      Object.assign(progress, backup.progress);
      let persisted = false;
      try {
        persisted =
          cloudMode || Core.persistTracker(localStorage, [...saved], progress);
        trackerChanged();
      } catch {}
      render();
      toast(
        persisted
          ? 'Backup merged with your tracker.'
          : 'Imported for this session. Export a backup before leaving; browser storage is unavailable.',
      );
    } catch (error) {
      toast(
        error instanceof SyntaxError
          ? 'This file is not valid JSON.'
          : error.message,
      );
    } finally {
      event.target.value = '';
    }
  });
  $$('.filters input,.filters select').forEach((el) =>
    el.addEventListener('change', render),
  );
  $('#search').addEventListener('input', render);
  $('#sort').addEventListener('change', render);
  $('#reset').addEventListener('click', reset);
  $('#empty-reset').addEventListener('click', () => {
    if (view === 'saved' && !saved.size) view = 'explore';
    reset();
  });
  $('#filter-toggle').setAttribute('aria-controls', 'filters');
  $('#filter-toggle').setAttribute('aria-expanded', 'false');
  $('#filter-toggle').addEventListener('click', () =>
    $('#filter-toggle').setAttribute(
      'aria-expanded',
      $('#filters').classList.toggle('open'),
    ),
  );
  $$('.dialog-close').forEach((b) =>
    b.addEventListener('click', () => b.closest('dialog').close()),
  );
  $$('dialog').forEach((d) =>
    d.addEventListener('click', (event) => {
      if (event.target === d) {
        const r = d.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          d.close();
      }
    }),
  );
  for (const id of ['guide-btn', 'footer-guide'])
    $('#' + id).addEventListener('click', () => $('#guide-dialog').showModal());
  $('#compare-btn').addEventListener('click', openComparison);
  $('#clear-compare').addEventListener('click', () => {
    compare.clear();
    render();
  });
  $('.brand').addEventListener('click', (event) => {
    event.preventDefault();
    view = 'explore';
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.addEventListener('keydown', (event) => {
    if (
      event.key === '/' &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(
        document.activeElement.tagName,
      ) &&
      !$$('dialog').some((d) => d.open)
    ) {
      event.preventDefault();
      $('#search').focus();
    }
  });
  window.ProspectoTracker = {
    snapshot: () => ({
      saved: [...saved],
      progress: structuredClone(progress),
    }),
    guest: () =>
      Core.parseBackup(
        {
          version: 1,
          saved: JSON.parse(localStorage.getItem('oe-shortlist-v1') || '[]'),
          progress: JSON.parse(localStorage.getItem('oe-progress-v1') || '{}'),
        },
        data.map((o) => o.id),
      ),
    setCloud(value) {
      cloudMode = value !== null;
      let parsed;
      try {
        parsed = value
          ? Core.parseBackup(
              { version: 1, ...value },
              data.map((o) => o.id),
            )
          : this.guest();
      } catch {
        parsed = { saved: [], progress: {} };
      }
      saved = new Set(parsed.saved);
      progress = parsed.progress;
      render();
      if ($('#detail-dialog').open) $('#detail-dialog').close();
    },
    setView(next) {
      view = next;
      type = '';
      render();
      window.scrollTo({ top: 0, behavior: 'instant' });
    },
  };
  render();
  loadFeed();
  const linked = new URLSearchParams(location.search).get('opportunity');
  if (linked && byId(linked)) openDetail(linked);
})();

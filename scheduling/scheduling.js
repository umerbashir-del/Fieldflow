import { ACCOUNT_ID, accounts, IS_CONTRACTOR_SESSION, LIVE_MODE, REPORTING, seedClients, seedJobs, STATUS_LABELS, STATUS_VALUES, TEAM_MEMBERS } from './data.js';
import { clientName, formatDate } from './formatters.js';
import { addDaysISO, addMonthsISO, isSameMonth, monthDay, monthYearLabel, startOfMonthISO, startOfWeekISO, weekdayShort } from './date-utils.js';
import { buildMockDataLink, loadMockAccountData, saveMockAccountData } from '../shared-data/mockDataSession.js';
import { APP_URLS } from '../shared-data/appConfig.js';
import { createFieldflowClient, createJob, deleteClient, deleteJob as deleteLiveJob, updateClient, updateJob } from '../shared-data/supabase.js';
import { formatReportingDate, toggleReportingDateInCurrentUrl, withReportingDate } from '../shared-data/reportingDate.js';
import { assigneeLabel } from '../shared-data/jobPresentation.js';

(function () {
  'use strict';

  // The sign-in screen loads this module too. Do not initialize or retain
  // any company data unless a contractor demo session is present.
  if (!IS_CONTRACTOR_SESSION) return;

  // Key used to save app state in the browser's localStorage, so your
  // data survives a page refresh.
  const STORAGE_KEY = 'fieldflow_scheduling_local_v2_' + ACCOUNT_ID;

  // ---------------------------------------------------------------
  // STATE
  // ---------------------------------------------------------------
  // This whole app is one big object of "current state" variables. Any
  // time one of these changes, we call renderAll() to redraw the screen
  // to match — that's the entire pattern this app runs on: change state,
  // then re-render. There's no framework doing this automatically (no
  // React here), so renderAll() has to be called by hand after every
  // change.
  let { clients, jobs } = loadInitialState(); // the actual data being edited
  let tab = 'home';                        // which top-level tab is showing: 'home' | 'calendar' | 'clients'
  let calMode = 'week';                    // which calendar layout is showing: 'day' | 'week' | 'month'
  let calAnchor = REPORTING.isoDate;       // the date the calendar view is currently centered/focused on
  let jobModal = null;    // null when closed, otherwise { mode: 'new'|'edit', draft, originalId? }
  let clientModal = null; // null when closed, otherwise { mode: 'new'|'edit', draft, originalId? }
  let clientNotice = '';  // warning text shown inside the client modal (e.g. "can't delete, has jobs")

  const reportingNotice = document.getElementById('schedulingDemoNotice');
  if (REPORTING.storedDate) {
    const label = REPORTING.isDemoDate ? 'Demo data — reporting as of ' : 'Live-date preview — reporting as of ';
    reportingNotice.replaceChildren(document.createTextNode(`${label}${formatReportingDate(REPORTING.isoDate)}. `));
    const dateModeButton = document.createElement('button');
    dateModeButton.type = 'button';
    dateModeButton.className = 'notice-link';
    dateModeButton.textContent = REPORTING.isDemoDate ? 'Use today' : 'Return to demo date';
    dateModeButton.addEventListener('click', () => toggleReportingDateInCurrentUrl(REPORTING));
    reportingNotice.append(dateModeButton);
  }

  // Reads any previously-saved clients/jobs out of localStorage. If
  // nothing's saved yet (first visit) or the saved data is corrupted,
  // falls back to the seed data from data.js so the app always has
  // something to show.
  function loadInitialState() {
    if (LIVE_MODE) return { clients: seedClients, jobs: seedJobs };
    try {
    } catch (e) { /* fall back to the scoped demo seed */ }
    return loadMockAccountData(ACCOUNT_ID, { clients: seedClients, jobs: seedJobs });
  }

  // Saves the current clients/jobs arrays to localStorage. Called after
  // every add/edit/delete so changes aren't lost on refresh.
  function persist() {
    if (!LIVE_MODE) {
      saveMockAccountData(ACCOUNT_ID, { clients, jobs }, { clients: seedClients, jobs: seedJobs });
      refreshMockDataLinks();
    }
  }

  // Generates a short unique id like "job_a1b2c3d4" for new records. The
  // real shared-data files use the same "prefix_something" id style, so
  // this stays consistent with that.
  function makeId(prefix) {
    const rand = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random())).replace(/-/g, '').slice(0, 8);
    return prefix + '_' + rand;
  }

  // Same-assignee-same-day is the closest analog to "double booking" now
  // that jobs only carry a date, not a time of day. Flagged, not blocked —
  // one assignee legitimately can cover two jobs in a day at different
  // times, we just don't have a time field to tell them apart yet.
  //
  // How it works: group every non-cancelled job by "assignee + date", and
  // if any group ends up with more than one job in it, every job id in
  // that group gets added to the returned conflicts Set. Callers just
  // check `conflictIds.has(job.id)` to know whether to show the warning.
  function computeConflictIds(jobList) {
    const byKey = new Map();
    jobList.forEach((job) => {
      if (job.status === 'cancelled') return;
      const key = job.assignee + '__' + job.scheduled_for;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(job.id);
    });
    const conflicts = new Set();
    byKey.forEach((ids) => { if (ids.length > 1) ids.forEach((id) => conflicts.add(id)); });
    return conflicts;
  }

  // Every record carries an account_id (see docs/standards.md in the real
  // repo) so a real multi-tenant backend could filter by account. Here
  // there's only ever one account (ACCOUNT_ID, from data.js), but filtering
  // through these helpers everywhere — instead of using `clients`/`jobs`
  // directly — means the rest of the code doesn't need to change when a
  // different company signs in.
  function accountJobs() { return jobs.filter((j) => j.account_id === ACCOUNT_ID); }
  function accountClients() { return clients.filter((c) => c.account_id === ACCOUNT_ID); }

  const account = accounts.find((a) => a.id === ACCOUNT_ID);

  // ---------------------------------------------------------------
  // DOM refs
  // ---------------------------------------------------------------
  // Grab every element we'll need to read from or write to, once, up
  // front. `el(id)` is just a shorthand for document.getElementById.
  const el = (id) => document.getElementById(id);
  const newJobBtn = el('newJobBtn');
  const accountLine = el('accountLine');
  const tabBtns = Array.from(document.querySelectorAll('.tab-btn'));
  const homeView = el('homeView');
  const calendarView = el('calendarView');
  const clientsView = el('clientsView');
  const statusGrid = el('statusGrid');
  const todayList = el('todayList');
  const upcomingList = el('upcomingList');
  const modeBtns = Array.from(document.querySelectorAll('.mode-btn'));
  const calLabel = el('calLabel');
  const calPrevBtn = el('calPrevBtn');
  const calNextBtn = el('calNextBtn');
  const calTodayBtn = el('calTodayBtn');
  const weekGrid = el('weekGrid');
  const dayAgenda = el('dayAgenda');
  const monthGrid = el('monthGrid');
  const newClientBtn = el('newClientBtn');
  const clientList = el('clientList');
  const analyticsLink = el('analyticsLink');

  if (analyticsLink) {
    const link = new URL(APP_URLS.analytics);
    const query = new URLSearchParams(window.location.search);
    link.searchParams.set('account_id', ACCOUNT_ID);
    ['demo_user', 'demo_name', 'demo_email', 'demo_company'].forEach((name) => {
      if (query.get(name)) link.searchParams.set(name, query.get(name));
    });
    analyticsLink.href = withReportingDate(link.toString(), REPORTING);
    analyticsLink.addEventListener('click', () => {
      analyticsLink.href = buildMockDataLink(analyticsLink.href);
    });
  }
  const chatLink = el('chatLink');
  if (chatLink) {
    const link = new URL(APP_URLS.chatbot);
    const query = new URLSearchParams(window.location.search);
    link.searchParams.set('account_id', ACCOUNT_ID);
    ['demo_user', 'demo_name', 'demo_email', 'demo_company'].forEach((name) => {
      if (query.get(name)) link.searchParams.set(name, query.get(name));
    });
    chatLink.href = withReportingDate(link.toString(), REPORTING);
    chatLink.addEventListener('click', () => {
      chatLink.href = buildMockDataLink(chatLink.href);
    });
  }

  function refreshMockDataLinks() {
    if (LIVE_MODE) return;
    if (analyticsLink) analyticsLink.href = buildMockDataLink(analyticsLink.href);
    if (chatLink) chatLink.href = buildMockDataLink(chatLink.href);
  }

  // Job modal elements — the popup used for both "New job" and "Edit job".
  const jobModalBackdrop = el('jobModalBackdrop');
  const jobModalCard = el('jobModalCard');
  const jobModalTitle = el('jobModalTitle');
  const jobClientSel = el('jobClient');
  const jobTitleInput = el('jobTitle');
  const jobDateInput = el('jobDate');
  const jobAssigneeSel = el('jobAssignee');
  const jobStatusSel = el('jobStatus');
  const jobConflictWarning = el('jobConflictWarning');
  const deleteJobBtn = el('deleteJobBtn');
  const cancelJobBtn = el('cancelJobBtn');
  const saveJobBtn = el('saveJobBtn');

  // Client modal elements — same idea, for "New client" / "Edit client".
  const clientModalBackdrop = el('clientModalBackdrop');
  const clientModalCard = el('clientModalCard');
  const clientModalTitle = el('clientModalTitle');
  const clientNameInput = el('clientName');
  const clientCityInput = el('clientCity');
  const clientNoticeEl = el('clientNotice');
  const deleteClientBtn = el('deleteClientBtn');
  const cancelClientBtn = el('cancelClientBtn');
  const saveClientBtn = el('saveClientBtn');

  // ---------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------
  // renderAll() is the single entry point that redraws everything based
  // on current state. It's intentionally not "smart" about only updating
  // what changed — it just re-renders the active tab (and both modals)
  // every time, top to bottom. That's simpler to reason about than
  // tracking exactly what needs to change, and the app is small enough
  // that redrawing everything is instant.
  function renderAll() {
    accountLine.textContent = (account ? account.name : 'Account') + ' · ' + monthYearLabel(REPORTING.isoDate);

    // Show/hide the three top-level sections based on which tab is active.
    // The `hidden` attribute is what the [hidden] CSS rules in
    // scheduling.css key off of.
    tabBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tab));
    homeView.hidden = tab !== 'home';
    calendarView.hidden = tab !== 'calendar';
    clientsView.hidden = tab !== 'clients';

    if (tab === 'home') renderHome();
    if (tab === 'calendar') renderCalendar();
    if (tab === 'clients') renderClients();

    // Modals render independently of the active tab, since a job/client
    // modal can be opened from more than one tab (e.g. clicking a job in
    // the calendar, or from the Home dashboard).
    renderJobModal();
    renderClientModal();
  }

  // ---- small HTML-building helpers used by more than one render function ----

  function statusBadge(status) {
    const label = STATUS_LABELS[status] || status.replace('_', ' ');
    return '<span class="badge badge-' + status + '">' + label + '</span>';
  }

  function conflictFlagHtml() {
    return '<span class="conflict-flag">⚠ Assignee double-booked this day</span>';
  }

  // Renders one job as a full-width row (used on the Home dashboard, in
  // both the "Today" and "Upcoming work" sections).
  function jobRowHtml(job, isConflict) {
    return (
      '<article class="job ' + (isConflict ? 'is-conflict' : '') + '" data-job-id="' + job.id + '">' +
        '<div>' +
          '<strong>' + escapeHtml(job.title) + '</strong>' +
          '<div class="muted">' + escapeHtml(clientName(job.client_id, clients)) + ' · ' + escapeHtml(assigneeLabel(job.assignee)) + '</div>' +
          (isConflict ? conflictFlagHtml() : '') +
        '</div>' +
        '<div>' + statusBadge(job.status) +
          '<div class="muted" style="margin-top:6px">' + formatDate(job.scheduled_for) + '</div>' +
        '</div>' +
      '</article>'
    );
  }

  // Since we're building HTML by string concatenation (no framework
  // escaping this for us automatically), any value that came from user
  // input — a job title, a client name — has to be escaped before it
  // goes into innerHTML, or a value like `<script>` typed into a field
  // would actually run as HTML/JS.
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- Home tab ----
  function renderHome() {
    const aJobs = accountJobs();
    const conflictIds = computeConflictIds(aJobs);
    const today = REPORTING.isoDate;

    // Status summary cards: one per possible status, with a live count.
    statusGrid.innerHTML = STATUS_VALUES.map((status) => {
      const count = aJobs.filter((j) => j.status === status).length;
      return '<div class="card"><span class="muted">' + STATUS_LABELS[status] + '</span><div class="metric">' + count + '</div></div>';
    }).join('');

    // "Today": jobs whose scheduled_for is literally today's date.
    const todays = aJobs.filter((j) => j.scheduled_for === today).sort((a, b) => a.title.localeCompare(b.title));
    todayList.innerHTML = todays.length
      ? todays.map((j) => jobRowHtml(j, conflictIds.has(j.id))).join('')
      : '<div class="empty-state">Nothing scheduled today.</div>';

    // "Upcoming work": future, not-cancelled jobs, soonest first, capped
    // at 8 so the dashboard doesn't turn into an endless list.
    const upcoming = aJobs
      .filter((j) => j.scheduled_for > today && j.status !== 'cancelled')
      .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
      .slice(0, 8);
    upcomingList.innerHTML = upcoming.length
      ? upcoming.map((j) => jobRowHtml(j, conflictIds.has(j.id))).join('')
      : '<div class="empty-state">No upcoming jobs on the books.</div>';

    // Because we just replaced all this HTML with innerHTML, any click
    // listeners that were attached to the old elements are gone too —
    // we have to re-attach them to the freshly-created elements every
    // time renderHome() runs. This "render then re-wire listeners"
    // pattern repeats in every render function below.
    Array.from(document.querySelectorAll('#homeView .job')).forEach((node) => {
      node.addEventListener('click', () => {
        const job = jobs.find((j) => j.id === node.dataset.jobId);
        if (job) openEditJob(job);
      });
    });
  }

  // ---- Calendar tab ----
  // Dispatches to one of the three calendar layouts below depending on
  // calMode, after building a shared jobsByDate lookup and conflict set
  // so each layout function doesn't have to recompute them.
  function renderCalendar() {
    modeBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === calMode));
    weekGrid.hidden = calMode !== 'week';
    dayAgenda.hidden = calMode !== 'day';
    monthGrid.hidden = calMode !== 'month';

    // The label next to the Prev/Next buttons, e.g. "Aug 17 – Aug 23" for
    // week mode or "August 2026" for month mode.
    if (calMode === 'day') calLabel.textContent = formatDate(calAnchor);
    else if (calMode === 'week') {
      const start = startOfWeekISO(calAnchor);
      calLabel.textContent = monthDay(start) + ' – ' + monthDay(addDaysISO(start, 6));
    } else {
      calLabel.textContent = monthYearLabel(calAnchor);
    }

    const aJobs = accountJobs();
    const conflictIds = computeConflictIds(aJobs);
    // Index jobs by their date string so each calendar cell can just do
    // jobsByDate.get(date) instead of filtering the whole jobs array
    // once per cell.
    const jobsByDate = new Map();
    aJobs.forEach((j) => {
      if (!jobsByDate.has(j.scheduled_for)) jobsByDate.set(j.scheduled_for, []);
      jobsByDate.get(j.scheduled_for).push(j);
    });
    const today = REPORTING.isoDate;

    if (calMode === 'week') renderWeekGrid(jobsByDate, conflictIds, today);
    if (calMode === 'day') renderDayAgenda(jobsByDate, conflictIds);
    if (calMode === 'month') renderMonthGrid(jobsByDate, conflictIds, today);
  }

  // Seven day-columns, Monday through Sunday, each listing that day's
  // jobs as small clickable cards, plus a "+" button to quick-add a job
  // pre-filled with that column's date.
  function renderWeekGrid(jobsByDate, conflictIds, today) {
    const start = startOfWeekISO(calAnchor);
    const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
    weekGrid.innerHTML = days.map((date) => {
      const dayJobs = jobsByDate.get(date) || [];
      const miniJobs = dayJobs.map((job) =>
        '<div class="mini-job ' + (conflictIds.has(job.id) ? 'is-conflict' : '') + '" data-job-id="' + job.id + '">' +
          escapeHtml(job.title) +
          '<div class="muted" style="font-size:.72rem">' + escapeHtml(clientName(job.client_id, clients)) + '</div>' +
        '</div>'
      ).join('') || '<span class="muted" style="font-size:.78rem">—</span>';
      return (
        '<div class="day-cell ' + (date === today ? 'is-today' : '') + '" data-date="' + date + '">' +
          '<div class="day-cell-header"><span>' + weekdayShort(date) + ' ' + monthDay(date) + '</span>' +
            '<button type="button" class="btn-ghost add-on-date" data-date="' + date + '" style="padding:2px 8px">+</button>' +
          '</div>' +
          '<div class="day-cell-jobs">' + miniJobs + '</div>' +
        '</div>'
      );
    }).join('');

    Array.from(weekGrid.querySelectorAll('.mini-job')).forEach((node) => {
      node.addEventListener('click', () => {
        const job = jobs.find((j) => j.id === node.dataset.jobId);
        if (job) openEditJob(job);
      });
    });
    Array.from(weekGrid.querySelectorAll('.add-on-date')).forEach((node) => {
      node.addEventListener('click', () => openNewJob(node.dataset.date));
    });
  }

  // A single day's jobs as a vertical list (like the Home sections, but
  // for whichever date calAnchor is currently pointing at). If there's
  // nothing scheduled, shows a prompt to add one on that date instead.
  function renderDayAgenda(jobsByDate, conflictIds) {
    const dayJobs = (jobsByDate.get(calAnchor) || []).slice().sort((a, b) => a.title.localeCompare(b.title));
    if (!dayJobs.length) {
      dayAgenda.innerHTML =
        '<div class="empty-state">Nothing scheduled for ' + formatDate(calAnchor) + '.' +
          '<div style="margin-top:10px"><button type="button" id="addOnAnchorBtn">Add a job on this date</button></div>' +
        '</div>';
      const btn = el('addOnAnchorBtn');
      if (btn) btn.addEventListener('click', () => openNewJob(calAnchor));
      return;
    }
    dayAgenda.innerHTML = dayJobs.map((job) =>
      '<div class="agenda-item" data-job-id="' + job.id + '">' +
        '<div><strong>' + escapeHtml(job.title) + '</strong>' +
          '<div class="muted">' + escapeHtml(clientName(job.client_id, clients)) + ' · ' + escapeHtml(assigneeLabel(job.assignee)) + '</div>' +
          (conflictIds.has(job.id) ? conflictFlagHtml() : '') +
        '</div>' + statusBadge(job.status) +
      '</div>'
    ).join('');
    Array.from(dayAgenda.querySelectorAll('.agenda-item')).forEach((node) => {
      node.addEventListener('click', () => {
        const job = jobs.find((j) => j.id === node.dataset.jobId);
        if (job) openEditJob(job);
      });
    });
  }

  // A traditional 6-week (42-cell) month grid. Cells outside the current
  // month are dimmed (`other-month`) but still shown, so the grid always
  // starts on a Monday and stays a clean rectangle. Each job becomes a
  // small dot (red if it's part of a conflict); clicking a cell jumps
  // straight into Day view for that date, which is handled by the
  // onJumpToDay-style logic right here in the click listener.
  function renderMonthGrid(jobsByDate, conflictIds, today) {
    const monthStart = startOfMonthISO(calAnchor);
    const gridStart = startOfWeekISO(monthStart);
    const cells = Array.from({ length: 42 }, (_, i) => addDaysISO(gridStart, i));
    monthGrid.innerHTML = cells.map((date) => {
      const dayJobs = jobsByDate.get(date) || [];
      const dots = dayJobs.map((job) =>
        '<span class="month-job-dot ' + (conflictIds.has(job.id) ? 'is-conflict' : '') + '" title="' + escapeHtml(job.title) + '"></span>'
      ).join('');
      const classes = ['month-cell'];
      if (date === today) classes.push('is-today');
      if (!isSameMonth(date, calAnchor)) classes.push('other-month');
      return (
        '<div class="' + classes.join(' ') + '" data-date="' + date + '">' +
          '<div class="month-cell-date">' + Number(date.slice(-2)) + '</div>' +
          '<div>' + dots + '</div>' +
        '</div>'
      );
    }).join('');
    Array.from(monthGrid.querySelectorAll('.month-cell')).forEach((node) => {
      node.addEventListener('click', () => {
        // Jump to Day view centered on the clicked date.
        calAnchor = node.dataset.date;
        calMode = 'day';
        renderAll();
      });
    });
  }

  // ---- Clients tab ----
  function renderClients() {
    const aClients = accountClients();
    const aJobs = accountJobs();
    if (!aClients.length) {
      clientList.innerHTML = '<div class="empty-state">No clients yet.</div>';
      return;
    }
    clientList.innerHTML = aClients.map((c) => {
      const jobCount = aJobs.filter((j) => j.client_id === c.id).length;
      return (
        '<div class="client-row" data-client-id="' + c.id + '">' +
          '<div><strong>' + escapeHtml(c.name) + '</strong><div class="muted">' + escapeHtml(c.city || 'No city on file') + '</div></div>' +
          '<div style="display:flex;align-items:center;gap:12px">' +
            '<span class="muted">' + jobCount + ' job' + (jobCount === 1 ? '' : 's') + '</span>' +
            '<button type="button" class="btn-ghost edit-client" data-client-id="' + c.id + '">Edit</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    Array.from(clientList.querySelectorAll('.edit-client')).forEach((node) => {
      node.addEventListener('click', () => {
        const c = clients.find((x) => x.id === node.dataset.clientId);
        if (c) openEditClient(c);
      });
    });
  }

  // ---------------------------------------------------------------
  // JOB MODAL
  // ---------------------------------------------------------------
  // The job modal is one popup reused for both creating and editing. The
  // `mode` field ('new' vs 'edit') controls small differences like
  // whether the Delete button shows, and whether Save adds a new job or
  // updates an existing one. `draft` holds the in-progress edited values
  // — nothing is written to the real `jobs` array until Save is clicked,
  // so Cancel/Escape can throw the draft away with no side effects.

  // Opens the modal in "new job" mode. `prefillDate`, when given (e.g.
  // from clicking a "+" on a calendar cell), pre-fills the date field so
  // you don't have to re-pick it.
  function openNewJob(prefillDate) {
    jobModal = {
      mode: 'new',
      draft: {
        client_id: (accountClients()[0] || {}).id || '',
        title: '',
        scheduled_for: prefillDate || REPORTING.isoDate,
        status: 'scheduled',
        assignee: TEAM_MEMBERS[0],
      },
    };
    renderAll();
  }

  // Opens the modal pre-filled with an existing job's values, for editing.
  // `originalId` is kept separately from `draft` so we know which job in
  // the array to update (or delete) when Save/Delete is clicked, even
  // though the draft's own `id` field isn't shown/edited in the form.
  function openEditJob(job) {
    jobModal = { mode: 'edit', originalId: job.id, draft: Object.assign({}, job) };
    renderAll();
  }

  function closeJobModal() { jobModal = null; renderAll(); }

  // Fills in every field of the job modal from the current draft, and
  // recomputes the live conflict warning. This runs on every keystroke
  // (via updateJobDraft), so the warning appears/disappears immediately
  // as you change the date or assignee — before you've even saved.
  function renderJobModal() {
    jobModalBackdrop.hidden = !jobModal;
    if (!jobModal) return;
    const { mode, draft } = jobModal;
    jobModalTitle.textContent = mode === 'new' ? 'New job' : 'Edit job';

    jobClientSel.innerHTML = accountClients().map((c) => '<option value="' + c.id + '">' + escapeHtml(c.name) + '</option>').join('');
    jobClientSel.value = draft.client_id;

    jobTitleInput.value = draft.title;
    jobDateInput.value = draft.scheduled_for;

    jobAssigneeSel.innerHTML = TEAM_MEMBERS.map((name) => '<option value="' + name + '">' + escapeHtml(name) + '</option>').join('');
    jobAssigneeSel.value = draft.assignee;

    jobStatusSel.innerHTML = STATUS_VALUES.map((s) => '<option value="' + s + '">' + STATUS_LABELS[s] + '</option>').join('');
    jobStatusSel.value = draft.status;

    deleteJobBtn.hidden = mode !== 'edit';

    // Live conflict check: would saving this draft as-is create a
    // same-assignee/same-date collision with some *other* job? We
    // exclude the job currently being edited (j.id !== jobModal.originalId)
    // so editing a job doesn't flag itself as conflicting with itself.
    const wouldConflict = jobs.some((j) =>
      j.id !== jobModal.originalId &&
      j.assignee === draft.assignee &&
      j.scheduled_for === draft.scheduled_for &&
      j.status !== 'cancelled'
    );
    jobConflictWarning.hidden = !wouldConflict;
    if (wouldConflict) {
      jobConflictWarning.textContent = '⚠ ' + draft.assignee + ' already has a job on ' + formatDate(draft.scheduled_for);
    }

    // Save is disabled until the required fields are actually filled in.
    saveJobBtn.disabled = !draft.title.trim() || !draft.client_id || !draft.scheduled_for;
  }

  // Merges a partial change (e.g. { title: 'new value' }) into the
  // current draft and re-renders the modal so the UI reflects it right
  // away. Every input in the job modal calls this on change/input.
  function updateJobDraft(patch) {
    if (!jobModal) return;
    jobModal.draft = Object.assign({}, jobModal.draft, patch);
    renderJobModal();
  }

  // Commits the draft to the real `jobs` array: pushes a brand-new job
  // (with a freshly generated id) in 'new' mode, or replaces the
  // matching job in place in 'edit' mode. Saves to localStorage and
  // closes the modal afterward.
  async function saveJob() {
    if (!jobModal) return;
    const { draft, mode, originalId } = jobModal;
    if (!draft.title.trim() || !draft.client_id || !draft.scheduled_for) return;
    if (mode === 'new') {
      const nextJob = Object.assign({ id: makeId('job'), account_id: ACCOUNT_ID }, draft, { title: draft.title.trim() });
      jobs.push(LIVE_MODE ? await createJob(nextJob) : nextJob);
    } else {
      if (LIVE_MODE) await updateJob(originalId, Object.assign({}, draft, { title: draft.title.trim() }));
      jobs = jobs.map((j) => (j.id === originalId ? Object.assign({}, j, draft, { title: draft.title.trim() }) : j));
    }
    persist();
    closeJobModal();
  }

  // Removes the job being edited from the `jobs` array entirely. Only
  // available in 'edit' mode (there's nothing to delete for a job that
  // hasn't been saved yet).
  async function deleteJob() {
    if (!jobModal || !jobModal.originalId) return;
    const id = jobModal.originalId;
    if (LIVE_MODE) await deleteLiveJob(id);
    jobs = jobs.filter((j) => j.id !== id);
    persist();
    closeJobModal();
  }

  // ---------------------------------------------------------------
  // CLIENT MODAL
  // ---------------------------------------------------------------
  // Mirrors the job modal's new/edit/draft pattern above, just for the
  // (much simpler) client record: name + city.

  function openNewClient() {
    clientModal = { mode: 'new', draft: { name: '', city: '' } };
    clientNotice = '';
    renderAll();
  }

  function openEditClient(client) {
    clientModal = { mode: 'edit', originalId: client.id, draft: { name: client.name, city: client.city } };
    clientNotice = '';
    renderAll();
  }

  function closeClientModal() { clientModal = null; clientNotice = ''; renderAll(); }

  function renderClientModal() {
    clientModalBackdrop.hidden = !clientModal;
    if (!clientModal) return;
    const { mode, draft } = clientModal;
    clientModalTitle.textContent = mode === 'new' ? 'New client' : 'Edit client';
    clientNameInput.value = draft.name;
    clientCityInput.value = draft.city;
    deleteClientBtn.hidden = mode !== 'edit';
    clientNoticeEl.hidden = !clientNotice;
    clientNoticeEl.textContent = clientNotice;
    saveClientBtn.disabled = !draft.name.trim();
  }

  function updateClientDraft(patch) {
    if (!clientModal) return;
    clientModal.draft = Object.assign({}, clientModal.draft, patch);
    renderClientModal();
  }

  async function saveClientFn() {
    if (!clientModal) return;
    const { draft, mode, originalId } = clientModal;
    if (!draft.name.trim()) return;
    const normalizedName = draft.name.trim().toLocaleLowerCase();
    const duplicate = accountClients().some((client) =>
      client.id !== originalId && client.name.trim().toLocaleLowerCase() === normalizedName
    );
    if (duplicate) {
      clientNotice = 'A client with this name already exists for this company.';
      renderClientModal();
      return;
    }
    if (mode === 'new') {
      const nextClient = { id: makeId('client'), account_id: ACCOUNT_ID, name: draft.name.trim(), city: draft.city.trim() };
      clients.push(LIVE_MODE ? await createFieldflowClient(nextClient) : nextClient);
    } else {
      if (LIVE_MODE) await updateClient(originalId, { name: draft.name.trim(), city: draft.city.trim() });
      clients = clients.map((c) => (c.id === originalId ? Object.assign({}, c, { name: draft.name.trim(), city: draft.city.trim() }) : c));
    }
    persist();
    closeClientModal();
  }

  // Deleting a client is guarded: if they still have jobs on the
  // schedule, we refuse and show an inline warning instead of silently
  // leaving those jobs pointing at a client_id that no longer exists.
  // (We use an inline message here rather than a browser confirm()/alert()
  // dialog, since those block the page and aren't reliable inside
  // embedded/sandboxed previews.)
  async function deleteClientFn() {
    if (!clientModal || !clientModal.originalId) return;
    const id = clientModal.originalId;
    const hasJobs = accountJobs().some((j) => j.client_id === id);
    if (hasJobs) {
      clientNotice = 'This client has jobs on the schedule — reassign or delete those jobs first.';
      renderClientModal();
      return;
    }
    if (LIVE_MODE) await deleteClient(id);
    clients = clients.filter((c) => c.id !== id);
    persist();
    closeClientModal();
  }

  // ---------------------------------------------------------------
  // EVENT WIRING (click-based, not native form submit — keeps this
  // reliable in sandboxed/embedded preview contexts too)
  // ---------------------------------------------------------------
  // Everything below just connects a DOM event to one of the functions
  // above. Buttons are type="button" and wired to click handlers instead
  // of relying on native <form> submission, and Enter/Escape are handled
  // manually via keydown on the modal card — this avoids relying on
  // form-submit events, which can behave inconsistently inside sandboxed
  // preview iframes.

  newJobBtn.addEventListener('click', () => openNewJob());
  newClientBtn.addEventListener('click', () => openNewClient());

  tabBtns.forEach((btn) => btn.addEventListener('click', () => { tab = btn.dataset.tab; renderAll(); }));
  modeBtns.forEach((btn) => btn.addEventListener('click', () => { calMode = btn.dataset.mode; renderAll(); }));

  calPrevBtn.addEventListener('click', () => { stepCalendar(-1); });
  calNextBtn.addEventListener('click', () => { stepCalendar(1); });
  calTodayBtn.addEventListener('click', () => { calAnchor = REPORTING.isoDate; renderAll(); });

  // Moves calAnchor forward/backward by however much makes sense for the
  // current layout: a day at a time in Day mode, a week at a time in
  // Week mode, a month at a time in Month mode.
  function stepCalendar(dir) {
    if (calMode === 'day') calAnchor = addDaysISO(calAnchor, dir);
    else if (calMode === 'week') calAnchor = addDaysISO(calAnchor, dir * 7);
    else calAnchor = addMonthsISO(calAnchor, dir);
    renderAll();
  }

  // Job modal field bindings — each one just patches the draft with
  // whatever the user typed/selected.
  jobClientSel.addEventListener('change', (e) => updateJobDraft({ client_id: e.target.value }));
  jobTitleInput.addEventListener('input', (e) => updateJobDraft({ title: e.target.value }));
  jobDateInput.addEventListener('change', (e) => updateJobDraft({ scheduled_for: e.target.value }));
  jobAssigneeSel.addEventListener('change', (e) => updateJobDraft({ assignee: e.target.value }));
  jobStatusSel.addEventListener('change', (e) => updateJobDraft({ status: e.target.value }));
  saveJobBtn.addEventListener('click', saveJob);
  deleteJobBtn.addEventListener('click', deleteJob);
  cancelJobBtn.addEventListener('click', closeJobModal);
  // Clicking the dimmed backdrop (but not the card itself) closes the
  // modal, like clicking "outside" a dialog normally does.
  jobModalBackdrop.addEventListener('click', (e) => { if (e.target === jobModalBackdrop) closeJobModal(); });
  jobModalCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); saveJob(); }
    if (e.key === 'Escape') closeJobModal();
  });

  // Client modal field bindings
  clientNameInput.addEventListener('input', (e) => updateClientDraft({ name: e.target.value }));
  clientCityInput.addEventListener('input', (e) => updateClientDraft({ city: e.target.value }));
  saveClientBtn.addEventListener('click', saveClientFn);
  deleteClientBtn.addEventListener('click', deleteClientFn);
  cancelClientBtn.addEventListener('click', closeClientModal);
  clientModalBackdrop.addEventListener('click', (e) => { if (e.target === clientModalBackdrop) closeClientModal(); });
  clientModalCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); saveClientFn(); }
    if (e.key === 'Escape') closeClientModal();
  });

  // ---------------------------------------------------------------
  // INIT
  // ---------------------------------------------------------------
  // Draw the initial screen once all the state, DOM refs, and event
  // listeners above are set up.
  renderAll();
})();

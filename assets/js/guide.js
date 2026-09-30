(() => {
	const apiUrl = 'guide-api.php';
	const state = { csrf: '', treks: [], activeId: '', definitions: {}, filter: 'all', query: '', expanded: new Set(['before', 'documents', 'safety']) };
	const $ = (selector) => document.querySelector(selector);
	const categoryList = $('#category-list');
	const escape = (value) => String(value ?? '');
	let toastTimer;

	function showStatus(message, error = false) {
		const status = $('#save-status');
		status.textContent = message;
		status.classList.toggle('is-error', error);
		status.classList.toggle('is-saved', !error && message === 'Saved');
	}

	function notify(message, error = false) {
		const toast = $('#toast');
		toast.textContent = message;
		toast.classList.toggle('is-error', error);
		toast.classList.add('is-visible');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
	}

	async function request(payload = null) {
		const options = payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, csrf: state.csrf }) } : {};
		const response = await fetch(apiUrl, options);
		const data = await response.json();
		if (!response.ok) throw new Error(data.error || 'The server could not complete that request.');
		return data;
	}

	function activeTrek() { return state.treks.find((trek) => trek.id === state.activeId); }

	function progress(tasks) {
		const done = tasks.filter((task) => task.done).length;
		return { done, total: tasks.length, percent: tasks.length ? Math.round(done / tasks.length * 100) : 0 };
	}

	function render() {
		const trek = activeTrek();
		const select = $('#trek-select');
		select.replaceChildren();
		if (!state.treks.length) {
			const option = document.createElement('option'); option.textContent = 'No treks created'; option.value = ''; select.append(option);
			$('#empty-state').hidden = false; $('#trek-content').hidden = true; $('#delete-trek-button').hidden = true;
			return;
		}
		state.treks.forEach((item) => {
			const option = document.createElement('option'); option.value = item.id; option.textContent = `${item.name} · ${item.destination}`; select.append(option);
		});
		if (!trek) { state.activeId = state.treks[0].id; render(); return; }
		select.value = trek.id;
		$('#empty-state').hidden = true; $('#trek-content').hidden = false; $('#delete-trek-button').hidden = false;
		$('#trip-title').textContent = trek.name;
		$('#trip-destination').textContent = trek.destination.toUpperCase();
		$('#trip-dates').textContent = `${formatDate(trek.startDate)} — ${formatDate(trek.endDate)}`;
		$('#trip-guests').textContent = `${trek.guests} ${Number(trek.guests) === 1 ? 'guest' : 'guests'}`;
		$('#trip-guide').textContent = trek.guide || 'Not assigned';
		$('#trip-assistant').textContent = trek.assistant || 'None';
		$('#trip-agency').textContent = trek.agency || 'Not set';
		$('#trip-status').textContent = statusLabel(trek.status);
		$('#trip-status').dataset.status = trek.status;
		$('#status-select').value = trek.status;
		const overall = progress(trek.tasks);
		$('#overall-progress').textContent = `${overall.percent}%`;
		$('#progress-count').textContent = `${overall.done} of ${overall.total} tasks complete`;
		$('#overall-progress-bar').style.width = `${overall.percent}%`;
		$('#general-notes').value = trek.notes || '';
		$('#emergency-notes').value = trek.emergencyNotes || '';
		$('#last-saved').textContent = formatSaved(trek.updatedAt);
		$('#download-link').href = `generate-txt.php?id=${encodeURIComponent(trek.id)}`;
		renderCategories(trek);
	}

	function formatDate(date) {
		if (!date) return 'Date not set';
		return new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
	}

	function formatSaved(value) {
		if (!value) return 'Not yet saved';
		return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
	}

	function statusLabel(status) { return ({ preparation: 'Preparation', 'in-progress': 'In progress', completed: 'Completed' })[status] || 'Preparation'; }

	function categoryGroups(trek) {
		const groups = Object.entries(state.definitions).map(([id, definition]) => ({ id, title: definition.title, tasks: [] }));
		trek.days.forEach((day) => groups.push({ id: day.id, title: `Daily Trek · ${formatDate(day.date)}`, tasks: [] }));
		const custom = { id: 'custom', title: 'Custom Tasks', tasks: [] };
		const byId = new Map(groups.map((group) => [group.id, group]));
		trek.tasks.forEach((task) => {
			const group = byId.get(task.category) || custom;
			group.tasks.push(task);
		});
		if (custom.tasks.length) groups.push(custom);
		return groups.filter((group) => group.tasks.length);
	}

	function renderCategories(trek) {
		categoryList.replaceChildren();
		const query = state.query.trim().toLowerCase();
		let visibleCount = 0;
		categoryGroups(trek).forEach((group) => {
			const matching = group.tasks.filter((task) => {
				const matchesFilter = state.filter === 'all' || (state.filter === 'completed' ? task.done : !task.done);
				return matchesFilter && (!query || `${task.title} ${task.note || ''} ${group.title}`.toLowerCase().includes(query));
			});
			if (!matching.length) return;
			visibleCount += matching.length;
			const card = document.createElement('section'); card.className = 'category-section';
			const details = document.createElement('details'); details.open = Boolean(query || state.filter !== 'all' || state.expanded.has(group.id));
			details.addEventListener('toggle', () => {
				if (details.open) state.expanded.add(group.id);
				else state.expanded.delete(group.id);
			});
			const summary = document.createElement('summary');
			const title = document.createElement('span'); title.className = 'category-title'; title.textContent = group.title;
			const count = document.createElement('span'); count.className = 'category-count'; count.textContent = `${group.tasks.filter((task) => task.done).length} / ${group.tasks.length}`;
			const bar = document.createElement('span'); bar.className = 'category-progress';
			const barFill = document.createElement('span'); const categoryProgress = progress(group.tasks); barFill.style.width = `${categoryProgress.percent}%`; bar.append(barFill);
			summary.append(title, count, bar);
			const body = document.createElement('div'); body.className = 'task-list';
			let currentPeriod = '';
			matching.forEach((task) => {
				if (task.period && task.period !== currentPeriod) {
					currentPeriod = task.period;
					const period = document.createElement('h3'); period.className = 'daily-period'; period.textContent = currentPeriod;
					body.append(period);
				}
				body.append(createTaskRow(task, group));
			});
			details.append(summary, body); card.append(details);
			if (group.id !== 'custom' && !group.id.startsWith('day-')) {
				const reset = document.createElement('button'); reset.className = 'category-reset'; reset.type = 'button'; reset.textContent = 'Reset'; reset.setAttribute('aria-label', `Reset ${group.title}`);
				reset.addEventListener('click', () => resetCategory(group)); summary.append(reset);
			}
			categoryList.append(card);
		});
		if (!visibleCount) {
			const empty = document.createElement('div'); empty.className = 'filter-empty';
			empty.textContent = trek.tasks.length ? 'No checklist items match this search or filter.' : 'Your checklist is empty. Add a task to get started.';
			categoryList.append(empty);
		}
	}

	function createTaskRow(task, group) {
		const row = document.createElement('article'); row.className = `task-row${task.done ? ' is-complete' : ''}`;
		const label = document.createElement('label'); label.className = 'task-label';
		const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = Boolean(task.done); checkbox.setAttribute('aria-label', task.title);
		const mark = document.createElement('span'); mark.className = 'task-check'; mark.setAttribute('aria-hidden', 'true');
		const title = document.createElement('span'); title.className = 'task-title'; title.textContent = task.title;
		label.append(checkbox, mark, title);
		const noteButton = document.createElement('button'); noteButton.className = 'note-toggle'; noteButton.type = 'button'; noteButton.textContent = task.note ? 'Edit note' : '+ Note';
		noteButton.setAttribute('aria-label', `${task.note ? 'Edit' : 'Add'} note for ${task.title}`);
		const noteWrap = document.createElement('div'); noteWrap.className = 'task-note-wrap'; noteWrap.hidden = true;
		const noteInput = document.createElement('textarea'); noteInput.rows = 2; noteInput.maxLength = 1000; noteInput.value = task.note || ''; noteInput.placeholder = 'Add a note for this checklist item…'; noteInput.setAttribute('aria-label', `Note for ${task.title}`);
		noteWrap.append(noteInput);
		const trekId = activeTrek().id;
		checkbox.addEventListener('change', () => updateTask(task, { done: checkbox.checked }, row, checkbox, trekId));
		noteButton.addEventListener('click', () => { noteWrap.hidden = !noteWrap.hidden; if (!noteWrap.hidden) noteInput.focus(); });
		let noteTimer;
		noteInput.addEventListener('input', () => {
			clearTimeout(noteTimer);
			const note = noteInput.value;
			noteTimer = setTimeout(() => updateTask(task, { note }, row, null, trekId), 500);
		});
		row.append(label, noteButton, noteWrap);
		if (task.note) noteWrap.hidden = true;
		return row;
	}

	async function updateTask(task, changes, row, checkbox, trekId) {
		const trek = state.treks.find((item) => item.id === trekId);
		if (!trek) return;
		const previous = { done: task.done, note: task.note };
		Object.assign(task, changes);
		if (checkbox) row.classList.toggle('is-complete', checkbox.checked);
		if (changes.done !== undefined) render();
		showStatus('Saving…');
		try {
			const result = await request({ action: 'task', trekId: trek.id, taskId: task.id, ...changes });
			const index = state.treks.findIndex((item) => item.id === trek.id);
			if (index >= 0) state.treks[index] = result.trek;
			if (changes.done !== undefined) render();
			else {
				row.querySelector('.note-toggle').textContent = changes.note ? 'Edit note' : '+ Note';
				if (state.activeId === trek.id) $('#last-saved').textContent = formatSaved(result.trek.updatedAt);
			}
			showStatus('Saved');
		} catch (error) {
			Object.assign(task, previous); showStatus('Save failed', true); notify(error.message, true); render();
		}
	}

	function replaceTrek(trek) {
		const index = state.treks.findIndex((item) => item.id === trek.id);
		if (index < 0) state.treks.unshift(trek); else state.treks[index] = trek;
		state.activeId = trek.id;
		render();
	}

	async function saveTrek(fields, trekId = activeTrek()?.id) {
		const trek = state.treks.find((item) => item.id === trekId); if (!trek) return;
		showStatus('Saving…');
		try {
			const result = await request({ action: 'update-trek', trekId: trek.id, ...fields });
			if (Object.hasOwn(fields, 'status')) replaceTrek(result.trek);
			else {
				const index = state.treks.findIndex((item) => item.id === trek.id);
				if (index >= 0) state.treks[index] = result.trek;
				if (state.activeId === trek.id) $('#last-saved').textContent = formatSaved(result.trek.updatedAt);
			}
			showStatus('Saved');
		}
		catch (error) { showStatus('Save failed', true); notify(error.message, true); }
	}

	async function resetCategory(group) {
		if (!window.confirm(`Mark every item in “${group.title}” as incomplete?`)) return;
		try { const result = await request({ action: 'reset-category', trekId: activeTrek().id, category: group.id }); replaceTrek(result.trek); showStatus('Saved'); }
		catch (error) { showStatus('Save failed', true); notify(error.message, true); }
	}

	function openDialog(dialog) { dialog.showModal(); }
	document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
	$('#new-trek-button').addEventListener('click', () => openDialog($('#new-trek-dialog')));
	$('#empty-new-trek').addEventListener('click', () => openDialog($('#new-trek-dialog')));
	$('#add-task-button').addEventListener('click', () => openDialog($('#add-task-dialog')));
	$('#add-day-button').addEventListener('click', () => openDialog($('#add-day-dialog')));
	$('#trek-select').addEventListener('change', (event) => { state.activeId = event.target.value; render(); showStatus('Ready'); });
	$('#task-search').addEventListener('input', (event) => { state.query = event.target.value; render(); });
	document.querySelectorAll('[data-filter]').forEach((button) => button.addEventListener('click', () => {
		state.filter = button.dataset.filter;
		document.querySelectorAll('[data-filter]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
		render();
	}));
	$('#status-select').addEventListener('change', (event) => saveTrek({ status: event.target.value }));
	$('#print-button').addEventListener('click', () => window.print());
	$('#reset-all-button').addEventListener('click', async () => {
		if (!window.confirm('Reset every checklist item in this trek? Notes will be kept.')) return;
		try { const result = await request({ action: 'reset-all', trekId: activeTrek().id }); replaceTrek(result.trek); showStatus('Saved'); }
		catch (error) { showStatus('Save failed', true); notify(error.message, true); }
	});
	$('#delete-trek-button').addEventListener('click', async () => {
		const trek = activeTrek();
		if (!window.confirm(`Permanently delete “${trek.name}” and its checklist?`)) return;
		try { await request({ action: 'delete', trekId: trek.id }); state.treks = state.treks.filter((item) => item.id !== trek.id); state.activeId = state.treks[0]?.id || ''; render(); showStatus('Trek deleted'); }
		catch (error) { showStatus('Delete failed', true); notify(error.message, true); }
	});

	$('#new-trek-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget; const submit = form.querySelector('[type="submit"]'); submit.disabled = true;
		const fields = Object.fromEntries(new FormData(form).entries()); fields.guests = Number(fields.guests);
		try { const result = await request({ action: 'create', ...fields }); state.treks.unshift(result.trek); state.activeId = result.trek.id; form.reset(); $('#new-trek-dialog').close(); render(); showStatus('Saved'); notify('Trek created with a full preparation checklist.'); }
		catch (error) { notify(error.message, true); }
		finally { submit.disabled = false; }
	});

	$('#add-task-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget; const fields = Object.fromEntries(new FormData(form).entries());
		try { const result = await request({ action: 'add-task', trekId: activeTrek().id, ...fields }); replaceTrek(result.trek); form.reset(); $('#add-task-dialog').close(); notify('Task added to this trek.'); showStatus('Saved'); }
		catch (error) { notify(error.message, true); }
	});

	$('#add-day-form').addEventListener('submit', async (event) => {
		event.preventDefault();
		const form = event.currentTarget;
		try { const result = await request({ action: 'add-day', trekId: activeTrek().id, date: new FormData(form).get('date') }); replaceTrek(result.trek); form.reset(); $('#add-day-dialog').close(); notify('Daily checklist created.'); showStatus('Saved'); }
		catch (error) { notify(error.message, true); }
	});

	let notesTimer;
	[['#general-notes', 'notes'], ['#emergency-notes', 'emergencyNotes']].forEach(([selector, field]) => {
		$(selector).addEventListener('input', (event) => {
			clearTimeout(notesTimer);
			const value = event.target.value;
			const trekId = state.activeId;
			notesTimer = setTimeout(() => saveTrek({ [field]: value }, trekId), 650);
		});
	});

	async function init() {
		try {
			const data = await request(); state.csrf = data.csrf; state.treks = data.treks || []; state.definitions = data.definitions || {};
			state.activeId = state.treks[0]?.id || ''; render(); showStatus(state.treks.length ? 'Ready' : 'No treks yet');
			const categorySelect = $('#task-category');
			Object.entries(state.definitions).forEach(([id, definition]) => { const option = document.createElement('option'); option.value = id; option.textContent = definition.title; categorySelect.append(option); });
			const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Custom Tasks'; categorySelect.append(custom);
		} catch (error) { showStatus('Unable to load', true); notify(error.message, true); }
	}

	init();
})();
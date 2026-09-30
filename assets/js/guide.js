(() => {
	const apiUrl = 'guide-api.php';
	const state = { csrf: '', treks: [], activeId: '', definitions: {}, filter: 'all', query: '', storageMode: 'server', expanded: new Set(['before', 'documents', 'safety']) };
	const $ = (selector) => document.querySelector(selector);
	const categoryList = $('#category-list');
	let toastTimer;
	const localKey = 'climbNepal.guideTreks.v1';
	const localDefinitions = {
		before: ['Before Trek', ['Confirm trek dates and guest count', 'Review guest list and emergency contacts', 'Check guest medical and allergy information', 'Confirm transportation and accommodation', 'Confirm route permits and registration requirements', 'Review route, itinerary and altitude profile', 'Check weather forecast and trail conditions', 'Check current trekking notices or restrictions', 'Confirm agency, local and emergency contacts', 'Review evacuation options and contingency plans', 'Confirm guest insurance information', 'Confirm communication method for the route']],
		documents: ['Documents & Permits', ['Check passport or ID information', 'Check required trekking permits', 'Check national park or conservation area permit', 'Check TIMS or applicable registration', 'Check guest insurance information', 'Prepare guest emergency contact list', 'Save accommodation confirmations', 'Save transportation confirmations', 'Prepare required guide and company documents', 'Back up digital document copies', 'Pack required physical document copies']],
		briefing: ['Guest Briefing', ['Introduce the guide and trekking team', 'Explain itinerary and expected daily schedule', 'Explain walking pace and group expectations', 'Explain altitude and acclimatization plan', 'Explain symptoms guests should report promptly', 'Explain hydration and meal arrangements', 'Explain clothing layers and appropriate footwear', 'Explain toilet and bathroom arrangements', 'Explain accommodation and drinking water arrangements', 'Explain charging and electricity availability', 'Explain communication limitations on the route', 'Explain emergency procedures and group rules', 'Explain environmental practices and local customs', 'Invite questions and confirm understanding']],
		packing_personal: ['Bag Packing · Guide Gear', ['Trekking boots', 'Trekking trousers and base layers', 'Fleece and warm jacket', 'Waterproof jacket and trousers', 'Gloves, hat and sunglasses', 'Headlamp and spare batteries', 'Sleeping bag if required', 'Water bottle and backpack', 'Duffel or porter bag if applicable']],
		packing_navigation: ['Bag Packing · Navigation & Comms', ['Phone and charging cables', 'Power bank', 'GPS or navigation device if used', 'Maps and compass if required', 'Satellite phone if required', 'Emergency communication device if available']],
		packing_safety: ['Bag Packing · First Aid & Safety', ['First-aid kit and required supplies', 'Basic wound-care supplies', 'Blister care supplies', 'Personal medications and required medical supplies', 'Emergency supplies and emergency blanket', 'Trek-appropriate rescue and safety equipment']],
		packing_documents: ['Bag Packing · Documents', ['Passport or ID copies', 'Permits and registrations', 'Insurance information', 'Guest list and emergency contacts', 'Accommodation and transportation details', 'Agency and local contact details']],
		packing_other: ['Bag Packing · Other', ['Cash', 'Trash bags', 'Water purification supplies if required', 'Notebook and pen', 'Camera if required', 'Spare batteries']],
		safety: ['Safety & Emergency', ['Keep emergency contact list available', 'Keep local emergency contacts available', 'Review evacuation options for the route', 'Identify nearest health facilities along the route', 'Check communication device and backup power', 'Check emergency equipment', 'Review current weather alerts and trail hazards', 'Confirm group location and check-in plan', 'Record incident information when required', 'Inform the agency when necessary']],
		end: ['End of Trek & Reporting', ['Confirm all guests completed the trek safely', 'Confirm guest transportation and final accommodation', 'Return rented equipment', 'Check and return agency equipment', 'Check guide equipment', 'Review outstanding payments and expenses', 'Record trek expenses', 'Collect guest feedback', 'Record incidents and follow-up actions', 'Complete trek report', 'Save important trek documents', 'Mark trek as completed']]
	};
	const localDailyTasks = {
		Morning: ['Check weather and route conditions', 'Check guest health and reported symptoms', 'Check water and breakfast arrangements', 'Confirm required gear and porter arrangements', 'Give morning briefing and confirm departure time', 'Count guests before departure'],
		'During Trek': ['Monitor group pace and condition', 'Check hydration and rest breaks', 'Check route and weather changes', 'Confirm lunch arrangement', 'Count guests regularly', 'Monitor altitude-related symptoms', 'Record important incidents'],
		Arrival: ['Count guests and confirm safe arrival', 'Check accommodation and room allocation', 'Confirm meals and check guest condition', 'Review next-day route and weather', 'Confirm next-day departure time', 'Prepare next-day requirements']
	};

	function showStatus(message, error = false) {
		if (!error && message === 'Saved' && state.storageMode === 'local') message = 'Saved on this device';
		const status = $('#save-status');
		status.textContent = message;
		status.classList.toggle('is-error', error);
		status.classList.toggle('is-saved', !error && message.startsWith('Saved'));
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
		if (state.storageMode === 'local') return localRequest(payload);
		const options = payload ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, csrf: state.csrf }) } : {};
		try {
			const response = await fetch(apiUrl, options);
			const data = await response.json();
			if (!response.ok) throw new Error(data.error || 'The server could not complete that request.');
			return data;
		} catch (error) {
			if (payload) throw error;
			state.storageMode = 'local';
			return localRequest(null);
		}
	}

	function localRead() {
		try { return JSON.parse(localStorage.getItem(localKey) || '[]'); }
		catch { throw new Error('This browser could not read its saved trek data.'); }
	}

	function localWrite(treks) {
		try { localStorage.setItem(localKey, JSON.stringify(treks)); }
		catch { throw new Error('This browser could not save data. Check available storage or privacy settings.'); }
	}

	function localDefaults() {
		return Object.entries(localDefinitions).flatMap(([category, [title, titles]]) => titles.map((task, index) => ({
			id: `${category}-${index}`, category, title: task, done: false, note: '', custom: false
		})));
	}

	function localRequest(payload) {
		const definitions = Object.fromEntries(Object.entries(localDefinitions).map(([id, [title, tasks]]) => [id, { title, tasks }]));
		if (!payload) {
			state.csrf = 'local-browser-storage';
			return Promise.resolve({ csrf: state.csrf, treks: localRead().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')), definitions });
		}
		const treks = localRead();
		let trek = treks.find((item) => item.id === payload.trekId);
		if (payload.action === 'create') {
			if (!payload.name?.trim() || !payload.destination?.trim() || !payload.startDate || !payload.endDate || payload.endDate < payload.startDate || !Number.isInteger(payload.guests) || payload.guests < 1) throw new Error('Enter a trek name, destination, valid dates, and a guest count of at least one.');
			const now = new Date().toISOString();
			trek = { id: crypto.randomUUID(), name: payload.name.trim(), destination: payload.destination.trim(), startDate: payload.startDate, endDate: payload.endDate, guests: payload.guests, guide: payload.guide || '', assistant: payload.assistant || '', agency: payload.agency || '', notes: payload.notes || '', emergencyNotes: '', status: 'preparation', tasks: localDefaults(), days: [], createdAt: now, updatedAt: now };
			treks.unshift(trek);
		} else {
			if (!trek) throw new Error('Trek not found in this browser.');
			if (payload.action === 'delete') {
				localWrite(treks.filter((item) => item.id !== trek.id));
				return Promise.resolve({ deleted: true });
			}
			if (payload.action === 'task') {
				const task = trek.tasks.find((item) => item.id === payload.taskId);
				if (!task) throw new Error('Checklist item not found.');
				if (Object.hasOwn(payload, 'done')) task.done = Boolean(payload.done);
				if (Object.hasOwn(payload, 'note')) task.note = String(payload.note).slice(0, 1000);
			} else if (payload.action === 'remove-task') {
				const index = trek.tasks.findIndex((item) => item.id === payload.taskId && item.custom);
				if (index < 0) throw new Error('Custom task not found.');
				trek.tasks.splice(index, 1);
			} else if (payload.action === 'add-task') {
				if (!payload.title?.trim() || !(payload.category in localDefinitions || payload.category === 'custom')) throw new Error('Choose a category and enter a task name.');
				trek.tasks.push({ id: `custom-${crypto.randomUUID()}`, category: payload.category, title: payload.title.trim().slice(0, 160), done: false, note: payload.note || '', custom: true });
			} else if (payload.action === 'add-day') {
				if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Choose a valid day date.');
				if (trek.days.some((day) => day.date === payload.date)) throw new Error('A daily checklist already exists for this date.');
				const dayId = `day-${payload.date.replaceAll('-', '')}`;
				trek.days.push({ id: dayId, date: payload.date });
				Object.entries(localDailyTasks).forEach(([period, titles]) => titles.forEach((title, index) => trek.tasks.push({ id: `${dayId}-${period}-${index}`, category: dayId, period, title, done: false, note: '', custom: false })));
			} else if (payload.action === 'update-trek') {
				['name', 'destination', 'guide', 'assistant', 'agency', 'notes', 'emergencyNotes'].forEach((key) => { if (Object.hasOwn(payload, key)) trek[key] = String(payload[key]).slice(0, key === 'notes' || key === 'emergencyNotes' ? 3000 : 120); });
				if (['preparation', 'in-progress', 'completed'].includes(payload.status)) trek.status = payload.status;
			} else if (payload.action === 'reset-category' || payload.action === 'reset-all') {
				trek.tasks.forEach((task) => { if (payload.action === 'reset-all' || task.category === payload.category) { task.done = false; if (payload.clearNotes) task.note = ''; } });
				if (payload.action === 'reset-all') trek.status = 'preparation';
			} else throw new Error('Unknown checklist action.');
			trek.updatedAt = new Date().toISOString();
		}
		localWrite(treks);
		return Promise.resolve({ trek });
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
		$('#download-link').href = state.storageMode === 'local' ? '#' : `generate-txt.php?id=${encodeURIComponent(trek.id)}`;
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

	function downloadChecklist() {
		const trek = activeTrek();
		if (!trek) return;
		const groups = categoryGroups(trek);
		const lines = ['# ========================================', `${trek.name.toUpperCase()} GUIDE CHECKLIST`,
			`Destination: ${trek.destination}`, `Guide: ${trek.guide || 'Not assigned'}`, `Guests: ${trek.guests}`,
			`Start Date: ${trek.startDate}`, `End Date: ${trek.endDate}`, `Status: ${statusLabel(trek.status)}`, ''];
		groups.forEach((group) => {
			lines.push(`## ${group.title.toUpperCase()}`);
			let period = '';
			group.tasks.forEach((task) => {
				if (task.period && task.period !== period) { period = task.period; lines.push(`  ${period.toUpperCase()}`); }
				lines.push(`[${task.done ? '✓' : ' '}] ${task.title}`);
				if (task.note) lines.push(`    Note: ${task.note.replace(/\s+/g, ' ').trim()}`);
			});
			lines.push('');
		});
		if (trek.notes) lines.push(`TREK NOTES: ${trek.notes.replace(/\s+/g, ' ').trim()}`);
		if (trek.emergencyNotes) lines.push(`EMERGENCY NOTES: ${trek.emergencyNotes.replace(/\s+/g, ' ').trim()}`);
		const done = trek.tasks.filter((task) => task.done).length;
		const percent = trek.tasks.length ? Math.round(done / trek.tasks.length * 100) : 0;
		lines.push(`# ======================================== Progress: ${percent}%`);
		const link = $('#download-link');
		if (link.dataset.generatedUrl) URL.revokeObjectURL(link.dataset.generatedUrl);
		const filename = `${trek.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-checklist.txt`;
		const url = URL.createObjectURL(new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/plain;charset=utf-8' }));
		link.href = url; link.download = filename; link.dataset.generatedUrl = url;
	}

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
		let removeButton;
		if (task.custom) {
			removeButton = document.createElement('button'); removeButton.className = 'task-remove'; removeButton.type = 'button'; removeButton.textContent = 'Remove';
			removeButton.setAttribute('aria-label', `Remove custom task ${task.title}`);
			removeButton.addEventListener('click', () => removeCustomTask(task));
		}
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
		row.append(label, noteButton);
		if (removeButton) row.append(removeButton);
		row.append(noteWrap);
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

	async function removeCustomTask(task) {
		if (!window.confirm(`Remove custom task “${task.title}”?`)) return;
		try {
			const result = await request({ action: 'remove-task', trekId: activeTrek().id, taskId: task.id });
			replaceTrek(result.trek); showStatus('Saved');
		} catch (error) { showStatus('Save failed', true); notify(error.message, true); }
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
	$('#download-link').addEventListener('click', () => downloadChecklist());
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
			state.activeId = state.treks[0]?.id || ''; render();
			showStatus(state.storageMode === 'local' ? (state.treks.length ? 'Saved on this device' : 'Local storage ready') : (state.treks.length ? 'Ready' : 'No treks yet'));
			const categorySelect = $('#task-category');
			Object.entries(state.definitions).forEach(([id, definition]) => { const option = document.createElement('option'); option.value = id; option.textContent = definition.title; categorySelect.append(option); });
			const custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = 'Custom Tasks'; categorySelect.append(custom);
		} catch (error) { showStatus('Unable to load', true); notify(error.message, true); }
	}

	init();
})();
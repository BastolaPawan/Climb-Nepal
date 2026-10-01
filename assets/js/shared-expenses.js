(function (global) {
  'use strict';

  const STORAGE_KEY = 'climbNepal.sharedExpenses.v1';
  const DEFAULT_CATEGORIES = ['Hotel', 'Food', 'Transportation', 'Permit', 'Equipment', 'Guide', 'Porter', 'Shopping', 'Other'];
  const state = {
    groups: [],
    selectedGroupId: null,
    activeTab: 'overview',
    editingExpenseId: null,
    editingMemberId: null,
    editingSettlementId: null
  };

  function safeNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function normalizeMoney(value) {
    return Math.round((safeNumber(value) || 0) * 100);
  }

  function addMoney(a, b) {
    return Math.round((safeNumber(a) || 0) + (safeNumber(b) || 0));
  }

  function subtractMoney(a, b) {
    return Math.round((safeNumber(a) || 0) - (safeNumber(b) || 0));
  }

  function compareMoney(a, b) {
    const first = Number(safeNumber(a) || 0);
    const second = Number(safeNumber(b) || 0);
    if (first < second) return -1;
    if (first > second) return 1;
    return 0;
  }

  function roundMoney(value) {
    return Math.round((safeNumber(value) || 0));
  }

  function formatMoney(value) {
    const amount = Number(safeNumber(value) || 0) / 100;
    const sign = amount < 0 ? '-' : '';
    const absolute = Math.abs(amount);
    const formatted = absolute.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${sign}Rs. ${formatted}`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value + 'T12:00:00');
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  }

  function createId(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  }

  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function escapeHtml(string) {
    return String(string ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function loadData() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) {
        state.groups = [createDemoGroup()];
        state.selectedGroupId = state.groups[0].id;
        saveData();
        return;
      }
      state.groups = JSON.parse(raw);
      if (!Array.isArray(state.groups) || !state.groups.length) {
        state.groups = [createDemoGroup()];
      }
      state.selectedGroupId = state.groups[0].id;
    } catch (error) {
      console.error('Unable to load shared expense data', error);
      state.groups = [createDemoGroup()];
      state.selectedGroupId = state.groups[0].id;
      saveData();
    }
  }

  function saveData() {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.groups));
    }
  }

  function createDemoGroup() {
    const groupId = createId('group');
    const members = [
      { id: createId('member'), name: 'Ram', phone: '', email: '', active: true },
      { id: createId('member'), name: 'Shyam', phone: '', email: '', active: true },
      { id: createId('member'), name: 'Hari', phone: '', email: '', active: true }
    ];

    const hotelExpense = {
      id: createId('expense'),
      description: 'Hotel',
      amountCents: 600000,
      date: '2026-10-01',
      paidBy: members[0].id,
      category: 'Hotel',
      notes: 'Guest lodge and room charges.',
      participants: members.map((member) => member.id),
      splitMethod: 'equal',
      shares: {}
    };

    const foodExpense = {
      id: createId('expense'),
      description: 'Food',
      amountCents: 300000,
      date: '2026-10-02',
      paidBy: members[1].id,
      category: 'Food',
      notes: 'Group dinner and breakfast.',
      participants: members.map((member) => member.id),
      splitMethod: 'equal',
      shares: {}
    };

    const taxiExpense = {
      id: createId('expense'),
      description: 'Taxi',
      amountCents: 150000,
      date: '2026-10-03',
      paidBy: members[2].id,
      category: 'Transportation',
      notes: 'Airport transfer.',
      participants: members.map((member) => member.id),
      splitMethod: 'equal',
      shares: {}
    };

    return {
      id: groupId,
      name: 'ABC Trek',
      description: 'Trek expenses and shared trip costs.',
      currency: 'NPR',
      createdAt: '2026-10-01',
      members,
      expenses: [hotelExpense, foodExpense, taxiExpense],
      settlements: []
    };
  }

  function getSelectedGroup() {
    return state.groups.find((group) => group.id === state.selectedGroupId) || null;
  }

  function getActiveMembers(group) {
    return (group.members || []).filter((member) => member.active !== false);
  }

  function getMemberName(group, memberId) {
    const member = (group.members || []).find((item) => item.id === memberId);
    return member ? member.name : 'Unknown member';
  }

  function sumAmounts(items, key) {
    return items.reduce((total, item) => total + (Number(item[key]) || 0), 0);
  }

  function calculateExpenseShares(expense, group) {
    const participantIds = Array.isArray(expense.participants) ? expense.participants.filter(Boolean) : [];
    if (!participantIds.length) return {};

    const total = Number(expense.amountCents || 0);
    const shares = {};

    if (expense.splitMethod === 'equal') {
      const shareAmount = Math.floor(total / participantIds.length);
      const remainder = total % participantIds.length;
      participantIds.forEach((memberId, index) => {
        shares[memberId] = shareAmount + (index < remainder ? 1 : 0);
      });
      return shares;
    }

    if (expense.splitMethod === 'exact') {
      const exactValues = expense.shares || {};
      participantIds.forEach((memberId) => {
        shares[memberId] = normalizeMoney(exactValues[memberId] || 0);
      });
      return shares;
    }

    if (expense.splitMethod === 'percentage') {
      const percentageValues = expense.shares || {};
      const totalPercent = participantIds.reduce((acc, memberId) => acc + (safeNumber(percentageValues[memberId]) || 0), 0);
      const percentTotal = totalPercent > 0 ? totalPercent : 100;
      let runningTotal = 0;
      participantIds.forEach((memberId) => {
        const percentage = safeNumber(percentageValues[memberId]) || 0;
        const amount = Math.floor((total * percentage) / percentTotal);
        shares[memberId] = amount;
        runningTotal += amount;
      });
      let remainder = total - runningTotal;
      participantIds.forEach((memberId) => {
        if (remainder === 0) return;
        const percentage = safeNumber(percentageValues[memberId]) || 0;
        if (percentage > 0 && remainder > 0) {
          shares[memberId] += 1;
          remainder -= 1;
        }
      });
      if (remainder > 0) {
        shares[participantIds[0]] = (shares[participantIds[0]] || 0) + remainder;
      }
      return shares;
    }

    return {};
  }

  function validateExpense(group, expenseInput) {
    const amountCents = normalizeMoney(expenseInput.amount);
    if (amountCents <= 0) {
      throw new Error('Expense amount must be greater than zero.');
    }

    const paidBy = expenseInput.paidBy;
    const members = getActiveMembers(group);
    if (!members.some((member) => member.id === paidBy)) {
      throw new Error('The payer must be an active member of the group.');
    }

    const participants = (expenseInput.participants || []).filter(Boolean);
    if (!participants.length) {
      throw new Error('Select at least one participant for the expense.');
    }

    const uniqueParticipants = [...new Set(participants)];
    const unknownMembers = uniqueParticipants.filter((memberId) => !members.some((member) => member.id === memberId));
    if (unknownMembers.length) {
      throw new Error('One or more selected participants are no longer active.');
    }

    const splitMethod = expenseInput.splitMethod;
    if (splitMethod === 'equal') {
      return { ok: true, amountCents };
    }

    if (splitMethod === 'exact') {
      const shareMap = expenseInput.shares || {};
      const totalShares = uniqueParticipants.reduce((sum, memberId) => sum + normalizeMoney(shareMap[memberId] || 0), 0);
      if (totalShares !== amountCents) {
        throw new Error('Exact split amounts must total the full expense amount.');
      }
      return { ok: true, amountCents };
    }

    if (splitMethod === 'percentage') {
      const shareMap = expenseInput.shares || {};
      const totalPercent = uniqueParticipants.reduce((sum, memberId) => sum + safeNumber(shareMap[memberId] || 0), 0);
      if (Math.abs(totalPercent - 100) > 0.01) {
        throw new Error('Percentage split values must total 100%.');
      }
      return { ok: true, amountCents };
    }

    throw new Error('Choose a valid split method.');
  }

  function buildExpenseFromForm(group, formData, id) {
    const participants = Array.from(formData.getAll('participants[]'));
    const splitMethod = formData.get('splitMethod');
    const shareMap = {};

    if (splitMethod === 'exact') {
      participants.forEach((memberId) => {
        shareMap[memberId] = normalizeMoney(formData.get(`exact-${memberId}`) || 0);
      });
    }

    if (splitMethod === 'percentage') {
      participants.forEach((memberId) => {
        shareMap[memberId] = safeNumber(formData.get(`percent-${memberId}`) || 0);
      });
    }

    return {
      id: id || createId('expense'),
      description: String(formData.get('description') || '').trim(),
      amountCents: normalizeMoney(formData.get('amount') || 0),
      date: String(formData.get('date') || '').trim(),
      paidBy: String(formData.get('paidBy') || '').trim(),
      category: String(formData.get('category') || 'Other').trim() || 'Other',
      notes: String(formData.get('notes') || '').trim(),
      participants,
      splitMethod,
      shares: shareMap
    };
  }

  function recalculateGroupTotals(group) {
    const expenses = group.expenses || [];
    const settlements = group.settlements || [];
    const totalExpenses = expenses.reduce((sum, expense) => sum + (Number(expense.amountCents) || 0), 0);
    const totalSettlements = settlements.reduce((sum, settlement) => sum + (Number(settlement.amountCents) || 0), 0);
    return { totalExpenses, totalSettlements };
  }

  function calculateBalancesFromExpenses(group) {
    const balances = {};
    (group.members || []).forEach((member) => {
      balances[member.id] = 0;
    });

    (group.expenses || []).forEach((expense) => {
      const paidBy = expense.paidBy;
      const shares = calculateExpenseShares(expense, group);
      if (balances[paidBy] !== undefined) balances[paidBy] += Number(expense.amountCents || 0);
      Object.entries(shares).forEach(([memberId, shareAmount]) => {
        if (balances[memberId] !== undefined) balances[memberId] -= Number(shareAmount || 0);
      });
    });

    return balances;
  }

  function calculateFinalBalances(group) {
    const balances = calculateBalancesFromExpenses(group);
    (group.settlements || []).forEach((settlement) => {
      if (balances[settlement.from] !== undefined) balances[settlement.from] += Number(settlement.amountCents || 0);
      if (balances[settlement.to] !== undefined) balances[settlement.to] -= Number(settlement.amountCents || 0);
    });
    return balances;
  }

  function calculateSettlementSuggestions(group) {
    const balances = calculateBalancesFromExpenses(group);
    const positive = Object.entries(balances)
      .filter(([, value]) => value > 0)
      .map(([memberId, value]) => ({ memberId, amount: value }))
      .sort((a, b) => b.amount - a.amount);

    const negative = Object.entries(balances)
      .filter(([, value]) => value < 0)
      .map(([memberId, value]) => ({ memberId, amount: Math.abs(value) }))
      .sort((a, b) => b.amount - a.amount);

    const suggestions = [];
    let creditIndex = 0;
    let debtorIndex = 0;

    while (creditIndex < positive.length && debtorIndex < negative.length) {
      const creditor = positive[creditIndex];
      const debtor = negative[debtorIndex];
      const transfer = Math.min(creditor.amount, debtor.amount);
      if (transfer <= 0) break;
      suggestions.push({
        from: debtor.memberId,
        to: creditor.memberId,
        amount: transfer
      });
      creditor.amount -= transfer;
      debtor.amount -= transfer;
      if (creditor.amount <= 0) creditIndex += 1;
      if (debtor.amount <= 0) debtorIndex += 1;
    }

    return suggestions;
  }

  function validateGroupIntegrity(group) {
    const allMembers = getActiveMembers(group);
    const totalExpenseShares = (group.expenses || []).reduce((sum, expense) => {
      const shares = calculateExpenseShares(expense, group);
      return sum + Object.values(shares).reduce((innerSum, amount) => innerSum + Number(amount || 0), 0);
    }, 0);
    const totalExpenses = (group.expenses || []).reduce((sum, expense) => sum + Number(expense.amountCents || 0), 0);
    const finalBalances = calculateFinalBalances(group);
    const zeroSum = Object.values(finalBalances).reduce((sum, balance) => sum + Number(balance || 0), 0);

    return {
      ok: totalExpenseShares === totalExpenses && Math.abs(zeroSum) < 1,
      totalExpenseShares,
      totalExpenses,
      zeroSum,
      activeMembers: allMembers.length,
      balanceSummary: finalBalances
    };
  }

  function createSettlementFromSuggestion(suggestion) {
    return {
      id: createId('settlement'),
      from: suggestion.from,
      to: suggestion.to,
      amountCents: Number(suggestion.amount || 0),
      date: new Date().toISOString().slice(0, 10),
      note: 'Suggested settlement'
    };
  }

  function renderApp() {
    const app = document.getElementById('shared-expense-app');
    if (!app) return;

    const groupList = state.groups.map((group) => {
      const totals = recalculateGroupTotals(group);
      const memberCount = getActiveMembers(group).length;
      const selectedClass = state.selectedGroupId === group.id ? 'is-selected' : '';
      return `
        <div class="sxp-group-card ${selectedClass}" data-group-id="${group.id}">
          <div class="sxp-group-card-head">
            <div>
              <h4>${escapeHtml(group.name)}</h4>
              <p>${escapeHtml(group.description || 'No description')}</p>
            </div>
            <span class="sxp-badge ${group.members && group.members.some((member) => member.active === false) ? 'is-inactive' : ''}">${memberCount} mem</span>
          </div>
          <div class="sxp-group-meta">
            <span>${memberCount} members</span>
            <span>${(group.expenses || []).length} expenses</span>
          </div>
          <div class="sxp-group-total">Total expenses: ${formatMoney(totals.totalExpenses)}</div>
        </div>
      `;
    }).join('');

    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      app.innerHTML = `
        <div class="sxp-page">
          <div class="sxp-empty-state">
            <h3>No shared expense groups yet</h3>
            <p>Create one to start tracking group costs and settlements.</p>
            <div class="sxp-actions">
              <button class="sxp-button" data-action="create-group">Create group</button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    const groupTotals = recalculateGroupTotals(selectedGroup);
    const groupBalances = calculateFinalBalances(selectedGroup);
    const settlementSuggestions = calculateSettlementSuggestions(selectedGroup);
    const balanceEntries = Object.entries(groupBalances)
      .map(([memberId, balance]) => ({ memberId, balance, name: getMemberName(selectedGroup, memberId) }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const whoOwes = balanceEntries.filter((entry) => entry.balance < 0)
      .map((entry) => `
        <div class="sxp-row-item">
          <div class="info">
            <strong>${escapeHtml(entry.name)}</strong>
            <span class="meta">Should pay</span>
          </div>
          <span class="sxp-balance-negative">${formatMoney(entry.balance)}</span>
        </div>
      `).join('') || '<div class="sxp-note">No one owes anything right now.</div>';

    const whoReceives = balanceEntries.filter((entry) => entry.balance > 0)
      .map((entry) => `
        <div class="sxp-row-item">
          <div class="info">
            <strong>${escapeHtml(entry.name)}</strong>
            <span class="meta">Should receive</span>
          </div>
          <span class="sxp-balance-positive">${formatMoney(entry.balance)}</span>
        </div>
      `).join('') || '<div class="sxp-note">No one is owed any money right now.</div>';

    const overviewTab = `
      <div class="sxp-summary-grid">
        <div class="sxp-stat-card">
          <span class="label">Total expenses</span>
          <span class="value">${formatMoney(groupTotals.totalExpenses)}</span>
        </div>
        <div class="sxp-stat-card">
          <span class="label">Total settlements</span>
          <span class="value">${formatMoney(groupTotals.totalSettlements)}</span>
        </div>
        <div class="sxp-stat-card">
          <span class="label">Members</span>
          <span class="value">${getActiveMembers(selectedGroup).length}</span>
        </div>
        <div class="sxp-stat-card">
          <span class="label">Amount unsettled</span>
          <span class="value">${formatMoney(balanceEntries.reduce((sum, entry) => sum + Math.abs(entry.balance), 0) / 2)}</span>
        </div>
      </div>
      <div class="sxp-overview-grid" style="margin-top: 1rem;">
        <div class="sxp-panel">
          <h3>Who owes</h3>
          <div class="sxp-row-list">${whoOwes}</div>
        </div>
        <div class="sxp-panel">
          <h3>Who should receive</h3>
          <div class="sxp-row-list">${whoReceives}</div>
        </div>
      </div>
      <div class="sxp-panel" style="margin-top:1rem;">
        <h3>Suggested settlements</h3>
        ${settlementSuggestions.length ? `
          <div class="sxp-row-list">
            ${settlementSuggestions.map((settlement) => `
              <div class="sxp-row-item">
                <div class="info">
                  <strong>${escapeHtml(getMemberName(selectedGroup, settlement.from))} → ${escapeHtml(getMemberName(selectedGroup, settlement.to))}</strong>
                  <span class="meta">Suggested transfer</span>
                </div>
                <span class="sxp-balance-positive">${formatMoney(settlement.amount)}</span>
              </div>
            `).join('')}
          </div>
          <div class="sxp-actions">
            <button class="sxp-button" data-action="apply-suggestions">Record suggested settlements</button>
          </div>
        ` : '<div class="sxp-note">All balances are already settled.</div>'}
      </div>
    `;

    const membersContents = getActiveMembers(selectedGroup).map((member) => `
      <div class="sxp-member-item">
        <div class="info">
          <strong>${escapeHtml(member.name)}</strong>
          <span class="meta">${member.email || member.phone || 'No contact info'}</span>
        </div>
        <div class="sxp-actions">
          <button class="sxp-button-ghost" data-action="edit-member" data-member-id="${member.id}">Edit</button>
          <button class="sxp-button-danger" data-action="remove-member" data-member-id="${member.id}">Remove</button>
        </div>
      </div>
    `).join('') || '<div class="sxp-note">No active members. Add one to begin.</div>';

    const membersTab = `
      <div class="sxp-grid-2">
        <div class="sxp-panel">
          <h3>Members</h3>
          <div class="sxp-member-list">${membersContents}</div>
        </div>
        <div class="sxp-panel">
          <h3>${state.editingMemberId ? 'Edit member' : 'Add member'}</h3>
          <form id="member-form" class="sxp-form-grid">
            <input type="hidden" name="memberId" value="${state.editingMemberId || ''}">
            <div class="sxp-form-field sxp-full">
              <label for="member-name">Member name</label>
              <input id="member-name" name="name" type="text" value="${escapeHtml(getMemberFormValue(state.editingMemberId, selectedGroup, 'name'))}" placeholder="Ram" required>
            </div>
            <div class="sxp-form-field">
              <label for="member-phone">Phone</label>
              <input id="member-phone" name="phone" type="text" value="${escapeHtml(getMemberFormValue(state.editingMemberId, selectedGroup, 'phone'))}" placeholder="Optional">
            </div>
            <div class="sxp-form-field">
              <label for="member-email">Email</label>
              <input id="member-email" name="email" type="email" value="${escapeHtml(getMemberFormValue(state.editingMemberId, selectedGroup, 'email'))}" placeholder="Optional">
            </div>
            <div class="sxp-actions">
              <button class="sxp-button" type="submit">${state.editingMemberId ? 'Update member' : 'Add member'}</button>
              ${state.editingMemberId ? '<button type="button" class="sxp-button-ghost" data-action="cancel-member-edit">Cancel</button>' : ''}
            </div>
          </form>
        </div>
      </div>
    `;

    const expenseRows = [...(selectedGroup.expenses || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((expense) => {
      const shares = calculateExpenseShares(expense, selectedGroup);
      const participantSummary = (expense.participants || []).map((memberId) => getMemberName(selectedGroup, memberId)).join(', ') || 'No members';
      const shareSummary = Object.entries(shares).map(([memberId, amount]) => `${getMemberName(selectedGroup, memberId)}: ${formatMoney(amount)}`).join(', ');
      return `
        <div class="sxp-expense-item">
          <div class="info">
            <strong>${escapeHtml(expense.description)}</strong>
            <span class="meta">${formatDate(expense.date)} · Paid by ${escapeHtml(getMemberName(selectedGroup, expense.paidBy))}</span>
            <span class="meta">${escapeHtml(participantSummary)} · ${escapeHtml(expense.splitMethod)}</span>
            <span class="meta">${escapeHtml(shareSummary)}</span>
          </div>
          <div class="sxp-actions">
            <span class="sxp-badge">${formatMoney(expense.amountCents)}</span>
            <button class="sxp-button-ghost" data-action="edit-expense" data-expense-id="${expense.id}">Edit</button>
            <button class="sxp-button-danger" data-action="delete-expense" data-expense-id="${expense.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('') || '<div class="sxp-note">No expenses recorded yet.</div>';

    const expenseTab = `
      <div class="sxp-grid-2">
        <div class="sxp-panel">
          <h3>Expense history</h3>
          <div class="sxp-expense-list">${expenseRows}</div>
        </div>
        <div class="sxp-panel">
          <h3>${state.editingExpenseId ? 'Edit expense' : 'Add expense'}</h3>
          <form id="expense-form" class="sxp-form-grid">
            <input type="hidden" name="expenseId" value="${state.editingExpenseId || ''}">
            <div class="sxp-form-field">
              <label for="expense-description">Description</label>
              <input id="expense-description" name="description" type="text" value="${escapeHtml(getExpenseFormValue(state.editingExpenseId, selectedGroup, 'description'))}" required>
            </div>
            <div class="sxp-form-field">
              <label for="expense-amount">Amount</label>
              <input id="expense-amount" name="amount" type="number" step="0.01" min="0.01" value="${escapeHtml(getExpenseFormValue(state.editingExpenseId, selectedGroup, 'amount'))}" required>
            </div>
            <div class="sxp-form-field">
              <label for="expense-date">Date</label>
              <input id="expense-date" name="date" type="date" value="${escapeHtml(getExpenseFormValue(state.editingExpenseId, selectedGroup, 'date'))}" required>
            </div>
            <div class="sxp-form-field">
              <label for="expense-paidby">Paid by</label>
              <select id="expense-paidby" name="paidBy">
                ${getActiveMembers(selectedGroup).map((member) => `<option value="${member.id}" ${getExpenseFormValue(state.editingExpenseId, selectedGroup, 'paidBy') === member.id ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}
              </select>
            </div>
            <div class="sxp-form-field">
              <label for="expense-category">Category</label>
              <input id="expense-category" name="category" type="text" list="expense-category-list" value="${escapeHtml(getExpenseFormValue(state.editingExpenseId, selectedGroup, 'category')) || 'Other'}" required>
              <datalist id="expense-category-list">${DEFAULT_CATEGORIES.map((category) => `<option value="${category}"></option>`).join('')}</datalist>
            </div>
            <div class="sxp-form-field sxp-full">
              <label for="expense-notes">Notes</label>
              <textarea id="expense-notes" name="notes">${escapeHtml(getExpenseFormValue(state.editingExpenseId, selectedGroup, 'notes'))}</textarea>
            </div>
            <div class="sxp-form-field sxp-full">
              <span class="label">Shared with</span>
              <div class="sxp-participant-list">
                ${getActiveMembers(selectedGroup).map((member) => {
                  const selectedExpense = state.editingExpenseId ? (selectedGroup.expenses || []).find((item) => item.id === state.editingExpenseId) : null;
                  const checked = (selectedExpense?.participants || []).includes(member.id) ? 'checked' : '';
                  return `
                    <label class="sxp-checkbox-item">
                      <input type="checkbox" name="participants[]" value="${member.id}" ${checked}>
                      <span>${escapeHtml(member.name)}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
            <div class="sxp-form-field sxp-full">
              <label for="expense-split-method">Split method</label>
              <select id="expense-split-method" name="splitMethod">
                <option value="equal" ${getExpenseFormValue(state.editingExpenseId, selectedGroup, 'splitMethod') === 'equal' || !state.editingExpenseId ? 'selected' : ''}>Equal split</option>
                <option value="exact" ${getExpenseFormValue(state.editingExpenseId, selectedGroup, 'splitMethod') === 'exact' ? 'selected' : ''}>Exact amount</option>
                <option value="percentage" ${getExpenseFormValue(state.editingExpenseId, selectedGroup, 'splitMethod') === 'percentage' ? 'selected' : ''}>Percentage</option>
              </select>
            </div>
            <div id="split-editor-container" class="sxp-full"></div>
            <div class="sxp-actions sxp-full">
              <button class="sxp-button" type="submit">${state.editingExpenseId ? 'Update expense' : 'Add expense'}</button>
              ${state.editingExpenseId ? '<button class="sxp-button-ghost" type="button" data-action="cancel-expense-edit">Cancel</button>' : ''}
            </div>
          </form>
        </div>
      </div>
    `;

    const balancesRows = balanceEntries.map((entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${entry.balance === 0 ? '—' : entry.balance > 0 ? formatMoney(entry.balance) : formatMoney(entry.balance)}</td>
        <td class="${entry.balance > 0 ? 'sxp-balance-positive' : entry.balance < 0 ? 'sxp-balance-negative' : 'sxp-balance-zero'}">
          ${entry.balance > 0 ? 'Should receive' : entry.balance < 0 ? 'Should pay' : 'Settled'}
        </td>
      </tr>
    `).join('');

    const balancesTab = `
      <div class="sxp-panel">
        <h3>Member balances</h3>
        <table class="sxp-balance-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${balancesRows}</tbody>
        </table>
      </div>
    `;

    const settlements = [...(selectedGroup.settlements || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((settlement) => `
      <div class="sxp-settlement-item">
        <div class="info">
          <strong>${escapeHtml(getMemberName(selectedGroup, settlement.from))} → ${escapeHtml(getMemberName(selectedGroup, settlement.to))}</strong>
          <span class="meta">${formatDate(settlement.date)}${settlement.note ? ` · ${escapeHtml(settlement.note)}` : ''}</span>
        </div>
        <div class="sxp-actions">
          <span class="sxp-badge">${formatMoney(settlement.amountCents)}</span>
          <button class="sxp-button-ghost" data-action="edit-settlement" data-settlement-id="${settlement.id}">Edit</button>
          <button class="sxp-button-danger" data-action="delete-settlement" data-settlement-id="${settlement.id}">Delete</button>
        </div>
      </div>
    `).join('') || '<div class="sxp-note">No settlements recorded yet.</div>';

    const settlementsTab = `
      <div class="sxp-grid-2">
        <div class="sxp-panel">
          <h3>Settlement history</h3>
          <div class="sxp-settlement-list">${settlements}</div>
        </div>
        <div class="sxp-panel">
          <h3>${state.editingSettlementId ? 'Edit settlement' : 'Record settlement'}</h3>
          <form id="settlement-form" class="sxp-form-grid">
            <input type="hidden" name="settlementId" value="${state.editingSettlementId || ''}">
            <div class="sxp-form-field">
              <label for="settlement-from">From</label>
              <select id="settlement-from" name="from">
                ${getActiveMembers(selectedGroup).map((member) => `<option value="${member.id}" ${getSettlementFormValue(state.editingSettlementId, selectedGroup, 'from') === member.id ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}
              </select>
            </div>
            <div class="sxp-form-field">
              <label for="settlement-to">To</label>
              <select id="settlement-to" name="to">
                ${getActiveMembers(selectedGroup).map((member) => `<option value="${member.id}" ${getSettlementFormValue(state.editingSettlementId, selectedGroup, 'to') === member.id ? 'selected' : ''}>${escapeHtml(member.name)}</option>`).join('')}
              </select>
            </div>
            <div class="sxp-form-field">
              <label for="settlement-amount">Amount</label>
              <input id="settlement-amount" name="amount" type="number" step="0.01" min="0.01" value="${escapeHtml(getSettlementFormValue(state.editingSettlementId, selectedGroup, 'amount'))}" required>
            </div>
            <div class="sxp-form-field">
              <label for="settlement-date">Date</label>
              <input id="settlement-date" name="date" type="date" value="${escapeHtml(getSettlementFormValue(state.editingSettlementId, selectedGroup, 'date')) || new Date().toISOString().slice(0, 10)}" required>
            </div>
            <div class="sxp-form-field sxp-full">
              <label for="settlement-note">Note</label>
              <textarea id="settlement-note" name="note">${escapeHtml(getSettlementFormValue(state.editingSettlementId, selectedGroup, 'note'))}</textarea>
            </div>
            <div class="sxp-actions sxp-full">
              <button class="sxp-button" type="submit">${state.editingSettlementId ? 'Update settlement' : 'Record settlement'}</button>
              ${state.editingSettlementId ? '<button class="sxp-button-ghost" type="button" data-action="cancel-settlement-edit">Cancel</button>' : ''}
            </div>
          </form>
        </div>
      </div>
    `;

    const activeTabContent = {
      overview: overviewTab,
      expenses: expenseTab,
      members: membersTab,
      balances: balancesTab,
      settlements: settlementsTab
    }[state.activeTab] || overviewTab;

    app.innerHTML = `
      <div class="sxp-page">
        <div class="sxp-header">
          <div>
            <p class="eyebrow">Shared expenses</p>
            <h2>Track group spending and balances</h2>
            <p class="sxp-page-copy">Create a trip, add members, log expenses, and settle balances without manual accounting.</p>
          </div>
          <div class="sxp-toolbar">
            <button class="sxp-button-secondary" data-action="create-group">New group</button>
            <button class="sxp-button-ghost" data-action="load-demo">Load demo data</button>
          </div>
        </div>
        <div class="sxp-layout">
          <aside class="sxp-sidebar">
            <div class="sxp-sidebar-header">
              <h3>Groups</h3>
              <button class="sxp-button" data-action="create-group">+ Add</button>
            </div>
            <div class="sxp-group-list">${groupList}</div>
          </aside>
          <main class="sxp-main">
            <div class="sxp-group-header">
              <div>
                <p class="eyebrow">Group</p>
                <h3>${escapeHtml(selectedGroup.name)}</h3>
                <p>${escapeHtml(selectedGroup.description || 'No description')}</p>
              </div>
              <div class="sxp-metrics">
                <div class="sxp-metric-box"><span>Members</span><strong>${getActiveMembers(selectedGroup).length}</strong></div>
                <div class="sxp-metric-box"><span>Expenses</span><strong>${(selectedGroup.expenses || []).length}</strong></div>
                <div class="sxp-metric-box"><span>Balance</span><strong>${formatMoney(balanceEntries.reduce((sum, entry) => sum + Number(entry.balance || 0), 0))}</strong></div>
              </div>
            </div>
            <div class="sxp-tabs">
              ${['overview', 'expenses', 'members', 'balances', 'settlements'].map((tab) => `
                <button class="sxp-tab ${state.activeTab === tab ? 'is-active' : ''}" type="button" data-tab="${tab}">${tab.charAt(0).toUpperCase() + tab.slice(1)}</button>
              `).join('')}
            </div>
            ${activeTabContent}
          </main>
        </div>
      </div>
    `;

    const splitEditorContainer = document.getElementById('split-editor-container');
    if (splitEditorContainer) {
      splitEditorContainer.innerHTML = renderExpenseSplitEditor(selectedGroup, state.editingExpenseId);
    }

    if (document.getElementById('expense-form')) {
      const expenseForm = document.getElementById('expense-form');
      expenseForm.addEventListener('submit', handleExpenseSubmit);
      expenseForm.querySelectorAll('input[name="participants[]"]').forEach((checkbox) => {
        checkbox.addEventListener('change', renderExpenseSplitEditorFromForm);
      });
      const splitMethod = expenseForm.querySelector('select[name="splitMethod"]');
      if (splitMethod) splitMethod.addEventListener('change', renderExpenseSplitEditorFromForm);
    }

    document.querySelectorAll('[data-group-id]').forEach((card) => {
      card.addEventListener('click', (event) => {
        const groupId = event.currentTarget.getAttribute('data-group-id');
        if (groupId) {
          state.selectedGroupId = groupId;
          state.activeTab = 'overview';
          saveData();
          renderApp();
        }
      });
    });

    document.querySelectorAll('[data-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        const action = event.currentTarget.getAttribute('data-action');
        handleAction(action, event.currentTarget);
      });
    });

    const memberForm = document.getElementById('member-form');
    if (memberForm) {
      memberForm.addEventListener('submit', handleMemberSubmit);
    }

    const settlementForm = document.getElementById('settlement-form');
    if (settlementForm) {
      settlementForm.addEventListener('submit', handleSettlementSubmit);
    }

    document.querySelectorAll('.sxp-tab').forEach((tabButton) => {
      tabButton.addEventListener('click', () => {
        state.activeTab = tabButton.getAttribute('data-tab');
        renderApp();
      });
    });
  }

  function renderExpenseSplitEditorFromForm() {
    const form = document.getElementById('expense-form');
    if (!form) return;
    const group = getSelectedGroup();
    const selectedMembers = Array.from(form.querySelectorAll('input[name="participants[]"]:checked')).map((checkbox) => checkbox.value);
    const splitMethod = form.querySelector('select[name="splitMethod"]').value;
    const container = document.getElementById('split-editor-container');
    if (!container) return;
    container.innerHTML = renderSplitRows(group, selectedMembers, splitMethod, state.editingExpenseId);
  }

  function renderExpenseSplitEditor(group, editingExpenseId) {
    if (!group) return '';
    const form = document.getElementById('expense-form');
    if (!form) return '';
    const selectedMembers = Array.from(form.querySelectorAll('input[name="participants[]"]:checked')).map((checkbox) => checkbox.value);
    const splitMethod = form.querySelector('select[name="splitMethod"]').value;
    return renderSplitRows(group, selectedMembers, splitMethod, editingExpenseId);
  }

  function renderSplitRows(group, participantIds, splitMethod, editingExpenseId) {
    const editingExpense = (group.expenses || []).find((expense) => expense.id === editingExpenseId) || null;
    const sharesMap = editingExpense?.shares || {};

    if (!participantIds.length) {
      return '<div class="sxp-note">Select at least one shared member to configure the split.</div>';
    }

    if (splitMethod === 'equal') {
      return '<div class="sxp-note">Equal split will divide the total amount equally among the selected people.</div>';
    }

    if (splitMethod === 'exact') {
      return `
        <div class="sxp-split-list">
          ${participantIds.map((memberId) => {
            const member = (group.members || []).find((item) => item.id === memberId);
            const value = Number(sharesMap[memberId] || 0) / 100;
            return `
              <div class="sxp-split-row">
                <div class="sxp-form-field">
                  <label>${escapeHtml(member?.name || 'Member')}</label>
                  <input type="number" step="0.01" min="0" name="exact-${memberId}" value="${value.toFixed(2)}" required>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (splitMethod === 'percentage') {
      return `
        <div class="sxp-split-list">
          ${participantIds.map((memberId) => {
            const member = (group.members || []).find((item) => item.id === memberId);
            const value = Number(sharesMap[memberId] || 0);
            return `
              <div class="sxp-split-row">
                <div class="sxp-form-field">
                  <label>${escapeHtml(member?.name || 'Member')}</label>
                  <input type="number" step="1" min="0" max="100" name="percent-${memberId}" value="${value}" required>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return '';
  }

  function getMemberFormValue(memberId, group, field) {
    if (!memberId) return '';
    const member = (group.members || []).find((item) => item.id === memberId);
    return member ? (member[field] || '') : '';
  }

  function getExpenseFormValue(expenseId, group, field) {
    if (!expenseId) return '';
    const expense = (group.expenses || []).find((item) => item.id === expenseId);
    if (!expense) return '';
    if (field === 'amount') return Number((expense.amountCents || 0) / 100).toFixed(2);
    if (field === 'splitMethod') return expense.splitMethod || 'equal';
    if (field === 'paidBy') return expense.paidBy || '';
    if (field === 'date') return expense.date || '';
    if (field === 'category') return expense.category || 'Other';
    return expense[field] || '';
  }

  function getSettlementFormValue(settlementId, group, field) {
    if (!settlementId) return '';
    const settlement = (group.settlements || []).find((item) => item.id === settlementId);
    if (!settlement) return '';
    if (field === 'amount') return Number((settlement.amountCents || 0) / 100).toFixed(2);
    return settlement[field] || '';
  }

  function handleAction(action, button) {
    const group = getSelectedGroup();
    if (!group && action !== 'create-group') return;

    switch (action) {
      case 'create-group': {
        const groupName = window.prompt('Group name', `Trip ${state.groups.length + 1}`);
        if (!groupName || !groupName.trim()) return;
        const newGroup = {
          id: createId('group'),
          name: groupName.trim(),
          description: 'New shared expense group',
          currency: 'NPR',
          createdAt: new Date().toISOString().slice(0, 10),
          members: [],
          expenses: [],
          settlements: []
        };
        state.groups.unshift(newGroup);
        state.selectedGroupId = newGroup.id;
        state.activeTab = 'members';
        saveData();
        renderApp();
        break;
      }
      case 'load-demo': {
        state.groups = [createDemoGroup()];
        state.selectedGroupId = state.groups[0].id;
        state.activeTab = 'overview';
        saveData();
        renderApp();
        break;
      }
      case 'apply-suggestions': {
        const suggestions = calculateSettlementSuggestions(group);
        if (!suggestions.length) return;
        const additions = suggestions.map(createSettlementFromSuggestion);
        group.settlements = [...(group.settlements || []), ...additions];
        state.activeTab = 'settlements';
        saveData();
        renderApp();
        break;
      }
      case 'edit-member': {
        state.editingMemberId = button.getAttribute('data-member-id');
        renderApp();
        break;
      }
      case 'cancel-member-edit': {
        state.editingMemberId = null;
        renderApp();
        break;
      }
      case 'remove-member': {
        const memberId = button.getAttribute('data-member-id');
        if (!memberId) return;
        const member = (group.members || []).find((item) => item.id === memberId);
        if (!member) return;
        const hasHistory = (group.expenses || []).some((expense) => expense.paidBy === memberId || expense.participants.includes(memberId)) || (group.settlements || []).some((settlement) => settlement.from === memberId || settlement.to === memberId);
        if (hasHistory) {
          member.active = false;
        } else {
          group.members = (group.members || []).filter((item) => item.id !== memberId);
        }
        saveData();
        renderApp();
        break;
      }
      case 'edit-expense': {
        state.editingExpenseId = button.getAttribute('data-expense-id');
        state.activeTab = 'expenses';
        renderApp();
        break;
      }
      case 'cancel-expense-edit': {
        state.editingExpenseId = null;
        renderApp();
        break;
      }
      case 'delete-expense': {
        const expenseId = button.getAttribute('data-expense-id');
        if (!expenseId) return;
        group.expenses = (group.expenses || []).filter((expense) => expense.id !== expenseId);
        if (state.editingExpenseId === expenseId) state.editingExpenseId = null;
        saveData();
        renderApp();
        break;
      }
      case 'edit-settlement': {
        state.editingSettlementId = button.getAttribute('data-settlement-id');
        state.activeTab = 'settlements';
        renderApp();
        break;
      }
      case 'cancel-settlement-edit': {
        state.editingSettlementId = null;
        renderApp();
        break;
      }
      case 'delete-settlement': {
        const settlementId = button.getAttribute('data-settlement-id');
        if (!settlementId) return;
        group.settlements = (group.settlements || []).filter((settlement) => settlement.id !== settlementId);
        if (state.editingSettlementId === settlementId) state.editingSettlementId = null;
        saveData();
        renderApp();
        break;
      }
      default:
        break;
    }
  }

  function handleMemberSubmit(event) {
    event.preventDefault();
    const group = getSelectedGroup();
    if (!group) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const memberName = String(formData.get('name') || '').trim();
    const phone = String(formData.get('phone') || '').trim();
    const email = String(formData.get('email') || '').trim();
    if (!memberName) {
      window.alert('Member name is required.');
      return;
    }
    const existingMember = (group.members || []).find((member) => member.name.toLowerCase() === memberName.toLowerCase() && member.id !== formData.get('memberId'));
    if (existingMember) {
      window.alert('A member with that name already exists in this group.');
      return;
    }

    if (state.editingMemberId) {
      const member = (group.members || []).find((item) => item.id === state.editingMemberId);
      if (member) {
        member.name = memberName;
        member.phone = phone;
        member.email = email;
      }
    } else {
      group.members.push({
        id: createId('member'),
        name: memberName,
        phone,
        email,
        active: true
      });
    }
    state.editingMemberId = null;
    saveData();
    renderApp();
  }

  function handleExpenseSubmit(event) {
    event.preventDefault();
    const group = getSelectedGroup();
    if (!group) return;

    const formData = new FormData(event.currentTarget);
    const selectedMembers = Array.from(formData.getAll('participants[]'));
    const splitMethod = String(formData.get('splitMethod') || 'equal');
    const rawExpense = {
      description: String(formData.get('description') || '').trim(),
      amount: String(formData.get('amount') || '0'),
      date: String(formData.get('date') || '').trim(),
      paidBy: String(formData.get('paidBy') || '').trim(),
      category: String(formData.get('category') || 'Other').trim(),
      notes: String(formData.get('notes') || '').trim(),
      participants: selectedMembers,
      splitMethod,
      shares: {}
    };

    if (!rawExpense.description) {
      window.alert('Expense description is required.');
      return;
    }

    if (splitMethod === 'exact') {
      rawExpense.shares = {};
      selectedMembers.forEach((memberId) => {
        rawExpense.shares[memberId] = Number(formData.get(`exact-${memberId}`) || 0);
      });
    }

    if (splitMethod === 'percentage') {
      rawExpense.shares = {};
      selectedMembers.forEach((memberId) => {
        rawExpense.shares[memberId] = Number(formData.get(`percent-${memberId}`) || 0);
      });
    }

    validateExpense(group, rawExpense);

    const editExpense = state.editingExpenseId ? (group.expenses || []).find((expense) => expense.id === state.editingExpenseId) : null;
    if (editExpense) {
      Object.assign(editExpense, rawExpense, {
        amountCents: normalizeMoney(rawExpense.amount),
        shares: rawExpense.shares || {}
      });
    } else {
      group.expenses.push({
        id: createId('expense'),
        ...rawExpense,
        amountCents: normalizeMoney(rawExpense.amount),
        shares: rawExpense.shares || {}
      });
    }

    state.editingExpenseId = null;
    saveData();
    renderApp();
  }

  function handleSettlementSubmit(event) {
    event.preventDefault();
    const group = getSelectedGroup();
    if (!group) return;

    const formData = new FormData(event.currentTarget);
    const from = String(formData.get('from') || '').trim();
    const to = String(formData.get('to') || '').trim();
    const amountValue = String(formData.get('amount') || '0');
    const amountCents = normalizeMoney(amountValue);
    const date = String(formData.get('date') || '').trim();
    const note = String(formData.get('note') || '').trim();

    if (!from || !to || from === to) {
      window.alert('Choose a valid sender and receiver.');
      return;
    }

    if (amountCents <= 0) {
      window.alert('Settlement amount must be greater than zero.');
      return;
    }

    const balances = calculateFinalBalances(group);
    const senderBalance = balances[from] || 0;
    if (senderBalance >= 0) {
      window.alert('The sender must have a negative outstanding balance before recording a settlement.');
      return;
    }

    if (Math.abs(senderBalance) < amountCents) {
      window.alert('Settlement amount cannot exceed the outstanding balance of the sender.');
      return;
    }

    const settlement = {
      id: state.editingSettlementId || createId('settlement'),
      from,
      to,
      amountCents,
      date: date || new Date().toISOString().slice(0, 10),
      note
    };

    if (state.editingSettlementId) {
      const match = (group.settlements || []).find((item) => item.id === state.editingSettlementId);
      if (match) Object.assign(match, settlement);
    } else {
      group.settlements.push(settlement);
    }

    state.editingSettlementId = null;
    saveData();
    renderApp();
  }

  function initialize() {
    loadData();
    renderApp();
    document.addEventListener('click', (event) => {
      const tabButton = event.target.closest('[data-tab]');
      if (tabButton) {
        state.activeTab = tabButton.getAttribute('data-tab');
        renderApp();
      }
    });
  }

  const exported = {
    state,
    calculateExpenseShares,
    calculateBalancesFromExpenses,
    calculateFinalBalances,
    calculateSettlementSuggestions,
    validateExpense,
    formatMoney,
    normalizeMoney,
    createDemoGroup,
    validateGroupIntegrity
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  }

  if (typeof global !== 'undefined') {
    global.SharedExpensesApp = exported;
  }

  if (typeof document !== 'undefined') {
    initialize();
  }
})(typeof window !== 'undefined' ? window : globalThis);

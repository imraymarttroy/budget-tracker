/* Dashboard "Overview" tab: money health at a glance.
   Income vs expenses trend (with alerts), recent expenses, debts (utang) and savings goals.
   Uses window.BT (entries, money maths) and window.SOC (accounts, debts, goals). No Firebase code here. */
window.OVERVIEW = (function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const LIMIT_SHARE = 0.8; /* 50% needs + 30% wants: spending above this eats into savings. */
  const KIND_ICONS = {
    emergency: '<path d="M10 2.5 16.5 5v4.5c0 4-2.8 6.9-6.5 8-3.7-1.1-6.5-4-6.5-8V5z"/><path d="M10 7v5M7.5 9.5h5"/>',
    travel: '<path d="M2.5 11.5 17.5 5l-3 10-4-3.5-3 3v-4z"/><path d="m10.5 11.5 7-6.5"/>',
    education: '<path d="m2 7.5 8-4 8 4-8 4z"/><path d="M5.5 9.3V13c0 1.2 2 2.5 4.5 2.5s4.5-1.3 4.5-2.5V9.3M18 7.5V12"/>',
    house: '<path d="M3 9.5 10 3.5l7 6"/><path d="M5 8v8.5h10V8M8.5 16.5v-4.5h3v4.5"/>',
    vehicle: '<path d="M3 13.5v-3l2-4.5h10l2 4.5v3z"/><circle cx="6.5" cy="14.5" r="1.5"/><circle cx="13.5" cy="14.5" r="1.5"/><path d="M3 10.5h14"/>',
    gadget: '<rect x="5.5" y="2.5" width="9" height="15" rx="2"/><path d="M9 14.5h2"/>',
    wedding: '<circle cx="7.5" cy="11.5" r="4.5"/><circle cx="12.5" cy="11.5" r="4.5"/><path d="m8.5 3.5 1.5 2 1.5-2"/>',
    business: '<rect x="2.5" y="6.5" width="15" height="10" rx="1.5"/><path d="M7.5 6.5v-2h5v2M2.5 11h15"/>',
    retirement: '<circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l3 2"/>',
    other: '<path d="M4 8.5c0-2.5 2.5-4.5 6-4.5s6 2 6 4.5v3c0 1.5-1 2.5-2.5 3l.5 2.5h-2.5l-.5-1.5H9l-.5 1.5H6l.5-2.5C5 14 4 13 4 11.5z"/><circle cx="12.5" cy="8.5" r=".6" fill="currentColor"/>'
  };

  function hiddenAmounts() { try { return localStorage.getItem('pbh.hideAmounts') === '1'; } catch (e) { return false; } }

  function svg(tag, attrs) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function daysInMonth(month) {
    return new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
  }
  function shortMonth(month) {
    return new Date(+month.slice(0, 4), +month.slice(5, 7) - 1, 1).toLocaleDateString(I18N.locale, { month: 'short' });
  }
  function daysBetween(from, to) {
    const a = BT.parseDate(from), b = BT.parseDate(to);
    if (!a || !b) return null;
    return Math.round((new Date(b.y, b.m - 1, b.d) - new Date(a.y, a.m - 1, a.d)) / 86400000);
  }
  function monthsBetween(from, to) {
    const d = daysBetween(from, to);
    return d === null ? null : d / 30.44;
  }

  /** Totals per month for the months given (oldest first). Expenses = needs + wants. */
  function monthly(txs, months) {
    const index = {};
    const rows = months.map(function (m, i) { index[m] = i; return { month: m, income: 0, needs: 0, wants: 0, savings: 0, expenses: 0 }; });
    txs.forEach(function (t) {
      const i = index[BT.monthOf(t.date)];
      if (i === undefined) return;
      rows[i][t.type] += t.cents;
      if (t.type === 'needs' || t.type === 'wants') rows[i].expenses += t.cents;
    });
    return rows;
  }

  function lastMonths(count, end) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) out.push(BT.addMonths(end, -i));
    return out;
  }

  /**
   * Builds the Overview. ctx: { h, icon, ask, toast, book, onCleanup(fn), openTab(name) }.
   * Returns { el, refresh() }; refresh() redraws after entries change.
   */
  function render(ctx) {
    const h = ctx.h, icon = ctx.icon, book = ctx.book;
    const owner = book.mine ? null : book.owner.id;
    const money = function (cents) { return BT.formatMoney(cents, book.currency); };
    const compact = new Intl.NumberFormat(I18N.locale, { style: 'currency', currency: book.currency, notation: 'compact', maximumFractionDigits: 1 });
    const show = function (cents) { return hiddenAmounts() ? '••••••' : money(cents); };
    const data = { accounts: null, debts: null, goals: null, debtError: null, goalError: null };
    let range = 6;
    let debtDir = 'owe';

    const el = h('div', { class: 'ov' });
    const healthBox = h('div');
    const kpiBox = h('div', { class: 'ov-kpis' });
    const chartBox = h('div', { class: 'ov-card ov-chart-card' });
    const recentBox = h('section', { class: 'ov-card', 'aria-labelledby': 'ov-recent-h' });
    const debtBox = h('section', { class: 'ov-card', 'aria-labelledby': 'ov-debt-h' });
    const goalBox = h('section', { class: 'ov-card ov-goals-card', 'aria-labelledby': 'ov-goal-h' });
    el.append(healthBox, kpiBox, chartBox, h('div', { class: 'ov-split' }, recentBox, debtBox), goalBox);

    /* ---- Live data ---- */
    const stops = [
      SOC.watchAccounts(owner, function (list) { data.accounts = list; draw(); }, function () { data.accounts = []; draw(); }),
      SOC.watchDebts(owner, function (list) { data.debts = list; data.debtError = null; draw(); }, function (e) { data.debts = []; data.debtError = e.message; draw(); }),
      SOC.watchGoals(owner, function (list) { data.goals = list; data.goalError = null; draw(); }, function (e) { data.goals = []; data.goalError = e.message; draw(); })
    ];
    ctx.onCleanup(function () { stops.forEach(function (s) { s(); }); if (resizer) resizer.disconnect(); });

    /* ---- Numbers ---- */
    function compute() {
      const today = BT.today();
      const thisMonth = BT.monthOf(today);
      const txs = book.list();
      const months = lastMonths(12, thisMonth);
      const rows = monthly(txs, months);
      const cur = rows[11], prev = rows[10];
      const day = +today.slice(8, 10), dim = daysInMonth(thisMonth);
      const projected = day >= 5 ? Math.round(cur.expenses / day * dim) : null;
      /* Last month up to the same day, so a half-finished month is compared fairly. */
      const prevMonth = BT.addMonths(thisMonth, -1);
      const prevToDate = { income: 0, expenses: 0 };
      txs.forEach(function (t) {
        if (BT.monthOf(t.date) !== prevMonth || +t.date.slice(8, 10) > day) return;
        if (t.type === 'income') prevToDate.income += t.cents;
        if (t.type === 'needs' || t.type === 'wants') prevToDate.expenses += t.cents;
      });
      /* Average needs over the last 3 finished months that have entries: the "essential expenses" for the emergency fund. */
      const done = rows.slice(8, 11).filter(function (r) { return r.needs > 0 || r.wants > 0; });
      const avgNeeds = done.length ? Math.round(done.reduce(function (t, r) { return t + r.needs; }, 0) / done.length) : cur.needs;
      const avgExpenses = done.length ? Math.round(done.reduce(function (t, r) { return t + r.expenses; }, 0) / done.length) : cur.expenses;
      const accounts = data.accounts || [];
      const sumType = function (type) { return accounts.filter(function (a) { return a.type === type; }).reduce(function (t, a) { return t + a.cents; }, 0); };
      const cash = sumType('wallet') + sumType('savings');
      const bankOwed = sumType('credit') + sumType('loan');
      const debts = data.debts || [];
      const left = function (d) { return Math.max(0, d.cents - (d.paidCents || 0)); };
      const iOwe = debts.filter(function (d) { return d.dir === 'owe'; }).reduce(function (t, d) { return t + left(d); }, 0);
      const owedMe = debts.filter(function (d) { return d.dir === 'lent'; }).reduce(function (t, d) { return t + left(d); }, 0);
      const overdue = debts.filter(function (d) { return d.dir === 'owe' && left(d) > 0 && d.due && d.due < today; });
      return {
        today: today, month: thisMonth, rows: rows, cur: cur, prev: prev, prevToDate: prevToDate, day: day, dim: dim, projected: projected,
        avgNeeds: avgNeeds, avgExpenses: avgExpenses, cash: cash, bankOwed: bankOwed, iOwe: iOwe, owedMe: owedMe, overdue: overdue,
        netWorth: cash + owedMe - bankOwed - iOwe
      };
    }

    /* ---- Health check (the alarm) ---- */
    function healthChecks(c) {
      const out = [];
      const inc = c.cur.income, exp = c.cur.expenses;
      const r = c.rows;
      if (inc > 0 && exp > inc) {
        out.push({ level: 'critical', text: 'Your expenses are higher than your income this month.', amount: exp - inc, amountLabel: 'over' });
      } else if (inc === 0 && exp > 0) {
        out.push({ level: 'warning', text: 'You have expenses but no income logged this month.' });
      } else if (inc > 0 && c.projected !== null && c.projected > inc) {
        out.push({ level: 'critical', text: 'At this pace, your expenses will pass your income by the end of the month.', amount: c.projected, amountLabel: 'projected' });
      } else if (inc > 0 && exp >= inc * LIMIT_SHARE) {
        out.push({ level: 'warning', text: 'Expenses are above 80% of your income, the 50/30/20 limit for needs and wants.' });
      }
      if (r[8].expenses > 0 && r[8].expenses < r[9].expenses && r[9].expenses < r[10].expenses) {
        out.push({ level: 'warning', text: 'Your expenses went up three months in a row.' });
      }
      if (r[9].income > 0 && r[10].income < r[9].income && r[10].expenses > r[9].expenses) {
        out.push({ level: 'warning', text: 'Last month your income went down while your expenses went up.' });
      }
      if (c.overdue.length) {
        out.push({ level: 'warning', text: c.overdue.length === 1 ? 'You have 1 overdue debt.' : 'You have ' + c.overdue.length + ' overdue debts.' });
      }
      if (data.goals && c.avgNeeds > 0) {
        const ef = data.goals.filter(function (g) { return g.kind === 'emergency'; }).reduce(function (t, g) { return t + g.savedCents; }, 0);
        if (ef < c.avgNeeds * 3) out.push({ level: 'info', text: 'Your emergency fund covers less than 3 months of needs. The BSP suggests 3 to 6 months.' });
      }
      return out;
    }

    function drawHealth(c) {
      const checks = healthChecks(c);
      const hasData = c.rows.some(function (r) { return r.income || r.expenses; });
      const worst = checks.some(function (x) { return x.level === 'critical'; }) ? 'critical'
        : checks.some(function (x) { return x.level === 'warning'; }) ? 'warning' : 'good';
      let title;
      if (!hasData) title = 'Add your income and expenses to see how you’re doing.';
      else if (worst === 'critical') title = 'Heads up: your spending needs attention.';
      else if (worst === 'warning') title = 'Watch your spending.';
      else title = 'You’re spending within your means.';
      const state = hasData ? worst : 'info';
      const iconName = { good: 'check', warning: 'warning', critical: 'over', info: 'pending' }[state];
      const list = checks.length && hasData ? h('ul', { class: 'ov-health-list' }, checks.map(function (x) {
        return h('li', { 'data-level': x.level }, h('span', null, x.text),
          x.amount ? h('span', { class: 'num ov-health-amt' }, ' ' + show(x.amount) + ' ' + x.amountLabel) : null);
      })) : null;
      healthBox.replaceChildren(h('section', { class: 'ov-health', 'data-state': state, role: state === 'critical' ? 'alert' : 'status' },
        h('span', { class: 'ov-health-icon' }, icon(iconName)),
        h('div', null, h('h2', null, title), list,
          !hasData && book.canEdit ? h('button', { type: 'button', class: 'btn small', style: 'margin-top:0.5rem', onclick: function () { ctx.openTab('budget'); } }, 'Add an entry') : null)));
    }

    /* ---- KPI tiles ---- */
    function change(now, before, goodWhenUp) {
      if (!before) return null;
      const pct = Math.round((now - before) / before * 100);
      if (!isFinite(pct)) return null;
      const up = pct > 0;
      const good = pct === 0 ? null : (up === goodWhenUp);
      return h('span', { class: 'ov-delta', 'data-good': good === null ? 'flat' : String(good) },
        pct === 0 ? null : icon(up ? 'up' : 'down'),
        h('span', { class: 'num' }, (pct > 0 ? '+' : '') + pct + '%'), h('span', { class: 'muted' }, ' vs same time last month'));
    }

    function spark(values, cls) {
      const w = 120, ht = 34, max = Math.max.apply(null, values.concat([1]));
      const pts = values.map(function (v, i) { return [i * (w / (values.length - 1)), ht - 3 - (v / max) * (ht - 6)]; });
      const s = svg('svg', { viewBox: '0 0 ' + w + ' ' + ht, class: 'ov-spark ' + cls, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
      s.appendChild(svg('polyline', { points: pts.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '), fill: 'none', 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      const last = pts[pts.length - 1];
      s.appendChild(svg('circle', { cx: last[0], cy: last[1], r: 3 }));
      return s;
    }

    function tile(label, value, foot, extra, cls) {
      return h('div', { class: 'ov-kpi' + (cls ? ' ' + cls : '') },
        h('p', { class: 'ov-kpi-label' }, label),
        h('p', { class: 'ov-kpi-value num' }, value),
        foot || null, extra || null);
    }

    function drawKpis(c) {
      const last6 = c.rows.slice(6);
      const inc = c.cur.income, exp = c.cur.expenses;
      const rate = inc > 0 ? Math.round(c.cur.savings / inc * 100) : null;
      const expShare = inc > 0 ? Math.round(exp / inc * 100) : null;
      kpiBox.replaceChildren(
        tile('Income this month', show(inc), change(inc, c.prevToDate.income, true), spark(last6.map(function (r) { return r.income; }), 's-income'), 'k-income'),
        tile('Expenses this month', show(exp), change(exp, c.prevToDate.expenses, false),
          h('div', { class: 'ov-kpi-row' }, spark(last6.map(function (r) { return r.expenses; }), 's-expense'),
            expShare !== null ? h('span', { class: 'ov-pill', 'data-state': exp > inc ? 'critical' : expShare >= 80 ? 'warning' : 'good' }, h('span', { class: 'num' }, expShare + '%'), ' of income') : null), 'k-expense'),
        tile('Savings rate', rate === null ? '—' : rate + '%',
          h('p', { class: 'small muted' }, h('span', { class: 'num' }, show(c.cur.savings)), ' saved · goal 20%'),
          h('div', { class: 'meter', 'data-state': rate !== null && rate >= 20 ? 'good' : 'normal', role: 'meter', 'aria-label': 'Savings rate', 'aria-valuemin': 0, 'aria-valuemax': 20, 'aria-valuenow': Math.max(0, Math.min(20, rate || 0)) },
            h('i', { style: 'width:' + Math.max(0, Math.min(100, (rate || 0) / 20 * 100)) + '%' }))),
        tile('Net worth', (c.netWorth < 0 && !hiddenAmounts() ? '−\u00a0' : '') + show(Math.abs(c.netWorth)),
          h('p', { class: 'small muted' }, 'Accounts + owed to you − debts')));
    }

    /* ---- Income vs expenses chart ---- */
    let resizer = null;
    let lastC = null;
    function drawChart(c) {
      const rows = c.rows.slice(12 - range);
      const head = h('div', { class: 'ov-card-head' },
        h('div', null, h('h2', null, 'Income vs expenses'),
          h('p', { class: 'small muted' }, 'Income should stay above expenses. Expenses are needs + wants.')),
        h('div', { class: 'ov-seg', role: 'group', 'aria-label': 'Time range' }, [6, 12].map(function (n) {
          return h('button', { type: 'button', 'aria-pressed': String(range === n), onclick: function () { range = n; drawChart(lastC); } }, n + ' months');
        })));
      const legend = h('div', { class: 'ov-legend' },
        h('span', null, h('i', { class: 'key line s-income' }), 'Income'),
        h('span', null, h('i', { class: 'key line s-expense' }), 'Expenses'),
        h('span', null, h('i', { class: 'key dash' }), '80% of income (limit)'),
        h('span', null, h('i', { class: 'key band' }), 'Expenses over income'),
        h('span', null, h('i', { class: 'key dash s-expense-dash' }), 'This month so far'));
      const plot = h('div', { class: 'ov-plot' });
      const tip = h('div', { class: 'ov-tip', hidden: true, role: 'presentation' });
      plot.appendChild(tip);
      const table = h('details', { class: 'ov-table' }, h('summary', null, 'Show as table'),
        h('table', null,
          h('thead', null, h('tr', null, h('th', { scope: 'col' }, 'Month'), h('th', { scope: 'col' }, 'Income'), h('th', { scope: 'col' }, 'Expenses'), h('th', { scope: 'col' }, 'Difference'))),
          h('tbody', null, rows.slice().reverse().map(function (r) {
            const diff = r.income - r.expenses;
            return h('tr', null, h('th', { scope: 'row' }, BT.monthLabel(r.month)), h('td', { class: 'num' }, show(r.income)), h('td', { class: 'num' }, show(r.expenses)),
              h('td', { class: 'num', 'data-neg': String(diff < 0) }, (diff < 0 && !hiddenAmounts() ? '− ' : '') + show(Math.abs(diff))));
          }))));
      chartBox.replaceChildren(head, legend, plot, table);

      function paint() {
        Array.from(plot.querySelectorAll('svg')).forEach(function (s) { s.remove(); });
        const W = Math.max(280, plot.clientWidth || 600), H = 240;
        const pad = { l: 56, r: 16, t: 12, b: 28 };
        const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
        const maxVal = Math.max(100000, Math.max.apply(null, rows.map(function (r) { return Math.max(r.income, r.expenses); })));
        const step = niceStep(maxVal / 4);
        const top = Math.ceil(maxVal / step) * step;
        const x = function (i) { return pad.l + (rows.length === 1 ? iw / 2 : i * iw / (rows.length - 1)); };
        const y = function (v) { return pad.t + ih - (v / top) * ih; };
        const s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'Line chart of monthly income and expenses for the last ' + range + ' months. The table below has the numbers.' });
        /* over-income bands */
        const colW = iw / Math.max(1, rows.length - 1);
        rows.forEach(function (r, i) {
          if (r.expenses > r.income && r.expenses > 0) {
            const x0 = Math.max(pad.l, x(i) - colW / 2), x1 = Math.min(pad.l + iw, x(i) + colW / 2);
            s.appendChild(svg('rect', { x: x0, y: pad.t, width: x1 - x0, height: ih, class: 'ov-band' }));
          }
        });
        /* grid + y labels */
        for (let v = 0; v <= top + step / 2; v += step) {
          s.appendChild(svg('line', { x1: pad.l, x2: pad.l + iw, y1: y(v), y2: y(v), class: v === 0 ? 'ov-axis' : 'ov-grid' }));
          const t = svg('text', { x: pad.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'ov-tick' });
          t.textContent = hiddenAmounts() ? '' : compact.format(v / 100);
          s.appendChild(t);
        }
        /* x labels: every month at 6, every other at 12 on narrow screens */
        const every = rows.length > 6 && W < 560 ? 2 : 1;
        rows.forEach(function (r, i) {
          if ((rows.length - 1 - i) % every) return;
          const t = svg('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'ov-tick' });
          t.textContent = shortMonth(r.month) + (i === rows.length - 1 ? ' (so far)' : '');
          s.appendChild(t);
        });
        /* limit line (80% of income) */
        s.appendChild(svg('polyline', { points: rows.map(function (r, i) { return x(i) + ',' + y(r.income * LIMIT_SHARE); }).join(' '), class: 'ov-limit' }));
        /* series */
        [['income', 's-income'], ['expenses', 's-expense']].forEach(function (sr) {
          const pts = rows.map(function (r, i) { return x(i).toFixed(1) + ',' + y(r[sr[0]]).toFixed(1); });
          s.appendChild(svg('polyline', { points: pts.slice(0, -1).join(' '), class: 'ov-line ' + sr[1] }));
          s.appendChild(svg('polyline', { points: pts.slice(-2).join(' '), class: 'ov-line partial ' + sr[1] }));
          const i = rows.length - 1;
          s.appendChild(svg('circle', { cx: x(i), cy: y(rows[i][sr[0]]), r: 4, class: 'ov-dot ' + sr[1] }));
        });
        /* hover layer */
        const cross = svg('line', { y1: pad.t, y2: pad.t + ih, class: 'ov-cross', visibility: 'hidden' });
        const hi = [svg('circle', { r: 5, class: 'ov-dot s-income', visibility: 'hidden' }), svg('circle', { r: 5, class: 'ov-dot s-expense', visibility: 'hidden' })];
        s.appendChild(cross); hi.forEach(function (d) { s.appendChild(d); });
        const hit = svg('rect', { x: pad.l - colW / 2, y: 0, width: iw + colW, height: H, fill: 'transparent', tabindex: 0, 'aria-label': 'Chart details. Use the left and right arrow keys.' });
        s.appendChild(hit);
        let focusIndex = rows.length - 1;
        function showAt(i) {
          i = Math.max(0, Math.min(rows.length - 1, i));
          focusIndex = i;
          const r = rows[i];
          cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
          hi[0].setAttribute('cx', x(i)); hi[0].setAttribute('cy', y(r.income));
          hi[1].setAttribute('cx', x(i)); hi[1].setAttribute('cy', y(r.expenses));
          hi.forEach(function (d) { d.setAttribute('visibility', 'visible'); });
          const diff = r.income - r.expenses;
          tip.replaceChildren(
            h('p', { class: 'ov-tip-title' }, BT.monthLabel(r.month), i === rows.length - 1 ? h('span', { class: 'muted' }, ' · so far') : null),
            h('p', null, h('i', { class: 'key line s-income' }), h('strong', { class: 'num' }, show(r.income)), h('span', { class: 'muted' }, ' Income')),
            h('p', null, h('i', { class: 'key line s-expense' }), h('strong', { class: 'num' }, show(r.expenses)), h('span', { class: 'muted' }, ' Expenses')),
            h('p', { class: 'ov-tip-diff', 'data-neg': String(diff < 0) }, diff < 0 ? 'Over by ' : 'Left ', h('span', { class: 'num' }, show(Math.abs(diff)))));
          tip.hidden = false;
          const tw = tip.offsetWidth;
          const left = x(i) + 12 + tw > W ? x(i) - 12 - tw : x(i) + 12;
          tip.style.left = left + 'px';
          tip.style.top = pad.t + 'px';
        }
        function hide() { cross.setAttribute('visibility', 'hidden'); hi.forEach(function (d) { d.setAttribute('visibility', 'hidden'); }); tip.hidden = true; }
        hit.addEventListener('pointermove', function (e) {
          const box = s.getBoundingClientRect();
          const px = e.clientX - box.left;
          showAt(Math.round((px - pad.l) / Math.max(1, iw) * (rows.length - 1)));
        });
        hit.addEventListener('pointerleave', hide);
        hit.addEventListener('focus', function () { showAt(focusIndex); });
        hit.addEventListener('blur', hide);
        hit.addEventListener('keydown', function (e) {
          if (e.key === 'ArrowLeft') { e.preventDefault(); showAt(focusIndex - 1); }
          if (e.key === 'ArrowRight') { e.preventDefault(); showAt(focusIndex + 1); }
        });
        plot.insertBefore(s, tip);
      }
      paint();
      if (resizer) resizer.disconnect();
      if (window.ResizeObserver) {
        let lastW = plot.clientWidth;
        resizer = new ResizeObserver(function () { if (Math.abs(plot.clientWidth - lastW) > 4) { lastW = plot.clientWidth; paint(); } });
        resizer.observe(plot);
      }
    }

    function niceStep(raw) {
      const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
      const n = raw / p;
      return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
    }

    /* ---- Recent expenses ---- */
    function drawRecent() {
      const rows = book.list().filter(function (t) { return t.type === 'needs' || t.type === 'wants'; })
        .sort(function (a, b) { return a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : (a.date < b.date ? 1 : -1); })
        .slice(0, 6);
      recentBox.replaceChildren(
        h('div', { class: 'ov-card-head' }, h('h2', { id: 'ov-recent-h' }, 'Recent expenses'),
          h('button', { type: 'button', class: 'link small', onclick: function () { ctx.openTab('budget'); } }, book.canEdit ? 'Add or see all' : 'See all')),
        rows.length ? h('ul', { class: 'ov-list' }, rows.map(function (t) {
          return h('li', null,
            h('span', { class: 'ov-list-date num' }, BT.shortDate(t.date)),
            h('span', { class: 'ov-list-main' }, h('span', { class: 'ov-list-title' }, t.desc), h('span', { class: 'ov-tag', 'data-type': t.type }, BT.TYPE_LABELS[t.type])),
            h('span', { class: 'ov-list-amt num' }, show(t.cents)));
        })) : h('p', { class: 'ov-empty' }, 'No expenses logged yet.'));
    }

    /* ---- Debts (utang) ---- */
    /* Small profile picture for a debt tagged to a PassbookHub user. Fills in once the profile loads. */
    function taggedPic(uid) {
      const slot = h('span', { class: 'ov-row-pic', 'aria-hidden': 'true' });
      SOC.getProfile(uid).then(function (p) {
        if (!p) return;
        slot.replaceChildren(p.avatar && String(p.avatar).indexOf('data:image/jpeg;base64,') === 0
          ? h('img', { class: 'avatar', src: p.avatar, alt: '', style: '--size:1.25rem' })
          : h('span', { class: 'avatar', style: '--size:1.25rem;font-size:0.55rem' }, String(p.name || '?').charAt(0).toUpperCase()));
        slot.title = '@' + p.username;
      }).catch(function () {});
      return slot;
    }

    function drawDebts(c) {
      const dirs = [['owe', 'I owe', c.iOwe], ['lent', 'Owed to me', c.owedMe]];
      const head = h('div', { class: 'ov-card-head' }, h('h2', { id: 'ov-debt-h' }, 'Debts'),
        book.canEdit ? h('button', { type: 'button', class: 'btn small', onclick: function () { debtForm(null, debtDir); } }, '+ Add') : null);
      const tabs = h('div', { class: 'ov-seg ov-seg-full', role: 'group', 'aria-label': 'Show debts' }, dirs.map(function (d) {
        return h('button', { type: 'button', 'aria-pressed': String(debtDir === d[0]), onclick: function () { debtDir = d[0]; drawDebts(compute()); } },
          h('span', null, d[1]), h('span', { class: 'num ov-seg-amt' }, show(d[2])));
      }));
      if (data.debts === null) { debtBox.replaceChildren(head, h('p', { class: 'ov-empty' }, 'Loading…')); return; }
      if (data.debtError) { debtBox.replaceChildren(head, setupNote(data.debtError)); return; }
      const list = data.debts.filter(function (d) { return d.dir === debtDir; }).sort(function (a, b) {
        const ad = a.cents - a.paidCents <= 0, bd = b.cents - b.paidCents <= 0;
        if (ad !== bd) return ad ? 1 : -1;
        return (a.due || '9999') < (b.due || '9999') ? -1 : 1;
      });
      const bankLine = debtDir === 'owe' && c.bankOwed > 0
        ? h('button', { type: 'button', class: 'ov-bankline', onclick: function () { ctx.openTab('credit'); } },
            h('span', null, 'Credit cards and loans'), h('span', { class: 'small muted' }, ' from your Savings tracker'), h('span', { class: 'num ov-list-amt' }, show(c.bankOwed)))
        : null;
      debtBox.replaceChildren(head, tabs, bankLine || '',
        list.length ? h('ul', { class: 'ov-list ov-debts' }, list.map(function (d) {
          const remaining = Math.max(0, d.cents - d.paidCents);
          const paid = remaining === 0;
          const overdue = !paid && d.due && d.due < c.today;
          const soon = !paid && !overdue && d.due && daysBetween(c.today, d.due) <= 7;
          const pct = Math.round(d.paidCents / d.cents * 100);
          const body = [
            h('span', { class: 'ov-list-main' },
              h('span', { class: 'ov-list-title' }, d.uid ? taggedPic(d.uid) : null, d.person),
              h('span', { class: 'small muted ov-debt-sub' },
                d.note ? d.note + ' · ' : '',
                paid ? 'Fully paid' : d.due ? (overdue ? 'Was due ' : 'Due ') + BT.shortDate(d.due) : 'No due date'),
              h('span', { class: 'meter thin', 'data-state': paid ? 'good' : 'normal', 'aria-hidden': 'true' }, h('i', { style: 'width:' + pct + '%' }))),
            h('span', { class: 'ov-debt-right' },
              h('span', { class: 'ov-list-amt num' }, show(remaining)),
              paid ? h('span', { class: 'ov-pill', 'data-state': 'good' }, 'Paid')
                : overdue ? h('span', { class: 'ov-pill', 'data-state': 'critical' }, 'Overdue')
                : soon ? h('span', { class: 'ov-pill', 'data-state': 'warning' }, 'Due soon')
                : h('span', { class: 'small muted' }, 'of ', h('span', { class: 'num' }, show(d.cents))))
          ];
          return h('li', null, book.canEdit
            ? h('button', { type: 'button', class: 'ov-row-btn', 'aria-label': 'Edit debt with ' + d.person, onclick: function () { debtForm(d); } }, body)
            : h('div', { class: 'ov-row-btn' }, body));
        })) : h('p', { class: 'ov-empty' }, debtDir === 'owe' ? 'No personal debts. Nice!' : 'No one owes you money right now.'));
    }

    /* ---- Savings goals ---- */
    function drawGoals(c) {
      const head = h('div', { class: 'ov-card-head' },
        h('div', null, h('h2', { id: 'ov-goal-h' }, 'Savings goals'), h('p', { class: 'small muted' }, 'Emergency fund first, then your other goals.')),
        book.canEdit ? h('button', { type: 'button', class: 'btn small', onclick: function () { goalForm(null); } }, '+ New goal') : null);
      if (data.goals === null) { goalBox.replaceChildren(head, h('p', { class: 'ov-empty' }, 'Loading…')); return; }
      if (data.goalError) { goalBox.replaceChildren(head, setupNote(data.goalError)); return; }
      const goals = data.goals.slice().sort(function (a, b) { return (a.kind === 'emergency' ? 0 : 1) - (b.kind === 'emergency' ? 0 : 1); });
      const tiles = goals.map(function (g) {
        const pct = Math.min(100, Math.round(g.savedCents / g.targetCents * 100));
        const done = g.savedCents >= g.targetCents;
        const remaining = Math.max(0, g.targetCents - g.savedCents);
        const months = g.due ? monthsBetween(c.today, g.due) : null;
        let plan;
        if (done) plan = h('span', { class: 'status', 'data-state': 'good' }, icon('check'), 'Goal reached');
        else if (months !== null && months <= 0) plan = h('span', { class: 'status', 'data-state': 'warning' }, icon('warning'), 'Target date passed');
        else if (months !== null) plan = h('span', null, 'Save ', h('strong', { class: 'num' }, show(Math.ceil(remaining / Math.max(1, Math.ceil(months))))), ' a month to reach it by ' + BT.shortDate(g.due));
        else plan = h('span', null, h('span', { class: 'num' }, show(remaining)), ' to go');
        let coverage = null;
        if (g.kind === 'emergency' && c.avgNeeds > 0) {
          const covered = g.savedCents / c.avgNeeds;
          coverage = h('p', { class: 'small ov-goal-cover' }, 'Covers ', h('strong', { class: 'num' }, covered.toFixed(1)), ' months of needs');
        }
        const body = [
          h('span', { class: 'ov-goal-top' },
            h('span', { class: 'ov-goal-icon', 'data-kind': g.kind }, kindIcon(g.kind)),
            h('span', { class: 'ov-goal-names' }, h('span', { class: 'ov-list-title wrap' }, g.name), g.name.trim() === SOC.GOAL_KINDS[g.kind] ? null : h('span', { class: 'small muted' }, SOC.GOAL_KINDS[g.kind])),
            h('span', { class: 'ov-goal-pct num' }, pct + '%')),
          h('span', { class: 'meter', 'data-state': done ? 'good' : 'normal', role: 'meter', 'aria-label': g.name + ' progress', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct }, h('i', { style: 'width:' + pct + '%' })),
          h('span', { class: 'ov-goal-amts small' }, h('span', { class: 'num' }, show(g.savedCents)), h('span', { class: 'muted' }, ' of '), h('span', { class: 'num muted' }, show(g.targetCents))),
          h('span', { class: 'small ov-goal-plan' }, plan),
          coverage
        ];
        return book.canEdit
          ? h('button', { type: 'button', class: 'ov-goal', 'aria-label': 'Edit goal ' + g.name, onclick: function () { goalForm(g); } }, body)
          : h('div', { class: 'ov-goal' }, body);
      });
      const hasEmergency = goals.some(function (g) { return g.kind === 'emergency'; });
      if (!hasEmergency) tiles.unshift(emergencySuggestion(c));
      goalBox.replaceChildren(head, h('div', { class: 'ov-goals' }, tiles));
    }

    function emergencySuggestion(c) {
      const base = c.avgNeeds;
      const low = base * 3, high = base * 6;
      return h('div', { class: 'ov-goal ov-goal-suggest' },
        h('span', { class: 'ov-goal-top' },
          h('span', { class: 'ov-goal-icon', 'data-kind': 'emergency' }, kindIcon('emergency')),
          h('span', { class: 'ov-goal-names' }, h('span', { class: 'ov-list-title wrap' }, 'Start an emergency fund'), h('span', { class: 'small muted' }, 'Suggested'))),
        h('p', { class: 'small' }, base > 0
          ? ['Aim for 3 to 6 months of your needs: ', h('strong', { class: 'num' }, show(low)), ' to ', h('strong', { class: 'num' }, show(high)), '.']
          : 'Aim for 3 to 6 months of your essential expenses. Log your needs so we can work out the amount.'),
        h('p', { class: 'small muted' }, 'Keep it in a separate savings account you can reach within a day.'),
        book.canEdit ? h('button', { type: 'button', class: 'btn small primary', onclick: function () {
          goalForm({ name: 'Emergency fund', kind: 'emergency', targetCents: high || 0, savedCents: 0, due: '' }, true);
        } }, 'Create emergency fund') : null);
    }

    function kindIcon(kind) {
      const span = h('span', { class: 'ov-kind-svg' });
      span.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (KIND_ICONS[kind] || KIND_ICONS.other) + '</svg>';
      return span;
    }

    function setupNote(message) {
      return h('p', { class: 'ov-empty' }, message, ' ', h('span', { class: 'small muted' }, 'If this keeps happening, the database rules may need updating.'));
    }

    /* ---- Forms ---- */
    function dialog(title, fields, onSave, onDelete) {
      const previous = document.activeElement;
      const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
      const save = h('button', { type: 'submit', class: 'btn primary' }, 'Save');
      const del = onDelete ? h('button', { type: 'button', class: 'btn danger', onclick: async function () {
        const ok = await ctx.ask({ title: 'Delete this?', body: 'You can’t undo this.', yes: 'Delete', no: 'Keep' });
        if (!ok) return;
        try { await onDelete(); ctx.toast('Deleted.'); close(); } catch (e) { errorBox.textContent = e.message; errorBox.hidden = false; }
      } }, 'Delete') : null;
      const form = h('form', { class: 'acct-form', novalidate: true, onsubmit: async function (event) {
        event.preventDefault();
        form.querySelectorAll('.error').forEach(function (e) { e.hidden = true; });
        errorBox.hidden = true;
        save.disabled = true;
        try {
          const problems = await onSave();
          if (problems) {
            save.disabled = false;
            Object.keys(problems).forEach(function (k) { const box = form.querySelector('#e-ov-' + k); if (box) { box.textContent = problems[k]; box.hidden = false; } });
            const first = form.querySelector('.error:not([hidden])');
            if (first && first.previousElementSibling) first.previousElementSibling.focus();
            return;
          }
          close();
        } catch (e) { save.disabled = false; errorBox.textContent = e.message; errorBox.hidden = false; }
      } },
      h('div', { class: 'acct-head' }, h('h2', { id: 'ov-dlg-title' }, title),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: function () { close(); } }, icon('close'))),
      fields, errorBox,
      h('div', { class: 'ask-actions' }, del, h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn', onclick: function () { close(); } }, 'Cancel'), save));
      const overlay = h('div', { class: 'chat-overlay ask acct-overlay' },
        h('div', { class: 'ask-card acct-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ov-dlg-title' }, form));
      function onKey(event) { if (event.key === 'Escape') close(); }
      function close() { document.removeEventListener('keydown', onKey); overlay.remove(); if (previous && previous.isConnected) previous.focus(); }
      overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      const firstInput = form.querySelector('input, select');
      if (firstInput) firstInput.focus();
    }

    function input(id, label, attrs, grow) {
      const control = h(attrs && attrs.tag === 'select' ? 'select' : 'input', Object.assign({ id: 'f-ov-' + id, name: id }, attrs && attrs.tag ? {} : attrs), attrs && attrs.options ? attrs.options : null);
      return { control: control, wrap: h('div', { class: 'acct-field' + (grow ? ' grow' : '') }, h('label', { for: 'f-ov-' + id }, label), control, h('p', { class: 'error small', id: 'e-ov-' + id, hidden: true })) };
    }
    function cents(control) {
      const raw = control.value.trim();
      if (raw === '') return 0;
      const v = Math.round(parseFloat(raw) * 100);
      return isFinite(v) ? v : -1;
    }
    const moneyAttrs = { type: 'number', inputmode: 'decimal', step: '0.01', min: '0' };

    function debtForm(existing, presetDir) {
      const d = existing || { dir: presetDir || 'owe', person: '', note: '', cents: 0, paidCents: 0, due: '' };
      const pad = function (n) { return (n < 10 ? '0' : '') + n; };
      const iso = function (x) { return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()); };
      const today = function () { const x = new Date(); x.setHours(0, 0, 0, 0); return x; };
      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      /* ---- Live preview card ---- */
      const pvAvatar = h('span', { class: 'ov-pv-avatar', 'aria-hidden': 'true' });
      const pvName = h('span', { class: 'ov-pv-name' });
      const pvUser = h('span', { class: 'ov-pv-user' });
      const pvSub = h('span', { class: 'ov-pv-sub' });
      const pvAmount = h('span', { class: 'ov-pv-amount num' });
      const pvLabel = h('span', { class: 'ov-pv-label' });
      const preview = h('div', { class: 'ov-pv', 'aria-live': 'polite' },
        pvAvatar, h('div', { class: 'ov-pv-main' }, h('span', { class: 'ov-pv-top' }, pvName, pvUser), pvSub),
        h('div', { class: 'ov-pv-right' }, pvAmount, pvLabel));
      let shown = 0, anim = 0;
      function countTo(target) {
        cancelAnimationFrame(anim);
        if (reduceMotion) { shown = target; pvAmount.textContent = money(target); return; }
        const from = shown, start = performance.now();
        (function step(now) {
          const k = Math.min(1, (now - start) / 260), e = 1 - Math.pow(1 - k, 3);
          shown = Math.round(from + (target - from) * e);
          pvAmount.textContent = money(shown);
          if (k < 1) anim = requestAnimationFrame(step);
        })(start);
      }
      function hue(text) { let n = 0; for (let i = 0; i < text.length; i++) n = (n * 31 + text.charCodeAt(i)) % 360; return n; }

      /* ---- Type toggle ---- */
      let dirValue = d.dir === 'lent' ? 'lent' : 'owe';
      const dirError = h('p', { class: 'error small', id: 'e-ov-dir', hidden: true });
      function seg(value, title, sub) {
        return h('button', { type: 'button', role: 'radio', class: 'ov-dirseg-btn', 'data-value': value,
          onclick: function () { setDir(value); } }, h('span', { class: 'ov-dirseg-title' }, title), h('span', { class: 'ov-dirseg-sub' }, sub));
      }
      const segOwe = seg('owe', 'I owe them', 'utang ko');
      const segLent = seg('lent', 'They owe me', 'pinautang ko');
      const segThumb = h('span', { class: 'ov-dirseg-thumb', 'aria-hidden': 'true' });
      const segGroup = h('div', { class: 'ov-dirseg', role: 'radiogroup', 'aria-label': 'Type', id: 'f-ov-dir' }, segThumb, segOwe, segLent);
      segGroup.addEventListener('keydown', function (e) {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].indexOf(e.key) === -1) return;
        e.preventDefault();
        setDir(dirValue === 'owe' ? 'lent' : 'owe');
        (dirValue === 'owe' ? segOwe : segLent).focus();
      });

      /* ---- Name: tag someone from your circle, or type any name ---- */
      const person = input('person', 'Who do you owe?', { maxlength: 40, autocomplete: 'off', placeholder: 'Type a name, or @ to tag someone in your circle' }, true);
      person.control.value = d.person;
      const personLabel = person.wrap.querySelector('label');
      const known = [];
      (data.debts || []).forEach(function (x) { if (x.person && !x.uid && known.indexOf(x.person) === -1) known.push(x.person); });
      const canTag = !owner;   /* Only in your own book: alerts go out from you. */
      let circle = null;       /* null until loaded */
      let linked = null;       /* the tagged circle member, if any */
      const startUid = existing && existing.uid ? existing.uid : '';
      if (canTag) {
        SOC.circleMembers().then(function (list) { circle = list; drawSuggest(); }).catch(function () { circle = []; });
      }
      if (startUid) {
        SOC.getProfile(startUid).then(function (p) { if (p && !linked && person.control.value.trim() === d.person) setLinked(p, true); }).catch(function () {});
      }

      function personPic(p, size) {
        const style = '--size:' + size + 'rem';
        if (p && p.avatar && String(p.avatar).indexOf('data:image/jpeg;base64,') === 0) return h('img', { class: 'avatar', src: p.avatar, alt: '', style: style });
        const letters = String(p.name || '?').trim().split(/\s+/).slice(0, 2).map(function (w) { return Array.from(w)[0] || ''; }).join('').toUpperCase();
        return h('span', { class: 'avatar', style: style + ';font-size:' + (size * 0.4) + 'rem', 'aria-hidden': 'true' }, letters);
      }

      const suggest = h('div', { class: 'ov-suggest', role: 'listbox', hidden: true });
      const notify = h('input', { type: 'checkbox', id: 'f-ov-notify' });
      const tagName = h('span', { class: 'ov-ptag-name' });
      const tagUser = h('span', { class: 'ov-ptag-user' });
      const tagPic = h('span', { class: 'ov-ptag-pic' });
      const tag = h('div', { class: 'ov-ptag', hidden: true },
        tagPic,
        h('div', { class: 'ov-ptag-main' }, h('span', { class: 'ov-ptag-top' }, tagName, tagUser),
          h('label', { class: 'ov-ptag-notify', for: 'f-ov-notify' }, notify, h('span', null, 'Notify them'))),
        h('button', { type: 'button', class: 'icon-btn ov-ptag-x', 'aria-label': 'Untag', title: 'Untag', onclick: function () { setLinked(null); person.control.select(); } }, icon('close')));
      person.wrap.insertBefore(tag, person.wrap.querySelector('.error'));
      person.wrap.insertBefore(suggest, tag);
      const tagHint = canTag ? h('p', { class: 'small muted ov-ptag-hint' }, 'Tip: type @ to tag someone in your circle. They get a notification.') : null;
      if (tagHint) person.wrap.insertBefore(tagHint, tag);

      function setLinked(p, quiet) {
        linked = p;
        tag.hidden = !p;
        person.control.hidden = !!p;
        person.wrap.classList.toggle('linked', !!p);
        if (tagHint) tagHint.hidden = !!p;
        if (p) {
          person.control.value = p.name.slice(0, 40);
          tagName.textContent = p.name;
          tagUser.textContent = p.username ? '@' + p.username : '';
          tagPic.replaceChildren(personPic(p, 2));
          /* New tags notify by default; re-saving an old tag doesn't, unless you tick it. */
          notify.checked = !(quiet || p.id === startUid);
          suggest.hidden = true;
          clearError('person');
        }
        drawPreview();
      }

      let active = -1, options = [];
      function drawSuggest() {
        const raw = person.control.value;
        const at = raw.trim().charAt(0) === '@';
        const q = raw.trim().replace(/^@/, '').toLowerCase();
        const people = canTag && circle ? circle.filter(function (p) {
          if (linked && p.id === linked.id) return false;
          return !q || p.name.toLowerCase().indexOf(q) !== -1 || (p.username || '').toLowerCase().indexOf(q) === 0;
        }).slice(0, 5) : [];
        const names = at || linked ? [] : known.filter(function (n) { return n.toLowerCase() !== q && (!q || n.toLowerCase().indexOf(q) !== -1); }).slice(0, 4);
        options = people.map(function (p) { return { person: p }; }).concat(names.map(function (n) { return { name: n }; }));
        active = options.length && (at || q) ? 0 : -1;
        const rows = [];
        if (people.length) rows.push(h('p', { class: 'ov-suggest-head' }, 'In your circle'));
        options.forEach(function (o, i) {
          if (o.name && (i === people.length)) rows.push(h('p', { class: 'ov-suggest-head' }, 'Used before'));
          rows.push(h('button', { type: 'button', role: 'option', class: 'ov-suggest-item', 'data-i': i,
            onmousedown: function (e) { e.preventDefault(); }, onclick: function () { pick(i); } },
            o.person ? personPic(o.person, 1.75) : h('span', { class: 'avatar ov-noavatar', style: '--size:1.75rem', 'aria-hidden': 'true' }, ' '),
            h('span', { class: 'ov-suggest-text' },
              h('span', { class: 'ov-suggest-name' }, o.person ? o.person.name : o.name),
              o.person ? h('span', { class: 'ov-suggest-sub' }, '@' + o.person.username) : h('span', { class: 'ov-suggest-sub' }, 'Not on PassbookHub')),
            o.person ? h('span', { class: 'ov-suggest-badge' }, 'Tag') : null));
        });
        if (at && canTag && circle && !people.length) rows.push(h('p', { class: 'ov-suggest-empty' }, circle.length ? 'No one in your circle matches.' : 'Your circle is empty. Add people from the Circle page to tag them.'));
        suggest.replaceChildren.apply(suggest, rows);
        suggest.hidden = !rows.length || document.activeElement !== person.control;
        paintActive();
      }
      function paintActive() {
        suggest.querySelectorAll('.ov-suggest-item').forEach(function (b) { b.classList.toggle('active', Number(b.getAttribute('data-i')) === active); });
      }
      function pick(i) {
        const o = options[i];
        if (!o) return;
        if (o.person) setLinked(o.person);
        else { person.control.value = o.name; setLinked(null); }
        suggest.hidden = true;
        clearError('person'); drawPreview(); total.control.focus();
      }
      person.control.addEventListener('focus', drawSuggest);
      person.control.addEventListener('blur', function () { suggest.hidden = true; });
      person.control.addEventListener('keydown', function (e) {
        if (suggest.hidden || !options.length) return;
        if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % options.length; paintActive(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + options.length) % options.length; paintActive(); }
        else if (e.key === 'Enter' && active >= 0 && !(e.ctrlKey || e.metaKey)) { e.preventDefault(); pick(active); }
        else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); suggest.hidden = true; }
      });

      /* ---- Amounts ---- */
      const total = input('cents', 'Amount (' + book.currency + ')', Object.assign({ placeholder: '0.00' }, moneyAttrs), true);
      const paid = input('paidCents', 'Paid so far (' + book.currency + ')', Object.assign({ placeholder: '0.00' }, moneyAttrs), true);
      if (existing) { total.control.value = (d.cents / 100).toFixed(2); paid.control.value = d.paidCents ? (d.paidCents / 100).toFixed(2) : ''; }
      const toField = function (c) { return c % 100 ? (c / 100).toFixed(2) : String(c / 100); };
      const quick = h('div', { class: 'ov-chips ov-quick' }, [10000, 50000, 100000, 500000].map(function (c) {
        return h('button', { type: 'button', class: 'ov-chip', title: 'Add to amount', onclick: function () {
          total.control.value = toField(Math.max(0, cents(total.control)) + c);
          clearError('cents'); drawSummary(); bump(pvAmount);
        } }, '+' + (c / 100).toLocaleString());
      }));
      total.wrap.insertBefore(quick, total.wrap.querySelector('.error'));

      /* Paid: drag the slider or tap a share. */
      const slider = h('input', { type: 'range', class: 'ov-slider', min: '0', max: '0', step: '1', 'aria-label': 'Paid so far' });
      slider.addEventListener('input', function () {
        const t = cents(total.control);
        const v = Number(slider.value) >= t - 50 ? t : Math.round(Number(slider.value) / 100) * 100;
        paid.control.value = v ? toField(v) : '';
        clearError('paidCents'); drawSummary();
      });
      const shares = [0, 25, 50, 75, 100];
      const shareChips = shares.map(function (s) {
        return h('button', { type: 'button', class: 'ov-chip', 'aria-pressed': 'false', onclick: function () {
          const t = cents(total.control);
          if (t <= 0) { total.control.focus(); return; }
          const v = Math.round(t * s / 100);
          paid.control.value = v ? toField(v) : '';
          clearError('paidCents'); drawSummary();
        } }, s === 100 ? 'Paid in full' : s + '%');
      });
      const leftText = h('span', { class: 'ov-debt-left' });
      const pctText = h('span', { class: 'ov-debt-pct muted' });
      const summary = h('div', { class: 'ov-debt-summary', hidden: true },
        h('div', { class: 'ov-debt-line' }, leftText, pctText), slider, h('div', { class: 'ov-chips' }, shareChips));

      let wasDone = false;
      function drawSummary() {
        const t = cents(total.control), p = Math.max(0, cents(paid.control));
        if (t <= 0) { summary.hidden = true; wasDone = false; drawPreview(); return; }
        summary.hidden = false;
        const pct = Math.min(100, Math.round(p / t * 100));
        slider.max = String(t);
        slider.value = String(Math.min(p, t));
        slider.style.setProperty('--pct', pct + '%');
        const done = p === t, over = p > t;
        summary.classList.toggle('done', done);
        summary.classList.toggle('over', over);
        leftText.textContent = over ? '' : done ? 'Fully paid' : money(t - p) + ' left';
        pctText.textContent = over ? 'Paid is more than the amount' : done ? '' : pct + '% paid';
        shareChips.forEach(function (c, i) { c.setAttribute('aria-pressed', !over && Math.round(t * shares[i] / 100) === p ? 'true' : 'false'); });
        if (done && !wasDone && !reduceMotion) { summary.classList.remove('pop'); void summary.offsetWidth; summary.classList.add('pop'); }
        wasDone = done;
        drawPreview();
      }
      total.control.addEventListener('input', function () { clearError('cents'); drawSummary(); });
      paid.control.addEventListener('input', function () { clearError('paidCents'); drawSummary(); });

      /* ---- Due date with quick picks ---- */
      const due = input('due', 'Due date', { type: 'date' });
      due.control.value = d.due || '';
      const dueHint = h('span', { class: 'small muted ov-due-hint' });
      function inDays(n) { const x = today(); x.setDate(x.getDate() + n); return iso(x); }
      function endOfMonth() { const x = today(); return iso(new Date(x.getFullYear(), x.getMonth() + 1, 0)); }
      function nextMonth() { const x = today(); const day = Math.min(x.getDate(), new Date(x.getFullYear(), x.getMonth() + 2, 0).getDate()); return iso(new Date(x.getFullYear(), x.getMonth() + 1, day)); }
      const picks = [['In 1 week', function () { return inDays(7); }], ['End of month', endOfMonth], ['Next month', nextMonth], ['No date', function () { return ''; }]];
      const chips = picks.map(function (p) {
        return h('button', { type: 'button', class: 'ov-chip', 'aria-pressed': 'false', onclick: function () { due.control.value = p[1](); drawDue(); } }, p[0]);
      });
      let dueText = '';
      function drawDue() {
        const v = due.control.value;
        chips.forEach(function (c, i) { c.setAttribute('aria-pressed', picks[i][1]() === v ? 'true' : 'false'); });
        if (!v) { dueText = ''; dueHint.textContent = ''; drawPreview(); return; }
        const days = Math.round((new Date(v + 'T00:00:00') - today()) / 86400000);
        dueText = days === 0 ? 'Due today' : days === 1 ? 'Due tomorrow' : days > 1 ? 'In ' + days + ' days' : Math.abs(days) + (days === -1 ? ' day overdue' : ' days overdue');
        dueHint.textContent = dueText;
        dueHint.classList.toggle('late', days < 0);
        preview.classList.toggle('late', days < 0);
        drawPreview();
      }
      due.control.addEventListener('input', drawDue);
      due.control.addEventListener('change', drawDue);
      const dueWrap = h('div', { class: 'acct-field ov-due' },
        h('label', { for: 'f-ov-due' }, 'Due date'),
        h('div', { class: 'ov-due-row' }, due.control, dueHint),
        h('div', { class: 'ov-chips' }, chips),
        due.wrap.querySelector('.error'));

      /* ---- Note ---- */
      const note = input('note', 'Note', { maxlength: 80, autocomplete: 'off', placeholder: 'e.g. tuition, phone' }, true);
      note.control.value = d.note || '';
      const noteCount = h('span', { class: 'small muted ov-count' });
      note.wrap.querySelector('label').append(noteCount);
      function drawNote() { noteCount.textContent = note.control.value.length ? note.control.value.length + '/80' : ''; drawPreview(); }
      note.control.addEventListener('input', drawNote);
      const addNote = h('button', { type: 'button', class: 'link small ov-add-note', onclick: function () {
        addNote.hidden = true; note.wrap.hidden = false; note.control.focus();
      } }, '+ Add a note');
      if (d.note) addNote.hidden = true; else note.wrap.hidden = true;

      /* ---- Inline checks as you go ---- */
      function showError(id, text) {
        const box = document.getElementById('e-ov-' + id), ctl = document.getElementById('f-ov-' + id);
        if (box) { box.textContent = text; box.hidden = false; }
        if (ctl) ctl.setAttribute('aria-invalid', 'true');
      }
      function clearError(id) {
        const box = document.getElementById('e-ov-' + id), ctl = document.getElementById('f-ov-' + id);
        if (box) box.hidden = true;
        if (ctl) ctl.removeAttribute('aria-invalid');
      }
      person.control.addEventListener('input', function () {
        if (linked && person.control.value.trim() !== linked.name.slice(0, 40)) setLinked(null);
        clearError('person'); drawSuggest(); drawPreview();
      });
      person.control.addEventListener('blur', function () { if (person.control.value && !person.control.value.trim()) showError('person', 'Enter a name.'); });
      total.control.addEventListener('blur', function () { if (total.control.value !== '' && cents(total.control) <= 0) showError('cents', 'Enter an amount above zero.'); });

      function bump(node) { if (reduceMotion) return; node.classList.remove('bump'); void node.offsetWidth; node.classList.add('bump'); }

      function drawPreview() {
        const name = person.control.value.trim().replace(/^@\S*$/, '');
        pvName.textContent = name || (dirValue === 'owe' ? 'Who do you owe?' : 'Who owes you?');
        preview.classList.toggle('empty', !name);
        preview.classList.toggle('tagged', !!linked);
        if (linked && linked.avatar && String(linked.avatar).indexOf('data:image/jpeg;base64,') === 0) {
          pvAvatar.replaceChildren(h('img', { src: linked.avatar, alt: '' }));
        } else {
          pvAvatar.textContent = name ? name.charAt(0).toUpperCase() : '?';
        }
        pvAvatar.style.setProperty('--h', name ? hue(name) : 230);
        pvUser.textContent = linked && linked.username ? '@' + linked.username : '';
        const bits = [dirValue === 'owe' ? 'You owe' : 'Owes you'];
        if (note.control.value.trim()) bits.push(note.control.value.trim());
        if (dueText) bits.push(dueText);
        pvSub.textContent = bits.join(' · ');
        const t = Math.max(0, cents(total.control)), p = Math.max(0, cents(paid.control));
        const done = t > 0 && p >= t;
        pvLabel.textContent = done ? 'Settled' : p > 0 ? 'left' : '';
        countTo(done ? t : Math.max(0, t - p));
        preview.classList.toggle('done', done);
      }

      function setDir(value) {
        dirValue = value;
        [segOwe, segLent].forEach(function (b) {
          const on = b.getAttribute('data-value') === value;
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          b.tabIndex = on ? 0 : -1;
        });
        segGroup.setAttribute('data-dir', value);
        preview.setAttribute('data-dir', value);
        personLabel.textContent = value === 'owe' ? 'Who do you owe?' : 'Who owes you?';
        drawPreview();
      }

      setDir(dirValue);
      drawSummary();
      drawDue();
      drawNote();

      dialog(existing ? 'Edit debt' : 'Add a debt',
        [preview, h('div', { class: 'acct-field' }, segGroup, dirError), person.wrap,
          h('div', { class: 'acct-row' }, total.wrap, paid.wrap), summary,
          dueWrap, note.wrap, addNote],
        async function () {
          const next = { dir: dirValue, person: person.control.value, note: note.control.value, cents: cents(total.control), paidCents: cents(paid.control), due: due.control.value,
            uid: canTag ? (linked ? linked.id : '') : (existing && existing.uid) || '' };
          const problems = SOC.validateDebt(next);
          if (problems) {
            if (problems.note) { note.wrap.hidden = false; addNote.hidden = true; }
            Object.keys(problems).forEach(function (k) { const c = document.getElementById('f-ov-' + k); if (c) c.setAttribute('aria-invalid', 'true'); });
            return problems;
          }
          const id = await SOC.saveDebt(owner, existing && existing.id, next);
          if (canTag && linked && notify.checked) {
            const first = linked.name.split(' ')[0];
            try { await SOC.notifyDebt(linked.id, id, next, book.currency); ctx.toast((existing ? 'Debt updated. ' : 'Debt added. ') + first + ' was notified.'); }
            catch (e) { ctx.toast('Debt saved, but we couldn\u2019t notify ' + first + '.'); }
          } else ctx.toast(existing ? 'Debt updated.' : 'Debt added.');
          debtDir = next.dir;
          return null;
        },
        existing ? function () { return SOC.deleteDebt(owner, existing.id); } : null);
      const form = preview.closest('form');
      if (form) form.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
      });
      if (!existing && !person.control.hidden) person.control.focus();
    }

    function goalForm(existing, isNew) {
      const g = existing || { name: '', kind: 'emergency', targetCents: 0, savedCents: 0, due: '' };
      const editing = existing && !isNew;
      const kind = input('kind', 'Fund type', { tag: 'select', options: Object.keys(SOC.GOAL_KINDS).map(function (k) { return h('option', { value: k }, SOC.GOAL_KINDS[k]); }) });
      kind.control.value = g.kind;
      const name = input('name', 'Goal name', { maxlength: 40, autocomplete: 'off', placeholder: 'e.g. Japan trip 2027' }, true);
      name.control.value = g.name;
      const target = input('targetCents', 'Target (' + book.currency + ')', moneyAttrs, true);
      const saved = input('savedCents', 'Saved so far (' + book.currency + ')', moneyAttrs, true);
      if (g.targetCents) target.control.value = (g.targetCents / 100).toFixed(2);
      if (editing || g.savedCents) saved.control.value = (g.savedCents / 100).toFixed(2);
      const due = input('due', 'Target date (optional)', { type: 'date' });
      due.control.value = g.due || '';
      const tip = h('p', { class: 'small muted ov-form-tip' });
      function drawTip() {
        if (kind.control.value === 'emergency') {
          const c = compute();
          tip.textContent = c.avgNeeds > 0
            ? 'Tip: 3 to 6 months of your needs is ' + money(c.avgNeeds * 3) + ' to ' + money(c.avgNeeds * 6) + '.'
            : 'Tip: aim for 3 to 6 months of essential expenses.';
          tip.hidden = false;
        } else tip.hidden = true;
        if (!name.control.value.trim() || Object.values(SOC.GOAL_KINDS).indexOf(name.control.value) !== -1) name.control.value = SOC.GOAL_KINDS[kind.control.value];
      }
      kind.control.addEventListener('change', drawTip);
      drawTip();
      dialog(editing ? 'Edit goal' : 'New savings goal',
        [h('div', { class: 'acct-row' }, kind.wrap, name.wrap), tip, h('div', { class: 'acct-row' }, target.wrap, saved.wrap), due.wrap],
        async function () {
          const next = { name: name.control.value, kind: kind.control.value, targetCents: cents(target.control), savedCents: cents(saved.control), due: due.control.value };
          const problems = SOC.validateGoal(next);
          if (problems) return problems;
          await SOC.saveGoal(owner, editing ? existing.id : null, next);
          ctx.toast(editing ? 'Goal updated.' : 'Goal added.');
          return null;
        },
        editing ? function () { return SOC.deleteGoal(owner, existing.id); } : null);
    }

    /* ---- Draw everything ---- */
    function draw() {
      const c = compute();
      lastC = c;
      drawHealth(c);
      drawKpis(c);
      drawChart(c);
      drawRecent();
      drawDebts(c);
      drawGoals(c);
    }
    draw();
    return { el: el, refresh: draw };
  }

  return { render: render, monthly: monthly };
})();

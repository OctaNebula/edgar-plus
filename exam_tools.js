// exam_tools.js — Edgar+ exam helpers. Runs in the page's main world (injected after edgar_main.js).
//   * EP.diff: line diff engine shared by the test diff and the code history preview
//   * Readable test diff under Edgar's test results
//   * Time spent per question and 15 / 5 minute warnings
(function () {
    'use strict';

    const EP = window.EdgarPlus = window.EdgarPlus || {};
    if (EP.examToolsLoaded) return;
    EP.examToolsLoaded = true;

    const setting = (name, def) => {
        try { return EP.getSetting ? EP.getSetting(name) : def; } catch (e) { return def; }
    };
    const enabled = () => !EP.isEnabled || EP.isEnabled();
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (msg, opts) => (EP.toast ? EP.toast(msg, opts) : console.log('Edgar+:', msg));
    const isExamPage = () => /^\/exam\/run(\/|$)/.test(location.pathname);

    // ==================================================================
    // Diff engine
    // ==================================================================

    // Lines without the final newline (a trailing '\n' doesn't create an extra empty line).
    function splitLines(s) {
        if (!s) return [];
        const lines = s.split('\n');
        if (lines[lines.length - 1] === '') lines.pop();
        return lines;
    }

    // LCS-based diff of two arrays of lines. Returns ops: {t: '=', a, b} | {t: '-', a} | {t: '+', b}
    function diffSeq(a, b) {
        let start = 0;
        while (start < a.length && start < b.length && a[start] === b[start]) start++;
        let endA = a.length;
        let endB = b.length;
        while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
        const n = endA - start;
        const m = endB - start;
        const ops = [];
        for (let i = 0; i < start; i++) ops.push({ t: '=', a: i, b: i });
        if (n * m > 1500000) {
            // Too big for an exact LCS: compare line by line.
            for (let i = 0; i < Math.max(n, m); i++) {
                if (i < n) ops.push({ t: '-', a: start + i });
                if (i < m) ops.push({ t: '+', b: start + i });
            }
        } else if (n > 0 || m > 0) {
            const W = m + 1;
            const dp = new Uint32Array((n + 1) * W);
            for (let i = n - 1; i >= 0; i--) {
                for (let j = m - 1; j >= 0; j--) {
                    dp[i * W + j] = a[start + i] === b[start + j]
                        ? dp[(i + 1) * W + j + 1] + 1
                        : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
                }
            }
            let i = 0;
            let j = 0;
            while (i < n && j < m) {
                if (a[start + i] === b[start + j]) { ops.push({ t: '=', a: start + i, b: start + j }); i++; j++; }
                else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) { ops.push({ t: '-', a: start + i }); i++; }
                else { ops.push({ t: '+', b: start + j }); j++; }
            }
            while (i < n) ops.push({ t: '-', a: start + i++ });
            while (j < m) ops.push({ t: '+', b: start + j++ });
        }
        for (let k = 0; k < a.length - endA; k++) ops.push({ t: '=', a: endA + k, b: endB + k });
        return ops;
    }

    // Side-by-side rows: {k: 'same'|'change'|'del'|'add', a, b} (line indices).
    function toRows(ops) {
        const rows = [];
        let dels = [];
        let adds = [];
        const flush = () => {
            const n = Math.max(dels.length, adds.length);
            for (let i = 0; i < n; i++) {
                if (i < dels.length && i < adds.length) rows.push({ k: 'change', a: dels[i], b: adds[i] });
                else if (i < dels.length) rows.push({ k: 'del', a: dels[i] });
                else rows.push({ k: 'add', b: adds[i] });
            }
            dels = [];
            adds = [];
        };
        for (const op of ops) {
            if (op.t === '=') { flush(); rows.push({ k: 'same', a: op.a, b: op.b }); }
            else if (op.t === '-') dels.push(op.a);
            else adds.push(op.b);
        }
        flush();
        return rows;
    }

    // Hide long runs of unchanged rows, keeping `context` rows around changes.
    function withContext(rows, context) {
        const keep = rows.map(r => r.k !== 'same');
        rows.forEach((r, i) => {
            if (r.k === 'same') return;
            for (let d = 1; d <= context; d++) {
                if (i - d >= 0) keep[i - d] = true;
                if (i + d < rows.length) keep[i + d] = true;
            }
        });
        const out = [];
        let skipped = 0;
        rows.forEach((r, i) => {
            if (keep[i]) {
                if (skipped) { out.push({ k: 'skip', n: skipped }); skipped = 0; }
                out.push(r);
            } else {
                skipped++;
            }
        });
        if (skipped) out.push({ k: 'skip', n: skipped });
        return out;
    }

    // Changed span inside a pair of lines (common prefix / suffix removed).
    function charSpan(x, y) {
        let p = 0;
        while (p < x.length && p < y.length && x[p] === y[p]) p++;
        let s = 0;
        while (s < x.length - p && s < y.length - p && x[x.length - 1 - s] === y[y.length - 1 - s]) s++;
        return { a: [p, x.length - s], b: [p, y.length - s] };
    }

    function describeChar(c) {
        if (c === undefined) return 'end of output';
        if (c === ' ') return 'a space';
        if (c === '\n') return 'a newline';
        if (c === '\t') return 'a tab';
        if (c === '\r') return 'a carriage return';
        const code = c.charCodeAt(0);
        if (code < 32) return `control character 0x${code.toString(16).padStart(2, '0')}`;
        return `<code>${esc(c)}</code>`;
    }

    function firstDifference(a, b) {
        let i = 0;
        while (i < a.length && i < b.length && a[i] === b[i]) i++;
        if (i === a.length && i === b.length) return null;
        const before = a.slice(0, i);
        const line = (before.match(/\n/g) || []).length + 1;
        const col = i - (before.lastIndexOf('\n') + 1) + 1;
        return { index: i, line, col, a: a[i], b: b[i] };
    }

    // Visible whitespace: all of it in changed lines, only trailing whitespace elsewhere.
    function renderText(str, showAll) {
        const ws = ch => (ch === '\t' ? '<span class="ep-ws">→</span>' : '<span class="ep-ws">·</span>');
        if (showAll) return esc(str).replace(/ |\t/g, ws);
        const m = str.match(/[ \t]+$/);
        if (!m) return esc(str);
        return esc(str.slice(0, m.index)) + esc(m[0]).replace(/ |\t/g, ws);
    }

    function renderLine(str, span, cls) {
        if (!span || span[0] >= span[1]) return renderText(str, !!span);
        return renderText(str.slice(0, span[0]), true) +
            `<span class="${cls}">${renderText(str.slice(span[0], span[1]), true) || '&#8203;'}</span>` +
            renderText(str.slice(span[1]), true);
    }

    /**
     * Side-by-side diff of two texts as HTML.
     * opts: { aLabel, bLabel, context (default 2), maxRows (default 400) }
     * Returns { html, equal, stats: {changed, removed, added}, first, trailingOnly, whitespaceOnly, eol }
     */
    function renderDiff(aText, bText, opts = {}) {
        const a = splitLines(aText);
        const b = splitLines(bText);
        const rows = toRows(diffSeq(a, b));
        const stats = { changed: 0, removed: 0, added: 0 };
        rows.forEach(r => {
            if (r.k === 'change') stats.changed++;
            else if (r.k === 'del') stats.removed++;
            else if (r.k === 'add') stats.added++;
        });
        const equal = aText === bText;
        const rstrip = t => splitLines(t).map(l => l.replace(/[ \t\r]+$/, '')).join('\n').replace(/\n+$/, '');
        const trailingOnly = !equal && rstrip(aText) === rstrip(bText);
        const whitespaceOnly = !equal && aText.replace(/\s+/g, '') === bText.replace(/\s+/g, '');
        const aEol = aText.endsWith('\n');
        const bEol = bText.endsWith('\n');
        const eol = aEol === bEol ? null : { a: aEol, b: bEol };

        const visible = withContext(rows, opts.context == null ? 2 : opts.context);
        const maxRows = opts.maxRows || 400;
        let shown = 0;
        const body = [];
        for (const r of visible) {
            if (shown >= maxRows) {
                body.push(`<tr class="ep-d-skip"><td colspan="4">… ${visible.length - shown} more rows not shown</td></tr>`);
                break;
            }
            shown++;
            if (r.k === 'skip') {
                body.push(`<tr class="ep-d-skip"><td colspan="4">⋯ ${r.n} matching line${r.n === 1 ? '' : 's'} ⋯</td></tr>`);
            } else if (r.k === 'same') {
                body.push(`<tr class="ep-d-same"><td class="ep-d-ln">${r.a + 1}</td><td class="ep-d-code">${renderText(a[r.a], false)}</td><td class="ep-d-ln">${r.b + 1}</td><td class="ep-d-code">${renderText(b[r.b], false)}</td></tr>`);
            } else if (r.k === 'change') {
                const sp = charSpan(a[r.a], b[r.b]);
                body.push(`<tr class="ep-d-change"><td class="ep-d-ln">${r.a + 1}</td><td class="ep-d-code ep-d-a">${renderLine(a[r.a], sp.a, 'ep-hl-a')}</td><td class="ep-d-ln">${r.b + 1}</td><td class="ep-d-code ep-d-b">${renderLine(b[r.b], sp.b, 'ep-hl-b')}</td></tr>`);
            } else if (r.k === 'del') {
                body.push(`<tr class="ep-d-del"><td class="ep-d-ln">${r.a + 1}</td><td class="ep-d-code ep-d-a">${renderText(a[r.a], true) || '&nbsp;'}</td><td class="ep-d-ln"></td><td class="ep-d-code ep-d-none"></td></tr>`);
            } else {
                body.push(`<tr class="ep-d-add"><td class="ep-d-ln"></td><td class="ep-d-code ep-d-none"></td><td class="ep-d-ln">${r.b + 1}</td><td class="ep-d-code ep-d-b">${renderText(b[r.b], true) || '&nbsp;'}</td></tr>`);
            }
        }
        const html = `<table class="ep-diff-table">
            <thead><tr><th></th><th>${esc(opts.aLabel || 'Before')}</th><th></th><th>${esc(opts.bLabel || 'After')}</th></tr></thead>
            <tbody>${body.join('') || '<tr class="ep-d-skip"><td colspan="4">(empty)</td></tr>'}</tbody></table>`;
        return { html, equal, stats, first: firstDifference(aText, bText), trailingOnly, whitespaceOnly, eol };
    }

    EP.diff = { splitLines, diffSeq, toRows, charSpan, firstDifference, renderDiff };

    // ==================================================================
    // Readable test diff
    // ==================================================================

    // Edgar shows spaces as '·' and newlines as '↵'. Turn the cell back into the real text.
    function decodeEdgarText(td) {
        const original = td.getAttribute('data-original-html'); // set when "Hide Output Marks" is on
        let raw;
        if (original != null) {
            const tmp = document.createElement('div');
            tmp.innerHTML = original;
            raw = tmp.textContent;
        } else {
            raw = td.textContent;
        }
        raw = raw.replace(/\r/g, '');
        if (raw.includes('↵')) raw = raw.replace(/\n/g, '').replace(/↵/g, '\n');
        return raw.replace(/·/g, ' ');
    }

    function readResultTable(table) {
        const cells = {};
        table.querySelectorAll(':scope > tbody > tr, :scope > tr').forEach(tr => {
            const tds = tr.children;
            if (tds.length < 2) return;
            const label = tds[0].textContent.trim().toLowerCase();
            if (label) cells[label] = { tr, td: tds[1] };
        });
        return cells;
    }

    const processed = new WeakMap(); // table -> signature

    function processTestTables() {
        const on = enabled() && setting('testDiff', true);
        document.querySelectorAll('table.code-results').forEach(table => {
            const cells = readResultTable(table);
            if (!on || !cells.expected || !cells.stdout) {
                removeTestDiff(table, cells);
                return;
            }
            const expected = decodeEdgarText(cells.expected.td);
            const actual = decodeEdgarText(cells.stdout.td);
            const sig = expected + '\u0000' + actual;
            if (processed.get(table) === sig && table.nextElementSibling && table.nextElementSibling.classList.contains('ep-testdiff')) return;
            processed.set(table, sig);
            removeTestDiff(table, cells);
            if (expected === actual) return;

            const d = renderDiff(expected, actual, { aLabel: 'Expected', bLabel: 'Your output' });
            let summary;
            if (d.first) {
                summary = `First difference at <b>line ${d.first.line}, column ${d.first.col}</b>: expected ${describeChar(d.first.a)}, your output has ${describeChar(d.first.b)}.`;
            } else {
                summary = 'Outputs differ.';
            }
            const badges = [];
            if (d.trailingOnly) badges.push('Only trailing spaces / empty lines differ');
            else if (d.whitespaceOnly) badges.push('Only whitespace differs');
            const eolNote = d.eol
                ? `<div class="ep-td-note">${d.eol.a ? 'The expected output ends with a newline; yours doesn\'t.' : 'Your output ends with a newline; the expected output doesn\'t.'}</div>` : '';

            const panel = document.createElement('div');
            panel.className = 'ep-testdiff edgar-plus-ui';
            panel.innerHTML = `
                <div class="ep-td-head">
                    <span class="ep-td-title">Edgar+ diff</span>
                    <span class="ep-td-summary">${summary}</span>
                    ${badges.map(b => `<span class="ep-td-badge">${esc(b)}</span>`).join('')}
                    ${cells.diff ? '<a href="#" class="ep-td-toggle">Show Edgar\'s diff</a>' : ''}
                </div>
                ${d.html}
                ${eolNote}
                <div class="ep-td-legend"><span class="ep-ws">·</span> space <span class="ep-ws">→</span> tab · highlighted: where the lines differ</div>`;
            table.insertAdjacentElement('afterend', panel);
            if (cells.diff) {
                cells.diff.tr.classList.add('ep-hide-row');
                panel.querySelector('.ep-td-toggle').addEventListener('click', (e) => {
                    e.preventDefault();
                    const hidden = cells.diff.tr.classList.toggle('ep-hide-row');
                    e.target.textContent = hidden ? 'Show Edgar\'s diff' : 'Hide Edgar\'s diff';
                });
            }
        });
    }

    function removeTestDiff(table, cells) {
        const next = table.nextElementSibling;
        if (next && next.classList.contains('ep-testdiff')) next.remove();
        const c = cells || readResultTable(table);
        if (c.diff) c.diff.tr.classList.remove('ep-hide-row');
    }

    function removeAllTestDiffs() {
        document.querySelectorAll('.ep-testdiff').forEach(p => p.remove());
        document.querySelectorAll('tr.ep-hide-row').forEach(tr => tr.classList.remove('ep-hide-row'));
    }

    // ==================================================================
    // Time per question + time warnings (exam pages)
    // ==================================================================
    const WARN_AT = [15 * 60, 5 * 60];
    const qt = { examId: null, times: {}, warned: [], ticks: 0, interval: null, widget: null, popover: null, loading: false };

    function fmtDuration(sec) {
        sec = Math.max(0, Math.floor(sec || 0));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const p = n => String(n).padStart(2, '0');
        return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
    }

    function readRemainingSeconds() {
        const timer = document.getElementById('aii-countdown');
        if (!timer) return null;
        const text = timer.textContent.trim();
        const t = text.match(/(?:(\d+):)?(\d+):(\d+)/);
        if (!t) return null;
        let sec = (t[1] ? parseInt(t[1], 10) : 0) * 3600 + parseInt(t[2], 10) * 60 + parseInt(t[3], 10);
        const d = text.match(/(\d+)\s+days?/i);
        if (d) sec += parseInt(d[1], 10) * 86400;
        return sec;
    }

    function currentOrdinal() {
        const m = location.pathname.match(/^\/exam\/run\/(\d+)/);
        return m ? m[1] : null;
    }

    function saveTimes() {
        if (!qt.examId) return;
        try {
            localStorage.setItem('edgar_plus_qtime_' + qt.examId, JSON.stringify(qt.times));
            localStorage.setItem('edgar_plus_warned_' + qt.examId, JSON.stringify(qt.warned));
        } catch (e) { /* storage full: not critical */ }
    }

    async function ensureTimeTracking() {
        if (qt.interval || qt.loading || !isExamPage() || !enabled()) return;
        qt.loading = true;
        try {
            const id = EP.getExamId ? await EP.getExamId() : null;
            if (!id || !isExamPage() || !enabled()) return;
            qt.examId = id;
            try { qt.times = JSON.parse(localStorage.getItem('edgar_plus_qtime_' + id) || '{}') || {}; } catch (e) { qt.times = {}; }
            try { qt.warned = JSON.parse(localStorage.getItem('edgar_plus_warned_' + id) || '[]') || []; } catch (e) { qt.warned = []; }
            qt.interval = setInterval(timeTick, 1000);
            window.addEventListener('pagehide', saveTimes);
            timeTick();
        } finally {
            qt.loading = false;
        }
    }

    function timeTick() {
        if (!enabled()) return;
        if (!isExamPage()) { removeTimeWidget(); return; }
        const ord = currentOrdinal();
        if (ord && document.visibilityState === 'visible' && setting('questionTimer', true)) {
            qt.times[ord] = (qt.times[ord] || 0) + 1;
            if (++qt.ticks % 5 === 0) saveTimes();
        }
        checkWarnings(readRemainingSeconds());
        renderTimeWidget(ord);
    }

    function checkWarnings(rem) {
        if (rem == null || rem <= 0 || !setting('timeWarnings', true)) return;
        const due = WARN_AT.filter(t => rem <= t && !qt.warned.includes(t));
        if (!due.length) return;
        // If several are due at once (e.g. page opened late), only announce the most urgent one.
        const t = Math.min(...due);
        WARN_AT.filter(x => x >= t).forEach(x => { if (!qt.warned.includes(x)) qt.warned.push(x); });
        saveTimes();
        const mins = Math.ceil(rem / 60);
        toast(`⏰ ${mins} minute${mins === 1 ? '' : 's'} left in the exam.`, { type: 'warning', duration: 10000 });
        const timer = document.getElementById('aii-countdown');
        if (timer) {
            timer.classList.add('ep-timer-flash');
            setTimeout(() => timer.classList.remove('ep-timer-flash'), 9000);
        }
    }

    function renderTimeWidget(ord) {
        if (!setting('questionTimer', true)) { removeTimeWidget(); return; }
        const timer = document.getElementById('aii-countdown');
        const anchor = timer && (timer.closest('clock') || timer);
        if (!anchor) return;
        if (!qt.widget || !qt.widget.isConnected) {
            qt.widget = document.createElement('button');
            qt.widget.type = 'button';
            qt.widget.className = 'ep-qtime edgar-plus-ui';
            qt.widget.title = 'Time spent on this question (counted while the exam tab is visible). Click for all questions.';
            qt.widget.addEventListener('click', toggleTimePopover);
            anchor.insertAdjacentElement('afterend', qt.widget);
        }
        const label = ord ? `⏱ Q${ord} · ${fmtDuration(qt.times[ord])}` : '⏱ Time per question';
        if (qt.widget.textContent !== label) qt.widget.textContent = label;

        // Tooltips on Edgar's question chips
        document.querySelectorAll('question-navigation .aii-qn').forEach(chip => {
            const m = chip.textContent.match(/\d+/);
            if (!m) return;
            const t = `${fmtDuration(qt.times[m[0]])} spent on question ${m[0]}`;
            if (chip.dataset.epTime !== t) {
                chip.dataset.epTime = t;
                updateChipTitle(chip);
            }
        });
        if (qt.popover && qt.popover.isConnected) fillTimePopover();
    }

    // Edgar's question chips get a tooltip from both the timer and the run status (edgar_main.js).
    function updateChipTitle(chip) {
        const parts = [chip.dataset.epTime, chip.dataset.epRunTitle].filter(Boolean);
        if (parts.length) chip.title = parts.join(' · ');
        else chip.removeAttribute('title');
    }
    EP.updateChipTitle = updateChipTitle;

    function toggleTimePopover(e) {
        e.stopPropagation();
        if (qt.popover && qt.popover.isConnected) { qt.popover.remove(); qt.popover = null; return; }
        qt.popover = document.createElement('div');
        qt.popover.className = 'ep-qtime-pop edgar-plus-ui';
        document.body.appendChild(qt.popover);
        const r = qt.widget.getBoundingClientRect();
        qt.popover.style.top = (r.bottom + 6) + 'px';
        qt.popover.style.left = Math.max(8, r.left) + 'px';
        fillTimePopover();
        const close = (ev) => {
            if (qt.popover && !qt.popover.contains(ev.target) && ev.target !== qt.widget) {
                qt.popover.remove();
                qt.popover = null;
                document.removeEventListener('mousedown', close, true);
            }
        };
        document.addEventListener('mousedown', close, true);
    }

    function fillTimePopover() {
        const chips = Array.from(document.querySelectorAll('question-navigation .aii-qn'))
            .map(c => (c.textContent.match(/\d+/) || [])[0]).filter(Boolean);
        const ords = Array.from(new Set(chips.concat(Object.keys(qt.times)))).sort((x, y) => x - y);
        const total = ords.reduce((s, o) => s + (qt.times[o] || 0), 0);
        const cur = currentOrdinal();
        const rem = readRemainingSeconds();
        const max = Math.max(1, ...ords.map(o => qt.times[o] || 0));
        qt.popover.innerHTML = `
            <div class="ep-qp-title">Time per question</div>
            ${ords.map(o => `
                <div class="ep-qp-row${o === cur ? ' current' : ''}">
                    <span class="ep-qp-q">Q${o}</span>
                    <span class="ep-qp-bar"><span style="width:${Math.round(100 * (qt.times[o] || 0) / max)}%"></span></span>
                    <span class="ep-qp-t">${fmtDuration(qt.times[o])}</span>
                </div>`).join('')}
            <div class="ep-qp-total">Total ${fmtDuration(total)}${rem != null ? ` · ${fmtDuration(rem)} left` : ''}</div>
            <div class="ep-qp-note">Counted only while this tab is visible. Stored in this browser.</div>`;
    }

    function removeTimeWidget() {
        if (qt.widget) qt.widget.remove();
        if (qt.popover) qt.popover.remove();
        qt.widget = null;
        qt.popover = null;
    }

    function stopTimeTracking() {
        saveTimes();
        clearInterval(qt.interval);
        qt.interval = null;
        removeTimeWidget();
        document.querySelectorAll('question-navigation .aii-qn').forEach(chip => {
            if (chip.dataset.epTime) {
                delete chip.dataset.epTime;
                updateChipTitle(chip);
            }
        });
        document.querySelectorAll('.ep-timer-flash').forEach(t => t.classList.remove('ep-timer-flash'));
    }

    // ==================================================================
    // Wiring
    // ==================================================================
    let scheduled = null;
    function schedule() {
        if (scheduled) return;
        scheduled = setTimeout(() => {
            scheduled = null;
            if (!enabled()) return;
            processTestTables();
            if (isExamPage()) ensureTimeTracking();
        }, 120);
    }

    const observer = new MutationObserver(records => {
        for (const r of records) {
            const el = r.target.nodeType === 1 ? r.target : r.target.parentElement;
            if (!el || !el.closest('.ace_editor, .edgar-plus-ui, #edgar-plus-archive, #edgar-plus-toasts, #edgar-plus-sidebar')) {
                schedule();
                return;
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    window.addEventListener('message', (e) => {
        if (e.source !== window || !e.data || e.data.source !== 'edgar-plus-cs') return;
        if (e.data.type === 'disable') {
            removeAllTestDiffs();
            stopTimeTracking();
        } else if (e.data.type === 'enable') {
            setTimeout(schedule, 50);
        }
    });

    // Called by the sidebar when an exam tool setting changes.
    EP.onExamToolSetting = (name) => {
        if (name === 'testDiff') {
            if (!setting('testDiff', true)) removeAllTestDiffs();
            processTestTables();
        } else if (name === 'questionTimer') {
            if (!setting('questionTimer', true)) removeTimeWidget();
            else if (isExamPage()) ensureTimeTracking();
        }
    };

    EP.examTools = { decodeEdgarText, readRemainingSeconds, fmtDuration, checkWarnings, processTestTables, qt };
    schedule();
})();

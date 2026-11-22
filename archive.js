// archive.js — Edgar+ Code Archive.
// Downloads everything you've submitted to Edgar (exam/lab answers incl. run history, tutorial code,
// playground snippets) into IndexedDB on edgar.fer.hr, and provides an in-page search overlay.
// Runs in the page's main world (injected by content.js) on every Edgar page.
(function () {
    'use strict';

    const EP = window.EdgarPlus = window.EdgarPlus || {};
    if (EP.archiveLoaded) return;
    EP.archiveLoaded = true;

    let enabled = true;

    // ------------------------------------------------------------------
    // Utilities
    // ------------------------------------------------------------------
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const escapeHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    // Accent folding so "pokazivac" finds "pokazivač". Keeps string length (for highlighting).
    const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
    const fmtText = s => escapeHtml(s).replace(/`([^`]+)`/g, '<code>$1</code>');
    // Cheat sheet language (Edgar+ setting "Cheat Sheet Language"): 'hr' or 'en'
    const LANG_KEY = 'edgar_plus_lang';
    const getLang = () => {
        let v = null;
        try { v = EP.getSetting ? EP.getSetting('lang') : localStorage.getItem(LANG_KEY); } catch (e) { /* ignore */ }
        return v === 'en' ? 'en' : 'hr';
    };
    const L = (hr, en) => (getLang() === 'en' ? en : hr);
    const trCell = (s, lg) => String(s).replace(/\{\{([^{}|]*)\|([^{}]*)\}\}/g, (m, a, b) => ((lg || getLang()) === 'en' ? b : a));
    const splitCat = c => { const i = c.indexOf(' / '); return i < 0 ? [c, c] : [c.slice(0, i), c.slice(i + 3)]; };

    function toast(msg, opts) {
        if (EP.toast) return EP.toast(msg, opts);
        console.log('Edgar+:', msg);
        return () => {};
    }

    function parseDate(s) {
        if (!s) return 0;
        const t = Date.parse(String(s).trim().replace(' ', 'T'));
        return isNaN(t) ? 0 : t;
    }
    function fmtDate(s) {
        const t = parseDate(s);
        if (!t) return '';
        const d = new Date(t);
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    function fmtTime(s) {
        const t = parseDate(s);
        if (!t) return '';
        const d = new Date(t);
        const p = n => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())}`;
    }
    function timeAgo(ts) {
        const s = Math.round((Date.now() - ts) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.round(s / 60) + ' min ago';
        if (s < 86400) return Math.round(s / 3600) + ' h ago';
        const d = Math.round(s / 86400);
        return d === 1 ? 'yesterday' : d + ' days ago';
    }

    function guessLang(code, typeHint) {
        const t = (typeHint || '').toLowerCase();
        if (t.includes('sql')) return 'sql';
        if (t.includes('java') && !t.includes('javascript')) return 'java';
        if (t.includes('python')) return 'python';
        const c = code || '';
        if (/^\s*(select|with|insert|update|delete|create|alter|drop)\b/i.test(c) && !/#include/.test(c)) return 'sql';
        if (/\bpublic\s+(static\s+)?(class|void)\b|System\.out\./.test(c)) return 'java';
        if (!/#include|;\s*$/m.test(c) && /^\s*(def |import |from \S+ import |print\()/m.test(c)) return 'python';
        return 'c_cpp';
    }

    const isExamInProgressPage = () => /^\/exam\/run(\/|$)/.test(location.pathname);

    // ------------------------------------------------------------------
    // IndexedDB storage (origin: edgar.fer.hr)
    // ------------------------------------------------------------------
    const DB_NAME = 'edgar-plus-archive';
    let dbPromise = null;

    function db() {
        if (!dbPromise) {
            dbPromise = new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => {
                    const d = req.result;
                    if (!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'key' });
                    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
                    if (!d.objectStoreNames.contains('tasks')) d.createObjectStore('tasks', { keyPath: 'key' });
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
                req.onblocked = () => reject(new Error('Archive database is blocked by another tab.'));
            });
            dbPromise.catch(() => { dbPromise = null; });
        }
        return dbPromise;
    }
    const reqP = req => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
    const txDone = t => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transaction aborted')); });

    async function getAll(store) {
        const d = await db();
        return reqP(d.transaction(store).objectStore(store).getAll());
    }
    async function getMeta(k) {
        const d = await db();
        const r = await reqP(d.transaction('meta').objectStore('meta').get(k));
        return r ? r.v : undefined;
    }
    async function setMeta(k, v) {
        const d = await db();
        const t = d.transaction('meta', 'readwrite');
        t.objectStore('meta').put({ k, v });
        return txDone(t);
    }
    async function replaceEntries(prefix, entries) {
        const d = await db();
        const t = d.transaction('entries', 'readwrite');
        const s = t.objectStore('entries');
        s.delete(IDBKeyRange.bound(prefix, prefix + '￿'));
        entries.forEach(e => s.put(e));
        return txDone(t);
    }
    async function putTask(task) {
        const d = await db();
        const t = d.transaction('tasks', 'readwrite');
        t.objectStore('tasks').put(task);
        return txDone(t);
    }

    // ------------------------------------------------------------------
    // Fetching
    // ------------------------------------------------------------------
    async function fetchText(url) {
        const r = await fetch(url, { credentials: 'same-origin' });
        if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
        return r.text();
    }
    async function fetchDoc(url) {
        return new DOMParser().parseFromString(await fetchText(url), 'text/html');
    }
    async function fetchJSON(url) {
        const t = await fetchText(url);
        try { return JSON.parse(t); } catch (e) { throw new Error(`Unexpected response from ${url}`); }
    }

    // ------------------------------------------------------------------
    // Parsing an exam instance page (/test/instances/:id)
    // ------------------------------------------------------------------
    function tableByHeader(doc, test) {
        return Array.from(doc.querySelectorAll('table')).find(t => {
            const head = t.querySelector('thead');
            return head && test(text(head));
        });
    }
    function headerIndex(table) {
        const idx = {};
        Array.from(table.querySelectorAll('thead th')).forEach((th, i) => { idx[text(th)] = i; });
        return idx;
    }
    function tryJSON(s) {
        try { return JSON.parse(s); } catch (e) { return null; }
    }
    function resultFromScore(score) {
        if (!score) return null;
        if (score.is_correct) return 'correct';
        if (score.is_partial) return 'partial';
        if (score.is_incorrect) return 'incorrect';
        if (score.is_unanswered) return 'unanswered';
        return null;
    }

    function parseInstance(doc, id, fallbackTitle) {
        // Summary
        const summary = tableByHeader(doc, h => /Started/.test(h) && /Submitted/.test(h));
        let started = '';
        let submitted = '';
        if (summary) {
            const idx = headerIndex(summary);
            const row = summary.querySelector('tbody tr');
            if (row) {
                started = text(row.children[idx.Started]);
                submitted = text(row.children[idx.Submitted]);
            }
        }

        // Per-question status and score
        const statusByOrd = {};
        const byQ = tableByHeader(doc, h => /^#/.test(h) && /Correct/.test(h) && /Unanswered/.test(h) && !/Started/.test(h));
        if (byQ) {
            const idx = headerIndex(byQ);
            byQ.querySelectorAll('tbody tr').forEach(row => {
                const ord = parseInt(text(row.children[idx['#']]), 10);
                if (!ord) return;
                let status = null;
                for (const [col, st] of [['Correct', 'correct'], ['Partial', 'partial'], ['Incorrect', 'incorrect'], ['Unanswered', 'unanswered']]) {
                    const cell = row.children[idx[col]];
                    if (cell && (cell.querySelector('i, svg, img') || text(cell))) { status = st; break; }
                }
                const scoreCell = row.children[idx.Score];
                statusByOrd[ord] = { status, score: scoreCell ? text(scoreCell) : '' };
            });
        }

        // Event log
        const log = tableByHeader(doc, h => /Event name/.test(h));
        const events = [];
        if (log) {
            const idx = headerIndex(log);
            const iName = idx['Event name'] != null ? idx['Event name'] : 3;
            const iData = idx['Event data'] != null ? idx['Event data'] : 4;
            const iTs = idx['Client ts'] != null ? idx['Client ts'] : 2;
            log.querySelectorAll('tbody tr').forEach(row => {
                const c = row.children;
                if (!c[iName]) return;
                events.push({
                    name: c[iName].textContent.trim(),
                    data: c[iData] ? c[iData].textContent.trim() : '',
                    ts: c[iTs] ? c[iTs].textContent.trim() : ''
                });
            });
        }

        let title = fallbackTitle || ('Exam #' + id);
        let receivedAnswers = null;
        let submittedAnswers = null;
        const lastSaved = {};
        const questionIds = {};
        const versions = {};
        let currentOrd = 1;
        let pendingRun = null;
        let wasSubmitted = !!submitted;

        for (const ev of events) {
            switch (ev.name) {
                case 'Received exam.': {
                    const j = tryJSON(ev.data);
                    if (j) {
                        if (j.title) title = j.title;
                        if (Array.isArray(j.currAnswers)) receivedAnswers = j.currAnswers;
                    }
                    break;
                }
                case 'Question selected': {
                    const m = ev.data.match(/id:\s*(\d+)\s*,\s*ordinal:\s*(\d+)/);
                    if (m) {
                        currentOrd = parseInt(m[2], 10);
                        questionIds[currentOrd] = parseInt(m[1], 10);
                    }
                    break;
                }
                case 'Received question from web': {
                    const m = ev.data.match(/ordinal:\s*(\d+)/);
                    if (m) currentOrd = parseInt(m[1], 10);
                    break;
                }
                case 'Running code': {
                    pendingRun = { code: ev.data, ts: ev.ts, status: null, score: null };
                    (versions[currentOrd] = versions[currentOrd] || []).push(pendingRun);
                    break;
                }
                case 'Code exec result received': {
                    const j = tryJSON(ev.data);
                    if (pendingRun && j) {
                        pendingRun.status = j.success === false ? 'error' : resultFromScore(j.score);
                        pendingRun.score = j.score && j.score.score_perc != null ? Math.round(j.score.score_perc * 100) / 100 : null;
                    }
                    pendingRun = null;
                    break;
                }
                case 'Answer saved': {
                    const j = tryJSON(ev.data);
                    if (j && j.ordinal) lastSaved[j.ordinal] = j.answer;
                    break;
                }
                case 'Submitting exam.': {
                    const j = tryJSON(ev.data);
                    if (Array.isArray(j)) submittedAnswers = j;
                    wasSubmitted = true;
                    break;
                }
                case 'Exam submitted.':
                    wasSubmitted = true;
                    break;
            }
        }

        const ordinals = new Set([
            ...Object.keys(statusByOrd), ...Object.keys(lastSaved), ...Object.keys(versions), ...Object.keys(questionIds)
        ].map(Number));
        (submittedAnswers || receivedAnswers || []).forEach((_, i) => ordinals.add(i + 1));

        const entries = [];
        for (const ord of Array.from(ordinals).filter(Boolean).sort((a, b) => a - b)) {
            const answer = (submittedAnswers && submittedAnswers[ord - 1]) || lastSaved[ord] ||
                (receivedAnswers && receivedAnswers[ord - 1]) || null;
            const runs = versions[ord] || [];
            let code = answer && answer.codeAnswer && typeof answer.codeAnswer.code === 'string' ? answer.codeAnswer.code : '';
            if (!code.trim() && runs.length) code = runs[runs.length - 1].code;
            const type = (answer && answer.type) || '';
            const freeText = answer && typeof answer.textAnswer === 'string' ? answer.textAnswer.trim() : '';

            let kind;
            if (code.trim()) kind = 'code';
            else if (freeText && !/ABC/i.test(type)) kind = 'text';
            else continue;

            // Distinct run versions, keeping the latest result for repeated identical runs
            const seen = new Map();
            runs.forEach(v => {
                if (!v.code.trim()) return;
                if (seen.has(v.code)) seen.delete(v.code);
                seen.set(v.code, v);
            });
            const distinct = Array.from(seen.values()).sort((a, b) => parseDate(a.ts) - parseDate(b.ts)).slice(-60);

            const st = statusByOrd[ord] || {};
            entries.push({
                key: `exam:${id}:${ord}`,
                source: 'exam',
                instanceId: id,
                ordinal: ord,
                questionId: questionIds[ord] || null,
                title,
                subtitle: `Question ${ord}`,
                date: started,
                status: st.status || null,
                score: st.score || '',
                type,
                kind,
                lang: kind === 'text' ? 'text' : guessLang(code, type),
                code: kind === 'text' ? freeText : code,
                versions: kind === 'code' ? distinct : [],
                fetchedAt: Date.now()
            });
        }

        return { title, started, complete: wasSubmitted, entries, eventCount: events.length };
    }

    // ------------------------------------------------------------------
    // Sync
    // ------------------------------------------------------------------
    const sync = {
        running: false,
        cancel: false,
        progress: { text: '', fraction: 0 }
    };

    function setProgress(textMsg, fraction) {
        sync.progress = { text: textMsg, fraction: fraction == null ? sync.progress.fraction : fraction };
        renderProgress();
    }

    async function syncExams(full, errors) {
        setProgress('Reading your exam list…', 0.02);
        const listDoc = await fetchDoc('/test/instances');
        const seen = new Map();
        listDoc.querySelectorAll('a[href^="/test/instances/"]').forEach(a => {
            const m = a.getAttribute('href').match(/^\/test\/instances\/(\d+)\/?$/);
            if (m && !seen.has(m[1])) seen.set(m[1], text(a));
        });
        if (!seen.size && !listDoc.querySelector('table')) {
            throw new Error('Could not read "My previous exams". Are you logged in to Edgar?');
        }
        const known = (await getMeta('instances')) || {};
        const todo = Array.from(seen.entries()).filter(([id]) => full || !known[id] || !known[id].complete);
        let done = 0;
        for (const [id, title] of todo) {
            if (sync.cancel) return done;
            setProgress(`Exam ${done + 1}/${todo.length}: ${title}`, 0.05 + 0.75 * (done / Math.max(1, todo.length)));
            try {
                const doc = await fetchDoc(`/test/instances/${id}`);
                const parsed = parseInstance(doc, Number(id), title);
                await replaceEntries(`exam:${id}:`, parsed.entries);
                known[id] = { complete: parsed.complete, title: parsed.title, fetchedAt: Date.now(), count: parsed.entries.length };
                await setMeta('instances', known);
            } catch (e) {
                errors.push(`${title}: ${e.message}`);
            }
            done++;
            await sleep(150);
        }
        return done;
    }

    async function syncTutorials(errors) {
        setProgress('Reading your tutorials…', 0.82);
        const home = await fetchDoc('/');
        const tutorials = [];
        const seen = new Set();
        home.querySelectorAll('a[href^="/tutorial/"]').forEach(a => {
            const m = a.getAttribute('href').match(/^\/tutorial\/(\d+)\/?$/);
            if (!m || seen.has(m[1])) return;
            // Only tutorials you have actually started ("Start" means never opened)
            if (/^start$/i.test(a.textContent.trim())) return;
            seen.add(m[1]);
            const row = a.closest('tr');
            let title = '';
            let started = '';
            if (row) {
                const table = row.closest('table');
                const idx = table ? headerIndex(table) : {};
                title = text(row.children[idx.Title != null ? idx.Title : 1]);
                started = text(row.children[idx.Started != null ? idx.Started : 5]);
            }
            tutorials.push({ id: m[1], title, started });
        });

        let count = 0;
        for (const [n, t] of tutorials.entries()) {
            if (sync.cancel) return count;
            setProgress(`Tutorial ${n + 1}/${tutorials.length}: ${t.title || t.id}`, 0.82 + 0.1 * (n / Math.max(1, tutorials.length)));
            try {
                const data = await fetchJSON(`/tutorial/api/${t.id}`);
                const title = data.title || t.title || ('Tutorial #' + t.id);
                const steps = Array.isArray(data.steps) ? data.steps : [];
                const answers = Array.isArray(data.currAnswers) ? data.currAnswers : [];
                const entries = [];
                for (let si = 0; si < answers.length; si++) {
                    const qs = Array.isArray(answers[si]) ? answers[si] : [];
                    const withCode = qs.filter(q => q && q.currAnswer && q.currAnswer.codeAnswer &&
                        typeof q.currAnswer.codeAnswer.code === 'string' && q.currAnswer.codeAnswer.code.trim());
                    if (!withCode.length) continue;
                    const stepOrd = si + 1;
                    const stepMeta = steps.find(s => s.ordinal === stepOrd) || steps[si] || {};
                    let stepText = '';
                    let stepTitle = stepMeta.title || '';
                    try {
                        const step = await fetchJSON(`/tutorial/api/${t.id}/step/${stepOrd}`);
                        stepText = (step.text || '').trim();
                        if (!stepText && step.html) stepText = new DOMParser().parseFromString(step.html, 'text/html').body.textContent.trim();
                        stepTitle = step.title || stepTitle;
                    } catch (e) { /* step text is optional */ }
                    withCode.forEach((q, qi) => {
                        const qOrd = q.questionOrdinal || (qi + 1);
                        const code = q.currAnswer.codeAnswer.code;
                        entries.push({
                            key: `tut:${t.id}:${stepOrd}:${qOrd}`,
                            source: 'tutorial',
                            tutorialId: Number(t.id),
                            step: stepOrd,
                            question: qOrd,
                            title,
                            subtitle: `Step ${stepOrd}${stepTitle ? ': ' + stepTitle : ''}${withCode.length > 1 ? ' · Q' + qOrd : ''}`,
                            date: t.started,
                            status: q.correctStatus === true ? 'correct' : null,
                            kind: 'code',
                            lang: guessLang(code, q.currAnswer.type),
                            code,
                            task: stepText,
                            versions: [],
                            fetchedAt: Date.now()
                        });
                    });
                    await sleep(80);
                }
                await replaceEntries(`tut:${t.id}:`, entries);
                count++;
            } catch (e) {
                errors.push(`Tutorial ${t.title || t.id}: ${e.message}`);
            }
            await sleep(100);
        }
        return count;
    }

    async function syncSnippets(errors) {
        setProgress('Reading your playground snippets…', 0.93);
        let list;
        try {
            list = await fetchJSON('/playground/snippet/all');
        } catch (e) {
            errors.push('Snippets: ' + e.message);
            return 0;
        }
        const snippets = (list && list.success && Array.isArray(list.data)) ? list.data : [];
        const entries = [];
        for (const s of snippets) {
            if (sync.cancel) break;
            try {
                const r = await fetchJSON(`/playground/sandbox/snippet/code/${s.id}`);
                if (r && r.success && typeof r.code === 'string' && r.code.trim()) {
                    entries.push({
                        key: `snip:${s.id}`,
                        source: 'snippet',
                        title: s.title || ('Snippet #' + s.id),
                        subtitle: 'Playground snippet',
                        date: s.ts_modified || '',
                        status: null,
                        kind: 'code',
                        lang: guessLang(r.code),
                        code: r.code,
                        versions: [],
                        fetchedAt: Date.now()
                    });
                }
            } catch (e) {
                errors.push(`Snippet ${s.title || s.id}: ${e.message}`);
            }
            await sleep(80);
        }
        if (!sync.cancel) await replaceEntries('snip:', entries);
        return entries.length;
    }

    async function runSync(full) {
        if (sync.running) return;
        if (isExamInProgressPage()) {
            toast('Sync is disabled during an exam. Sync beforehand. Your archive works offline.', { duration: 6000 });
            return;
        }
        sync.running = true;
        sync.cancel = false;
        renderHeader();
        const errors = [];
        const counts = { exams: 0, tutorials: 0, snippets: 0 };
        try {
            counts.exams = await syncExams(full, errors);
            if (!sync.cancel) counts.tutorials = await syncTutorials(errors);
            if (!sync.cancel) counts.snippets = await syncSnippets(errors);
            if (!sync.cancel) await setMeta('lastSync', { ts: Date.now(), counts, errors });
            setProgress(sync.cancel ? 'Sync cancelled.' : 'Done.', 1);
            if (errors.length) {
                console.warn('Edgar+ archive sync errors:', errors);
                toast(`Archive synced with ${errors.length} problem(s). See the browser console for details.`, { type: 'error', duration: 7000 });
            } else if (!sync.cancel) {
                toast('Archive synced.');
            }
        } catch (e) {
            console.error('Edgar+ archive sync failed:', e);
            setProgress('Sync failed: ' + e.message, 0);
            toast('Archive sync failed: ' + e.message, { type: 'error', duration: 8000 });
        } finally {
            sync.running = false;
            await loadEntries();
            setTimeout(() => { if (!sync.running) setProgress('', 0); }, 2500);
        }
    }

    // ------------------------------------------------------------------
    // Capturing task text during exams (stored locally only)
    // ------------------------------------------------------------------
    const capturedTasks = {};
    let captureTimer = null;

    function scheduleCapture() {
        if (!enabled || captureTimer || !isExamInProgressPage()) return;
        captureTimer = setTimeout(captureTask, 1500);
    }

    async function captureTask() {
        captureTimer = null;
        const m = location.pathname.match(/^\/exam\/run\/(\d+)/);
        const el = document.querySelector('question-content-static');
        if (!m || !el) {
            clearSimilar();
            return;
        }
        const taskText = el.innerText.trim();
        if (!taskText) return;
        const ord = parseInt(m[1], 10);
        updateSimilar(el, ord).catch(e => console.warn('Edgar+: similar tasks failed', e));
        if (capturedTasks[ord] === taskText) return;
        capturedTasks[ord] = taskText;
        try {
            const examId = EP.getExamId ? await EP.getExamId() : null;
            if (!examId) return;
            await putTask({ key: `exam:${examId}:${ord}`, text: taskText, capturedAt: Date.now() });
        } catch (e) {
            console.warn('Edgar+: Could not store task text', e);
        }
    }

    // ------------------------------------------------------------------
    // Similar past tasks: identifiers from the current exam task, matched against the archive
    // ------------------------------------------------------------------
    const setting = (name, def) => {
        try { return EP.getSetting ? EP.getSetting(name) : def; } catch (e) { return def; }
    };
    const SIMILAR_STOP = new Set((
        'auto break case char const continue default do double else enum extern float for goto if inline int long ' +
        'register restrict return short signed sizeof static struct switch typedef union unsigned void volatile while ' +
        'bool true false null main include define ifdef ifndef endif elif pragma ' +
        'printf scanf fprintf fscanf sprintf sscanf snprintf puts gets fgets fputs putchar getchar fopen fclose fread ' +
        'fwrite fseek ftell rewind feof fflush malloc calloc realloc free strlen strcpy strncpy strcat strncat strcmp ' +
        'strncmp strchr strrchr strstr strtok strcspn memset memcpy memcmp atoi atof atol strtol strtod abs labs fabs ' +
        'sqrt pow ceil floor round exp log log10 sin cos tan qsort bsearch rand srand exit toupper tolower isdigit ' +
        'isalpha isalnum isspace isupper islower file stdin stdout stderr eof seek_set seek_cur seek_end size_t ' +
        'arr niz polje ptr tmp temp len count num val value res result sum suma broj data list item next prev ' +
        'index idx argc argv unesite upisite ispis ispisi primjer primjeri izvrsavanja program funkcija funkciju ' +
        'funkcije zadatak treba koji koja koje nije duljina duljinu'
    ).split(/\s+/));

    function taskTerms(el) {
        const terms = new Map();
        const add = (t, w) => {
            const k = (t || '').trim();
            if (k.length < 3 || /^\d/.test(k) || SIMILAR_STOP.has(fold(k).toLowerCase())) return;
            if (!terms.has(k) || terms.get(k) < w) terms.set(k, w);
        };
        el.querySelectorAll('pre, code').forEach(block => {
            if (block.parentElement && block.parentElement.closest('pre, code')) return; // nested <code> in <pre>
            const t = block.textContent;
            if (/[\u00B7\u21B5]/.test(t)) {
                // Example run: the program's expected output wording (weak signal)
                (t.replace(/[\u00B7\u21B5]/g, ' ').match(/[\p{L}_][\p{L}\p{N}_]{3,}/gu) || []).forEach(w => add(w, 0.5));
            } else {
                (t.match(/[A-Za-z_]\w*/g) || []).forEach(w => add(w, 1));
            }
        });
        const text = el.innerText || el.textContent || '';
        (text.match(/\b[A-Za-z_]\w*(?=\()/g) || []).forEach(w => add(w, 2));                    // name( : functions
        (text.match(/\b(?:struct|union|enum)\s+[A-Za-z_]\w*/g) || []).forEach(m => add(m.split(/\s+/).pop(), 1.5));
        (text.match(/\b[a-z]+[A-Z]\w*/g) || []).forEach(w => add(w, 1.5));                       // camelCase
        (text.match(/\b[A-Za-z]\w*_\w+/g) || []).forEach(w => add(w, 1.5));                     // snake_case
        (text.match(/\b[\w-]+\.(?:txt|bin|dat|csv)\b/gi) || []).forEach(w => add(w, 1.5));     // file names
        return Array.from(terms, ([t, w]) => ({ t, w })).sort((a, b) => b.w - a.w).slice(0, 40);
    }

    // "const char *txtFileName, int n" -> "const char*,int": parameter types only, names dropped.
    function paramTypes(params) {
        const p = params.trim();
        if (!p || p === 'void') return 'void';
        const parts = p.split(',').map(x => x.trim());
        const out = [];
        for (const part of parts) {
            if (part === '...') { out.push('...'); continue; }
            const toks = part.replace(/\[[^\]]*\]/g, ' [] ').match(/[A-Za-z_]\w*|\*|\[\]/g);
            if (!toks) return null;
            const idents = toks.filter(t => /^[A-Za-z_]/.test(t));
            if (idents.length < 2) return null; // not a declaration (e.g. a call like f(x))
            const lastIdent = toks.map((t, i) => (/^[A-Za-z_]/.test(t) ? i : -1)).filter(i => i >= 0).pop();
            if (toks.slice(lastIdent + 1).every(t => t === '[]')) toks.splice(lastIdent, 1);
            out.push(toks.join(' ').replace(/ ?\* ?/g, '*').replace(/ ?\[\] ?/g, '[]'));
        }
        return out.join(',');
    }

    function signaturesIn(text, definitionsOnly) {
        const sigs = new Set();
        const re = definitionsOnly ? /\b([A-Za-z_]\w*)\s*\(([^;{}()]*)\)\s*\{/g : /\b([A-Za-z_]\w*)\s*\(([^;{}()"']*)\)/g;
        let m;
        while ((m = re.exec(text))) {
            if (SIMILAR_STOP.has(m[1].toLowerCase())) continue;
            const types = paramTypes(m[2]);
            if (types) sigs.add(m[1] + '(' + types + ')');
        }
        return sigs;
    }

    function wordRe(term) {
        return new RegExp('(?:^|[^\\p{L}\\p{N}_])' + escapeRegExp(fold(term)) + '(?![\\p{L}\\p{N}_])', 'iu');
    }

    // Rank archived code by the identifiers it shares with the task, weighting rare identifiers higher.
    function findSimilar(terms, excludeInstanceId, taskSigs) {
        const pool = entries.filter(e => e.kind === 'code' && !(excludeInstanceId && e.instanceId === excludeInstanceId));
        const N = pool.length;
        if (!N || (!terms.length && !(taskSigs && taskSigs.size))) return [];
        const docs = pool.map(e => (e._f ? e._f.code + '\n' + e._f.task : fold(e.code + '\n' + (e.task || ''))));
        const scored = terms.map(x => {
            const re = wordRe(x.t);
            const hits = docs.map(d => re.test(d));
            return Object.assign({}, x, { hits, df: hits.filter(Boolean).length });
        }).filter(x => x.df > 0 && x.df <= Math.max(2, Math.ceil(N * 0.4)));
        const results = [];
        pool.forEach((e, i) => {
            let score = 0;
            let strong = false;
            const matched = [];
            scored.forEach(x => {
                if (!x.hits[i]) return;
                score += x.w * Math.log(1 + N / x.df);
                matched.push(x.t);
                if (x.w >= 1) strong = true;
            });
            // Same function signature (name + parameter types) as the task: very likely the same task.
            if (taskSigs && taskSigs.size) {
                if (!e._sigs) e._sigs = signaturesIn(e.code, true);
                taskSigs.forEach(sig => {
                    if (e._sigs.has(sig)) {
                        score += 6;
                        strong = true;
                        const label = sig.replace(/\(.*$/, '(…)');
                        if (!matched.includes(label)) matched.unshift(label);
                    }
                });
            }
            if (matched.length && strong && score >= 3) results.push({ entry: e, score, matched });
        });
        results.sort((a, b) => b.score - a.score || b.entry._date - a.entry._date);
        return results.slice(0, 12);
    }

    let similar = { key: '', ord: null, terms: [], results: [] };

    async function updateSimilar(el, ord) {
        if (!enabled || !setting('similarTasks', true)) {
            clearSimilar();
            return;
        }
        const key = ord + '\u0000' + el.innerText.trim();
        if (similar.key !== key || !entriesLoaded) {
            if (!entriesLoaded) await loadEntries();
            const examId = EP.getExamId ? await EP.getExamId() : null;
            const terms = taskTerms(el);
            similar = { key, ord, terms, results: findSimilar(terms, examId, signaturesIn(el.innerText || '', false)) };
        }
        updateSimilarBadges();
    }

    function clearSimilar() {
        if (similar.key || similar.results.length) similar = { key: '', ord: null, terms: [], results: [] };
        updateSimilarBadges();
    }

    const BULB_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"></path><path d="M10 22h4"></path><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"></path></svg>';

    function updateSimilarBadges() {
        const n = enabled && setting('similarTasks', true) ? similar.results.length : 0;
        document.querySelectorAll('.edgar-plus-toolbar').forEach(tb => {
            let b = tb.querySelector('.edgar-plus-similar-btn');
            if (!n) {
                if (b) b.remove();
                return;
            }
            if (!b) {
                b = document.createElement('button');
                b.type = 'button';
                b.className = 'edgar-plus-square-btn edgar-plus-similar-btn';
                b.addEventListener('click', (e) => {
                    e.stopPropagation();
                    open('archive', { similar: true });
                });
                tb.insertBefore(b, tb.querySelector('[data-action="cheatsheet"]'));
            }
            if (b.dataset.n !== String(n)) {
                b.dataset.n = String(n);
                b.innerHTML = `${BULB_ICON}<span>${n} similar</span>`;
                b.setAttribute('data-tooltip', `${n} archived solution${n === 1 ? '' : 's'} share identifiers with this task`);
            }
        });
    }

    EP.onSimilarSetting = () => {
        similar.key = '';
        if (setting('similarTasks', true)) scheduleCapture();
        else clearSimilar();
    };

    // ------------------------------------------------------------------
    // In-memory index + search
    // ------------------------------------------------------------------
    let entries = [];
    let entriesLoaded = false;
    let lastSyncInfo = null;
    let questionCounts = {};

    async function loadEntries() {
        try {
            const [all, tasks, last] = await Promise.all([getAll('entries'), getAll('tasks'), getMeta('lastSync')]);
            const taskMap = {};
            tasks.forEach(t => { taskMap[t.key] = t; });
            questionCounts = {};
            all.forEach(e => {
                if (!e.task && taskMap[e.key]) {
                    e.task = taskMap[e.key].text;
                    e.taskSource = 'captured';
                }
                e._date = parseDate(e.date);
                e._f = {
                    code: fold(e.code),
                    task: fold(e.task),
                    meta: fold(`${e.title} ${e.subtitle}`),
                    hist: fold((e.versions || []).map(v => v.code).join('\n'))
                };
                if (e.questionId) questionCounts[e.questionId] = (questionCounts[e.questionId] || 0) + 1;
            });
            entries = all;
            lastSyncInfo = last || null;
            entriesLoaded = true;
        } catch (e) {
            console.error('Edgar+: Could not load the archive', e);
            entries = [];
            entriesLoaded = true;
        }
        if (ui) { renderHeader(); runSearch(); }
    }

    function buildMatchers(query, opts) {
        query = query.trim();
        if (!query) return [];
        if (!opts.regex) query = fold(query);
        const flags = opts.caseSensitive ? 'g' : 'gi';
        if (opts.regex) {
            try {
                const re = new RegExp(query, flags + 'm');
                return [re];
            } catch (e) {
                return { error: e.message };
            }
        }
        const terms = [];
        const re = /"([^"]+)"|(\S+)/g;
        let m;
        while ((m = re.exec(query))) terms.push(m[1] || m[2]);
        return terms.map(t => new RegExp(escapeRegExp(t), flags));
    }

    // Match ranges in `line`; plain-text searches match against the accent-folded line.
    function lineRanges(line, matchers, opts) {
        if (!matchers.length) return [];
        if (opts && opts.regex) return findRanges(line, matchers);
        const f = fold(line);
        return f.length === line.length ? findRanges(f, matchers) : [];
    }

    function findRanges(line, matchers) {
        const ranges = [];
        for (const re of matchers) {
            re.lastIndex = 0;
            let m;
            let guard = 0;
            while ((m = re.exec(line)) && guard++ < 50) {
                if (m[0].length === 0) { re.lastIndex++; continue; }
                ranges.push([m.index, m.index + m[0].length]);
            }
        }
        ranges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        for (const r of ranges) {
            const last = merged[merged.length - 1];
            if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
            else merged.push(r.slice());
        }
        return merged;
    }

    function countMatches(s, re) {
        re.lastIndex = 0;
        let n = 0;
        let m;
        while ((m = re.exec(s)) && n < 1000) {
            if (m[0].length === 0) re.lastIndex++;
            n++;
        }
        return n;
    }

    function search(query, opts) {
        const matchers = buildMatchers(query, opts);
        if (matchers.error) return { error: matchers.error, results: [] };

        let pool = entries.filter(e => (opts.source === 'all' || e.source === opts.source) && (!opts.onlyCorrect || e.status === 'correct'));

        if (!matchers.length) {
            const results = pool.map(e => ({ entry: e, score: 0, lines: [], lineCount: 0, inHistory: false }));
            results.sort((a, b) => b.entry._date - a.entry._date || a.entry.key.localeCompare(b.entry.key));
            return { results, matchers };
        }

        const results = [];
        for (const e of pool) {
            const f = e._f || {};
            const code = opts.regex ? e.code : f.code;
            const meta = opts.regex ? `${e.title} ${e.subtitle}` : f.meta;
            const task = opts.regex ? (e.task || '') : f.task;
            const history = !opts.history ? '' : (opts.regex ? (e.versions || []).map(v => v.code).join('\n') : f.hist);
            let score = 0;
            let ok = true;
            let inHistoryOnly = false;
            for (const re of matchers) {
                const inCode = countMatches(code, re);
                const inTask = countMatches(task, re);
                const inMeta = countMatches(meta, re);
                const inHist = history ? countMatches(history, re) : 0;
                if (!inCode && !inTask && !inMeta && !inHist) { ok = false; break; }
                if (!inCode && !inTask && !inMeta && inHist) inHistoryOnly = true;
                score += (inCode ? 10 + Math.min(inCode, 20) : 0) + (inTask ? 4 + Math.min(inTask, 5) : 0) + (inMeta ? 6 : 0) + (inHist ? 1 : 0);
            }
            if (!ok) continue;
            const lines = [];
            let lineCount = 0;
            const searchLines = code.split('\n');
            e.code.split('\n').forEach((line, i) => {
                const sl = searchLines[i];
                const r = sl != null && sl.length === line.length ? findRanges(sl, matchers) : [];
                if (r.length) {
                    lineCount++;
                    if (lines.length < 4) lines.push({ n: i + 1, line, ranges: r });
                }
            });
            if (e.status === 'correct') score += 2;
            results.push({ entry: e, score, lines, lineCount, inHistory: inHistoryOnly });
        }
        results.sort((a, b) => b.score - a.score || b.entry._date - a.entry._date);
        return { results, matchers };
    }

    // ------------------------------------------------------------------
    // Cheat sheet index + search
    // ------------------------------------------------------------------
    let cheatItems = null;

    // ---- Personal snippets (localStorage) ----
    const MY_KEY = 'edgar_plus_my_snippets';
    const KINDS = ['toplevel', 'statements', 'program'];
    const newSnippetId = () => 'my-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);

    function detectKind(code) {
        if (/\bint\s+main\s*\(/.test(code)) return 'program';
        const t = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/^\s*#\s*include.*$/gm, '').trim();
        if (/^(#\s*define\b|typedef\b|struct\s+\w+\s*\{|enum\b|union\b)/.test(t)) return 'toplevel';
        if (/^[A-Za-z_][\w\s*]*?\b[A-Za-z_]\w*\s*\([^;{}]*\)\s*\{/.test(t)) return 'toplevel'; // function definition
        return 'statements';
    }

    // #include lines become `includes` (added at the top of the file on insert).
    function splitIncludes(code) {
        const includes = [];
        const rest = code.split('\n').filter(line => {
            const m = line.match(/^\s*#\s*include\s*<([\w./-]+)>\s*$/);
            if (m) {
                if (!includes.includes(m[1])) includes.push(m[1]);
                return false;
            }
            return true;
        }).join('\n').replace(/^(\s*\n)+/, '');
        return { includes, code: rest };
    }

    function sanitizeSnippet(x) {
        if (!x || typeof x !== 'object') return null;
        const title = typeof x.title === 'string' ? x.title.trim().slice(0, 200) : '';
        const code = typeof x.code === 'string' ? x.code.replace(/\r\n?/g, '\n').slice(0, 100000) : '';
        if (!title || !code.trim()) return null;
        return {
            id: typeof x.id === 'string' && /^[\w-]{1,64}$/.test(x.id) ? x.id : newSnippetId(),
            title,
            desc: typeof x.desc === 'string' ? x.desc.slice(0, 2000) : '',
            code,
            kind: KINDS.includes(x.kind) ? x.kind : detectKind(code),
            includes: Array.isArray(x.includes) ? x.includes.filter(h => typeof h === 'string' && /^[\w./-]{1,60}$/.test(h)).slice(0, 20) : [],
            created: Number(x.created) || Date.now(),
            updated: Number(x.updated) || Date.now()
        };
    }

    function loadMySnippets() {
        try {
            const raw = JSON.parse(localStorage.getItem(MY_KEY) || '[]');
            return Array.isArray(raw) ? raw.map(sanitizeSnippet).filter(Boolean) : [];
        } catch (e) {
            return [];
        }
    }

    function storeMySnippets(list) {
        try {
            localStorage.setItem(MY_KEY, JSON.stringify(list));
        } catch (e) {
            toast(L('Spremanje nije uspjelo: memorija preglednika je puna.', 'Could not save: browser storage is full.'), { type: 'error' });
            return false;
        }
        cheatItems = null;
        return true;
    }

    function getCheatItems() {
        if (cheatItems) return cheatItems;
        const cs = EP.cheatsheet || { snippets: [], reference: [], glossary: [] };
        const strip = s => (s || '').replace(/`/g, '');
        const items = [];
        loadMySnippets().forEach(m => items.push({
            type: 'snippet', key: 'mine:' + m.id, mine: true, catHr: 'Moji isječci', catEn: 'My snippets',
            item: { id: m.id, hr: m.title, en: m.title, dHr: m.desc, dEn: m.desc, code: m.code, codeEn: m.code, includes: m.includes, kind: m.kind, mine: m },
            fields: { title: m.title, tags: 'moji my mine', desc: m.desc, body: m.code }
        }));
        cs.snippets.forEach(s => {
            const [catHr, catEn] = splitCat(s.cat);
            items.push({
                type: 'snippet', key: 'snip:' + s.id, item: s, catHr, catEn,
                fields: { title: `${s.hr} ${s.en}`, tags: `${s.tags} ${s.cat}`, desc: strip(`${s.dHr} ${s.dEn}`), body: `${s.code}\n${s.codeEn || ''}` }
            });
        });
        cs.reference.forEach(r => {
            const cells = [r.cols.join(' ')].concat(r.rows.map(row => row.join(' '))).join('\n');
            items.push({
                type: 'reference', key: 'ref:' + r.id, item: r, catHr: 'Tablice', catEn: 'Tables',
                fields: {
                    title: `${r.hr} ${r.en}`, tags: r.tags || '',
                    desc: strip(`${r.noteHr || ''} ${r.noteEn || ''}`),
                    body: strip(trCell(cells, 'hr') + '\n' + trCell(cells, 'en'))
                }
            });
        });
        cs.glossary.forEach((g, i) => items.push({
            type: 'glossary', key: 'term:' + i, item: g, catHr: 'Pojmovnik', catEn: 'Glossary',
            fields: { title: `${g.hr} ${g.en}`, tags: '', desc: strip(`${g.dHr} ${g.dEn}`), body: '' }
        }));
        items.forEach(c => {
            c.folded = {};
            Object.keys(c.fields).forEach(k => { c.folded[k] = fold(c.fields[k]); });
        });
        cheatItems = items;
        return items;
    }

    const cheatTitle = c => L(c.item.hr, c.item.en);
    const cheatCat = c => L(c.catHr, c.catEn);
    const cheatCode = c => (getLang() === 'en' && c.item.codeEn) ? c.item.codeEn : c.item.code;

    function searchCheat(query, opts) {
        const matchers = buildMatchers(query, opts);
        if (matchers.error) return { error: matchers.error, results: [] };
        const pool = getCheatItems().filter(c => opts.cheatCat === 'all' || (opts.cheatCat === 'mine' ? c.mine : c.type === opts.cheatCat));
        if (!matchers.length) {
            return { results: pool.map(c => ({ entry: c, score: 0, lines: [], lineCount: 0 })), matchers };
        }
        const results = [];
        for (const c of pool) {
            const F = opts.regex ? c.fields : c.folded;
            let score = 0;
            let ok = true;
            for (const re of matchers) {
                const t = countMatches(F.title, re);
                const g = countMatches(F.tags, re);
                const d = countMatches(F.desc, re);
                const b = countMatches(F.body, re);
                if (!t && !g && !d && !b) { ok = false; break; }
                score += (t ? 30 : 0) + (g ? 12 : 0) + (d ? 5 + Math.min(d, 5) : 0) + (b ? 2 + Math.min(b, 10) : 0);
            }
            if (!ok) continue;
            const lines = [];
            let lineCount = 0;
            if (c.type === 'snippet') {
                const code = cheatCode(c);
                const srch = (opts.regex ? code : fold(code)).split('\n');
                code.split('\n').forEach((line, i) => {
                    const r = srch[i] != null && srch[i].length === line.length ? findRanges(srch[i], matchers) : [];
                    if (r.length) {
                        lineCount++;
                        if (lines.length < 3) lines.push({ n: i + 1, line, ranges: r });
                    }
                });
            }
            results.push({ entry: c, score, lines, lineCount });
        }
        results.sort((a, b) => b.score - a.score);
        return { results, matchers };
    }

    function highlightLine(line, ranges, maxLen = 160) {
        let start = 0;
        let end = line.length;
        if (line.length > maxLen) {
            const first = ranges.length ? ranges[0][0] : 0;
            start = Math.max(0, first - 40);
            end = Math.min(line.length, start + maxLen);
        }
        let out = start > 0 ? '…' : '';
        let pos = start;
        for (const [a, b] of ranges) {
            if (b <= start || a >= end) continue;
            const s = Math.max(a, start);
            const t = Math.min(b, end);
            out += escapeHtml(line.slice(pos, s)) + '<mark>' + escapeHtml(line.slice(s, t)) + '</mark>';
            pos = t;
        }
        out += escapeHtml(line.slice(pos, end)) + (end < line.length ? '…' : '');
        return out;
    }

    // ------------------------------------------------------------------
    // Overlay UI
    // ------------------------------------------------------------------
    let ui = null;
    const TAB_KEY = 'edgar_plus_overlay_tab';
    const state = {
        tab: (() => { try { return localStorage.getItem(TAB_KEY) === 'cheat' ? 'cheat' : 'archive'; } catch (e) { return 'archive'; } })(),
        query: '',
        regex: false,
        caseSensitive: false,
        history: false,
        onlyCorrect: false,
        source: 'all',
        cheatCat: 'all',
        results: [],
        matchers: [],
        selected: 0,
        version: -1,       // -1 = final answer, else index into entry.versions
        showTask: true,
        similarMode: false, // archive tab: showing "similar to the current task" results
        form: null          // cheat tab: { mode: 'new'|'edit', id } while the snippet form is open
    };
    let formEditor = null;
    let viewer = null;
    let viewerMarkers = [];
    let searchTimer = null;
    let prevOverflow = null;

    const placeholder = tab => (tab === 'archive'
        ? 'Search your past code. All words must match; use "quotes" for phrases (e.g. qsort strcmp, "struct prodaja")'
        : L('Pretraži isječke, tablice i pojmove (npr. qsort, pokazivač, IEEE, fopen, prioritet)',
            'Search snippets, tables and terms (e.g. qsort, pointer, IEEE, fopen, precedence)'));
    const CHIP_LABELS = {
        all: ['Sve', 'All'], mine: ['Moji', 'Mine'], snippet: ['Isječci koda', 'Snippets'],
        reference: ['Tablice', 'Tables'], glossary: ['Pojmovnik', 'Glossary']
    };
    const STATUS_BADGE = {
        correct: ['✓', 'epa-st-correct', 'Correct'],
        partial: ['◐', 'epa-st-partial', 'Partially correct'],
        incorrect: ['✗', 'epa-st-incorrect', 'Incorrect'],
        unanswered: ['–', 'epa-st-unanswered', 'Unanswered'],
        error: ['!', 'epa-st-incorrect', 'Error']
    };
    const SOURCE_LABEL = { exam: 'EXAM', tutorial: 'TUT', snippet: 'SNIP' };
    const CHEAT_BADGE = {
        snippet: [['KOD', 'CODE'], 'epa-src-code'],
        reference: [['TABLICA', 'TABLE'], 'epa-src-table'],
        glossary: [['POJAM', 'TERM'], 'epa-src-term']
    };
    const badgeFor = c => (c.mine ? [L('MOJE', 'MINE'), 'epa-src-mine'] : [L(CHEAT_BADGE[c.type][0][0], CHEAT_BADGE[c.type][0][1]), CHEAT_BADGE[c.type][1]]);
    const KIND_LABELS = {
        toplevel: ['Funkcije / tipovi (iznad trenutne funkcije)', 'Functions / types (above the current function)'],
        statements: ['Naredbe (na mjestu kursora)', 'Statements (at the cursor)'],
        program: ['Cijeli program', 'Whole program']
    };

    function buildUI() {
        if (ui) return;
        const root = document.createElement('div');
        root.id = 'edgar-plus-archive';
        root.className = 'edgar-plus-ui';
        root.innerHTML = `
            <div class="epa-backdrop" data-act="close"></div>
            <div class="epa-window" role="dialog" aria-label="Edgar+ Code Archive and Cheat Sheet">
                <div class="epa-header">
                    <div class="epa-title">Edgar+</div>
                    <div class="epa-tabs">
                        <button type="button" class="epa-tab" data-tab="archive">My code <span class="epa-tab-count"></span></button>
                        <button type="button" class="epa-tab" data-tab="cheat"><span class="epa-tab-label">Cheat sheet</span> <span class="epa-tab-count"></span></button>
                    </div>
                    <div class="epa-sync-info epa-only-archive"></div>
                    <div class="epa-header-actions">
                        <button type="button" class="epa-btn epa-btn-primary epa-only-archive" data-act="sync">Sync</button>
                        <button type="button" class="epa-btn epa-only-archive" data-act="export" title="Download your archive as JSON">Export</button>
                        <button type="button" class="epa-close" data-act="close" title="Close (Esc)">&times;</button>
                    </div>
                </div>
                <div class="epa-progress"><div class="epa-progress-bar"></div><span class="epa-progress-text"></span></div>
                <div class="epa-searchbar">
                    <input type="text" class="epa-search" spellcheck="false" autocomplete="off">
                    <label class="epa-opt" title="Regular expression"><input type="checkbox" data-opt="regex"><span>.*</span></label>
                    <label class="epa-opt" title="Match case"><input type="checkbox" data-opt="caseSensitive"><span>Aa</span></label>
                    <label class="epa-opt epa-only-archive" title="Also search every version you ran, not just the final answer"><input type="checkbox" data-opt="history"><span>Run history</span></label>
                </div>
                <div class="epa-filters">
                    <div class="epa-filter-group epa-only-archive">
                        <button type="button" class="epa-chip" data-src="all">All</button>
                        <button type="button" class="epa-chip" data-src="exam">Exams &amp; labs</button>
                        <button type="button" class="epa-chip" data-src="tutorial">Tutorials</button>
                        <button type="button" class="epa-chip" data-src="snippet">Snippets</button>
                        <label class="epa-opt epa-opt-right"><input type="checkbox" data-opt="onlyCorrect"><span>Only correct ✓</span></label>
                    </div>
                    <div class="epa-filter-group epa-only-cheat">
                        <button type="button" class="epa-chip" data-cat="all"></button>
                        <button type="button" class="epa-chip" data-cat="mine"></button>
                        <button type="button" class="epa-chip" data-cat="snippet"></button>
                        <button type="button" class="epa-chip" data-cat="reference"></button>
                        <button type="button" class="epa-chip" data-cat="glossary"></button>
                        <button type="button" class="epa-chip epa-chip-new" data-act="new-snippet"></button>
                        <div class="epa-lang-switch" title="Cheat sheet language (also in Edgar+ settings)">
                            <button type="button" data-lang="hr">HR</button><button type="button" data-lang="en">EN</button>
                        </div>
                    </div>
                </div>
                <div class="epa-body">
                    <div class="epa-results" tabindex="-1"></div>
                    <div class="epa-viewer">
                        <div class="epa-viewer-header"></div>
                        <div class="epa-task"></div>
                        <div class="epa-code"></div>
                        <pre class="epa-code-fallback"></pre>
                        <div class="epa-form" hidden>
                            <div class="epa-form-title"></div>
                            <label class="epa-f-label"><span data-l="title"></span><input type="text" class="epa-f-title" maxlength="200"></label>
                            <label class="epa-f-label"><span data-l="desc"></span><textarea class="epa-f-desc" rows="2" maxlength="2000"></textarea></label>
                            <label class="epa-f-label"><span data-l="kind"></span><select class="epa-f-kind"></select></label>
                            <div class="epa-f-code"></div>
                            <textarea class="epa-f-code-fallback" spellcheck="false" hidden></textarea>
                            <div class="epa-f-hint" data-l="hint"></div>
                            <div class="epa-f-actions">
                                <button type="button" class="epa-btn epa-btn-primary" data-act="form-save"></button>
                                <button type="button" class="epa-btn" data-act="form-cancel"></button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="epa-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> browse</span>
                    <span><kbd>Esc</kbd> close</span>
                    <span><kbd>Ctrl+Shift+F</kbd> toggle</span>
                    <span class="epa-footer-spacer"></span>
                    <a href="#" class="epa-only-archive" data-act="resync" title="Re-download everything, including exams that were already archived">Re-sync everything</a>
                    <span class="epa-only-cheat epa-my-io"><span data-l="mine-io"></span> <a href="#" data-act="export-mine"></a> · <a href="#" data-act="import-mine"></a></span>
                    <input type="file" class="epa-import-file" accept=".json,application/json" hidden>
                </div>
            </div>`;
        document.body.appendChild(root);

        ui = {
            root,
            viewerEl: root.querySelector('.epa-viewer'),
            syncInfo: root.querySelector('.epa-sync-info'),
            syncBtn: root.querySelector('[data-act="sync"]'),
            progress: root.querySelector('.epa-progress'),
            progressBar: root.querySelector('.epa-progress-bar'),
            progressText: root.querySelector('.epa-progress-text'),
            search: root.querySelector('.epa-search'),
            results: root.querySelector('.epa-results'),
            viewerHeader: root.querySelector('.epa-viewer-header'),
            task: root.querySelector('.epa-task'),
            code: root.querySelector('.epa-code'),
            fallback: root.querySelector('.epa-code-fallback'),
            form: root.querySelector('.epa-form'),
            fTitle: root.querySelector('.epa-f-title'),
            fDesc: root.querySelector('.epa-f-desc'),
            fKind: root.querySelector('.epa-f-kind'),
            fCode: root.querySelector('.epa-f-code'),
            fCodeFallback: root.querySelector('.epa-f-code-fallback'),
            importFile: root.querySelector('.epa-import-file')
        };

        ui.importFile.addEventListener('change', () => {
            const file = ui.importFile.files && ui.importFile.files[0];
            ui.importFile.value = '';
            if (file) importMySnippets(file);
        });

        ui.search.addEventListener('input', () => {
            state.query = ui.search.value;
            state.similarMode = false;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { state.selected = 0; state.version = -1; runSearch(); }, 120);
        });
        root.querySelectorAll('input[data-opt]').forEach(cb => {
            cb.checked = !!state[cb.dataset.opt];
            cb.addEventListener('change', () => {
                state[cb.dataset.opt] = cb.checked;
                state.selected = 0;
                runSearch();
            });
        });
        root.querySelectorAll('.epa-chip[data-src]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.source = chip.dataset.src;
                state.selected = 0;
                runSearch();
            });
        });
        root.querySelectorAll('.epa-chip[data-cat]').forEach(chip => {
            chip.addEventListener('click', () => {
                state.cheatCat = chip.dataset.cat;
                state.selected = 0;
                runSearch();
            });
        });
        root.querySelectorAll('.epa-tab').forEach(tab => {
            tab.addEventListener('click', () => setTab(tab.dataset.tab));
        });
        root.querySelectorAll('.epa-lang-switch button').forEach(b => {
            b.addEventListener('click', () => {
                try { localStorage.setItem(LANG_KEY, b.dataset.lang); } catch (e) { /* ignore */ }
                onLangChange();
                ui.search.focus();
            });
        });
        root.addEventListener('click', (e) => {
            const actEl = e.target.closest('[data-act]');
            if (actEl) {
                const act = actEl.dataset.act;
                if (act === 'close') { e.preventDefault(); close(); }
                else if (act === 'sync') { e.preventDefault(); if (sync.running) { sync.cancel = true; setProgress('Cancelling…'); } else runSync(false); }
                else if (act === 'resync') { e.preventDefault(); if (!sync.running) runSync(true); }
                else if (act === 'export') { e.preventDefault(); exportArchive(); }
                else if (act === 'copy') { e.preventDefault(); copyCurrent(); }
                else if (act === 'insert') { e.preventDefault(); insertCurrent(); }
                else if (act === 'toggle-task') { e.preventDefault(); state.showTask = !state.showTask; renderViewer(); }
                else if (act === 'clear-similar') { e.preventDefault(); state.similarMode = false; state.selected = 0; runSearch(); }
                else if (act === 'new-snippet') { e.preventDefault(); newSnippetFromEditor(); }
                else if (act === 'save-snippet') { e.preventDefault(); saveArchiveAsSnippet(); }
                else if (act === 'edit-snippet') { e.preventDefault(); editCurrentSnippet(); }
                else if (act === 'delete-snippet') { e.preventDefault(); deleteCurrentSnippet(actEl); }
                else if (act === 'form-save') { e.preventDefault(); saveForm(); }
                else if (act === 'form-cancel') { e.preventDefault(); closeForm(); renderViewer(); }
                else if (act === 'export-mine') { e.preventDefault(); exportMySnippets(); }
                else if (act === 'import-mine') { e.preventDefault(); ui.importFile.click(); }
                return;
            }
            const item = e.target.closest('.epa-item');
            if (item) {
                closeForm();
                state.selected = parseInt(item.dataset.index, 10);
                state.version = -1;
                renderResultsSelection();
                renderViewer();
            }
        });
        root.addEventListener('dblclick', (e) => {
            if (state.tab === 'cheat' && e.target.closest('.epa-item')) insertCurrent();
        });
        root.addEventListener('change', (e) => {
            if (e.target.classList.contains('epa-version')) {
                state.version = parseInt(e.target.value, 10);
                renderViewer();
            }
        });
        root.addEventListener('keydown', onOverlayKeydown);
        applyTabClasses();
    }

    function applyTabClasses() {
        if (!ui) return;
        ui.root.classList.toggle('epa-tab-archive', state.tab === 'archive');
        ui.root.classList.toggle('epa-tab-cheat', state.tab === 'cheat');
        ui.root.querySelectorAll('.epa-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
        ui.search.placeholder = placeholder(state.tab);
        ui.root.querySelector('.epa-tab-label').textContent = L('Šalabahter', 'Cheat sheet');
        ui.root.querySelectorAll('.epa-chip[data-cat]').forEach(chip => {
            const lbl = CHIP_LABELS[chip.dataset.cat];
            chip.textContent = L(lbl[0], lbl[1]);
        });
        ui.root.querySelectorAll('.epa-lang-switch button').forEach(b => b.classList.toggle('active', b.dataset.lang === getLang()));
        ui.root.querySelector('[data-act="new-snippet"]').textContent = L('＋ Novi isječak', '＋ New snippet');
        ui.root.querySelector('[data-act="new-snippet"]').title = L('Spremi vlastiti isječak (označeni kod u editoru se preuzima)', 'Save your own snippet (the code selected in your editor is used)');
        ui.root.querySelector('[data-l="mine-io"]').textContent = L('Moji isječci:', 'My snippets:');
        ui.root.querySelector('[data-act="export-mine"]').textContent = L('Izvezi', 'Export');
        ui.root.querySelector('[data-act="import-mine"]').textContent = L('Uvezi', 'Import');
        ui.form.querySelector('[data-l="title"]').textContent = L('Naslov', 'Title');
        ui.form.querySelector('[data-l="desc"]').textContent = L('Opis (neobavezno)', 'Description (optional)');
        ui.form.querySelector('[data-l="kind"]').textContent = L('Umetni kao', 'Insert as');
        ui.form.querySelector('[data-l="hint"]').textContent = L(
            'Retci #include spremaju se zasebno i pri umetanju se dodaju na vrh datoteke ako nedostaju. Ctrl+Enter sprema.',
            '#include lines are stored separately and added at the top of the file on insert if missing. Ctrl+Enter saves.');
        ui.form.querySelector('[data-act="form-save"]').textContent = L('Spremi isječak', 'Save snippet');
        ui.form.querySelector('[data-act="form-cancel"]').textContent = L('Odustani', 'Cancel');
        const kindVal = ui.fKind.value;
        ui.fKind.innerHTML = `<option value="auto">${L('Prepoznaj automatski', 'Detect automatically')}</option>` +
            KINDS.map(k => `<option value="${k}">${escapeHtml(L(KIND_LABELS[k][0], KIND_LABELS[k][1]))}</option>`).join('');
        ui.fKind.value = kindVal || 'auto';
        if (state.form) ui.form.querySelector('.epa-form-title').textContent = state.form.mode === 'edit' ? L('Uredi isječak', 'Edit snippet') : L('Novi isječak', 'New snippet');
    }

    function onLangChange() {
        if (!ui) return;
        applyTabClasses();
        if (state.tab === 'cheat') runSearch();
    }
    EP.onLangChange = onLangChange;

    function setTab(tab) {
        if (tab !== 'archive' && tab !== 'cheat') return;
        state.tab = tab;
        try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* ignore */ }
        state.selected = 0;
        state.version = -1;
        state.similarMode = false;
        closeForm();
        if (!ui) return;
        applyTabClasses();
        renderHeader();
        runSearch();
        ui.search.focus();
    }

    function onOverlayKeydown(e) {
        if (state.form && ui.form.contains(e.target)) {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                closeForm();
                renderViewer();
            } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveForm();
            }
            return;
        }
        if (e.key === 'Escape') {
            if (viewer && viewer.isFocused() && viewer.getSelectedText()) return;
            e.preventDefault();
            e.stopPropagation();
            close();
            return;
        }
        const inSearch = e.target === ui.search;
        const inResults = e.target === ui.results || ui.results.contains(e.target);
        if ((inSearch || inResults) && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            if (state.form) return; // don't throw away a half-written snippet
            const n = Math.min(state.results.length, RESULT_LIMIT);
            if (!n) return;
            state.selected = Math.max(0, Math.min(n - 1, state.selected + (e.key === 'ArrowDown' ? 1 : -1)));
            state.version = -1;
            renderResultsSelection(true);
            renderViewer();
        } else if (inSearch && e.key === 'Enter') {
            e.preventDefault();
            const r = state.results[state.selected];
            if (state.tab === 'cheat' && r && r.entry.type === 'snippet' && (e.ctrlKey || e.metaKey)) insertCurrent();
            else if (viewer && ui.code.style.display !== 'none') viewer.focus();
        }
    }

    function renderHeader() {
        if (!ui) return;
        const count = entries.length;
        let info = `${count} ${count === 1 ? 'entry' : 'entries'}`;
        if (lastSyncInfo && lastSyncInfo.ts) info += ` · synced ${timeAgo(lastSyncInfo.ts)}`;
        else info += ' · never synced';
        ui.syncInfo.textContent = info;
        const tabCounts = ui.root.querySelectorAll('.epa-tab-count');
        tabCounts[0].textContent = count;
        tabCounts[1].textContent = getCheatItems().length;
        const blocked = isExamInProgressPage();
        ui.syncBtn.textContent = sync.running ? 'Cancel' : 'Sync';
        ui.syncBtn.disabled = blocked && !sync.running;
        ui.syncBtn.title = blocked
            ? 'Sync is disabled during an exam. Sync beforehand. Your archive works offline.'
            : 'Download your latest answers from Edgar';
        renderProgress();
    }

    function renderProgress() {
        if (!ui) return;
        const show = state.tab === 'archive' && (sync.running || !!sync.progress.text);
        ui.progress.classList.toggle('active', show);
        ui.progressBar.style.width = Math.round((sync.progress.fraction || 0) * 100) + '%';
        ui.progressText.textContent = sync.progress.text || '';
    }

    function runSearch() {
        if (!ui) return;
        const res = state.tab === 'cheat' ? searchCheat(state.query, state)
            : (state.similarMode ? similarResults() : search(state.query, state));
        state.results = res.results;
        state.matchers = Array.isArray(res.matchers) ? res.matchers : [];
        if (state.selected >= state.results.length) state.selected = 0;
        ui.root.querySelectorAll('.epa-chip[data-src]').forEach(chip => {
            const src = chip.dataset.src;
            chip.classList.toggle('active', state.source === src);
            chip.dataset.count = src === 'all' ? entries.length : entries.filter(e => e.source === src).length;
        });
        const items = getCheatItems();
        ui.root.querySelectorAll('.epa-chip[data-cat]').forEach(chip => {
            const cat = chip.dataset.cat;
            chip.classList.toggle('active', state.cheatCat === cat);
            chip.dataset.count = cat === 'all' ? items.length : items.filter(c => (cat === 'mine' ? c.mine : c.type === cat)).length;
        });
        ui.search.classList.toggle('epa-invalid', !!res.error);
        ui.search.title = res.error ? 'Invalid regex: ' + res.error : '';
        renderResults();
        renderViewer();
    }

    const RESULT_LIMIT = 300;

    function similarResults() {
        const used = new Set();
        similar.results.forEach(r => r.matched.forEach(t => used.add(t.replace(/\(…\)$/, ''))));
        const matchers = Array.from(used).map(t => new RegExp(escapeRegExp(fold(t)), 'gi'));
        const results = similar.results.map(r => {
            const lines = [];
            let lineCount = 0;
            const folded = (r.entry._f ? r.entry._f.code : fold(r.entry.code)).split('\n');
            r.entry.code.split('\n').forEach((line, i) => {
                const sl = folded[i];
                const rg = sl != null && sl.length === line.length ? findRanges(sl, matchers) : [];
                if (rg.length) {
                    lineCount++;
                    if (lines.length < 4) lines.push({ n: i + 1, line, ranges: rg });
                }
            });
            return { entry: r.entry, score: r.score, lines, lineCount, matched: r.matched };
        });
        return { results, matchers };
    }

    function renderResults() {
        if (state.tab === 'cheat') return renderCheatResults();
        const list = state.results;
        if (!entriesLoaded) {
            ui.results.innerHTML = '<div class="epa-empty">Loading…</div>';
            return;
        }
        if (!entries.length) {
            ui.results.innerHTML = `<div class="epa-empty">
                <p><strong>Your archive is empty.</strong></p>
                <p>Click <em>Sync</em> to download everything you've submitted to Edgar: exam and lab answers (including every version you ran), tutorial code and playground snippets.</p>
                <p>Sync <strong>before</strong> the exam. The archive is stored in this browser and searching works offline.</p>
                <p>Meanwhile, the <a href="#" data-act="none" class="epa-goto-cheat">Cheat sheet</a> tab works right away.</p>
            </div>`;
            const link = ui.results.querySelector('.epa-goto-cheat');
            if (link) link.addEventListener('click', (e) => { e.preventDefault(); setTab('cheat'); });
            return;
        }
        const html = [];
        if (state.similarMode) {
            const used = Array.from(new Set(list.flatMap(r => r.matched || [])));
            html.push(`<div class="epa-similar-banner"><b>Similar to the current task</b>${used.length ? ' · shared identifiers: ' + used.slice(0, 10).map(t => `<code>${escapeHtml(t)}</code>`).join(' ') : ''}
                <a href="#" data-act="clear-similar">Show everything</a></div>`);
            if (!list.length) html.push('<div class="epa-empty">No archived solution shares identifiers with this task.</div>');
        } else if (!list.length) {
            ui.results.innerHTML = '<div class="epa-empty">No matches.</div>';
            return;
        }
        list.slice(0, RESULT_LIMIT).forEach((r, i) => {
            const e = r.entry;
            const st = STATUS_BADGE[e.status];
            const seen = e.questionId && questionCounts[e.questionId] > 1 ? `<span class="epa-seen" title="This exact task appears in ${questionCounts[e.questionId]} of your exams">×${questionCounts[e.questionId]}</span>` : '';
            const lines = r.lines.map(l => `<div class="epa-line"><span class="epa-ln">${l.n}</span><code>${highlightLine(l.line, l.ranges)}</code></div>`).join('');
            const more = r.lineCount > r.lines.length ? `<div class="epa-more">+${r.lineCount - r.lines.length} more matching line(s)</div>` : '';
            const hist = (r.inHistory ? '<div class="epa-more">Match found in run history</div>' : '') +
                (r.matched ? `<div class="epa-more">Shared: ${r.matched.slice(0, 6).map(escapeHtml).join(', ')}</div>` : '');
            html.push(`
                <div class="epa-item${i === state.selected ? ' selected' : ''}" data-index="${i}">
                    <div class="epa-item-head">
                        <span class="epa-src epa-src-${e.source}">${SOURCE_LABEL[e.source] || ''}</span>
                        <span class="epa-item-title">${escapeHtml(e.title)}</span>
                        ${st ? `<span class="epa-st ${st[1]}" title="${st[2]}">${st[0]}</span>` : ''}
                        ${seen}
                        <span class="epa-date">${escapeHtml(fmtDate(e.date))}</span>
                    </div>
                    <div class="epa-item-sub">${escapeHtml(e.subtitle || '')}${e.task ? ' <span class="epa-has-task" title="Task text available">· task</span>' : ''}</div>
                    ${lines}${more}${hist}
                </div>`);
        });
        if (list.length > RESULT_LIMIT) html.push(`<div class="epa-empty">Showing ${RESULT_LIMIT} of ${list.length} results. Refine your search.</div>`);
        ui.results.innerHTML = html.join('');
    }

    function renderCheatResults() {
        const list = state.results;
        if (!list.length) {
            ui.results.innerHTML = `<div class="epa-empty">${L('Nema rezultata.', 'No matches.')}</div>`;
            return;
        }
        const html = [];
        let lastCat = null;
        const grouped = !state.matchers.length;
        list.slice(0, RESULT_LIMIT).forEach((r, i) => {
            const c = r.entry;
            const cat = cheatCat(c);
            if (grouped && cat !== lastCat) {
                html.push(`<div class="epa-group">${escapeHtml(cat)}</div>`);
                lastCat = cat;
            }
            let body = '';
            if (c.type === 'glossary') {
                body = `<div class="epa-def">${fmtText(L(c.item.dHr, c.item.dEn))}</div>`;
            } else if (c.type === 'snippet' && !r.lines.length) {
                const d = L(c.item.dHr, c.item.dEn);
                body = d ? `<div class="epa-def">${fmtText(d)}</div>` : '';
            } else {
                body = r.lines.map(l => `<div class="epa-line"><span class="epa-ln">${l.n}</span><code>${highlightLine(l.line, l.ranges)}</code></div>`).join('');
            }
            html.push(`
                <div class="epa-item${i === state.selected ? ' selected' : ''}" data-index="${i}">
                    <div class="epa-item-head">
                        <span class="epa-src ${badgeFor(c)[1]}">${badgeFor(c)[0]}</span>
                        <span class="epa-item-title">${escapeHtml(cheatTitle(c))}</span>
                    </div>
                    ${grouped ? '' : `<div class="epa-item-sub">${escapeHtml(cat)}</div>`}
                    ${body}
                </div>`);
        });
        ui.results.innerHTML = html.join('');
    }

    function renderResultsSelection(scroll) {
        ui.results.querySelectorAll('.epa-item.selected').forEach(el => el.classList.remove('selected'));
        const el = ui.results.querySelector(`.epa-item[data-index="${state.selected}"]`);
        if (el) {
            el.classList.add('selected');
            if (scroll) el.scrollIntoView({ block: 'nearest' });
        }
    }

    function currentCode() {
        const r = state.results[state.selected];
        if (!r) return '';
        if (state.tab === 'cheat') return r.entry.type === 'snippet' ? cheatCode(r.entry) : '';
        const e = r.entry;
        if (state.version >= 0 && e.versions && e.versions[state.version]) return e.versions[state.version].code;
        return e.code;
    }

    function ensureViewer() {
        if (viewer || !window.ace) return viewer;
        try {
            const assets = EP.assets || {};
            if (assets.aceBasePath) ['basePath', 'modePath', 'themePath', 'workerPath'].forEach(k => ace.config.set(k, assets.aceBasePath));
            viewer = ace.edit(ui.code);
            viewer.setOptions({
                readOnly: true,
                highlightActiveLine: false,
                showPrintMargin: false,
                fontFamily: "Consolas, 'Courier New', monospace",
                fontSize: 14
            });
            viewer.renderer.$cursorLayer.element.style.opacity = 0;
            viewer.commands.bindKey('F1', null);
        } catch (e) {
            console.error('Edgar+: Archive viewer failed to start', e);
            viewer = null;
        }
        return viewer;
    }

    function showCode(code, lang) {
        ui.viewerEl.classList.remove('epa-doc-mode');
        const v = ensureViewer();
        if (v) {
            ui.code.style.display = '';
            ui.code.style.visibility = '';
            ui.fallback.style.display = 'none';
            const theme = (EP.getSetting && EP.getSetting('theme')) || localStorage.getItem('edgar_plus_theme') || 'ace/theme/edgar_plus';
            if (v.getTheme() !== theme) v.setTheme(theme);
            const mode = 'ace/mode/' + (lang === 'text' ? 'text' : (lang || 'c_cpp'));
            if (v.session.getMode().$id !== mode) v.session.setMode(mode);
            if (v.getValue() !== code) v.setValue(code, -1);
            highlightInViewer(v);
            v.resize(true);
        } else {
            ui.code.style.display = 'none';
            ui.fallback.style.display = 'block';
            ui.fallback.innerHTML = code.split('\n').map(l => highlightLine(l, lineRanges(l, state.matchers, state), 100000)).join('\n');
        }
    }

    function showDocOnly() {
        ui.viewerEl.classList.add('epa-doc-mode');
        ui.code.style.display = 'none';
        ui.fallback.style.display = 'none';
    }

    function renderViewer() {
        if (state.form) return; // the snippet form owns the viewer pane
        ui.form.hidden = true;
        ui.viewerEl.classList.remove('epa-form-mode');
        if (state.tab === 'cheat') return renderCheatViewer();
        const r = state.results[state.selected];
        if (!r) {
            ui.viewerHeader.innerHTML = '';
            ui.task.style.display = 'none';
            ui.viewerEl.classList.remove('epa-doc-mode');
            ui.code.style.visibility = 'hidden';
            ui.fallback.style.display = 'none';
            return;
        }
        const e = r.entry;
        const st = STATUS_BADGE[e.status];
        const versions = e.versions || [];
        const versionSelect = versions.length ? `
            <select class="epa-version" title="Every distinct version you ran during the exam">
                <option value="-1"${state.version === -1 ? ' selected' : ''}>Final answer</option>
                ${versions.map((v, i) => {
                    const vs = STATUS_BADGE[v.status];
                    const label = `Run ${i + 1}${v.ts ? ' · ' + fmtTime(v.ts) : ''}${vs ? ' · ' + vs[0] : ''}${v.score != null ? ' ' + v.score + '%' : ''}`;
                    return `<option value="${i}"${state.version === i ? ' selected' : ''}>${escapeHtml(label)}</option>`;
                }).join('')}
            </select>` : '';
        const link = e.source === 'exam' && e.instanceId
            ? `<a class="epa-link" href="/test/instances/${e.instanceId}" target="_blank" rel="noopener" title="Open this exam's log on Edgar (new tab)">log ↗</a>` : '';
        const meta = [
            fmtDate(e.date),
            e.score ? `score ${escapeHtml(e.score)}` : '',
            e.questionId ? `question #${e.questionId}` : ''
        ].filter(Boolean).join(' · ');
        ui.viewerHeader.innerHTML = `
            <div class="epa-vh-main">
                <div class="epa-vh-title">
                    <span class="epa-src epa-src-${e.source}">${SOURCE_LABEL[e.source] || ''}</span>
                    ${escapeHtml(e.title)} <span class="epa-vh-sub">${escapeHtml(e.subtitle || '')}</span>
                    ${st ? `<span class="epa-st ${st[1]}" title="${st[2]}">${st[0]} ${st[2]}</span>` : ''}
                </div>
                <div class="epa-vh-meta">${meta} ${link}</div>
            </div>
            <div class="epa-vh-actions">
                ${e.task ? `<button type="button" class="epa-btn" data-act="toggle-task">${state.showTask ? 'Hide task' : 'Show task'}</button>` : ''}
                ${versionSelect}
                <button type="button" class="epa-btn" data-act="save-snippet" title="Save this code (or just the selected part) as your own cheat sheet snippet">Save as snippet</button>
                <button type="button" class="epa-btn epa-btn-primary" data-act="copy">Copy code</button>
            </div>`;

        if (e.task && state.showTask) {
            ui.task.style.display = '';
            ui.task.innerHTML = `<div class="epa-task-label">${e.taskSource === 'captured' ? 'Task (saved while you took the exam)' : 'Tutorial step'}</div>` +
                '<div class="epa-task-text">' + e.task.split('\n').map(l => highlightLine(l, lineRanges(l, state.matchers, state), 100000)).join('<br>') + '</div>';
        } else {
            ui.task.style.display = 'none';
        }
        showCode(currentCode(), e.lang);
    }

    function renderCheatViewer() {
        const r = state.results[state.selected];
        if (!r) {
            ui.viewerHeader.innerHTML = '';
            ui.task.style.display = 'none';
            showDocOnly();
            return;
        }
        const c = r.entry;
        const it = c.item;
        const titleHtml = `
            <div class="epa-vh-main">
                <div class="epa-vh-title"><span class="epa-src ${badgeFor(c)[1]}">${badgeFor(c)[0]}</span> ${escapeHtml(cheatTitle(c))}</div>
                <div class="epa-vh-meta">${escapeHtml(cheatCat(c))}</div>
            </div>`;
        ui.task.style.display = '';

        if (c.type === 'snippet') {
            const canInsert = !!(EP.canInsert && EP.canInsert());
            ui.viewerHeader.innerHTML = titleHtml + `
                <div class="epa-vh-actions">
                    <button type="button" class="epa-btn epa-btn-primary" data-act="insert" ${canInsert ? '' : 'disabled'}
                        title="${escapeHtml(canInsert
                            ? L('Umetni na mjesto kursora u editoru (radi i dvoklik ili Ctrl+Enter)', 'Insert at the cursor in your editor (double-click or Ctrl+Enter also work)')
                            : L('Otvori zadatak s editorom koda da bi umetao isječke', 'Open a task with a code editor to insert snippets'))}">${L('Umetni u editor', 'Insert into editor')}</button>
                    <button type="button" class="epa-btn" data-act="copy">${L('Kopiraj', 'Copy')}</button>
                    ${c.mine ? `<button type="button" class="epa-btn" data-act="edit-snippet">${L('Uredi', 'Edit')}</button>
                    <button type="button" class="epa-btn epa-btn-danger" data-act="delete-snippet">${L('Obriši', 'Delete')}</button>` : ''}
                </div>`;
            const where = it.kind === 'toplevel'
                ? `<div class="epa-hint">${L('Funkcije se umeću iznad funkcije u kojoj je kursor.', 'Functions are inserted above the function containing the cursor.')}</div>` : '';
            const inc = it.includes && it.includes.length
                ? `<div class="epa-hint">${L('Treba', 'Needs')}: ${it.includes.map(h => `<code>#include &lt;${escapeHtml(h)}&gt;</code>`).join(' ')} (${L('dodaje se automatski', 'added automatically')})</div>` : '';
            const desc = L(it.dHr, it.dEn);
            const kindNote = c.mine ? `<div class="epa-hint">${L('Umeće se kao', 'Inserted as')}: ${escapeHtml(L(KIND_LABELS[it.kind][0], KIND_LABELS[it.kind][1]))}</div>` : '';
            ui.task.innerHTML = `${desc ? `<div class="epa-desc">${fmtText(desc)}</div>` : ''}${inc}${c.mine ? kindNote : where}`;
            ui.task.style.display = ui.task.innerHTML.trim() ? '' : 'none';
            showCode(cheatCode(c), 'c_cpp');
        } else if (c.type === 'reference') {
            ui.viewerHeader.innerHTML = titleHtml + '<div class="epa-vh-actions"></div>';
            const noteText = L(it.noteHr, it.noteEn);
            const note = noteText ? `<div class="epa-desc">${fmtText(noteText)}</div>` : '';
            const table = `<table class="epa-table"><thead><tr>${it.cols.map(h => `<th>${fmtText(trCell(h))}</th>`).join('')}</tr></thead>
                <tbody>${it.rows.map(row => `<tr>${row.map(cell => `<td>${fmtText(trCell(cell))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
            ui.task.innerHTML = table + note;
            showDocOnly();
        } else {
            ui.viewerHeader.innerHTML = titleHtml + '<div class="epa-vh-actions"></div>';
            ui.task.innerHTML = `
                <div class="epa-term">
                    <div class="epa-term-name">${escapeHtml(cheatTitle(c))}</div>
                    <div class="epa-term-def">${fmtText(L(it.dHr, it.dEn))}</div>
                </div>`;
            showDocOnly();
        }
    }

    function highlightInViewer(v) {
        const session = v.session;
        viewerMarkers.forEach(id => session.removeMarker(id));
        viewerMarkers = [];
        if (!state.matchers.length) {
            v.scrollToLine(0, false, false, () => {});
            return;
        }
        const Range = ace.require('ace/range').Range;
        let first = -1;
        const len = session.getLength();
        for (let row = 0; row < len && viewerMarkers.length < 500; row++) {
            lineRanges(session.getLine(row), state.matchers, state).forEach(([a, b]) => {
                viewerMarkers.push(session.addMarker(new Range(row, a, row, b), 'epa-hit', 'text', false));
                if (first < 0) first = row;
            });
        }
        v.scrollToLine(Math.max(0, first - 3), false, false, () => {});
    }

    // ---- Personal snippet form ----
    function openForm(opts) {
        state.form = { mode: opts.mode, id: opts.id || null };
        applyTabClasses();
        ui.viewerEl.classList.add('epa-form-mode');
        ui.form.hidden = false;
        ui.fTitle.value = opts.title || '';
        ui.fDesc.value = opts.desc || '';
        ui.fKind.value = opts.kind || 'auto';
        const code = opts.code || '';
        if (window.ace) {
            if (!formEditor) {
                formEditor = ace.edit(ui.fCode);
                formEditor.setOptions({ showPrintMargin: false, fontFamily: "Consolas, 'Courier New', monospace", fontSize: 14 });
                formEditor.session.setMode('ace/mode/c_cpp');
                formEditor.commands.bindKey('F1', null);
            }
            formEditor.setTheme((EP.getSetting && EP.getSetting('theme')) || 'ace/theme/edgar_plus');
            formEditor.setValue(code, -1);
            formEditor.session.getUndoManager().reset();
            formEditor.resize(true);
        } else {
            ui.fCode.hidden = true;
            ui.fCodeFallback.hidden = false;
            ui.fCodeFallback.value = code;
        }
        setTimeout(() => (opts.title ? (formEditor || ui.fCodeFallback) : ui.fTitle).focus(), 30);
    }

    function closeForm() {
        if (!state.form) return;
        state.form = null;
        if (!ui) return;
        ui.form.hidden = true;
        ui.viewerEl.classList.remove('epa-form-mode');
    }

    function formCode() {
        return (formEditor ? formEditor.getValue() : ui.fCodeFallback.value).replace(/\r\n?/g, '\n');
    }

    function saveForm() {
        if (!state.form) return;
        const title = ui.fTitle.value.trim();
        const desc = ui.fDesc.value.trim();
        let code = formCode().replace(/\s+$/, '');
        if (!title) {
            toast(L('Upiši naslov isječka.', 'Enter a title for the snippet.'), { type: 'error' });
            ui.fTitle.focus();
            return;
        }
        if (!code.trim()) {
            toast(L('Kod isječka je prazan.', 'The snippet code is empty.'), { type: 'error' });
            return;
        }
        let kind = ui.fKind.value === 'auto' ? detectKind(code) : ui.fKind.value;
        let includes = [];
        if (kind !== 'program') {
            const sp = splitIncludes(code);
            includes = sp.includes;
            code = sp.code.replace(/\s+$/, '');
            if (!code.trim()) {
                toast(L('Isječak sadrži samo #include retke.', 'The snippet only contains #include lines.'), { type: 'error' });
                return;
            }
            if (ui.fKind.value === 'auto') kind = detectKind(code);
        }
        const list = loadMySnippets();
        let id = state.form.id;
        const now = Date.now();
        if (state.form.mode === 'edit' && list.some(x => x.id === id)) {
            const i = list.findIndex(x => x.id === id);
            list[i] = Object.assign({}, list[i], { title, desc, code, kind, includes, updated: now });
        } else {
            id = newSnippetId();
            list.unshift({ id, title, desc, code, kind, includes, created: now, updated: now });
        }
        if (!storeMySnippets(list)) return;
        closeForm();
        state.cheatCat = 'mine';
        state.query = '';
        ui.search.value = '';
        runSearch();
        const idx = state.results.findIndex(r => r.entry.key === 'mine:' + id);
        state.selected = idx < 0 ? 0 : idx;
        renderResults();
        renderViewer();
        renderHeader();
        toast(L('Isječak spremljen u šalabahter.', 'Snippet saved to your cheat sheet.'));
    }

    function newSnippetFromEditor() {
        const ed = EP.getActiveEditor && EP.getActiveEditor();
        const sel = ed ? ed.getSelectedText() : '';
        if (state.tab !== 'cheat') setTab('cheat');
        openForm({ mode: 'new', code: sel });
    }

    function saveArchiveAsSnippet() {
        const r = state.results[state.selected];
        if (!r || state.tab !== 'archive') return;
        const e = r.entry;
        const sel = viewer ? viewer.getSelectedText() : '';
        const code = sel || currentCode();
        setTab('cheat');
        openForm({ mode: 'new', title: `${e.title} · ${e.subtitle || ''}`.replace(/ · $/, ''), code });
    }

    function editCurrentSnippet() {
        const r = state.results[state.selected];
        if (!r || !r.entry.mine) return;
        const m = r.entry.item.mine;
        const code = (m.includes.length ? m.includes.map(h => `#include <${h}>`).join('\n') + '\n\n' : '') + m.code;
        openForm({ mode: 'edit', id: m.id, title: m.title, desc: m.desc, kind: m.kind, code });
    }

    function deleteCurrentSnippet(btn) {
        const r = state.results[state.selected];
        if (!r || !r.entry.mine) return;
        if (btn.dataset.armed !== '1') {
            // Two-step delete instead of a blocking confirm() dialog
            btn.dataset.armed = '1';
            btn.textContent = L('Klikni opet za brisanje', 'Click again to delete');
            setTimeout(() => {
                if (btn.isConnected) {
                    btn.dataset.armed = '';
                    btn.textContent = L('Obriši', 'Delete');
                }
            }, 3000);
            return;
        }
        const id = r.entry.item.mine.id;
        if (!storeMySnippets(loadMySnippets().filter(x => x.id !== id))) return;
        state.selected = Math.max(0, state.selected - 1);
        runSearch();
        renderHeader();
        toast(L('Isječak obrisan.', 'Snippet deleted.'));
    }

    function exportMySnippets() {
        const list = loadMySnippets();
        if (!list.length) {
            toast(L('Još nemaš vlastitih isječaka.', 'You have no snippets of your own yet.'));
            return;
        }
        const blob = new Blob([JSON.stringify({ source: 'Edgar+ snippets', version: 1, snippets: list }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edgar-plus-snippets-${fmtDate(new Date().toISOString())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function importMySnippets(file) {
        if (file.size > 2 * 1024 * 1024) {
            toast(L('Datoteka je prevelika (najviše 2 MB).', 'The file is too large (2 MB max).'), { type: 'error' });
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            let data;
            try { data = JSON.parse(reader.result); } catch (e) { data = null; }
            const incoming = Array.isArray(data) ? data : (data && Array.isArray(data.snippets) ? data.snippets : null);
            if (!incoming) {
                toast(L('To nije datoteka s Edgar+ isječcima.', 'That is not an Edgar+ snippets file.'), { type: 'error' });
                return;
            }
            const list = loadMySnippets();
            let added = 0;
            let updated = 0;
            incoming.map(sanitizeSnippet).filter(Boolean).forEach(snip => {
                const i = list.findIndex(x => x.id === snip.id);
                if (i >= 0) { list[i] = snip; updated++; } else { list.push(snip); added++; }
            });
            if (!added && !updated) {
                toast(L('U datoteci nema valjanih isječaka.', 'No valid snippets in that file.'), { type: 'error' });
                return;
            }
            if (!storeMySnippets(list)) return;
            state.cheatCat = 'mine';
            state.selected = 0;
            runSearch();
            renderHeader();
            toast(L(`Uvezeno: ${added} novih, ${updated} ažuriranih.`, `Imported ${added} new, ${updated} updated.`));
        };
        reader.readAsText(file);
    }

    function insertCurrent() {
        const r = state.results[state.selected];
        if (state.tab !== 'cheat' || !r || r.entry.type !== 'snippet') return;
        const snip = Object.assign({}, r.entry.item, { code: cheatCode(r.entry) });
        const res = EP.insertSnippet ? EP.insertSnippet(snip) : { ok: false, reason: 'no-editor' };
        if (!res.ok) {
            toast(res.reason === 'read-only'
                ? L('Ovaj editor je samo za čitanje.', 'This editor is read-only.')
                : L('Otvori zadatak s editorom koda da bi umetao isječke.', 'Open a task with a code editor to insert snippets.'), { type: 'error' });
            return;
        }
        close({ keepFocus: true });
        let msg = L(`Umetnuto: "${snip.hr}"`, `Inserted "${snip.en}"`);
        if (res.where === 'above') msg += L(' iznad trenutne funkcije', ' above the current function');
        if (res.added && res.added.length) msg += ` · ${L('dodano', 'added')} #include <${res.added.join('>, <')}>`;
        toast(msg + L('. Ctrl+Z poništava.', '. Ctrl+Z to undo.'));
    }

    function copyCurrent() {
        const code = currentCode();
        if (!code) return;
        const done = () => toast('Code copied to clipboard.');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(done).catch(() => fallbackCopy(code, done));
        } else {
            fallbackCopy(code, done);
        }
    }
    function fallbackCopy(code, done) {
        const ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        ui.root.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { toast('Copy failed. Select the code and press Ctrl+C.', { type: 'error' }); }
        ta.remove();
    }

    function exportArchive() {
        const data = {
            exportedAt: new Date().toISOString(),
            source: 'Edgar+ Code Archive',
            entries: entries.map(e => {
                const c = Object.assign({}, e);
                delete c._date;
                delete c._f;
                return c;
            })
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `edgar-plus-archive-${fmtDate(new Date().toISOString())}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }

    function isOpen() {
        return !!(ui && ui.root.classList.contains('open'));
    }

    function open(tab, opts) {
        if (!enabled) return;
        if (tab === 'archive' || tab === 'cheat') {
            if (tab !== state.tab) closeForm();
            state.tab = tab;
            try { localStorage.setItem(TAB_KEY, tab); } catch (e) { /* ignore */ }
        }
        if (opts && opts.similar) {
            closeForm();
            state.similarMode = true;
            state.query = '';
            state.selected = 0;
            state.version = -1;
            if (ui) ui.search.value = '';
        }
        buildUI();
        applyTabClasses();
        const wasOpen = isOpen();
        ui.root.classList.add('open');
        if (!wasOpen) {
            prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
        }
        renderHeader();
        if (!entriesLoaded) loadEntries();
        else runSearch();
        setTimeout(() => {
            ui.search.focus();
            ui.search.select();
            if (viewer) viewer.resize(true);
        }, 30);
    }

    function close(opts) {
        if (!ui || !isOpen()) return;
        ui.root.classList.remove('open');
        document.documentElement.style.overflow = prevOverflow || '';
        const ed = EP.getActiveEditor && EP.getActiveEditor();
        if (ed) setTimeout(() => ed.focus(), 0);
    }

    function toggle() {
        if (isOpen()) close();
        else open();
    }

    EP.openArchive = open;
    EP.closeArchive = close;
    EP.toggleArchive = toggle;

    EP.archiveSetEnabled = (on) => {
        enabled = on;
        if (!on) {
            close();
            if (sync.running) sync.cancel = true;
        }
    };

    // ------------------------------------------------------------------
    // Global hooks
    // ------------------------------------------------------------------
    window.addEventListener('keydown', (e) => {
        if (!enabled) return;
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.key === 'F' || e.key === 'f' || e.code === 'KeyF')) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
        }
    }, true);

    window.addEventListener('message', (e) => {
        if (e.source !== window || !e.data || e.data.source !== 'edgar-plus-cs') return;
        if (e.data.type === 'open-archive') open(e.data.tab);
    });

    const captureObserver = new MutationObserver(() => scheduleCapture());
    captureObserver.observe(document.body, { childList: true, subtree: true });
    scheduleCapture();

    if (location.hash === '#edgar-plus-archive' || location.hash === '#edgar-plus-cheatsheet') {
        const tab = location.hash === '#edgar-plus-cheatsheet' ? 'cheat' : 'archive';
        history.replaceState(null, '', location.pathname + location.search);
        setTimeout(() => open(tab), 300);
    }

    // Exposed for debugging/testing
    EP._archive = { parseInstance, search, buildMatchers, loadEntries, runSync, taskTerms, findSimilar, signaturesIn, paramTypes, detectKind, splitIncludes, get entries() { return entries; } };
})();

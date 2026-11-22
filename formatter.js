// formatter.js — Edgar+ C code formatter. Runs in the page's main world (also loadable in Node for tests).
// Only whitespace is changed: indentation, spaces between tokens and runs of blank lines. Line breaks
// stay where the student put them. Before returning, the result is re-tokenized and compared with the
// input; if the token streams differ in any way, formatting is refused, so it can never change meaning.
(function () {
    'use strict';

    const root = typeof window !== 'undefined' ? window : globalThis;
    const EP = root.EdgarPlus = root.EdgarPlus || {};
    if (EP.formatC) return;

    // ------------------------------------------------------------------
    // Tokenizer
    // ------------------------------------------------------------------
    const PUNCT = ['>>=', '<<=', '...', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
        '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '##'];

    // Token: { t: 'id'|'num'|'str'|'chr'|'pp'|'lc'|'bc'|'op', v, start, nl (newlines before), ws (whitespace
    // text before it on the same line), lead (original indentation of the line it starts, if first on line) }
    function tokenize(src) {
        const toks = [];
        const n = src.length;
        let i = 0;
        let nl = 0;
        let ws = '';
        let lineStart = true;
        let lineIndent = '';
        const push = (t, start, end) => {
            toks.push({ t, v: src.slice(start, end), start, nl, ws: nl ? '' : ws, lead: lineStart ? lineIndent : null });
            nl = 0;
            ws = '';
            lineStart = false;
            i = end;
        };
        while (i < n) {
            const c = src[i];
            const d = src[i + 1];
            if (c === '\n') {
                nl++;
                i++;
                lineStart = true;
                lineIndent = '';
                ws = '';
                continue;
            }
            if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') {
                if (lineStart) lineIndent += c;
                else ws += c;
                i++;
                continue;
            }
            const start = i;
            if (lineStart && c === '#') {
                // Preprocessor line, including backslash-newline continuations: kept verbatim.
                let j = i;
                while (j < n && src[j] !== '\n') {
                    if (src[j] === '\\' && src[j + 1] === '\n') j += 2;
                    else if (src[j] === '\\' && src[j + 1] === '\r' && src[j + 2] === '\n') j += 3;
                    else j++;
                }
                let end = j;
                while (end > start && /[ \t\r]/.test(src[end - 1])) end--;
                push('pp', start, end);
                i = j;
                continue;
            }
            if (c === '/' && d === '/') {
                let j = i;
                while (j < n && src[j] !== '\n') j++;
                let end = j;
                while (end > start && /[ \t\r]/.test(src[end - 1])) end--;
                push('lc', start, end);
                i = j;
                continue;
            }
            if (c === '/' && d === '*') {
                const close = src.indexOf('*/', i + 2);
                push('bc', start, close < 0 ? n : close + 2);
                continue;
            }
            if (c === '"' || c === "'") {
                let j = i + 1;
                while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
                if (src[j] === c) j++;
                push(c === '"' ? 'str' : 'chr', start, Math.min(j, n));
                continue;
            }
            if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(d || ''))) {
                const m = /^(?:\.?[0-9])(?:[eEpP][+-]|[0-9A-Za-z_.])*/.exec(src.slice(i));
                push('num', start, i + m[0].length);
                continue;
            }
            if (/[A-Za-z_]/.test(c)) {
                const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i));
                push('id', start, i + m[0].length);
                continue;
            }
            const p = PUNCT.find(x => src.startsWith(x, i));
            push('op', start, i + (p ? p.length : 1));
        }
        return { toks, trailingNewline: /\n\s*$/.test(src) };
    }

    // ------------------------------------------------------------------
    // Spacing
    // ------------------------------------------------------------------
    const TYPE_KW = new Set(['int', 'char', 'short', 'long', 'float', 'double', 'void', 'signed', 'unsigned',
        'const', 'volatile', 'static', 'extern', 'register', 'auto', 'inline', 'restrict', '_Bool', 'bool',
        'FILE', 'size_t', 'struct', 'union', 'enum', 'typedef']);
    const SPACE_BEFORE_PAREN = new Set(['if', 'for', 'while', 'switch', 'return', 'case', 'do', 'else', 'goto']);
    const UNARY_AFTER_KW = new Set(['return', 'case', 'sizeof', 'else', 'do', 'goto']);
    const BINARY = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=', '==', '!=',
        '<', '>', '<=', '>=', '&&', '||', '+', '-', '*', '/', '%', '&', '|', '^', '<<', '>>']);
    const CONTROL = new Set(['if', 'for', 'while', 'switch']);

    const isWordish = tk => tk && (tk.t === 'id' || tk.t === 'num' || tk.t === 'str' || tk.t === 'chr');
    const isComment = tk => tk && (tk.t === 'lc' || tk.t === 'bc');

    // Is `+ - * &` at index k unary (prefix) rather than binary?
    function isUnaryAt(code, k) {
        const prev = code[k - 1];
        if (!prev) return true;
        if (prev.t === 'id') return UNARY_AFTER_KW.has(prev.v);
        if (prev.t === 'num' || prev.t === 'str' || prev.t === 'chr') return false;
        if (prev.t === 'op') {
            if (prev.v === ')') return !!(prev.headerClose || prev.castClose); // `if (...) *p = 1;`, `(int) -x`
            return !(prev.v === ']' || prev.v === '++' || prev.v === '--');
        }
        return true;
    }

    // Is the identifier at index k a type name (keyword, or the tag after struct/union/enum)?
    function isTypeName(code, k) {
        const tk = code[k];
        if (!tk || tk.t !== 'id') return false;
        if (TYPE_KW.has(tk.v)) return true;
        const before = code[k - 1];
        return !!(before && before.t === 'id' && (before.v === 'struct' || before.v === 'union' || before.v === 'enum'));
    }

    // `*` in a declaration or cast (char *p, Item *it, (int *)) rather than multiplication.
    function isPointerDeclarator(code, k) {
        const tk = code[k];
        if (tk.v !== '*') return false;
        const prev = code[k - 1];
        const next = code[k + 1];
        if (!prev || prev.t !== 'id') return false;
        if (isTypeName(code, k - 1)) return true;
        if (UNARY_AFTER_KW.has(prev.v)) return false;
        // `Type *)` or `Type **` or `Type *,` can't be a multiplication
        if (next && next.t === 'op' && (next.v === ')' || next.v === '*' || next.v === ',')) return true;
        // Statement starting with `Name *name`: a declaration with a typedef'd type
        const before = code[k - 2];
        // `const Name *p`, `static Name *p`: an identifier after a type qualifier is a type
        if (before && before.t === 'id' && TYPE_KW.has(before.v) && next && (next.t === 'id' || next.v === '*')) return true;
        const startsStatement = !before || (before.t === 'op' && (before.v === ';' || before.v === '{' || before.v === '}'));
        if (startsStatement && next && next.t === 'id') return true;
        // Ambiguous (e.g. inside parentheses): follow how it was written: `T *p` vs `a * b`.
        return !!(tk.ws || tk.nl) && !(next && (next.ws || next.nl)) && next && next.t === 'id' &&
            !!before && before.t === 'op' && (before.v === '(' || before.v === ',');
    }

    // `{` of an initializer list / enum body (items stay on their lines) rather than a code block.
    function isListBrace(code, k) {
        const pv = code[k - 1];
        const pv2 = code[k - 2];
        if (!pv) return false;
        if (pv.t === 'op') return ['=', ',', '{', '('].includes(pv.v) || (pv.v === ')' && !!pv.castClose);
        return (pv.t === 'id' && pv.v === 'enum') || !!(pv2 && pv2.t === 'id' && pv2.v === 'enum');
    }

    // (type) : parentheses holding only a type name, not preceded by a function name or sizeof.
    function isCastParens(code, openIdx, closeIdx) {
        const before = code[openIdx - 1];
        if (before && (before.t === 'id' && !UNARY_AFTER_KW.has(before.v) || (before.t === 'op' && (before.v === ')' || before.v === ']')))) return false;
        const inner = code.slice(openIdx + 1, closeIdx);
        if (!inner.length) return false;
        let sawType = false;
        let i = 0;
        for (; i < inner.length && inner[i].t === 'id'; i++) if (TYPE_KW.has(inner[i].v)) sawType = true;
        if (i === 0) return false;
        let stars = 0;
        for (; i < inner.length && inner[i].t === 'op' && inner[i].v === '*'; i++) stars++;
        if (i !== inner.length) return false;
        return sawType || stars > 0;
    }

    // Decide the spacing between code[k-1] and code[k] (same line). Returns the whitespace string.
    function spacing(code, k, line) {
        const a = code[k - 1];
        const b = code[k];
        const orig = b.ws;
        const has = orig.length > 0;
        if (isComment(b)) return has ? orig.replace(/\t/g, ' ') : ' ';
        if (isComment(a)) return has ? ' ' : '';
        const av = a.t === 'op' ? a.v : null;
        const bv = b.t === 'op' ? b.v : null;

        if (bv === ';') return '';
        if (bv === ',' || bv === ')' || bv === ']') return '';
        if (av === '(' || av === '[') return '';
        if (bv === '.' || bv === '->' || av === '.' || av === '->') return '';
        if (bv === '}') return has ? ' ' : '';      // inline braces keep the student's choice
        if (av === ',' || av === ';') return ' ';
        if (a.headerClose) return ' ';             // if (x) return; / for (;;) break;

        // ++ / --
        if (bv === '++' || bv === '--') {
            if (a.t === 'id' && !UNARY_AFTER_KW.has(a.v) || a.t === 'num' || av === ')' || av === ']') return ''; // postfix
            return (av && BINARY.has(av) && !a.unary) || a.t === 'id' || av === '?' || av === ':' || av === '{' || av === '}' ? ' ' : '';
        }
        if ((av === '++' || av === '--') && !a.postfix) return ''; // prefix operator binds to its operand

        if (bv === '(') {
            if (a.t === 'id') return SPACE_BEFORE_PAREN.has(a.v) || TYPE_KW.has(a.v) ? ' ' : '';
            if (av === ')') return has ? ' ' : '';
            if (av === ']') return '';
        }
        if (bv === '[') return a.t === 'op' && BINARY.has(av) && !a.unary ? ' ' : '';

        if (bv === '{') {
            if (av === '{' || av === '(' || av === '[') return '';
            return ' ';
        }
        if (av === '{') return has ? ' ' : '';
        if (bv === '}') return has ? ' ' : '';
        if (av === '}') return ' ';

        // ?: and labels
        if (bv === ':') {
            if (line.isCase) return '';
            if (k - 1 === line.first && a.t === 'id') return ''; // goto label
            return ' ';
        }
        if (av === ':') return ' ';
        if (bv === '?' || av === '?') return ' ';

        // Unary operators
        if (b.unary) {
            if (!a) return '';
            if (a.castClose) return has ? ' ' : '';
            if (a.t === 'op' && (av === '(' || av === '[' || a.unary || a.ptr)) return '';
            return ' ';
        }
        if (a.unary || a.ptr) return '';
        if (b.ptr) return ' ';
        if (bv === '!' || bv === '~') return a.t === 'op' && (av === '(' || av === '[' || av === '!' || av === '~' || a.unary) ? '' : ' ';
        if (av === '!' || av === '~') return '';

        // Binary operators
        if ((bv && BINARY.has(bv)) || (av && BINARY.has(av))) return ' ';

        if (av === ')') {
            // `(int) x` vs `(int)x`: keep the student's choice
            return isWordish(b) || bv === '!' || bv === '~' ? (has ? ' ' : '') : '';
        }
        if (isWordish(a) && isWordish(b)) return ' ';
        return has ? ' ' : '';
    }

    // ------------------------------------------------------------------
    // Formatter
    // ------------------------------------------------------------------
    function formatC(src, opts = {}) {
        const indentUnit = opts.indent || '    ';
        const { toks, trailingNewline } = tokenize(src.replace(/\r\n?/g, '\n'));
        if (!toks.length) return { ok: true, text: src, changed: false, map: x => x };

        // Annotate unary / pointer / postfix on code tokens (comments and pp lines are skipped).
        const code = toks.filter(t => t.t !== 'lc' && t.t !== 'bc' && t.t !== 'pp');
        {
            // Which ')' closes the condition of if / for / while / switch, and which closes a cast?
            let depth = 0;
            const open = [];
            const parens = [];
            code.forEach((tk, k) => {
                if (tk.t === 'id' && CONTROL.has(tk.v) && code[k + 1] && code[k + 1].v === '(') open.push(depth);
                else if (tk.t === 'op' && tk.v === '(') { depth++; parens.push(k); }
                else if (tk.t === 'op' && tk.v === ')') {
                    depth = Math.max(0, depth - 1);
                    const openIdx = parens.pop();
                    if (open.length && open[open.length - 1] === depth) { open.pop(); tk.headerClose = true; }
                    else if (openIdx != null && isCastParens(code, openIdx, k)) tk.castClose = true;
                }
            });
        }
        code.forEach((tk, k) => {
            if (tk.t !== 'op') return;
            if (tk.v === '++' || tk.v === '--') {
                const p = code[k - 1];
                tk.postfix = !!p && (p.t === 'id' && !UNARY_AFTER_KW.has(p.v) || p.t === 'num' || (p.t === 'op' && (p.v === ')' || p.v === ']')));
            } else if (tk.v === '*' && isPointerDeclarator(code, k)) {
                tk.ptr = true;
            } else if ((tk.v === '-' || tk.v === '+' || tk.v === '*' || tk.v === '&') && isUnaryAt(code, k)) {
                tk.unary = true;
            }
        });
        const codeIndex = new Map(code.map((tk, k) => [tk, k]));

        // One statement per line: break after `{` and `;` of code blocks, before `}`, and after `case X:`.
        // Short one-liners like `if (x) return 1;` stay as written; initializer lists are left alone.
        {
            const blocks = [];
            let depth = 0;
            let caseColon = false;
            let ternary = 0;
            const startLine = tk => { tk.nl = Math.max(tk.nl, 1); tk.ws = ''; tk.lead = null; };
            toks.forEach((tk, i) => {
                if (tk.t === 'pp' || isComment(tk)) return;
                const next = toks[i + 1];
                const breakAfter = () => {
                    // keep a trailing comment on the same line as its statement
                    if (next && next.nl === 0 && !isComment(next) && next.t !== 'pp') startLine(next);
                };
                if (tk.t === 'id') {
                    if (tk.v === 'case' || tk.v === 'default') { caseColon = true; ternary = 0; }
                    return;
                }
                if (tk.t !== 'op') return;
                const v = tk.v;
                if (v === '(') depth++;
                else if (v === ')') depth = Math.max(0, depth - 1);
                else if (v === '?') ternary++;
                else if (v === ':' && ternary > 0) ternary--;
                else if (v === ':' && caseColon) {
                    caseColon = false;
                    if (!(next && next.t === 'op' && next.v === '{')) breakAfter();
                } else if (v === '{') {
                    const k = codeIndex.get(tk);
                    const pv = code[k - 1];
                    const pv2 = code[k - 2];
                    let kind = 'code';
                    if (isListBrace(code, k)) kind = 'list';
                    else if (pv && pv.t === 'id' && pv.v === 'do') kind = 'do';
                    else if (pv && pv.t === 'id' && (pv.v === 'struct' || pv.v === 'union' ||
                        (pv2 && pv2.t === 'id' && (pv2.v === 'struct' || pv2.v === 'union')))) kind = 'aggregate';
                    blocks.push(kind);
                    if (kind !== 'list' && !(next && next.t === 'op' && next.v === '}')) breakAfter();
                } else if (v === '}') {
                    const kind = blocks.pop();
                    if (!kind || kind === 'list') return;
                    const prev = toks[i - 1];
                    if (tk.nl === 0 && !(prev && prev.t === 'op' && prev.v === '{')) startLine(tk);
                    // What may follow `}` on the same line: else, do-while's while, ; , ) } and a struct's declarators
                    if (!next || next.nl > 0 || isComment(next) || next.t === 'pp') return;
                    if (next.t === 'op' && [';', ',', ')', '}'].includes(next.v)) return;
                    if (next.t === 'id' && next.v === 'else') return;
                    if (next.t === 'id' && next.v === 'while' && kind === 'do') return;
                    if (kind === 'aggregate') return;
                    startLine(next);
                } else if (v === ';' && depth === 0) {
                    if (blocks[blocks.length - 1] === 'list') return;
                    if (!(next && next.t === 'op' && next.v === '}')) breakAfter();
                }
            });
        }

        // Group into lines.
        const lines = [];
        toks.forEach((tk, idx) => {
            if (idx === 0 || tk.nl > 0) lines.push({ toks: [], blank: idx === 0 ? 0 : Math.min(tk.nl - 1, 1) });
            lines[lines.length - 1].toks.push(tk);
        });

        const stack = [{ opener: 0, content: 0, isSwitch: false, sawCase: false }];
        let paren = 0;
        let pending = 0;          // unbraced if/for/while/else/do bodies waiting for their statement
        const headerParens = [];  // paren depths at which a control header's '(' was opened
        let lastHeader = null;    // keyword of the control header that just closed
        let afterHeaderClose = false;
        let stmtOpen = false;     // previous code line ended in the middle of a statement
        const out = [];
        const newStarts = new Array(toks.length);
        let pos = 0;

        for (const line of lines) {
            const first = line.toks[0];
            for (let b = 0; b < line.blank; b++) { out.push('\n'); pos++; }
            if (out.length) { out.push('\n'); pos++; }

            if (first.t === 'pp') {
                newStarts[toks.indexOf(first)] = pos;
                out.push(first.v);
                pos += first.v.length;
                continue;
            }

            const firstCode = line.toks.find(t => !isComment(t));
            const top = stack[stack.length - 1];
            const startsWithClose = firstCode && firstCode === first && first.t === 'op' && first.v === '}';
            const startsWithOpen = firstCode && firstCode === first && first.t === 'op' && first.v === '{';
            const isCase = !!firstCode && firstCode === first && first.t === 'id' && (first.v === 'case' || first.v === 'default') && top.isSwitch;
            line.isCase = isCase;
            let level;
            if (startsWithClose) level = top.opener;
            else if (isCase) level = top.content;
            else level = top.content + (top.isSwitch && top.sawCase ? 1 : 0);
            if (isCase) top.sawCase = true;
            if (!startsWithClose && !startsWithOpen && !isCase) level += pending;
            if (paren > 0 && !startsWithClose) level += 1;
            else if (stmtOpen && !pending && !startsWithClose && !startsWithOpen && !isCase && stack.length > 1 && !top.isList) level += 1;
            level = Math.max(0, level);
            const indent = indentUnit.repeat(level);
            out.push(indent);
            pos += indent.length;

            // Emit tokens and update the block structure.
            let lastCodeTok = null;
            let headerClosedAtEnd = false;
            line.first = codeIndex.has(firstCode) ? codeIndex.get(firstCode) : -1;
            line.toks.forEach((tk, j) => {
                const k = codeIndex.get(tk);
                let sp = '';
                if (j > 0) {
                    if (k != null && line.toks[j - 1] && codeIndex.has(line.toks[j - 1])) sp = spacing(code, k, line);
                    else if (isComment(tk)) sp = tk.ws ? tk.ws.replace(/\t/g, ' ') : ' ';
                    else sp = tk.ws ? ' ' : '';
                }
                out.push(sp);
                pos += sp.length;
                newStarts[toks.indexOf(tk)] = pos;
                let text = tk.v;
                if (tk.t === 'bc' && j === 0 && tk.lead !== null && text.includes('\n')) {
                    // Shift the comment's inner lines by the same amount as its first line.
                    const delta = indent.length - tk.lead.replace(/\t/g, indentUnit).length;
                    text = text.split('\n').map((l, li) => {
                        if (li === 0) return l;
                        if (delta > 0) return ' '.repeat(delta) + l;
                        const m = /^[ \t]*/.exec(l)[0];
                        return l.slice(Math.min(m.length, -delta));
                    }).join('\n');
                }
                out.push(text);
                pos += text.length;
                if (isComment(tk)) return;
                lastCodeTok = tk;

                if (tk.t === 'id' && CONTROL.has(tk.v)) {
                    const nx = code[k + 1];
                    if (nx && nx.v === '(') headerParens.push({ depth: paren, kw: tk.v });
                }
                if (tk.t !== 'op') {
                    afterHeaderClose = false;
                    headerClosedAtEnd = false;
                    return;
                }
                const v = tk.v;
                if (v === '(') {
                    paren++;
                } else if (v === ')') {
                    paren = Math.max(0, paren - 1);
                    const h = headerParens[headerParens.length - 1];
                    if (h && h.depth === paren) {
                        headerParens.pop();
                        lastHeader = h.kw;
                        afterHeaderClose = true;
                        headerClosedAtEnd = true;
                        return;
                    }
                } else if (v === '{') {
                    const isSwitch = afterHeaderClose && lastHeader === 'switch';
                    // Initializer lists and enum bodies: items continue after ',' without extra indent
                    const isList = isListBrace(code, k);
                    stack.push({ opener: level, content: level + 1, isSwitch, isList, sawCase: false });
                    pending = 0;
                } else if (v === '}') {
                    if (stack.length > 1) stack.pop();
                    pending = 0;
                } else if (v === ';' && paren === 0) {
                    pending = 0;
                }
                afterHeaderClose = false;
                headerClosedAtEnd = false;
            });

            if (lastCodeTok) {
                const ends = lastCodeTok.t === 'op' && [';', '{', '}', ':'].includes(lastCodeTok.v);
                const opensBody = headerClosedAtEnd || (lastCodeTok.t === 'id' && (lastCodeTok.v === 'else' || lastCodeTok.v === 'do'));
                stmtOpen = !ends && !opensBody && paren === 0;
            }
            // A control header with no '{' on its line (if (x) / else / do): the next statement is its body.
            if (lastCodeTok) {
                const lv = lastCodeTok.v;
                if (headerClosedAtEnd && lastHeader !== 'switch') pending++;
                else if (lastCodeTok.t === 'id' && (lv === 'else' || lv === 'do')) pending++;
            }
        }
        if (trailingNewline) out.push('\n');
        const text = out.join('');

        // Safety net: the token stream must be identical.
        const check = tokenize(text).toks;
        const same = check.length === toks.length && check.every((t, i) => t.t === toks[i].t &&
            (t.v === toks[i].v || (t.t === 'bc' && t.v.replace(/\s+/g, ' ') === toks[i].v.replace(/\s+/g, ' '))));
        if (!same) return { ok: false, text: src, changed: false, map: x => x };

        // Map an offset in the original text to the formatted text (keeps the cursor on the same token).
        const starts = toks.map(t => t.start);
        const map = (offset) => {
            let lo = 0;
            let hi = toks.length - 1;
            let idx = -1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                if (starts[mid] <= offset) { idx = mid; lo = mid + 1; } else hi = mid - 1;
            }
            if (idx < 0) return 0;
            const tk = toks[idx];
            const within = offset - tk.start;
            if (within <= tk.v.length) return newStarts[idx] + Math.min(within, tk.v.length);
            return idx + 1 < toks.length ? newStarts[idx + 1] : text.length;
        };
        return { ok: true, text, changed: text !== src, map };
    }

    EP.formatC = formatC;
    EP._formatTokenize = tokenize;
})();

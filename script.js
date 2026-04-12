document.addEventListener('DOMContentLoaded', () => {
    const input    = document.getElementById('markdown-input');
    const preview  = document.getElementById('keep-preview');
    const copyBtn  = document.getElementById('copy-btn');
    const openBtn  = document.getElementById('open-btn');
    const saveBtn  = document.getElementById('save-btn');
    const clearBtn = document.getElementById('clear-btn');
    const fileInput= document.getElementById('file-input');

    const wordCount= document.getElementById('word-count');
    const charCount= document.getElementById('char-count');
    let currentFileName = 'untitled.md';
    let currentFileType = 'markdown';

    const UPMATH = 'https://i.upmath.me/svg/';

    marked.setOptions({ breaks: true, gfm: true, silent: true });

    const escapeHtml = v => String(v ?? '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

    const isSvgPath = p => typeof p === 'string' && /\.svg(\?.*)?(#.*)?$/i.test(p.trim());

    marked.use({
        renderer: {
            image(t, tA, tX) {
                const tm = typeof t === 'object' && t !== null;
                const href = tm ? (t.href||'') : (t||'');
                const alt  = escapeHtml(tm ? (t.text||'') : (tX||''));
                const ttl  = (tm ? t.title : tA) ? ` title="${escapeHtml(tm?t.title:tA)}"` : '';
                if (isSvgPath(href)) {
                    const abs = escapeHtml(new URL(href, location.href).href);
                    return `<object class="md-svg-object" type="image/svg+xml" data="${abs}" aria-label="${alt}"${ttl}>${alt}</object>`;
                }
                return `<img src="${escapeHtml(href)}" alt="${alt}"${ttl}>`;
            }
        }
    });

    /* Convert a LaTeX formula to an upmath.me img tag */
    function mathImg(formula, block) {
        // Inline math: wrap with \textstyle so upmath renders at text size
        const tex = block ? formula : `{\\textstyle ${formula}}`;
        const url = UPMATH + encodeURIComponent(tex);
        const alt = formula.replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const img = `<img src="${url}" alt="${alt}" class="latex-svg" style="vertical-align:middle;max-width:100%;">`;
        return block
            ? `<div style="text-align:center;margin:1.2em 0">${img}</div>`
            : img;
    }

    /* Pre-process markdown: replace math delimiters with <img> BEFORE marked */
    function processMath(value) {
        // Protect code blocks and tabular <pre> from math substitution
        const codePh = [];
        value = value.replace(/(```[\s\S]*?```|`[^`\n]+`|<pre[\s\S]*?<\/pre>)/g, m => {
            codePh.push(m); return `\x00C${codePh.length - 1}\x00`;
        });

        const mathPh = [];
        const addMath = (formula, isBlock) => {
            mathPh.push({ formula, isBlock });
            return `\x01M${mathPh.length - 1}\x01`;
        };

        // 1. Explicit Block: \[ ... \]
        value = value.replace(/\\\[([\s\S]*?)\\\]/g, (_, f) => addMath(f, true));

        // 2. Explicit Inline: \( ... \) or \ ( ... \)
        value = value.replace(/\\\(([\s\S]*?)\\\)/g, (_, f) => addMath(f, false));
        value = value.replace(/\\\s\(([\s\S]*?)\\\)/g, (_, f) => addMath(f, false));

        // 3. Standard Block: $$ ... $$
        value = value.replace(/\$\$([\s\S]*?)\$\$/g, (_, f) => addMath(f, true));



        // Replace math markers with images
        value = value.replace(/\x01M(\d+)\x01/g, (_, i) => {
            const m = mathPh[+i];
            return mathImg(m.formula, m.isBlock);
        });

        // Restore code/pre blocks
        value = value.replace(/\x00C(\d+)\x00/g, (_, i) => codePh[+i]);
        return value;
    }

    const hydrateSvg = async () => {
        if (location.protocol === 'file:') return;
        const imgs = [...preview.querySelectorAll('img')].filter(i => isSvgPath(i.getAttribute('src')||''));
        await Promise.all(imgs.map(async img => {
            const src = img.getAttribute('src'); if (!src) return;
            try {
                const r = await fetch(src); if (!r.ok) return;
                const txt = await r.text(); if (!/<svg[\s>]/i.test(txt)) return;
                const w = document.createElement('div');
                w.className = 'inline-svg-wrapper'; w.innerHTML = txt;
                const svgEl = w.querySelector('svg'); if (!svgEl) return;
                svgEl.setAttribute('role','img');
                svgEl.setAttribute('aria-label', img.getAttribute('alt')||'svg');
                img.replaceWith(w);
            } catch {}
        }));
    };

    const updatePreview = () => {
        if (currentFileType === 'svg') {
            preview.innerHTML = input.value;
            return;
        }

        let value = input.value;

        // 1. Wrap \begin{tabular} for LatexTable.js
        value = value.replace(
            /(?:\(단위\s?:\s?.+?\)\s*)?(?:\\arrayrulecolor\s*\{.*?\}\s*)?\\begin\s*\{tabular\}[\s\S]*?\\end\s*\{tabular\}/g,
            m => `<pre class="latex-table-code">\n${m}\n</pre>`
        );

        // 2. Convert math to <img> before marked sees it
        value = processMath(value);

        // 3. CJK bold/italic fix (math is now <img>, protect HTML and code)
        const prot = [];
        value = value.replace(/(```[\s\S]*?```|`[^`\n]+`|<pre[\s\S]*?<\/pre>|<[^>]+>)/g, m => {
            prot.push(m); return `\x00P${prot.length - 1}\x00`;
        });
        value = value.replace(/\*\*([^\*\s](?:[^\*\n]*?[^\*\s])?)\*\*/g, (_, m) => `<strong>${m.replace(/~/g, '&#126;')}</strong>`);
        value = value.replace(/([^\*]|^)\*([^\*\s](?:[^\*\n]*?[^\*\s])?)\*([^\*]|$)/g, (_, p, m, s) => `${p}<em>${m.replace(/~/g, '&#126;')}</em>${s}`);

        // Prevent single tilde from being parsed as strikethrough (e.g. 1~2, 2~3)
        value = value.replace(/(?<!~)~(?!~)/g, '&#126;');

        value = value.replace(/\x00P(\d+)\x00/g, (_, i) => prot[+i]);

        // 4. Render markdown
        preview.innerHTML = marked.parse(value);

        // 5. Render LaTeX tables
        if (typeof LaTeXTable !== 'undefined') LaTeXTable.renderAll();

        // 6. Hydrate local SVG images
        hydrateSvg();

        // 7. Syntax highlighting
        if (typeof hljs !== 'undefined')
            preview.querySelectorAll('pre code').forEach(b => hljs.highlightElement(b));

        const txt = input.value.trim();
        wordCount.textContent = txt ? txt.split(/\s+/).length : 0;
        charCount.textContent = input.value.length;
    };

    const readFile = f => new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result); r.onerror = () => rej(r.error);
        r.readAsText(f, 'utf-8');
    });

    const isSvgFile = f => f.type === 'image/svg+xml' || (f.name||'').toLowerCase().endsWith('.svg');

    const saveFile = async () => {
        const content = input.value;
        const name = currentFileName.endsWith('.md') ? currentFileName : `${currentFileName}.md`;
        try {
            if ('showSaveFilePicker' in window) {
                const h = await window.showSaveFilePicker({ suggestedName: name,
                    types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
                const w = await h.createWritable();
                await w.write(content); await w.close();
                currentFileName = h.name || name; return;
            }
            const a = Object.assign(document.createElement('a'), {
                href: URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' })),
                download: name
            });
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (e) {
            if (e?.name === 'AbortError') { return; }
        }
    };

    const copyTo = btn => {
        navigator.clipboard.write([new ClipboardItem({
            'text/html' : new Blob([preview.innerHTML],  { type: 'text/html' }),
            'text/plain': new Blob([preview.innerText],  { type: 'text/plain' })
        })]).then(() => {
            const o = btn.innerHTML, ob = btn.style.background;
            btn.innerHTML = '<span>Copied!</span>'; btn.style.background = '#10b981';
            setTimeout(() => { btn.innerHTML = o; btn.style.background = ob; }, 2000);
        }).catch(() => navigator.clipboard.writeText(preview.innerText));
    };

    const loadTestMd = async () => {
        try {
            if (location.protocol === 'file:') {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'test.md', false);
                xhr.send(null);
                if (xhr.status === 200 || xhr.status === 0) {
                    input.value = xhr.responseText;
                    currentFileName = 'test.md';
                    updatePreview();
                }
            } else {
                const response = await fetch('test.md');
                if (response.ok) {
                    input.value = await response.text();
                    currentFileName = 'test.md';
                    updatePreview();
                }
            }
        } catch (err) {}
    };

    loadTestMd();

    input.addEventListener('input', () => { updatePreview(); });
    clearBtn?.addEventListener('click', () => {
        if (confirm('모든 내용을 지우시겠습니까?')) {
            input.value = '';
            updatePreview();
        }
    });
    openBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', async e => {
        const [f] = e.target.files || []; if (!f) return;
        try {
            const txt = await readFile(f);
            input.value = txt; currentFileName = f.name || 'untitled.md';
            currentFileType = isSvgFile(f) ? 'svg' : 'markdown';
            updatePreview();
        } catch { } finally { fileInput.value = ''; }
    });
    saveBtn?.addEventListener('click', saveFile);
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='s') { e.preventDefault(); saveFile(); }
    });
    copyBtn.addEventListener('click', () => copyTo(copyBtn));
    document.getElementById('copy-all-btn')?.addEventListener('click', e => copyTo(e.currentTarget));
    input.addEventListener('scroll', () => {
        const p = input.scrollTop / (input.scrollHeight - input.clientHeight);
        preview.scrollTop = p * (preview.scrollHeight - preview.clientHeight);
    });
    input.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        const s = input.selectionStart, v = input.value;
        const line = v.slice(v.lastIndexOf('\n', s - 1) + 1, s);
        let m;
        if ((m = line.match(/^(\s*[*+-]\s+)(.*)/))) {
            e.preventDefault();
            const ins = m[2].trim() === '' ? '' : '\n' + m[1];
            if (!ins) { input.value = v.slice(0, s - m[1].length) + v.slice(s); input.selectionStart = input.selectionEnd = s - m[1].length; }
            else { input.value = v.slice(0, s) + ins + v.slice(s); input.selectionStart = input.selectionEnd = s + ins.length; }
            updatePreview();
        } else if ((m = line.match(/^(\s*)(\d+)(\.\s+)(.*)/))) {
            e.preventDefault();
            const ins = m[4].trim() === '' ? '' : `\n${m[1]}${+m[2]+1}${m[3]}`;
            if (!ins) { input.value = v.slice(0, s - line.length) + v.slice(s); input.selectionStart = input.selectionEnd = s - line.length; }
            else { input.value = v.slice(0, s) + ins + v.slice(s); input.selectionStart = input.selectionEnd = s + ins.length; }
            updatePreview();
        }
    });
});

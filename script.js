document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('markdown-input');
    const preview = document.getElementById('keep-preview');
    const copyBtn = document.getElementById('copy-btn');
    const openBtn = document.getElementById('open-btn');
    const saveBtn = document.getElementById('save-btn');
    const fileInput = document.getElementById('file-input');
    const status = document.getElementById('status');
    const wordCount = document.getElementById('word-count');
    const charCount = document.getElementById('char-count');
    let currentFileName = 'untitled.md';
    let currentFileType = 'markdown';

    // Configure Marked.js for Rich Text rendering with KaTeX support
    // Configure Marked.js extensions
    if (typeof markedKatex !== 'undefined') {
        // Use marked.use() and also ensure we can call it directly if needed
        marked.use(markedKatex({
            throwOnError: false,
            output: 'html',
            displayMode: true
        }));
        console.log("KaTeX extension loaded");
    } else {
        console.error("markedKatex not found!");
    }

    // Configure other options
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const isSvgPath = (path) => typeof path === 'string' && /\.svg(\?.*)?(#.*)?$/i.test(path.trim());

    marked.use({
        renderer: {
            image(hrefOrToken, titleArg, textArg) {
                const tokenMode = typeof hrefOrToken === 'object' && hrefOrToken !== null;
                const href = tokenMode ? (hrefOrToken.href || '') : (hrefOrToken || '');
                const rawTitle = tokenMode ? hrefOrToken.title : titleArg;
                const rawAlt = tokenMode ? (hrefOrToken.text || '') : (textArg || '');
                const title = rawTitle ? ` title="${escapeHtml(rawTitle)}"` : '';
                const alt = escapeHtml(rawAlt);

                if (isSvgPath(href)) {
                    const absoluteHref = escapeHtml(new URL(href, window.location.href).href);
                    return `<object class="md-svg-object" type="image/svg+xml" data="${absoluteHref}" aria-label="${alt}"${title}>${alt}</object>`;
                }

                return `<img src="${escapeHtml(href)}" alt="${alt}"${title}>`;
            }
        }
    });

    const hydrateSvgImages = async () => {
        // Local file mode (file://) often blocks fetch for relative SVG paths.
        // In that case, keep default Markdown <img src="..."> rendering.
        if (window.location.protocol === 'file:') {
            return;
        }

        const svgImages = Array.from(preview.querySelectorAll('img')).filter((img) => isSvgPath(img.getAttribute('src') || ''));

        await Promise.all(svgImages.map(async (img) => {
            const src = img.getAttribute('src');
            if (!src) return;

            try {
                const response = await fetch(src);
                if (!response.ok) return;

                const svgText = await response.text();
                if (!/<svg[\s>]/i.test(svgText)) return;

                const wrapper = document.createElement('div');
                wrapper.className = 'inline-svg-wrapper';
                wrapper.innerHTML = svgText;

                const svgEl = wrapper.querySelector('svg');
                if (!svgEl) return;

                if (!svgEl.getAttribute('role')) {
                    svgEl.setAttribute('role', 'img');
                }
                if (!svgEl.getAttribute('aria-label')) {
                    svgEl.setAttribute('aria-label', img.getAttribute('alt') || 'svg image');
                }

                img.replaceWith(wrapper);
            } catch (error) {
                console.warn('SVG inline hydration failed:', src, error);
            }
        }));
    };

    const updatePreview = () => {
        if (currentFileType === 'svg') {
            renderSvgPreview(input.value);
            setStatus('Ready for Keep');
            return;
        }

        let value = input.value;

        // Pre-process: Automatically wrap \begin{env}...\end{env} with $$ if not already wrapped
        value = value.replace(/\$\$[\s\S]*?\$\$|\\begin\{([a-zA-Z]*\*?)\}[\s\S]*?\\end\{\1\}/gm, (match) => {
            if (match.startsWith('$$')) return match;
            return `$$\n${match}\n$$`;
        });

        // Pre-process: Fix CJK Bold/Italic boundary issues (e.g., **강조**에)
        const protectedBlocks = [];
        // Protect code and math blocks while we process bold/italic
        value = value.replace(/(```[\s\S]*?```|`[^`]*?`|\$\$[\s\S]*?\$\$|\\begin\{[a-zA-Z]*\*?\}[\s\S]*?\\end\{[a-zA-Z]*\*?\})/g, (match) => {
            protectedBlocks.push(match);
            return `__CJK_PROT_${protectedBlocks.length - 1}__`;
        });

        // Apply robust bold: **text**
        value = value.replace(/\*\*([^\*\s](?:[\s\S]*?[^\*\s])?)\*\*/g, '<strong>$1</strong>');
        // Apply robust italic: *text* (avoid matching across newlines or nested stars)
        value = value.replace(/([^\*]|^)\*([^\*\s](?:[^\*\n]*?[^\*\s])?)\*([^\*]|$)/g, '$1<em>$2</em>$3');

        // Restore protected blocks
        value = value.replace(/__CJK_PROT_(\d+)__/g, (_, i) => protectedBlocks[i]);

        // Render Markdown to HTML for the preview
        preview.innerHTML = marked.parse(value);
        hydrateSvgImages();

        // Apply syntax highlighting
        if (typeof hljs !== 'undefined') {
            preview.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        // Update Stats
        const text = value.trim();
        wordCount.textContent = text ? text.split(/\s+/).length : 0;
        charCount.textContent = value.length;

        // Visual feedback
        status.textContent = 'Ready for Keep';
        status.style.opacity = '1';

        setTimeout(() => {
            status.style.opacity = '0.7';
        }, 1000);
    };

    const setStatus = (message) => {
        status.textContent = message;
        status.style.opacity = '1';
    };

    const readFileAsText = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, 'utf-8');
    });

    const isSvgFile = (file) => {
        const name = (file.name || '').toLowerCase();
        return file.type === 'image/svg+xml' || name.endsWith('.svg');
    };

    const renderSvgPreview = (svgContent) => {
        preview.innerHTML = svgContent;
        const text = svgContent.trim();
        wordCount.textContent = text ? text.split(/\s+/).length : 0;
        charCount.textContent = svgContent.length;
    };

    const saveMarkdownFile = async () => {
        const content = input.value;
        const defaultName = currentFileName.endsWith('.md') ? currentFileName : `${currentFileName}.md`;

        try {
            if ('showSaveFilePicker' in window) {
                const handle = await window.showSaveFilePicker({
                    suggestedName: defaultName,
                    types: [{
                        description: 'Markdown Files',
                        accept: {
                            'text/markdown': ['.md'],
                            'text/plain': ['.md']
                        }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();

                currentFileName = handle.name || defaultName;
                setStatus(`Saved: ${currentFileName}`);
                return;
            }

            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = defaultName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setStatus(`Saved: ${defaultName}`);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                setStatus('Save canceled');
                return;
            }
            console.error('File save error:', error);
            setStatus('Failed to save file');
        }
    };

    // Initial render
    updatePreview();

    // Event Listeners
    input.addEventListener('input', () => {
        status.textContent = 'Formatting...';
        updatePreview();
    });

    if (openBtn && fileInput) {
        openBtn.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (e) => {
            const [file] = e.target.files || [];
            if (!file) return;

            try {
                const text = await readFileAsText(file);
                input.value = text;
                currentFileName = file.name || 'untitled.md';
                currentFileType = isSvgFile(file) ? 'svg' : 'markdown';

                if (currentFileType === 'svg') {
                    renderSvgPreview(text);
                } else {
                    updatePreview();
                }

                setStatus(`Loaded: ${currentFileName}`);
            } catch (error) {
                console.error('File read error:', error);
                setStatus('Failed to load file');
            } finally {
                fileInput.value = '';
            }
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', saveMarkdownFile);
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            saveMarkdownFile();
        }
    });

    /**
     * Copy as Rich Text (HTML) helper
     */
    const copyToKeep = (btn) => {
        const html = preview.innerHTML;
        const plainText = preview.innerText;

        const blobHtml = new Blob([html], { type: 'text/html' });
        const blobText = new Blob([plainText], { type: 'text/plain' });
        const data = [new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText
        })];

        navigator.clipboard.write(data).then(() => {
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span>Copied!</span>';
            const originalBg = btn.style.background;
            btn.style.background = '#10b981';

            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = originalBg;
            }, 2000);
        }).catch(err => {
            console.error('Clipboard error:', err);
            navigator.clipboard.writeText(plainText);
        });
    };

    // Header copy button
    copyBtn.addEventListener('click', () => copyToKeep(copyBtn));

    // Bottom floating copy button
    const copyAllBtn = document.getElementById('copy-all-btn');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', () => copyToKeep(copyAllBtn));
    }

    // Sync scrolling
    input.addEventListener('scroll', () => {
        const percentage = input.scrollTop / (input.scrollHeight - input.clientHeight);
        preview.scrollTop = percentage * (preview.scrollHeight - preview.clientHeight);
    });

    // Auto-numbering and list continuation (Editor feature)
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const start = input.selectionStart;
            const text = input.value;
            const beforeCursor = text.substring(0, start);
            const lineStart = beforeCursor.lastIndexOf('\n') + 1;
            const currentLine = beforeCursor.substring(lineStart);

            const bulletRegex = /^(\s*[*+-]\s+)(.*)$/;
            const numberedRegex = /^(\s*)(\d+)(\.\s+)(.*)$/;

            let match;
            if ((match = currentLine.match(bulletRegex))) {
                const marker = match[1];
                const content = match[2];
                if (content.trim() === '') {
                    e.preventDefault();
                    input.value = text.substring(0, lineStart) + text.substring(start);
                    input.selectionStart = input.selectionEnd = lineStart;
                } else {
                    e.preventDefault();
                    const insertion = '\n' + marker;
                    input.value = text.substring(0, start) + insertion + text.substring(start);
                    input.selectionStart = input.selectionEnd = start + insertion.length;
                }
                updatePreview();
            } else if ((match = currentLine.match(numberedRegex))) {
                const indent = match[1];
                const number = parseInt(match[2]);
                const separator = match[3];
                const content = match[4];
                if (content.trim() === '') {
                    e.preventDefault();
                    input.value = text.substring(0, lineStart) + text.substring(start);
                    input.selectionStart = input.selectionEnd = lineStart;
                } else {
                    e.preventDefault();
                    const insertion = `\n${indent}${number + 1}${separator}`;
                    input.value = text.substring(0, start) + insertion + text.substring(start);
                    input.selectionStart = input.selectionEnd = start + insertion.length;
                }
                updatePreview();
            }
        }
    });
});

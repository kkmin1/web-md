document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('markdown-input');
    const preview = document.getElementById('keep-preview');
    const copyBtn = document.getElementById('copy-btn');
    const status = document.getElementById('status');
    const wordCount = document.getElementById('word-count');
    const charCount = document.getElementById('char-count');

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

    const updatePreview = () => {
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

    // Initial render
    updatePreview();

    // Event Listeners
    input.addEventListener('input', () => {
        status.textContent = 'Formatting...';
        updatePreview();
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

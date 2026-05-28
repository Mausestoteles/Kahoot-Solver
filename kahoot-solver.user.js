// ==UserScript==
// @name         Kahoot Solver
// @namespace    https://github.com/Mausestoteles/kahoot-solver
// @version      0.1.0
// @description  Liest Kahoot-Frage + Antworten aus, fragt OpenAI nach der richtigen Antwort und markiert sie mit gruenem Rahmen.
// @match        https://kahoot.it/*
// @match        https://play.kahoot.it/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      api.openai.com
// ==/UserScript==

(() => {
    'use strict';

    const DEFAULT_MODEL = 'gpt-4o';
    const HIGHLIGHT_STYLE_ID = 'kahoot-solver-style';
    const BADGE_ID = 'kahoot-solver-badge';
    const HIGHLIGHT_CLASS = 'kahoot-solver-correct';

    // ---------- Settings ----------
    function getApiKey() {
        return GM_getValue('openai_api_key', '');
    }

    function getModel() {
        return GM_getValue('openai_model', DEFAULT_MODEL);
    }

    function getAutoClick() {
        return GM_getValue('auto_click', false);
    }

    function promptForApiKey() {
        const current = getApiKey();
        const next = prompt('OpenAI API Key (beginnt mit "sk-"):', current);
        if (next !== null) {
            GM_setValue('openai_api_key', next.trim());
            showBadge(next ? 'API-Key gespeichert' : 'API-Key geloescht', '#4caf50');
        }
    }

    function promptForModel() {
        const current = getModel();
        const next = prompt(
            'OpenAI Modell waehlen. Empfehlungen:\n' +
            ' - gpt-4o-mini   \n' +
            ' - gpt-4o      \n' +
            ' - gpt-4.1      \n' +
            ' - gpt-4.1-mini  \n' +
            ' - o3-mini     \n',
            current
        );
        if (next !== null && next.trim()) {
            GM_setValue('openai_model', next.trim());
            showBadge(`Modell: ${next.trim()}`, '#4caf50');
        }
    }

    function toggleAutoClick() {
        const next = !getAutoClick();
        GM_setValue('auto_click', next);
        showBadge(`Auto-Klick: ${next ? 'AN' : 'AUS'}`, next ? '#ff9800' : '#4caf50');
    }

    GM_registerMenuCommand('Kahoot Solver: API-Key setzen', promptForApiKey);
    GM_registerMenuCommand('Kahoot Solver: Modell waehlen', promptForModel);
    GM_registerMenuCommand('Kahoot Solver: Auto-Klick umschalten', toggleAutoClick);
    GM_registerMenuCommand('Kahoot Solver: Jetzt aufloesen', () => solve(true));

    function injectStyles() {
        if (document.getElementById(HIGHLIGHT_STYLE_ID)) return;
        const s = document.createElement('style');
        s.id = HIGHLIGHT_STYLE_ID;
        s.textContent = `
            .${HIGHLIGHT_CLASS} {
                outline: 5px solid #00ff66 !important;
                outline-offset: -5px !important;
                box-shadow: 0 0 24px 6px rgba(0, 255, 102, 0.85) !important;
                border-radius: 6px;
                transition: outline-color 120ms ease, box-shadow 120ms ease;
            }
            #${BADGE_ID} {
                position: fixed;
                top: 12px;
                right: 12px;
                z-index: 2147483647;
                padding: 8px 12px;
                background: rgba(0, 0, 0, 0.78);
                color: #fff;
                font: 600 13px/1.2 system-ui, sans-serif;
                border-radius: 6px;
                pointer-events: none;
                opacity: 0;
                transition: opacity 180ms ease;
            }
            #${BADGE_ID}.show { opacity: 1; }
        `;
        document.documentElement.appendChild(s);
    }

    function showBadge(text, color = '#2196f3') {
        injectStyles();
        let el = document.getElementById(BADGE_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = BADGE_ID;
            document.body.appendChild(el);
        }
        el.textContent = `Kahoot Solver: ${text}`;
        el.style.background = `${color}cc`;
        el.classList.add('show');
        clearTimeout(showBadge._t);
        showBadge._t = setTimeout(() => el.classList.remove('show'), 2500);
    }

    // ---------- DOM Auslesen ----------
    function getQuestionText() {
        const selectors = [
            '[data-functional-selector="block-title"]',
            '[data-functional-selector="question-title"]',
            '[data-functional-selector="question-text"]',
            '[class*="question-title"]',
            '[class*="QuestionTitle"]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim()) return el.textContent.trim();
        }
        return null;
    }

    function getAnswerButtons() {
        const byFs = [];
        for (let i = 0; i < 6; i++) {
            const el = document.querySelector(`[data-functional-selector="answer-${i}"]`);
            if (el) byFs.push(el);
        }
        if (byFs.length >= 2) return byFs;

        const candidates = Array.from(document.querySelectorAll(
            'button[class*="answer"], button[class*="Answer"], [role="button"][class*="answer"]'
        ));
        return candidates.filter(el => el.textContent.trim().length > 0);
    }

    function getAnswerTexts(buttons) {
        return buttons.map(b => {
            const text = b.innerText
                .replace(/\s+/g, ' ')
                .trim();
            return text;
        });
    }

    function askOpenAI(question, answers) {
        const apiKey = getApiKey();
        if (!apiKey) {
            showBadge('Kein API-Key. Menue -> API-Key setzen', '#f44336');
            return Promise.reject(new Error('no api key'));
        }

        const sys = 'Du bist ein praeziser Quiz-Solver. Antworte ausschliesslich mit einer JSON-Zeile der Form {"index": <0-basierter Index der richtigen Antwort>, "confidence": <0..1>}. Keine Erklaerung, kein Markdown.';
        const user = `Frage: ${question}\n\nAntworten:\n${answers.map((a, i) => `${i}: ${a}`).join('\n')}`;

        const body = {
            model: getModel(),
            temperature: 0,
            response_format: { type: 'json_object' },
            messages: [
                { role: 'system', content: sys },
                { role: 'user', content: user },
            ],
        };

        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                data: JSON.stringify(body),
                timeout: 15000,
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) {
                        reject(new Error(`HTTP ${res.status}: ${res.responseText.slice(0, 200)}`));
                        return;
                    }
                    try {
                        const payload = JSON.parse(res.responseText);
                        const content = payload.choices?.[0]?.message?.content ?? '';
                        const parsed = JSON.parse(content);
                        if (typeof parsed.index !== 'number') {
                            reject(new Error('OpenAI lieferte keinen index'));
                            return;
                        }
                        resolve(parsed);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: () => reject(new Error('Netzwerkfehler')),
                ontimeout: () => reject(new Error('Timeout')),
            });
        });
    }

    function clearHighlights() {
        document.querySelectorAll('.' + HIGHLIGHT_CLASS).forEach(el => {
            el.classList.remove(HIGHLIGHT_CLASS);
        });
    }

    function highlight(button) {
        clearHighlights();
        button.classList.add(HIGHLIGHT_CLASS);
    }

    function getReactProps(el) {
        const key = Object.keys(el).find(k => k.startsWith('__reactProps$'));
        return key ? el[key] : null;
    }

    function invokeReactOnClick(el) {
        let cur = el;
        for (let i = 0; i < 5 && cur; i++) {
            const props = getReactProps(cur);
            if (props && typeof props.onClick === 'function') {
                const fakeEvent = {
                    preventDefault() {}, stopPropagation() {},
                    nativeEvent: { preventDefault() {}, stopPropagation() {} },
                    currentTarget: cur, target: el, type: 'click', bubbles: true,
                };
                try { props.onClick(fakeEvent); return true; } catch (e) {}
            }
            cur = cur.parentElement;
        }
        return false;
    }

    function clickButton(button) {
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const base = {
            bubbles: true, cancelable: true, view: window, button: 0, buttons: 1,
            clientX: x, clientY: y, screenX: x, screenY: y,
        };

        if (typeof PointerEvent === 'function') {
            const pBase = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true, width: 1, height: 1, pressure: 0.5 };
            button.dispatchEvent(new PointerEvent('pointerover', pBase));
            button.dispatchEvent(new PointerEvent('pointerenter', pBase));
            button.dispatchEvent(new PointerEvent('pointerdown', pBase));
            button.dispatchEvent(new PointerEvent('pointerup', { ...pBase, pressure: 0 }));
        }

        button.dispatchEvent(new MouseEvent('mousedown', base));
        button.dispatchEvent(new MouseEvent('mouseup', base));
        button.dispatchEvent(new MouseEvent('click', base));

        try { button.click(); } catch (e) {}

        invokeReactOnClick(button);
    }

    let lastSolvedKey = '';
    let solving = false;

    async function solve(force = false) {
        if (solving) return;
        const question = getQuestionText();
        const buttons = getAnswerButtons();
        if (!question || buttons.length < 2) return;
        const answers = getAnswerTexts(buttons);
        if (answers.some(a => !a)) return; 

        const key = question + '||' + answers.join('|');
        if (!force && key === lastSolvedKey) return;
        lastSolvedKey = key;

        solving = true;
        showBadge('Frage erkannt, denke nach...', '#2196f3');
        try {
            const { index, confidence } = await askOpenAI(question, answers);
            if (index < 0 || index >= buttons.length) {
                showBadge(`Ungueltiger Index ${index}`, '#f44336');
                return;
            }
            highlight(buttons[index]);
            const pct = Math.round((confidence ?? 0) * 100);
            if (getAutoClick()) {
                clickButton(buttons[index]);
                showBadge(`Antwort ${index + 1} geklickt (${pct}%)`, '#ff9800');
            } else {
                showBadge(`Antwort ${index + 1} (${pct}%)`, '#4caf50');
            }
        } catch (e) {
            console.warn('[Kahoot Solver]', e);
            showBadge(e.message || 'Fehler', '#f44336');
        } finally {
            solving = false;
        }
    }

    let debounceTimer = null;
    function scheduleSolve() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => solve(false), 250);
    }

    function init() {
        injectStyles();
        const obs = new MutationObserver(scheduleSolve);
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
        scheduleSolve();
        console.log('[Kahoot Solver] aktiv. Menue -> API-Key setzen, falls noch nicht geschehen.');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();

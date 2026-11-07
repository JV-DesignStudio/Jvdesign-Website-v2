
    /* Mobile nav toggle is wired by the nav-content partial */

    /* ── Restore theme on load ── */
    (function() {
        const saved = localStorage.getItem('jvds-theme');
        if (saved === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            // Update button once DOM is ready
            const applyBtn = () => {
                const btn = document.getElementById('themeToggle');
                if (btn) btn.textContent = '☀️';
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', applyBtn);
            } else {
                applyBtn();
            }
        }
    })();

    // Workshop finder: search + tool + level + age + no-install over the catalogue.
    (function() {
        var tool = document.getElementById('workshopTool');
        var experience = document.getElementById('workshopExperience');
        var difficulty = document.getElementById('workshopDifficulty');
        var search = document.getElementById('workshopSearch');
        var clear = document.getElementById('workshopSearchClear');
        var result = document.getElementById('filterResult');
        var noResults = document.getElementById('workshopNoResults');
        var noResultsHint = document.getElementById('workshopNoResultsHint');
        var resetBtn = document.getElementById('workshopReset');
        var noInstallBtn = document.getElementById('noInstallFilter');
        var ageBar = document.getElementById('ageBar');
        var ageBtns = ageBar ? ageBar.querySelectorAll('[data-age-filter]') : [];
        var activeFilters = document.getElementById('activeFilters');
        var activeChips = document.getElementById('activeFilterChips');
        var activeClear = document.getElementById('activeFilterClear');
        var cards = document.querySelectorAll('#catalogueGrid .course-card');
        var currentAge = 'all';
        var currentQuery = '';
        var noInstallOnly = false;

        // A2793: "works here" mode. The choice sticks per device so a learner on a
        // school PC does not have to turn it back on on every visit.
        var NEEDS_KEY = 'jvds_works_here';
        var NEEDS_LABEL = { browser: 'Runs in browser', install: 'Needs install', account: 'Needs account' };
        function readNeedsPref() {
            try { return localStorage.getItem(NEEDS_KEY) === '1'; } catch (e) { return false; }
        }
        function saveNeedsPref(on) {
            try { localStorage.setItem(NEEDS_KEY, on ? '1' : '0'); } catch (e) {}
        }

        // Map the finder's select values to the exact data-engine values on the cards.
        // This stops Java matching JavaScript and keeps the count honest.
        var TOOL_ENGINE = {
            'Scratch': 'Scratch', 'Roblox': 'Roblox', 'Godot': 'Godot', 'Unity': 'Unity',
            'Unreal': 'Unreal', 'JavaScript': 'JavaScript', 'Python': 'Python',
            'GDevelop': 'GDevelop', 'Defold': 'Defold', 'pico': 'PICO-8', 'Java': 'Java',
            'C++': 'C++', 'GML': 'GML/GameMaker', 'Blender': 'Blender',
            'Minecraft': 'Minecraft', 'MUGEN': 'MUGEN', 'Tinkercad': 'TinkerCAD',
            'OpenRCT2': 'OpenRCT2', 'Stardew': 'Stardew Valley', 'Terraria': 'Terraria',
            'General': 'General'
        };
        // Fallback matchers for cards whose data-engine is General but whose
        // title or URL clearly belongs to the selected tool. Word boundaries keep
        // Java from matching JavaScript.
        var TOOL_MATCH = {
            'Scratch': /scratch/i, 'Roblox': /roblox/i, 'Godot': /godot/i, 'Unity': /unity/i,
            'Unreal': /unreal/i, 'JavaScript': /javascript/i, 'Python': /python/i,
            'GDevelop': /gdevelop/i, 'Defold': /defold/i, 'pico': /pico-?8/i, 'Java': /\bjava\b/i,
            'C++': /c\+\+|cpp/i, 'GML': /gml|gamemaker/i, 'Blender': /blender/i,
            'Minecraft': /minecraft/i, 'MUGEN': /mugen/i, 'Tinkercad': /tinkercad/i,
            'OpenRCT2': /openrct2/i, 'Stardew': /stardew/i, 'Terraria': /terraria/i,
            'General': /general/i
        };

        // Engine workshops need a free desktop install; browser cards run as-is.
        var ENGINE_HREF = /godot|unity|unreal|blender|mugen|minecraft|tinkercad|cpp|java-|python|defold|gdevelop|gml|pico8|pico-8|openrct2|roblox/i;
        var BROWSER_HREF = /js-|javascript|browser|builder|pixel-studio|three\.?js|scratch/i;

        // A2793: trust the generated data-needs first, then fall back to the old
        // href heuristic for any card that predates it. data-studio cards are
        // browser studios even when the engine name suggests an install.
        function runtime(card) {
            var needs = card.getAttribute('data-needs');
            if (needs === 'browser' || needs === 'install' || needs === 'account') return needs;
            if (card.getAttribute('data-studio') === 'true') return 'browser';
            var hay = (card.getAttribute('href') || '') + ' ' + (card.textContent || '');
            if (ENGINE_HREF.test(hay)) return 'install';
            if (BROWSER_HREF.test(hay)) return 'browser';
            return 'browser';
        }
        function paintNeedsBadges() {
            Array.prototype.forEach.call(cards, function(card) {
                if (card.querySelector('.ws-needs-badge')) return;
                var body = card.querySelector('.course-body');
                if (!body) return;
                var need = runtime(card);
                var badge = document.createElement('div');
                badge.className = 'ws-needs-badge ws-needs-' + need;
                badge.textContent = NEEDS_LABEL[need] || NEEDS_LABEL.browser;
                if (need === 'browser') {
                    badge.style.cssText = 'display:inline-block;margin-top:6px;font-size:.6rem;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:var(--teal-lt,rgba(112,163,167,.16));color:var(--teal-dk,#3d6b6e);border:1px solid var(--teal,rgba(112,163,167,.5));';
                } else {
                    badge.style.cssText = 'display:inline-block;margin-top:6px;font-size:.6rem;font-weight:800;letter-spacing:.04em;padding:3px 8px;border-radius:999px;background:var(--gold-lt,rgba(201,138,46,.14));color:var(--gold,#8a5a12);border:1px solid var(--gold,rgba(201,138,46,.5));';
                }
                badge.title = need === 'browser'
                    ? 'You can start this right now in your browser.'
                    : 'You need to install something first. Use No install to see what runs right now.';
                body.appendChild(badge);
            });
        }
        function ageLimit(filter) {
            if (filter === '4-5') return 5;
            if (filter === '6-8') return 8;
            if (filter === '9-12') return 12;
            if (filter === '13+') return 99;
            return Infinity;
        }
        function cardAge(card) {
            var m = String(card.dataset.age || '').match(/\d+/);
            return m ? parseInt(m[0], 10) : 0;
        }
        function selectedText(select) {
            return select && select.selectedIndex >= 0 ? (select.options[select.selectedIndex].textContent || '').trim() : '';
        }
        function focusEl(el) {
            if (el && typeof el.focus === 'function') el.focus();
        }
        function setAge(value) {
            currentAge = value;
            ageBtns.forEach(function(b) {
                var on = b.dataset.ageFilter === value;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
        }
        function isActive() {
            return !!(currentQuery || (tool && tool.value) || (experience && experience.value !== 'all') ||
                (difficulty && difficulty.value) || currentAge !== 'all' || noInstallOnly);
        }
        /* Fuzzy search: score a query token against a haystack string.
           Returns true if token matches exactly (fast path) OR if trigram
           overlap is >= 50% of the token's trigrams (handles ~1-2 char typos). */
        function fuzzyToken(token, hay) {
            if (hay.indexOf(token) !== -1) return true;
            if (token.length < 3) return false; // too short for trigram
            var tris = {};
            var count = 0;
            for (var i = 0; i < token.length - 2; i++) {
                tris[token.slice(i, i + 3)] = true; count++;
            }
            if (count === 0) return false;
            var hits = 0;
            for (var tri in tris) {
                if (hay.indexOf(tri) !== -1) hits++;
            }
            return (hits / count) >= 0.5;
        }

        function makeChip(label, onRemove) {
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'ws-active-chip';
            chip.setAttribute('aria-label', 'Remove filter: ' + label);
            chip.appendChild(document.createTextNode(label));
            var x = document.createElement('span');
            x.className = 'ws-active-chip-x';
            x.setAttribute('aria-hidden', 'true');
            x.textContent = '\u00d7';
            chip.appendChild(x);
            chip.addEventListener('click', onRemove);
            return chip;
        }

        function renderActiveFilters() {
            if (!activeFilters || !activeChips) return;
            activeChips.textContent = '';
            var any = false;
            if (currentQuery) {
                any = true;
                activeChips.appendChild(makeChip('Search: "' + currentQuery + '"', function() {
                    currentQuery = ''; if (search) search.value = ''; applyFilters(); focusEl(search);
                }));
            }
            if (tool && tool.value) {
                any = true;
                activeChips.appendChild(makeChip('Tool: ' + (selectedText(tool) || tool.value), function() {
                    tool.value = ''; applyFilters(); focusEl(tool);
                }));
            }
            if (experience && experience.value !== 'all') {
                any = true;
                activeChips.appendChild(makeChip('Starting point: ' + (selectedText(experience) || experience.value), function() {
                    experience.value = 'all'; applyFilters(); focusEl(experience);
                }));
            }
            if (difficulty && difficulty.value) {
                any = true;
                activeChips.appendChild(makeChip('Level: ' + (selectedText(difficulty) || difficulty.value), function() {
                    difficulty.value = ''; applyFilters(); focusEl(difficulty);
                }));
            }
            if (currentAge !== 'all') {
                any = true;
                activeChips.appendChild(makeChip('Age: ' + currentAge, function() {
                    setAge('all'); applyFilters(); focusEl(ageBar && ageBar.querySelector('[data-age-filter="all"]'));
                }));
            }
            if (noInstallOnly) {
                any = true;
                activeChips.appendChild(makeChip('No install', function() {
                    noInstallOnly = false;
                    saveNeedsPref(false);
                    if (noInstallBtn) { noInstallBtn.classList.remove('active'); noInstallBtn.setAttribute('aria-pressed', 'false'); }
                    applyFilters(); focusEl(noInstallBtn);
                }));
            }
            activeFilters.hidden = !any;
        }

        function updateEmptyHint() {
            if (!noResultsHint) return;
            var tips = [];
            if (currentQuery) tips.push('shorten the search');
            if (tool && tool.value) tips.push('choose Any tool');
            if (experience && experience.value !== 'all') tips.push('choose All projects');
            if (difficulty && difficulty.value) tips.push('choose All levels');
            if (currentAge !== 'all') tips.push('choose All ages');
            if (noInstallOnly) tips.push('turn off No install');
            noResultsHint.textContent = tips.length ? 'To widen the list, ' + tips.join(', ') + '.' : '';
        }

        function applyFilters() {
            document.body.classList.toggle('ws-finder-active', isActive());
            var parts = currentQuery ? currentQuery.split(/\s+/) : [];
            var toolValue = (tool && tool.value) || '';
            var toolName = toolValue.toLowerCase();
            var toolEngine = TOOL_ENGINE[toolValue] || '';
            var toolMatch = TOOL_MATCH[toolValue] || null;
            var count = 0;
            Array.prototype.forEach.call(cards, function(card) {
                var hay = (card.textContent + ' ' + (card.getAttribute('href') || '') + ' ' +
                    (card.dataset.age || '') + ' ' + (card.dataset.engine || '')).toLowerCase();
                var titleEl = card.querySelector('.course-title');
                var matchHay = ((card.getAttribute('href') || '') + ' ' + (titleEl ? titleEl.textContent : '')).toLowerCase();
                var searchOk = !parts.length || parts.every(function(p) { return fuzzyToken(p, hay); });
                var toolOk = !toolValue || (toolEngine && card.dataset.engine === toolEngine) ||
                    (toolMatch ? toolMatch.test(matchHay) : hay.indexOf(toolName) !== -1);
                var expOk = !experience || experience.value !== 'first' || /my-first|my first/i.test(hay);
                var diffOk = !difficulty || !difficulty.value || card.dataset.difficulty === difficulty.value;
                var ageOk = currentAge === 'all' || (card.dataset.age && cardAge(card) <= ageLimit(currentAge));
                var installOk = !noInstallOnly || runtime(card) === 'browser';
                var show = searchOk && toolOk && expOk && diffOk && ageOk && installOk;
                card.style.display = show ? '' : 'none';
                if (show) count++;
            });
            if (result) {
                var bits = 'Showing ' + count + ' workshop' + (count === 1 ? '' : 's');
                if (currentQuery) bits += ' matching "' + currentQuery + '"';
                if (toolValue) bits += ' for ' + (selectedText(tool) || toolValue);
                if (experience && experience.value !== 'all') bits += ' in the My First series';
                if (difficulty && difficulty.value) bits += ' at ' + (selectedText(difficulty) || difficulty.value);
                if (currentAge !== 'all') bits += ' for ages ' + currentAge;
                if (noInstallOnly) bits += ' with no install';
                result.textContent = bits + '.';
            }
            if (noResults) noResults.classList.toggle('show', count === 0);
            if (clear) clear.hidden = !currentQuery;
            renderActiveFilters();
            updateEmptyHint();
        }

        function resetAll() {
            if (tool) tool.value = '';
            if (experience) experience.value = 'all';
            if (difficulty) difficulty.value = '';
            if (search) search.value = '';
            currentQuery = ''; noInstallOnly = false;
            saveNeedsPref(false);
            setAge('all');
            if (noInstallBtn) { noInstallBtn.classList.remove('active'); noInstallBtn.setAttribute('aria-pressed', 'false'); }
            applyFilters();
        }

        if (tool) tool.addEventListener('change', applyFilters);
        if (experience) experience.addEventListener('change', applyFilters);
        if (difficulty) difficulty.addEventListener('change', applyFilters);
        if (noInstallBtn) {
            noInstallBtn.addEventListener('click', function() {
                noInstallOnly = !noInstallOnly;
                saveNeedsPref(noInstallOnly);
                this.classList.toggle('active', noInstallOnly);
                this.setAttribute('aria-pressed', noInstallOnly ? 'true' : 'false');
                applyFilters();
            });
        }
        if (resetBtn) resetBtn.addEventListener('click', function() { resetAll(); if (search) search.focus(); });
        if (activeClear) activeClear.addEventListener('click', function() { resetAll(); focusEl(search); });
        ageBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                setAge(this.dataset.ageFilter);
                applyFilters();
            });
        });
        var searchTimer = 0;
        if (search) search.addEventListener('input', function() {
            if (searchTimer) clearTimeout(searchTimer);
            searchTimer = setTimeout(function() {
                currentQuery = search.value.trim().toLowerCase();
                applyFilters();
            }, 120);
        });
        if (clear) clear.addEventListener('click', function() { currentQuery = ''; if (search) { search.value = ''; search.focus(); } applyFilters(); });

        var noResultsReset = document.getElementById('workshopNoResultsReset');
        if (noResultsReset) {
            noResultsReset.addEventListener('click', function(e) { e.preventDefault(); resetAll(); if (search) search.focus(); });
        }

        // Browse-by-tool tiles drive the tool filter and reveal the catalogue.
        // Engines with a dedicated hub (data-hub) open that hub instead.
        var tiles = document.querySelectorAll('.ws-engine-tile');
        Array.prototype.forEach.call(tiles, function(tile) {
            tile.addEventListener('click', function() {
                if (tile.dataset.hub) { window.location.href = tile.dataset.hub; return; }
                var eng = (tile.dataset.engine || '').toLowerCase();
                if (tool) {
                    var match = '';
                    for (var i = 0; i < tool.options.length; i++) {
                        var o = tool.options[i];
                        var ot = (o.textContent || '').toLowerCase();
                        var ov = (o.value || '').toLowerCase();
                        if (ov && (ov === eng || ot === eng || eng.indexOf(ot) !== -1 || ot.indexOf(eng) !== -1)) { match = o.value; break; }
                    }
                    tool.value = match;
                    tool.dispatchEvent(new Event('change'));
                }
                applyFilters();
                var cat = document.getElementById('catalogue');
                if (cat) cat.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        // A2793: restore the saved "works here" choice, or honour ?works-here=1
        // from the install-only page banner, then label every card.
        try {
            var worksHere = new URLSearchParams(location.search).get('works-here') === '1';
            noInstallOnly = worksHere ? true : readNeedsPref();
            if (worksHere) saveNeedsPref(true);
        } catch (e) {}
        if (noInstallBtn) {
            noInstallBtn.classList.toggle('active', noInstallOnly);
            noInstallBtn.setAttribute('aria-pressed', noInstallOnly ? 'true' : 'false');
        }
        paintNeedsBadges();
        applyFilters();
    })();


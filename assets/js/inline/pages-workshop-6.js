
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
        var resetBtn = document.getElementById('workshopReset');
        var noInstallBtn = document.getElementById('noInstallFilter');
        var ageBar = document.getElementById('ageBar');
        var ageBtns = ageBar ? ageBar.querySelectorAll('[data-age-filter]') : [];
        var cards = document.querySelectorAll('#catalogueGrid .course-card');
        var currentAge = 'all';
        var currentQuery = '';
        var noInstallOnly = false;

        // Engine workshops need a free desktop install; browser cards run as-is.
        var ENGINE_HREF = /godot|unity|unreal|blender|mugen|minecraft|tinkercad|cpp|java-|python|defold|gdevelop|gml|pico8|pico-8|openrct2|roblox/i;
        var BROWSER_HREF = /js-|javascript|browser|builder|pixel-studio|three\.?js|scratch/i;

        function runtime(card) {
            var hay = (card.getAttribute('href') || '') + ' ' + (card.textContent || '');
            if (ENGINE_HREF.test(hay)) return 'engine';
            if (BROWSER_HREF.test(hay)) return 'browser';
            return 'browser';
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
        function isActive() {
            return !!(currentQuery || (tool && tool.value) || (experience && experience.value !== 'all') ||
                (difficulty && difficulty.value) || currentAge !== 'all' || noInstallOnly);
        }
        function applyFilters() {
            document.body.classList.toggle('ws-finder-active', isActive());
            var parts = currentQuery ? currentQuery.split(/\s+/) : [];
            var toolName = ((tool && tool.value) || '').toLowerCase();
            var count = 0;
            Array.prototype.forEach.call(cards, function(card) {
                var hay = (card.textContent + ' ' + (card.getAttribute('href') || '') + ' ' +
                    (card.dataset.age || '') + ' ' + (card.dataset.engine || '')).toLowerCase();
                var searchOk = !parts.length || parts.every(function(p) { return hay.indexOf(p) !== -1; });
                var toolOk = !toolName || hay.indexOf(toolName) !== -1;
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
                if (toolName) bits += ' for ' + toolName;
                if (currentAge !== 'all') bits += ' · ages ' + currentAge;
                result.textContent = bits + '.';
            }
            if (noResults) noResults.classList.toggle('show', count === 0);
            if (clear) clear.hidden = !currentQuery;
        }

        function resetAll() {
            if (tool) tool.value = '';
            if (experience) experience.value = 'all';
            if (difficulty) difficulty.value = '';
            if (search) search.value = '';
            currentQuery = ''; currentAge = 'all'; noInstallOnly = false;
            if (noInstallBtn) { noInstallBtn.classList.remove('active'); noInstallBtn.setAttribute('aria-pressed', 'false'); }
            ageBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
            var allBtn = ageBar && ageBar.querySelector('[data-age-filter="all"]');
            if (allBtn) { allBtn.classList.add('active'); allBtn.setAttribute('aria-pressed', 'true'); }
            applyFilters();
        }

        if (tool) tool.addEventListener('change', applyFilters);
        if (experience) experience.addEventListener('change', applyFilters);
        if (difficulty) difficulty.addEventListener('change', applyFilters);
        if (noInstallBtn) {
            noInstallBtn.addEventListener('click', function() {
                noInstallOnly = !noInstallOnly;
                this.classList.toggle('active', noInstallOnly);
                this.setAttribute('aria-pressed', noInstallOnly ? 'true' : 'false');
                applyFilters();
            });
        }
        if (resetBtn) resetBtn.addEventListener('click', function() { resetAll(); if (search) search.focus(); });
        ageBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                currentAge = this.dataset.ageFilter;
                ageBtns.forEach(function(b) { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
                this.classList.add('active');
                this.setAttribute('aria-pressed', 'true');
                applyFilters();
            });
        });
        if (search) search.addEventListener('input', function() { currentQuery = this.value.trim().toLowerCase(); applyFilters(); });
        if (clear) clear.addEventListener('click', function() { currentQuery = ''; if (search) { search.value = ''; search.focus(); } applyFilters(); });

        var noResultsReset = document.getElementById('workshopNoResultsReset');
        if (noResultsReset) {
            noResultsReset.addEventListener('click', function(e) { e.preventDefault(); resetAll(); if (search) search.focus(); });
        }

        // Browse-by-tool tiles drive the tool filter and reveal the catalogue.
        var tiles = document.querySelectorAll('.ws-engine-tile');
        Array.prototype.forEach.call(tiles, function(tile) {
            tile.addEventListener('click', function() {
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

        applyFilters();
    })();


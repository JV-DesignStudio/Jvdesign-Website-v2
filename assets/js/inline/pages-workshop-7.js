(function(){
    var MAP = {
        '../workshops/scratch-catch-workshop.html':        'jvds-scratch-catch-v2',
        '../workshops/scratch-platformer-workshop.html':   'jvds-scratch-platformer-v2',
        '../workshops/scratch-quiz-workshop.html':         'jvds-scratch-quiz-v2',
        '../workshops/scratch-maze-workshop.html':         'jvds-scratch-maze-v2',
        '../workshops/scratch-clicker-workshop.html':      'jvds-scratch-clicker-v2',
        '../workshops/scratch-story-workshop.html':        'jvds-scratch-story-v2',
        '../workshops/roblox-obby-workshop.html':          'jvds-roblox-obby-v2',
        '../workshops/roblox-tycoon-workshop.html':        'jvds-roblox-tycoon-v2',
        '../workshops/roblox-simulator-workshop.html':     'jvds-roblox-simulator-v2',
        '../workshops/roblox-battle-workshop.html':        'jvds-roblox-battle-v2',
        '../workshops/roblox-horror-workshop.html':        'jvds-roblox-horror-v2',
        '../workshops/roblox-adventure-workshop.html':     'jvds-roblox-adventure-v2',
        '../workshops/roblox-pirate-workshop.html':        'jvds-roblox-pirate-v2',
        '../workshops/roblox-collapse-obby-workshop.html': 'jvds-roblox-collapse-v1',
        '../workshops/minecraft-first-item-mod.html':      'jvds-minecraft-first-item-v2',
        '../workshops/minecraft-custom-block-mod.html':    'jvds-minecraft-custom-block-v2',
        '../workshops/minecraft-custom-food-mod.html':     'jvds-minecraft-custom-food-v2',
        '../workshops/minecraft-custom-mob-mod.html':      'jvds-minecraft-custom-mob-v2',
        '../workshops/minecraft-custom-tool-mod.html':     'jvds-minecraft-custom-tool-v2',
        '../workshops/minecraft-lucky-mod.html':           'jvds-minecraft-lucky-v2',
        '../workshops/stardew-world-ep1-setup.html':       'jvds-stardew-world-ep1-v2',
        '../workshops/stardew-world-ep2-mods-folder.html': 'jvds-stardew-world-ep2-v2',
        '../workshops/stardew-world-ep3-first-tile.html':  'jvds-stardew-world-ep3-v2',
        '../workshops/stardew-world-ep4-layers.html':      'jvds-stardew-world-ep4-v2',
        '../workshops/stardew-world-ep5-tile-properties.html': 'jvds-stardew-world-ep5-v2',
        '../workshops/stardew-world-ep6-build-and-decorate.html': 'jvds-stardew-world-ep6-v2',
        '../workshops/stardew-world-ep7-warps.html':       'jvds-stardew-world-ep7-v2',
        '../workshops/stardew-world-ep8-new-area.html':    'jvds-stardew-world-ep8-v2',
        '../workshops/stardew-world-ep9-package-mod.html': 'jvds-stardew-world-ep9-v2',
        '../workshops/stardew-world-ep10-troubleshoot.html': 'jvds-stardew-world-ep10-v2',
        '../workshops/stardew-world-ep11-play-share.html': 'jvds-stardew-world-ep11-v2',
        '../workshops/stardew-world-ep12-design.html': 'jvds-stardew-world-ep12-v2',
        '../workshops/godot-racing-workshop.html':         'jvds-godot-racing-v2',
        '../workshops/godot-racing-workshop-2.html':       'jvds-godot-racing2-v2',
        '../workshops/jump-jump-mario-workshop.html':      'jvds-jump-jump-mario-v2',
        '../workshops/barrel-blast-workshop.html':         'jvds-barrel-blast-v2',
        '../workshops/pixel-quest-workshop.html':          'jvds-pixel-quest-v2',
        '../workshops/night-watch-workshop.html':          'jvds-night-watch-v2',
        '../workshops/night-watch-part2-workshop.html':    'jvds-night-watch-p2-v2',
        '../workshops/night-watch-part3-workshop.html':    'jvds-night-watch-p3-v2',
        '../workshops/mugen-workshop.html':               'jvds-mugen-v2',
        '../workshops/mugen-ai-workshop.html':            'jvds-mugen-ai-v2',
        '../workshops/add-your-own-stage.html':           'jvds-mugen-stage-v2',
        '../workshops/unreal-fighter-workshop.html':      'jvds-unreal-fighter-v2',
        '../workshops/blender-workshop.html':             'jvds-blender-v2',
        '../workshops/my-first-3d-prints-fidget-toy.html': 'jvds-3d-print-v2',
        '../workshops/unity-2d-platformer.html':          'jvds-unity-2d-platformer-v2',
        '../workshops/unity-3d-platformer.html':          'jvds-unity-3d-platformer-v2',
        '../workshops/unity-top-down-shooter.html':       'jvds-unity-top-down-v2',
        '../workshops/unreal-blueprint-shooter.html':     'jvds-unreal-bp-shooter-v2',
        '../workshops/unreal-clicker-builder.html':       'jvds-unreal-clicker-v2',
        '../workshops/unreal-top-down-shooter.html':      'jvds-unreal-top-down-v2',
        '../workshops/unreal-zombie-survivor.html':       'jvds-unreal-zombie-v2',
        '../workshops/godot_tutorial.html':               'jvds-godot-tutorial-v2',
        '../workshops/space_invaders_tutorial.html':      'jvds-space-invaders-v2',
        '../workshops/js-platformer-builder.html':        'jvds-js-platformer-v2',
        '../workshops/python-game-builder.html':          'jvds-python-game-v2',
        '../workshops/cpp-tower-defence-builder.html':    'jvds-cpp-tower-defence-v2',
        '../workshops/race-builder.html':                 'jvds-race-builder-v2',
        '../workshops/racing-blueprint.html':             'jvds-racing-blueprint-v2',
        '../workshops/fairy-survivors-guide.html':        'jvds-fairy-survivors-v2',
        '../workshops/fnaf-blueprint.html':               'jvds-fnaf-blueprint-v2',
        '../workshops/gml_shooter_trainer_project.html':  'jvds-gml-shooter-v2',
        '../workshops/openrct2-modding-builder.html':     'jvds-openrct2-modding-v2',
        '../workshops/openrct2-swim-rescue.html':         'jvds-openrct2-swim-v2'
    };

    function getStatus(key) {
        try {
            var raw = localStorage.getItem(key);
            if (!raw) return null;
            var d = JSON.parse(raw);
            if (d.completed) return 'done';
            // Check if any step beyond 0 is completed
            if (d.currentStep > 0 || (d.completedSteps && d.completedSteps.length > 0)) return 'wip';
            if (d.xp > 0) return 'wip';
            return null;
        } catch(e) { return null; }
    }

    // Find all links on the page and badge them
    var allLinks = document.querySelectorAll('a[href]');
    allLinks.forEach(function(a) {
        var href = a.getAttribute('href');
        if (!MAP[href]) return;
        var status = getStatus(MAP[href]);
        if (!status) return;

        var badge = document.createElement('span');
        badge.className = 'ws-completion-badge ' + (status === 'done' ? 'ws-badge-done' : 'ws-badge-wip');
        badge.textContent = status === 'done' ? '✅ Complete' : '🔄 In Progress';

        // If the link is an article-card itself, inject into the thumb area
        if (a.classList.contains('article-card')) {
            var thumb = a.querySelector('.article-thumb');
            if (thumb) { thumb.style.position = 'relative'; thumb.appendChild(badge); }
            return;
        }
        // Otherwise find the closest article-card ancestor
        var card = a.closest('.article-card');
        if (card) {
            var thumb = card.querySelector('.article-thumb');
            if (thumb) { thumb.style.position = 'relative'; thumb.appendChild(badge); }
        }
    });
})();


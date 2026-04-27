var savedCount = 0;
var beingRescued = {};

// ==============================
// WATER CHECK
// ==============================
function isOnWater(guest) {
    var tileX = guest.x >> 5;
    var tileY = guest.y >> 5;

    if (tileX < 0 || tileY < 0) return false;

    try {
        var tile = map.getTile(tileX, tileY);
        if (!tile) return false;

        for (var i = 0; i < tile.numElements; i++) {
            var el = tile.getElement(i);
            if (el.type === "surface" && el.waterHeight > 0) {
                return guest.z <= (el.waterHeight * 8);
            }
        }
    } catch (e) {}

    return false;
}

// ==============================
// FIND NEAREST PATH
// ==============================
function findSafePath(guest) {
    var tileX = guest.x >> 5;
    var tileY = guest.y >> 5;

    for (var r = 1; r <= 20; r++) {
        for (var dx = -r; dx <= r; dx++) {
            for (var dy = -r; dy <= r; dy++) {
                if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;

                try {
                    var tile = map.getTile(tileX + dx, tileY + dy);
                    if (!tile) continue;

                    for (var i = 0; i < tile.numElements; i++) {
                        var el = tile.getElement(i);
                        if (el.type === "footpath") {
                            return {
                                x: ((tileX + dx) << 5) + 16,
                                y: ((tileY + dy) << 5) + 16,
                                z: el.baseZ
                            };
                        }
                    }
                } catch (e) {}
            }
        }
    }
    return null;
}

// ==============================
// RESCUE
// ==============================
function rescueGuest(guest) {
    var safe = findSafePath(guest);
    if (!safe) return;

    beingRescued[guest.id] = true;

    guest.x = safe.x;
    guest.y = safe.y;
    guest.z = safe.z;

    guest.energy = 255;
    guest.happiness = 200;
    guest.nausea = 0;

    savedCount++;
    console.log("✅ Rescued guest " + guest.id + " | Total: " + savedCount);

    // Clear rescue flag after a short delay so we don't re-trigger
    context.setTimeout(function () {
        beingRescued[guest.id] = false;
    }, 2000);
}

// ==============================
// MAIN
// ==============================
function main() {
    context.subscribe("interval.tick", function () {
        if ((date.ticks & 7) !== 0) return;

        var guests = map.getAllEntities("guest");

        for (var i = 0; i < guests.length; i++) {
            var g = guests[i];

            if (beingRescued[g.id]) continue;

            if (isOnWater(g)) {
                rescueGuest(g);
            }
        }
    });
}

registerPlugin({
    name: "Swim_Rescue",
    version: "3.0",
    authors: ["JVDesignStudio"],
    type: "local",
    targetApiVersion: 34,
    main: main
});
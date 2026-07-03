// ============================================================
//  Swim Rescue v2.0, OpenRCT2 Plugin
//  Made at JVDesignStudio
//  Place in: Documents/OpenRCT2/plugin/
// ============================================================

var savedCount    = 0;
var drownedCount  = 0;
var beingRescued  = {};
var activeRescues = [];
var rescueEnabled = true;

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
// SPAWN BALLOON MARKER
// ==============================
function spawnMarker(x, y, z) {
    try {
        var marker = map.createEntity("balloon", {
            x: x,
            y: y,
            z: z + 200
        });
        return marker;
    } catch (e) {
        console.log("[SwimRescue] Could not spawn marker: " + e);
        return null;
    }
}

// ==============================
// DISPATCH RESCUE
// ==============================
function dispatchRescue(guest, safe) {
    beingRescued[guest.id] = true;
    var marker = spawnMarker(guest.x + 100, guest.y + 100, guest.z);

    if (!marker) {
        // Fallback, instant teleport if balloon spawn fails
        teleportToSafety(guest, safe);
        return;
    }

    activeRescues.push({
        guestId:  guest.id,
        markerId: marker.id,
        markerX:  marker.x,
        markerY:  marker.y,
        markerZ:  marker.z,
        frozenX:  guest.x,
        frozenY:  guest.y,
        frozenZ:  guest.z,
        targetX:  guest.x,
        targetY:  guest.y,
        targetZ:  guest.z + 200,
        safe:     safe,
        state:    0,
        ticks:    0
    });

    console.log("[SwimRescue] Rescue dispatched for guest " + guest.id);
}

// ==============================
// TELEPORT HELPER
// ==============================
function teleportToSafety(guest, safe) {
    guest.x         = safe.x;
    guest.y         = safe.y;
    guest.z         = safe.z;
    guest.energy    = 255;
    guest.happiness = 200;
    guest.nausea    = 0;
    savedCount++;
    beingRescued[guest.id] = false;
    console.log("[SwimRescue] Instant rescued guest " + guest.id + " | Total: " + savedCount);
}

// ==============================
// UPDATE RESCUES EACH TICK
// ==============================
function updateRescues() {
    for (var i = activeRescues.length - 1; i >= 0; i--) {
        var r = activeRescues[i];
        r.ticks++;

        var guest  = map.getEntity(r.guestId);
        var marker = map.getEntity(r.markerId);

        // Clean up if either entity is gone
        if (!guest || !marker) {
            if (marker) marker.remove();
            activeRescues.splice(i, 1);
            if (guest) beingRescued[guest.id] = false;
            continue;
        }

        // Safety timeout, if rescue takes too long, just teleport
        if (r.ticks > 500) {
            teleportToSafety(guest, r.safe);
            marker.remove();
            activeRescues.splice(i, 1);
            continue;
        }

        // Keep guest frozen and stats healthy while being rescued
        guest.x         = r.frozenX;
        guest.y         = r.frozenY;
        guest.z         = r.frozenZ;
        guest.energy    = 255;
        guest.happiness = 200;
        guest.nausea    = 0;

        // STATE 0: Fly balloon toward guest
        if (r.state === 0) {
            r.markerX += (r.targetX - r.markerX) * 0.1;
            r.markerY += (r.targetY - r.markerY) * 0.1;
            r.markerZ += (r.targetZ - r.markerZ) * 0.1;

            marker.x = Math.round(r.markerX);
            marker.y = Math.round(r.markerY);
            marker.z = Math.round(r.markerZ);

            if (Math.abs(r.markerX - r.targetX) < 20 &&
                Math.abs(r.markerY - r.targetY) < 20) {
                r.state = 1;
                console.log("[SwimRescue] Picking up guest " + guest.id);
            }
        }

        // STATE 1: Fly balloon + guest to safety
        else if (r.state === 1) {
            r.markerX += (r.safe.x         - r.markerX) * 0.08;
            r.markerY += (r.safe.y         - r.markerY) * 0.08;
            r.markerZ += (r.safe.z + 200   - r.markerZ) * 0.08;

            marker.x = Math.round(r.markerX);
            marker.y = Math.round(r.markerY);
            marker.z = Math.round(r.markerZ);

            // Also move the frozen position so guest appears to travel
            r.frozenX = marker.x;
            r.frozenY = marker.y;
            r.frozenZ = Math.max(r.safe.z, marker.z - 200);

            if (Math.abs(r.markerX - r.safe.x) < 20 &&
                Math.abs(r.markerY - r.safe.y) < 20) {

                // Drop guest at safety
                guest.x         = r.safe.x;
                guest.y         = r.safe.y;
                guest.z         = r.safe.z;
                guest.energy    = 255;
                guest.happiness = 200;
                guest.nausea    = 0;

                savedCount++;
                console.log("[SwimRescue] Rescued guest " + guest.id + " | Total saved: " + savedCount);

                marker.remove();
                activeRescues.splice(i, 1);

                var rescuedId = r.guestId;
                context.setTimeout(function() {
                    beingRescued[rescuedId] = false;
                }, 2000);

                // Refresh UI
                updateWindow();
            }
        }
    }
}

// ==============================
// UI WINDOW
// ==============================
var statsWindow = null;

function openStatsWindow() {
    try {
        statsWindow = ui.openWindow({
            classification: "swim-rescue",
            title: "Swim Rescue",
            width: 200,
            height: 120,
            onClose: function() { statsWindow = null; },
            widgets: [
                {
                    type: "label",
                    name: "lbl_saved",
                    x: 10, y: 30,
                    width: 180, height: 14,
                    text: "Guests rescued: " + savedCount
                },
                {
                    type: "label",
                    name: "lbl_active",
                    x: 10, y: 48,
                    width: 180, height: 14,
                    text: "Active rescues: " + activeRescues.length
                },
                {
                    type: "label",
                    name: "lbl_status",
                    x: 10, y: 66,
                    width: 180, height: 14,
                    text: "Status: " + (rescueEnabled ? "ON" : "OFF")
                },
                {
                    type: "button",
                    name: "btn_toggle",
                    x: 10, y: 88,
                    width: 85, height: 16,
                    text: rescueEnabled ? "Disable" : "Enable",
                    onClick: function() {
                        rescueEnabled = !rescueEnabled;
                        console.log("[SwimRescue] " + (rescueEnabled ? "Enabled" : "Disabled"));
                        updateWindow();
                    }
                }
            ]
        });
    } catch (e) {
        console.log("[SwimRescue] UI not available: " + e);
    }
}

function updateWindow() {
    if (!statsWindow) return;
    try {
        statsWindow.findWidget("lbl_saved").text  = "Guests rescued: " + savedCount;
        statsWindow.findWidget("lbl_active").text = "Active rescues: " + activeRescues.length;
        statsWindow.findWidget("lbl_status").text = "Status: " + (rescueEnabled ? "ON" : "OFF");
        statsWindow.findWidget("btn_toggle").text = rescueEnabled ? "Disable" : "Enable";
    } catch (e) {}
}

// ==============================
// MAIN
// ==============================
function main() {
    console.log("[SwimRescue] Swim Rescue v2.0 loaded!");

    context.subscribe("interval.tick", function() {
        if (!rescueEnabled) return;
        if ((date.ticks & 7) !== 0) return;

        var guests = map.getAllEntities("guest");
        for (var i = 0; i < guests.length; i++) {
            var g = guests[i];
            if (beingRescued[g.id]) continue;
            if (activeRescues.length >= 5) break;
            if (isOnWater(g)) {
                var safe = findSafePath(g);
                if (safe) {
                    dispatchRescue(g, safe);
                } else {
                    drownedCount++;
                    console.log("[SwimRescue] No path found for guest " + g.id);
                }
            }
        }

        updateRescues();

        // Refresh UI every 32 ticks
        if ((date.ticks & 31) === 0) updateWindow();
    });

    if (typeof ui !== "undefined") {
        openStatsWindow();
    }
}

registerPlugin({
    name: "Swim_Rescue",
    version: "2.0",
    authors: ["JVDesignStudio"],
    type: "local",
    targetApiVersion: 34,
    main: main
});
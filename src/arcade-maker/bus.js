// bus.js , A2683: one tiny vanilla event bus for Arcade Game Maker UI intents.
// The DOM publishes intents (gm:config, gm:pause) and never reaches into a
// Phaser scene. The running system subscribes, applies the change, then
// publishes gm:state:* so the DOM can render the result.
const ArcadeBus = (() => {
    const target = (typeof document !== 'undefined') ? document : null;
    const prefix = 'gm:';
    return {
        emit(name, detail) {
            if (!target) return;
            try { target.dispatchEvent(new CustomEvent(prefix + name, { detail })); } catch (e) {}
        },
        on(name, handler) {
            if (!target || typeof handler !== 'function') return () => {};
            const wrapped = (e) => { try { handler(e.detail); } catch (err) {} };
            target.addEventListener(prefix + name, wrapped);
            return () => target.removeEventListener(prefix + name, wrapped);
        },
        off(name, handler) {
            if (target) target.removeEventListener(prefix + name, handler);
        },
        state(name, detail) { this.emit('state:' + name, detail); }
    };
})();
export { ArcadeBus };
export default ArcadeBus;

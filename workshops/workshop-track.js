/* workshop-track.js — records current page for "continue where you left off" */
try { localStorage.setItem('jvds_last_workshop', location.pathname); } catch(e) {}

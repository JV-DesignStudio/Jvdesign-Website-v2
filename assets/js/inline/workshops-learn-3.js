
    /* ── Weekly Challenge ── */
    const CHALLENGES = [
      { lang:'JavaScript', icon:'🟨', title:'Make it bounce', desc:'Create a ball that bounces off the edges of the screen using requestAnimationFrame. The ball should speed up slightly each bounce.', hint:'Tip: use velocity variables and reverse the sign when x or y hits the edge.' },
      { lang:'Python', icon:'🐍', title:'Number guessing game', desc:'Write a number guessing game. The computer picks a random number 1-100. The player guesses. The program says "higher", "lower" or "correct!"', hint:'Tip: use random.randint(1, 100) and a while loop.' },
      { lang:'Godot 4', icon:'🎮', title:'Add a collectible', desc:'In any Godot project, add a coin or star that disappears when the player walks over it and increments a score label.', hint:'Tip: use Area2D with body_entered signal for the collision.' },
      { lang:'JavaScript', icon:'🟨', title:'Click counter with reset', desc:'Build a webpage with a number that goes up every time you click a button, and a reset button that brings it back to zero. Style it nicely.', hint:'Tip: store count in a variable and update innerHTML each click.' },
      { lang:'Python', icon:'🐍', title:'Simple quiz program', desc:'Write a 5-question quiz in Python. Track the score. At the end, print how many they got right and a message based on their score.', hint:'Tip: store questions in a list of dicts with question, answer keys.' },
      { lang:'Godot 4', icon:'🎮', title:'Enemy patrol', desc:'Make a simple enemy that walks back and forth between two points using a Timer and AnimatedSprite2D. Flip the sprite when it changes direction.', hint:'Tip: store left_point and right_point as Vector2 variables.' },
      { lang:'JavaScript', icon:'🟨', title:'Colour palette generator', desc:'Make a page that displays 5 random colour boxes every time you press a button. Show the hex code under each one. Add a "copy" button per colour.', hint:'Tip: Math.floor(Math.random()*16777215).toString(16) generates hex.' },
      { lang:'Python', icon:'🐍', title:'Word frequency counter', desc:'Ask the user to type a sentence. Count how many times each word appears and print the results sorted from most to least frequent.', hint:'Tip: use a dict and .split() to break the sentence into words.' },
    ];
    const weekNum = Math.floor(Date.now() / (7*24*60*60*1000));
    const challenge = CHALLENGES[weekNum % CHALLENGES.length];
    const cEl = document.getElementById('weeklyChallenge');
    if(cEl) cEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
        <span style="font-size:1.6rem;">${challenge.icon}</span>
        <div>
          <div style="font-size:.65rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--teal);margin-bottom:2px;">${challenge.lang} challenge</div>
          <div style="font-family:'Fredoka',cursive;font-size:1.3rem;color:#f0ead6;">${challenge.title}</div>
        </div>
      </div>
      <p style="font-size:.9rem;color:rgba(240,234,214,.65);line-height:1.7;margin-bottom:12px;">${challenge.desc}</p>
      <div style="background:rgba(112,163,167,.1);border:1px solid rgba(112,163,167,.2);border-radius:10px;padding:10px 14px;font-size:.8rem;color:rgba(240,234,214,.5);line-height:1.55;">${challenge.hint}</div>
      <div style="margin-top:14px;font-size:.72rem;font-weight:700;color:rgba(240,234,214,.3);">Changes every Monday · Week ${weekNum % 52 + 1}</div>`;

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


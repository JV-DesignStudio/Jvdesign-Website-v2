    // Star field in hero
    (function(){
        const sf = document.getElementById('starfield');
        for(let i = 0; i < 80; i++){
            const s = document.createElement('div');
            s.className = 'star-dot';
            const size = Math.random() * 2.2 + 0.4;
            s.style.cssText = `
                width:${size}px; height:${size}px;
                left:${Math.random()*100}%;
                top:${Math.random()*100}%;
                --dur:${(Math.random()*3+1.5).toFixed(1)}s;
                --delay:${(Math.random()*4).toFixed(1)}s;
            `;
            sf.appendChild(s);
        }
    })();

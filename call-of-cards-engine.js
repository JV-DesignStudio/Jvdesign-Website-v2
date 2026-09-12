/* ===== CALL OF THE CARDS - GAME ENGINE ===== */

const CARD_DB = {
  companions: [
    { id:'c1', name:'Wandering Rogue',     emoji:'🗡️', cost:1, power:1, type:'companion', text:'Cheap, scrappy, and always useful early.' },
    { id:'c2', name:'Captain of the Guard', emoji:'🧙', cost:2, power:3, type:'companion', text:'Loyal to the last and worth every coin.' },
    { id:'c3', name:'Elf Archer',           emoji:'🏹', cost:3, power:4, type:'companion', text:'Swift, precise, never misses a quest.' },
    { id:'c4', name:'Dwarven Smith',        emoji:'⚒️', cost:2, power:2, type:'companion', text:'When recruited, draw 1 card.' },
    { id:'c5', name:'Forest Scout',         emoji:'🌿', cost:2, power:2, type:'companion', text:'Reliable tracker. Solid early power.' },
    { id:'c6', name:'Siege Engineer',       emoji:'🏗️', cost:3, power:4, type:'companion', text:'Every fortress has a weakness.' },
    { id:'c7', name:'Healer',               emoji:'💚', cost:2, power:2, type:'companion', text:'All allies gain +1 Power while Healer is in play.' },
    { id:'c8', name:'Shadow Thief',         emoji:'🦇', cost:1, power:1, type:'companion', text:'When recruited, opponent discards 1 random card.' },
  ],
  artifacts: [
    { id:'a1', name:'Ring of Courage',    emoji:'💍', cost:4, type:'artifact', text:'All Companions gain +1 Power.', effect:'allies_plus_1' },
    { id:'a2', name:'Shield of Ages',     emoji:'🛡️', cost:4, type:'artifact', text:'Ignore 1 Power requirement on quests.', effect:'ignore_1_req' },
    { id:'a3', name:'Sword of Dawn',      emoji:'⚔️', cost:6, type:'artifact', text:'Gain +1 bonus VP when completing any Quest.', effect:'bonus_vp' },
    { id:'a4', name:'Amulet of Renewal',  emoji:'🔮', cost:3, type:'artifact', text:'Draw 1 extra card at the start of each turn.', effect:'draw_1' },
    { id:'a5', name:'Crown of Whispers',  emoji:'👑', cost:4, type:'artifact', text:'Once per turn, peek at the top card of your deck.', effect:'peek' },
    { id:'a6', name:'Boots of Haste',     emoji:'👢', cost:2, type:'artifact', text:'You may recruit one extra Companion per turn.', effect:'extra_recruit' },
  ],
  quests: [
    { id:'q1',  name:'Patrol the Border',      emoji:'📜', vp:1, req:3,  text:'A routine task but the crown is built one stone at a time.' },
    { id:'q2',  name:'Scout the Ruins',         emoji:'🏚️', vp:1, req:4,  text:'Ancient secrets lie within, guarded by time.' },
    { id:'q3',  name:'Defend the Village',      emoji:'🏘️', vp:1, req:3,  text:'The villagers count on your strength.' },
    { id:'q4',  name:'Storm the Fortress',      emoji:'🏰', vp:2, req:6,  text:'Bravery alone won\'t win this one you\'ll need a full party.' },
    { id:'q5',  name:'Slay the Dragon',         emoji:'🐉', vp:2, req:7,  text:'Legends are made in moments like these.' },
    { id:'q6',  name:'Reclaim the Throne',      emoji:'👑', vp:2, req:8,  text:'The crown awaits those bold enough to seize it.' },
    { id:'q7',  name:'Assassin\'s Bounty',       emoji:'🗡️', vp:2, req:5,  text:'A high-value target moves under cover of night. Now worth 2 VP.' },
    { id:'q8',  name:'Troll Hunt',              emoji:'👹', vp:1, req:4,  text:'Ugly, smelly, and surprisingly tough.' },
    { id:'q9',  name:'Enchanted Forest Quest',  emoji:'🌲', vp:2, req:6,  text:'The forest tests all who enter.' },
    { id:'q10', name:'Final Coronation',        emoji:'🏆', vp:3, req:10, text:'The ultimate test. Claim the throne for good.' },
    { id:'q11', name:'Bandit Raid',            emoji:'💀', vp:2, req:5,  text:'Bandits threaten the trade road. Stop them for glory.' },
    { id:'q12', name:'Ancient Library',         emoji:'📚', vp:1, req:4,  text:'Recover lost knowledge for the realm.' },
    { id:'q13', name:'Goblin Market',           emoji:'🪙', vp:1, req:3,  text:'Trade under pressure. Quick deal, quick VP.' },
    { id:'q14', name:'Haunted Keep',            emoji:'👻', vp:2, req:6,  text:'Ghosts don’t yield. Bring heavy power.' },
    { id:'q15', name:'Crown Courier',           emoji:'📯', vp:1, req:5,  text:'Deliver the sealed letter through enemy lines.' },
    { id:'q16', name:'Starfall Summit',         emoji:'⭐', vp:3, req:9,  text:'The climb is brutal but the view is worth 3 VP.' },
  ],
  gold: [
    { id:'g1', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g2', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g3', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g4', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g5', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g6', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g7', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g8', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g9', name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
    { id:'g10',name:'Gold Card', emoji:'💰', type:'gold', text:'Currency to recruit Companions and purchase Artifacts.' },
  ],
};

function shuffle(arr) {
  for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]; }
  return arr;
}

class CallOfCardsGame {
  constructor(mode) {
    this.mode = mode || 'ai'; // 'ai' or 'pvp'
    this.state = null;
    this.turnPhase = 'draw';
    this.recruitsThisTurn = 0;
    this.maxRecruitsPerTurn = 1;
    this.turnNumber = 0;
    this.gameOver = false;
    this.onStateChange = null;
    this.onGameEnd = null;
    this.onPassDevice = null;
  }

  buildDeck() {
    const deck = [];
    CARD_DB.companions.forEach(c => { for(let i=0;i<3;i++) deck.push({...c, uid: c.id+'_'+i+'_'+Math.random().toString(36).slice(2,6)}); });
    CARD_DB.artifacts.forEach(a => { for(let i=0;i<2;i++) deck.push({...a, uid: a.id+'_'+i+'_'+Math.random().toString(36).slice(2,6)}); });
    CARD_DB.gold.forEach(g => deck.push({...g, uid: g.id+'_'+Math.random().toString(36).slice(2,6)}));
    return shuffle(deck);
  }

  buildQuestPool() {
    return shuffle([...CARD_DB.quests]);
  }

  makePlayer(name) {
    const deck = this.buildDeck();
    return {
      name,
      hand: deck.splice(0, 5),
      field: [],
      artifacts: [],
      vp: 0,
      deck,
    };
  }

  initGame() {
    const p1 = this.makePlayer('Player 1');
    const p2 = this.makePlayer(this.mode === 'ai' ? 'Rival' : 'Player 2');
    const quests = this.buildQuestPool();

    this.state = {
      p1,
      p2,
      quests: quests.splice(0, 3),
      questPool: quests,
      turn: 1,
      activePlayer: 'p1',
      log: [],
      winTarget: 5,
    };

    this.turnNumber = 1;
    this.gameOver = false;
    this.startTurn();
    this.emit();
  }

  /* ---- Helpers ---- */
  active() { return this.state[this.state.activePlayer]; }
  inactive() { return this.state[this.state.activePlayer === 'p1' ? 'p2' : 'p1']; }
  isAI() { return this.mode === 'ai' && this.state.activePlayer === 'p2'; }

  getAvailableGold(p) {
    return p.hand.filter(c => c.type === 'gold').length;
  }

  getTotalPower(p) {
    let power = 0;
    const hasRing = p.artifacts.some(a => a.effect === 'allies_plus_1');
    const healerBonus = p.field.filter(c => c.id === 'c7').length; // each Healer gives +1 to all allies, stacks with Ring
    const bonus = (hasRing ? 1 : 0) + healerBonus;
    p.field.forEach(c => { power += c.power + bonus; });
    return power;
  }

  canCompleteQuest(p, quest) {
    const hasShield = p.artifacts.some(a => a.effect === 'ignore_1_req');
    const req = hasShield ? Math.max(0, quest.req - 1) : quest.req;
    return this.getTotalPower(p) >= req;
  }

  isUnderdog(p) {
    if(!this.state) return false;
    const opp = this.state.p1 === p ? this.state.p2 : this.state.p1;
    return opp && (opp.vp - p.vp) >= 2;
  }

  /* ---- Turn management ---- */
  startTurn() {
    const p = this.active();
    this.turnPhase = 'main';
    this.recruitsThisTurn = 0;
    this.maxRecruitsPerTurn = p.artifacts.some(a => a.effect === 'extra_recruit') ? 2 : 1;

    // Draw 1 (2 with Amulet of Renewal) + Underdog's Resolve: draw 1 extra if 2+ VP behind (v1.3)
    let drawCount = p.artifacts.some(a => a.effect === 'draw_1') ? 2 : 1;
    if(this.isUnderdog(p)) drawCount += 1;
    for(let i=0; i<drawCount; i++) {
      if(p.deck.length > 0) p.hand.push(p.deck.shift());
    }

    if(this.isUnderdog(p) && drawCount > 1) {
      this.log(`${p.name} draws extra - Underdog's Resolve!`);
    } else {
      this.log(`${p.name}'s turn ${this.turnNumber}`);
    }
  }

  endTurn() {
    if(this.gameOver) return;
    if(this.isAI()) return; // player can't end AI turn

    // In PvP: switch players after pass device
    if(this.mode === 'pvp') {
      this.state.activePlayer = this.state.activePlayer === 'p1' ? 'p2' : 'p1';
      if(this.state.activePlayer === 'p1') {
        this.turnNumber++;
        this.state.turn = this.turnNumber;
      }
      if(this.onPassDevice) {
        this.onPassDevice(this.state.activePlayer, () => {
          this.startTurn();
          this.emit();
        });
        return;
      }
      this.startTurn();
      this.emit();
      return;
    }
    // AI mode: hand over to the Rival
    if(this.mode === 'ai') {
      this.nextAITurn();
      return;
    }
    this.emit();
  }

  nextAITurn() {
    if(this.gameOver) return;
    this.state.activePlayer = 'p2';
    this.startTurn();
    this.runAITurn();
  }

  /* ---- Player actions (work for active player) ---- */
  recruitCompanion(cardIndex) {
    if(this.turnPhase !== 'main' || this.gameOver) return false;
    const p = this.active();
    const card = p.hand[cardIndex];
    if(!card || card.type !== 'companion') return false;
    if(this.recruitsThisTurn >= this.maxRecruitsPerTurn) return false;

    const goldAvail = this.getAvailableGold(p);
    if(goldAvail < card.cost) return false;

    p.hand.splice(cardIndex, 1);
    p.field.push(card);
    // Spend gold cards
    let goldToSpend = card.cost;
    for(let i = p.hand.length - 1; i >= 0 && goldToSpend > 0; i--) {
      if(p.hand[i].type === 'gold') { p.hand.splice(i, 1); goldToSpend--; }
    }
    this.recruitsThisTurn++;

    this.log(`${p.name} recruited ${card.name} (${card.power} power)`);
    // On-recruit abilities for physical v1.2
    if(card.id === 'c4' && p.deck.length > 0) {
      const drawn = p.deck.shift();
      p.hand.push(drawn);
      this.log(`${p.name}'s Dwarven Smith forges ahead - drew 1 card`);
    }
    if(card.id === 'c8') {
      const opp = this.inactive();
      if(opp.hand.length > 0) {
        const ri = Math.floor(Math.random() * opp.hand.length);
        const stolen = opp.hand.splice(ri, 1)[0];
        this.log(`${p.name}'s Shadow Thief strikes! ${opp.name} discards ${stolen.name}`);
      }
    }
    this.emit();
    return true;
  }

  purchaseArtifact(cardIndex) {
    if(this.turnPhase !== 'main' || this.gameOver) return false;
    const p = this.active();
    const card = p.hand[cardIndex];
    if(!card || card.type !== 'artifact') return false;

    const goldAvail = this.getAvailableGold(p);
    if(goldAvail < card.cost) return false;

    p.hand.splice(cardIndex, 1);
    p.artifacts.push(card);
    let goldToSpend = card.cost;
    for(let i = p.hand.length - 1; i >= 0 && goldToSpend > 0; i--) {
      if(p.hand[i].type === 'gold') { p.hand.splice(i, 1); goldToSpend--; }
    }

    this.log(`${p.name} acquired ${card.name}`);
    this.emit();
    return true;
  }

  completeQuest(questIndex) {
    if(this.turnPhase !== 'main' || this.gameOver) return false;
    const p = this.active();
    const quest = this.state.quests[questIndex];
    if(!quest) return false;
    if(!this.canCompleteQuest(p, quest)) return false;

    let vpGain = quest.vp;
    if(p.artifacts.some(a => a.effect === 'bonus_vp')) vpGain += 1;
    p.vp += vpGain;

    this.state.quests.splice(questIndex, 1);
    if(this.state.questPool.length > 0) {
      this.state.quests.push(this.state.questPool.shift());
    }

    this.log(`${p.name} completed "${quest.name}" for ${vpGain} VP! (${p.vp}/${this.state.winTarget})`);

    if(p.vp >= this.state.winTarget) {
      this.gameOver = true;
      this.log(`🏆 ${p.name} wins!`);
      this.emit();
      if(this.onGameEnd) this.onGameEnd(p.name);
      return true;
    }

    this.emit();
    return true;
  }

  discardCard(cardIndex) {
    if(this.turnPhase !== 'main' || this.gameOver) return false;
    const p = this.active();
    const card = p.hand.splice(cardIndex, 1)[0];
    if(card) this.log(`${p.name} discarded ${card.name}`);
    this.emit();
    return true;
  }

  /* ---- AI - smarter (A118) ---- */
  runAITurn() {
    if(this.gameOver) return;
    const ai = this.active();
    const opp = this.inactive();

    const tryCompleteQuest = () => {
      const completable = this.state.quests.map((q,i)=>({...q, idx:i})).filter(q=>this.canCompleteQuest(ai,q));
      if(!completable.length) return false;
      // Prioritize quests it can nearly complete + high VP, and react to opponent close to winning
      const oppClose = opp.vp >= 4;
      completable.sort((a,b)=>{
        // if opponent close, prioritize any win, then smallest req
        if(oppClose) return (b.vp - a.vp) || (a.req - b.req);
        // otherwise prioritize best VP per req, and quests nearly complete (low deficit already 0)
        const aVal = a.vp / Math.max(1,a.req);
        const bVal = b.vp / Math.max(1,b.req);
        return bVal - aVal;
      });
      const quest = completable[0];
      let vpGain = quest.vp;
      if(ai.artifacts.some(a => a.effect === 'bonus_vp')) vpGain += 1;
      ai.vp += vpGain;
      this.state.quests.splice(quest.idx, 1);
      if(this.state.questPool.length > 0) this.state.quests.push(this.state.questPool.shift());
      this.log(`${ai.name} completed "${quest.name}" for ${vpGain} VP! (${ai.vp}/${this.state.winTarget})`);
      return true;
    };

    // 1) If can win now, take it before recruiting
    if(tryCompleteQuest()){
      if(ai.vp >= this.state.winTarget){ this.gameOver=true; this.log(`💀 ${ai.name} claims the crown!`); this.emit(); if(this.onGameEnd) this.onGameEnd(ai.name); return; }
    }

    // 2) Evaluate companions - hold gold for bigger plays
    const companions = ai.hand.map((c,i) => ({...c, handIdx:i})).filter(c => c.type === 'companion');
    const artifacts = ai.hand.map((c,i) => ({...c, handIdx:i})).filter(c => c.type === 'artifact');
    let goldLeft = this.getAvailableGold(ai);
    const currentPower = this.getTotalPower(ai);
    // Find quest deficits to prioritize recruiting that closes gap
    const questDeficits = this.state.quests.map(q=>{
      const hasShield = ai.artifacts.some(a=>a.effect==='ignore_1_req');
      const req = hasShield ? Math.max(0,q.req-1) : q.req;
      return {q, deficit: Math.max(0, req - currentPower)};
    }).sort((a,b)=>a.deficit - b.deficit);
    const smallestDeficit = questDeficits[0]?.deficit ?? 99;
    const oppPower = this.getTotalPower(opp);

    // Score companions: power/cost + bonus if it closes deficit, + reactive bonus vs opponent
    const scoredCompanions = companions.map(c=>{
      let score = c.power / Math.max(1,c.cost);
      // prioritize quests it can nearly complete
      if(c.power >= smallestDeficit && smallestDeficit<=3) score += 1.5;
      else if(smallestDeficit<=2 && c.power>=2) score += 0.8;
      // react to opponent: if opponent stronger, prioritize bigger power
      if(oppPower > currentPower + 1) score += c.power * 0.15;
      // hold gold: penalize cheap 1-cost 1-power if gold scarce and better cards might come
      if(goldLeft <=2 && c.cost===1 && c.power===1) score -= 0.6;
      return {...c, score};
    }).sort((a,b)=>b.score - a.score);

    // Hold logic: if best score < 1.2 and goldLeft <=2, save gold for bigger play
    const bestScore = scoredCompanions[0]?.score ?? 0;
    const shouldHold = goldLeft <=2 && bestScore < 1.2 && smallestDeficit > 2 && opp.vp <4;
    const toRecruit = [];
    if(!shouldHold){
      for(const c of scoredCompanions){
        if(toRecruit.length >= this.maxRecruitsPerTurn) break;
        if(c.cost <= goldLeft){
          // also don't spend last gold if it would block a nearly-complete quest next turn
          if(goldLeft - c.cost ===0 && smallestDeficit===2 && c.power<2 && opp.vp<4){
            // save 1 gold
            continue;
          }
          toRecruit.push(c); goldLeft -= c.cost;
        }
      }
    } else {
      this.log(`${ai.name} holds gold for a bigger play`);
    }

    toRecruit.sort((a,b) => b.handIdx - a.handIdx);
    for(const c of toRecruit){
      const idx = ai.hand.findIndex(h => h.uid === c.uid);
      if(idx >= 0){
        ai.hand.splice(idx, 1);
        ai.field.push({ ...c });
        let goldToSpend = c.cost;
        for(let i = ai.hand.length - 1; i >= 0 && goldToSpend > 0; i--){
          if(ai.hand[i].type === 'gold'){ ai.hand.splice(i,1); goldToSpend--; }
        }
        this.recruitsThisTurn++;
        this.log(`${ai.name} recruited ${c.name}`);
      }
    }

    // 3) Try artifacts - reactive and gold-aware
    if(goldLeft >0 && artifacts.length){
      // Score artifacts
      const scoredArtifacts = artifacts.map(a=>{
        let score=0;
        if(a.effect==='allies_plus_1' && ai.field.length>=2) score=3;
        if(a.effect==='bonus_vp' && ai.vp >=3) score=2.5;
        if(a.effect==='ignore_1_req' && smallestDeficit===1) score=2.8;
        if(a.effect==='extra_recruit' && ai.hand.filter(c=>c.type==='companion').length>=2) score=2;
        if(a.effect==='draw_1') score=1.5;
        score -= a.cost * 0.3; // cheaper better
        return {...a, score};
      }).sort((a,b)=>b.score - a.score);
      const bestArt = scoredArtifacts[0];
      // Hold gold if opponent close to winning, don't waste on low-score artifact
      const oppClose = opp.vp >=4;
      if(bestArt && bestArt.score>1.0 && bestArt.cost <= goldLeft && !oppClose){
        const idx = ai.hand.findIndex(h=>h.uid===bestArt.uid);
        if(idx>=0){
          ai.hand.splice(idx,1);
          ai.artifacts.push(bestArt);
          let goldToSpend = bestArt.cost;
          for(let i=ai.hand.length-1;i>=0 && goldToSpend>0;i--){ if(ai.hand[i].type==='gold'){ ai.hand.splice(i,1); goldToSpend--; } }
          this.log(`${ai.name} acquired ${bestArt.name}`);
          goldLeft -= bestArt.cost;
        }
      }
    }

    // 4) Try to complete a quest after recruiting
    tryCompleteQuest();

    if(ai.vp >= this.state.winTarget){
      this.gameOver = true;
      this.log(`💀 ${ai.name} claims the crown!`);
      this.emit();
      if(this.onGameEnd) this.onGameEnd(ai.name);
      return;
    }

    this.emit();
    setTimeout(() => {
      this.state.activePlayer = 'p1';
      this.turnNumber++;
      this.state.turn = this.turnNumber;
      this.startTurn();
      this.emit();
    }, 700);
  }

  log(msg) {
    this.state.log.unshift(msg);
    if(this.state.log.length > 50) this.state.log.pop();
  }

  emit() {
    if(this.onStateChange) this.onStateChange(this.state);
  }
}

window.CallOfCardsGame = CallOfCardsGame;
window.CARD_DB = CARD_DB;
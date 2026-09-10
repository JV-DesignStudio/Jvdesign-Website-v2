/* ===== CALL OF THE CARDS - GAME ENGINE ===== */

const CARD_DB = {
  companions: [
    { id:'c1', name:'Wandering Rogue',     emoji:'🗡️', cost:1, power:1, type:'companion', text:'Cheap, scrappy, and always useful early.' },
    { id:'c2', name:'Captain of the Guard', emoji:'🧙', cost:2, power:3, type:'companion', text:'Loyal to the last and worth every coin.' },
    { id:'c3', name:'Elf Archer',           emoji:'🏹', cost:3, power:4, type:'companion', text:'Swift, precise, never misses a quest.' },
    { id:'c4', name:'Dwarven Smith',        emoji:'⚒️', cost:2, power:2, type:'companion', text:'Forges bonds as strong as steel.' },
    { id:'c5', name:'Forest Scout',         emoji:'🌿', cost:1, power:2, type:'companion', text:'Knows every hidden path through the woods.' },
    { id:'c6', name:'Siege Engineer',       emoji:'🏗️', cost:3, power:3, type:'companion', text:'Every fortress has a weakness.' },
    { id:'c7', name:'Healer',               emoji:'💚', cost:2, power:1, type:'companion', text:'Mends wounds and bolsters resolve. +1 Power to all allies.' },
    { id:'c8', name:'Shadow Thief',         emoji:'🦇', cost:1, power:2, type:'companion', text:'Strikes from the dark, always unseen.' },
  ],
  artifacts: [
    { id:'a1', name:'Ring of Courage',    emoji:'💍', cost:3, type:'artifact', text:'All Companions gain +1 Power.', effect:'allies_plus_1' },
    { id:'a2', name:'Shield of Ages',     emoji:'🛡️', cost:4, type:'artifact', text:'Ignore 1 Power requirement on quests.', effect:'ignore_1_req' },
    { id:'a3', name:'Sword of Dawn',      emoji:'⚔️', cost:5, type:'artifact', text:'Gain +1 bonus VP when completing any Quest.', effect:'bonus_vp' },
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
    { id:'q7',  name:'Assassin\'s Bounty',       emoji:'🗡️', vp:1, req:5,  text:'A high-value target moves under cover of night.' },
    { id:'q8',  name:'Troll Hunt',              emoji:'👹', vp:1, req:4,  text:'Ugly, smelly, and surprisingly tough.' },
    { id:'q9',  name:'Enchanted Forest Quest',  emoji:'🌲', vp:2, req:6,  text:'The forest tests all who enter.' },
    { id:'q10', name:'Final Coronation',        emoji:'🏆', vp:3, req:10, text:'The ultimate test. Claim the throne for good.' },
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
    p.field.forEach(c => { power += c.power + (hasRing ? 1 : 0); });
    return power;
  }

  canCompleteQuest(p, quest) {
    const hasShield = p.artifacts.some(a => a.effect === 'ignore_1_req');
    const req = hasShield ? Math.max(0, quest.req - 1) : quest.req;
    return this.getTotalPower(p) >= req;
  }

  /* ---- Turn management ---- */
  startTurn() {
    const p = this.active();
    this.turnPhase = 'main';
    this.recruitsThisTurn = 0;
    this.maxRecruitsPerTurn = p.artifacts.some(a => a.effect === 'extra_recruit') ? 2 : 1;

    // Draw 1 (2 with Amulet of Renewal)
    const drawCount = p.artifacts.some(a => a.effect === 'draw_1') ? 2 : 1;
    for(let i=0; i<drawCount; i++) {
      if(p.deck.length > 0) p.hand.push(p.deck.shift());
    }

    this.log(`${p.name}'s turn ${this.turnNumber}`);
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

  /* ---- AI ---- */
  runAITurn() {
    if(this.gameOver) return;
    const ai = this.active();

    // Recruit companions
    const companions = ai.hand.map((c,i) => ({...c, handIdx:i}))
      .filter(c => c.type === 'companion')
      .sort((a,b) => (b.power/b.cost) - (a.power/a.cost));

    let goldLeft = this.getAvailableGold(ai);
    const toRecruit = [];
    for(const c of companions) {
      if(toRecruit.length >= this.maxRecruitsPerTurn) break;
      if(c.cost <= goldLeft) { toRecruit.push(c); goldLeft -= c.cost; }
    }

    toRecruit.sort((a,b) => b.handIdx - a.handIdx);
    for(const c of toRecruit) {
      const idx = ai.hand.findIndex(h => h.uid === c.uid);
      if(idx >= 0) {
        ai.hand.splice(idx, 1);
        ai.field.push(c);
        let goldToSpend = c.cost;
        for(let i = ai.hand.length - 1; i >= 0 && goldToSpend > 0; i--) {
          if(ai.hand[i].type === 'gold') { ai.hand.splice(i, 1); goldToSpend--; }
        }
        this.recruitsThisTurn++;
        this.log(`${ai.name} recruited ${c.name}`);
      }
    }

    // Try to complete a quest
    for(let qi = 0; qi < this.state.quests.length; qi++) {
      const quest = this.state.quests[qi];
      if(this.canCompleteQuest(ai, quest)) {
        let vpGain = quest.vp;
        if(ai.artifacts.some(a => a.effect === 'bonus_vp')) vpGain += 1;
        ai.vp += vpGain;
        this.state.quests.splice(qi, 1);
        if(this.state.questPool.length > 0) {
          this.state.quests.push(this.state.questPool.shift());
        }
        this.log(`${ai.name} completed "${quest.name}" for ${vpGain} VP! (${ai.vp}/${this.state.winTarget})`);
        break;
      }
    }

    if(ai.vp >= this.state.winTarget) {
      this.gameOver = true;
      this.log(`💀 ${ai.name} claims the crown!`);
      this.emit();
      if(this.onGameEnd) this.onGameEnd(ai.name);
      return;
    }

    this.emit();
    // Back to player
    setTimeout(() => {
      this.state.activePlayer = 'p1';
      this.turnNumber++;
      this.state.turn = this.turnNumber;
      this.startTurn();
      this.emit();
    }, 600);
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
/* ===== CALL OF THE CARDS - GAME ENGINE (v2 alpha) =====
 *
 * One fortress, one crown. Both rivals build a party, spend Gold each turn
 * and try to hold 8 Power to storm the Fortress. Companions add Power,
 * Tricks disrupt the other side, Artifacts bend the rules.
 *
 * The public shape (CallOfCardsGame, CARD_DB, state.p1/p2) is kept stable so
 * the page's save/story hooks and tests keep working.
 */

const CARD_DB = {
  companions: [
    { id:'squire',    name:'Squire',           emoji:'🛡️', cost:1, power:1, type:'companion', text:'Cheap and cheerful. Every party needs one.' },
    { id:'rogue',     name:'Wandering Rogue',  emoji:'🗡️', cost:1, power:2, type:'companion', text:'Quick feet, quicker blade.' },
    { id:'scout',     name:'Forest Scout',     emoji:'🌿', cost:2, power:2, type:'companion', text:'When recruited, draw 1 card.', effect:'draw1' },
    { id:'smith',     name:'Dwarven Smith',    emoji:'⚒️', cost:2, power:2, type:'companion', text:'When recruited, draw 1 card.', effect:'draw1' },
    { id:'archer',    name:'Elf Archer',       emoji:'🏹', cost:2, power:3, type:'companion', text:'Swift, precise, never misses.' },
    { id:'healer',    name:'Healer',           emoji:'💚', cost:2, power:2, type:'companion', text:'All allies gain +1 Power while the Healer is in play.' },
    { id:'captain',   name:'Captain of the Guard', emoji:'🧙', cost:3, power:4, type:'companion', text:'Loyal to the last and worth every coin.' },
    { id:'engineer',  name:'Siege Engineer',   emoji:'🏗️', cost:3, power:4, type:'companion', text:'Every fortress has a weakness.' },
    { id:'thief',     name:'Shadow Thief',     emoji:'🦇', cost:2, power:2, type:'companion', text:'When recruited, the Rival discards 1 card.', effect:'rival_discard' },
    { id:'knight',    name:'Dragon Knight',    emoji:'🐲', cost:4, power:5, type:'companion', text:'The biggest hitter in the deck.' }
  ],
  tricks: [
    { id:'ambush',    name:'Ambush',        emoji:'🗡️', cost:1, type:'trick', effect:'damage2',      text:'Deal 2 damage to the Rival\'s strongest companion. If they have none, draw 1 card.' },
    { id:'rally',     name:'Rally',         emoji:'📯', cost:1, type:'trick', effect:'rally2',       text:'Your party gains +2 Power this turn.' },
    { id:'reinforce', name:'Reinforce',     emoji:'⚔️', cost:1, type:'trick', effect:'reinforce2',   text:'Give your strongest companion +2 Power for good.' },
    { id:'scout',     name:'Scout Ahead',   emoji:'🧭', cost:1, type:'trick', effect:'draw2',        text:'Draw 2 cards.' },
    { id:'fortify',   name:'Fortify',       emoji:'🏰', cost:2, type:'trick', effect:'fortify3',     text:'Your party gains +3 Power this turn.' },
    { id:'bribe',     name:'Bribe',         emoji:'💰', cost:2, type:'trick', effect:'rival_discard',text:'The Rival discards 1 random card.' },
    { id:'sweep',     name:'Sneak Attack',  emoji:'🥷', cost:2, type:'trick', effect:'damage_all1',  text:'Deal 1 damage to every Rival companion.' },
    { id:'fireball',  name:'Fireball',      emoji:'🔥', cost:3, type:'trick', effect:'damage3',      text:'Deal 3 damage to the Rival\'s strongest companion.' }
  ],
  artifacts: [
    { id:'ring',   name:'Ring of Courage',   emoji:'💍', cost:3, type:'artifact', effect:'allies_plus_1', text:'All your companions gain +1 Power while this is in play.' },
    { id:'shield', name:'Shield of Ages',    emoji:'🛡️', cost:3, type:'artifact', effect:'storm_minus_1', text:'The Fortress needs 1 less Power to storm.' },
    { id:'sword',  name:'Sword of Dawn',     emoji:'⚔️', cost:3, type:'artifact', effect:'storm_plus_2',  text:'Your party gains +2 Power while this is in play.' },
    { id:'amulet', name:'Amulet of Renewal', emoji:'🔮', cost:2, type:'artifact', effect:'draw_1',        text:'Draw 1 extra card at the start of each turn.' },
    { id:'boots',  name:'Boots of Haste',    emoji:'👢', cost:2, type:'artifact', effect:'gold_1',        text:'Gain 1 extra Gold at the start of each turn.' },
    { id:'crown',  name:'Crown of Whispers', emoji:'👑', cost:2, type:'artifact', effect:'draw_on_play_2',text:'When acquired, draw 2 cards.' }
  ]
};

const STORM_POWER = 8;
const GOLD_PER_TURN = 3;
const MAX_HAND = 8;

function cocShuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class CallOfCardsGame {
  constructor(mode) {
    this.mode = mode || 'ai'; // 'ai' or 'pvp'
    this.state = null;
    this.turnPhase = 'main';
    this.turnNumber = 0;
    this.gameOver = false;
    this.onStateChange = null;
    this.onGameEnd = null;
    this.onPassDevice = null;
    this.cycledThisTurn = false;
    this._recruitsThisTurn = 0;
    this._aiActing = false;
  }

  /* ---- setup ---- */
  buildDeck() {
    const deck = [];
    CARD_DB.companions.forEach(c => {
      for (let i = 0; i < 3; i++) deck.push({ ...c, uid: c.id + '_' + i + '_' + Math.random().toString(36).slice(2, 7) });
    });
    CARD_DB.tricks.forEach(t => {
      for (let i = 0; i < 2; i++) deck.push({ ...t, uid: t.id + '_t' + i + '_' + Math.random().toString(36).slice(2, 7) });
    });
    CARD_DB.artifacts.forEach(a => {
      deck.push({ ...a, uid: a.id + '_a_' + Math.random().toString(36).slice(2, 7) });
    });
    return cocShuffle(deck);
  }

  makePlayer(name) {
    const deck = this.buildDeck();
    return {
      name,
      hand: deck.splice(0, name === 'You' ? 5 : 6),
      field: [],
      artifacts: [],
      discard: [],
      completed: [],
      gold: 0,
      tempPower: 0,
      vp: 0,
      stormed: false,
      stormReady: false,
      deck
    };
  }

  initGame() {
    const p1 = this.makePlayer('You');
    const p2 = this.makePlayer(this.mode === 'ai' ? 'Rival' : 'Player 2');

    this.state = {
      p1,
      p2,
      quests: [{ id: 'fortress', name: 'Storm the Fortress', emoji: '🏰', req: STORM_POWER, vp: 1 }],
      turn: 1,
      activePlayer: 'p1',
      log: [],
      winTarget: 1,
      stormPower: STORM_POWER
    };

    this.turnNumber = 1;
    this.gameOver = false;
    this.log('Both rivals take their seats. Hold ' + STORM_POWER + ' Power when your turn begins, then storm the Fortress.');
    this.startTurn();
    this.emit();
  }

  /* ---- helpers ---- */
  active() { return this.state[this.state.activePlayer]; }
  inactive() { return this.state[this.state.activePlayer === 'p1' ? 'p2' : 'p1']; }
  isAI() { return this.mode === 'ai' && this.state.activePlayer === 'p2'; }
  getAvailableGold(p) { return p.gold; }

  /* Compatibility shims for the older playtest page. */
  get recruitsThisTurn() { return this._recruitsThisTurn || 0; }
  get maxRecruitsPerTurn() { return 2; }
  get discardedThisTurn() { return this.cycledThisTurn; }
  recruitCompanion(index) { return this.playCard(index); }
  purchaseArtifact(index) { return this.playCard(index); }
  discardCard(index) { return this.cycleCard(index); }
  canCompleteQuest(p, quest) {
    return this.getTotalPower(p) >= (quest && quest.req ? quest.req : this.stormReq(p));
  }
  completeQuest() {
    const p = this.active();
    if (this.getTotalPower(p) >= this.stormReq(p)) p.stormReady = true;
    return this.storm();
  }

  stormReq(p) {
    const shield = p && p.artifacts.some(a => a.effect === 'storm_minus_1');
    return Math.max(4, STORM_POWER - (shield ? 1 : 0));
  }

  getTotalPower(p) {
    if (!p) return 0;
    const ring = p.artifacts.some(a => a.effect === 'allies_plus_1') ? 1 : 0;
    const healers = p.field.filter(c => c.id === 'healer').length;
    const sword = p.artifacts.some(a => a.effect === 'storm_plus_2') ? 2 : 0;
    let power = sword + (p.tempPower || 0);
    p.field.forEach(c => { power += Math.max(0, c.power) + ring + healers; });
    return power;
  }

  canStorm(p) {
    p = p || this.active();
    return !this.gameOver && !p.stormed && p.stormReady && this.getTotalPower(p) >= this.stormReq(p);
  }

  drawCard(p) {
    if (p.hand.length >= MAX_HAND) return;
    if (!p.deck.length && p.discard.length) {
      p.deck = cocShuffle(p.discard.splice(0));
      this.log(p.name + ' shuffled their discard into a fresh deck.');
    }
    if (p.deck.length) p.hand.push(p.deck.shift());
  }

  discardRandom(p) {
    if (!p || !p.hand.length) return null;
    const i = Math.floor(Math.random() * p.hand.length);
    const card = p.hand.splice(i, 1)[0];
    p.discard.push(card);
    return card;
  }

  /* ---- turn flow ---- */
  startTurn() {
    const p = this.active();
    this.turnPhase = 'main';
    this.cycledThisTurn = false;
    this._recruitsThisTurn = 0;
    p.tempPower = 0;

    let gold = GOLD_PER_TURN;
    if (p.artifacts.some(a => a.effect === 'gold_1')) gold += 1;
    // The player who moves second gets the first-move bonus (one card and one Gold).
    if (this.state.turn === 1 && p === this.state.p2) {
      gold += 1;
      this.drawCard(p);
      this.log('The second player takes the first-move bonus: +1 Gold and a card.');
    }
    p.gold += gold;

    let draws = 1;
    if (p.artifacts.some(a => a.effect === 'draw_1')) draws += 1;
    const oppPower = this.getTotalPower(this.inactive());
    if (oppPower - this.getTotalPower(p) >= 3) {
      draws += 1;
      this.log(`${p.name} fell behind, so Underdog's Resolve drew an extra card.`);
    }
    for (let i = 0; i < draws; i++) this.drawCard(p);

    p.stormReady = !p.stormed && this.getTotalPower(p) >= this.stormReq(p);
    if (p.stormReady) this.log(`${p.name} held the Fortress power. Storm it now!`);

    this.log(`Turn ${this.state.turn}: ${p.name} gained ${gold} Gold and drew ${draws} card${draws === 1 ? '' : 's'}.`);
  }

  endTurn() {
    if (this.gameOver) return;
    if (this.isAI()) return;

    if (this.mode === 'pvp') {
      this.state.activePlayer = this.state.activePlayer === 'p1' ? 'p2' : 'p1';
      if (this.state.activePlayer === 'p1') {
        this.turnNumber++;
        this.state.turn = this.turnNumber;
      }
      const next = this.state.activePlayer;
      if (this.onPassDevice) {
        this.onPassDevice(next, () => { this.startTurn(); this.emit(); });
        return;
      }
      this.startTurn();
      this.emit();
      return;
    }

    this.state.activePlayer = 'p2';
    this.turnPhase = 'ai';
    this.log('The Rival studies the board...');
    this.emit();
    setTimeout(() => {
      if (this.gameOver) return;
      this.startTurn();
      this.emit();
      this._aiActing = true;
      this._aiStep(0);
    }, 550);
  }

  /* ---- player actions ---- */
  playCard(index, fromAI) {
    if (this.gameOver || this.turnPhase !== 'main') return false;
    if (!fromAI && this.mode === 'ai' && this.state.activePlayer !== 'p1') return false;
    const p = this.active();
    const card = p.hand[index];
    if (!card) return false;
    if (card.cost > p.gold) return false;

    p.hand.splice(index, 1);
    p.gold -= card.cost;

    if (card.type === 'companion') {
      const played = { ...card, basePower: card.power };
      p.field.push(played);
      this._recruitsThisTurn = (this._recruitsThisTurn || 0) + 1;
      this.log(`${p.name} recruited ${card.name} (${card.power} Power).`);
      if (card.effect === 'draw1') {
        this.drawCard(p);
        this.log(`${card.name} drew 1 card.`);
      }
      if (card.effect === 'rival_discard') {
        const lost = this.discardRandom(this.inactive());
        if (lost) this.log(`${card.name} struck! ${this.inactive().name} discarded ${lost.name}.`);
      }
    } else if (card.type === 'artifact') {
      p.artifacts.push(card);
      this.log(`${p.name} claimed ${card.name}.`);
      if (card.effect === 'draw_on_play_2') {
        this.drawCard(p); this.drawCard(p);
        this.log(`${card.name} revealed 2 cards.`);
      }
    } else if (card.type === 'trick') {
      p.discard.push(card);
      this._applyTrick(card, p, this.inactive());
    } else {
      p.discard.push(card);
    }

    this.emit();
    return true;
  }

  _applyTrick(card, caster, target) {
    const log = (m) => this.log(m);
    switch (card.effect) {
      case 'damage2': {
        const victim = target.field.slice().sort((a, b) => b.power - a.power)[0];
        if (victim) { this._damage(target, victim, 2); log(`${caster.name} played Ambush for 2 damage on ${victim.name}.`); }
        else { this.drawCard(caster); log(`${caster.name} played Ambush, but there was no target, so drew 1.`); }
        break;
      }
      case 'damage3': {
        const victim = target.field.slice().sort((a, b) => b.power - a.power)[0];
        if (victim) { this._damage(target, victim, 3); log(`${caster.name} hurled a Fireball at ${victim.name} for 3 damage.`); }
        else { log(`${caster.name} cast Fireball at an empty field.`); }
        break;
      }
      case 'damage_all1': {
        if (!target.field.length) { log(`${caster.name} found no one to ambush.`); break; }
        target.field.slice().forEach(c => this._damage(target, c, 1, true));
        log(`${caster.name} launched a Sneak Attack on the whole Rival party.`);
        break;
      }
      case 'draw2':
        this.drawCard(caster); this.drawCard(caster);
        log(`${caster.name} scouted ahead and drew 2 cards.`);
        break;
      case 'rival_discard': {
        const lost = this.discardRandom(target);
        log(lost ? `${caster.name} bribed a contact: ${target.name} discarded ${lost.name}.` : `${caster.name} found no one to bribe.`);
        break;
      }
      case 'rally2':
        caster.tempPower += 2;
        log(`${caster.name} sounded the Rally: +2 Power this turn.`);
        break;
      case 'fortify3':
        caster.tempPower += 3;
        log(`${caster.name} fortified the camp: +3 Power this turn.`);
        break;
      case 'reinforce2': {
        const ally = caster.field.slice().sort((a, b) => b.power - a.power)[0];
        if (ally) { ally.power += 2; log(`${caster.name} reinforced ${ally.name} (+2 Power).`); }
        else log(`${caster.name} had no one to reinforce.`);
        break;
      }
      default:
        break;
    }
  }

  _damage(owner, companion, amount, quiet) {
    if (!companion) return;
    companion.power -= amount;
    if (companion.power <= 0) {
      const i = owner.field.indexOf(companion);
      if (i >= 0) owner.field.splice(i, 1);
      owner.discard.push({ ...companion, power: companion.basePower || companion.power });
      if (!quiet) this.log(`${companion.name} was defeated and left the field.`);
      else this.log(`${companion.name} fell in the sneak attack.`);
    }
  }

  cycleCard(index) {
    if (this.gameOver || this.turnPhase !== 'main' || this.cycledThisTurn) return false;
    if (this.mode === 'ai' && this.state.activePlayer !== 'p1') return false;
    const p = this.active();
    const card = p.hand.splice(index, 1)[0];
    if (!card) return false;
    p.discard.push(card);
    this.drawCard(p);
    this.cycledThisTurn = true;
    this.log(`${p.name} cycled ${card.name} and drew a replacement.`);
    this.emit();
    return true;
  }

  storm() {
    if (!this.canStorm()) return false;
    const p = this.active();
    p.vp = this.state.winTarget;
    p.stormed = true;
    this.gameOver = true;
    this.log(`🏆 ${p.name} stormed the Fortress with ${this.getTotalPower(p)} Power and took the crown!`);
    this.emit();
    if (this.onGameEnd) this.onGameEnd(p.name);
    return true;
  }

  peekTopCard() { return null; }

  /* ---- rival AI ---- */
  _aiStep(depth) {
    if (this.gameOver) { this._aiActing = false; return; }
    if (depth > 14) return this._finishAITurn();
    const ai = this.active();
    const opp = this.inactive();

    if (this.canStorm(ai)) { this.storm(); this._aiActing = false; return; }

    const choice = this._aiChoose(ai, opp);
    if (!choice) return this._finishAITurn();

    const card = ai.hand[choice.index];
    this.playCard(choice.index, true);
    if (this.gameOver) { this._aiActing = false; return; }
    this._aiTurnTimer = setTimeout(() => this._aiStep(depth + 1), 380);
    return;
  }

  _aiChoose(ai, opp) {
    let best = null;
    const oppPower = this.getTotalPower(opp);
    const myPower = this.getTotalPower(ai);
    const need = this.stormReq(ai);

    ai.hand.forEach((card, index) => {
      if (card.cost > ai.gold) return;
      let score = 0;
      if (card.type === 'companion') {
        score = (card.power || 0) / Math.max(1, card.cost) * 1.4;
        if (myPower + (card.power || 0) >= need) score += 3;
        if (card.effect === 'draw1') score += 1.2;
        if (card.effect === 'rival_discard') score += 1.1;
      } else if (card.type === 'trick') {
        if (card.effect === 'rally2' || card.effect === 'fortify3') {
          const boost = card.effect === 'rally2' ? 2 : 3;
          score = myPower + boost >= need ? 3.2 : 0.9;
        } else if (card.effect === 'draw2') {
          score = ai.hand.length <= 5 ? 2.4 : 1.1;
        } else if (card.effect === 'reinforce2') {
          score = ai.field.length ? 2.0 : 0.3;
        } else if (card.effect === 'damage3' || card.effect === 'damage2' || card.effect === 'damage_all1') {
          score = opp.field.length ? (oppPower >= 4 ? 2.6 : 1.8) : 0.4;
        } else if (card.effect === 'rival_discard') {
          score = opp.hand.length >= 3 ? 1.9 : 0.8;
        }
      } else if (card.type === 'artifact') {
        if (card.effect === 'allies_plus_1') score = ai.field.length >= 2 ? 2.8 : 1.4;
        else if (card.effect === 'storm_plus_2') score = myPower >= 3 ? 2.6 : 1.6;
        else if (card.effect === 'storm_minus_1') score = myPower >= 4 ? 2.4 : 1.5;
        else if (card.effect === 'draw_1') score = 2.0;
        else if (card.effect === 'gold_1') score = 1.7;
        else if (card.effect === 'draw_on_play_2') score = 1.8;
      }
      // Keep a little gold for a storm-turn trick if it is close.
      if (card.cost >= ai.gold && myPower < need && myPower >= need - 2) score -= 0.6;
      score -= card.cost * 0.15;
      if (!best || score > best.score) best = { index, score };
    });

    if (best && best.score > 0.8) return best;
    return null;
  }

  _finishAITurn() {
    if (this.gameOver) return;
    this.state.activePlayer = 'p1';
    this.turnNumber++;
    this.state.turn = this.turnNumber;
    this.startTurn();
    this.emit();
  }

  log(msg) {
    if (!this.state) return;
    this.state.log.unshift(msg);
    if (this.state.log.length > 40) this.state.log.pop();
  }

  emit() {
    if (this.onStateChange) this.onStateChange(this.state);
  }
}

window.CallOfCardsGame = CallOfCardsGame;
window.CARD_DB = CARD_DB;
window.COC_STORM_POWER = STORM_POWER;

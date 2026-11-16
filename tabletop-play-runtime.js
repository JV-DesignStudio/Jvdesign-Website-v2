/* Tabletop Studio play runtime (A3000). Used by the playable HTML export. */
window.TT_PLAY_RUNTIME = String.raw`(function () {
  var D = GAME;
  var T = TERRAIN;
  var cv = document.getElementById('b');
  var ctx = cv.getContext('2d');
  var CELL = Math.max(32, Math.min(64, Math.floor(760 / Math.max(D.cols, D.rows))));
  cv.width = D.cols * CELL;
  cv.height = D.rows * CELL;
  var settings = D.settings || {};
  var players = (D.players || []).slice();
  var allTokens = (D.tokens || []).slice();
  var skipNext = {};
  var tokens = allTokens.filter(function (t) { return t.pawn; }).map(function (t) {
    return {
      player: t.player,
      pawnIndex: t.pawnIndex || 1,
      pathIndex: t.pathIndex || 0,
      started: !!t.started,
      finished: false,
      inLane: false,
      laneIndex: 0
    };
  });
  var dieSides = D.dieSides || 6;
  var turn = 1;
  var winner = 0;
  var lastRoll = 0;
  var pendingBuy = null;
  var pendingChoice = null;
  var decks = (D.decks || []).map(function (deck) {
    return {
      id: deck.id,
      name: deck.name,
      customCards: (deck.customCards || []).slice(),
      deck: (deck.deck || []).slice(),
      standard: deck.deckStandard !== false
    };
  });
  if (!decks.length) {
    decks.push({ id: 'main', name: 'Main deck', customCards: (D.customCards || []).slice(), deck: [], standard: true });
  }
  var deckByName = {};
  decks.forEach(function (deck) { deckByName[deck.name] = deck; });
  var RANKS = ['Ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King'];
  var SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];

  function $(id) { return document.getElementById(id); }
  function log(text) {
    var line = document.createElement('p');
    line.textContent = text;
    var box = $('log');
    box.appendChild(line);
    while (box.children.length > 14) box.removeChild(box.firstChild);
  }
  function centre(c, r) { return { x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }; }
  function pathCell(i) { return (D.path || [])[i] || null; }
  function pathIndexOf(c, r) {
    for (var i = 0; i < (D.path || []).length; i++) {
      if (D.path[i].c === c && D.path[i].r === r) return i;
    }
    return -1;
  }
  function metaForCell(cell) { return cell ? (D.meta || [])[cell.r * D.cols + cell.c] : null; }
  function metaAt(col, row) { return (D.meta || [])[row * D.cols + col] || null; }
  function safeCell(cell) {
    return (D.safeCells || []).some(function (safe) { return safe.c === cell.c && safe.r === cell.r; });
  }
  function toks(player) {
    return tokens.filter(function (t) { return t.player === player; });
  }
  function activeToks() {
    return toks(turn).filter(function (t) { return !t.finished; });
  }
  function playerName(player) {
    var info = players[player - 1];
    return info && info.name ? info.name : 'Player ' + player;
  }
  function tokPos(token) {
    if (token.inLane) {
      var lane = (D.homeLanes || [])[token.player - 1] || [];
      var laneCell = lane[Math.min(token.laneIndex, lane.length - 1)];
      if (laneCell) return centre(laneCell.c, laneCell.r);
    }
    var cell = pathCell(token.pathIndex) || (D.path || [])[0];
    return cell ? centre(cell.c, cell.r) : { x: 0, y: 0 };
  }
  function draw() {
    ctx.fillStyle = D.bgColor || '#f0ead6';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (var r = 0; r < D.rows; r++) {
      for (var c = 0; c < D.cols; c++) {
        var key = D.tiles[r * D.cols + c];
        if (!key || !T[key]) continue;
        var point = centre(c, r);
        ctx.fillStyle = T[key].color;
        ctx.fillRect(point.x - CELL / 2 + 2, point.y - CELL / 2 + 2, CELL - 4, CELL - 4);
      }
    }
    ctx.strokeStyle = 'rgba(40,35,30,.18)';
    ctx.lineWidth = 1;
    for (var c2 = 0; c2 <= D.cols; c2++) {
      ctx.beginPath(); ctx.moveTo(c2 * CELL, 0); ctx.lineTo(c2 * CELL, cv.height); ctx.stroke();
    }
    for (var r2 = 0; r2 <= D.rows; r2++) {
      ctx.beginPath(); ctx.moveTo(0, r2 * CELL); ctx.lineTo(cv.width, r2 * CELL); ctx.stroke();
    }
    if ((D.path || []).length > 1) {
      ctx.strokeStyle = 'rgba(40,35,30,.35)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      D.path.forEach(function (cell, index) {
        var point = centre(cell.c, cell.r);
        if (index) ctx.lineTo(point.x, point.y); else ctx.moveTo(point.x, point.y);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }
    (D.meta || []).forEach(function (meta, index) {
      if (!meta) return;
      var c = index % D.cols;
      var r = Math.floor(index / D.cols);
      var point = centre(c, r);
      if (meta.n) {
        ctx.fillStyle = 'rgba(20,15,10,.82)';
        ctx.fillRect(point.x - CELL / 2 + 4, point.y + CELL / 2 - 18, 18, 14);
        ctx.fillStyle = '#fff';
        ctx.font = '700 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(String(meta.n), point.x - CELL / 2 + 13, point.y + CELL / 2 - 7);
      }
      if (meta.label) {
        ctx.fillStyle = 'rgba(20,15,10,.75)';
        ctx.font = '600 9px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(String(meta.label).slice(0, 14), point.x - CELL / 2 + 4, point.y + CELL / 2 - 22);
      }
      if (meta.owner) {
        var owner = (players[meta.owner - 1] || {}).color || '#403B33';
        ctx.fillStyle = owner;
        ctx.fillRect(point.x + CELL / 2 - 14, point.y - CELL / 2 + 4, 10, 10);
      }
    });
    tokens.forEach(function (token) {
      if (token.finished) return;
      var point = tokPos(token);
      var color = (players[token.player - 1] || {}).color || '#BC4749';
      ctx.beginPath();
      ctx.arc(point.x, point.y, CELL * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (token.inLane) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, CELL * 0.31, 0, Math.PI * 2);
        ctx.strokeStyle = '#403B33';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
    allTokens.forEach(function (token) {
      if (token.pawn) return;
      var x = Number(token.x) * (CELL / 80);
      var y = Number(token.y) * (CELL / 80);
      if (!isFinite(x) || !isFinite(y)) return;
      if (token.type === 'card') {
        ctx.fillStyle = token.color || '#fffdf8';
        ctx.strokeStyle = '#403B33';
        ctx.lineWidth = 1;
        ctx.fillRect(x - CELL * 0.18, y - CELL * 0.24, CELL * 0.36, CELL * 0.48);
        ctx.strokeRect(x - CELL * 0.18, y - CELL * 0.24, CELL * 0.36, CELL * 0.48);
        ctx.fillStyle = '#1a1208';
        ctx.font = '700 ' + Math.max(9, Math.round(CELL * 0.2)) + 'px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(token.glyph || '?').slice(0, 1), x, y);
        return;
      }
      if (token.img) {
        var cache = window.__TT_IMAGES || (window.__TT_IMAGES = {});
        var img = cache[token.img];
        if (!img) {
          img = new Image();
          img.onload = function () { draw(); };
          img.src = token.img;
          cache[token.img] = img;
        }
        if (img.complete && img.naturalWidth) {
          ctx.drawImage(img, x - CELL * 0.22, y - CELL * 0.22, CELL * 0.44, CELL * 0.44);
          return;
        }
      }
      ctx.beginPath();
      ctx.arc(x, y, CELL * 0.22, 0, Math.PI * 2);
      ctx.fillStyle = token.color || '#70A3A7';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#1a1208';
      ctx.font = '700 ' + Math.max(9, Math.round(CELL * 0.22)) + 'px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(token.glyph || '?').slice(0, 1), x, y);
    });
  }
  function moneyText() {
    return players.map(function (player, index) {
      return (player.name || 'P' + (index + 1)) + ' \u00a3' + (Number(player.money) || 0);
    }).join(' \u00b7 ');
  }
  function render() {
    $('turn').textContent = playerName(turn);
    $('money').textContent = moneyText();
    var picker = $('pawn');
    var list = activeToks();
    var previous = picker.value;
    picker.innerHTML = '';
    list.forEach(function (token, index) {
      var option = document.createElement('option');
      option.value = String(index);
      option.textContent = 'Pawn ' + (token.pawnIndex || 1);
      picker.appendChild(option);
    });
    if (previous !== '' && Number(previous) < list.length) picker.value = previous;
    picker.style.display = list.length > 1 ? 'inline-block' : 'none';
    var declare = $('declare');
    declare.innerHTML = '';
    if (settings.winMode === 'manual' || settings.winMode === 'mostMoney') {
      players.forEach(function (player, index) {
        var button = document.createElement('button');
        button.className = 'secondary';
        button.textContent = (player.name || 'P' + (index + 1)) + ' wins';
        button.onclick = function () { showWinner(index + 1); };
        declare.appendChild(button);
      });
    }
    draw();
  }
  function showWinner(player) {
    winner = player;
    log(playerName(player) + ' wins!');
    $('result').textContent = playerName(player) + ' wins! Press New game to play again.';
    render();
  }
  function money(player) {
    return Number(players[player - 1] && players[player - 1].money) || 0;
  }
  function addMoney(player, amount) {
    if (!players[player - 1]) return;
    players[player - 1].money = (Number(players[player - 1].money) || 0) + amount;
    log(playerName(player) + (amount >= 0 ? ' gains \u00a3' : ' pays \u00a3') + Math.abs(amount) + '.');
  }
  function payRent(token, meta) {
    if (!meta.owner || meta.owner === token.player) return;
    var rent = Number(meta.rent) || (settings.rent ? 25 : 0);
    if (!rent) return;
    var payer = money(token.player);
    var paid = Math.min(payer, rent);
    addMoney(token.player, -paid);
    addMoney(meta.owner, paid);
  }
  function applyCapture(token) {
    if (!settings.capture) return;
    var cell = pathCell(token.pathIndex);
    if (!cell || safeCell(cell)) return;
    tokens.forEach(function (other) {
      if (other === token || other.player === token.player || other.finished || other.inLane) return;
      var otherCell = pathCell(other.pathIndex);
      if (otherCell && otherCell.c === cell.c && otherCell.r === cell.r) {
        other.pathIndex = 0;
        log(playerName(token.player) + ' sends ' + playerName(other.player) + ' home.');
      }
    });
  }
  function drawFromDeck(deckName) {
    var deck = deckByName[deckName] || decks[0];
    if (!deck) return null;
    if (!deck.deck.length) {
      deck.deck = deck.customCards.map(function (card) { return { c: card.id }; });
      if (deck.standard) {
        for (var suit = 0; suit < 4; suit++) {
          for (var rank = 0; rank < 13; rank++) deck.deck.push({ r: rank, s: suit });
        }
      }
    }
    if (!deck.deck.length) return null;
    var ref = deck.deck.shift();
    if (ref.c) {
      var custom = deck.customCards.find(function (card) { return card.id === ref.c; });
      if (custom) return custom;
      return null;
    }
    return {
      name: RANKS[ref.r] + ' of ' + SUITS[ref.s],
      text: 'A standard playing card.',
      effect: null
    };
  }
  function applyCardEffect(token, card) {
    var again = false;
    log('Card: ' + (card.name || 'Card') + (card.text ? '. ' + card.text : ''));
    var effect = card.effect;
    if (!effect) return again;
    var value = Number(effect.value) || 0;
    if (effect.type === 'money') addMoney(token.player, value);
    else if (effect.type === 'forward') moveSteps(token, value);
    else if (effect.type === 'back') moveSteps(token, -value);
    else if (effect.type === 'toStart') token.pathIndex = 0;
    else if (effect.type === 'goTo') {
      var target = pathIndexOfFromNumber(value);
      if (target >= 0) token.pathIndex = target;
    }
    else if (effect.type === 'again') again = true;
    else if (effect.type === 'collect') {
      var collect = Math.abs(Number(effect.value) || 0);
      players.forEach(function (other, otherIndex) {
        var otherPlayer = otherIndex + 1;
        if (otherPlayer === token.player) return;
        var amount = Math.min(money(otherPlayer), collect);
        addMoney(otherPlayer, -amount);
        addMoney(token.player, amount);
      });
    }
    else if (effect.type === 'card') {
      var extra = drawFromDeck(effect.deck || (decks[0] && decks[0].name));
      if (extra) again = applyCardEffect(token, extra) || again;
    }
    else if (effect.type === 'skip') { skipNext[token.player] = true; log(playerName(token.player) + ' misses the next turn.'); }
    else if (effect.type === 'swap') {
      var rival = tokens.find(function (other) { return other.player !== token.player && !other.finished && !other.inLane; });
      if (rival) { var swapIndex = token.pathIndex; token.pathIndex = rival.pathIndex; rival.pathIndex = swapIndex; }
    }
    else if (effect.type === 'nearest') {
      var nearest = null; var nearestDistance = Infinity;
      (D.links || []).forEach(function (link) {
        var from = pathIndexOf(link.from.c, link.from.r);
        if (from < 0) return;
        var distance = Math.abs(from - token.pathIndex);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = link; }
      });
      if (nearest) { var nearestIndex = pathIndexOf(nearest.to.c, nearest.to.r); if (nearestIndex >= 0) token.pathIndex = nearestIndex; }
    }
    return again;
  }
  function pathIndexOfFromNumber(number) {
    for (var i = 0; i < (D.meta || []).length; i++) {
      if (D.meta[i] && Number(D.meta[i].n) === Number(number)) {
        return pathIndexOf(i % D.cols, Math.floor(i / D.cols));
      }
    }
    return -1;
  }
  function applyTile(token, done) {
    var cell = pathCell(token.pathIndex);
    var meta = metaForCell(cell);
    if (!meta) return done(false);
    payRent(token, meta);
    if (meta.price && !meta.owner && money(token.player) >= meta.price) {
      pendingBuy = {
        token: token,
        meta: meta,
        done: done
      };
      $('buy').hidden = false;
      $('skipBuy').hidden = false;
      $('result').textContent = 'Rolled ' + lastRoll + '. Buy ' + (meta.label || 'this tile') + ' for \u00a3' + meta.price + '?';
      return;
    }
    afterBuy(token, meta, false, done);
  }
  function afterBuy(token, meta, bought, done) {
    if (bought && meta && !meta.owner) {
      addMoney(token.player, -Number(meta.price || 0));
      meta.owner = token.player;
      log(playerName(token.player) + ' buys ' + (meta.label || 'the tile') + '.');
    }
    var again = false;
    if (meta && meta.effect) {
      var effect = meta.effect;
      var value = Number(effect.value) || 0;
      var type = effect.type;
      if (type === 'money') addMoney(token.player, value);
      else if (type === 'toStart') token.pathIndex = 0;
      else if (type === 'forward') moveSteps(token, value);
      else if (type === 'back') moveSteps(token, -value);
      else if (type === 'goTo') {
        var target = pathIndexOfFromNumber(value);
        if (target >= 0) token.pathIndex = target;
      }
      else if (type === 'again') again = true;
      else if (type === 'skip') { log(playerName(token.player) + ' misses the next turn.'); }
      else if (type === 'card') {
        var drawn = drawFromDeck(effect.deck || (decks[0] && decks[0].name));
        if (drawn) again = applyCardEffect(token, drawn) || again;
      }
      else if (type === 'skip') {
        skipNext[token.player] = true;
        log(playerName(token.player) + ' misses the next turn.');
      }
      else if (type === 'swap') {
        var rival = tokens.find(function (other) { return other.player !== token.player && !other.finished && !other.inLane; });
        if (rival) {
          var swapIndex = token.pathIndex;
          token.pathIndex = rival.pathIndex;
          rival.pathIndex = swapIndex;
          log(playerName(token.player) + ' swaps places with ' + playerName(rival.player) + '.');
        }
      }
      else if (type === 'nearest') {
        var nearest = null;
        var nearestDistance = Infinity;
        (D.links || []).forEach(function (link) {
          var from = pathIndexOf(link.from.c, link.from.r);
          if (from < 0) return;
          var distance = Math.abs(from - token.pathIndex);
          if (distance < nearestDistance) { nearestDistance = distance; nearest = link; }
        });
        if (nearest) {
          var nearestIndex = pathIndexOf(nearest.to.c, nearest.to.r);
          if (nearestIndex >= 0) token.pathIndex = nearestIndex;
        }
      }
      else if (type === 'collect') {
        players.forEach(function (other, otherIndex) {
          var otherPlayer = otherIndex + 1;
          if (otherPlayer !== token.player) {
            var amount = Math.min(money(otherPlayer), Math.abs(value));
            addMoney(otherPlayer, -amount);
            addMoney(token.player, amount);
          }
        });
      }
    }
    var branchCell = pathCell(token.pathIndex);
    var options = branchCell ? (D.branches || []).filter(function (branch) {
      return branch.from.c === branchCell.c && branch.from.r === branchCell.r;
    }) : [];
    if (options.length) {
      showChoices(options, function (branch) {
        if (branch) {
          var index = pathIndexOf(branch.to.c, branch.to.r);
          if (index >= 0) token.pathIndex = index;
          log(playerName(token.player) + ' chose ' + (branch.label || 'a branch') + '.');
        }
        done(again);
      });
      return;
    }
    done(again);
  }
  function showChoices(options, callback) {
    var box = $('choices');
    box.innerHTML = '';
    box.hidden = false;
    pendingChoice = callback;
    options.forEach(function (branch) {
      var button = document.createElement('button');
      button.className = 'secondary';
      button.textContent = branch.label || 'Choose';
      button.onclick = function () {
        box.hidden = true;
        var cb = pendingChoice;
        pendingChoice = null;
        cb(branch);
      };
      box.appendChild(button);
    });
    var skip = document.createElement('button');
    skip.className = 'secondary';
    skip.textContent = 'Stay here';
    skip.onclick = function () {
      box.hidden = true;
      var cb = pendingChoice;
      pendingChoice = null;
      cb(null);
    };
    box.appendChild(skip);
  }
  function finishCheck(token) {
    var winMode = settings.winMode || 'finish';
    if (winMode === 'manual' || winMode === 'mostMoney') return false;
    if (token.inLane) return !!token.finished;
    if (token.pathIndex < (D.path || []).length - 1) return false;
    if (settings.allPawnsWin || winMode === 'allPawns') {
      return toks(token.player).every(function (pawn) { return pawn.finished; });
    }
    return true;
  }
  function blockadeAt(cell, player) {
    if (!settings.blockades || !cell) return false;
    var count = 0;
    tokens.forEach(function (other) {
      if (other.player === player || other.finished || other.inLane) return;
      var otherCell = pathCell(other.pathIndex);
      if (otherCell && otherCell.c === cell.c && otherCell.r === cell.r) count++;
    });
    return count >= 2;
  }
  function applyLink(token) {
    (D.links || []).forEach(function (link) {
      var cell = pathCell(token.pathIndex);
      if (cell && cell.c === link.from.c && cell.r === link.from.r) {
        var index = pathIndexOf(link.to.c, link.to.r);
        if (index >= 0) token.pathIndex = index;
      }
    });
  }
  function moveSteps(token, steps) {
    if (token.finished) return;
    if (token.inLane) {
      var lane = (D.homeLanes || [])[token.player - 1] || [];
      var nextLane = token.laneIndex + Math.abs(steps);
      if (settings.exactFinish && nextLane > lane.length - 1) {
        log(playerName(token.player) + ' needs the exact number to finish.');
        return;
      }
      token.laneIndex = Math.max(0, Math.min(lane.length - 1, nextLane));
      if (token.laneIndex >= lane.length - 1) token.finished = true;
      return;
    }
    var direction = steps < 0 ? -1 : 1;
    var remaining = Math.abs(steps);
    var before = token.pathIndex;
    for (var s = 0; s < remaining; s++) {
      var next = token.pathIndex + direction;
      if (next < 0) break;
      if (next > (D.path || []).length - 1) {
        if (settings.exactFinish) {
          log(playerName(token.player) + ' needs the exact number to finish.');
          break;
        }
        next = (D.path || []).length - 1;
      }
      var cell = pathCell(next);
      if (cell && blockadeAt(cell, token.player)) {
        log(playerName(token.player) + ' is blocked by a blockade.');
        break;
      }
      token.pathIndex = next;
      if (next >= (D.path || []).length - 1) break;
    }
    if (settings.startBonus && direction > 0 && before + remaining >= (D.path || []).length) {
      addMoney(token.player, 10);
    }
    applyLink(token);
    var laneForPlayer = (D.homeLanes || [])[token.player - 1];
    if (laneForPlayer && laneForPlayer.length && token.pathIndex >= (D.path || []).length - 1) {
      token.inLane = true;
      token.laneIndex = 0;
      log(playerName(token.player) + ' enters the home lane.');
    }
    applyCapture(token);
  }
  function advance(again) {
    if (winner) return;
    if (!again) {
      var guard = 0;
      do {
        turn = (turn % players.length) + 1;
        guard++;
      } while (skipNext[turn] && guard <= players.length);
      if (skipNext[turn]) delete skipNext[turn];
    }
    render();
  }
  function completeTurn(token, again) {
    if (token && finishCheck(token)) {
      token.finished = true;
      showWinner(token.player);
      return;
    }
    advance(again);
  }
  function roll() {
    if (winner || pendingBuy || pendingChoice) return;
    var list = activeToks();
    if (!list.length) {
      advance(false);
      return;
    }
    var picker = $('pawn');
    var index = Number(picker.value) || 0;
    var token = list[Math.min(index, list.length - 1)];
    var rolled;
    if (D.rollMode === 'spinner') {
      var spinner = D.spinner || {};
      var labels = (spinner.labels && spinner.labels.length) ? spinner.labels : ['1', '2', '3', '4', '5', '6'];
      var picked = labels[Math.floor(Math.random() * labels.length)];
      log('Spinner: ' + picked + '.');
      var pickedMatch = String(picked).match(/-?\d+/);
      if (!pickedMatch) {
        $('result').textContent = 'Spinner: ' + picked + '. Turn passes.';
        advance(false);
        return;
      }
      rolled = Math.abs(parseInt(pickedMatch[0], 10)) || 1;
    } else if (D.dieMode === 'action' && (D.actionFaces || []).length) {
      var face = D.actionFaces[Math.floor(Math.random() * D.actionFaces.length)];
      log('Action die: ' + face + '.');
      var match = String(face).match(/-?\d+/);
      if (!match) {
        $('result').textContent = 'Action die: ' + face + '. Turn passes.';
        advance(false);
        return;
      }
      rolled = Math.abs(parseInt(match[0], 10)) || 1;
    } else {
      rolled = 0;
      var dice = Math.max(1, Math.min(6, Number(D.dieCount) || 1));
      for (var d = 0; d < dice; d++) rolled += 1 + Math.floor(Math.random() * Math.max(2, dieSides));
      if (dice > 1) log('Rolled ' + dice + ' dice.');
    }
    if (settings.sixToStart && !token.started) {
      if (rolled !== 6) {
        $('result').textContent = 'Rolled ' + rolled + '. ' + playerName(token.player) + ' needs a 6 to start.';
        log(playerName(token.player) + ' needs a 6 to start.');
        advance(false);
        return;
      }
      token.started = true;
    }
    lastRoll = rolled;
    $('result').textContent = 'Rolled ' + rolled + '. ' + playerName(token.player) + ' moves.';
    log(playerName(token.player) + ' rolled ' + rolled + '.');
    moveSteps(token, rolled);
    applyTile(token, function (again) {
      completeTurn(token, again);
    });
  }
  function buy(choice) {
    if (!pendingBuy) return;
    var pending = pendingBuy;
    pendingBuy = null;
    $('buy').hidden = true;
    $('skipBuy').hidden = true;
    afterBuy(pending.token, pending.meta, choice, pending.done);
  }
  $('roll').onclick = roll;
  $('buy').onclick = function () { buy(true); };
  $('skipBuy').onclick = function () { buy(false); };
  $('new').onclick = function () {
    winner = 0;
    turn = 1;
    pendingBuy = null;
    pendingChoice = null;
    $('buy').hidden = true;
    $('skipBuy').hidden = true;
    $('choices').hidden = true;
    tokens.forEach(function (token) {
      token.pathIndex = 0;
      token.finished = false;
      token.inLane = false;
      token.laneIndex = 0;
    });
    players.forEach(function (player) { player.money = Number(settings.startingMoney) || 0; });
    $('log').innerHTML = '';
    $('result').textContent = 'New game';
    render();
  };
  function canvasPoint(event) {
    var rect = cv.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (cv.width / rect.width),
      y: (event.clientY - rect.top) * (cv.height / rect.height)
    };
  }
  var draggingPiece = null;
  cv.addEventListener('pointerdown', function (event) {
    if (winner) return;
    var point = canvasPoint(event);
    var found = null;
    allTokens.forEach(function (token) {
      if (token.pawn) return;
      var x = Number(token.x) * (CELL / 80);
      var y = Number(token.y) * (CELL / 80);
      if (!isFinite(x) || !isFinite(y)) return;
      if (Math.hypot(point.x - x, point.y - y) <= CELL * 0.45) found = token;
    });
    if (!found) return;
    draggingPiece = found;
    try { cv.setPointerCapture(event.pointerId); } catch (err) {}
    event.preventDefault();
  });
  cv.addEventListener('pointermove', function (event) {
    if (!draggingPiece) return;
    var point = canvasPoint(event);
    draggingPiece.x = point.x * (80 / CELL);
    draggingPiece.y = point.y * (80 / CELL);
    draw();
    event.preventDefault();
  });
  cv.addEventListener('pointerup', function () { draggingPiece = null; });
  cv.addEventListener('pointercancel', function () { draggingPiece = null; });
  window.__TT_GAME = { tokens: tokens, pieces: allTokens, players: players, settings: settings, get turn() { return turn; }, get winner() { return winner; } };
  render();
})();
`;

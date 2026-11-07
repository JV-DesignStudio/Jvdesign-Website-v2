self.onmessage = function (event) {
  var message = event.data || {};
  var id = message.id;
  var query = String(message.query || '');
  var cards = message.cards || [];
  var needle = query.toLowerCase();
  var matches = [];

  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var groups = [];
    var hit = false;

    if (card.raw_signature) {
      try {
        var match = new RegExp(card.raw_signature, 'i').exec(query);
        if (match) {
          hit = true;
          groups = match.slice(1).filter(function (group) { return group != null && group !== ''; });
        }
      } catch (error) {}
    }

    if (!hit) {
      var haystack = [
        card.kid_title,
        card.plain_translation,
        card.keywords,
        (card.checklist_fixes || []).join(' ')
      ].join(' ').toLowerCase();
      hit = haystack.indexOf(needle) !== -1;
    }

    if (hit) matches.push({ id: card.id, groups: groups });
  }

  self.postMessage({ id: id, matches: matches });
};

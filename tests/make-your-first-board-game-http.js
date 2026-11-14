const { run } = require('./workshop-page-check');

run('/workshops/make-your-first-board-game.html', {
  next: '/workshops/build-a-game-15-min.html',
  challenge: false,
  reflect: false
}).catch((err) => {
  console.error(err);
  process.exit(1);
});

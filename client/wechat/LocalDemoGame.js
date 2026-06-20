export class LocalDemoGame {
  create() {
    const deck = this.createDeck();
    this.shuffle(deck);
    const players = [
      { id: 'me', name: '我', coin: 56, hand: [] },
      { id: 'ai_1', name: '小明', coin: 35, hand: [] },
      { id: 'ai_2', name: '思思', coin: 42, hand: [] },
      { id: 'ai_3', name: '阿强', coin: 28, hand: [] }
    ];
    for (let i = 0; i < 7; i += 1) {
      for (const player of players) {
        player.hand.push(deck.pop());
      }
    }
    let discard = deck.pop();
    while (discard.type !== 'number') {
      deck.unshift(discard);
      discard = deck.pop();
    }
    return {
      roomId: 'local',
      deck,
      players,
      discard,
      currentColor: discard.color,
      currentIndex: 0,
      direction: 1,
      turnStartedAt: Date.now(),
      turnSeconds: 30,
      message: '轮到你出牌',
      calledU: false,
      finished: false,
      drawChoice: null
    };
  }

  createDeck() {
    const deck = [];
    let seq = 1;
    for (const color of ['red', 'yellow', 'blue', 'green']) {
      for (let value = 0; value <= 9; value += 1) {
        deck.push({ id: `c_${seq++}`, color, type: 'number', label: String(value) });
      }
      for (const type of ['skip', 'reverse', 'plus2']) {
        deck.push({ id: `c_${seq++}`, color, type, label: type === 'skip' ? '禁' : type === 'reverse' ? '↻' : '+2' });
      }
    }
    for (let i = 0; i < 4; i += 1) {
      deck.push({ id: `c_${seq++}`, color: 'wild', type: 'wild', label: '◎' });
      deck.push({ id: `c_${seq++}`, color: 'wild', type: 'plus4', label: '+4' });
    }
    return deck;
  }

  shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  currentPlayer(game) {
    return game.players[game.currentIndex];
  }

  me(game) {
    return game.players[0];
  }

  playableCards(game) {
    return this.me(game).hand.filter((card) => this.isPlayable(game, card));
  }

  isPlayable(game, card) {
    const top = game.discard;
    return card.color === 'wild' || card.color === game.currentColor || card.label === top.label || card.type === top.type;
  }

  recommendColor(hand) {
    const counts = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const card of hand) {
      if (counts[card.color] !== undefined) {
        counts[card.color] += 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  drawTo(game, player, count) {
    for (let i = 0; i < count; i += 1) {
      if (game.deck.length === 0) {
        game.deck = this.createDeck();
        this.shuffle(game.deck);
      }
      player.hand.push(game.deck.pop());
    }
  }

  advanceTurn(game) {
    const length = game.players.length;
    game.currentIndex = (game.currentIndex + game.direction + length) % length;
    game.turnStartedAt = Date.now();
  }
}

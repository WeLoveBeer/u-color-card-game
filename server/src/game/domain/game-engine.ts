import type { Card, PlayableColor } from '@shared/domain/card.js';
import { DEFAULT_RULE_CONFIG, type RuleConfig } from '@shared/domain/rule-config.js';
import type { DomainEvent, GameResult, GameState, PlayerId, PlusFourResponseOption } from '@shared/domain/game-state.js';
import { DeckResolver } from './deck/deck-resolver.js';
import { SeededRandomSource, type RandomSource } from './deck/shuffle.service.js';
import { EffectResolver } from './effects/effect-resolver.js';
import { WildPlusFourHandler } from './effects/handlers/wild-plus-four.handler.js';
import { RuleValidator } from './rules/rule-validator.js';
import { ScoreResolver } from './scoring/score-resolver.js';
import { TurnResolver } from './turn/turn-resolver.js';
import {
  cloneGameState,
  getHand,
  nextActionSeq,
  removeCardsFromHand,
  syncHandCounts
} from './utils/state.js';

export type CreateGameOptions = {
  roomId?: string;
  gameId?: string;
  playerIds?: PlayerId[];
  random?: RandomSource;
  seedHash?: string;
};

export class GameEngine {
  constructor(
    private readonly deck = new DeckResolver(),
    private readonly validator = new RuleValidator(),
    private readonly effects = new EffectResolver(),
    private readonly turns = new TurnResolver(),
    private readonly scores = new ScoreResolver()
  ) {}

  createGame(ruleConfig: RuleConfig = DEFAULT_RULE_CONFIG, options: CreateGameOptions = {}): GameState {
    const playerIds = options.playerIds ?? Array.from({ length: ruleConfig.playerCount }, (_, index) => `p_${index + 1}`);
    const random = options.random ?? new SeededRandomSource(Date.now() % 100000);
    const shuffled = this.deck.shuffleDeck(this.deck.createDeck(ruleConfig), random);
    const dealt = this.deck.deal(shuffled, playerIds, ruleConfig.initialCards);
    const start = this.deck.takeStartingDiscard(dealt.deck);

    return syncHandCounts({
      roomId: options.roomId ?? 'room_local',
      gameId: options.gameId ?? 'game_local',
      status: 'playing',
      ruleConfig,
      players: playerIds.map((id, index) => ({
        id,
        seatIndex: index,
        handCount: dealt.hands[id]?.length ?? 0,
        online: true,
        isAi: id.startsWith('ai_'),
        isAutoPlaying: false,
        disconnectAt: null,
        autoPlayAt: null
      })),
      deck: start.deck,
      discardPile: [start.discardTop],
      hands: dealt.hands,
      currentPlayerId: playerIds[Math.floor(random.next() * playerIds.length)] ?? playerIds[0],
      direction: 1,
      currentColor: start.discardTop.color,
      pendingDrawCount: 0,
      calledUThisTurn: {},
      turnDeadline: this.nextTurnDeadline(ruleConfig),
      turnSeq: 1,
      seedHash: options.seedHash ?? 'local_seed_hash',
      actionSeq: 0
    });
  }

  playCards(state: GameState, playerId: PlayerId, cardIds: string[], chooseColor?: PlayableColor): GameResult {
    const validation = this.validator.validatePlay(state, playerId, cardIds, chooseColor);
    if (!validation.ok) {
      return this.fail(state, validation.errorCode);
    }

    const beforeHandCount = getHand(state, playerId).length;
    let next = cloneGameState(state);
    next = this.closeMissedCallWindowIfNeeded(next, playerId).state;
    const { removed, rest } = removeCardsFromHand(next.hands[playerId] ?? [], cardIds);
    const playedCard = removed[0];
    next.hands[playerId] = rest;
    next.discardPile.push(...removed);
    next.currentColor = playedCard.color === 'wild' ? next.currentColor : playedCard.color;
    next.actionSeq = nextActionSeq(next);
    next = syncHandCounts(next);

    const cardPlayedEvent: DomainEvent = { type: 'card_played', playerId, cardIds, publicCards: removed };
    const events: DomainEvent[] = [cardPlayedEvent];
    const discardCountBeforeEffect = next.discardPile.length;

    const effect = this.effects.resolve(next, playerId, playedCard, chooseColor);
    next = effect.state;
    if (playedCard.type === 'same_color_dump' && cardPlayedEvent.type === 'card_played') {
      cardPlayedEvent.publicCards = next.discardPile.slice(discardCountBeforeEffect - removed.length);
      cardPlayedEvent.cardIds = cardPlayedEvent.publicCards.map((card) => card.id);
    }
    events.push(...effect.events);

    const missedCallEvent = this.openMissedCallWindowIfNeeded(next, playerId, beforeHandCount);
    next = missedCallEvent.state;
    events.push(...missedCallEvent.events);

    const gameOver = this.finishIfNeeded(next, playerId);
    if (gameOver.finished) {
      return { ok: true, state: gameOver.state, events: [...events, ...gameOver.events] };
    }

    const turn = this.applyTurnPolicy(gameOver.state, playerId, effect.nextTurnPolicy);
    return { ok: true, state: turn.state, events: [...events, ...turn.events] };
  }

  drawCard(state: GameState, playerId: PlayerId): GameResult {
    const turn = this.validator.validateTurn(state, playerId);
    if (!turn.ok) {
      return this.fail(state, turn.errorCode);
    }

    let next = cloneGameState(state);
    const close = this.closeMissedCallWindowIfNeeded(next, playerId);
    next = close.state;
    const count = next.pendingDrawCount > 0 ? next.pendingDrawCount : 1;
    const reason = next.pendingDrawSource ?? 'normal';
    const drawn = this.deck.draw(next, count);
    next = drawn.state;
    next.hands[playerId] = [...(next.hands[playerId] ?? []), ...drawn.cards];
    next.pendingDrawCount = 0;
    next.pendingDrawSource = undefined;
    next.actionSeq = nextActionSeq(next);
    next = syncHandCounts(next);

    const events: DomainEvent[] = [
      ...close.events,
      { type: 'card_drawn', playerId, count: drawn.cards.length, drawReason: reason }
    ];

    if (count > 1) {
      const policy = this.applyTurnPolicy(next, playerId, { type: 'skip', targetPlayerId: playerId });
      return { ok: true, state: policy.state, events: [...events, ...policy.events] };
    }

    const drawnCard = drawn.cards[0];
    if (drawnCard && this.validator.canPlayCard(state, drawnCard)) {
      return { ok: true, state: next, events };
    }

    const policy = this.applyTurnPolicy(next, playerId, { type: 'normal' });
    return { ok: true, state: policy.state, events: [...events, ...policy.events] };
  }

  passTurn(state: GameState, playerId: PlayerId): GameResult {
    const turn = this.validator.validateTurn(state, playerId);
    if (!turn.ok) {
      return this.fail(state, turn.errorCode);
    }
    const close = this.closeMissedCallWindowIfNeeded(state, playerId);
    const policy = this.applyTurnPolicy(close.state, playerId, { type: 'normal' });
    return { ok: true, state: policy.state, events: [...close.events, ...policy.events] };
  }

  callU(state: GameState, playerId: PlayerId): GameResult {
    const validation = this.validator.validateCallU(state, playerId);
    if (!validation.ok) {
      return this.fail(state, validation.errorCode);
    }
    const next = cloneGameState(state);
    next.calledUThisTurn[playerId] = true;
    return { ok: true, state: next, events: [{ type: 'player_called_u', playerId }] };
  }

  catchMissedCall(state: GameState, catcherId: PlayerId, targetPlayerId: PlayerId): GameResult {
    const validation = this.validator.validateCatchMissedCall(state, catcherId, targetPlayerId);
    if (!validation.ok) {
      return this.fail(state, validation.errorCode);
    }
    let next = cloneGameState(state);
    const drawn = this.deck.draw(next, 2);
    next = drawn.state;
    next.hands[targetPlayerId] = [...(next.hands[targetPlayerId] ?? []), ...drawn.cards];
    next.missedCallWindow = undefined;
    next = syncHandCounts(next);
    return {
      ok: true,
      state: next,
      events: [
        { type: 'missed_call_caught', catcherId, targetPlayerId, penaltyCards: drawn.cards.length },
        { type: 'card_drawn', playerId: targetPlayerId, count: drawn.cards.length, drawReason: 'missed_call_penalty' }
      ]
    };
  }

  respondPlusFour(
    state: GameState,
    playerId: PlayerId,
    action: PlusFourResponseOption,
    cardId?: string,
    chooseColor?: PlayableColor
  ): GameResult {
    const challenge = state.pendingChallenge;
    if (!challenge || challenge.challengerId !== playerId) {
      return this.fail(state, 'CHALLENGE_NOT_ALLOWED');
    }

    if (action === 'stack_plus_four') {
      if (!cardId || !chooseColor || !state.ruleConfig.plusFourStack) {
        return this.fail(state, 'ILLEGAL_CARD');
      }
      const next = cloneGameState(state);
      next.pendingChallenge = undefined;
      return this.playCards(next, playerId, [cardId], chooseColor);
    }

    let next = cloneGameState(state);
    const success = action === 'challenge' && WildPlusFourHandler.challengeWouldSucceed(next);
    const drawPlayerId = success ? challenge.challengedPlayerId : playerId;
    const drawCount = success ? 4 : action === 'challenge' ? 6 : 4;
    const drawn = this.deck.draw(next, drawCount);
    next = drawn.state;
    next.hands[drawPlayerId] = [...(next.hands[drawPlayerId] ?? []), ...drawn.cards];
    next.pendingChallenge = undefined;
    next.actionSeq = nextActionSeq(next);
    next = syncHandCounts(next);

    const events: DomainEvent[] = [
      {
        type: 'plus_four_challenge_result',
        success,
        challengerId: playerId,
        challengedPlayerId: challenge.challengedPlayerId,
        drawPlayerId,
        drawCount: drawn.cards.length
      },
      {
        type: 'card_drawn',
        playerId: drawPlayerId,
        count: drawn.cards.length,
        drawReason: action === 'draw' ? 'wild_plus_four' : success ? 'challenge_success' : 'challenge_failed'
      }
    ];
    const policy = this.applyTurnPolicy(next, playerId, { type: 'skip', targetPlayerId: playerId });
    return { ok: true, state: policy.state, events: [...events, ...policy.events] };
  }

  handleTimeout(state: GameState, playerId: PlayerId): GameResult {
    const hand = getHand(state, playerId);
    const playable = hand.find((card) => this.validator.canPlayCard(state, card));
    if (playable) {
      const chooseColor = playable.color === 'wild' ? this.chooseMostCommonColor(hand) : undefined;
      return this.playCards(state, playerId, [playable.id], chooseColor);
    }
    return this.drawCard(state, playerId);
  }

  private applyTurnPolicy(
    state: GameState,
    actorId: PlayerId,
    policy: { type: 'normal' } | { type: 'skip'; targetPlayerId: PlayerId } | { type: 'wait_for_response'; targetPlayerId: PlayerId } | { type: 'game_over' }
  ): { state: GameState; events: DomainEvent[] } {
    if (policy.type === 'game_over') {
      return { state, events: [] };
    }
    const next = cloneGameState(state);
    if (policy.type === 'wait_for_response') {
      next.currentPlayerId = policy.targetPlayerId;
    } else if (policy.type === 'skip') {
      next.currentPlayerId = this.turns.nextAfterSkip(next, policy.targetPlayerId);
    } else {
      next.currentPlayerId = this.turns.nextPlayerId(next, actorId);
    }
    next.calledUThisTurn[actorId] = false;
    next.turnSeq += 1;
    next.turnDeadline = this.nextTurnDeadline(next.ruleConfig);
    return { state: next, events: [{ type: 'turn_changed', currentPlayerId: next.currentPlayerId }] };
  }

  private nextTurnDeadline(ruleConfig: RuleConfig): number {
    return Date.now() + ruleConfig.turnSeconds * 1000;
  }

  private finishIfNeeded(state: GameState, playerId: PlayerId): { finished: boolean; state: GameState; events: DomainEvent[] } {
    if (getHand(state, playerId).length > 0) {
      return { finished: false, state, events: [] };
    }
    const next = cloneGameState(state);
    next.status = 'finished';
    const rankings = this.scores.buildRankings(next, playerId);
    const coinDeltas = this.scores.buildCoinDeltas(next, playerId);
    return {
      finished: true,
      state: next,
      events: [{ type: 'game_over', winnerId: playerId, rankings, coinDeltas }]
    };
  }

  private openMissedCallWindowIfNeeded(
    state: GameState,
    playerId: PlayerId,
    beforeHandCount: number
  ): { state: GameState; events: DomainEvent[] } {
    if (!state.ruleConfig.callUPenalty || beforeHandCount !== 2 || getHand(state, playerId).length !== 1) {
      return { state, events: [] };
    }
    if (state.calledUThisTurn[playerId]) {
      return { state, events: [] };
    }
    const next = cloneGameState(state);
    const closesAfterPlayerId = this.turns.nextPlayerId(next, playerId);
    next.missedCallWindow = {
      targetPlayerId: playerId,
      openedAtActionSeq: next.actionSeq,
      closesAfterPlayerId
    };
    return {
      state: next,
      events: [{ type: 'missed_call_window_opened', targetPlayerId: playerId, closesAfterPlayerId }]
    };
  }

  private closeMissedCallWindowIfNeeded(state: GameState, actorId: PlayerId): { state: GameState; events: DomainEvent[] } {
    if (state.missedCallWindow?.closesAfterPlayerId !== actorId) {
      return { state, events: [] };
    }
    const next = cloneGameState(state);
    const targetPlayerId = next.missedCallWindow!.targetPlayerId;
    next.missedCallWindow = undefined;
    return { state: next, events: [{ type: 'missed_call_window_closed', targetPlayerId }] };
  }

  private chooseMostCommonColor(hand: Card[]): PlayableColor {
    const counts: Record<PlayableColor, number> = { red: 0, yellow: 0, blue: 0, green: 0 };
    for (const card of hand) {
      if (card.color !== 'wild') {
        counts[card.color] += 1;
      }
    }
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as PlayableColor) ?? 'red';
  }

  private fail(state: GameState, errorCode: GameResult['errorCode']): GameResult {
    return { ok: false, state, events: [], errorCode };
  }
}

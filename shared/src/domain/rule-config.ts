export type RuleSet = 'standard' | 'party';

export type SpecialPack = 'same_color_dump' | 'balloon' | 'swap_hand' | 'color_lock';

export type RuleConfig = {
  playerCount: 2 | 3 | 4;
  initialCards: 5 | 7 | 9;
  turnSeconds: 15 | 30 | 60;
  ruleSet: RuleSet;
  plusTwoStack: boolean;
  plusFourStack: boolean;
  mixedDrawStack: boolean;
  sameColorDump: boolean;
  callUPenalty: boolean;
  plusFourEnabled: boolean;
  plusFourChallenge: boolean;
  specialPacks: SpecialPack[];
  aiFill: boolean;
  rounds: 1 | 3 | 5;
};

export const DEFAULT_RULE_CONFIG: RuleConfig = {
  playerCount: 4,
  initialCards: 7,
  turnSeconds: 30,
  ruleSet: 'standard',
  plusTwoStack: false,
  plusFourStack: false,
  mixedDrawStack: false,
  sameColorDump: false,
  callUPenalty: true,
  plusFourEnabled: true,
  plusFourChallenge: true,
  specialPacks: [],
  aiFill: true,
  rounds: 1
};

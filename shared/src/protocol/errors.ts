export type ErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_PARAMS'
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ROOM_ALREADY_STARTED'
  | 'NOT_ROOM_OWNER'
  | 'NOT_IN_ROOM'
  | 'GAME_NOT_STARTED'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_FOUND'
  | 'ILLEGAL_CARD'
  | 'COLOR_REQUIRED'
  | 'CHALLENGE_NOT_ALLOWED'
  | 'CHALLENGE_REQUIRED'
  | 'CATCH_NOT_ALLOWED'
  | 'ACTION_TIMEOUT'
  | 'AD_REWARD_LIMIT'
  | 'SERVER_BUSY'
  | 'SERVER_ERROR';

export type ApiError = {
  code: ErrorCode;
  message: string;
};

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: '未登录或登录已失效',
  INVALID_PARAMS: '参数错误',
  ROOM_NOT_FOUND: '房间不存在或已结束',
  ROOM_FULL: '房间已满',
  ROOM_ALREADY_STARTED: '房间已开始',
  NOT_ROOM_OWNER: '不是房主',
  NOT_IN_ROOM: '玩家不在房间中',
  GAME_NOT_STARTED: '游戏未开始',
  NOT_YOUR_TURN: '还没轮到你',
  CARD_NOT_FOUND: '玩家没有这张牌',
  ILLEGAL_CARD: '这张牌当前不能出',
  COLOR_REQUIRED: '需要选择颜色',
  CHALLENGE_NOT_ALLOWED: '当前不能质疑',
  CHALLENGE_REQUIRED: '需要选择质疑或摸牌',
  CATCH_NOT_ALLOWED: '当前不能抓忘喊',
  ACTION_TIMEOUT: '操作超时',
  AD_REWARD_LIMIT: '广告奖励次数已达上限',
  SERVER_BUSY: '服务器繁忙，请稍后再试',
  SERVER_ERROR: '服务器错误'
};

import { describe, expect, it } from 'vitest';
import type { RoomStateMessage } from '@shared/index.js';
import { DEFAULT_RULE_CONFIG } from '@shared/index.js';
import { RoomView } from '../room/RoomView.js';
import { RoomRenderer } from './RoomRenderer.js';

const roomState = (): RoomStateMessage['data'] => ({
  roomId: '123456',
  ownerId: 'owner',
  status: 'waiting',
  config: { ...DEFAULT_RULE_CONFIG, playerCount: 4, aiFill: false },
  players: [
    { id: 'owner', seatIndex: 0, handCount: 0, nickname: '房主', ready: true, online: true, isAi: false, isAutoPlaying: false },
    { id: 'p2', seatIndex: 1, handCount: 0, nickname: '朋友', ready: false, online: true, isAi: false, isAutoPlaying: false }
  ]
});

describe('RoomRenderer', () => {
  it('渲染等待房座位、快捷语和房主开始按钮', () => {
    const model = new RoomView().build(roomState(), 'owner');

    const tree = new RoomRenderer().render(model, { width: 1080, height: 1920, safeTop: 44, safeBottom: 24 });

    expect(tree.commands.find((command) => command.id === 'room-title')).toMatchObject({ type: 'text', text: '房间 123456' });
    expect(tree.commands.find((command) => command.id === 'room-primary-text')).toMatchObject({ type: 'text', text: '等待玩家加入' });
    expect(tree.commands.find((command) => command.id === 'room-primary-reason')).toMatchObject({ type: 'text', text: '人数不足' });
    expect(tree.hitAreas.map((area) => area.action)).toEqual(expect.arrayContaining(['copy_room_id', 'share_room', 'leave_room', 'send_quick_message', 'start_game', 'invite_to_seat']));
  });
});

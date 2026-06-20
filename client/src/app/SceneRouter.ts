export type SceneName = 'boot' | 'lobby' | 'mode_select' | 'create_room' | 'join_room' | 'room' | 'game' | 'result' | 'leaderboard' | 'settings' | 'rules';

export class SceneRouter {
  private currentValue: SceneName = 'boot';

  go(scene: SceneName): void {
    this.currentValue = scene;
  }

  get current(): SceneName {
    return this.currentValue;
  }
}

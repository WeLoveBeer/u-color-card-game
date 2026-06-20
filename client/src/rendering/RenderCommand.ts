export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TextAlign = 'left' | 'center' | 'right';

export type RenderCommand =
  | {
      type: 'rect';
      id: string;
      rect: Rect;
      fill: string;
      radius?: number;
      stroke?: string;
      lineWidth?: number;
    }
  | {
      type: 'text';
      id: string;
      text: string;
      x: number;
      y: number;
      fontSize: number;
      color: string;
      align: TextAlign;
      maxWidth?: number;
      weight?: 'regular' | 'medium' | 'bold';
    }
  | {
      type: 'image';
      id: string;
      assetKey: string;
      rect: Rect;
      alpha?: number;
      rotation?: number;
    }
  | {
      type: 'circle';
      id: string;
      x: number;
      y: number;
      radius: number;
      fill: string;
      stroke?: string;
      lineWidth?: number;
    }
  | {
      type: 'arc';
      id: string;
      x: number;
      y: number;
      radius: number;
      startAngle: number;
      endAngle: number;
      stroke: string;
      lineWidth: number;
    };

export type RenderTree = {
  width: number;
  height: number;
  commands: RenderCommand[];
  hitAreas: HitArea[];
};

export type HitArea = {
  id: string;
  action: string;
  rect: Rect;
  payload?: Record<string, string | number | boolean | null>;
};

export type RenderViewport = {
  width: number;
  height: number;
  safeTop?: number;
  safeBottom?: number;
};


import { WechatCanvasRuntime } from './wechat/WechatCanvasRuntime.js';

const runtime = new WechatCanvasRuntime({
  assetsBase: 'u_color_card_assets',
  apiBase: 'http://127.0.0.1:3000/api'
});

runtime.start();

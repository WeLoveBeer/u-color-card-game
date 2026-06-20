import { WechatCanvasRuntime } from './wechat/WechatCanvasRuntime.js';

const runtime = new WechatCanvasRuntime({
  assetsBase: 'u_color_card_assets',
  apiBase: 'http://121.199.78.110/api',
  wsBase: 'ws://121.199.78.110/ws'
});

runtime.start();

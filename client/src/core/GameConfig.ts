export type RuntimeEnv = 'dev' | 'test' | 'prod';

export type EndpointConfig = {
  apiBase: string;
  wsBase: string;
};

export const ENDPOINTS: Record<RuntimeEnv, EndpointConfig> = {
  dev: {
    apiBase: 'http://localhost:3000/api',
    wsBase: 'ws://localhost:3000/ws'
  },
  test: {
    apiBase: 'https://test-api.example.com/api',
    wsBase: 'wss://test-game.example.com/ws'
  },
  prod: {
    apiBase: 'http://121.199.78.110/api',
    wsBase: 'ws://121.199.78.110/ws'
  }
};

export const CLIENT_VERSION = '1.0.0';

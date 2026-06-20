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
    apiBase: 'https://api.example.com/api',
    wsBase: 'wss://game.example.com/ws'
  }
};

export const CLIENT_VERSION = '1.0.0';

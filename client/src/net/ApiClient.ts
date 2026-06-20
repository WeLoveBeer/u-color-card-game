import type {
  AdRewardRequest,
  AdRewardResponse,
  ApiResponse,
  AppConfigResponse,
  CardBackListResponse,
  ClaimTaskRewardRequest,
  ClaimTaskRewardResponse,
  CoinLeaderboardResponse,
  CreateRoomRequest,
  CreateRoomResponse,
  SelectCardBackRequest,
  SelectCardBackResponse,
  TaskListResponse,
  UserProfileDto,
  WechatLoginResponse
} from '@shared/index.js';

export class ApiClient {
  private token: string | null = null;

  constructor(private readonly apiBase: string, private readonly fetcher: typeof fetch = fetch) {}

  setToken(token: string | null): void {
    this.token = token;
  }

  async wechatLogin(code: string): Promise<ApiResponse<WechatLoginResponse>> {
    return this.post('/auth/wechat-login', { code }, false);
  }

  async me(): Promise<ApiResponse<UserProfileDto>> {
    return this.get('/users/me');
  }

  async getConfig(): Promise<ApiResponse<AppConfigResponse>> {
    return this.get('/config');
  }

  async createRoom(config: CreateRoomRequest): Promise<ApiResponse<CreateRoomResponse>> {
    return this.post('/rooms', config);
  }

  async getLeaderboard(limit = 100): Promise<ApiResponse<CoinLeaderboardResponse>> {
    return this.get(`/leaderboards/coins?limit=${limit}`);
  }

  async getTasks(): Promise<ApiResponse<TaskListResponse>> {
    return this.get('/tasks');
  }

  async claimTaskReward(request: ClaimTaskRewardRequest): Promise<ApiResponse<ClaimTaskRewardResponse>> {
    return this.post('/tasks/claim', request);
  }

  async getCardBacks(): Promise<ApiResponse<CardBackListResponse>> {
    return this.get('/cosmetics/card-backs');
  }

  async selectCardBack(request: SelectCardBackRequest): Promise<ApiResponse<SelectCardBackResponse>> {
    return this.post('/cosmetics/card-backs/select', request);
  }

  async claimAdReward(request: AdRewardRequest): Promise<ApiResponse<AdRewardResponse>> {
    return this.post('/rewards/ad', request);
  }

  private async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await this.fetcher(`${this.apiBase}${path}`, { headers: this.headers() });
    return (await response.json()) as ApiResponse<T>;
  }

  private async post<T>(path: string, body: unknown, withAuth = true): Promise<ApiResponse<T>> {
    const response = await this.fetcher(`${this.apiBase}${path}`, {
      method: 'POST',
      headers: this.headers(withAuth),
      body: JSON.stringify(body)
    });
    return (await response.json()) as ApiResponse<T>;
  }

  private headers(withAuth = true): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (withAuth && this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    return headers;
  }
}

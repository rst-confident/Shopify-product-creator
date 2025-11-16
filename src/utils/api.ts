const API_BASE = '/api';

export interface User {
  id: number;
  email: string;
  name: string | null;
  role: string;
}

export interface Store {
  id: number;
  user_id: number;
  store_name: string;
  shopify_domain: string;
  shopify_access_token?: string;
  openrouter_api_key: string | null;
  selected_ai_model: string;
  created_at: string;
}

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

async function apiRequest(endpoint: string, options: RequestOptions = {}) {
  const { method = 'GET', body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    credentials: 'include', // Important for session cookies!
  };

  if (body && !(body instanceof FormData)) {
    config.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    delete (config.headers as any)['Content-Type'];
    config.body = body;
    config.credentials = 'include';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () =>
    apiRequest('/auth/logout', { method: 'POST' }),
  getCurrentUser: (): Promise<{ user: User }> =>
    apiRequest('/auth/me'),
};

// Admin API
export const adminApi = {
  // Users
  getUsers: () => apiRequest('/admin/users'),
  createUser: (data: { email: string; password: string; name?: string; role?: string }) =>
    apiRequest('/admin/users', { method: 'POST', body: data }),
  updateUser: (userId: number, data: any) =>
    apiRequest(`/admin/users/${userId}`, { method: 'PUT', body: data }),
  deleteUser: (userId: number) =>
    apiRequest(`/admin/users/${userId}`, { method: 'DELETE' }),

  // Stores
  getAllStores: () => apiRequest('/admin/stores'),
  createStore: (data: {
    userId: number;
    storeName: string;
    shopifyDomain: string;
    shopifyAccessToken: string;
    openrouterApiKey?: string;
    selectedAiModel?: string;
  }) => apiRequest('/admin/stores', { method: 'POST', body: data }),
  updateStore: (storeId: number, data: any) =>
    apiRequest(`/admin/stores/${storeId}`, { method: 'PUT', body: data }),
  deleteStore: (storeId: number) =>
    apiRequest(`/admin/stores/${storeId}`, { method: 'DELETE' }),
};

// User Stores API
export const userStoresApi = {
  getMyStores: (): Promise<{ stores: Store[] }> =>
    apiRequest('/user/stores'),
  getStore: (storeId: number) =>
    apiRequest(`/user/stores/${storeId}`),
  createStore: (data: {
    storeName: string;
    shopifyDomain: string;
    shopifyAccessToken: string;
    openrouterApiKey?: string;
    selectedAiModel?: string;
  }) => apiRequest('/user/stores', { method: 'POST', body: data }),
  updateStore: (storeId: number, data: any) =>
    apiRequest(`/user/stores/${storeId}`, { method: 'PUT', body: data }),
  deleteStore: (storeId: number) =>
    apiRequest(`/user/stores/${storeId}`, { method: 'DELETE' }),
};

// Settings API
export const settingsApi = {
  get: (storeId: number) => apiRequest(`/settings?storeId=${storeId}`),
  update: (storeId: number, openrouterApiKey: string, selectedModel: string) =>
    apiRequest('/settings', { method: 'POST', body: { storeId, openrouterApiKey, selectedModel } }),
  testConnection: (apiKey: string) =>
    apiRequest('/settings/test-connection', { method: 'POST', body: { apiKey } }),
};

// Upload API
export const uploadApi = {
  uploadFile: (formData: FormData) =>
    apiRequest('/upload', { method: 'POST', body: formData }),
  getFiles: (storeId: number) => apiRequest(`/upload?storeId=${storeId}`),
};

// Mapping API
export const mappingApi = {
  getAISuggestions: (storeId: number, headers: string[], sampleData: any[]) =>
    apiRequest('/mapping/ai-suggest', {
      method: 'POST',
      body: { storeId, headers, sampleData },
    }),
  saveMapping: (storeId: number, fileId: number, mappings: any) =>
    apiRequest('/mapping/save', { method: 'POST', body: { storeId, fileId, mappings } }),
  getFields: () => apiRequest('/mapping/fields'),
};

// Process API
export const processApi = {
  processProducts: (
    storeId: number,
    fileId: number,
    mappings: any,
    records: any[],
    supplierName: string,
    importType?: string,
    preOrderTiming?: string,
    preOrderMonth?: string
  ) =>
    apiRequest('/process', {
      method: 'POST',
      body: { storeId, fileId, mappings, records, supplierName, importType, preOrderTiming, preOrderMonth },
    }),
};

// Queue API
export const queueApi = {
  getProducts: (storeId: number) => apiRequest(`/queue?storeId=${storeId}`),
  deleteProducts: (storeId: number, productIds: number[]) =>
    apiRequest('/queue', { method: 'DELETE', body: { storeId, productIds } }),
  getStats: (storeId: number) => apiRequest(`/queue/stats?storeId=${storeId}`),
};

// Import API
export const importApi = {
  importProducts: (storeId: number, productIds: number[], publishStatus: string = 'draft') =>
    apiRequest('/import', { method: 'POST', body: { storeId, productIds, publishStatus } }),
};

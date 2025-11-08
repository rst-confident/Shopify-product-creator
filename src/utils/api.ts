const API_BASE = '/api';

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
  };

  if (body && !(body instanceof FormData)) {
    config.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    delete config.headers['Content-Type'];
    config.body = body;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Settings API
export const settingsApi = {
  get: () => apiRequest('/settings'),
  update: (data: { openrouterApiKey?: string; selectedModel?: string }) =>
    apiRequest('/settings', { method: 'POST', body: data }),
  testConnection: (apiKey: string) =>
    apiRequest('/settings/test-connection', { method: 'POST', body: { apiKey } }),
};

// Upload API
export const uploadApi = {
  uploadFile: (formData: FormData) =>
    apiRequest('/upload', { method: 'POST', body: formData }),
  getFiles: () => apiRequest('/upload'),
};

// Mapping API
export const mappingApi = {
  getAISuggestions: (headers: string[], sampleData: any[]) =>
    apiRequest('/mapping/ai-suggest', {
      method: 'POST',
      body: { headers, sampleData },
    }),
  saveMapping: (fileId: number, mappings: any) =>
    apiRequest('/mapping/save', { method: 'POST', body: { fileId, mappings } }),
  getFields: () => apiRequest('/mapping/fields'),
};

// Process API
export const processApi = {
  processProducts: (fileId: number, mappings: any, records: any[], supplierName: string) =>
    apiRequest('/process', {
      method: 'POST',
      body: { fileId, mappings, records, supplierName },
    }),
};

// Queue API
export const queueApi = {
  getProducts: () => apiRequest('/queue'),
  deleteProducts: (productIds: number[]) =>
    apiRequest('/queue', { method: 'DELETE', body: { productIds } }),
  getStats: () => apiRequest('/queue/stats'),
};

// Import API
export const importApi = {
  importProducts: (productIds: number[], publishStatus: string = 'draft') =>
    apiRequest('/import', { method: 'POST', body: { productIds, publishStatus } }),
};

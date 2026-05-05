/**
 * Centralized API service – single source of truth for all backend calls.
 * All endpoints match the new microservice-style backend structure.
 */

const BASE_URL = 'http://localhost:8000';

// ── Auth helpers ─────────────────────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('access_token');
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Request failed');
  }
  return res.json();
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
// UC_Monitoring_Alert_1: Real-time sensor data stream
export const WS_URL = `ws://localhost:8000/api/monitoring/ws`;

// ── Auth (UC_UI_1) ────────────────────────────────────────────────────────────
export const authApi = {
  login: async (username, password) => {
    const body = new URLSearchParams({ username, password });
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await handleResponse(res);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('user_role', data.role);
    return data;
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_role');
  },

  getMe: () =>
    fetch(`${BASE_URL}/api/auth/me`, { headers: authHeaders() }).then(handleResponse),

  changePassword: (oldPassword, newPassword) =>
    fetch(`${BASE_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    }).then(handleResponse),

  // F-ADMIN-1: User management (Admin only)
  listUsers: () =>
    fetch(`${BASE_URL}/api/auth/users`, { headers: authHeaders() }).then(handleResponse),

  createUser: (username, password, role = 'FARMER') =>
    fetch(`${BASE_URL}/api/auth/users`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ username, password, role }),
    }).then(handleResponse),

  toggleUser: (userId) =>
    fetch(`${BASE_URL}/api/auth/users/${userId}/toggle`, {
      method: 'PATCH',
      headers: authHeaders(),
    }).then(handleResponse),

  deleteUser: (userId) =>
    fetch(`${BASE_URL}/api/auth/users/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(handleResponse),
};

// ── Monitoring (UC_Monitoring_Alert) ─────────────────────────────────────────
export const monitoringApi = {
  // UC_Monitoring_Alert_1: Xem thông số môi trường
  getSensors: () =>
    fetch(`${BASE_URL}/api/monitoring/sensors`, { headers: authHeaders() }).then(handleResponse),

  // UC_Monitoring_Alert_2: Xem biểu đồ đánh giá
  getSensorHistory: () =>
    fetch(`${BASE_URL}/api/monitoring/sensors/history`, { headers: authHeaders() }).then(handleResponse),

  // UC_Monitoring_Alert_5: Nhận cảnh báo
  getAlerts: () =>
    fetch(`${BASE_URL}/api/monitoring/alerts`, { headers: authHeaders() }).then(handleResponse),
};

// ── Actuating (UC_Actuating) ──────────────────────────────────────────────────
export const actuatingApi = {
  // UC_Actuating_1: Xem danh sách thiết bị
  getDevices: () =>
    fetch(`${BASE_URL}/api/actuating/devices`, { headers: authHeaders() }).then(handleResponse),

  // UC_Actuating_2/3: Điều khiển thiết bị (NF-PER-1: < 2s)
  control: (device, value) =>
    fetch(`${BASE_URL}/api/actuating/control`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ device, value }),
    }).then(handleResponse),

  // UC_Actuating_4: Thêm thiết bị mới
  addDevice: (name, device_type, aio_feed_key) =>
    fetch(`${BASE_URL}/api/actuating/devices`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, device_type, aio_feed_key }),
    }).then(handleResponse),

  // F-ADMIN-2: Cập nhật & Xóa thiết bị
  updateDevice: (id, name, device_type, aio_feed_key) =>
    fetch(`${BASE_URL}/api/actuating/devices/${id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name, device_type, aio_feed_key }),
    }).then(handleResponse),

  deleteDevice: (id) =>
    fetch(`${BASE_URL}/api/actuating/devices/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(handleResponse),

  // UC_UI_4: Cấu hình ngưỡng cảnh báo
  getConfigurations: () =>
    fetch(`${BASE_URL}/api/actuating/configurations`, { headers: authHeaders() }).then(handleResponse),

  upsertConfiguration: (config_key, config_value, device_id = null) =>
    fetch(`${BASE_URL}/api/actuating/configurations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ config_key, config_value, device_id }),
    }).then(handleResponse),
};

// ── Logging & Report (UC_Logging) ─────────────────────────────────────────────
export const loggingApi = {
  // UC_Logging_3: Tra cứu nhật ký
  getActionLogs: (deviceId = null, source = null, limit = 100) => {
    const params = new URLSearchParams({ limit });
    if (deviceId) params.append('device_id', deviceId);
    if (source) params.append('source', source);
    return fetch(`${BASE_URL}/api/logging/action-logs?${params}`, {
      headers: authHeaders(),
    }).then(handleResponse);
  },

  getSensorLogs: (deviceId = null, limit = 100) => {
    const params = new URLSearchParams({ limit });
    if (deviceId) params.append('device_id', deviceId);
    return fetch(`${BASE_URL}/api/logging/sensor-logs?${params}`, {
      headers: authHeaders(),
    }).then(handleResponse);
  },

  // UC_Logging_4: Xuất báo cáo CSV
  exportActionLogs: () => {
    window.open(`${BASE_URL}/api/logging/export/action-logs?token=${getToken()}`, '_blank');
  },

  exportSensorData: () => {
    window.open(`${BASE_URL}/api/logging/export/sensor-data?token=${getToken()}`, '_blank');
  },
};

// ── AI Disease Detection (UC_AI) ──────────────────────────────────────────────
export const aiApi = {
  // UC_AI_1/2: Phân tích bệnh lá
  predictDisease: async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/ai/predict-disease`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return handleResponse(res);
  },

  // F-FARMER-5: Xem lịch sử phân tích
  getDiseaseHistory: (limit = 20) =>
    fetch(`${BASE_URL}/api/ai/disease-history?limit=${limit}`, {
      headers: authHeaders(),
    }).then(handleResponse),

  // F-ADMIN-3: Update AI Model
  updateModel: async (modelFile) => {
    const formData = new FormData();
    formData.append('file', modelFile);
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/ai/update-model`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return handleResponse(res);
  },
};

// ── ML Watering Prediction (UC_ML) ────────────────────────────────────────────
export const mlApi = {
  // UC_ML_1: Auto-fill sensor data
  getSensorsForPredict: () =>
    fetch(`${BASE_URL}/api/ml/sensors-for-predict`, { headers: authHeaders() }).then(handleResponse),

  // UC_ML_2: Dự đoán lượng nước tưới
  predictWatering: (formData) =>
    fetch(`${BASE_URL}/api/ml/predict-watering`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(formData),
    }).then(handleResponse),

  // F-FARMER-6: Xem lịch sử dự đoán
  getWateringHistory: (limit = 20) =>
    fetch(`${BASE_URL}/api/ml/watering-history?limit=${limit}`, {
      headers: authHeaders(),
    }).then(handleResponse),

  // F-ADMIN-3: Update ML Model
  updateModel: async (modelFile) => {
    const formData = new FormData();
    formData.append('file', modelFile);
    const token = getToken();
    const res = await fetch(`${BASE_URL}/api/ml/update-model`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    return handleResponse(res);
  },
};

// ── System (F-ADMIN-5, F-ADMIN-6) ─────────────────────────────────────────────
export const systemApi = {
  getSystemLogs: (lines = 100) =>
    fetch(`${BASE_URL}/api/logging/system-logs?lines=${lines}`, { headers: authHeaders() }).then(handleResponse),

  getBackupDbUrl: () => `${BASE_URL}/api/logging/backup-db?token=${getToken()}`
};

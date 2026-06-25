/**
 * Prison Management System API Service
 * ====================================
 * Centralized API client for Django REST Framework backend integration.
 * Handles authentication, error management, and type-safe responses.
 */

import { getRoleDisplayName, normalizeRole } from "./auth";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000') + '/api';

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

interface LoginRequest {
  username: string; // Service number for officers, username for superusers
  password: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  role: string;
  role_name: string;
  station_id: number;
  station_code: string;
  station_name: string;
  user_id: number;
  username: string;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number;
  role_name: string;
  role_code: string;
  station: number;
  station_name: string;
  station_code: string;
}

interface RoleOption {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
}

interface OfficerOption {
  service_number: string;
  full_name: string;
  first_name: string;
  surname: string;
  other_names?: string | null;
  current_status: string;
  current_station_id?: number | null;
  current_station_code?: string | null;
  current_station_name?: string | null;
}

interface ManagedUserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  officer: string | null;
  officer_service_number: string | null;
  officer_name: string | null;
  role: number;
  role_name: string;
  role_code: string;
  station: number;
  station_name: string;
  station_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Enhanced fetch function with comprehensive error handling
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  try {
    const token = localStorage.getItem("auth_token");

    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    // Normalize endpoint: if caller passed a path starting with '/api',
    // strip the leading '/api' so we don't end up with '/api/api/...'
    let endpointNormalized = endpoint;
    if (endpointNormalized.startsWith('/api/')) {
      endpointNormalized = endpointNormalized.replace(/^\/api/, '');
    }

    let url = endpoint.startsWith("http")
      ? endpoint
      : `${API_BASE_URL}${endpointNormalized}`;

    // Defensive: collapse accidental duplicate '/api/api/' inserted by config or caller
    url = url.replace(/\/api\/api\//g, '/api/');

    // If body is FormData, let the browser set Content-Type (multipart boundary).
    const fetchOptions: RequestInit = { ...options };
    if (options.body instanceof FormData) {
      // Remove any Content-Type header so browser sets the correct multipart boundary
      const safeHeaders = { ...(headers || {}) };
      if (safeHeaders['Content-Type']) delete safeHeaders['Content-Type'];
      fetchOptions.headers = safeHeaders;
    } else {
      // Ensure JSON content-type when body is not FormData and no explicit header provided
      fetchOptions.headers = { 'Content-Type': 'application/json', ...(headers || {}) };
    }

    const response = await fetch(url, fetchOptions);

    // Handle different response types
    if (response.status === 204) {
      return { data: undefined as unknown as T, status: response.status };
    }

    let responseData: any;

    try {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (parseError) {
      return {
        error: "Invalid response format from server",
        status: response.status,
      };
    }

    if (!response.ok) {
      // Extract error message from Django REST Framework response
      let errorMessage = "An error occurred";

      if (typeof responseData === "object") {
        if (responseData.detail) {
          errorMessage = responseData.detail;
        } else if (
          responseData.non_field_errors &&
          responseData.non_field_errors.length > 0
        ) {
          errorMessage = responseData.non_field_errors[0];
        } else if (
          responseData.username &&
          Array.isArray(responseData.username)
        ) {
          errorMessage = `Service number: ${responseData.username[0]}`;
        } else if (
          responseData.password &&
          Array.isArray(responseData.password)
        ) {
          errorMessage = `Password: ${responseData.password[0]}`;
        } else {
          // Generic field errors
          const fieldErrors = Object.entries(responseData)
            .filter(([key, value]) => Array.isArray(value))
            .map(([key, value]) => `${key}: ${(value as string[])[0]}`)
            .join(", ");
          if (fieldErrors) {
            errorMessage = fieldErrors;
          }
        }
      } else if (typeof responseData === "string") {
        errorMessage = responseData;
      }

      return {
        error: errorMessage,
        status: response.status,
      };
    }

    return {
      data: responseData as T,
      status: response.status,
    };
  } catch (error) {
    console.error("API request failed:", error);

    // Network or connection errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return {
        error:
          "Unable to connect to the server. Please check your internet connection and try again.",
      };
    }

    return {
      error:
        error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

// Wrapper function for API calls (for backward compatibility)
async function fetchApi(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<any>> {
  return apiRequest(endpoint, options);
}

// ==================================================
// AUTHENTICATION API ENDPOINTS
// ==================================================
export const authApi = {
  /**
   * Login with service number and password
   * @param serviceNumber - Officer service number (e.g., 2934823Z)
   * @param password - User password
   * @returns Login response with tokens and user info
   */
  login: async (
    serviceNumber: string,
    password: string,
  ): Promise<ApiResponse<LoginResponse>> => {
    // Validate service number format
    const serviceNumberRegex = /^[0-9]{7}[A-Z]$/;
    if (!serviceNumberRegex.test(serviceNumber)) {
      return {
        error:
          "Invalid service number format. Must be 7 digits followed by a letter (e.g., 2934823Z)",
      };
    }

    if (!password || password.length < 1) {
      return {
        error: "Password is required",
      };
    }

    const loginData: LoginRequest = {
      username: serviceNumber, // Backend expects 'username' field
      password: password,
    };

    const response = await apiRequest<LoginResponse>("/auth/login/", {
      method: "POST",
      body: JSON.stringify(loginData),
    });

    if (response.data) {
      const normalizedRole = normalizeRole(response.data.role);

      // Store tokens securely
      localStorage.setItem("auth_token", response.data.access);
      localStorage.setItem("refresh_token", response.data.refresh);
      localStorage.setItem("user_role", normalizedRole);

      // Backend may return either station_* (legacy UserProfile) or org_unit_* (UserAssignment)
      // Persist both shapes so frontend can use whichever is available.
      if (response.data.station_id) {
        localStorage.setItem("station_id", response.data.station_id.toString());
        localStorage.setItem("station_code", response.data.station_code);
        localStorage.setItem("station_name", response.data.station_name);
      }
      if ((response.data as any).org_unit_id) {
        localStorage.setItem("org_unit_id", String((response.data as any).org_unit_id));
        localStorage.setItem("org_unit_code", String((response.data as any).org_unit_code));
        localStorage.setItem("org_unit_name", String((response.data as any).org_unit_name));
      }

      // Store user info for UI (prefer org_unit when present)
      const userInfo = {
        id: response.data.user_id,
        username: response.data.username,
        role: normalizedRole,
        roleName: response.data.role_name || getRoleDisplayName(normalizedRole),
        org_unit: (response.data as any).org_unit_id
          ? {
              id: (response.data as any).org_unit_id,
              code: (response.data as any).org_unit_code,
              name: (response.data as any).org_unit_name,
            }
          : undefined,
        station: response.data.station_id
          ? {
              id: response.data.station_id,
              code: response.data.station_code,
              name: response.data.station_name,
            }
          : undefined,
      };
      localStorage.setItem("user_info", JSON.stringify(userInfo));
    }

    return response;
  },

  /**
   * Logout and clear stored authentication data
   */
  logout: async (): Promise<ApiResponse<boolean>> => {
    try {
      // Call backend logout (optional, client-side cleanup is primary)
      await apiRequest("/auth/logout/", { method: "POST" });
    } catch (error) {
      // Ignore logout API errors, proceed with client cleanup
      console.warn("Backend logout failed, proceeding with client cleanup");
    }

    // Clear all stored authentication data
    localStorage.removeItem("auth_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("station_id");
    localStorage.removeItem("station_code");
    localStorage.removeItem("station_name");
    localStorage.removeItem("user_info");

    return { data: true };
  },

  /**
   * Get current user profile
   */
  getCurrentUser: async (): Promise<ApiResponse<UserProfile>> => {
    return apiRequest<UserProfile>("/auth/me/");
  },

  getUsers: async (): Promise<ApiResponse<ManagedUserProfile[]>> => {
    return apiRequest<ManagedUserProfile[]>("/auth/users/");
  },

  getUserCreationOptions: async (): Promise<ApiResponse<{ officers: OfficerOption[]; roles: RoleOption[] }>> => {
    return apiRequest<{ officers: OfficerOption[]; roles: RoleOption[] }>("/auth/users/create-options/");
  },

  createUserFromOfficer: async (payload: {
    officer: string;
    role: number;
    password: string;
    email?: string;
    is_active?: boolean;
  }): Promise<ApiResponse<ManagedUserProfile>> => {
    return apiRequest<ManagedUserProfile>("/auth/users/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Update system user status (Activate/Deactivate)
   */
  updateUserStatus: async (
    userId: number,
    isActive: boolean
  ): Promise<ApiResponse<ManagedUserProfile>> => {
    return apiRequest<ManagedUserProfile>(`/auth/users/${userId}/`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  /**
   * Refresh access token
   */
  refreshToken: async (): Promise<ApiResponse<{ access: string }>> => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      return { error: "No refresh token available" };
    }

    const response = await apiRequest<{ access: string }>(
      "/auth/token/refresh/",
      {
        method: "POST",
        body: JSON.stringify({ refresh: refreshToken }),
      },
    );

    if (response.data) {
      localStorage.setItem("auth_token", response.data.access);
    }

    return response;
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated: (): boolean => {
    const token = localStorage.getItem("auth_token");
    return !!token;
  },

  /**
   * Get stored user role
   */
  getUserRole: (): string | null => {
    return localStorage.getItem("user_role");
  },

  /**
   * Get stored station info
   */
  getStationInfo: () => {
    return {
      id: localStorage.getItem("station_id"),
      code: localStorage.getItem("station_code"),
      name: localStorage.getItem("station_name"),
    };
  },
};

// Admin actions for NHQ/PHQ/Station workflows
export const adminActionsApi = {
  createPHQ: async (payload: { name: string; code: string; code_short: string }) => {
    return apiRequest('/auth/admin-actions/phq/', { method: 'POST', body: JSON.stringify(payload) });
  },
  createStation: async (payload: { name: string; code: string; code_short: string; parent?: number }) => {
    return apiRequest('/auth/admin-actions/station/', { method: 'POST', body: JSON.stringify(payload) });
  },
  createOrgAdmin: async (orgId: number, payload: { officer: number; role: number; password: string; email?: string }) => {
    return apiRequest(`/auth/admin-actions/${orgId}/create_admin/`, { method: 'POST', body: JSON.stringify(payload) });
  },
};

// ==================================================
// HUMAN RESOURCES API ENDPOINTS
// ==================================================
export const hrApi = {
  /**
   * Get all officers in the HR system
   */
  getOfficers: async (): Promise<ApiResponse<any[]>> => {
    const response = await apiRequest<any>("/hr/officers/", {
      method: "GET",
    });
    if (response.data && response.data.results) {
        response.data = response.data.results;
    }
    return response;
  },

  /**
   * Create a new officer in the HR system
   */
  createOfficer: async (payload: any): Promise<ApiResponse<any>> => {
    return apiRequest<any>("/hr/officers/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};

// Admin API endpoints
export const adminApi = {
  // Officer management
  getOfficers: async () => {
    return fetchApi("/admin/officers");
  },

  createOfficer: async (officerData: any) => {
    return fetchApi("/admin/officers", {
      method: "POST",
      body: JSON.stringify(officerData),
    });
  },

  updateOfficer: async (id: string, officerData: any) => {
    return fetchApi(`/admin/officers/${id}`, {
      method: "PUT",
      body: JSON.stringify(officerData),
    });
  },

  deleteOfficer: async (id: string) => {
    return fetchApi(`/admin/officers/${id}`, {
      method: "DELETE",
    });
  },

  // Inmate management
  getAllInmates: async () => {
    return fetchApi("/reception/inmate-list/");
  },

  approveInmate: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/approve_admission/`, {
      method: "POST",
    });
  },

  dischargeInmate: async (id: string, reason: string) => {
    return fetchApi(`/admin/inmates/${id}/discharge`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },

  transferInmate: async (id: string, destination: string) => {
    return fetchApi(`/admin/inmates/${id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ destination }),
    });
  },

  classifyInmate: async (id: string, classification: string) => {
    return fetchApi(`/admin/inmates/${id}/classify`, {
      method: "POST",
      body: JSON.stringify({ classification }),
    });
  },
};

// Messaging API helpers
export const messagingApi = {
  listMailboxes: async () => {
    return apiRequest('/messaging/mailboxes/');
  },
  listThreads: async () => {
    return apiRequest('/messaging/threads/');
  },
  getThread: async (id: number) => {
    return apiRequest(`/messaging/threads/${id}/`);
  },
  /**
   * Get unread messages count.
   * Tries a dedicated endpoint first, falls back to scanning threads responses.
   */
  getUnreadCount: async (): Promise<ApiResponse<number>> => {
    try {
      const res = await apiRequest('/messaging/unread_count/');
      if (res.data && typeof res.data === 'object') {
        const n = (res.data as any).count ?? (res.data as any).unread_count;
        if (typeof n === 'number') return { data: n, status: res.status };
      }

      // Fallback: fetch threads and compute a heuristic unread count
      const threadsRes = await apiRequest('/messaging/threads/');
      if (threadsRes.data) {
        const payload: any = threadsRes.data;
        const items = Array.isArray(payload) ? payload : payload.results || [];
        const unread = items.reduce((acc: number, t: any) => {
          if (typeof t.unread_count === 'number') return acc + (t.unread_count || 0);
          if (t.unread === true) return acc + 1;
          return acc;
        }, 0);
        return { data: unread };
      }
    } catch (e) {
      console.warn('Failed to fetch unread count', e);
    }

    return { data: 0 };
  },
    createThread: async (payload: any) => {
      // Accept FormData (for attachments) or plain JSON payloads
      if (payload instanceof FormData) {
        return apiRequest('/messaging/threads/', { method: 'POST', body: payload });
      }
      return apiRequest('/messaging/threads/', { method: 'POST', body: JSON.stringify(payload) });
    },
    createMessage: async (payload: any) => {
      if (payload instanceof FormData) {
        return apiRequest('/messaging/messages/', { method: 'POST', body: payload });
      }
      return apiRequest('/messaging/messages/', { method: 'POST', body: JSON.stringify(payload) });
    },
  markThreadRead: async (id: number) => {
    return apiRequest(`/messaging/threads/${id}/mark_read/`, { method: 'POST' });
  },
};

// Reception API endpoints
export const receptionApi = {
  registerBasicInmate: async (inmateData: any) => {
    console.log("=== FRONTEND: Sending basic inmate registration data ===");
    console.log("Inmate data structure:", Object.keys(inmateData));
    console.log("Inmate details:", inmateData.inmateDetails);
    console.log("Next of kin:", inmateData.nextOfKin);
    console.log("Full data:", inmateData);

    const result = await fetchApi("/reception/register/", {
      method: "POST",
      body: JSON.stringify(inmateData),
    });

    console.log("=== FRONTEND: Basic registration response ===");
    console.log("Response:", result);

    return result;
  },

  registerOffences: async (offenceData: any) => {
    console.log("=== FRONTEND: Sending offence registration data ===");
    console.log("Offence data structure:", Object.keys(offenceData));
    console.log("Inmate ID:", offenceData.inmate_id);
    console.log("Offences count:", offenceData.offences?.length || 0);
    console.log("Full data:", offenceData);

    const result = await fetchApi("/reception/register-offences/", {
      method: "POST",
      body: JSON.stringify(offenceData),
    });

    console.log("=== FRONTEND: Offence registration response ===");
    console.log("Response:", result);

    return result;
  },

  // Keep the old function for backward compatibility
  registerInmate: async (inmateData: any) => {
    console.log("=== FRONTEND: Sending inmate registration data ===");
    console.log("Inmate data structure:", Object.keys(inmateData));
    console.log("Inmate details:", inmateData.inmateDetails);
    console.log("Next of kin:", inmateData.nextOfKin);
    console.log("Offences count:", inmateData.offences?.length || 0);
    console.log("Restitutions count:", inmateData.restitutions?.length || 0);
    console.log("Full data:", inmateData);

    const result = await fetchApi("/reception/register/", {
      method: "POST",
      body: JSON.stringify(inmateData),
    });

    console.log("=== FRONTEND: Registration response ===");
    console.log("Response:", result);

    return result;
  },

  getPendingApprovalInmates: async () => {
    return fetchApi("/reception/pending-approval");
  },

  getPendingOffenceInmates: async () => {
    return fetchApi("/reception/pending-offences");
  },

  getInmate: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/`);
  },

  registerValuables: async (id: string, valuablesData: any) => {
    return fetchApi(`/reception/inmates/${id}/valuables`, {
      method: "POST",
      body: JSON.stringify(valuablesData),
    });
  },

  updateInmate: async (id: string, inmateData: any) => {
    return fetchApi(`/reception/inmates/${id}/`, {
      method: "PUT",
      body: JSON.stringify(inmateData),
    });
  },

  getInmateList: async (searchTerm?: string, filters?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (searchTerm) {
      params.append('search', searchTerm);
    }
    if (filters) {
      for (const key in filters) {
        if (filters[key]) {
          params.append(key, filters[key]);
        }
      }
    }
    return fetchApi(`/reception/inmate-list/?${params.toString()}`);
  },
  approveDischarge: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/approve_discharge/`, {
      method: 'POST',
    });
  },
};

// Health API endpoints
export const healthApi = {
  getInmateHealthRecord: async (id: string) => {
    return fetchApi(`/health/inmates/${id}/`);
  },

  createHealthRecord: async (id: string, healthData: any) => {
    return fetchApi(`/health/inmates/${id}/`, {
      method: "POST",
      body: JSON.stringify(healthData),
    });
  },

  updateHealthRecord: async (id: string, healthData: any) => {
    return fetchApi(`/health/inmates/${id}/`, {
      method: "PUT",
      body: JSON.stringify(healthData),
    });
  },

  registerOPDVisit: async (id: string, visitData: any) => {
    return fetchApi(`/health/inmates/${id}/opd/`, {
      method: "POST",
      body: JSON.stringify(visitData),
    });
  },

  getOPDRecords: async (id: string) => {
    return fetchApi(`/health/inmates/${id}/opd/`);
  },

  getHealthStatistics: async () => {
    return fetchApi("/health/statistics");
  },
};

// Shared inmate API endpoints
export const inmateApi = {
  searchInmates: async (query: string) => {
    return fetchApi(`/reception/inmate-list/?search=${encodeURIComponent(query)}`);
  },

  getInmateDetails: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/`);
  },

  getInmateOffenses: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/offenses/`);
  },

  getInmateTimeline: async (id: string) => {
    return fetchApi(`/reception/inmates/${id}/timeline/`);
  },
};

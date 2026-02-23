import axios from 'axios'

// Empty string = relative URL → goes through Vite proxy (/api → http://localhost:8000)
// Set VITE_API_URL in .env for production deployments pointing to a real domain
const API_URL = import.meta.env.VITE_API_URL || ''

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// ─── Request interceptor ────────────────────────────────────────────────────
// Read the token DIRECTLY from localStorage on every request so it's available
// even in the brief window before Zustand has rehydrated on the first render.
api.interceptors.request.use(
  (config) => {
    try {
      const stored = localStorage.getItem('auth-storage')
      if (stored) {
        const token = JSON.parse(stored)?.state?.token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    } catch (_) {}

    // Guest fallback — candidate joining via email link
    if (!config.headers.Authorization) {
      const guestToken = sessionStorage.getItem('guest-token')
      if (guestToken) {
        config.headers.Authorization = `Bearer ${guestToken}`
      }
    }

    return config
  },
  (error) => Promise.reject(error)
)

// ─── Response interceptor ───────────────────────────────────────────────────
// Uses a refresh-queue pattern so that when multiple requests fire at once
// and all get 401, only ONE refresh call is made and the rest wait for it.

let _isRefreshing = false
let _refreshQueue = []

function processQueue(error, token = null) {
  _refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  _refreshQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Only intercept 401 — 403 is a real permission error, let it bubble
    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    // Already retried once — don't loop
    if (originalRequest._retry) {
      return Promise.reject(error)
    }

    // ── Case 1: Request fired WITHOUT a token (page-load race condition) ──
    // Don't refresh — just re-attach the current token and retry once.
    if (!originalRequest.headers?.Authorization) {
      originalRequest._retry = true
      try {
        const stored = localStorage.getItem('auth-storage')
        const token = stored ? JSON.parse(stored)?.state?.token : null
        if (token) {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }
      } catch (_) {}
      // Genuinely no token → redirect to login (don't wipe storage)
      redirectToLogin()
      return Promise.reject(error)
    }

    // ── Case 2: Token WAS sent but got 401 → it's expired → refresh ──
    originalRequest._retry = true

    if (_isRefreshing) {
      // Another refresh is already in flight — queue this request
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject })
      })
        .then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        })
        .catch((err) => Promise.reject(err))
    }

    _isRefreshing = true

    try {
      const stored = localStorage.getItem('auth-storage')
      const state = stored ? JSON.parse(stored)?.state : null

      if (!state?.refreshToken) {
        processQueue(new Error('No refresh token'), null)
        redirectToLogin()
        return Promise.reject(error)
      }

      const resp = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
        refresh_token: state.refreshToken,
      })
      const { access_token } = resp.data

      // Persist new access token (leave everything else intact)
      state.token = access_token
      localStorage.setItem('auth-storage', JSON.stringify({ state, version: 0 }))
      api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

      processQueue(null, access_token)
      originalRequest.headers.Authorization = `Bearer ${access_token}`
      return api(originalRequest)
    } catch (refreshError) {
      processQueue(refreshError, null)
      // Refresh failed → redirect to login but do NOT wipe localStorage so the
      // user can log back in without losing persisted app state.
      redirectToLogin()
      return Promise.reject(refreshError)
    } finally {
      _isRefreshing = false
    }
  }
)

// ─── Helper ─────────────────────────────────────────────────────────────────
function redirectToLogin() {
  // Guest sessions on interview pages should stay on their page
  if (
    window.location.pathname.startsWith('/interview/') &&
    sessionStorage.getItem('guest-token')
  ) {
    return
  }
  if (window.location.pathname !== '/login') {
    window.location.href = '/login?session_expired=true'
  }
}

export default api

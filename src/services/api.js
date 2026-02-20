import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    let token = null

    // 1. Prefer registered-user token from localStorage (Zustand persist)
    const authStorage = localStorage.getItem('auth-storage')
    if (authStorage) {
      try {
        const { state } = JSON.parse(authStorage)
        if (state?.token) {
          token = state.token
          console.log('🔑 Adding token to request:', {
            url: config.url,
            tokenLength: token.length,
            tokenStart: token.substring(0, 30),
            headers: config.headers
          })
        } else {
          console.warn('⚠️ No token found in auth storage state')
        }
      } catch (error) {
        console.error('❌ Error parsing auth storage:', error)
      }
    } else {
      console.warn('⚠️ No auth-storage in localStorage')
    }

    // 2. Fall back to guest token (anonymous candidate joining via email link)
    if (!token) {
      const guestToken = sessionStorage.getItem('guest-token')
      if (guestToken) {
        token = guestToken
        console.log('🎫 Using guest token for request:', config.url)
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Handle 401 errors (unauthorized)
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Try to refresh token
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          if (state?.refreshToken) {
            const response = await axios.post(`${API_URL}/api/v1/auth/refresh`, {
              refresh_token: state.refreshToken,
            })

            const { access_token } = response.data

            // Update token in storage
            state.token = access_token
            localStorage.setItem(
              'auth-storage',
              JSON.stringify({ state, version: 0 })
            )

            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${access_token}`
            return api(originalRequest)
          }
        }
        
        // No refresh token available, logout
        console.warn('No refresh token available, logging out...')
        handleAuthError()
      } catch (refreshError) {
        // Refresh failed, clear auth and redirect to login
        console.error('Token refresh failed, logging out...', refreshError)
        handleAuthError()
        return Promise.reject(refreshError)
      }
    }

    // Handle 403 (forbidden) - also means token is invalid or expired
    if (error.response?.status === 403) {
      console.warn('Forbidden access, checking authentication...')
      const authStorage = localStorage.getItem('auth-storage')
      if (!authStorage || !JSON.parse(authStorage)?.state?.token) {
        handleAuthError()
      }
    }

    return Promise.reject(error)
  }
)

// Helper function to handle authentication errors
function handleAuthError() {
  // If this is a guest session on an interview page, don't redirect to login
  if (window.location.pathname.startsWith('/interview/') && sessionStorage.getItem('guest-token')) {
    console.warn('Guest session expired or invalid — staying on interview page')
    return
  }

  // Clear all auth data
  localStorage.removeItem('auth-storage')
  sessionStorage.clear()
  
  // Clear any tokens from axios defaults
  delete api.defaults.headers.common['Authorization']
  
  // Show a message
  console.warn('Session expired. Please log in again.')
  
  // Redirect to login (only if not already there)
  if (window.location.pathname !== '/login') {
    window.location.href = '/login?session_expired=true'
  }
}

export default api

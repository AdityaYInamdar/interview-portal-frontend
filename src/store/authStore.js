import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Login
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { access_token, refresh_token, user } = response.data

          // Set tokens in API client
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

          set({
            user,
            token: access_token,
            refreshToken: refresh_token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          })

          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 'Login failed'
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      // Register
      register: async (userData) => {
        set({ isLoading: true, error: null })
        try {
          await api.post('/auth/register', userData)
          set({ isLoading: false, error: null })
          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 'Registration failed'
          set({ isLoading: false, error: errorMessage })
          return { success: false, error: errorMessage }
        }
      },

      // Logout
      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          // Clear auth state
          set({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            error: null,
          })

          // Clear token from API client
          delete api.defaults.headers.common['Authorization']

          // Clear from localStorage
          localStorage.removeItem('auth-storage')
        }
      },

      // Refresh token
      refreshAccessToken: async () => {
        const refreshToken = get().refreshToken
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        try {
          const response = await api.post('/auth/refresh', {
            refresh_token: refreshToken,
          })
          const { access_token, refresh_token: newRefreshToken, user } = response.data

          // Update tokens
          api.defaults.headers.common['Authorization'] = `Bearer ${access_token}`

          set({
            token: access_token,
            refreshToken: newRefreshToken,
            user,
          })

          return access_token
        } catch (error) {
          // Refresh failed, logout user
          get().logout()
          throw error
        }
      },

      // Get current user
      getCurrentUser: async () => {
        try {
          const response = await api.get('/auth/me')
          set({ user: response.data })
          return response.data
        } catch (error) {
          console.error('Get current user error:', error)
          return null
        }
      },

      // Update user profile
      updateProfile: async (userData) => {
        try {
          const response = await api.patch('/users/me', userData)
          set({ user: response.data })
          return { success: true, data: response.data }
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 'Update failed'
          return { success: false, error: errorMessage }
        }
      },

      // Change password
      changePassword: async (currentPassword, newPassword) => {
        try {
          await api.post('/auth/change-password', {
            current_password: currentPassword,
            new_password: newPassword,
          })
          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 'Password change failed'
          return { success: false, error: errorMessage }
        }
      },

      // Request password reset
      requestPasswordReset: async (email) => {
        try {
          await api.post('/auth/forgot-password', { email })
          return { success: true }
        } catch (error) {
          const errorMessage = error.response?.data?.detail || 'Password reset request failed'
          return { success: false, error: errorMessage }
        }
      },

      // Initialize auth from storage
      initialize: () => {
        const token = get().token
        if (token) {
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`
          get().getCurrentUser()
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)

// Initialize auth on app start
useAuthStore.getState().initialize()

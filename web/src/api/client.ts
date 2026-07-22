import createClient from 'openapi-fetch'
import type { paths } from './schema'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5141'

export const apiClient = createClient<paths>({
  baseUrl: apiBaseUrl,
  credentials: 'include',
})


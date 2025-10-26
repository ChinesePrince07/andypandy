import { $fetch } from 'ofetch'

const baseURL = import.meta.env.VITE_CORE_API_BASE?.replace(/\/$/, '') || '/api'

export const coreApi = $fetch.create({
  baseURL,
  credentials: 'include',
})

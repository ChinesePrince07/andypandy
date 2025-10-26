import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FetchError } from 'ofetch'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

import type { SessionResponse } from '~/modules/auth/api/session'
import {
  AUTH_SESSION_QUERY_KEY,
  fetchSession,
} from '~/modules/auth/api/session'
import { getOnboardingStatus } from '~/modules/onboarding/api'

const ONBOARDING_STATUS_QUERY_KEY = ['onboarding', 'status'] as const

const DEFAULT_LOGIN_PATH = '/login'
const DEFAULT_ONBOARDING_PATH = '/onboarding'
const DEFAULT_AUTHENTICATED_PATH = '/'

const AUTH_FAILURE_STATUSES = new Set([401, 403, 419])

export const usePageRedirect = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const sessionQuery = useQuery<SessionResponse | null>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        return await fetchSession()
      } catch (error) {
        if (error instanceof FetchError) {
          const status = error.statusCode ?? error.response?.status ?? null
          if (status && AUTH_FAILURE_STATUSES.has(status)) {
            return null
          }
        }
        throw error
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const onboardingQuery = useQuery({
    queryKey: ONBOARDING_STATUS_QUERY_KEY,
    queryFn: getOnboardingStatus,
    staleTime: Infinity,
  })

  useEffect(() => {
    return () => {
      queryClient.cancelQueries({ queryKey: AUTH_SESSION_QUERY_KEY })
    }
  }, [queryClient])

  useEffect(() => {
    if (sessionQuery.isPending || onboardingQuery.isPending) {
      return
    }

    if (sessionQuery.isError || onboardingQuery.isError) {
      return
    }

    const { pathname } = location
    const session = sessionQuery.data
    const onboardingInitialized = onboardingQuery.data?.initialized ?? false

    if (!onboardingInitialized) {
      if (pathname !== DEFAULT_ONBOARDING_PATH) {
        navigate(DEFAULT_ONBOARDING_PATH, { replace: true })
      }
      return
    }

    if (!session) {
      if (pathname !== DEFAULT_LOGIN_PATH) {
        navigate(DEFAULT_LOGIN_PATH, { replace: true })
      }
      return
    }

    if (pathname === DEFAULT_LOGIN_PATH) {
      navigate(DEFAULT_AUTHENTICATED_PATH, { replace: true })
    }
  }, [
    location,
    location.pathname,
    navigate,
    onboardingQuery.data,
    onboardingQuery.isError,
    onboardingQuery.isPending,
    sessionQuery.data,
    sessionQuery.isError,
    sessionQuery.isPending,
  ])

  return {
    sessionQuery,
    onboardingQuery,
  }
}

import { Button, Input, Label } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'
import { useState } from 'react'

import { useLogin } from '~/modules/auth/hooks/useLogin'
import { LinearBorderContainer } from '~/modules/onboarding/components/LinearBorderContainer'

export const Component = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useLogin()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!email.trim() || !password.trim()) {
      return
    }

    login({ email: email.trim(), password })
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    if (error) clearError()
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    if (error) clearError()
  }

  return (
    <div className="relative flex min-h-dvh flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center bg-background">
        <LinearBorderContainer>
          <form
            onSubmit={handleSubmit}
            className="relative w-[600px] bg-background-tertiary"
          >
            <div className="p-12">
              <h1 className="mb-10 text-3xl font-bold text-text">Login</h1>

              {/* Error Message */}
              {error && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={Spring.presets.snappy}
                  className="mb-6 rounded-lg border border-red/60 bg-red/10 px-4 py-3"
                >
                  <p className="text-sm text-red">{error}</p>
                </m.div>
              )}

              {/* Email Field */}
              <div className="mb-6 space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isLoading}
                  error={!!error}
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {/* Password Field */}
              <div className="mb-8 space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={isLoading}
                  error={!!error}
                  autoComplete="current-password"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isLoading || !email.trim() || !password.trim()}
                className="w-full rounded-lg px-6 py-2.5 text-sm font-medium"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>

              {/* Additional Links */}
              <div className="mt-6 flex items-center justify-between text-sm">
                <button
                  type="button"
                  className="text-text-tertiary transition-colors duration-200 hover:text-accent"
                  disabled={isLoading}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  className="text-text-tertiary transition-colors duration-200 hover:text-accent"
                  disabled={isLoading}
                >
                  Create account
                </button>
              </div>
            </div>
          </form>
        </LinearBorderContainer>
      </div>
    </div>
  )
}

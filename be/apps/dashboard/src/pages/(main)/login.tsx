import { Button, Input, Label } from '@afilmory/ui'

import { LinearBorderContainer } from '~/modules/onboarding/components/LinearBorderContainer'

export const Component = () => {
  return (
    <div className="size-full min-h-dvh flex-1 relative flex flex-col">
      <div className="bg-background flex-1 flex items-center justify-center">
        <LinearBorderContainer>
          <form className="relative w-[600px] bg-background-tertiary">
            <div className="p-12">
              <h1 className="text-3xl font-bold mb-10 text-text-primary">
                Login
              </h1>

              {/* Username Field */}
              <div className="mb-6 space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  className="rounded"
                />
              </div>

              {/* Password Field */}
              <div className="mb-8 space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  className="rounded"
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full rounded px-6 py-2.5 bg-accent text-white font-medium text-sm transition-all duration-200 hover:bg-accent/90 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-accent/40"
              >
                Sign In
              </Button>

              {/* Additional Links */}
              <div className="mt-6 flex items-center justify-between text-sm">
                <a
                  href="#"
                  className="text-text-tertiary hover:text-accent transition-colors duration-200"
                >
                  Forgot password?
                </a>
                <a
                  href="#"
                  className="text-text-tertiary hover:text-accent transition-colors duration-200"
                >
                  Create account
                </a>
              </div>
            </div>
          </form>
        </LinearBorderContainer>
      </div>
    </div>
  )
}

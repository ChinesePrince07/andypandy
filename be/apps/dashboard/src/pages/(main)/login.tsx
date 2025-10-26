import { clsxm } from '@afilmory/utils'

export const Component = () => (
  <div
    data-theme="dark"
    className="size-full min-h-dvh flex-1 relative flex flex-col"
  >
    <div className="bg-background flex-1 flex items-center justify-center">
      <form className={'w-[600px] bg-background-tertiary'}>
        {/* Linear gradient border y axis (left) */}
        <div className="absolute top-0 bg-linear-to-b from-transparent via-text to-transparent w-[0.5px] bottom-0" />

        {/* Linear gradient border x axis (top) */}
        <div className="absolute left-0 bg-linear-to-r from-transparent via-text to-transparent h-[0.5px] right-0" />

        <div className="p-12">
          <h1 className="text-3xl font-bold mb-10 text-text-primary">Login</h1>

          {/* Username Field */}
          <div className="mb-6">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-text mb-2"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              className={clsxm(
                'w-full rounded-xl border border-fill-tertiary bg-background',
                'px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70',
                'focus:outline-none focus:ring-2 focus:ring-accent/40',
                'transition-all duration-200',
              )}
              placeholder="Enter your username"
            />
          </div>

          {/* Password Field */}
          <div className="mb-8">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text mb-2"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className={clsxm(
                'w-full rounded-xl border border-fill-tertiary bg-background',
                'px-3 py-2 text-sm text-text placeholder:text-text-tertiary/70',
                'focus:outline-none focus:ring-2 focus:ring-accent/40',
                'transition-all duration-200',
              )}
              placeholder="Enter your password"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className={clsxm(
              'w-full rounded-xl px-6 py-2.5 relative overflow-hidden',
              'bg-accent text-white font-medium text-sm',
              'transition-all duration-200',
              'hover:bg-accent/90',
              'active:scale-[0.98]',
              'focus:outline-none focus:ring-2 focus:ring-accent/40',
            )}
          >
            Sign In
          </button>

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
        {/* Linear gradient border x axis (bottom) */}
        <div className="absolute left-0 bg-linear-to-r from-transparent via-text to-transparent h-[0.5px] right-0" />
      </form>
      <div>
        {/* Linear gradient border y axis (right) */}
        <div className="absolute top-0 bg-linear-to-b from-transparent via-text to-transparent w-[0.5px] bottom-0" />
      </div>
    </div>
  </div>
)

import { Input, Label, Textarea } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { m } from 'motion/react'

export const Component = () => {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={Spring.presets.smooth}
      className="space-y-6"
    >
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure your account and application preferences
        </p>
      </div>

      {/* Settings Form */}
      <div className="max-w-2xl space-y-4">
        {/* Profile Section */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-5 text-sm font-semibold text-text">
            Profile Settings
          </h2>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                type="text"
                placeholder="Enter your display name"
                defaultValue="John Doe"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                defaultValue="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                rows={3}
                placeholder="Tell us about yourself..."
                defaultValue="Photo enthusiast and traveler"
              />
            </div>
          </div>
        </div>

        {/* Preferences Section */}
        <div className="rounded-lg border border-border/50 bg-background-tertiary p-5">
          <h2 className="mb-5 text-sm font-semibold text-text">Preferences</h2>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <Input id="language" type="text" defaultValue="English" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" type="text" defaultValue="UTC-5" />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-text-secondary transition-all duration-150 hover:bg-fill/30 hover:text-text"
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-1.5 text-[13px] font-medium text-white transition-all duration-150 hover:bg-accent/90"
          >
            Save Changes
          </button>
        </div>
      </div>
    </m.div>
  )
}

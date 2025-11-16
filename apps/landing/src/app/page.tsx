'use client'

import {
  ArtistNote,
  ClosingCTA,
  GalleryPreview,
  JourneySection,
  NocturneHero,
  PillarsSection,
} from '~/components/landing/NocturneSections'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020202] text-white">
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6 lg:px-0">
        <NocturneHero />
        <PillarsSection />
        <JourneySection />
        <GalleryPreview />
        <ArtistNote />
        <ClosingCTA />
      </main>
    </div>
  )
}

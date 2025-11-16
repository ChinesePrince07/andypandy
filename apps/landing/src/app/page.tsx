'use client'

import { NocturneBackground } from '~/components/landing/NocturneBackground'
import {
  ArtistNote,
  ClosingCTA,
  GalleryPreview,
  JourneySection,
  NocturneHero,
  PillarsSection,
} from '~/components/landing/NocturneSections'
import { Footer } from '~/components/layout/Footer'
import { PageHeader } from '~/components/layout/PageHeader'

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020202] text-white">
      <NocturneBackground />
      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-20 px-4 py-16 sm:px-6 lg:px-0">
        <PageHeader />
        <NocturneHero />
        <PillarsSection />
        <JourneySection />
        <GalleryPreview />
        <ArtistNote />
        <ClosingCTA />
        <Footer />
      </main>
    </div>
  )
}

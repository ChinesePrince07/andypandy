'use client'

import { NocturneButton } from './NocturneButton'

const pillars = [
  {
    en: 'Auto Focus',
    title: '聚焦',
    description:
      '敏锐的对焦在暗夜中锁定一束呼吸，像指尖稳稳托起的光点，开场即是诗意。',
  },
  {
    en: 'Aperture',
    title: '光圈',
    description:
      '光圈在黑幕里微微开启，控制亮度的同时也雕刻情绪，让每一道阴影有落脚处。',
  },
  {
    en: 'Film',
    title: '胶片',
    description:
      '颗粒与拖影构成质感的肌理，胶片的慢和沉静在这里被完整保留，不急于呈现。',
  },
  {
    en: 'Memory',
    title: '记忆',
    description:
      '每一次快门都是一场记忆迁徙，图像收拢那些无法命名的情绪，转化为可反复阅读的篇章。',
  },
]

const journey = [
  {
    title: '拾光',
    description:
      '走进城市与旷野之间，捕捉湿润空气中的光粒，倾听快门前那一瞬的安静。',
  },
  {
    title: '沉浸',
    description:
      '在暗室般的界面里整理作品，像排布展墙一样思考节奏，删减一切多余的声响。',
  },
  {
    title: '呈现',
    description:
      '以策展人的姿态分享影像，让观看者沿着黑色走廊，一步步靠近故事的核心。 ',
  },
]

const previewItems = [
  {
    title: '薄雾晨光',
    caption: '沿河的微光与低云在镜面上映开，气息缠绕在影像周围。',
  },
  {
    title: '舞台余温',
    caption: '舞台灯熄灭后的余温仍在，面庞与背影交错成记忆。',
  },
  {
    title: '雨夜街景',
    caption: '潮湿的街道倒映霓虹，颗粒与反差交织成一幅暗色乐章。',
  },
]

export const NocturneHero = () => {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-white/5 bg-linear-to-b from-[#050505] via-[#030303] to-black px-6 py-12 shadow-[0_30px_120px_rgba(0,0,0,0.6)] sm:px-10 sm:py-16">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-x-12 inset-y-10 rounded-[32px] bg-[radial-gradient(circle_at_top,#1a1a1a,transparent_60%)] blur-3xl" />
        <div className="absolute top-6 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-linear-to-br from-white/10 via-white/5 to-transparent blur-[90px]" />
      </div>
      <div className="relative flex flex-col gap-12">
        <nav className="flex items-center justify-between text-[0.65rem] tracking-[0.5em] text-white/50 uppercase">
          <span>Afilmory</span>
          <span>暗夜影像档案</span>
        </nav>
        <div className="space-y-8 text-center">
          <p className="text-sm tracking-[0.4em] text-white/50">
            Auto Focus · Aperture · Film · Memory
          </p>
          <h1 className="font-serif text-4xl leading-tight text-white sm:text-5xl lg:text-[4.25rem]">
            Afilmory：
            <br />
            在黑暗中把焦点与记忆熔铸为一
          </h1>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-white/70 sm:text-lg">
            Auto Focus 的敏锐、Aperture 对光的雕刻、Film 的质感与 Memory
            的余温，
            在这里形成一座纯黑的摄影剧场。我们邀请你暂时离开喧闹的时代，沉浸在
            光的呼吸里。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <NocturneButton>走进影像档案馆</NocturneButton>
            <NocturneButton variant="secondary">阅读创作宣言</NocturneButton>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.35fr,1fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-linear-to-br from-white/10 via-white/0 to-transparent p-6">
            <div className="text-xs tracking-[0.4em] text-white/40 uppercase">
              Hero Still
            </div>
            <div className="mt-4 aspect-[4/3] w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),rgba(10,10,10,0.8))]">
              <div className="flex h-full flex-col items-center justify-center text-center text-white/40">
                <span className="text-sm">作品展示占位</span>
                <span className="text-xs tracking-[0.3em]">PHOTOGRAPHY</span>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/60">
              终稿将使用真实作品预览，这里以占位图形象征摄影场景。
            </p>
          </div>
          <div className="flex flex-col justify-between rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div>
              <p className="text-xs tracking-[0.4em] text-white/40 uppercase">
                Artist Note
              </p>
              <p className="mt-4 text-lg text-white">
                「我把日常碎片带进 Afilmory，像在暗房里排布展线。它让我得以用
                光而非语言叙述故事。」
              </p>
            </div>
            <div className="mt-6 text-right text-sm text-white/60">
              —— 影像策展人
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export const PillarsSection = () => {
  return (
    <section id="chapters" className="space-y-10">
      <div className="text-center">
        <p className="text-xs tracking-[0.6em] text-white/40 uppercase">
          Name Origin
        </p>
        <h2 className="mt-4 font-serif text-3xl text-white">
          Afilmory 的四个核心感官
        </h2>
        <p className="mt-3 text-base text-white/70">
          Auto Focus、Aperture、Film、Memory ——
          四个词汇构成名字，也构成观看者进入影像档案的仪式。
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {pillars.map((pillar) => (
          <div
            key={pillar.en}
            className="group relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-white/[0.08] to-transparent p-6 transition hover:border-white/30"
          >
            <div className="text-[0.65rem] tracking-[0.4em] text-white/40 uppercase">
              {pillar.en}
            </div>
            <h3 className="mt-4 font-serif text-2xl text-white">
              {pillar.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              {pillar.description}
            </p>
            <div className="mt-8 h-px w-full bg-linear-to-r from-transparent via-white/30 to-transparent opacity-50" />
          </div>
        ))}
      </div>
    </section>
  )
}

export const JourneySection = () => {
  return (
    <section
      id="journey"
      className="rounded-[36px] border border-white/10 bg-black/40 p-8 backdrop-blur-md"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs tracking-[0.5em] text-white/40 uppercase">
            Curated Path
          </p>
          <h2 className="mt-4 font-serif text-3xl text-white">
            在黑色走廊里的三阶段旅程
          </h2>
        </div>
        <p className="max-w-xl text-sm text-white/70">
          不需要携带任何技术说明，只在乎光线、呼吸与节奏。每段旅程都对应着一次观看体验，从拾光到沉浸再到呈现。
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {journey.map((step, index) => (
          <div
            key={step.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex items-center gap-3 text-white/40">
              <span className="text-sm tracking-[0.4em]">STEP</span>
              <span className="text-lg text-white/80">{`0${index + 1}`}</span>
            </div>
            <h3 className="mt-4 font-serif text-2xl text-white">
              {step.title}
            </h3>
            <p className="mt-3 text-sm text-white/70">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export const GalleryPreview = () => {
  return (
    <section id="preview" className="space-y-6">
      <div className="flex flex-col gap-3 text-left">
        <p className="text-xs tracking-[0.5em] text-white/40 uppercase">
          Gallery Preview
        </p>
        <h2 className="font-serif text-3xl text-white">
          沉浸式作品墙（使用占位图）
        </h2>
        <p className="max-w-2xl text-sm text-white/60">
          在正式上线前，这里以占位图展示未来的画面结构。横向滚动的布局模拟实体展厅的节奏，让光影以静默方式展开。
        </p>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {previewItems.map((item) => (
          <div
            key={item.title}
            className="min-w-[260px] flex-1 rounded-[30px] border border-white/10 bg-linear-to-br from-white/10 via-transparent to-black/30 p-5"
          >
            <div className="aspect-[3/4] w-full rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),rgba(0,0,0,0.85))]">
              <div className="flex h-full flex-col items-center justify-center text-center text-white/50">
                <span className="text-sm">作品占位图</span>
                <span className="text-[0.65rem] tracking-[0.4em] uppercase">
                  Placeholder
                </span>
              </div>
            </div>
            <div className="mt-4 space-y-1">
              <p className="font-serif text-xl text-white">{item.title}</p>
              <p className="text-sm text-white/60">{item.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export const ArtistNote = () => {
  return (
    <section className="grid gap-8 rounded-[36px] border border-white/10 bg-linear-to-br from-white/5 via-transparent to-black/50 p-8 lg:grid-cols-[1.1fr,0.9fr]">
      <div className="space-y-6">
        <p className="text-xs tracking-[0.4em] text-white/40 uppercase">
          Artist Statement
        </p>
        <h2 className="font-serif text-3xl text-white">摄影师的宣言</h2>
        <p className="text-base leading-relaxed text-white/75">
          「我相信图像是一种缓慢的语言。Afilmory
          让我从容地在深色背景里拼贴回忆，控制光圈就是控制节奏，胶片的颗粒提醒我拥抱不完美。每一次策展都是一次自我对照，也是把更多人带进故事的方式。」
        </p>
        <div className="pt-4 text-sm tracking-[0.4em] text-white/40 uppercase">
          ————
        </div>
        <div>
          <p className="text-lg text-white">签名 / Signature</p>
          <p className="text-sm text-white/60">以手写笔触呈现的个人烙印</p>
        </div>
      </div>
      <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6">
        <div className="text-xs tracking-[0.4em] text-white/40 uppercase">
          Darkroom Hints
        </div>
        <p className="mt-4 text-base leading-loose text-white/70">
          想象自己站在暗房里，只有红色安全灯。你将作品像底片一样浸泡在药水中，一次次轻晃，让影像慢慢显影。Afilmory
          的界面和流程，便是把这种慢下来、仔细聆听光线的姿态搬到屏幕上。
        </p>
        <div className="mt-6 rounded-2xl border border-white/15 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.16),rgba(0,0,0,0.9))] p-6 text-sm text-white/70">
          暗室记忆占位：未来这里会展示实际的流程影像。当前用抽象纹理象征。
        </div>
      </div>
    </section>
  )
}

export const ClosingCTA = () => {
  return (
    <section className="relative overflow-hidden rounded-[44px] border border-white/15 bg-linear-to-r from-black via-[#050505] to-black p-10 text-center">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-y-0 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-linear-to-r from-white/10 via-transparent to-transparent blur-[100px]" />
        <div className="absolute right-0 bottom-0 left-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent" />
      </div>
      <div className="relative space-y-6">
        <p className="text-xs tracking-[0.5em] text-white/50 uppercase">
          Final Call
        </p>
        <h2 className="font-serif text-4xl text-white">
          让影像先呼吸，再被世界听见
        </h2>
        <p className="mx-auto max-w-2xl text-base text-white/70">
          当你准备好进入这座暗夜中的影像馆，Afilmory
          会以最安静的方式陪你陈列作品。这里没有参数，只有被光照亮的记忆。
        </p>
        <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
          <NocturneButton className="text-base tracking-[0.3em]">
            预约入场
          </NocturneButton>
          <NocturneButton
            variant="secondary"
            className="text-base tracking-[0.3em]"
          >
            请求私人导览
          </NocturneButton>
        </div>
      </div>
    </section>
  )
}

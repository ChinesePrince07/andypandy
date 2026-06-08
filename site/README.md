# andypandy.org

Personal portfolio and blog built with Next.js 15. Features an about page, project showcase, markdown blog with RSS, and an admin interface for content management.

**[Live Site](https://andypandy.org)**

## Features

### About Page
- Hero section with animated scrambling text effect
- Bio, education, technical skills grid, and career timeline
- Social links (GitHub, LinkedIn, Instagram, email with copy-to-clipboard)
- Admin-only inline editor for all content sections

### Projects
- Showcase of 8 projects with descriptions, tech tags, and live demo links
- Pinnable projects (persisted to GitHub via API)
- Project detail pages pull the README directly from each GitHub repo
- 1-hour cache on README fetches

### Blog
- Markdown posts with YAML frontmatter (title, date, description, pinned)
- GitHub-flavored Markdown rendering (tables, task lists, strikethrough)
- Reading time estimates
- Pinned posts displayed first
- RSS feed at `/feed.xml`

### Admin
- Password-protected dashboard at `/admin`
- Session auth using HMAC-SHA256 (7-day expiry)
- Create, edit, and delete blog posts
- Pin/unpin projects
- Inline about page editor
- WordPress REST API and Micropub protocol compatibility for external publishing tools

### UI
- Dark/light mode with system preference detection and local storage persistence
- Scramble text animation on name and logo
- Live 24-hour clock in the header
- Staggered fade-in page transitions
- Card hover effects, gradient text shimmer, noise texture overlay
- `prefers-reduced-motion` support
- Responsive design

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4, custom CSS |
| Content | Markdown (gray-matter + marked), GitHub API |
| Fonts | Inter, JetBrains Mono |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 18+
- A GitHub personal access token (for content fetching)

### 1. Clone and Install

```bash
git clone https://github.com/ChinesePrince07/personal-site.git
cd personal-site
npm install
```

### 2. Configure Environment

Create a `.env.local` file:

```env
ADMIN_PASSWORD=your_admin_password
GITHUB_TOKEN=your_github_personal_access_token
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
personal-site/
├── app/
│   ├── page.tsx                # Home/About page
│   ├── layout.tsx              # Root layout (header + footer)
│   ├── globals.css             # Custom styles and animations
│   ├── blog/
│   │   ├── page.tsx            # Blog listing
│   │   └── [slug]/page.tsx     # Blog post page
│   ├── projects/
│   │   ├── page.tsx            # Projects listing
│   │   └── [slug]/page.tsx     # Project detail (GitHub README)
│   ├── admin/                  # Admin dashboard and editors
│   ├── api/                    # API routes (auth, CRUD, publishing)
│   └── feed.xml/route.ts       # RSS feed
│
├── components/
│   ├── header.tsx              # Navigation bar with live clock
│   ├── footer.tsx              # Social links
│   ├── scramble-text.tsx       # Text scramble animation
│   ├── theme-toggle.tsx        # Dark mode toggle
│   └── live-clock.tsx          # Real-time clock display
│
├── lib/
│   ├── blog.ts                 # Blog post fetching and parsing
│   ├── projects.ts             # Project definitions and pinning
│   ├── about.ts                # About page data management
│   └── admin-auth.ts           # Session and auth helpers
│
├── content/
│   ├── blog/                   # Markdown blog posts
│   ├── about.json              # About page content
│   └── pinned-projects.json    # Pinned project slugs
│
├── middleware.ts                # Link headers for protocol discovery
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Content Workflow

Blog posts are written as markdown files in `content/blog/` and pushed to GitHub. The site fetches content from the GitHub API at request time with 60-second ISR revalidation, so updates appear within a minute of pushing.

## Scripts

```bash
npm run dev      # Development server
npm run build    # Production build
npm start        # Production server
npm run lint     # ESLint
```

## License

MIT

---

Made by Andy Zhang.

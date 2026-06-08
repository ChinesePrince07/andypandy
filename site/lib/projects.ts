import { unstable_cache } from "next/cache";
import { r2GetText } from "./r2-storage";

export interface Project {
  name: string;
  slug: string;
  description: string;
  tags: string[];
  emoji: string;
  demo?: string;
  repo: string;
  pinned?: boolean;
}

export const projects: Project[] = [
  {
    name: "Andy's Swiss Knife",
    slug: "andy-swiss-knife",
    repo: "ChinesePrince07/Andy-Swiss-Knife",
    description:
      "A single iOS app that swallowed five of mine — todos, class schedule, dining menu, pomodoro, athletics, school events, and Canvas assignments. Built it so I'd stop juggling tabs between classes.",
    tags: ["Swift", "iOS"],
    emoji: "🔪",
  },
  {
    name: "Servo Light Switch",
    slug: "servo-light-switch",
    repo: "ChinesePrince07/servo-light-switch",
    description:
      "A tiny robot finger that flips my dorm light switch when I ask Siri. XIAO ESP32C3 + MG90S servo + HomeKit, because getting out of bed is hard.",
    tags: ["C++", "ESP32", "HomeKit"],
    emoji: "💡",
  },
  {
    name: "TI-84 GPT Hack",
    slug: "ti-84-gpt-hack",
    repo: "ChinesePrince07/TI-84-GPT-HACK",
    description:
      "A mod that gives your TI-84 Wi-Fi, ChatGPT, and the ability to disappoint your math teacher in ways never thought possible.",
    tags: ["C", "ESP32", "Hardware"],
    emoji: "🧮",
  },
  {
    name: "Desmos Bezier Renderer",
    slug: "desmos-bezier-renderer",
    repo: "ChinesePrince07/DesmosBezierRenderer-mac",
    description:
      "Transform any image into mathematical art on Desmos. Uses Canny edge detection and Potrace to convert images into parametric Bezier curve equations.",
    tags: ["HTML", "Math", "macOS"],
    emoji: "📐",
    demo: "https://desmos.andypandy.org/calculator",
  },
  {
    name: "Suffield Drive",
    slug: "suffield-drive",
    repo: "ChinesePrince07/Suffield-Drive",
    description:
      "A shared drive for Suffield students to access and share school resources.",
    tags: ["TypeScript", "Web"],
    emoji: "☁️",
    demo: "https://suffield-drive.vercel.app",
  },
  {
    name: "EXIF Photo Blog",
    slug: "exif-photo-blog",
    repo: "ChinesePrince07/exif-photo-blog-real",
    description:
      "A photography blog that reports camera details like aperture, shutter speed, and ISO for each image.",
    tags: ["TypeScript", "Next.js", "Photography"],
    emoji: "📷",
    demo: "https://exif-photo-blog-real.vercel.app",
  },
  {
    name: "Taylor Series Visualizer",
    slug: "taylor-series",
    repo: "ChinesePrince07/taylorseries-CALCBC",
    description:
      "An interactive visualization of Taylor series approximations for Calc BC.",
    tags: ["HTML", "Math"],
    emoji: "📊",
    demo: "https://taylorseries-calcbc.vercel.app",
  },
  {
    name: "Music Landing Page",
    slug: "music-landing-page",
    repo: "ChinesePrince07/music-landing-page-commissioned",
    description: "A commissioned landing page for a music artist.",
    tags: ["HTML", "Design"],
    emoji: "🎵",
    demo: "https://music-landing-page-commissioned.vercel.app",
  },
  {
    name: "Stroke Prediction",
    slug: "stroke-prediction",
    repo: "ChinesePrince07/Stroke-Prediction",
    description:
      "ML model that predicts stroke likelihood based on patient data like age, BMI, glucose level, and smoking status.",
    tags: ["Python", "ML", "Jupyter"],
    emoji: "🧠",
  },
  {
    name: "Chatbot UI",
    slug: "chatbot-ui",
    repo: "ChinesePrince07/chatbot-ui",
    description: "A chat interface for interacting with AI models.",
    tags: ["TypeScript", "AI"],
    emoji: "💬",
    demo: "https://chatbot-ui-phi-one-74.vercel.app",
  },
];

export const PINNED_KEY = "content/pinned-projects.json";

const loadPinnedSlugs = unstable_cache(
  async (): Promise<string[]> => {
    try {
      const text = await r2GetText(PINNED_KEY);
      if (!text) return [];
      return JSON.parse(text) as string[];
    } catch {
      return [];
    }
  },
  ["pinned-projects-slugs"],
  { tags: ["pinned-projects"], revalidate: 60 },
);

export async function getPinnedSlugs(): Promise<string[]> {
  return loadPinnedSlugs();
}

export async function getProjectsWithPins(): Promise<Project[]> {
  const pinned = await getPinnedSlugs();
  const withPins = projects.map((p) => ({
    ...p,
    pinned: pinned.includes(p.slug),
  }));
  return [
    ...withPins.filter((p) => p.pinned),
    ...withPins.filter((p) => !p.pinned),
  ];
}

import { unstable_cache } from "next/cache";
import { r2GetText, r2Put } from "./r2-storage";

const ABOUT_KEY = "content/about.json";

export interface EducationEntry {
  school: string;
  location: string;
  year: string;
  logo?: string;
}

export interface AboutData {
  bio: string[];
  education: EducationEntry[];
  skills: { category: string; items: string[] }[];
  timeline: { year: string; title: string; description: string }[];
}

const defaultAbout: AboutData = {
  bio: [
    "I tinker with hardware, write software, and occasionally share what I learn on my blog. Right now I'm especially interested in IoT, calculator hacking, and full-stack web development.",
    "When I'm not coding, you can probably find me exploring new tech, working on side projects, or diving deep into some obscure rabbit hole.",
  ],
  education: [
    {
      school: "UC Berkeley",
      location: "Berkeley, California",
      year: "Class of 2030",
      logo: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Seal_of_University_of_California%2C_Berkeley.svg",
    },
    {
      school: "Suffield Academy",
      location: "Suffield, Connecticut",
      year: "Class of 2026",
      logo: "https://www.assistscholars.org/wp-content/uploads/2025/09/Suffield-Academy.png",
    },
  ],
  skills: [
    {
      category: "Languages",
      items: ["TypeScript", "Python", "C", "JavaScript", "HTML/CSS"],
    },
    { category: "Frontend", items: ["React", "Next.js", "Tailwind CSS"] },
    { category: "Backend", items: ["Node.js", "REST APIs"] },
    { category: "Hardware", items: ["ESP32", "Arduino", "IoT"] },
    { category: "Tools", items: ["Git", "Linux", "VS Code", "Vercel"] },
  ],
  timeline: [
    {
      year: "2025",
      title: "Senior Year — Suffield Academy",
      description:
        "Full-stack web development, personal projects, and college prep.",
    },
    {
      year: "2024",
      title: "Junior Year — Suffield Academy",
      description:
        "Deep dive into IoT, embedded systems with ESP32, and calculator hacking.",
    },
    {
      year: "Summer 2024",
      title: "Summer Projects",
      description:
        "Built side projects, explored machine learning, and sharpened coding skills.",
    },
    {
      year: "Summer 2023",
      title: "Getting Started",
      description:
        "First steps into programming — Python scripting, HTML/CSS, and hardware tinkering.",
    },
  ],
};

const loadAbout = unstable_cache(
  async (): Promise<AboutData> => {
    try {
      const text = await r2GetText(ABOUT_KEY);
      if (!text) return defaultAbout;
      return JSON.parse(text) as AboutData;
    } catch {
      return defaultAbout;
    }
  },
  ["about-data"],
  { tags: ["about"], revalidate: 60 },
);

export async function getAboutData(): Promise<AboutData> {
  return loadAbout();
}

export async function saveAboutData(about: AboutData): Promise<void> {
  await r2Put(
    ABOUT_KEY,
    JSON.stringify(about, null, 2),
    "application/json; charset=utf-8",
  );
}

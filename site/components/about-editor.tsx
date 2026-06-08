"use client";

import { useState } from "react";
import type { AboutData } from "@/lib/about";

type Section = null | "bio" | "education" | "skills" | "timeline";

const inputClass =
  "w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200";

export default function AboutEditor({ data }: { data: AboutData }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Section>(null);
  const [draft, setDraft] = useState<AboutData>(data);
  const [saving, setSaving] = useState(false);

  function startEdit(section: Section) {
    setDraft(data);
    setEditing(section);
    setOpen(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/about/", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setEditing(null);
        window.location.reload();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[190] flex h-12 w-12 items-center justify-center rounded-full bg-gray-900 text-white shadow-lg transition-transform hover:scale-105 active:scale-95 dark:bg-gray-100 dark:text-gray-900"
        aria-label="Edit page"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
          />
        </svg>
      </button>

      {/* FAB menu */}
      {open && (
        <div className="fixed bottom-20 right-6 z-[190] flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {(["bio", "education", "skills", "timeline"] as const).map((s) => (
            <button
              key={s}
              onClick={() => startEdit(s)}
              className="rounded-lg px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 capitalize"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <button
              onClick={() => setEditing(null)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <h2 className="mb-4 text-lg font-bold capitalize">
              Edit {editing}
            </h2>

            {editing === "bio" && (
              <div className="space-y-3">
                {draft.bio.map((p, i) => (
                  <div key={i}>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">
                        Paragraph {i + 1}
                      </label>
                      {draft.bio.length > 1 && (
                        <button
                          onClick={() =>
                            setDraft({
                              ...draft,
                              bio: draft.bio.filter((_, j) => j !== i),
                            })
                          }
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      value={p}
                      onChange={(e) => {
                        const bio = [...draft.bio];
                        bio[i] = e.target.value;
                        setDraft({ ...draft, bio });
                      }}
                      className={inputClass}
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    setDraft({ ...draft, bio: [...draft.bio, ""] })
                  }
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  + Add paragraph
                </button>
              </div>
            )}

            {editing === "education" && (
              <div className="space-y-4">
                {draft.education.map((entry, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-gray-100 p-3 dark:border-gray-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Entry {i + 1}
                      </span>
                      {draft.education.length > 1 && (
                        <button
                          onClick={() =>
                            setDraft({
                              ...draft,
                              education: draft.education.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        School
                      </label>
                      <input
                        value={entry.school}
                        onChange={(e) => {
                          const education = [...draft.education];
                          education[i] = {
                            ...education[i],
                            school: e.target.value,
                          };
                          setDraft({ ...draft, education });
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Location
                      </label>
                      <input
                        value={entry.location}
                        onChange={(e) => {
                          const education = [...draft.education];
                          education[i] = {
                            ...education[i],
                            location: e.target.value,
                          };
                          setDraft({ ...draft, education });
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Year
                      </label>
                      <input
                        value={entry.year}
                        onChange={(e) => {
                          const education = [...draft.education];
                          education[i] = {
                            ...education[i],
                            year: e.target.value,
                          };
                          setDraft({ ...draft, education });
                        }}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">
                        Logo URL (optional)
                      </label>
                      <input
                        value={entry.logo || ""}
                        onChange={(e) => {
                          const education = [...draft.education];
                          education[i] = {
                            ...education[i],
                            logo: e.target.value || undefined,
                          };
                          setDraft({ ...draft, education });
                        }}
                        placeholder="https://example.com/logo.png"
                        className={inputClass}
                      />
                    </div>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      education: [
                        ...draft.education,
                        { school: "", location: "", year: "" },
                      ],
                    })
                  }
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  + Add entry
                </button>
              </div>
            )}

            {editing === "skills" && (
              <div className="space-y-4">
                {draft.skills.map((group, gi) => (
                  <div
                    key={gi}
                    className="rounded-lg border border-gray-100 p-3 dark:border-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={group.category}
                        onChange={(e) => {
                          const skills = [...draft.skills];
                          skills[gi] = {
                            ...skills[gi],
                            category: e.target.value,
                          };
                          setDraft({ ...draft, skills });
                        }}
                        className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-semibold uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                      <button
                        onClick={() =>
                          setDraft({
                            ...draft,
                            skills: draft.skills.filter((_, i) => i !== gi),
                          })
                        }
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={group.items.join(", ")}
                      onChange={(e) => {
                        const skills = [...draft.skills];
                        skills[gi] = {
                          ...skills[gi],
                          items: e.target.value
                            .split(",")
                            .map((s) => s.trim())
                            .filter(Boolean),
                        };
                        setDraft({ ...draft, skills });
                      }}
                      placeholder="Comma-separated skills"
                      className="mt-2 w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    />
                  </div>
                ))}
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      skills: [...draft.skills, { category: "New", items: [] }],
                    })
                  }
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  + Add category
                </button>
              </div>
            )}

            {editing === "timeline" && (
              <div className="space-y-2">
                {draft.timeline.map((entry, i) => (
                  <div key={i}>
                    {/* Insert above button */}
                    <button
                      onClick={() => {
                        const timeline = [...draft.timeline];
                        timeline.splice(i, 0, {
                          year: "",
                          title: "",
                          description: "",
                        });
                        setDraft({ ...draft, timeline });
                      }}
                      className="mb-1 flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-200 py-1 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-300"
                    >
                      + Insert here
                    </button>
                    <div className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                      <div className="mb-2 flex items-center gap-2">
                        <input
                          value={entry.year}
                          onChange={(e) => {
                            const timeline = [...draft.timeline];
                            timeline[i] = {
                              ...timeline[i],
                              year: e.target.value,
                            };
                            setDraft({ ...draft, timeline });
                          }}
                          placeholder="Year"
                          className="w-28 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-mono dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                        <input
                          value={entry.title}
                          onChange={(e) => {
                            const timeline = [...draft.timeline];
                            timeline[i] = {
                              ...timeline[i],
                              title: e.target.value,
                            };
                            setDraft({ ...draft, timeline });
                          }}
                          placeholder="Title"
                          className="flex-1 rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                        />
                        <button
                          onClick={() =>
                            setDraft({
                              ...draft,
                              timeline: draft.timeline.filter(
                                (_, j) => j !== i,
                              ),
                            })
                          }
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        value={entry.description}
                        onChange={(e) => {
                          const timeline = [...draft.timeline];
                          timeline[i] = {
                            ...timeline[i],
                            description: e.target.value,
                          };
                          setDraft({ ...draft, timeline });
                        }}
                        placeholder="Description"
                        className="w-full rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                      />
                    </div>
                  </div>
                ))}
                {/* Insert at end */}
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      timeline: [
                        ...draft.timeline,
                        { year: "", title: "", description: "" },
                      ],
                    })
                  }
                  className="flex w-full items-center justify-center gap-1 rounded border border-dashed border-gray-200 py-1.5 text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:text-gray-300"
                >
                  + Insert at end
                </button>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditing(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

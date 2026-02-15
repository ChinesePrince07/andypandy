"use client";

import { useState, useEffect, useCallback } from "react";

interface Comment {
  id: string;
  name: string;
  text: string;
  date: string;
  parentId?: string;
}

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CommentForm({
  slug,
  parentId,
  onSubmitted,
  onCancel,
  placeholder,
}: {
  slug: string;
  parentId?: string;
  onSubmitted: () => void;
  onCancel?: () => void;
  placeholder?: string;
}) {
  const [name, setName] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("comment_name") || "";
    }
    return "";
  });
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !text.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/comments/${slug}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          text: text.trim(),
          parentId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to post comment");
        return;
      }

      localStorage.setItem("comment_name", name.trim());
      setText("");
      onSubmitted();
    } catch {
      setError("Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        maxLength={50}
        required
        className="w-1/3 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-500"
      />
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder || "Write a comment..."}
        maxLength={2000}
        required
        className="w-full rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:border-gray-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={submitting || !name.trim() || !text.trim()}
          className="rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200"
        >
          {submitting ? "Posting..." : parentId ? "Reply" : "Comment"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Cancel
          </button>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </form>
  );
}

function SingleComment({
  comment,
  slug,
  isAdmin,
  replies,
  onRefresh,
}: {
  comment: Comment;
  slug: string;
  isAdmin: boolean;
  replies: Comment[];
  onRefresh: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/comments/${slug}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {comment.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {comment.name}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {timeAgo(comment.date)}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-gray-600 leading-relaxed dark:text-gray-300 whitespace-pre-wrap break-words">
            {comment.text}
          </p>
          <div className="mt-1 flex items-center gap-3">
            {!comment.parentId && (
              <button
                onClick={() => setReplying(!replying)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Reply
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => handleDelete(comment.id)}
                disabled={deleting}
                className="text-xs text-red-400 hover:text-red-600"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l-2 border-gray-100 pl-4 dark:border-gray-800">
          {replies.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              slug={slug}
              isAdmin={isAdmin}
              replies={[]}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}

      {/* Reply form */}
      {replying && (
        <div className="ml-11">
          <CommentForm
            slug={slug}
            parentId={comment.id}
            placeholder={`Reply to ${comment.name}...`}
            onSubmitted={() => {
              setReplying(false);
              onRefresh();
            }}
            onCancel={() => setReplying(false)}
          />
        </div>
      )}
    </div>
  );
}

export default function Comments({
  slug,
  isAdmin,
}: {
  slug: string;
  isAdmin: boolean;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments/${slug}/`);
      if (res.ok) {
        setComments(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const topLevel = comments.filter((c) => !c.parentId);
  const repliesMap = new Map<string, Comment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const existing = repliesMap.get(c.parentId) || [];
      existing.push(c);
      repliesMap.set(c.parentId, existing);
    }
  }

  return (
    <section className="mt-12">
      <div className="divider mb-8" />
      <h2 className="text-lg font-bold tracking-tight mb-6">
        Comments{comments.length > 0 && ` (${comments.length})`}
      </h2>

      {/* Comment form */}
      <div className="mb-8">
        <CommentForm slug={slug} onSubmitted={fetchComments} />
      </div>

      {/* Comments list */}
      {loading ? (
        <p className="text-sm text-gray-400">Loading comments...</p>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="space-y-6">
          {topLevel.map((comment) => (
            <SingleComment
              key={comment.id}
              comment={comment}
              slug={slug}
              isAdmin={isAdmin}
              replies={repliesMap.get(comment.id) || []}
              onRefresh={fetchComments}
            />
          ))}
        </div>
      )}
    </section>
  );
}

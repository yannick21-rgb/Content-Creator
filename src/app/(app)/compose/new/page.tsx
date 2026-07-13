// src/app/compose/new/page.tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { PublishModal } from "@/components/compose/PublishModal";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ComposeNewPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [facebookAccounts, setFacebookAccounts] = useState<any[]>([]);
  const [instagramAccounts, setInstagramAccounts] = useState<any[]>([]);
  const [linkedinAccounts, setLinkedinAccounts] = useState<any[]>([]);
  const [mediaCount, setMediaCount] = useState(0);
  const [postId, setPostId] = useState<string | null>(null);

  const handlePublished = useCallback((targetIds: string[]) => {
    if (postId) {
      router.push(`/compose/post/${postId}`);
    }
  }, [postId, router]);

  useEffect(() => {
    fetch("/api/social-accounts?platform=meta")
      .then((r) => r.json())
      .then((data) => setFacebookAccounts(data))
      .catch(() => {});
    fetch("/api/social-accounts?platform=instagram")
      .then((r) => r.json())
      .then((data) => setInstagramAccounts(data))
      .catch(() => {});
    fetch("/api/social-accounts?platform=linkedin")
      .then((r) => r.json())
      .then((data) => setLinkedinAccounts(data))
      .catch(() => {});
  }, []);

  // Platform validation warnings (IG caption: 2200, LinkedIn: 700)
  const warnings = [
    ...(text.length > 2200 ? ["IG: 2200 char limit"] : []),
    ...(text.length > 700 ? ["LinkedIn: 700 char limit"] : []),
  ];

  const handleSave = async () => {
    if (!text || text.trim().length === 0) {
      alert("Post text is required");
      return;
    }

    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title }),
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.error || "Failed to create post");
      return;
    }

    const post = await res.json();
    setPostId(post.id);
    await mutate("/api/posts");
    router.push(`/compose/post/${post.id}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Compose New Post</h1>

      <div className="space-y-4">
        <div>
          <label className="block mb-1 font-semibold">Title (optional)</label>
          <input
            className="w-full border rounded p-2"
            value={title}
            onChange={e => setTitle(e.currentTarget.value)}
            placeholder="Enter post title"
          />
        </div>

        <div>
          <label className="block mb-1 font-semibold">Post Text</label>
          <textarea
            className="w-full border rounded p-2 min-h-[120px]"
            value={text}
            onChange={e => setText(e.currentTarget.value)}
            placeholder="Write your post..."
          />
        </div>

        {warnings.length > 0 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm">
            <strong>Warnings:</strong>
            {warnings.map((w, idx) => (
              <div key={idx}>● {w}</div>
            ))}
          </div>
        )}

        {mediaCount >= 2 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm">
            <strong>LinkedIn:</strong> Carousel posts are not supported on LinkedIn.
            Facebook and Instagram support carousels.
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Save Post
          </button>
          <button
            onClick={() => setShowPublishModal(true)}
            disabled={facebookAccounts.length === 0 && instagramAccounts.length === 0 && linkedinAccounts.length === 0}
            title={facebookAccounts.length === 0 && instagramAccounts.length === 0 && linkedinAccounts.length === 0 ? "No connected accounts" : undefined}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publish Now
          </button>
          <button
            onClick={() => setShowAiModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-700"
          >
            Generate with AI
          </button>
        </div>
      </div>

      {showPublishModal && postId && (
        <PublishModal
          postId={postId}
          facebookAccounts={facebookAccounts}
          instagramAccounts={instagramAccounts}
          linkedinAccounts={linkedinAccounts}
          isOpen={showPublishModal}
          onClose={() => setShowPublishModal(false)}
          onPublished={handlePublished}
        />
      )}
    </div>
  );
}
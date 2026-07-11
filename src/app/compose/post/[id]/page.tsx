// src/app/compose/post/[id]/page.tsx
"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ComposeEditPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [media, setMedia] = useState([]);

  const warnings = [
    ...(text.length > 2200 ? ["IG: 2200 char limit"] : []),
    ...(text.length > 700 ? ["LinkedIn: 700 char limit"] : []),
  ];

  useEffect(() => {
    const loadPost = async () => {
      try {
        const res = await fetcher(`/api/posts/${id}`);
        setText(res.text || "");
        setTitle(res.title || "");
        setMedia(res.media || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadPost();
  }, [id]);

  const handleSave = async () => {
    const res = await fetch(`/api/posts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title }),
    });
    if (!res.ok) {
      const error = await res.json();
      alert(error.error || "Failed to update");
      return;
    }
    const updated = await res.json();
    setText(updated.text || "");
    setTitle(updated.title || "");
    setMedia(updated.media || []);
    alert("Updated");
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Post ({id})</h1>
      <div className="space-y-4">
        <label className="block mb-1 font-semibold">Title (optional)</label>
        <input
          className="w-full border rounded p-2"
          value={title}
          onChange={e => setTitle(e.currentTarget.value)}
          placeholder="Enter title"
        />
        <label className="block mb-1 font-semibold">Post Text</label>
        <textarea
          className="w-full border rounded p-2 min-h-[120px]"
          value={text}
          onChange={e => setText(e.currentTarget.value)}
          placeholder="Write your post..."
        />
        {warnings.length > 0 && (
          <div className="bg-yellow-100 border border-yellow-400 text-yellow-800 px-3 py-2 rounded text-sm">
            <strong>Warnings:</strong>
            {warnings.map((w, idx) => <div key={idx}>● {w}</div>)}
          </div>
        )}
        <button
          onClick={handleSave}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}

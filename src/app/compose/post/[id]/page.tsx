"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PublishStatusView } from "@/components/compose/PublishStatusView";

interface PostDetail {
  id: string;
  title?: string;
  text: string;
  status: string;
  media?: Array<{ id: string; publicUrl: string; contentType: string }>;
}

export default function PostDetailPage() {
  const params = useParams();
  const postId = params.id as string;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/posts/${postId}`)
      .then((r) => r.json())
      .then((data) => setPost(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) return <div className="max-w-2xl mx-auto p-4"><p>Loading...</p></div>;
  if (!post) return <div className="max-w-2xl mx-auto p-4"><p>Post not found</p></div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-2">{post.title || "Untitled Post"}</h1>
      <div className="mb-4">
        <span className="text-sm text-gray-500">Status: </span>
        <span className="text-sm font-medium">{post.status}</span>
      </div>

      {post.media && post.media.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {post.media.map((m) => (
            <img
              key={m.id}
              src={m.publicUrl}
              alt="Post media"
              className="h-32 w-32 object-cover rounded"
            />
          ))}
        </div>
      )}

      <div className="bg-gray-50 rounded p-4 mb-6 whitespace-pre-wrap text-sm">
        {post.text}
      </div>

      <PublishStatusView postId={postId} />
    </div>
  );
}

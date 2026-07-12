"use client";

import { useState, useEffect } from "react";
import { AiGeneratorModal } from "@/components/compose/AiGeneratorModal";

export function PublishStatusView({ postId }: { postId: string }) {
  const [retryCount, setRetryCount] = useState(0);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiText, setAiText] = useState("");

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialAccountIds: [] }),
      });
      if (response.ok) {
        setRetryCount(prev => prev + 1);
      }
    } catch (error) {
      console.error("Retry failed:", error);
    }
  };

  const handleGenerateWithAi = (content: string) => {
    setAiText(content);
    setShowAiModal(true);
  };

  const handleImproveWithAi = (content: string) => {
    setAiText(content);
    setShowAiModal(true);
  };

  const handleInsertAiContent = (content: string) => {
    const textarea = document.querySelector('textarea[name="text"]') as HTMLTextAreaElement;
    if (textarea) {
      const currentText = textarea.value;
      const newText = currentText ? `${currentText} ${content}` : content;
      textarea.value = newText;
      setAiText(newText);
    }
    setShowAiModal(false);
  };

  return (
    <div>
      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Retry Failed Targets
          </button>
          <button
            onClick={() => setShowAiModal(true)}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm"
          >
            Generate with AI
          </button>
        </div>

        {retryCount > 0 && (
          <div className="mt-3 text-sm text-green-600">
            Retry attempted! Check status for updates.
          </div>
        )}
      </div>

      <AiGeneratorModal
        isOpen={showAiModal}
        onClose={() => setShowAiModal(false)}
        onGenerated={handleGenerateWithAi}
        onImproved={handleImproveWithAi}
        initialText={aiText}
      />
    </div>
  );
}

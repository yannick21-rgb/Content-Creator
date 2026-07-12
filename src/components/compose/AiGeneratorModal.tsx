"use client";

import { useState, useEffect, useRef } from "react";

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (content: string) => void;
  onImproved: (content: string) => void;
  initialText?: string;
}

const platforms = [
  { id: "meta", name: "Meta (Facebook/Instagram)", limit: "63206 chars" },
  { id: "instagram", name: "Instagram", limit: "2200 chars" },
  { id: "linkedin", name: "LinkedIn", limit: "700 chars" },
];

const tones = [
  { id: "professional", name: "Professional" },
  { id: "casual", name: "Casual" },
  { id: "humorous", name: "Humorous" },
];

const lengths = [
  { id: "short", name: "Short (up to 200 chars)" },
  { id: "medium", name: "Medium (up to 500 chars)" },
  { id: "long", name: "Long (up to full platform limit)" },
];

export function AiGeneratorModal({ isOpen, onClose, onGenerated, onImproved, initialText = "" }: AiGeneratorModalProps) {
  const [text, setText] = useState(initialText);
  const [mode, setMode] = useState("generate");
  const [platform, setPlatform] = useState("meta");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setText(initialText);
      setMode("generate");
      setPlatform("meta");
      setTone("professional");
      setLength("medium");
      setResult(null);
      setError(null);
    }
  }, [isOpen, initialText]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const post = { title: "", text };
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": document.cookie || "",
        },
        body: JSON.stringify({
          post,
          platform,
          mode: "generate",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Generation failed");
      }

      const data = await response.json();
      const generatedText = data.content || data.result || "";
      setResult(generatedText);
      onGenerated(generatedText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Generation failed";
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImprove = async () => {
    if (!text.trim()) {
      setError("Please provide text to improve");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": document.cookie || "",
        },
        body: JSON.stringify({
          post: { text },
          platform,
          mode: "improve",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Improvement failed");
      }

      const data = await response.json();
      const improvedText = data.content || data.result || "";
      setResult(improvedText);
      onImproved(improvedText);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Improvement failed";
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setText(initialText);
    setMode("generate");
    setPlatform("meta");
    setTone("professional");
    setLength("medium");
    setResult(null);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div ref={modalRef} className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Generate with AI</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Mode</h3>
            <div className="flex gap-4">
              <button
                onClick={() => setMode("generate")}
                className={`px-4 py-2 rounded font-medium ${mode === "generate" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
              >
                Generate (from scratch)
              </button>
              <button
                onClick={() => setMode("improve")}
                className={`px-4 py-2 rounded font-medium ${mode === "improve" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-800"}`}
              >
                Improve (rewrite existing)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block mb-2 font-semibold">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full border rounded p-2"
              >
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-2 font-semibold">Tone</label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full border rounded p-2"
              >
                {tones.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold">Length</label>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full border rounded p-2"
            >
              {lengths.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label className="block mb-2 font-semibold">
              {mode === "generate" ? "Context/Prompt" : "Text to improve"}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={mode === "generate" ? "Enter context or topic for AI generation..." : "Paste text you want AI to improve..."}
              className="w-full border rounded p-2 min-h-[100px]"
            />
            <div className="text-sm text-gray-500 mt-1">
              {mode === "generate" && "Provide details about what you want to create"}
              {mode === "improve" && "Provide text you'd like improved with AI assistance"}
            </div>
          </div>

          {result && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">AI Result</h3>
              <div className="bg-green-50 border border-green-200 rounded p-4">
                <p className="text-gray-800 whitespace-pre-wrap">{result}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => onGenerated(result)}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                  Use this generated content
                </button>
                <button
                  onClick={() => onImproved(result)}
                  className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Use this as improvement
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={mode === "generate" ? handleGenerate : handleImprove}
              disabled={isGenerating || (!text.trim() && mode === "improve")}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? "Generating..." : mode === "generate" ? "Generate" : "Improve"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

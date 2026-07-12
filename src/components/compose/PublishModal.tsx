"use client";

import { useState, useCallback } from "react";
import type { SocialAccount } from "@/lib/db/schema";
import { statusFor } from "@/lib/connection-status";

interface PublishModalProps {
  postId: string;
  facebookAccounts: SocialAccount[];
  instagramAccounts: SocialAccount[];
  linkedinAccounts: SocialAccount[];
  isOpen: boolean;
  onClose: () => void;
  onPublished: (targetIds: string[]) => void;
}

type Tab = "facebook" | "instagram" | "linkedin";

export function PublishModal({
  postId,
  facebookAccounts,
  instagramAccounts,
  linkedinAccounts,
  isOpen,
  onClose,
  onPublished,
}: PublishModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<Tab>("facebook");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAccount = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePublish = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/posts/${postId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socialAccountIds: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Publish failed");
      }
      const data = await res.json();
      onPublished(data.targets);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  }, [selectedIds, postId, onPublished, onClose]);

  const currentAccounts = activeTab === "facebook" ? facebookAccounts : activeTab === "instagram" ? instagramAccounts : linkedinAccounts;
  const hasAnyAccounts = facebookAccounts.length > 0 || instagramAccounts.length > 0 || linkedinAccounts.length > 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold mb-4">Publish</h2>

        {!hasAnyAccounts ? (
          <p className="text-gray-500 text-sm mb-4">
            No connected accounts.{" "}
            <a href="/clients" className="text-blue-600 underline">Connect accounts</a>
          </p>
        ) : (
          <>
            <div className="flex gap-2 mb-4 border-b">
              <button
                onClick={() => setActiveTab("facebook")}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === "facebook" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Facebook ({facebookAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab("instagram")}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === "instagram" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Instagram ({instagramAccounts.length})
              </button>
              <button
                onClick={() => setActiveTab("linkedin")}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
                  activeTab === "linkedin" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                LinkedIn ({linkedinAccounts.length})
              </button>
            </div>

            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
              {currentAccounts.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No {activeTab} accounts connected.{" "}
                  <a href="/clients" className="text-blue-600 underline">Connect</a>
                </p>
              ) : (
                currentAccounts.map((acc) => {
                  const connStatus = statusFor(acc.expiresAt);
                  const needsReconnect = connStatus === "reconnect_required";
                  return (
                    <label
                      key={acc.id}
                      className={`flex items-center gap-3 p-3 rounded border cursor-pointer ${
                        selectedIds.has(acc.id) ? "border-blue-500 bg-blue-50" :
                        needsReconnect ? "border-red-200 bg-red-50 opacity-60" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(acc.id)}
                        onChange={() => toggleAccount(acc.id)}
                        disabled={needsReconnect}
                        className="h-4 w-4 text-blue-600"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm flex items-center gap-2">
                          {acc.name}
                          {needsReconnect && (
                            <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">
                              Reconnect required
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{acc.platformAccountId}</div>
                        {needsReconnect && (
                          <a href="/clients" className="text-xs text-blue-600 underline mt-1 inline-block">
                            Reconnect now →
                          </a>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded p-3 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            disabled={publishing}
          >
            Cancel
          </button>
          <button
            onClick={handlePublish}
            disabled={selectedIds.size === 0 || publishing}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "Publishing..." : `Publish to ${selectedIds.size} account${selectedIds.size > 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}

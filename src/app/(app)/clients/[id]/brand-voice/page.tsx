import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

export default function BrandVoicePage({ clientId }: { clientId: string }) {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    tone: "professional",
    styleGuidelines: "",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBrandVoice = async () => {
      try {
        const res = await fetch(`/api/clients/${clientId}/brand-voice`);
        if (res.ok) {
          const data = await res.json();
          setForm({
            tone: data.tone || "professional",
            styleGuidelines: data.styleGuidelines || "",
          });
        } else if (res.status !== 404) {
          console.error("Failed to fetch brand voice");
        }
      } catch (e) {
        console.error("Error fetching brand voice:", e);
      }
    };
    fetchBrandVoice();
  }, [clientId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const method = form.tone ? "PUT" : "POST";
      const res = await fetch(`/api/clients/${clientId}/brand-voice`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save brand voice");
      }

      await mutate(`/api/clients/${clientId}/brand-voice`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Brand Voice Configuration</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block mb-2 font-semibold">Tone</label>
          <select
            value={form.tone}
            onChange={(e) => setForm({ ...form, tone: e.target.value })}
            className="w-full border rounded p-2"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="humorous">Humorous</option>
          </select>
        </div>

        <div>
          <label className="block mb-2 font-semibold">Style Guidelines (optional)</label>
          <textarea
            value={form.styleGuidelines}
            onChange={(e) => setForm({ ...form, styleGuidelines: e.target.value })}
            placeholder="Enter style guidelines, brand voice notes, etc..."
            className="w-full border rounded p-2 min-h-[100px]"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Brand Voice"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

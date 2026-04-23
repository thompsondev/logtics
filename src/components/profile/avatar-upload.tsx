"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  currentUrl: string | null;
  displayName: string;
}

export function AvatarUpload({ currentUrl, displayName }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    // Local preview while uploading
    setPreview(URL.createObjectURL(file));

    const form = new FormData();
    form.append("file", file);

    setUploading(true);
    try {
      const res = await fetch("/api/uploads/avatar", { method: "POST", body: form });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setError(json.error ?? "Upload failed");
        setPreview(currentUrl); // revert preview
        return;
      }

      setPreview(json.data.url);
      // Refetch /api/auth/me so the sidebar/header updates
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch {
      setError("Network error — please try again");
      setPreview(currentUrl);
    } finally {
      setUploading(false);
      // Reset input so the same file can be re-selected after an error
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Avatar circle */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title="Click to change avatar"
        className="relative w-24 h-24 rounded-full overflow-hidden ring-2 ring-blue-500/40
                   hover:ring-blue-500 transition focus:outline-none focus:ring-blue-500
                   disabled:opacity-60 disabled:cursor-not-allowed group"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={displayName} className="w-full h-full object-cover" />
        ) : (
          <span className="flex items-center justify-center w-full h-full bg-blue-600 text-white text-2xl font-bold">
            {initials}
          </span>
        )}

        {/* Hover overlay */}
        <span className="absolute inset-0 flex items-center justify-center
                         bg-black/40 opacity-0 group-hover:opacity-100 transition text-white text-xs font-medium">
          {uploading ? "Uploading…" : "Change"}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleChange}
      />

      <p className="text-xs text-gray-500">JPEG, PNG, WebP or GIF · max 5 MB</p>

      {error && (
        <p className="text-xs text-red-500 text-center max-w-xs">{error}</p>
      )}
    </div>
  );
}

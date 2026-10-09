"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost, ApiClientError } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/lib/types";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const { user } = await apiPost<{ user: { role: Role; mustChangePassword?: boolean } }>("/api/auth/login", {
        username,
        password,
      });
      await qc.invalidateQueries({ queryKey: ["session"] });
      // "/" resolves the landing page from the user's actual permissions on the server;
      // a password set by an administrator goes straight to choosing their own.
      router.push(user.mustChangePassword ? "/account/password" : "/");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "حصل خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={onSubmit} className="card p-8 w-full max-w-sm flex flex-col gap-4 shadow-card-hover">
        <div className="flex flex-col items-center gap-2 mb-2">
          <Image src="/logo-united.png" alt="UNITED" width={80} height={80} className="rounded-xl" />
          <h1 className="text-2xl font-extrabold text-united-dark">UNITED</h1>
          <p className="text-united-green font-bold">نظام التجهيز والتحميل</p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="font-bold">اسم المستخدم</span>
          <input
            className="field text-lg"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            autoComplete="username"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-bold">كلمة السر</span>
          <input
            type="password"
            className="field text-lg"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </label>

        {error && <p className="text-united-danger font-bold text-center">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="btn-primary text-xl"
        >
          {loading ? "..." : "دخول"}
        </button>
      </form>
    </main>
  );
}

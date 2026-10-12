"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const fieldClass =
  "h-11 w-full rounded-lg border border-line bg-paper text-base text-ink outline-none transition " +
  "focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/35 " +
  "disabled:bg-canvas disabled:text-muted";

export default function LoginForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const user = username.trim();
    if (!user || !password) {
      setError("กรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน");
      return;
    }

    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") || "/";

    setError(null);
    setPending(true);

    try {
      const result = await signIn("credentials", {
        username: user,
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error) {
        setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        setPending(false);
        return;
      }

      router.push(result.url ?? callbackUrl);
      router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setPending(false);
    }
  }

  return (
    <div className="login-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">เข้าสู่ระบบ</h1>
      <p className="mt-2 text-sm text-muted">ใช้บัญชีของคณะเพื่อเข้าใช้งานระบบ</p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-ink">
            ชื่อผู้ใช้
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={pending}
            required
            aria-required="true"
            className={`mt-2 px-3.5 ${fieldClass}`}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            รหัสผ่าน
          </label>
          <div className="relative mt-2">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={pending}
              required
              aria-required="true"
              aria-describedby={error ? "login-error" : undefined}
              className={`pl-3.5 pr-12 ${fieldClass}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.5A9.7 9.7 0 0112 5c5 0 9 4.5 9 7 0 .9-.6 2-1.6 3M6.2 6.2C4.2 7.6 3 9.6 3 12c0 2.5 4 7 9 7 1 0 2-.2 2.9-.6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M3 12c0-2.5 4-7 9-7s9 4.5 9 7-4 7-9 7-9-4.5-9-7z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                  />
                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div
            id="login-error"
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger/[0.06] px-3.5 py-2.5 text-[13px] leading-relaxed text-danger"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0" aria-hidden="true">
              <path
                d="M12 8v5m0 3.5h.01M10.3 3.9L2.6 17.4A2 2 0 004.3 20.4h15.4a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent text-[15px] font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pending ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
              กำลังเข้าสู่ระบบ…
            </>
          ) : (
            "เข้าสู่ระบบ"
          )}
        </button>
      </form>

      <p className="login-rise-late mt-7 border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
        หากยังไม่มีบัญชีหรือลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของคณะ
      </p>
    </div>
  );
}

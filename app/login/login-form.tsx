"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button, Input } from "antd";
import toast from "react-hot-toast";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  UserRound,
} from "lucide-react";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function showError(message: string) {
    setError(message);
    toast.error(message, { id: "auth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const user = username.trim();
    if (!user || !password) {
      showError("กรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน");
      return;
    }

    const callbackUrl =
      new URLSearchParams(window.location.search).get("callbackUrl") || "/";
    setError(null);
    setPending(true);
    toast.loading("กำลังเข้าสู่ระบบ…", { id: "auth" });

    try {
      const result = await signIn("credentials", {
        username: user,
        password,
        redirect: false,
        callbackUrl,
      });
      if (!result || result.error) {
        showError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง");
        return;
      }
      setPassword("");
      setShowPassword(false);
      toast.success("เข้าสู่ระบบสำเร็จ", { id: "auth" });
      router.push(result.url ?? callbackUrl);
      router.refresh();
    } catch {
      showError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">
        เข้าสู่ระบบ
      </h1>
      <p className="mt-2 text-sm text-muted">
        ใช้บัญชีของคณะเพื่อเข้าใช้งานระบบ
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="username"
            className="mb-2 block text-sm font-medium text-ink"
          >
            ชื่อผู้ใช้
          </label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            size="large"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            disabled={pending}
            required
            aria-required="true"
            aria-describedby={error ? "login-error" : undefined}
            status={error ? "error" : undefined}
            prefix={
              <UserRound
                size={18}
                className="mr-1 text-muted"
                aria-hidden="true"
              />
            }
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-ink"
          >
            รหัสผ่าน
          </label>
          <Input.Password
            id="password"
            name="password"
            autoComplete="current-password"
            size="large"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
            required
            aria-required="true"
            aria-describedby={error ? "login-error" : undefined}
            status={error ? "error" : undefined}
            prefix={
              <LockKeyhole
                size={18}
                className="mr-1 text-muted"
                aria-hidden="true"
              />
            }
            visibilityToggle={{
              visible: showPassword,
              onVisibleChange: setShowPassword,
            }}
            iconRender={(visible) =>
              visible ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )
            }
          />
        </div>

        {error && (
          <p id="login-error" className="sr-only">
            {error}
          </p>
        )}

        <Button
          htmlType="submit"
          type="primary"
          size="large"
          block
          loading={
            pending
              ? {
                  icon: (
                    <LoaderCircle
                      size={18}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ),
                }
              : false
          }
          disabled={pending}
          aria-busy={pending}
          icon={!pending && <LogIn size={18} aria-hidden="true" />}
        >
          {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
        </Button>
      </form>

      <p className="login-rise-late mt-7 border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
        หากยังไม่มีบัญชีหรือลืมรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบของคณะ
      </p>
    </div>
  );
}

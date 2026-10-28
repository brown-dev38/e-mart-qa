import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "./audit-log";

async function authHistory(id: string, name: string, action: "LOGIN" | "LOGOUT", failed = false) {
  try {
    await writeAudit(prisma, { id, name }, {
      action, entityType: "AUTH", entityId: id || null, entityLabel: name,
      summary: failed ? "เข้าสู่ระบบไม่สำเร็จ" : action === "LOGIN" ? "เข้าสู่ระบบ" : "ออกจากระบบ",
      outcome: failed ? "FAILED" : "SUCCESS",
    });
  } catch { console.error("Unable to record authentication audit event"); }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "ชื่อผู้ใช้", type: "text" },
        password: { label: "รหัสผ่าน", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username?.trim();
        const password = credentials?.password;
        if (!username || !password) return null;

        const user = await prisma.users.findFirst({
          where: { username },
          include: { role: true },
        });

        if (!user || !user.is_active || !user.password_hash) {
          await authHistory(user ? String(user.id) : "", username, "LOGIN", true);
          return null;
        }

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
          await authHistory(String(user.id), user.username, "LOGIN", true);
          return null;
        }

        return {
          id: String(user.id),
          name: user.username,
          role: user.role?.name ?? null,
        };
      },
    }),
  ],
  events: {
    async signIn({ user }) { await authHistory(user.id, user.name || "ไม่ทราบบัญชี", "LOGIN"); },
    async signOut(message) {
      if ("token" in message && message.token) await authHistory(String(message.token.uid || ""), message.token.name || "ไม่ทราบบัญชี", "LOGOUT");
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid ?? "";
        session.user.role = token.role ?? null;
      }
      return session;
    },
  },
};

export async function auth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !/^[1-9]\d{0,9}$/.test(session.user.id) || Number(session.user.id) > 2_147_483_647) return null;
  // Existing JWTs must not grant access after an account is deleted or disabled.
  const user = await prisma.users.findUnique({
    where: { id: Number(session.user.id) },
    select: { is_active: true, role: { select: { name: true, is_active: true } } },
  });
  if (!user?.is_active) return null;
  session.user.role = user.role?.is_active ? user.role.name : null;
  return session;
}

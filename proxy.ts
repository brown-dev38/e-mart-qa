import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { prisma } from "./lib/prisma";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Legacy files must also pass the revision/submission authorization checks.
  // Match the decoded path that the public-file server will use, including on Windows.
  let filePath: string;
  try { filePath = decodeURIComponent(pathname).replaceAll("\\", "/").toLowerCase(); }
  catch { return new NextResponse("Not found", { status: 404 }); }
  if (filePath === "/uploads/qa-documents" || filePath.startsWith("/uploads/qa-documents/")) {
    return new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
  }
  if (pathname !== "/" && pathname !== "/login") return NextResponse.next();
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const userId = typeof token?.uid === "string" && /^[1-9]\d{0,9}$/.test(token.uid) && Number(token.uid) <= 2_147_483_647
    ? Number(token.uid) : null;
  const user = userId === null ? null : await prisma.users.findUnique({ where: { id: userId }, select: { is_active: true } });
  const authenticated = user?.is_active === true;
  function clearInvalidSession(response: NextResponse) {
    if (token && !authenticated) {
      for (const { name } of request.cookies.getAll()) {
        if (/^(?:__Secure-)?next-auth\.session-token(?:\.\d+)?$/.test(name)) response.cookies.delete(name);
      }
    }
    return response;
  }

  if (pathname === "/" && !authenticated) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return clearInvalidSession(NextResponse.redirect(url));
  }

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return clearInvalidSession(NextResponse.next());
}

export const config = {
  matcher: ["/:path*"],
};

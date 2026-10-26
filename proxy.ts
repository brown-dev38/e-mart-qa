import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

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

  if (pathname === "/" && !token) {
    const url = new URL("/login", request.url);
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/:path*"],
};

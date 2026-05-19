import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ??
  process.env.NEXT_PUBLIC_AUTH_COOKIE_NAME ??
  "clara_access_token";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const authCookie = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!authCookie) {
    redirect("/login");
  }

  return children;
}

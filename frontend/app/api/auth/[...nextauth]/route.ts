import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const DEFAULT_ADMIN_EMAILS = [
  "admin@share2.me",
  "rishabh@share2.me",
  "rishabhdev2026@gmail.com",
  "rishabhyadav5281@gmail.com",
  "kamaltripathi1431@gmail.com",
  "ansh.vishwa2020@gmail.com",
  "adivishwakarma.work@gmail.com",
];

function getAllowedEmails(): string[] {
  const raw = process.env.AUTHORIZED_ADMIN_EMAILS || "";
  if (!raw.trim()) return DEFAULT_ADMIN_EMAILS;
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  secret: process.env.AUTH_JWT_SECRET || process.env.AUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      const email = user.email?.toLowerCase();
      const allowed = getAllowedEmails();
      if (!email || !allowed.includes(email)) {
        console.warn(`[NextAuth] Unauthorized login attempt from: ${email}`);
        return false; // Deny access
      }
      return true; // Allow access
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).adminAuthorized = true;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login", 
  },
});

export { handler as GET, handler as POST };

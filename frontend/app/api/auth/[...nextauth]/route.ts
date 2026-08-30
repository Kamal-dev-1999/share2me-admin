import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const allowedEmails = (process.env.AUTHORIZED_ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase());

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
      if (!email || !allowedEmails.includes(email)) {
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

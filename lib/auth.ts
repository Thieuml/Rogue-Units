import { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      // TEMPORARY: Allow all if bypass is enabled
      const BYPASS_SSO = process.env.BYPASS_SSO === 'true'
      if (BYPASS_SSO) {
        return true
      }
      
      // Restrict to WeMaintain domain
      const allowedDomain = process.env.GOOGLE_WORKSPACE_DOMAIN || "wemaintain.com"
      
      if (user.email && user.email.endsWith(`@${allowedDomain}`)) {
        return true
      }
      
      return false // Deny access for non-WeMaintain emails
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    },
  },
  pages: {
    signIn: '/auth/signin', // Custom sign-in page
  },
}


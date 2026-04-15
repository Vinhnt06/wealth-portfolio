import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }),
        Credentials({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email as string },
                });

                if (!user || !user.password) return null;

                const isValid = await bcrypt.compare(
                    credentials.password as string,
                    user.password
                );

                if (!isValid) return null;

                return {
                    id: user.id,
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    image: user.image,
                };
            },
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google" && user.email) {
                try {
                    // Extract name parts from Google profile
                    const nameParts = (user.name || "").split(" ");
                    const firstName = nameParts[0] || "User";
                    const lastName = nameParts.slice(1).join(" ") || "";

                    // Upsert: create if not exists, update image on login
                    await prisma.user.upsert({
                        where: { email: user.email },
                        update: {
                            image: user.image || undefined,
                            provider: "google",
                        },
                        create: {
                            email: user.email,
                            firstName,
                            lastName,
                            image: user.image || null,
                            provider: "google",
                        },
                    });
                } catch (error) {
                    console.error("Error upserting Google user:", error);
                    return false;
                }
            }
            return true;
        },
        async jwt({ token, user, trigger, session }) {
            if (user?.email) {
                // On sign in, fetch DB user to get the real ID
                const dbUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });
                if (dbUser) {
                    token.id = dbUser.id;
                    token.firstName = dbUser.firstName;
                    token.lastName = dbUser.lastName;
                    token.image = dbUser.image;
                }
            }
            // Handle session update (after profile edit)
            if (trigger === "update" && session) {
                token.firstName = session.firstName;
                token.lastName = session.lastName;
                token.image = session.image;
                token.name = `${session.firstName} ${session.lastName}`;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as any).firstName = token.firstName as string;
                (session.user as any).lastName = token.lastName as string;
                session.user.image = token.image as string;
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
    secret: process.env.NEXTAUTH_SECRET,
})

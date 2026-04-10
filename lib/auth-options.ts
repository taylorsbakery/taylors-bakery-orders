import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { debugLog, debugLogAction } from '@/lib/debug-logger';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          debugLog('AUTH_AUTHORIZE', { email: credentials?.email, reason: 'MISSING_CREDENTIALS' }, { result: 'failure', error: 'Missing email or password' });
          return null;
        }

        const action = debugLogAction('AUTH_AUTHORIZE', {}, { email: credentials.email });

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          if (!user) {
            action.failure('USER_NOT_FOUND', { email: credentials.email });
            return null;
          }

          debugLog('AUTH_USER_FOUND', {
            userId: user.id,
            role: user.role,
            parentAccountId: user.parentAccountId,
            namespace: user.role === 'admin' ? 'staff_session' : 'customer_session',
          });

          const valid = await bcrypt.compare(credentials.password, user?.passwordHash ?? '');
          if (!valid) {
            action.failure('INVALID_PASSWORD', { userId: user.id, email: credentials.email });
            return null;
          }

          const result = {
            id: user?.id ?? '',
            email: user?.email ?? '',
            name: user?.name ?? '',
            role: user?.role ?? 'customer',
            parentAccountId: user?.parentAccountId ?? null,
          };

          action.success({
            userId: result.id,
            role: result.role,
            parentAccountId: result.parentAccountId,
            namespace: result.role === 'admin' ? 'staff_session' : 'customer_session',
          });

          return result;
        } catch (e: any) {
          action.failure('AUTH_EXCEPTION', { error: e?.message });
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.role = user?.role ?? 'customer';
        token.userId = user?.id ?? '';
        token.parentAccountId = user?.parentAccountId ?? null;
        debugLog('AUTH_JWT_CREATED', {
          userId: token.userId,
          role: token.role,
          parentAccountId: token.parentAccountId,
          namespace: token.role === 'admin' ? 'staff_session' : 'customer_session',
        });
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).role = token?.role ?? 'customer';
        (session.user as any).id = token?.userId ?? '';
        (session.user as any).parentAccountId = token?.parentAccountId ?? null;
      }
      return session;
    },
  },
  events: {
    async signOut() {
      debugLog('AUTH_SIGNOUT', { timestamp: new Date().toISOString() });
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

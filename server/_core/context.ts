import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const AUTH_COOKIE_VALUE = "caixinha_autenticada_2026";

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const cookies = opts.req.headers.cookie;
  const isAuthenticated = cookies?.includes(`auth_token=${AUTH_COOKIE_VALUE}`);

  const user: User | null = isAuthenticated
    ? {
        id: 1,
        openId: "mock-user-local",
        name: "Organizador",
        email: "admin@caixinha.com",
        loginMethod: "password",
        role: "user",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      }
    : null;

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
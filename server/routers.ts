// server/routers.ts
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

// Importa os submódulos que criaste
import { dashboardProcedures } from "./routers/dashboard";
import { participantsProcedures } from "./routers/participants";
import { transactionsProcedures } from "./routers/transactions";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // A Mágica Acontece Aqui: Juntamos todos os pedaços num único Router chamado "caixinha"
  caixinha: router({
    ...dashboardProcedures,
    ...participantsProcedures,
    ...transactionsProcedures,
  }), 
});

export type AppRouter = typeof appRouter;
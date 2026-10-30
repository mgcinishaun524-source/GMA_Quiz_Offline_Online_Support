// Vercel serverless entry point.
//
// Vercel runs each file in /api as a serverless function. This file re-exports
// the Express `app` so every `/api/*` route in server.ts is reachable as a
// serverless handler. The `app.listen()` side effect in server.ts is guarded
// to skip binding a port while running on Vercel (process.env.VERCEL === '1'),
// so importing the app here never starts a long-lived server.
//
// Requests are routed here by vercel.json's rewrite rule (source "/api/(.*)"
// -> destination "/api/index"). The Express app's own routes are already
// mounted under "/api/...", so they match the original request path directly.

import { app } from '../server';

export default app;

// Vercel Serverless Function — Exporta o Express app
// O 'includeFiles' no vercel.json garante acesso ao dist/
import app from '../dist/index.js';
export default app;

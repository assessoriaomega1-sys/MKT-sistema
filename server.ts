import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use JSON middleware
  app.use(express.json());

  // API routes (if any)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development or fallback for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: '0.0.0.0',
        port: 3000
      },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // Fallback for SPA routing in development
    app.get('*', async (req, res, next) => {
      const url = req.originalUrl;

      // Skip API and static asset requests
      if (url.startsWith('/api') || url.includes('.')) {
        return next();
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // SPA Fallback: serve index.html for any non-file request
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API route not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on port ${PORT} (0.0.0.0)`);
  });
}

startServer().catch(err => {
  console.error("Critical error starting server:", err);
});

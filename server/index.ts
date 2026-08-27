import express, { type Request, Response, NextFunction } from "express";
import { serveStatic } from "./static";
import { createServer } from "http";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch (error: any) {
  if (error?.code !== "ENOENT") throw error;
}

const app = express();
const httpServer = createServer(app);

app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' https://fonts.gstatic.com; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob: https://i.ytimg.com https://yt3.ggpht.com https://*.googleusercontent.com; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    );
  }
  next();
});

app.use(
  express.json({
    // Three prepared thumbnail references may contain up to 12 MB of decoded
    // image data. Base64 and JSON framing require some headroom, but no active
    // request needs the former 50 MB process-wide allowance.
    limit: "18mb",
  }),
);

app.use(express.urlencoded({ extended: false, limit: "64kb", parameterLimit: 100 }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Never log response bodies. They may contain generated images, user
      // scripts, research payloads, or other private workspace content.
      log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
    }
  });

  next();
});

(async () => {
  const { registerRoutes } = await import("./routes");
  await registerRoutes(httpServer, app);

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    log(`unhandled request error (${status})`, "express");
    if (!res.headersSent) {
      res.status(status).json({ message: "Internal Server Error" });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve on the port from the environment, defaulting to 5000.
  // Bind loopback by default. This app holds a billable YouTube API key and the
  // host it runs on opens 1025-65535/tcp inbound, so binding 0.0.0.0 put it on
  // the LAN with no authentication in front of it. Set HOST explicitly if this
  // ever needs to be reachable from another machine.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "127.0.0.1";
  // Keep port sharing disabled. A second local instance must fail clearly
  // instead of distributing requests between stale development and production
  // servers.
  httpServer.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      log(
        `could not start on ${host}:${port}; the address is already in use. Stop the existing YouTube Pro server or set PORT to a free port.`,
      );
      process.exit(1);
    }
    throw error;
  });
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

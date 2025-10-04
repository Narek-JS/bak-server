import express, { Application, Request, Response } from "express";
import cors from "cors";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import imageRoutes from "./routes/imageRoutes";
import WebSocketService from "./services/websocketService";

class BakCamerasServer {
  private app: Application;
  private server: any;
  private wsService: WebSocketService | null = null;
  private readonly PORT: number = parseInt(process.env["PORT"] || "5000", 10);

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  private setupMiddleware(): void {
    // CORS configuration
    const corsOptions = {
      origin: [
        "https://bak-client.vercel.app",
        "http://bak-camera.portfolo.am",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:5178",
        "http://localhost:5179",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:5178",
        "http://127.0.0.1:5179",
      ],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Requested-With",
        "Accept",
        "Origin",
      ],
      optionsSuccessStatus: 200, // For legacy browser support
    };

    this.app.use(cors(corsOptions));

    // Body parsing middleware
    this.app.use(express.json({ limit: "50mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    // Static file serving for uploaded images
    const uploadsPath = path.join(__dirname, "../uploads");
    this.app.use("/uploads", express.static(uploadsPath));

    // Request logging middleware
    this.app.use((req: Request, _res: Response, next) => {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connectedClients: this.wsService?.getConnectedClients() || 0,
      });
    });

    // API status endpoint
    this.app.get("/api/status", (_req: Request, res: Response) => {
      res.json({
        success: true,
        message: "Bak Cameras Black & White Processing API is running",
        version: "1.0.0",
        endpoints: {
          imageUpload: "POST /api/images",
          imageList: "GET /api/images",
          imageDelete: "DELETE /api/images/:filename",
          websocket: "WS /ws",
          health: "GET /health",
        },
        connectedClients: this.wsService?.getConnectedClients() || 0,
      });
    });

    // API routes
    this.app.use("/api", imageRoutes);

    // Root endpoint
    this.app.get("/", (_req: Request, res: Response) => {
      res.json({
        message: "Welcome to Bak Cameras Black & White Processing API",
        version: "1.0.0",
        documentation: {
          imageUpload: "POST /api/images",
          websocket: "WS /ws",
          health: "GET /health",
          status: "GET /api/status",
        },
      });
    });

    // 404 handler
    this.app.use("*", (req: Request, res: Response) => {
      res.status(404).json({
        success: false,
        message: "Endpoint not found",
        path: req.originalUrl,
        method: req.method,
      });
    });
  }

  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, _req: Request, res: Response, _next: any) => {
      console.error("Global error handler:", error);

      // Multer errors
      if (error.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 10MB per file.",
          error: "FILE_SIZE_LIMIT_EXCEEDED",
        });
        return;
      }

      if (error.code === "LIMIT_FILE_COUNT") {
        res.status(400).json({
          success: false,
          message: "Too many files. Maximum is 10 files per request.",
          error: "FILE_COUNT_LIMIT_EXCEEDED",
        });
        return;
      }

      if (error.code === "LIMIT_UNEXPECTED_FILE") {
        res.status(400).json({
          success: false,
          message: 'Unexpected field name. Use "images" for file uploads.',
          error: "UNEXPECTED_FIELD",
        });
        return;
      }

      // Default error response
      res.status(error.status || 500).json({
        success: false,
        message: error.message || "Internal server error",
        error:
          process.env["NODE_ENV"] === "development" ? error.stack : undefined,
      });
    });
  }

  private ensureDirectories(): void {
    try {
      // Determine uploads directory based on environment
      const uploadsDir =
        process.env["NODE_ENV"] === "production"
          ? "/app/uploads"
          : path.join(__dirname, "../uploads");

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        console.log(`✅ Created uploads directory: ${uploadsDir}`);
      } else {
        console.log(`📁 Uploads directory already exists: ${uploadsDir}`);
      }

      // Verify the directory is writable
      fs.accessSync(uploadsDir, fs.constants.W_OK);
      console.log(`✅ Uploads directory is writable: ${uploadsDir}`);
    } catch (error) {
      console.error(`❌ Failed to create or access uploads directory:`, error);
      throw new Error(
        `Cannot create uploads directory: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public async start(): Promise<void> {
    try {
      // Ensure required directories exist
      this.ensureDirectories();

      // Create HTTP server
      this.server = createServer(this.app);

      // Initialize WebSocket service
      this.wsService = new WebSocketService(this.server);

      // Start server
      this.server.listen(this.PORT, () => {
        console.log("🚀 Bak Cameras Black & White Processing Server Started");
        console.log("================================");
        console.log(`📡 Server running on port ${this.PORT}`);
        console.log(`🌐 HTTP API: http://localhost:${this.PORT}`);
        console.log(`🔌 WebSocket: ws://localhost:${this.PORT}/ws`);
        console.log(`📊 Health Check: http://localhost:${this.PORT}/health`);
        console.log(`📋 API Status: http://localhost:${this.PORT}/api/status`);
        console.log("================================");
      });

      // Graceful shutdown handling
      this.setupGracefulShutdown();
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      if (this.wsService) {
        this.wsService.close();
      }

      if (this.server) {
        this.server.close(() => {
          console.log("Server closed successfully");
          process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
          console.error("Forced shutdown after timeout");
          process.exit(1);
        }, 10000);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  }

  public getApp(): Application {
    return this.app;
  }

  public getServer(): any {
    return this.server;
  }

  public getWebSocketService(): WebSocketService | null {
    return this.wsService;
  }
}

// Start the server
const server = new BakCamerasServer();
server.start().catch((error) => {
  console.error("Failed to start Bak Cameras Server:", error);
  process.exit(1);
});

export default BakCamerasServer;

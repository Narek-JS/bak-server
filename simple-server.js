const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const WebSocket = require("ws");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");

console.log("🚀 Starting Bak Cameras Server...");

const app = express();
const PORT = 5000;

// Middleware
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
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ensure uploads directory exists
const uploadsDir =
  process.env.NODE_ENV === "production"
    ? "/app/uploads"
    : path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
} else {
  console.log(`📁 Uploads directory already exists: ${uploadsDir}`);
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|tiff/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
});

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to Bak Cameras API",
    version: "1.0.0",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.post("/api/images", upload.array("images", 10), async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded",
      });
    }

    console.log(`📸 Received ${files.length} image(s) for upload`);

    const processedFiles = [];

    for (const file of files) {
      try {
        const processedPath = path.join(
          uploadsDir,
          `processed-${file.filename}`
        );

        await sharp(file.path)
          .resize(800, 600, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 85 })
          .toFile(processedPath);

        processedFiles.push({
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
          mimetype: file.mimetype,
        });

        console.log(`✅ Processed: ${file.originalname}`);
      } catch (error) {
        console.error(
          `❌ Error processing ${file.originalname}:`,
          error.message
        );
      }
    }

    res.json({
      success: true,
      message: "Files uploaded and processed successfully",
      data: {
        totalFiles: files.length,
        processedFiles: processedFiles.length,
        files: processedFiles,
      },
    });
  } catch (error) {
    console.error("❌ Upload error:", error);
    res.status(500).json({
      success: false,
      message: "Error uploading files",
      error: error.message,
    });
  }
});

// WebSocket handling
const server = createServer(app);
const wss = new WebSocket.Server({ server, path: "/ws" });

const clients = new Map();

wss.on("connection", (ws, req) => {
  const clientId = uuidv4();
  clients.set(clientId, { ws, isAlive: true });

  console.log(
    `🔌 Client ${clientId} connected from ${req.socket.remoteAddress}`
  );

  // Send welcome message
  ws.send(
    JSON.stringify({
      type: "connection",
      message: "Connected to Bak Cameras WebSocket server",
      clientId: clientId,
    })
  );

  ws.on("message", async (data) => {
    try {
      console.log(
        `📹 Received video chunk from client ${clientId}, size: ${data.length} bytes`
      );

      // Generate mock detection results
      const mockDetections = [];
      const numDetections = Math.floor(Math.random() * 4);

      for (let i = 0; i < numDetections; i++) {
        const labels = [
          "person",
          "car",
          "bicycle",
          "dog",
          "cat",
          "bottle",
          "laptop",
          "phone",
        ];
        const randomLabel =
          labels[Math.floor(Math.random() * labels.length)] || "object";

        mockDetections.push({
          id: i + 1,
          label: randomLabel,
          box: [
            Math.random() * 400,
            Math.random() * 300,
            Math.random() * 200 + 50,
            Math.random() * 150 + 50,
          ],
          confidence: Math.random() * 0.5 + 0.5,
        });
      }

      // Send detection results
      ws.send(
        JSON.stringify({
          type: "detection",
          data: mockDetections,
        })
      );
    } catch (error) {
      console.error(`❌ Error processing video chunk:`, error);
    }
  });

  ws.on("close", () => {
    console.log(`🔌 Client ${clientId} disconnected`);
    clients.delete(clientId);
  });

  ws.on("error", (error) => {
    console.error(`❌ WebSocket error for client ${clientId}:`, error);
    clients.delete(clientId);
  });
});

// Start server
server.listen(PORT, () => {
  console.log("🚀 Bak Cameras Server Started");
  console.log("================================");
  console.log(`📡 Server running on port ${PORT}`);
  console.log(`🌐 HTTP API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}/ws`);
  console.log(`📊 Health Check: http://localhost:${PORT}/health`);
  console.log("================================");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("🛑 SIGINT received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

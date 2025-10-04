import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import multer from "multer";

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir =
  process.env["NODE_ENV"] === "production"
    ? "/app/uploads"
    : path.join(__dirname, "../../uploads");

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✅ Created uploads directory in routes: ${uploadsDir}`);
  } else {
    console.log(`📁 Uploads directory already exists in routes: ${uploadsDir}`);
  }

  // Verify the directory is writable
  fs.accessSync(uploadsDir, fs.constants.W_OK);
  console.log(`✅ Uploads directory is writable in routes: ${uploadsDir}`);
} catch (error) {
  console.error(
    `❌ Failed to create or access uploads directory in routes:`,
    error
  );
  throw new Error(
    `Cannot create uploads directory: ${
      error instanceof Error ? error.message : "Unknown error"
    }`
  );
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    cb(null, uploadsDir);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  },
});

// File filter to only allow image files
const fileFilter = (
  _req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
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
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10, // Maximum 10 files per request
  },
  fileFilter: fileFilter,
});

// POST /images - Upload multiple images
router.post(
  "/images",
  upload.array("images", 10),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files uploaded",
        });
      }

      console.log(`Received ${files.length} image(s) for upload`);

      // Process each uploaded image (simplified - just save files)
      const processedFiles: Array<{
        originalName: string;
        filename: string;
        path: string;
        size: number;
        mimetype: string;
      }> = [];

      for (const file of files) {
        try {
          // Get file info
          const fileInfo = {
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
          };

          processedFiles.push(fileInfo);
          console.log(`Saved image: ${file.originalname} -> ${file.filename}`);
        } catch (error) {
          console.error(`Error processing image ${file.originalname}:`, error);
          // Continue processing other files even if one fails
        }
      }

      res.status(200).json({
        success: true,
        message: "Files uploaded successfully",
        data: {
          totalFiles: files.length,
          processedFiles: processedFiles.length,
          files: processedFiles.map((f) => ({
            originalName: f.originalName,
            filename: f.filename,
            size: f.size,
            mimetype: f.mimetype,
          })),
        },
      });
      return;
    } catch (error) {
      console.error("Error uploading files:", error);

      // Clean up uploaded files on error
      const files = req.files as Express.Multer.File[];
      if (files) {
        files.forEach((file) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        });
      }

      res.status(500).json({
        success: false,
        message: "Error uploading files",
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return;
    }
  }
);

// GET /images - Health check endpoint
router.get("/images", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "Black & White Video Processing Server is running",
    timestamp: new Date().toISOString(),
    service: "bw-video-processing-server",
  });
});

export default router;

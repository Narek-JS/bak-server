import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = process.env["NODE_ENV"] === "production" 
  ? "/app/uploads" 
  : path.join(__dirname, '../../uploads');

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
  console.error(`❌ Failed to create or access uploads directory in routes:`, error);
  throw new Error(`Cannot create uploads directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `image-${uniqueSuffix}${ext}`);
  }
});

// File filter to only allow image files
const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|bmp|tiff/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per file
    files: 10 // Maximum 10 files per request
  },
  fileFilter: fileFilter
});

// POST /images - Upload multiple images
router.post('/images', upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    console.log(`Received ${files.length} image(s) for upload`);

    // Process each uploaded image with sharp
    const processedFiles = [];
    
    for (const file of files) {
      try {
        // Get file info
        const fileInfo = {
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype
        };

        // Process image with sharp (resize and optimize)
        const processedPath = path.join(uploadsDir, `processed-${file.filename}`);
        
        await sharp(file.path)
          .resize(800, 600, { 
            fit: 'inside',
            withoutEnlargement: true 
          })
          .jpeg({ quality: 85 })
          .toFile(processedPath);

        // Get processed file stats
        const processedStats = fs.statSync(processedPath);
        
        processedFiles.push({
          ...fileInfo,
          processedPath: processedPath,
          processedSize: processedStats.size
        });

        console.log(`Processed image: ${file.originalname} -> ${file.filename}`);
      } catch (error) {
        console.error(`Error processing image ${file.originalname}:`, error);
        // Continue processing other files even if one fails
      }
    }

    // Clean up original files (optional - keep them for now)
    // files.forEach(file => {
    //   if (fs.existsSync(file.path)) {
    //     fs.unlinkSync(file.path);
    //   }
    // });

    res.status(200).json({
      success: true,
      message: 'Files uploaded and processed successfully',
      data: {
        totalFiles: files.length,
        processedFiles: processedFiles.length,
        files: processedFiles.map(f => ({
          originalName: f.originalName,
          filename: f.filename,
          size: f.size,
          processedSize: f.processedSize,
          mimetype: f.mimetype
        }))
      }
    });
    return;

  } catch (error) {
    console.error('Error uploading files:', error);
    
    // Clean up uploaded files on error
    if (req.files) {
      const files = req.files as Express.Multer.File[];
      files.forEach(file => {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error uploading files',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return;
  }
});

// GET /images - List uploaded images (for debugging)
router.get('/images', (_req: Request, res: Response) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'].includes(ext);
    });

    const fileDetails = imageFiles.map(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      return {
        filename: file,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      };
    });

    res.json({
      success: true,
      data: {
        totalImages: fileDetails.length,
        images: fileDetails
      }
    });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({
      success: false,
      message: 'Error listing images',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// DELETE /images/:filename - Delete a specific image
router.delete('/images/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params['filename'];
    if (!filename) {
      res.status(400).json({
        success: false,
        message: 'Filename parameter is required'
      });
      return;
    }
    const filePath = path.join(uploadsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      res.status(404).json({
        success: false,
        message: 'File not found'
      });
      return;
    }

    fs.unlinkSync(filePath);
    
    // Also try to delete processed version if it exists
    const processedPath = path.join(uploadsDir, `processed-${filename}`);
    if (fs.existsSync(processedPath)) {
      fs.unlinkSync(processedPath);
    }

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

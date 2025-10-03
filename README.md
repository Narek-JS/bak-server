# Bak Cameras Backend Server

A Node.js/Express backend server for the Bak Cameras real-time video processing application.

## Features

- **Image Upload API**: Handle multiple image uploads with processing
- **WebSocket Streaming**: Real-time video processing with mock AI detection
- **Image Processing**: Sharp-based image optimization and resizing
- **TypeScript**: Full type safety and modern development experience
- **Error Handling**: Comprehensive error handling and logging
- **CORS Support**: Cross-origin resource sharing for frontend integration

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **File Uploads**: Multer
- **WebSockets**: ws library
- **Image Processing**: Sharp
- **Development**: nodemon, ts-node

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- npm or yarn package manager

### Installation

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Development Mode**
   ```bash
   npm run dev
   ```

3. **Production Build**
   ```bash
   npm run build
   npm start
   ```

## API Endpoints

### HTTP Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | API welcome message and documentation |
| `GET` | `/health` | Health check with server status |
| `GET` | `/api/status` | Detailed API status and connected clients |
| `POST` | `/api/images` | Upload multiple images |
| `GET` | `/api/images` | List uploaded images |
| `DELETE` | `/api/images/:filename` | Delete specific image |

### WebSocket Endpoint

| Endpoint | Description |
|----------|-------------|
| `WS /ws` | Real-time video streaming and AI processing |

## API Documentation

### Image Upload

**POST** `/api/images`

Upload multiple images for AI model training.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `images`
- Max files: 10
- Max file size: 10MB per file
- Supported formats: JPEG, PNG, GIF, WebP, BMP, TIFF

**Response:**
```json
{
  "success": true,
  "message": "Files uploaded and processed successfully",
  "data": {
    "totalFiles": 3,
    "processedFiles": 3,
    "files": [
      {
        "originalName": "image1.jpg",
        "filename": "image-1234567890-123456789.jpg",
        "size": 1024000,
        "processedSize": 512000,
        "mimetype": "image/jpeg"
      }
    ]
  }
}
```

### WebSocket Communication

**Connection:** `ws://localhost:5000/ws`

**Client → Server:**
- Send video chunks (Blob/Buffer data) from MediaRecorder

**Server → Client:**
- Processed video chunks
- Detection results as JSON:
  ```json
  {
    "type": "detection",
    "data": [
      {
        "id": 1,
        "label": "person",
        "box": [100, 150, 200, 300],
        "confidence": 0.85
      }
    ]
  }
  ```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

### File Structure

```
server/
├── src/
│   ├── routes/
│   │   └── imageRoutes.ts      # Image upload endpoints
│   ├── services/
│   │   └── websocketService.ts # WebSocket handling
│   └── index.ts                # Main server entry point
├── uploads/                    # Uploaded images directory
├── dist/                       # Compiled JavaScript (production)
├── package.json
├── tsconfig.json
├── nodemon.json
└── README.md
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Start production server
- `npm run clean` - Remove compiled files

### Code Quality

The project uses strict TypeScript configuration with:
- Strict type checking
- No implicit any
- Unused variable detection
- Consistent casing enforcement

## Error Handling

The server includes comprehensive error handling for:

- **File Upload Errors**: Size limits, file type validation
- **WebSocket Errors**: Connection failures, message parsing
- **Server Errors**: Graceful shutdown, memory management
- **API Errors**: Proper HTTP status codes and error messages

## Security Features

- **CORS Configuration**: Restricted to frontend origins
- **File Type Validation**: Only image files allowed
- **File Size Limits**: 10MB per file, 10 files max
- **Input Sanitization**: Parameter validation and sanitization

## Performance

- **Image Processing**: Optimized with Sharp library
- **Memory Management**: Proper cleanup of resources
- **WebSocket Optimization**: Efficient binary data handling
- **Error Recovery**: Graceful handling of connection issues

## Integration with Frontend

The server is designed to work seamlessly with the Bak Cameras React frontend:

1. **Image Upload**: Frontend sends images to `/api/images`
2. **WebSocket Connection**: Frontend connects to `ws://localhost:5000/ws`
3. **Real-time Processing**: Video chunks processed and results returned
4. **CORS Support**: Frontend can make requests from `localhost:5173`

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   # Change port in .env or environment variable
   PORT=5001 npm run dev
   ```

2. **File Upload Fails**
   - Check file size (max 10MB)
   - Verify file type (images only)
   - Ensure uploads directory exists

3. **WebSocket Connection Fails**
   - Verify server is running on correct port
   - Check CORS configuration
   - Ensure WebSocket path is `/ws`

### Logs

The server provides detailed logging:
- Request/response logging
- WebSocket connection events
- Error details with stack traces
- Performance metrics

## License

MIT License - see package.json for details.

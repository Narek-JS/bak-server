import WebSocket from 'ws';
import { Server as HttpServer } from 'http';
import { v4 as uuidv4 } from 'uuid';

interface ClientConnection {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  lastPing: number;
}

interface DetectionResult {
  id: number;
  label: string;
  box: [number, number, number, number]; // [x, y, width, height]
  confidence?: number;
}

class WebSocketService {
  private wss: WebSocket.Server;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  constructor(server: HttpServer) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws',
      perMessageDeflate: false // Disable compression for better performance with video
    });

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        isAlive: true,
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);
      console.log(`Client ${clientId} connected from ${req.socket.remoteAddress}`);

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'connection',
        message: 'Connected to Bak Cameras WebSocket server',
        clientId: clientId
      });

      // Handle incoming messages
      ws.on('message', async (data: WebSocket.Data) => {
        try {
          await this.handleVideoChunk(clientId, data);
        } catch (error) {
          console.error(`Error processing video chunk from client ${clientId}:`, error);
          this.sendToClient(clientId, {
            type: 'error',
            message: 'Error processing video chunk'
          });
        }
      });

      // Handle pong responses
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Handle client disconnect
      ws.on('close', (code: number, reason: Buffer) => {
        console.log(`Client ${clientId} disconnected. Code: ${code}, Reason: ${reason.toString()}`);
        this.clients.delete(clientId);
      });

      // Handle errors
      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });
    });

    console.log('WebSocket server initialized on /ws');
  }

  private async handleVideoChunk(clientId: string, data: WebSocket.Data): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) {
      console.warn(`Client ${clientId} not found`);
      return;
    }

    try {
      // Convert WebSocket data to Buffer
      const videoBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
      
      console.log(`Received video chunk from client ${clientId}, size: ${videoBuffer.length} bytes`);

      // Process video chunk with sharp (placeholder AI processing)
      const processedBuffer = await this.processVideoChunk(videoBuffer);
      
      // Generate mock detection results for demonstration
      const detectionResults = this.generateMockDetections();
      
      // Send processed video chunk back to client
      if (processedBuffer && processedBuffer.length > 0) {
        client.ws.send(processedBuffer);
      }

      // Send detection results as JSON
      this.sendToClient(clientId, {
        type: 'detection',
        data: detectionResults
      });

    } catch (error) {
      console.error(`Error processing video chunk for client ${clientId}:`, error);
      throw error;
    }
  }

  private async processVideoChunk(videoBuffer: Buffer): Promise<Buffer | null> {
    try {
      // For demonstration, we'll apply a simple grayscale filter
      // In a real implementation, this would be replaced with actual AI processing
      
      // Note: This is a simplified example. Real video processing would require
      // more sophisticated handling of video frames and codecs
      
      // For now, we'll just return the original buffer
      // In production, you would:
      // 1. Decode the video frame
      // 2. Apply AI processing (object detection, etc.)
      // 3. Encode the processed frame back to video format
      
      return videoBuffer;
    } catch (error) {
      console.error('Error processing video chunk:', error);
      return null;
    }
  }

  private generateMockDetections(): DetectionResult[] {
    // Generate mock detection results for demonstration
    // In a real implementation, this would come from your AI model
    const mockDetections: DetectionResult[] = [];
    
    // Randomly generate 0-3 detections
    const numDetections = Math.floor(Math.random() * 4);
    
    for (let i = 0; i < numDetections; i++) {
      const labels = ['person', 'car', 'bicycle', 'dog', 'cat', 'bottle', 'laptop', 'phone'];
      const randomLabel = labels[Math.floor(Math.random() * labels.length)] || 'object';
      
      mockDetections.push({
        id: i + 1,
        label: randomLabel,
        box: [
          Math.random() * 400, // x
          Math.random() * 300, // y
          Math.random() * 200 + 50, // width
          Math.random() * 150 + 50  // height
        ],
        confidence: Math.random() * 0.5 + 0.5 // 0.5 to 1.0
      });
    }
    
    return mockDetections;
  }

  private sendToClient(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error(`Error sending data to client ${clientId}:`, error);
      }
    }
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.clients.forEach((client, clientId) => {
        if (!client.isAlive) {
          console.log(`Terminating inactive client ${clientId}`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        // Check if client hasn't responded to ping for too long
        if (Date.now() - client.lastPing > this.PONG_TIMEOUT) {
          console.log(`Client ${clientId} timed out`);
          client.ws.terminate();
          this.clients.delete(clientId);
          return;
        }

        client.isAlive = false;
        client.ws.ping();
      });
    }, this.PING_INTERVAL);
  }

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  public broadcastToAll(data: any): void {
    const message = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          console.error(`Error broadcasting to client ${client.id}:`, error);
        }
      }
    });
  }

  public disconnectClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.close();
      this.clients.delete(clientId);
      return true;
    }
    return false;
  }

  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.clients.forEach((client) => {
      client.ws.close();
    });
    
    this.wss.close();
    console.log('WebSocket service closed');
  }
}

export default WebSocketService;

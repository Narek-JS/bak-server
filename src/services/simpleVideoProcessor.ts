import WebSocket from "ws";
import { Server as HttpServer } from "http";
import { v4 as uuidv4 } from "uuid";
import { spawn, ChildProcess } from "child_process";

interface ClientConnection {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  lastPing: number;
  videoBuffer: Buffer[];
  ffmpegProcess?: ChildProcess;
}

class SimpleVideoProcessor {
  private wss: WebSocket.Server;
  private clients: Map<string, ClientConnection> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PONG_TIMEOUT = 10000; // 10 seconds

  constructor(server: HttpServer) {
    this.wss = new WebSocket.Server({
      server,
      path: "/ws",
      perMessageDeflate: false,
    });

    this.setupWebSocketServer();
    this.startPingInterval();
  }

  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket, req) => {
      const clientId = uuidv4();
      const client: ClientConnection = {
        id: clientId,
        ws,
        isAlive: true,
        lastPing: Date.now(),
        videoBuffer: [],
      };

      this.clients.set(clientId, client);
      console.log(
        `Client ${clientId} connected from ${req.socket.remoteAddress}`
      );

      // Send welcome message
      this.sendToClient(clientId, {
        type: "connection",
        message: "Connected to Simple Video Processor",
        clientId: clientId,
      });

      // Handle incoming messages
      ws.on("message", async (data: WebSocket.Data) => {
        try {
          const videoBuffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data as ArrayBuffer);

          console.log(
            `Received ${videoBuffer.length} bytes from client ${clientId}`
          );

          if (videoBuffer.length > 0) {
            // Add to buffer
            client.videoBuffer.push(videoBuffer);

            // Process if we have enough data (simple threshold)
            if (client.videoBuffer.length >= 5) {
              await this.processVideoBuffer(clientId);
            }
          }
        } catch (error) {
          console.error(
            `Error processing data from client ${clientId}:`,
            error
          );
        }
      });

      // Handle pong responses
      ws.on("pong", () => {
        const client = this.clients.get(clientId);
        if (client) {
          client.isAlive = true;
          client.lastPing = Date.now();
        }
      });

      // Handle client disconnect
      ws.on("close", (code: number, reason: Buffer) => {
        console.log(
          `Client ${clientId} disconnected. Code: ${code}, Reason: ${reason.toString()}`
        );
        this.cleanupClient(clientId);
      });

      // Handle errors
      ws.on("error", (error: Error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.cleanupClient(clientId);
      });
    });

    console.log("Simple Video Processor WebSocket server initialized on /ws");
  }

  private async processVideoBuffer(clientId: string): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client || client.videoBuffer.length === 0) return;

    try {
      // Combine all buffered video data
      const combinedBuffer = Buffer.concat(client.videoBuffer);
      console.log(
        `Processing ${combinedBuffer.length} bytes for client ${clientId}`
      );

      // Create a simple grayscale conversion using canvas-like approach
      // For now, let's just echo the data back as a test
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(combinedBuffer);
        console.log(
          `✅ Echoed ${combinedBuffer.length} bytes back to client ${clientId}`
        );
      }

      // Clear the buffer
      client.videoBuffer = [];
    } catch (error) {
      console.error(
        `Error processing video buffer for client ${clientId}:`,
        error
      );
    }
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

  private cleanupClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      if (client.ffmpegProcess && !client.ffmpegProcess.killed) {
        client.ffmpegProcess.kill();
      }
      this.clients.delete(clientId);
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

  public close(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.clients.forEach((client, clientId) => {
      this.cleanupClient(clientId);
      client.ws.close();
    });

    this.wss.close();
    console.log("Simple Video Processor closed");
  }
}

export default SimpleVideoProcessor;

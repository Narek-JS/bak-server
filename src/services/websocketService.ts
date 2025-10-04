import WebSocket from "ws";
import { Server as HttpServer } from "http";
import { v4 as uuidv4 } from "uuid";
import { spawn, ChildProcess } from "child_process";

interface ClientConnection {
  id: string;
  ws: WebSocket;
  isAlive: boolean;
  lastPing: number;
  ffmpegProcess?: ChildProcess;
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
      path: "/ws",
      perMessageDeflate: false, // Disable compression for better performance with video
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
      };

      this.clients.set(clientId, client);
      console.log(
        `Client ${clientId} connected from ${req.socket.remoteAddress}`
      );

      // Create FFmpeg process immediately for this client
      this.createFFmpegProcess(clientId);

      // Send welcome message
      this.sendToClient(clientId, {
        type: "connection",
        message: "Connected to Video Processing Server",
        clientId: clientId,
      });

      // Handle incoming messages - direct pipeline to FFmpeg
      ws.on("message", (data: WebSocket.Data) => {
        try {
          // Convert WebSocket data to Buffer
          const videoBuffer = Buffer.isBuffer(data)
            ? data
            : Buffer.from(data as ArrayBuffer);

          console.log(
            `Received message from client ${clientId}, size: ${videoBuffer.length} bytes`
          );

          if (videoBuffer.length > 0) {
            this.sendToFFmpeg(clientId, videoBuffer);
          } else {
            console.warn(`Received empty buffer from client ${clientId}`);
          }
        } catch (error) {
          console.error(
            `Error processing video chunk from client ${clientId}:`,
            error
          );
          this.sendToClient(clientId, {
            type: "error",
            message: "Error processing video chunk",
          });
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

    console.log("WebSocket server initialized on /ws");
  }

  private sendToFFmpeg(clientId: string, videoBuffer: Buffer): void {
    const client = this.clients.get(clientId);
    if (!client || !client.ffmpegProcess || client.ffmpegProcess.killed) {
      console.error(`FFmpeg process not available for client ${clientId}`);
      return;
    }

    try {
      if (client.ffmpegProcess.stdin && !client.ffmpegProcess.stdin.destroyed) {
        client.ffmpegProcess.stdin.write(videoBuffer);
        console.log(
          `✅ Sent ${videoBuffer.length} bytes to FFmpeg for client ${clientId}`
        );
      } else {
        console.error(`❌ FFmpeg stdin not available for client ${clientId}`);
      }
    } catch (error) {
      console.error(
        `❌ Error writing to FFmpeg stdin for client ${clientId}:`,
        error
      );
    }
  }

  private createFFmpegProcess(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    try {
      console.log(`Creating FFmpeg process for client ${clientId}`);

      // Spawn FFmpeg process with optimized real-time settings
      const ffmpegProcess = spawn(
        "ffmpeg",
        [
          "-fflags",
          "nobuffer", // Reduces latency by not buffering input
          "-i",
          "pipe:0", // Read input from stdin
          "-vf",
          "format=gray", // Apply the grayscale video filter
          "-f",
          "webm", // Set the output container format to WebM
          "pipe:1", // Write the output to stdout
        ],
        {
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      // Handle FFmpeg stdout - send processed chunks directly back to client
      ffmpegProcess.stdout?.on("data", (chunk: Buffer) => {
        console.log(
          `📥 FFmpeg stdout data for client ${clientId}, size: ${chunk.length} bytes`
        );

        if (client.ws.readyState === WebSocket.OPEN && chunk.length > 0) {
          try {
            client.ws.send(chunk);
            console.log(
              `✅ Sent processed grayscale chunk to client ${clientId}, size: ${chunk.length} bytes`
            );
          } catch (error) {
            console.error(
              `❌ Error sending chunk to client ${clientId}:`,
              error
            );
          }
        } else {
          console.warn(
            `❌ Cannot send chunk to client ${clientId}, WS state: ${client.ws.readyState}, chunk size: ${chunk.length}`
          );
        }
      });

      // Handle FFmpeg stderr - log all diagnostic output for debugging
      ffmpegProcess.stderr?.on("data", (data: Buffer) => {
        const output = data.toString();
        console.log(`FFmpeg stderr for client ${clientId}:`, output);
      });

      // Handle FFmpeg process errors
      ffmpegProcess.on("error", (error: Error) => {
        console.error(`FFmpeg process error for client ${clientId}:`, error);
        this.sendToClient(clientId, {
          type: "error",
          message: "FFmpeg process error occurred",
        });
      });

      // Handle FFmpeg process exit
      ffmpegProcess.on("exit", (code: number, signal: string) => {
        console.log(
          `FFmpeg process exited for client ${clientId} with code ${code}, signal: ${signal}`
        );
        // Don't recreate the process - let the client reconnect if needed
        client.ffmpegProcess = undefined as any;
      });

      // Store the process reference
      client.ffmpegProcess = ffmpegProcess;

      console.log(`✅ Created FFmpeg process for client ${clientId}`);
    } catch (error) {
      console.error(
        `Failed to create FFmpeg process for client ${clientId}:`,
        error
      );
      this.sendToClient(clientId, {
        type: "error",
        message: "Failed to initialize video processing",
      });
    }
  }

  private cleanupClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // Kill FFmpeg process if it exists
      if (client.ffmpegProcess && !client.ffmpegProcess.killed) {
        console.log(`Killing FFmpeg process for client ${clientId}`);
        client.ffmpegProcess.kill("SIGTERM");

        // Force kill after 5 seconds if it doesn't exit gracefully
        setTimeout(() => {
          if (client.ffmpegProcess && !client.ffmpegProcess.killed) {
            console.log(`Force killing FFmpeg process for client ${clientId}`);
            client.ffmpegProcess.kill("SIGKILL");
          }
        }, 5000);
      }

      // Remove client from map
      this.clients.delete(clientId);
      console.log(`Cleaned up client ${clientId}`);
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

    // Clean up all clients and their FFmpeg processes
    this.clients.forEach((client, clientId) => {
      this.cleanupClient(clientId);
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.close();
      }
    });

    this.wss.close();
    console.log("WebSocket service closed");
  }
}

export default WebSocketService;

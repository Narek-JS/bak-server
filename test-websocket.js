const WebSocket = require("ws");

// Test WebSocket connection
const ws = new WebSocket("ws://localhost:5000/ws");

ws.on("open", function open() {
  console.log("✅ Connected to WebSocket server");

  // Send a test message
  ws.send(
    JSON.stringify({
      type: "test",
      message: "Hello from test client",
    })
  );

  // Send some dummy binary data
  const testBuffer = Buffer.from("test video data");
  ws.send(testBuffer);

  console.log("📤 Sent test messages");
});

ws.on("message", function message(data) {
  console.log("📥 Received message:", data.length, "bytes");

  if (data instanceof Buffer) {
    console.log("   Binary data received");
  } else {
    try {
      const parsed = JSON.parse(data);
      console.log("   JSON data:", parsed);
    } catch (e) {
      console.log("   Text data:", data.toString());
    }
  }
});

ws.on("error", function error(err) {
  console.error("❌ WebSocket error:", err);
});

ws.on("close", function close() {
  console.log("🔌 WebSocket connection closed");
});

// Close after 5 seconds
setTimeout(() => {
  console.log("🔄 Closing test connection...");
  ws.close();
}, 5000);

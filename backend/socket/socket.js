const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

let io;

// Map: userId -> Set of socketIds (supports multiple tabs)
const onlineUsers = new Map();

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
  });

  // JWT authentication middleware for socket
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("Authentication error: No token"));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select("-password");
      if (!user) {
        return next(new Error("Authentication error: User not found"));
      }
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.user._id.toString();
    console.log(`🟢 User connected: ${socket.user.username} [${socket.id}]`);

    // Add socket to online users map
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update user online status in DB
    await User.findByIdAndUpdate(userId, { isOnline: true });

    // Broadcast updated online users list to all clients
    io.emit("onlineUsers", Array.from(onlineUsers.keys()));

    // Join user's personal room for private messages
    socket.join(userId);

    // ─── TYPING EVENTS ─────────────────────────────────────────
    socket.on("typing", ({ receiverId }) => {
      // Emit to receiver's room
      socket.to(receiverId).emit("userTyping", { senderId: userId });
    });

    socket.on("stopTyping", ({ receiverId }) => {
      socket.to(receiverId).emit("userStoppedTyping", { senderId: userId });
    });

    // ─── MARK MESSAGES READ ────────────────────────────────────
    socket.on("markRead", ({ senderId }) => {
      // Notify the sender that messages were read
      socket.to(senderId).emit("messagesRead", { readBy: userId });
    });

    // ─── DISCONNECT ────────────────────────────────────────────
    socket.on("disconnect", async () => {
      console.log(`🔴 User disconnected: ${socket.user.username} [${socket.id}]`);

      const userSockets = onlineUsers.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        if (userSockets.size === 0) {
          onlineUsers.delete(userId);
          // Update last seen and online status
          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
        }
      }

      io.emit("onlineUsers", Array.from(onlineUsers.keys()));
    });
  });

  console.log("✅ Socket.io initialized");
  return io;
};

// Helper: emit a new message to both sender and receiver rooms
const emitNewMessage = (message) => {
  if (!io) return;
  const senderId = message.sender._id
    ? message.sender._id.toString()
    : message.sender.toString();
  const receiverId = message.receiver._id
    ? message.receiver._id.toString()
    : message.receiver.toString();

  // Emit to both participants
  io.to(senderId).emit("newMessage", message);
  io.to(receiverId).emit("newMessage", message);
};

const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

module.exports = { initSocket, emitNewMessage, getIO };

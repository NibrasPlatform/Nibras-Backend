const { Server } = require("socket.io");
const env = require("../core/config/env");
const { registerRealtimeEvents } = require("./events");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: env.serverUrl,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    registerRealtimeEvents(io, socket);
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket(server) during server startup.");
  }
  return io;
};

module.exports = {
  initSocket,
  getIo,
};

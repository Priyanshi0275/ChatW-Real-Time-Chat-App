import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { token, user } = useAuth();
  const socketRef = useRef(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  // Map of userId -> boolean (is that user typing to me)
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    if (!token || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
        setOnlineUsers([]);
      }
      return;
    }

    const socket = io("http://localhost:5000", {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("onlineUsers", (userIds) => {
      setOnlineUsers(userIds);
    });

    socket.on("userTyping", ({ senderId }) => {
      setTypingUsers((prev) => ({ ...prev, [senderId]: true }));
    });

    socket.on("userStoppedTyping", ({ senderId }) => {
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[senderId];
        return next;
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      setOnlineUsers([]);
      setTypingUsers({});
    };
  }, [token, user]);

  const emitTyping = useCallback((receiverId) => {
    socketRef.current?.emit("typing", { receiverId });
  }, []);

  const emitStopTyping = useCallback((receiverId) => {
    socketRef.current?.emit("stopTyping", { receiverId });
  }, []);

  const emitMarkRead = useCallback((senderId) => {
    socketRef.current?.emit("markRead", { senderId });
  }, []);

  const onNewMessage = useCallback((cb) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on("newMessage", cb);
    return () => socket.off("newMessage", cb);
  }, []);

  const onMessagesRead = useCallback((cb) => {
    const socket = socketRef.current;
    if (!socket) return () => {};
    socket.on("messagesRead", cb);
    return () => socket.off("messagesRead", cb);
  }, []);

  const isOnline = useCallback(
    (userId) => onlineUsers.includes(userId),
    [onlineUsers]
  );

  const isTyping = useCallback(
    (userId) => !!typingUsers[userId],
    [typingUsers]
  );

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        onlineUsers,
        isOnline,
        isTyping,
        emitTyping,
        emitStopTyping,
        emitMarkRead,
        onNewMessage,
        onMessagesRead,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocket must be used within SocketProvider");
  return ctx;
};

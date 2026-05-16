import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import Message from "./Message";
import InputBox from "./InputBox";

const getInitials = (name = "") => name.slice(0, 2).toUpperCase();

const getAvatarColor = (name = "") => {
  const colors = [
    "linear-gradient(135deg,#6c63ff,#8b85ff)",
    "linear-gradient(135deg,#ec4899,#f472b6)",
    "linear-gradient(135deg,#14b8a6,#34d399)",
    "linear-gradient(135deg,#f59e0b,#fbbf24)",
    "linear-gradient(135deg,#3b82f6,#60a5fa)",
    "linear-gradient(135deg,#8b5cf6,#a78bfa)",
    "linear-gradient(135deg,#ef4444,#f87171)",
    "linear-gradient(135deg,#06b6d4,#22d3ee)",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + hash * 31;
  return colors[Math.abs(hash) % colors.length];
};

const isSameDay = (d1, d2) => {
  const a = new Date(d1);
  const b = new Date(d2);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const formatDateLabel = (dateStr) => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const ChatBox = ({ selectedUser, onNewMessage, onBack }) => {
  const { user: me } = useAuth();
  const { isOnline, isTyping, onNewMessage: socketOnNewMessage, onMessagesRead, emitMarkRead } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const selectedUserRef = useRef(selectedUser);

  // Keep ref in sync for use in socket callbacks
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  // Load messages when selected user changes
  useEffect(() => {
    if (!selectedUser) {
      setMessages([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await axios.get(`/api/messages/${selectedUser._id}`);
        setMessages(data);
        // Mark as read
        emitMarkRead(selectedUser._id);
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedUser, emitMarkRead]);

  // Scroll to bottom when messages load
  useEffect(() => {
    scrollToBottom(false);
  }, [loading, scrollToBottom]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom(true);
    }
  }, [messages.length, scrollToBottom]);

  // Listen for real-time incoming messages
  useEffect(() => {
    const unsub = socketOnNewMessage((message) => {
      const senderId = message.sender?._id || message.sender;
      const receiverId = message.receiver?._id || message.receiver;
      const myId = me?._id;
      const currentChatUserId = selectedUserRef.current?._id;

      const isMyMessage = senderId === myId;
      const isRelevant =
        (senderId === currentChatUserId && receiverId === myId) ||
        (senderId === myId && receiverId === currentChatUserId);

      if (isRelevant) {
  if (isMyMessage) return; // already handled optimistically
  setMessages((prev) => {
    if (prev.find((m) => m._id === message._id)) return prev;
    return [...prev, message];
  });
        if (!isMyMessage) {
          emitMarkRead(senderId);
        }
      } else if (!isMyMessage) {
        // Message is for another conversation
        onNewMessage?.(message);
      }
    });

    return unsub;
  }, [socketOnNewMessage, me, onNewMessage, emitMarkRead]);

  // Listen for read receipts
  useEffect(() => {
    const unsub = onMessagesRead(({ readBy }) => {
      if (readBy === selectedUserRef.current?._id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.sender?._id === me?._id || m.sender === me?._id
              ? { ...m, isRead: true }
              : m
          )
        );
      }
    });
    return unsub;
  }, [onMessagesRead, me]);

  const handleSend = useCallback(
    async (content) => {
      if (!selectedUser || !content.trim()) return;
      setSending(true);
      try {
        // Optimistic update — add local message immediately
        const tempId = `temp_${Date.now()}`;
        const optimistic = {
          _id: tempId,
          sender: { _id: me._id, username: me.username },
          receiver: { _id: selectedUser._id, username: selectedUser.username },
          content,
          isRead: false,
          createdAt: new Date().toISOString(),
          _temp: true,
        };
        setMessages((prev) => [...prev, optimistic]);

        const { data } = await axios.post(
          `/api/messages/send/${selectedUser._id}`,
          { content }
        );

        // Replace optimistic with real message
        setMessages((prev) =>
          prev.map((m) => (m._id === tempId ? data : m))
        );
      } catch (err) {
        console.error("Failed to send message:", err);
        // Remove optimistic on error
        setMessages((prev) => prev.filter((m) => !m._temp));
      } finally {
        setSending(false);
      }
    },
    [selectedUser, me]
  );

  // ─── No chat selected ───
  if (!selectedUser) {
    return (
      <div className="chat-window">
        <div className="no-chat">
          <div className="no-chat-icon">💬</div>
          <h2 className="no-chat-title">Welcome to ChatW</h2>
          <p className="no-chat-sub">
            Select a user from the sidebar to start a conversation
          </p>
        </div>
      </div>
    );
  }

  const online = isOnline(selectedUser._id);
  const typing = isTyping(selectedUser._id);

  // Build message list with date dividers
  const renderMessages = () => {
    const items = [];
    messages.forEach((msg, i) => {
      const prev = messages[i - 1];
      // Insert date divider when day changes
      if (!prev || !isSameDay(msg.createdAt, prev.createdAt)) {
        items.push(
          <div key={`divider-${msg._id}`} className="messages-date-divider">
            <span className="messages-date-label">
              {formatDateLabel(msg.createdAt)}
            </span>
          </div>
        );
      }
      items.push(
        <Message key={msg._id} message={msg} prevMessage={prev} />
      );
    });
    return items;
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        {/* Mobile back button */}
        <button className="mobile-back-btn" onClick={onBack} type="button">
          ←
        </button>

        <div
          className="avatar"
          style={{
            background: getAvatarColor(selectedUser.username),
            width: 40,
            height: 40,
            fontSize: 15,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}
        >
          {getInitials(selectedUser.username)}
        </div>

        <div className="chat-header-info">
          <div className="chat-header-name">{selectedUser.username}</div>
          <div className={`chat-header-status${online ? " online" : ""}`}>
            {typing ? "✍️ typing…" : online ? "● Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {loading ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13, marginTop: 40 }}>
            Loading messages…
          </div>
        ) : messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-chat-icon">👋</div>
            <div className="empty-chat-title">Say hello!</div>
            <div className="empty-chat-sub">
              Start the conversation with {selectedUser.username}
            </div>
          </div>
        ) : (
          renderMessages()
        )}

        {/* Typing indicator */}
        {typing && (
          <div className="typing-indicator">
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: getAvatarColor(selectedUser.username),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "white",
                flexShrink: 0,
              }}
            >
              {getInitials(selectedUser.username)}
            </div>
            <div className="typing-dots">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputBox
        onSend={handleSend}
        disabled={sending}
        receiverId={selectedUser._id}
      />
    </div>
  );
};

export default ChatBox;

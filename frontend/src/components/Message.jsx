import { useAuth } from "../context/AuthContext";

const formatTime = (dateStr) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Message = ({ message, prevMessage }) => {
  const { user: me } = useAuth();

  const isSent = message.sender?._id === me?._id || message.sender === me?._id;

  // Group consecutive messages from same sender
  const prevSenderId =
    prevMessage?.sender?._id || prevMessage?.sender;
  const currSenderId = message.sender?._id || message.sender;
  const isGroupStart = prevSenderId !== currSenderId;

  return (
    <div className={`message-row${isSent ? " sent" : " received"}${isGroupStart ? " group-start" : ""}`}>
      {/* Avatar for received messages */}
      {!isSent && (
        <div className={`message-avatar${!isGroupStart ? " hidden" : ""}`}>
          {isGroupStart
            ? (message.sender?.username || "?").slice(0, 2).toUpperCase()
            : null}
        </div>
      )}

      <div className="bubble-wrap">
        <div className={`bubble${isSent ? " sent" : " received"}`}>
          {message.content}
        </div>
        <div className="bubble-meta">
          <span className="bubble-time">{formatTime(message.createdAt)}</span>
          {isSent && (
            <span className="bubble-read" title={message.isRead ? "Read" : "Delivered"}>
              {message.isRead ? "✓✓" : "✓"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;

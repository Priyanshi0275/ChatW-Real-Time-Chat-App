import { useState, useRef, useCallback, useEffect } from "react";
import { useSocket } from "../context/SocketContext";

const InputBox = ({ onSend, disabled, receiverId }) => {
  const [text, setText] = useState("");
  const { emitTyping, emitStopTyping } = useSocket();
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [text]);

  const stopTyping = useCallback(() => {
    if (isTypingRef.current && receiverId) {
      emitStopTyping(receiverId);
      isTypingRef.current = false;
    }
  }, [emitStopTyping, receiverId]);

  const handleChange = (e) => {
    setText(e.target.value);

    if (!receiverId) return;

    // Emit typing
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emitTyping(receiverId);
    }

    // Reset stop-typing debounce
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1500);
  };

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
    stopTyping();
    clearTimeout(typingTimeoutRef.current);
    // Refocus
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, [text, disabled, onSend, stopTyping]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Cleanup on unmount or receiver change
  useEffect(() => {
    return () => {
      clearTimeout(typingTimeoutRef.current);
      stopTyping();
    };
  }, [receiverId, stopTyping]);

  return (
    <div className="input-area">
      <div className="input-form">
        <textarea
          ref={textareaRef}
          className="message-input"
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          maxLength={2000}
        />
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={!text.trim() || disabled}
          title="Send message"
          type="button"
        >
          ➤
        </button>
      </div>
    </div>
  );
};

export default InputBox;

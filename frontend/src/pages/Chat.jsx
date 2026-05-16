import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Sidebar from "../components/Sidebar";
import ChatBox from "../components/ChatBox";

const Chat = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/auth/users");
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  // Fetch unread counts
  const fetchUnreadCounts = useCallback(async () => {
    try {
      const { data } = await axios.get("/api/messages/unread/counts");
      setUnreadCounts(data);
    } catch (err) {
      console.error("Failed to fetch unread counts:", err);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchUnreadCounts();
  }, [fetchUsers, fetchUnreadCounts]);

  const handleSelectUser = useCallback((user) => {
    setSelectedUser(user);
    // Clear unread for this user
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[user._id];
      return next;
    });
    // On mobile, hide sidebar when a chat is selected
    setSidebarVisible(false);
  }, []);

  const handleNewIncomingMessage = useCallback((message) => {
    const senderId =
      message.sender?._id || message.sender;
    // If not currently chatting with this sender, increment unread
    setUnreadCounts((prev) => {
      if (selectedUser?._id === senderId) return prev;
      return { ...prev, [senderId]: (prev[senderId] || 0) + 1 };
    });
  }, [selectedUser]);

  return (
    <div className="chat-layout">
      <Sidebar
        users={users}
        selectedUser={selectedUser}
        onSelectUser={handleSelectUser}
        unreadCounts={unreadCounts}
        loading={loadingUsers}
        isVisible={sidebarVisible}
        onShowSidebar={() => setSidebarVisible(true)}
      />
      <ChatBox
        selectedUser={selectedUser}
        onNewMessage={handleNewIncomingMessage}
        onBack={() => setSidebarVisible(true)}
      />
    </div>
  );
};

export default Chat;

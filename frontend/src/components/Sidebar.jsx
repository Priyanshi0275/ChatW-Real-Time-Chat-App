import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const getInitials = (name = "") =>
  name.slice(0, 2).toUpperCase();

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

const formatLastSeen = (dateStr) => {
  if (!dateStr) return "Offline";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
};

const Sidebar = ({
  users,
  selectedUser,
  onSelectUser,
  unreadCounts,
  loading,
  isVisible,
  onShowSidebar,
}) => {
  const { user: me, logout } = useAuth();
  const { isOnline, isTyping } = useSocket();
  const [search, setSearch] = useState("");

  const filtered = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`sidebar${isVisible ? "" : " hidden-mobile"}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">💬</div>
            <span className="sidebar-brand-name">ChatW</span>
          </div>
          <div className="sidebar-actions">
            <button
              className="icon-btn danger"
              title="Logout"
              onClick={logout}
            >
              ⏻
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input
            className="search-input"
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Section label */}
      <div className="sidebar-section-label">
        {search ? `Results (${filtered.length})` : `All Users (${users.length})`}
      </div>

      {/* User list */}
      <div className="user-list">
        {loading ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            Loading users…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
            {search ? "No users found" : "No other users yet"}
          </div>
        ) : (
          filtered.map((u) => {
            const online = isOnline(u._id);
            const typing = isTyping(u._id);
            const unread = unreadCounts[u._id];

            return (
              <div
                key={u._id}
                className={`user-item${selectedUser?._id === u._id ? " active" : ""}`}
                onClick={() => onSelectUser(u)}
              >
                <div className="avatar-wrapper">
                  <div
                    className="avatar"
                    style={{ background: getAvatarColor(u.username) }}
                  >
                    {getInitials(u.username)}
                  </div>
                  <div className={`online-dot${online ? "" : " offline"}`} />
                </div>

                <div className="user-info">
                  <div className="user-name">{u.username}</div>
                  <div className={`user-status${online ? " online" : ""}`}>
                    {typing
                      ? "✍️ typing…"
                      : online
                      ? "Online"
                      : `Last seen ${formatLastSeen(u.lastSeen)}`}
                  </div>
                </div>

                {unread > 0 && (
                  <div className="unread-badge">{unread > 99 ? "99+" : unread}</div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Current user footer */}
      {me && (
        <div className="sidebar-me">
          <div className="avatar-wrapper">
            <div
              className="avatar sm"
              style={{ background: getAvatarColor(me.username) }}
            >
              {getInitials(me.username)}
            </div>
            <div className="online-dot" />
          </div>
          <div className="me-info">
            <div className="me-name">{me.username}</div>
            <div className="me-label">● You're online</div>
          </div>
          <button className="icon-btn danger" title="Logout" onClick={logout}>
            ⏻
          </button>
        </div>
      )}
    </div>
  );
};

export default Sidebar;

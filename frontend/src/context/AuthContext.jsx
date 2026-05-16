import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API_URL = "https://chatw-real-time-chat-app-backend.onrender.com/api";

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("chatw_token"));
  const [loading, setLoading] = useState(true);

  // Set axios default auth header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common["Authorization"];
    }
  }, [token]);

  // Verify token and load user on mount
  useEffect(() => {
    const loadUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const { data } = await axios.get(`${API_URL}/auth/me`);
        setUser(data);
      } catch (error) {
        console.error("Load user error:", error);

        localStorage.removeItem("chatw_token");
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [token]);

  const login = useCallback(async (email, password) => {
    const { data } = await axios.post(
      `${API_URL}/auth/login`,
      {
        email,
        password,
      }
    );

    localStorage.setItem("chatw_token", data.token);
    setToken(data.token);
    setUser(data.user);

    return data;
  }, []);

  const register = useCallback(async (username, email, password) => {
    const { data } = await axios.post(
      `${API_URL}/auth/register`,
      {
        username,
        email,
        password,
      }
    );

    localStorage.setItem("chatw_token", data.token);
    setToken(data.token);
    setUser(data.user);

    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("chatw_token");
    setToken(null);
    setUser(null);

    delete axios.defaults.headers.common["Authorization"];
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return ctx;
};
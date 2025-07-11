import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@store/authStore";
import { useSocket } from "@hooks/useSocket";
import LoginPage from "@pages/LoginPage";
import RegisterPage from "@pages/RegisterPage";
import ChatPage from "@pages/ChatPage";
import ProtectedRoute from "@components/layout/ProtectedRoute";
import LoadingSpinner from "@components/ui/LoadingSpinner";

function App() {
  const { isAuthenticated, isLoading } = useAuthStore();

  // Inicializar socket se autenticado
  useSocket();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <LoginPage />
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to="/chat" replace /> : <RegisterPage />
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/chat" : "/login"} replace />}
      />
    </Routes>
  );
}

export default App;

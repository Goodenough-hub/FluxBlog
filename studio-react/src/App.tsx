import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import ListPage from "./pages/List";
import EditorPage from "./pages/Editor";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<ListPage />} />
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

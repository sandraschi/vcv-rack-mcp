import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Apps } from "./pages/Apps";
import { Catalog } from "./pages/Catalog";
import { Chat } from "./pages/Chat";
import { Dashboard } from "./pages/Dashboard";
import { Depot } from "./pages/Depot";
import { Help } from "./pages/Help";
import { Jobs } from "./pages/Jobs";
import { Library } from "./pages/Library";
import { Logs } from "./pages/Logs";
import { Settings } from "./pages/Settings";
import { Skills } from "./pages/Skills";
import { Tools } from "./pages/Tools";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/depot" element={<Depot />} />
        <Route path="/depot/:patchId" element={<Depot />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/library" element={<Library />} />
        <Route path="/jobs" element={<Jobs />} />
        <Route path="/tools" element={<Tools />} />
        <Route path="/skills" element={<Skills />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/apps" element={<Apps />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/help" element={<Help />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

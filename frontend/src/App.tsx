import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { ChannelPage } from "./routes/ChannelPage";
import { HomePage } from "./routes/HomePage";
import { SearchPage } from "./routes/SearchPage";
import { UploadPage } from "./routes/UploadPage";
import { WatchPage } from "./routes/WatchPage";

export default function App() {
  return (
    <AuthProvider>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/watch/:videoId" element={<WatchPage />} />
          <Route path="/channel/:channelId" element={<ChannelPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </AuthProvider>
  );
}

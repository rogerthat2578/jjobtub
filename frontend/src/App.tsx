import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { AppLayout } from "./components/AppLayout";
import { AuthSessionNotice } from "./components/AuthSessionNotice";
import { ScrollToTop } from "./components/ScrollToTop";
import { ToastProvider } from "./components/ToastProvider";
import { AccountPage } from "./routes/AccountPage";
import { AuthPage } from "./routes/AuthPage";
import { ChannelPage } from "./routes/ChannelPage";
import { HomePage } from "./routes/HomePage";
import { NotificationsPage } from "./routes/NotificationsPage";
import { PersonalVideoListPage } from "./routes/PersonalVideoListPage";
import { PlaylistDetailPage } from "./routes/PlaylistDetailPage";
import { PlaylistLibraryPage } from "./routes/PlaylistLibraryPage";
import { SearchPage } from "./routes/SearchPage";
import { UploadPage } from "./routes/UploadPage";
import { WatchPage } from "./routes/WatchPage";
import {
  clearHistoryVideos,
  fetchHistoryVideos,
  fetchSubscribedVideos,
  removeHistoryVideo,
} from "./services/apiClient";

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthSessionNotice />
        <ScrollToTop />
        <AppLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route
              path="/subscriptions"
              element={
                <PersonalVideoListPage
                  title="구독"
                  description="구독한 채널의 최신 영상을 모아봅니다."
                  emptyMessage="아직 구독한 채널 영상이 없습니다."
                  loadVideos={fetchSubscribedVideos}
                />
              }
            />
            <Route
              path="/library"
              element={<PlaylistLibraryPage />}
            />
            <Route path="/library/:playlistId" element={<PlaylistDetailPage />} />
            <Route
              path="/history"
              element={
                <PersonalVideoListPage
                  title="기록"
                  description="최근 시청한 영상을 확인합니다."
                  emptyMessage="아직 시청 기록이 없습니다."
                  loadVideos={fetchHistoryVideos}
                  removeVideo={removeHistoryVideo}
                  removeLabel="기록 삭제"
                  removeSuccessMessage="시청 기록에서 삭제했습니다."
                  clearVideos={clearHistoryVideos}
                  clearLabel="전체 기록 삭제"
                />
              }
            />
            <Route path="/watch/:videoId" element={<WatchPage />} />
            <Route path="/channel/:channelId" element={<ChannelPage />} />
            <Route path="/my-channel" element={<ChannelPage isMine />} />
            <Route path="/upload" element={<UploadPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </ToastProvider>
    </AuthProvider>
  );
}

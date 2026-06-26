import { useState, type ReactNode } from "react";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Header onMenuClick={() => setIsSidebarOpen((isOpen) => !isOpen)} />
      <div className="app-body">
        <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
        {isSidebarOpen && (
          <button
            className="sidebar-backdrop"
            type="button"
            aria-label="메뉴 닫기"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

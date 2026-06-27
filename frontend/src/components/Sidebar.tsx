import { FolderClock, Home, ListVideo, Subtitles } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { label: "홈", icon: Home, to: "/" },
  { label: "구독", icon: Subtitles, to: "/subscriptions" },
  { label: "재생 목록", icon: ListVideo, to: "/library" },
  { label: "기록", icon: FolderClock, to: "/history" },
];

type SidebarProps = {
  isOpen: boolean;
  onNavigate: () => void;
};

export function Sidebar({ isOpen, onNavigate }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`} aria-label="주요 메뉴">
      {items.map((item) => (
        <NavLink className="sidebar-link" key={item.label} to={item.to} onClick={onNavigate}>
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </aside>
  );
}

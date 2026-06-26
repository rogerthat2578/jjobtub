import { Compass, FolderClock, Home, Library, Subtitles } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { label: "홈", icon: Home, to: "/" },
  { label: "탐색", icon: Compass, to: "/search?q=개발" },
  { label: "구독", icon: Subtitles, to: "/search?q=채널" },
  { label: "보관함", icon: Library, to: "/search?q=저장" },
  { label: "기록", icon: FolderClock, to: "/search?q=최근" },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="주요 메뉴">
      {items.map((item) => (
        <NavLink className="sidebar-link" key={item.label} to={item.to}>
          <item.icon size={20} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </aside>
  );
}

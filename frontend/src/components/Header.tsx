import {
  Bell,
  Heart,
  LogIn,
  LogOut,
  Menu,
  MessageCircle,
  Reply,
  Search,
  Sparkles,
  Trash2,
  Tv,
  Upload,
  UserCircle,
  UserPlus,
  UserRoundPlus,
  Video,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { deleteAllNotifications, deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../services/apiClient";
import type { AppNotification } from "../types/notification";
import { useToast } from "./ToastProvider";

type HeaderProps = {
  onMenuClick: () => void;
};

type NotificationFilter = "all" | "unread" | AppNotification["type"];

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>("all");
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isAccountOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isAccountOpen]);

  useEffect(() => {
    if (!isNotificationOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isNotificationOpen]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const refresh = () => {
      void loadNotifications();
    };

    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("jjobtub:notifications-refresh", refresh);
    window.addEventListener("storage", handleNotificationStorageRefresh);
    const intervalId = window.setInterval(refresh, 20000);
    const broadcastChannel = createNotificationBroadcastChannel(refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("jjobtub:notifications-refresh", refresh);
      window.removeEventListener("storage", handleNotificationStorageRefresh);
      window.clearInterval(intervalId);
      broadcastChannel?.close();
    };
  }, [user]);

  function handleNotificationStorageRefresh(event: StorageEvent) {
    if (event.key === "jjobtub:notifications-refresh") {
      void loadNotifications();
    }
  }

  async function loadNotifications() {
    if (!user) {
      return;
    }
    try {
      const result = await fetchNotifications();
      setNotifications(result.items);
      setUnreadCount(result.unreadCount);
    } catch {
      // Header notifications should never block the main page.
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    navigate(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : "/");
  }

  async function handleLogout() {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      await logout();
      setIsAccountOpen(false);
      showToast("로그아웃되었습니다.", "success");
    } catch {
      setAuthError("로그아웃하지 못했습니다.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleNotificationClick(notification: AppNotification) {
    await markNotificationRead(notification.id).catch(() => undefined);
    setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    setUnreadCount((count) => Math.max(count - (notification.readAt ? 0 : 1), 0));
    setIsNotificationOpen(false);
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
    }
  }

  async function handleReadAllNotifications() {
    await markAllNotificationsRead();
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
  }

  async function handleDeleteNotification(notification: AppNotification, event: { stopPropagation: () => void }) {
    event.stopPropagation();
    await deleteNotification(notification.id);
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
    setUnreadCount((count) => Math.max(count - (notification.readAt ? 0 : 1), 0));
  }

  async function handleDeleteAllNotifications() {
    await deleteAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
  }

  const filteredNotifications = filterNotifications(notifications, notificationFilter);
  const notificationFilters = buildNotificationFilters(notifications, unreadCount);

  return (
    <header className="topbar">
      <div className="brand-row">
        <button className="icon-button" type="button" aria-label="메뉴 열기" onClick={onMenuClick}>
          <Menu size={21} />
        </button>
        <Link className="brand" to="/">
          <span className="brand-mark">
            <Video size={19} />
          </span>
          <span>Video Platform</span>
        </Link>
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <input
          aria-label="검색어"
          placeholder="검색"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="search-button" type="submit" aria-label="검색">
          <Search size={20} />
        </button>
      </form>

      <div className="header-actions">
        <Link className="action-button" to="/upload">
          <Upload size={18} />
          <span>업로드</span>
        </Link>
        {user && (
          <div className="notification-menu" ref={notificationMenuRef}>
            <button
              className="icon-button notification-button"
              type="button"
              aria-label="알림"
              aria-expanded={isNotificationOpen}
              onClick={() => setIsNotificationOpen((isOpen) => !isOpen)}
            >
              <Bell size={22} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            {isNotificationOpen && (
              <div className="notification-popover">
                <div className="notification-popover-header">
                  <strong>알림</strong>
                  <button type="button" onClick={handleReadAllNotifications} disabled={unreadCount === 0}>
                    모두 읽음
                  </button>
                  <button type="button" onClick={handleDeleteAllNotifications} disabled={notifications.length === 0}>
                    모두 삭제
                  </button>
                </div>
                {notifications.length > 0 ? (
                  <>
                  <div className="notification-filter-row" aria-label="알림 필터">
                    {notificationFilters.map((filter) => (
                      <button
                        className={notificationFilter === filter.value ? "notification-filter-active" : ""}
                        key={filter.value}
                        type="button"
                        onClick={() => setNotificationFilter(filter.value)}
                      >
                        <span>{filter.label}</span>
                        <small>{filter.count}</small>
                      </button>
                    ))}
                  </div>
                  <div className="notification-list">
                    {filteredNotifications.map((notification) => (
                      <div
                        className={`notification-item notification-type-${notification.type.toLowerCase().replace("_", "-")} ${
                          notification.readAt ? "" : "notification-item-unread"
                        }`}
                        key={notification.id}
                      >
                        <span className="notification-type-icon" aria-hidden="true">
                          {renderNotificationIcon(notification.type)}
                        </span>
                        <button className="notification-item-copy" type="button" onClick={() => void handleNotificationClick(notification)}>
                          <span>{notification.message}</span>
                          <small>{notification.createdAt}</small>
                        </button>
                        <button
                          className="notification-delete-button"
                          type="button"
                          onClick={(event) => void handleDeleteNotification(notification, event)}
                          aria-label="알림 삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {filteredNotifications.length === 0 && <p className="notification-empty">이 필터에 해당하는 알림이 없습니다.</p>}
                  </>
                ) : (
                  <p className="notification-empty">새 알림이 없습니다.</p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="account-menu" ref={accountMenuRef}>
          <button
            className="icon-button"
            type="button"
            aria-label="계정"
            aria-expanded={isAccountOpen}
            onClick={() => setIsAccountOpen((isOpen) => !isOpen)}
          >
            <UserCircle size={24} />
          </button>
          {isAccountOpen && (
            <div className="account-popover">
              {user ? (
                <>
                  <div className="account-profile-card">
                    <span className="account-avatar">
                      {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserCircle size={34} />}
                    </span>
                    <span>
                      <small>내 계정</small>
                      <strong>{user.displayName}</strong>
                      <em>{user.email}</em>
                    </span>
                  </div>
                  {authError && <p className="form-error">{authError}</p>}
                  <div className="account-action-list">
                    {user.channelId && (
                      <Link className="account-link" to="/my-channel" onClick={() => setIsAccountOpen(false)}>
                        <Tv size={17} />
                        <span>내 채널</span>
                      </Link>
                    )}
                    <button className="account-link account-logout" type="button" onClick={handleLogout} disabled={isAuthSubmitting}>
                      <LogOut size={17} />
                      <span>{isAuthSubmitting ? "로그아웃 중" : "로그아웃"}</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="account-guest-card">
                    <span className="account-guest-icon">
                      <Sparkles size={22} />
                    </span>
                    <span>
                      <strong>jjobtub 시작하기</strong>
                      <small>로그인하면 업로드, 댓글, 좋아요, 구독을 사용할 수 있습니다.</small>
                    </span>
                  </div>
                  <div className="account-auth-actions">
                    <Link className="account-login-button" to="/login" onClick={() => setIsAccountOpen(false)}>
                      <LogIn size={17} />
                      <span>로그인</span>
                    </Link>
                    <Link className="account-create-button" to="/register" onClick={() => setIsAccountOpen(false)}>
                      <UserPlus size={17} />
                      <span>새 계정 만들기</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function createNotificationBroadcastChannel(refresh: () => void) {
  try {
    const channel = new BroadcastChannel("jjobtub:notifications");
    channel.onmessage = refresh;
    return channel;
  } catch {
    return null;
  }
}

function filterNotifications(notifications: AppNotification[], filter: NotificationFilter) {
  if (filter === "unread") {
    return notifications.filter((notification) => !notification.readAt);
  }
  if (filter === "all") {
    return notifications;
  }
  return notifications.filter((notification) => notification.type === filter);
}

function buildNotificationFilters(notifications: AppNotification[], unreadCount: number): Array<{ value: NotificationFilter; label: string; count: number }> {
  const typeCounts = notifications.reduce<Record<AppNotification["type"], number>>(
    (counts, notification) => ({ ...counts, [notification.type]: counts[notification.type] + 1 }),
    { COMMENT: 0, REPLY: 0, COMMENT_LIKE: 0, VIDEO_LIKE: 0, SUBSCRIPTION: 0 },
  );

  const filters: Array<{ value: NotificationFilter; label: string; count: number }> = [
    { value: "all", label: "전체", count: notifications.length },
    { value: "unread", label: "읽지 않음", count: unreadCount },
    { value: "COMMENT", label: "댓글", count: typeCounts.COMMENT },
    { value: "REPLY", label: "답글", count: typeCounts.REPLY },
    { value: "COMMENT_LIKE", label: "댓글 좋아요", count: typeCounts.COMMENT_LIKE },
    { value: "VIDEO_LIKE", label: "영상 좋아요", count: typeCounts.VIDEO_LIKE },
    { value: "SUBSCRIPTION", label: "구독", count: typeCounts.SUBSCRIPTION },
  ];

  return filters.filter((filter) => filter.value === "all" || filter.value === "unread" || filter.count > 0);
}

function renderNotificationIcon(type: AppNotification["type"]) {
  if (type === "REPLY") {
    return <Reply size={15} />;
  }
  if (type === "COMMENT_LIKE" || type === "VIDEO_LIKE") {
    return <Heart size={15} />;
  }
  if (type === "SUBSCRIPTION") {
    return <UserRoundPlus size={15} />;
  }
  return <MessageCircle size={15} />;
}

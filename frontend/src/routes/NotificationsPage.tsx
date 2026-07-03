import { Bell, CheckCheck, Heart, ListPlus, MessageCircle, Reply, Trash2, UserRoundPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { deleteAllNotifications, deleteNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from "../services/apiClient";
import type { AppNotification } from "../types/notification";

type NotificationFilter = "all" | "unread" | AppNotification["type"];
type NotificationPageInfo = {
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

const NOTIFICATION_PAGE_SIZE = 20;

export function NotificationsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [pageInfo, setPageInfo] = useState<NotificationPageInfo | null>(null);
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      void loadNotifications();
    }
  }, [activeFilter, page, user]);

  const filters = useMemo(() => buildNotificationFilters(notifications, unreadCount), [notifications, unreadCount]);

  async function loadNotifications() {
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchNotifications({ page, limit: NOTIFICATION_PAGE_SIZE, filter: activeFilter });
      setNotifications(result.items);
      setUnreadCount(result.unreadCount);
      setTotalCount(result.totalCount);
      setPageInfo(result.pageInfo);
    } catch {
      setError("알림을 불러오지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilterChange(filter: NotificationFilter) {
    setActiveFilter(filter);
    setPage(1);
  }

  async function handleReadAll() {
    await markAllNotificationsRead();
    const readAt = new Date().toISOString();
    setNotifications((items) => items.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    setUnreadCount(0);
  }

  async function handleDeleteAll() {
    if (notifications.length === 0 || !window.confirm("현재 조회된 알림을 포함해 모든 알림을 삭제할까요?")) {
      return;
    }

    await deleteAllNotifications();
    setNotifications([]);
    setUnreadCount(0);
    setTotalCount(0);
    setPageInfo({ page: 1, limit: NOTIFICATION_PAGE_SIZE, totalPages: 1, hasPreviousPage: false, hasNextPage: false });
    setPage(1);
  }

  async function handleNotificationClick(notification: AppNotification) {
    await markNotificationRead(notification.id).catch(() => undefined);
    setNotifications((items) => items.map((item) => (item.id === notification.id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    setUnreadCount((count) => Math.max(count - (notification.readAt ? 0 : 1), 0));
  }

  async function handleDeleteNotification(notification: AppNotification) {
    await deleteNotification(notification.id);
    setNotifications((items) => items.filter((item) => item.id !== notification.id));
    setUnreadCount((count) => Math.max(count - (notification.readAt ? 0 : 1), 0));
    setTotalCount((count) => Math.max(count - 1, 0));
  }

  if (!isAuthLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page-stack notifications-page">
      <div className="page-heading">
        <div>
          <h1>알림</h1>
          <p>댓글, 답글, 좋아요, 구독, 재생목록 활동을 한곳에서 확인합니다. 알림은 직접 삭제하기 전까지 보관됩니다.</p>
        </div>
        <div className="notifications-page-actions">
          <button className="pill-button" type="button" onClick={handleReadAll} disabled={unreadCount === 0}>
            <CheckCheck size={17} />
            모두 읽음
          </button>
          <button className="pill-button danger-button" type="button" onClick={handleDeleteAll} disabled={notifications.length === 0}>
            <Trash2 size={17} />
            모두 삭제
          </button>
        </div>
      </div>

      <div className="notification-filter-row notifications-filter-panel" aria-label="알림 필터">
        {filters.map((filter) => (
          <button
            className={activeFilter === filter.value ? "notification-filter-active" : ""}
            key={filter.value}
            type="button"
            onClick={() => handleFilterChange(filter.value)}
          >
            <span>{filter.label}</span>
            <small>{filter.count}</small>
          </button>
        ))}
      </div>

      <div className="archive-policy-panel" aria-label="알림 보관 정책">
        <strong>{totalCount.toLocaleString()}개 알림</strong>
        <span>자동 만료 없음</span>
        <span>페이지당 {NOTIFICATION_PAGE_SIZE.toLocaleString()}개 조회</span>
      </div>

      {error ? (
        <p className="empty-state">{error}</p>
      ) : isLoading ? (
        <p className="empty-state">알림을 불러오는 중입니다.</p>
      ) : notifications.length === 0 ? (
        <p className="empty-state">표시할 알림이 없습니다.</p>
      ) : (
        <section className="notifications-list-page" aria-label="알림 목록">
          {notifications.map((notification) => (
            <article className={`notifications-page-item notification-type-${notification.type.toLowerCase().replace("_", "-")} ${notification.readAt ? "" : "notifications-page-item-unread"}`} key={notification.id}>
              <span className="notifications-page-icon" aria-hidden="true">
                {renderNotificationIcon(notification.type)}
              </span>
              <div>
                {notification.linkUrl ? (
                  <Link to={notification.linkUrl} onClick={() => void handleNotificationClick(notification)}>
                    {notification.message}
                  </Link>
                ) : (
                  <strong>{notification.message}</strong>
                )}
                <small>{notification.createdAt}</small>
              </div>
              <button className="notification-delete-button" type="button" onClick={() => void handleDeleteNotification(notification)} aria-label="알림 삭제">
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </section>
      )}

      {pageInfo && pageInfo.totalPages > 1 && (
        <nav className="pagination-row notification-pagination" aria-label="알림 페이지">
          <button type="button" disabled={!pageInfo.hasPreviousPage || isLoading} onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}>
            이전
          </button>
          <span>
            {pageInfo.page.toLocaleString()} / {pageInfo.totalPages.toLocaleString()}
          </span>
          <button type="button" disabled={!pageInfo.hasNextPage || isLoading} onClick={() => setPage((currentPage) => currentPage + 1)}>
            다음
          </button>
        </nav>
      )}
    </div>
  );
}

function buildNotificationFilters(notifications: AppNotification[], unreadCount: number): Array<{ value: NotificationFilter; label: string; count: number }> {
  const typeCounts = notifications.reduce<Record<AppNotification["type"], number>>(
    (counts, notification) => ({ ...counts, [notification.type]: counts[notification.type] + 1 }),
    { COMMENT: 0, REPLY: 0, COMMENT_LIKE: 0, VIDEO_LIKE: 0, SUBSCRIPTION: 0, PLAYLIST: 0 },
  );

  const filters: Array<{ value: NotificationFilter; label: string; count: number }> = [
    { value: "all", label: "전체", count: notifications.length },
    { value: "unread", label: "읽지 않음", count: unreadCount },
    { value: "COMMENT", label: "댓글", count: typeCounts.COMMENT },
    { value: "REPLY", label: "답글", count: typeCounts.REPLY },
    { value: "COMMENT_LIKE", label: "댓글 좋아요", count: typeCounts.COMMENT_LIKE },
    { value: "VIDEO_LIKE", label: "영상 좋아요", count: typeCounts.VIDEO_LIKE },
    { value: "SUBSCRIPTION", label: "구독", count: typeCounts.SUBSCRIPTION },
    { value: "PLAYLIST", label: "재생목록", count: typeCounts.PLAYLIST },
  ];

  return filters.filter((filter) => filter.value === "all" || filter.value === "unread" || filter.count > 0);
}

function renderNotificationIcon(type: AppNotification["type"]) {
  if (type === "COMMENT") return <MessageCircle size={18} />;
  if (type === "REPLY") return <Reply size={18} />;
  if (type === "COMMENT_LIKE" || type === "VIDEO_LIKE") return <Heart size={18} />;
  if (type === "SUBSCRIPTION") return <UserRoundPlus size={18} />;
  if (type === "PLAYLIST") return <ListPlus size={18} />;
  return <Bell size={18} />;
}

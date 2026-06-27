import { LogOut, Menu, Search, Tv, Upload, UserCircle, Video } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "./ToastProvider";

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

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
                  <strong>계정</strong>
                  <p className="auth-helper">로그인하면 업로드, 댓글, 좋아요, 구독을 사용할 수 있습니다.</p>
                  <Link className="primary-button" to="/login" onClick={() => setIsAccountOpen(false)}>
                    로그인
                  </Link>
                  <Link className="auth-switch-link" to="/register" onClick={() => setIsAccountOpen(false)}>
                    새 계정 만들기
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

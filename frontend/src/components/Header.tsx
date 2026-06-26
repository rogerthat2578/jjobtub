import { Menu, Search, Upload, UserCircle, Video } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const { user, login, register, logout, isLoading } = useAuth();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("creator@jjobtub.local");
  const [password, setPassword] = useState("password123");
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

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      if (authMode === "register") {
        await register({ displayName, email, password });
      } else {
        await login({ email, password });
      }
      setIsAccountOpen(false);
    } catch {
      setAuthError(authMode === "register" ? "회원가입 정보를 확인하세요." : "이메일 또는 비밀번호를 확인하세요.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      await logout();
      setIsAccountOpen(false);
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
                  <strong>{user.displayName}</strong>
                  <small>{user.email}</small>
                  {authError && <p className="form-error">{authError}</p>}
                  <button className="primary-button" type="button" onClick={handleLogout} disabled={isAuthSubmitting}>
                    로그아웃
                  </button>
                </>
              ) : (
                <form className="login-form" onSubmit={handleAuthSubmit}>
                  <strong>{isLoading ? "계정 확인 중" : authMode === "register" ? "회원가입" : "로그인"}</strong>
                  {authMode === "register" && (
                    <label>
                      <span>이름</span>
                      <input
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                        type="text"
                        maxLength={60}
                      />
                    </label>
                  )}
                  <label>
                    <span>이메일</span>
                    <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
                  </label>
                  <label>
                    <span>비밀번호</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                    />
                  </label>
                  {authError && <p className="form-error">{authError}</p>}
                  <button className="primary-button" type="submit" disabled={isAuthSubmitting || isLoading}>
                    {isAuthSubmitting ? "처리 중" : authMode === "register" ? "가입하기" : "로그인"}
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => {
                      setAuthMode((mode) => (mode === "login" ? "register" : "login"));
                      setAuthError("");
                    }}
                  >
                    {authMode === "register" ? "이미 계정이 있어요" : "새 계정 만들기"}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

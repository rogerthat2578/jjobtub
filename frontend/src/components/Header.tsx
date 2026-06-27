import { Menu, Search, Upload, UserCircle, Video } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiRequestError } from "../services/apiClient";

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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  function clearAuthFields() {
    setDisplayName("");
    setEmail("");
    setPassword("");
    setAuthError("");
  }

  async function handleAuthSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();
    const validationMessage = validateAuthInput(authMode, {
      displayName: trimmedDisplayName,
      email: trimmedEmail,
      password,
    });
    if (validationMessage) {
      setAuthError(validationMessage);
      return;
    }

    setIsAuthSubmitting(true);
    setAuthError("");

    try {
      if (authMode === "register") {
        await register({ displayName: trimmedDisplayName, email: trimmedEmail, password });
      } else {
        await login({ email: trimmedEmail, password });
      }
      setIsAccountOpen(false);
      clearAuthFields();
    } catch (error) {
      setAuthError(toAuthErrorMessage(error, authMode));
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
      setAuthMode("login");
      clearAuthFields();
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
                  <p className="auth-helper">
                    {authMode === "register"
                      ? "새 계정을 만들면 내 채널이 자동으로 생성됩니다."
                      : "가입한 이메일과 비밀번호로 로그인하세요."}
                  </p>
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
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={authMode === "register" ? "name@example.com" : "이메일"}
                      type="email"
                      autoComplete={authMode === "register" ? "email" : "username"}
                    />
                  </label>
                  <label>
                    <span>비밀번호</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={authMode === "register" ? "8자 이상" : "비밀번호"}
                      type="password"
                      autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    />
                  </label>
                  {authError && <p className="form-error">{authError}</p>}
                  <button className="primary-button" type="submit" disabled={isAuthSubmitting || isLoading}>
                    {isAuthSubmitting ? "처리 중" : authMode === "register" ? "가입하기" : "로그인"}
                  </button>
                  <button
                    className="auth-switch-button"
                    type="button"
                    onClick={() => {
                      const nextMode = authMode === "login" ? "register" : "login";
                      setAuthMode(nextMode);
                      clearAuthFields();
                    }}
                  >
                    {authMode === "register" ? "로그인 화면으로 돌아가기" : "새 계정 만들기"}
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

function validateAuthInput(
  mode: "login" | "register",
  input: { displayName: string; email: string; password: string },
) {
  if (mode === "register" && !input.displayName) {
    return "이름을 입력하세요.";
  }
  if (!input.email) {
    return "이메일을 입력하세요.";
  }
  if (!input.email.includes("@")) {
    return "올바른 이메일 주소를 입력하세요.";
  }
  if (!input.password) {
    return "비밀번호를 입력하세요.";
  }
  if (mode === "register" && input.password.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  return "";
}

function toAuthErrorMessage(error: unknown, mode: "login" | "register") {
  if (error instanceof ApiRequestError) {
    if (mode === "register") {
      if (error.status === 409 || error.message.includes("Email already exists")) {
        return "이미 가입된 이메일입니다. 로그인하거나 다른 이메일을 사용하세요.";
      }
      if (error.status === 400) {
        return "이름, 이메일, 비밀번호를 다시 확인하세요. 비밀번호는 8자 이상이어야 합니다.";
      }
    }
    if (mode === "login" && error.status === 401) {
      return "이메일 또는 비밀번호가 맞지 않습니다.";
    }
  }
  return mode === "register" ? "회원가입에 실패했습니다. 입력 정보를 다시 확인하세요." : "로그인에 실패했습니다.";
}

import { KeyRound, Save, ShieldCheck, UserCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { ApiRequestError } from "../services/apiClient";

export function AccountPage() {
  const { user, isLoading, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) {
      return;
    }
    setDisplayName(user.displayName);
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (isLoading || !user) {
    return <p className="empty-state">계정 정보를 불러오는 중입니다.</p>;
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextDisplayName = displayName.trim();
    if (!nextDisplayName) {
      setProfileError("표시 이름을 입력하세요.");
      return;
    }

    setIsSavingProfile(true);
    setProfileError("");
    try {
      await updateProfile({
        displayName: nextDisplayName,
        avatarUrl: avatarUrl.trim(),
      });
      showToast("계정 정보가 저장되었습니다.", "success");
    } catch {
      setProfileError("계정 정보를 저장하지 못했습니다.");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validatePasswordInput(currentPassword, newPassword, confirmPassword);
    if (validationMessage) {
      setPasswordError(validationMessage);
      return;
    }

    setIsSavingPassword(true);
    setPasswordError("");
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("비밀번호가 변경되었습니다.", "success");
    } catch (error) {
      setPasswordError(toPasswordErrorMessage(error));
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="page-stack account-page">
      <section className="page-heading">
        <div>
          <h1>계정 관리</h1>
          <p>로그인 계정의 기본 정보와 비밀번호를 관리합니다.</p>
        </div>
      </section>

      <section className="account-overview-panel" aria-label="내 계정 요약">
        <span className="account-overview-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <UserCircle size={52} />}
        </span>
        <div>
          <strong>{user.displayName}</strong>
          <p>{user.email}</p>
          <small>가입일 {formatJoinedAt(user.createdAt)}</small>
        </div>
        {user.channelId && (
          <Link className="pill-button" to="/my-channel">
            내 채널
          </Link>
        )}
      </section>

      <div className="account-settings-grid">
        <form className="account-settings-card" onSubmit={handleProfileSubmit}>
          <header>
            <UserCircle size={22} />
            <div>
              <h2>프로필</h2>
              <p>서비스 안에서 보이는 이름과 아바타를 수정합니다.</p>
            </div>
          </header>
          <label>
            표시 이름
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
          </label>
          <label>
            아바타 URL
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://example.com/avatar.png"
            />
          </label>
          {profileError && <p className="form-error">{profileError}</p>}
          <button className="primary-button" type="submit" disabled={isSavingProfile}>
            <Save size={17} />
            {isSavingProfile ? "저장 중" : "프로필 저장"}
          </button>
        </form>

        <form className="account-settings-card" onSubmit={handlePasswordSubmit}>
          <header>
            <KeyRound size={22} />
            <div>
              <h2>비밀번호</h2>
              <p>현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.</p>
            </div>
          </header>
          <label>
            현재 비밀번호
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          <label>
            새 비밀번호
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="8자 이상"
            />
          </label>
          <label>
            새 비밀번호 확인
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
            />
          </label>
          {passwordError && <p className="form-error">{passwordError}</p>}
          <button className="primary-button" type="submit" disabled={isSavingPassword}>
            <ShieldCheck size={17} />
            {isSavingPassword ? "변경 중" : "비밀번호 변경"}
          </button>
        </form>
      </div>
    </div>
  );
}

function validatePasswordInput(currentPassword: string, newPassword: string, confirmPassword: string) {
  if (!currentPassword) {
    return "현재 비밀번호를 입력하세요.";
  }
  if (newPassword.length < 8) {
    return "새 비밀번호는 8자 이상이어야 합니다.";
  }
  if (newPassword !== confirmPassword) {
    return "새 비밀번호 확인이 일치하지 않습니다.";
  }
  if (currentPassword === newPassword) {
    return "새 비밀번호는 현재 비밀번호와 달라야 합니다.";
  }
  return "";
}

function toPasswordErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError && error.status === 401) {
    return "현재 비밀번호가 맞지 않습니다.";
  }
  return "비밀번호를 변경하지 못했습니다.";
}

function formatJoinedAt(createdAt?: string) {
  if (!createdAt) {
    return "정보 없음";
  }
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(createdAt));
}

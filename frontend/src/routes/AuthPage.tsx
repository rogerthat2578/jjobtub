import { LogIn, UserPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { ApiRequestError } from "../services/apiClient";

type AuthPageProps = {
  mode: "login" | "register";
};

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { user, login, register, isLoading } = useAuth();
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDisplayName = displayName.trim();
    const trimmedEmail = email.trim();
    const validationMessage = validateAuthInput(mode, {
      displayName: trimmedDisplayName,
      email: trimmedEmail,
      password,
    });
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      if (mode === "register") {
        await register({ displayName: trimmedDisplayName, email: trimmedEmail, password });
        showToast("회원가입이 완료되었습니다.", "success");
      } else {
        await login({ email: trimmedEmail, password });
        showToast("로그인되었습니다.", "success");
      }
      navigate("/");
    } catch (authError) {
      setError(toAuthErrorMessage(authError, mode));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-page-heading">
          {mode === "register" ? <UserPlus size={26} /> : <LogIn size={26} />}
          <h1>{mode === "register" ? "회원가입" : "로그인"}</h1>
          <p>{mode === "register" ? "계정을 만들면 내 채널이 자동으로 생성됩니다." : "가입한 이메일로 jjobtub에 로그인하세요."}</p>
        </div>

        {mode === "register" && (
          <label>
            <span>이름</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
          </label>
        )}
        <label>
          <span>이메일</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            type="email"
            autoComplete={mode === "register" ? "email" : "username"}
          />
        </label>
        <label>
          <span>비밀번호</span>
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={mode === "register" ? "8자 이상" : "비밀번호"}
            type="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting || isLoading}>
          {isSubmitting ? "처리 중" : mode === "register" ? "가입하기" : "로그인"}
        </button>
        <Link className="auth-switch-link" to={mode === "register" ? "/login" : "/register"}>
          {mode === "register" ? "이미 계정이 있어요" : "새 계정 만들기"}
        </Link>
      </form>
    </main>
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

import { useEffect } from "react";
import { useToast } from "./ToastProvider";

export function AuthSessionNotice() {
  const { showToast } = useToast();

  useEffect(() => {
    let lastNotifiedAt = 0;

    function handleUnauthorized() {
      const now = Date.now();
      if (now - lastNotifiedAt < 3000) {
        return;
      }
      lastNotifiedAt = now;
      showToast("로그인이 만료되었습니다. 다시 로그인해 주세요.", "error");
    }

    window.addEventListener("jjobtub:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("jjobtub:unauthorized", handleUnauthorized);
  }, [showToast]);

  return null;
}

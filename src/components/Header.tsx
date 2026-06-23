import { Menu, Search, Upload, UserCircle, Video } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

export function Header() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    navigate(trimmedQuery ? `/search?q=${encodeURIComponent(trimmedQuery)}` : "/");
  }

  return (
    <header className="topbar">
      <div className="brand-row">
        <button className="icon-button" type="button" aria-label="메뉴 열기">
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
        <button className="icon-button" type="button" aria-label="계정">
          <UserCircle size={24} />
        </button>
      </div>
    </header>
  );
}

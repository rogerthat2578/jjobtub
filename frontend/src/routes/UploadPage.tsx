import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UploadCloud } from "lucide-react";
import { videos } from "../data/videos";

export function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("개발");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("제목과 설명을 입력해 주세요.");
      return;
    }

    const fallbackId = videos[0]?.id ?? "";
    navigate(`/watch/${fallbackId}`);
  }

  return (
    <div className="upload-page">
      <div className="page-heading">
        <h1>영상 업로드</h1>
        <p>새 영상의 기본 정보를 입력하세요.</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label>
          <span>제목</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="영상 제목" />
        </label>
        <label>
          <span>설명</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="영상 설명"
            rows={5}
          />
        </label>
        <label>
          <span>카테고리</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>개발</option>
            <option>브이로그</option>
            <option>음악</option>
            <option>생산성</option>
            <option>라이프스타일</option>
          </select>
        </label>
        <label>
          <span>썸네일 URL</span>
          <input
            value={thumbnailUrl}
            onChange={(event) => setThumbnailUrl(event.target.value)}
            placeholder="https://..."
            type="url"
          />
        </label>
        {thumbnailUrl && (
          <div className="upload-preview">
            <img src={thumbnailUrl} alt="썸네일 미리보기" />
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit">
          <UploadCloud size={18} />
          등록 흐름 확인
        </button>
      </form>
    </div>
  );
}

import { UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createVideo, fetchVideos, uploadVideoFile } from "../services/apiClient";

export function UploadPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("개발");
  const [file, setFile] = useState<File | null>(null);
  const [channelId, setChannelId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchVideos()
      .then((result) => {
        const firstVideo = result.videos[0];
        if (firstVideo) {
          setChannelId(firstVideo.channelId);
        }
      })
      .catch(() => setError("업로드에 사용할 채널을 불러오지 못했습니다."));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !file) {
      setError("제목, 설명, MP4 파일을 모두 입력해 주세요.");
      return;
    }
    if (!channelId) {
      setError("업로드할 채널이 없습니다. seed 데이터를 먼저 확인해 주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const created = await createVideo({
        title,
        description,
        category,
        channelId,
      });
      await uploadVideoFile(created.id, file);
      navigate(`/watch/${created.id}`);
    } catch {
      setError("영상 업로드에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="upload-page">
      <div className="page-heading">
        <h1>영상 업로드</h1>
        <p>영상 정보와 MP4 파일을 선택해 업로드하세요.</p>
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
          <span>MP4 파일</span>
          <input
            accept="video/mp4"
            type="file"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          <UploadCloud size={18} />
          {isSubmitting ? "업로드 중" : "업로드"}
        </button>
      </form>
    </div>
  );
}

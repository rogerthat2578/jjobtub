import { LinkIcon, UploadCloud } from "lucide-react";
import { DragEvent, FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { createVideo, uploadVideoFile } from "../services/apiClient";

export function UploadPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("개발");
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "youtube">("file");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  function selectFile(nextFile: File | undefined | null) {
    if (!nextFile) {
      setFile(null);
      return;
    }

    const isMp4 = nextFile.type === "video/mp4" || nextFile.name.toLowerCase().endsWith(".mp4");
    if (!isMp4) {
      setFile(null);
      setError("MP4 파일만 업로드할 수 있습니다.");
      return;
    }

    setFile(nextFile);
    setError("");
  }

  function handleDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("제목과 설명을 입력해 주세요.");
      return;
    }
    if (uploadMode === "file" && !file) {
      setError("MP4 파일을 선택해 주세요.");
      return;
    }
    if (uploadMode === "youtube" && !youtubeUrl.trim()) {
      setError("YouTube 링크를 입력해 주세요.");
      return;
    }
    if (!user?.channelId) {
      setError("로그인 후 내 채널로 업로드할 수 있습니다.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const created = await createVideo({
        title,
        description,
        category,
        channelId: user.channelId,
        source: uploadMode === "youtube" ? "YOUTUBE" : "LOCAL",
        externalUrl: uploadMode === "youtube" ? youtubeUrl.trim() : undefined,
      });
      if (uploadMode === "file" && file) {
        await uploadVideoFile(created.id, file);
      }
      navigate(`/watch/${created.id}`);
    } catch {
      setError(uploadMode === "youtube" ? "YouTube 링크 등록에 실패했습니다." : "영상 업로드에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="upload-page">
      <div className="page-heading">
        <h1>영상 업로드</h1>
        <p>MP4 파일을 올리거나 YouTube 링크를 등록하세요.</p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <div className="segmented-control" role="tablist" aria-label="업로드 방식">
          <button
            className={uploadMode === "file" ? "segmented-active" : ""}
            type="button"
            role="tab"
            aria-selected={uploadMode === "file"}
            onClick={() => {
              setUploadMode("file");
              setError("");
            }}
          >
            <UploadCloud size={17} />
            파일 업로드
          </button>
          <button
            className={uploadMode === "youtube" ? "segmented-active" : ""}
            type="button"
            role="tab"
            aria-selected={uploadMode === "youtube"}
            onClick={() => {
              setUploadMode("youtube");
              setError("");
            }}
          >
            <LinkIcon size={17} />
            YouTube 링크
          </button>
        </div>
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
        {uploadMode === "file" ? (
          <label
            className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <UploadCloud size={28} />
            <span>MP4 파일을 끌어다 놓거나 클릭해서 선택하세요.</span>
            <small>{file ? file.name : "최대 500MB MP4 파일"}</small>
            <input accept="video/mp4" type="file" onChange={(event) => selectFile(event.target.files?.[0])} />
          </label>
        ) : (
          <label>
            <span>YouTube 링크</span>
            <input
              value={youtubeUrl}
              onChange={(event) => setYoutubeUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=VIDEO_ID"
              type="url"
            />
          </label>
        )}
        {error && <p className="form-error">{error}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting || isLoading || !user}>
          <UploadCloud size={18} />
          {isSubmitting ? "처리 중" : uploadMode === "youtube" ? "링크 등록" : "업로드"}
        </button>
      </form>
    </div>
  );
}

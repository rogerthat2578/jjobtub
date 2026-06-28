import { LinkIcon, UploadCloud } from "lucide-react";
import { DragEvent, FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { ApiRequestError, createVideo, uploadVideoFileWithProgress, uploadVideoThumbnail } from "../services/apiClient";

const MAX_UPLOAD_BYTES = 524288000;

export function UploadPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("개발");
  const [tagsInput, setTagsInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [uploadMode, setUploadMode] = useState<"file" | "youtube">("file");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);
  const [failedVideoId, setFailedVideoId] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitting]);

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
    if (nextFile.size > MAX_UPLOAD_BYTES) {
      setFile(null);
      setError("파일 크기가 500MB를 초과했습니다.");
      return;
    }

    setFile(nextFile);
    setFailedVideoId("");
    setError("");
  }

  function selectThumbnail(nextFile: File | undefined | null) {
    if (!nextFile) {
      setThumbnailFile(null);
      return;
    }

    const isSupportedImage = ["image/jpeg", "image/png", "image/webp"].includes(nextFile.type);
    if (!isSupportedImage) {
      setThumbnailFile(null);
      setError("썸네일은 JPG, PNG, WebP 이미지만 사용할 수 있습니다.");
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      setThumbnailFile(null);
      setError("썸네일 이미지는 5MB 이하만 사용할 수 있습니다.");
      return;
    }

    setThumbnailFile(nextFile);
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
      showToast("로그인 후 내 채널로 업로드할 수 있습니다.", "error");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setUploadProgress(uploadMode === "youtube" ? 100 : 0);
    setThumbnailProgress(0);
    setFailedVideoId("");
    setUploadStatus(uploadMode === "youtube" ? "YouTube 링크를 검증하는 중입니다." : "영상 정보를 생성하는 중입니다.");

    let createdVideoId = "";

    try {
      const created = await createVideo({
        title,
        description,
        category,
        channelId: user.channelId,
        source: uploadMode === "youtube" ? "YOUTUBE" : "LOCAL",
        externalUrl: uploadMode === "youtube" ? youtubeUrl.trim() : undefined,
        tags: parseTags(tagsInput),
      });
      createdVideoId = created.id;
      if (uploadMode === "file" && file) {
        setUploadStatus("MP4 파일을 업로드하는 중입니다. 창을 닫지 마세요.");
        await uploadVideoFileWithProgress(created.id, file, setUploadProgress);
        if (thumbnailFile) {
          setUploadStatus("썸네일 이미지를 업로드하는 중입니다.");
          await uploadVideoThumbnail(created.id, thumbnailFile, setThumbnailProgress);
        } else {
          setUploadStatus("썸네일 자동 추출을 시도했습니다. 실패하면 기본 썸네일이 표시됩니다.");
        }
      }
      setUploadStatus(uploadMode === "youtube" ? "YouTube 영상 등록이 완료되었습니다." : "영상 업로드가 완료되었습니다.");
      showToast(uploadMode === "youtube" ? "YouTube 영상이 등록되었습니다." : "영상 업로드가 완료되었습니다.", "success");
      navigate(`/watch/${created.id}`);
    } catch (submitError) {
      if (uploadMode === "file" && createdVideoId) {
        setFailedVideoId(createdVideoId);
      }
      setUploadStatus("업로드가 중단되었습니다. 같은 파일로 다시 시도할 수 있습니다.");
      setError(toUploadErrorMessage(submitError, uploadMode));
      showToast("업로드를 완료하지 못했습니다.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRetryUpload() {
    if (!failedVideoId || !file) {
      return;
    }

    setIsSubmitting(true);
    setError("");
    setUploadProgress(0);
    setThumbnailProgress(0);
    setUploadStatus("실패한 영상 업로드를 다시 시도하는 중입니다.");

    try {
      await uploadVideoFileWithProgress(failedVideoId, file, setUploadProgress);
      if (thumbnailFile) {
        setUploadStatus("썸네일 이미지를 다시 업로드하는 중입니다.");
        await uploadVideoThumbnail(failedVideoId, thumbnailFile, setThumbnailProgress);
      }
      setUploadStatus("영상 업로드가 완료되었습니다.");
      showToast("영상 업로드가 완료되었습니다.", "success");
      navigate(`/watch/${failedVideoId}`);
    } catch (retryError) {
      setError(toUploadErrorMessage(retryError, "file"));
      setUploadStatus("재시도에 실패했습니다. 네트워크 상태와 파일 크기를 확인해 주세요.");
      showToast("재시도에 실패했습니다.", "error");
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
        <label>
          <span>태그</span>
          <input
            value={tagsInput}
            onChange={(event) => setTagsInput(event.target.value)}
            placeholder="예: react, tutorial, vlog"
            maxLength={240}
          />
          <small>쉼표로 구분해 최대 12개까지 추가할 수 있습니다.</small>
        </label>
        {uploadMode === "file" ? (
          <>
            <label
              className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <UploadCloud size={28} />
              <span>MP4 파일을 끌어다 놓거나 클릭해서 선택하세요.</span>
              <small>{file ? `${file.name} · ${formatFileSize(file.size)}` : "최대 500MB MP4 파일"}</small>
              <input accept="video/mp4" type="file" onChange={(event) => selectFile(event.target.files?.[0])} />
            </label>
            <label>
              <span>썸네일 이미지</span>
              <input accept="image/jpeg,image/png,image/webp" type="file" onChange={(event) => selectThumbnail(event.target.files?.[0])} />
              <small>{thumbnailFile ? `${thumbnailFile.name} · ${formatFileSize(thumbnailFile.size)}` : "선택 사항, JPG/PNG/WebP 5MB 이하"}</small>
            </label>
          </>
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
        {isSubmitting && uploadMode === "file" && (
          <div className="upload-progress">
            {uploadStatus && <strong>{uploadStatus}</strong>}
            <span>영상 업로드 {uploadProgress}%</span>
            <progress max={100} value={uploadProgress} />
            {thumbnailFile && (
              <>
                <span>썸네일 업로드 {thumbnailProgress}%</span>
                <progress max={100} value={thumbnailProgress} />
              </>
            )}
          </div>
        )}
        {!isSubmitting && uploadStatus && <p className="upload-status-note">{uploadStatus}</p>}
        {error && <p className="form-error">{error}</p>}
        {failedVideoId && (
          <button className="pill-button" type="button" onClick={handleRetryUpload} disabled={isSubmitting}>
            실패한 업로드 재시도
          </button>
        )}
        <button className="primary-button" type="submit" disabled={isSubmitting || isLoading || !user}>
          <UploadCloud size={18} />
          {isSubmitting ? "처리 중" : uploadMode === "youtube" ? "링크 등록" : "업로드"}
        </button>
      </form>
    </div>
  );
}

function toUploadErrorMessage(error: unknown, mode: "file" | "youtube") {
  if (error instanceof ApiRequestError) {
    if (error.status === 413) {
      return "파일 크기가 서버 제한을 초과했습니다.";
    }
    if (error.status === 401) {
      return "업로드 권한을 확인해 주세요.";
    }
    if (error.status === 403) {
      return "내 채널에만 업로드할 수 있습니다.";
    }
    if (error.message) {
      return error.message;
    }
  }

  return mode === "youtube" ? "YouTube 링크 등록에 실패했습니다." : "영상 업로드에 실패했습니다.";
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 30)),
    ),
  ).slice(0, 12);
}

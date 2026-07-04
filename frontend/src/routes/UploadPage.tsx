import { VideoUploadPanel } from "../components/VideoUploadPanel";

export function UploadPage() {
  return (
    <div className="upload-page">
      <div className="page-heading">
        <h1>영상 업로드</h1>
        <p>MP4 파일을 올리거나 YouTube 링크를 등록하세요.</p>
      </div>
      <VideoUploadPanel />
    </div>
  );
}

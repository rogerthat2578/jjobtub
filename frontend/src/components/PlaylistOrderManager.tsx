import { GripVertical, Save, X } from "lucide-react";
import { DragEvent, useEffect, useState } from "react";
import type { Playlist } from "../types/playlist";
import type { Video } from "../types/video";

type PlaylistOrderManagerProps = {
  playlist: Playlist;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (videoIds: string[]) => Promise<void>;
};

export function PlaylistOrderManager({ playlist, isSaving, onCancel, onSave }: PlaylistOrderManagerProps) {
  const [orderedVideos, setOrderedVideos] = useState<Video[]>(playlist.videos);
  const [draggingVideoId, setDraggingVideoId] = useState("");

  useEffect(() => {
    setOrderedVideos(playlist.videos);
  }, [playlist]);

  function moveVideo(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      return;
    }
    setOrderedVideos((currentVideos) => {
      const sourceIndex = currentVideos.findIndex((video) => video.id === sourceId);
      const targetIndex = currentVideos.findIndex((video) => video.id === targetId);
      if (sourceIndex < 0 || targetIndex < 0) {
        return currentVideos;
      }
      const nextVideos = [...currentVideos];
      const [movedVideo] = nextVideos.splice(sourceIndex, 1);
      nextVideos.splice(targetIndex, 0, movedVideo);
      return nextVideos;
    });
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>, targetId: string) {
    event.preventDefault();
    moveVideo(draggingVideoId, targetId);
  }

  return (
    <section className="playlist-order-panel" aria-label="재생목록 순서 관리">
      <header className="playlist-order-header">
        <div>
          <h2>{playlist.name}</h2>
          <p>드래그앤드랍으로 재생 순서를 바꿀 수 있습니다.</p>
        </div>
        <button className="icon-button" type="button" onClick={onCancel} title="닫기">
          <X size={18} />
        </button>
      </header>
      <ol className="playlist-order-list">
        {orderedVideos.map((video, index) => (
          <li
            className={`playlist-order-item ${draggingVideoId === video.id ? "playlist-order-item-dragging" : ""}`}
            draggable
            key={video.id}
            onDragStart={() => setDraggingVideoId(video.id)}
            onDragOver={(event) => handleDragOver(event, video.id)}
            onDragEnd={() => setDraggingVideoId("")}
          >
            <GripVertical size={18} />
            <span className="playlist-order-index">{index + 1}</span>
            <img src={video.thumbnailUrl} alt="" />
            <span>
              <strong>{video.title}</strong>
              <small>{video.duration}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="playlist-order-actions">
        <button className="pill-button" type="button" onClick={onCancel} disabled={isSaving}>
          취소
        </button>
        <button
          className="primary-button"
          type="button"
          disabled={isSaving}
          onClick={() => onSave(orderedVideos.map((video) => video.id))}
        >
          <Save size={17} />
          {isSaving ? "저장 중" : "순서 저장"}
        </button>
      </div>
    </section>
  );
}

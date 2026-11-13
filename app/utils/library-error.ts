const messages: Record<string, string> = {
  AUDIO_SIZE: "MP3 不能超过 15 MiB。",
  COVER_SIZE: "封面不能超过 1 MiB。",
  UPLOAD_SIZE: "上传大小超过限制。",
  INVALID_METADATA: "请检查必填字段、年份和文字长度。",
  LIBRARY_QUOTA_EXCEEDED: "存储空间不足。",
  MISSING_AUDIO: "请选择 MP3 文件。",
  UNSUPPORTED_AUDIO: "请选择有效的 MP3 文件。",
  UNSUPPORTED_COVER: "封面仅支持 JPEG、PNG 和 WebP。",
  SONG_NOT_FOUND: "歌曲已不存在。",
  PLAYLIST_NOT_FOUND: "歌单已不存在。",
};

export function libraryError(error: unknown) {
  if (typeof error !== "object" || error === null) return "操作失败，请重试。";
  if ("statusCode" in error && error.statusCode === 401) return "登录已失效，请重新登录。";
  const body = "data" in error ? error.data : undefined;
  if (typeof body === "object" && body !== null) {
    const code = "code" in body ? body.code : "statusMessage" in body ? body.statusMessage : undefined;
    if (typeof code === "string" && messages[code]) return messages[code];
  }
  return "操作失败，请检查网络后重试。";
}

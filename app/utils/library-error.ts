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
  PLAYLIST_NAME_TAKEN: "歌单名称已存在。",
};

function libraryErrorBody(error: unknown) {
  const data =
    typeof error === "object" && error !== null && "data" in error ? error.data : undefined;
  return typeof data === "object" && data !== null ? data : {};
}

export function libraryErrorCode(error: unknown) {
  const body = libraryErrorBody(error);
  return "code" in body ? body.code : "statusMessage" in body ? body.statusMessage : undefined;
}

export function libraryFormError(error: unknown) {
  if (typeof error !== "object" || error === null) return { message: "操作失败，请重试。" };
  if ("statusCode" in error && error.statusCode === 401)
    return { message: "登录已失效，请重新登录。" };
  const code = libraryErrorCode(error);
  const message =
    typeof code === "string" && Object.hasOwn(messages, code) ? messages[code] : undefined;
  if (!message) return { message: "操作失败，请检查网络后重试。" };
  switch (code) {
    case "AUDIO_SIZE":
    case "MISSING_AUDIO":
    case "UNSUPPORTED_AUDIO":
      return { field: "audio", message };
    case "COVER_SIZE":
    case "UNSUPPORTED_COVER":
      return { field: "cover", message };
    case "PLAYLIST_NAME_TAKEN":
      return { field: "name", message };
    case "INVALID_METADATA": {
      const body = libraryErrorBody(error);
      const details = "data" in body ? body.data : undefined;
      if (typeof details !== "object" || details === null || !("field" in details))
        return { message };
      const reason = "reason" in details ? details.reason : undefined;
      const fieldMessage =
        reason === "required"
          ? "请填写此项。"
          : reason === "year"
            ? "请输入 1000 至 9999 的四位年份。"
            : "内容超过长度限制。";
      return { field: details.field, message: fieldMessage };
    }
    default:
      return { message };
  }
}

export function libraryError(error: unknown) {
  return libraryFormError(error).message;
}

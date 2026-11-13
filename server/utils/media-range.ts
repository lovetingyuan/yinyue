export function mediaRange(value: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(value);
  if (!match || size < 1) return null;
  const [, start, end] = match;
  if (!start) {
    const length = Math.min(Number(end), size);
    return length > 0 ? { offset: size - length, length } : null;
  }
  const offset = Number(start);
  const last = end ? Math.min(Number(end), size - 1) : size - 1;
  return offset <= last ? { offset, length: last - offset + 1 } : null;
}

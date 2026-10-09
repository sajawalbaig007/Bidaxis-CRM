/** Screenshot copied with the snipping tool. Returns null when the clipboard has no image. */
export function clipboardImageFile(data: DataTransfer | null): File | null {
  if (!data) return null;
  const fromItems = Array.from(data.items ?? []);
  for (const item of fromItems) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file || file.size <= 0) continue;
    const image = item.type.startsWith("image/") || file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
    if (image) return namedScreenshot(file);
  }
  const fromFiles = Array.from(data.files ?? []).find(
    (file) => file.size > 0 && (file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)),
  );
  return fromFiles ? namedScreenshot(fromFiles) : null;
}

function namedScreenshot(file: File): File {
  const type = file.type.startsWith("image/") ? file.type : "image/png";
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : type.includes("gif") ? "gif" : "png";
  const generic = !file.name || file.name === "blob" || /^image\.(png|jpe?g|gif|webp)$/i.test(file.name);
  if (!generic && file.type === type) return file;
  return new File([file], generic ? `screenshot.${ext}` : file.name, { type });
}

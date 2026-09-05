export function downloadTextFile(
  contents: string,
  filename: string,
  mimeType: string,
): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("File downloads are unavailable on this platform.");
  }

  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  const anchor = document.createElement("a");
  anchor.download = filename;
  anchor.href = url;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

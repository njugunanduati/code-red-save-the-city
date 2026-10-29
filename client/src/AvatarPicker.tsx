import { useRef, useState } from "react";

export const avatarColors: Record<string, string> = {mint: "#3ee0d2", gold: "#f7bb53", blue: "#64b8ff", coral: "#ff876b", violet: "#a79cff", rose: "#f084bd"};
export function AvatarBadge({value}: {value: string}) {
  return value.startsWith("data:image/png;base64,") ? <img className="avatar-badge" src={value} alt="Custom avatar" /> : <span className="avatar-badge" style={{background: avatarColors[value] || avatarColors.mint}} aria-hidden="true">●</span>;
}
export function AvatarPicker({value, onChange, disabled = false}: {value: string; onChange: (value: string) => void; disabled?: boolean}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  async function upload(file?: File) {
    const current = ++version.current;
    setError("");
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {setError("Choose a PNG, JPG or WebP image under 5 MB."); return;}
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      const size = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, (bitmap.width-size)/2, (bitmap.height-size)/2, size, size, 0, 0, 64, 64);
      bitmap.close();
      const image = canvas.toDataURL("image/png");
      if (image.length > 24000) throw new Error();
      if (version.current === current) onChange(image);
    } catch {setError("That image could not be opened. Please try another.");}
    finally {if (version.current === current) setBusy(false);}
  }
  return <fieldset className="avatar-picker" disabled={disabled || busy}><legend>Your avatar</legend>
    <div className="avatar-options">{Object.keys(avatarColors).map(key => <button type="button" key={key} className="avatar-option" aria-label={`${key} avatar`} aria-pressed={value === key} onClick={() => {setError(""); onChange(key);}}><AvatarBadge value={key}/></button>)}{value.startsWith("data:") && <AvatarBadge value={value}/>}</div>
    <label className="avatar-upload">{busy ? "Preparing image…" : "Upload your image"}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {void upload(event.target.files?.[0]); event.target.value="";}} /></label>
    <p className="note">Choose a responder color or a photo. Images are cropped to a square and shared with your squad.</p>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}

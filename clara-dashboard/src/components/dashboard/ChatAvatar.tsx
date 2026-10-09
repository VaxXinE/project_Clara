import { faUser } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

/** Inisial dari nama customer. Judul berupa nomor telepon tidak punya inisial, jadi memakai ikon orang. */
function initialsOf(title: string): string | null {
  const words = title
    .trim()
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word));

  if (words.length === 0) {
    return null;
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase();
}

export function ChatAvatar({ title, size = "md" }: { title: string; size?: "md" | "lg" }) {
  const initials = initialsOf(title);
  const dimension = size === "lg" ? "h-11 w-11 text-base" : "h-12 w-12 text-base";

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-clara-line bg-clara-wash font-bold text-clara-gold ${dimension}`}
    >
      {initials ?? <FontAwesomeIcon icon={faUser} className="h-4 w-4" />}
    </span>
  );
}

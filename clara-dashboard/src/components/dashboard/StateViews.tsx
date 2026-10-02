import Link from "next/link";

/**
 * Tiga tampilan state yang dipakai bersama: memuat, kosong, dan gagal.
 * Aturannya: selalu bilang apa yang terjadi dan apa langkah berikutnya, bukan sekadar "No data".
 */

export function LoadingState({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="clara-empty-state text-sm clara-text-secondary"
    >
      {message}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="clara-empty-state">
      <h2 className="text-lg font-semibold clara-text-primary">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 clara-text-secondary">
        {description}
      </p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="clara-button clara-button-primary mt-5">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="clara-alert clara-alert-danger">
      <p>{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="clara-button clara-button-secondary mt-3"
        >
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" memakai warna bahaya dan memfokuskan tombol Batal lebih dulu. */
  tone?: "default" | "danger";
};

type PromptOptions = {
  title: string;
  message?: React.ReactNode;
  label: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  required?: boolean;
};

type DialogRequest =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | {
      kind: "prompt";
      options: PromptOptions;
      resolve: (value: string | null) => void;
    };

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  promptText: (options: PromptOptions) => Promise<string | null>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const requestRef = useRef<DialogRequest | null>(null);

  const open = useCallback((next: DialogRequest) => {
    // Hanya satu dialog dalam satu waktu: dialog sebelumnya dianggap dibatalkan.
    const previous = requestRef.current;
    if (previous?.kind === "confirm") previous.resolve(false);
    if (previous?.kind === "prompt") previous.resolve(null);
    requestRef.current = next;
    setRequest(next);
  }, []);

  const close = useCallback(() => {
    requestRef.current = null;
    setRequest(null);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        open({ kind: "confirm", options, resolve });
      }),
    [open],
  );

  const promptText = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>((resolve) => {
        open({ kind: "prompt", options, resolve });
      }),
    [open],
  );

  const value = useMemo(() => ({ confirm, promptText }), [confirm, promptText]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {request ? <DialogView request={request} onClose={close} /> : null}
    </ConfirmContext.Provider>
  );
}

function DialogView({
  request,
  onClose,
}: {
  request: DialogRequest;
  onClose: () => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const inputId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [showRequiredHint, setShowRequiredHint] = useState(false);

  const isDanger = request.kind === "confirm" && request.options.tone === "danger";
  const options = request.options;
  const confirmLabel = options.confirmLabel ?? (request.kind === "prompt" ? "Simpan" : "Ya, lanjutkan");
  const cancelLabel = options.cancelLabel ?? "Batal";

  const cancel = useCallback(() => {
    if (request.kind === "confirm") request.resolve(false);
    else request.resolve(null);
    onClose();
  }, [onClose, request]);

  const accept = useCallback(() => {
    if (request.kind === "confirm") {
      request.resolve(true);
      onClose();
      return;
    }

    const cleaned = text.trim();
    if (request.options.required && !cleaned) {
      setShowRequiredHint(true);
      inputRef.current?.focus();
      return;
    }
    request.resolve(cleaned);
    onClose();
  }, [onClose, request, text]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = window.requestAnimationFrame(() => {
      if (request.kind === "prompt") inputRef.current?.focus();
      else if (isDanger) cancelRef.current?.focus();
      else confirmRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
    // Fokus awal hanya ditentukan sekali saat dialog muncul.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cancel]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cancel();
      }}
    >
      <div
        ref={dialogRef}
        role={request.kind === "confirm" ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={options.message ? messageId : undefined}
        className="clara-card w-full max-w-md rounded-2xl p-5 shadow-[var(--shadow-floating)] sm:p-6"
      >
        <h2 id={titleId} className="clara-card-title text-lg">
          {options.title}
        </h2>

        {options.message ? (
          <div
            id={messageId}
            className="clara-text-secondary mt-2 text-sm leading-6"
          >
            {options.message}
          </div>
        ) : null}

        {request.kind === "prompt" ? (
          <div className="mt-4">
            <label htmlFor={inputId} className="clara-label">
              {request.options.label}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setShowRequiredHint(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  accept();
                }
              }}
              placeholder={request.options.placeholder}
              className="clara-input mt-2"
              aria-invalid={showRequiredHint}
              aria-describedby={showRequiredHint ? `${inputId}-hint` : undefined}
            />
            {showRequiredHint ? (
              <p
                id={`${inputId}-hint`}
                role="alert"
                className="mt-2 text-sm text-[var(--color-danger)]"
              >
                Isi dulu bagian ini supaya bisa dilanjutkan.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={cancel}
            className="clara-button clara-button-ghost"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={accept}
            className={`clara-button ${
              isDanger ? "clara-button-danger" : "clara-button-primary"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function useConfirmContext(): ConfirmContextValue {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm harus dipakai di dalam ConfirmProvider.");
  }
  return context;
}

/** Pengganti `window.confirm`: `if (!(await confirm({ title, message }))) return;` */
export function useConfirm() {
  return useConfirmContext().confirm;
}

/** Pengganti `window.prompt` untuk meminta satu isian teks. Hasil `null` berarti dibatalkan. */
export function usePromptText() {
  return useConfirmContext().promptText;
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import type {
  ChannelDefinitionItem,
  ChannelDetectResponse,
  UploadConversationResponse,
} from "@/types/dashboard";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const INPUT_MODE_OPTIONS = [
  { value: "file", label: "Upload file .txt" },
  { value: "paste", label: "Paste chat langsung" },
] as const;

export function WhatsAppUploadForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const initialTitle = searchParams.get("title") ?? "";
  const initialChannel = searchParams.get("channel") ?? "whatsapp";
  const initialMode = searchParams.get("mode");
  const returnToConversationId = searchParams.get("conversationId");
  const isContinueMode = initialMode === "continue";

  const [channelOptions, setChannelOptions] = useState<ChannelDefinitionItem[]>(
    [],
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedChannel, setSelectedChannel] = useState(initialChannel);
  const [inputMode, setInputMode] =
    useState<(typeof INPUT_MODE_OPTIONS)[number]["value"]>(
      isContinueMode ? "paste" : "file",
    );
  const [pastedText, setPastedText] = useState("");
  const [conversationTitle, setConversationTitle] = useState(initialTitle);
  const [isUploading, setIsUploading] = useState(false);
  const [isDetectingChannel, setIsDetectingChannel] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [detectionMessage, setDetectionMessage] = useState("");

  useEffect(() => {
    async function loadChannels() {
      try {
        const channels =
          await apiFetch<ChannelDefinitionItem[]>("/upload/channels");
        setChannelOptions(channels);
        if (channels.length > 0) {
          setSelectedChannel((current) =>
            channels.some((channel) => channel.key === current)
              ? current
              : channels[0].key,
          );
        }
      } catch {
        setErrorMessage("Gagal memuat daftar channel upload.");
      }
    }

    void loadChannels();
  }, []);

  function validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      return "File harus berformat .txt";
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "Ukuran file maksimal 5MB";
    }

    return null;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setErrorMessage("");

    const file = event.target.files?.[0];

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateFile(file);

    if (validationError) {
      setSelectedFile(null);
      setErrorMessage(validationError);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setDetectionMessage("");

    const normalizedConversationTitle = conversationTitle.trim();
    if (normalizedConversationTitle.length < 2) {
      setErrorMessage("Nama customer wajib diisi untuk judul conversation.");
      return;
    }

    const channelConfig = channelOptions.find(
      (item) => item.key === selectedChannel,
    );

    setIsUploading(true);

    try {
      let result: UploadConversationResponse;

      if (inputMode === "file") {
        if (!selectedFile) {
          setErrorMessage("Pilih file .txt terlebih dahulu.");
          setIsUploading(false);
          return;
        }

        const validationError = validateFile(selectedFile);
        if (validationError) {
          setErrorMessage(validationError);
          setIsUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("title", normalizedConversationTitle);
        result = await apiFetch<UploadConversationResponse>(
          channelConfig?.file_endpoint ?? "/upload/whatsapp-txt",
          {
            method: "POST",
            body: formData,
          },
        );
      } else {
        if (pastedText.trim().length === 0) {
          setErrorMessage("Paste chat terlebih dahulu.");
          setIsUploading(false);
          return;
        }

        result = await apiFetch<UploadConversationResponse>(
          channelConfig?.text_endpoint ?? "/upload/whatsapp-text",
          {
            method: "POST",
            body: {
              raw_text: pastedText,
              title: normalizedConversationTitle,
            },
          },
        );
      }

      const nextParams = new URLSearchParams({
        uploadStatus: result.status,
        appended: String(result.appended_message_count),
        messageCount: String(result.message_count),
      });
      router.push(
        `/dashboard/sales/conversations/${result.conversation_id}?${nextParams.toString()}`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload gagal.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDetectChannel() {
    if (pastedText.trim().length === 0) {
      setErrorMessage(
        "Paste chat terlebih dahulu sebelum auto-detect channel.",
      );
      return;
    }

    setErrorMessage("");
    setDetectionMessage("");
    setIsDetectingChannel(true);

    try {
      const result = await apiFetch<ChannelDetectResponse>(
        "/upload/detect-channel",
        {
          method: "POST",
          body: { raw_text: pastedText },
        },
      );

      if (!result.detected_channel) {
        setDetectionMessage(
          "Clara belum bisa menebak channel dari isi chat ini. Pilih channel manual.",
        );
        return;
      }

      setSelectedChannel(result.detected_channel);
      const topCandidate = result.candidates[0];
      setDetectionMessage(
        `Clara mendeteksi ${topCandidate.label} (${topCandidate.matched_message_count} pesan, confidence ${Math.round(topCandidate.confidence * 100)}%).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Auto-detect channel gagal.",
      );
    } finally {
      setIsDetectingChannel(false);
    }
  }

  const activeChannel = channelOptions.find(
    (channel) => channel.key === selectedChannel,
  );

  return (
    <form
      data-onboarding-id="sales-upload-form"
      onSubmit={handleUpload}
      className="clara-card space-y-5 p-5 sm:p-6"
    >
      <div className="clara-card-soft p-4">
        <p className="clara-kicker text-xs">Form input chat</p>
        <h2 className="mt-2 text-xl font-bold tracking-tight clara-text-primary">
          Lengkapi data wajib, lalu proses
        </h2>
        <p className="mt-2 text-sm leading-6 clara-text-secondary">
          Channel, nama customer, mode input, dan isi chat bertanda wajib.
        </p>
      </div>

      {isContinueMode ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Mode chat lanjutan aktif.</p>
          <p className="mt-2 leading-6">
            Paste atau upload chat terbaru customer untuk melanjutkan
            conversation yang sudah ada. Selama nama customer dan channel tetap
            sama, Clara akan mencoba menempelkan pesan baru ke thread yang
            sama.
          </p>
          {returnToConversationId ? (
            <div className="mt-3">
              <Link
                href={`/dashboard/sales/conversations/${returnToConversationId}`}
                className="text-sm font-semibold underline"
              >
                Kembali ke detail conversation
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="upload-input-heading">
        <h3
          id="upload-input-heading"
          className="text-base font-semibold clara-text-primary"
        >
          1. Pilih channel dan cara input
        </h3>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="channelType"
            className="clara-label"
          >
            Channel (wajib)
          </label>
          <select
            id="channelType"
            value={selectedChannel}
            onChange={(event) => {
              setSelectedChannel(event.target.value);
              setDetectionMessage("");
            }}
            className="clara-select mt-2 w-full"
          >
            {channelOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {activeChannel ? (
            <p className="mt-2 text-xs leading-5 clara-text-muted">
              {activeChannel.description}
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor="inputMode" className="clara-label">
            Cara input (wajib)
          </label>
          <select
            id="inputMode"
            value={inputMode}
            onChange={(event) => {
              setInputMode(
                event.target
                  .value as (typeof INPUT_MODE_OPTIONS)[number]["value"],
              );
              setErrorMessage("");
            }}
            className="clara-select mt-2 w-full"
          >
            {INPUT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        </div>
      </section>

      <section aria-labelledby="upload-identity-heading">
        <h3
          id="upload-identity-heading"
          className="text-base font-semibold clara-text-primary"
        >
          2. Identifikasi customer atau percakapan
        </h3>
        <div className="mt-3">
          <label
            htmlFor="conversationTitle"
            className="clara-label"
          >
            Nama customer atau percakapan (wajib)
          </label>
          <input
            id="conversationTitle"
            type="text"
            value={conversationTitle}
            onChange={(event) => {
              setConversationTitle(event.target.value);
            }}
            placeholder="Contoh: Rina Pratama"
            className="clara-input mt-2 w-full"
          />
          <p className="mt-2 text-xs clara-text-muted">
            Nama ini dipakai sebagai judul percakapan dan identitas awal customer.
            {isContinueMode
              ? " Kalau diganti, Clara bisa menganggap ini percakapan baru."
              : ""}
          </p>
        </div>
      </section>

      {inputMode === "file" ? (
        <section
          aria-labelledby="upload-content-heading"
          className="clara-card-outline p-4"
        >
          <label
            id="upload-content-heading"
            htmlFor="whatsappFile"
            className="clara-label"
          >
            3. Upload file chat .txt (wajib)
          </label>

          <input
            ref={fileInputRef}
            id="whatsappFile"
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            aria-describedby="upload-file-help"
            className="clara-input mt-2 block w-full file:mr-4 file:rounded-lg file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
          />

          <p id="upload-file-help" className="mt-2 text-xs clara-text-muted">
            Format .txt, maksimal 5MB. Pemeriksaan di browser membantu memberi
            feedback cepat; validasi server tetap menjadi batas keamanan utama.
          </p>
        </section>
      ) : (
        <section className="clara-card-outline space-y-4 p-4">
          <div>
            <label
              htmlFor="pastedText"
              className="clara-label"
            >
              3. Paste isi chat (wajib)
            </label>
            <textarea
              id="pastedText"
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setDetectionMessage("");
              }}
              placeholder="Paste export chat di sini..."
              className="clara-textarea mt-2 min-h-[220px] w-full"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDetectChannel();
                }}
                disabled={isDetectingChannel}
                className="clara-button clara-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDetectingChannel ? "Mendeteksi..." : "Deteksi channel otomatis"}
              </button>
              <p className="text-xs clara-text-muted">
                Cocok kalau sales mau cepat tempel chat tanpa bikin file dulu.
              </p>
            </div>
            {detectionMessage ? (
              <p
                role="status"
                aria-live="polite"
                className="clara-alert clara-alert-success mt-3"
              >
                {detectionMessage}
              </p>
            ) : null}
          </div>
        </section>
      )}

      {selectedFile && (
        <div
          role="status"
          aria-live="polite"
          className="clara-card-soft p-4 text-sm clara-text-secondary"
        >
          <p>
            <span className="font-semibold">File terpilih:</span> {selectedFile.name}
          </p>
          <p>
            <span className="font-semibold">Ukuran:</span>{" "}
            {(selectedFile.size / 1024).toFixed(1)} KB
          </p>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="clara-alert clara-alert-danger">
          {errorMessage}
        </p>
      )}

      <p className="text-sm font-semibold clara-text-primary">
        4. Periksa feedback validasi di atas, lalu lanjutkan.
      </p>
      <button
        type="submit"
        aria-busy={isUploading}
        disabled={
          isUploading ||
          channelOptions.length === 0 ||
          conversationTitle.trim().length < 2 ||
          (inputMode === "file"
            ? !selectedFile
            : pastedText.trim().length === 0)
        }
        className="clara-button clara-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {isUploading
          ? "5. Memproses chat..."
          : inputMode === "file"
            ? "5. Proses File Chat"
            : "5. Proses Chat Paste"}
      </button>
    </form>
  );
}

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
  { value: "paste", label: "Tempel isi chat" },
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
        setErrorMessage("Daftar channel belum bisa dimuat. Muat ulang halaman ini.");
      }
    }

    void loadChannels();
  }, []);

  function validateFile(file: File): string | null {
    if (!file.name.toLowerCase().endsWith(".txt")) {
      return "File harus berformat .txt. Ekspor ulang chat-nya dari WhatsApp lalu pilih file hasilnya.";
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return "Ukuran file maksimal 5MB. Ekspor chat tanpa media supaya lebih kecil.";
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
    if (normalizedConversationTitle.length === 0) {
      setErrorMessage("Isi nama customer dulu. Nama ini jadi judul percakapan.");
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
          setErrorMessage("Pilih file .txt dulu.");
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
          setErrorMessage("Tempel isi chat dulu.");
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
        `/sales/conversations/${result.conversation_id}?${nextParams.toString()}`,
      );
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Chat belum bisa diproses. Coba lagi.");
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDetectChannel() {
    if (pastedText.trim().length === 0) {
      setErrorMessage("Tempel isi chat dulu, baru Clara bisa mengenali channel-nya.");
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
          "Clara belum bisa mengenali channel dari isi chat ini. Pilih channelnya sendiri di atas.",
        );
        return;
      }

      setSelectedChannel(result.detected_channel);
      const topCandidate = result.candidates[0];
      setDetectionMessage(
        `Clara mengenali chat ini sebagai ${topCandidate.label} (${topCandidate.matched_message_count} pesan cocok).`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Channel belum bisa dikenali. Pilih sendiri di atas.",
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
      className="clara-card space-y-6 p-5 sm:p-6"
    >
      {isContinueMode ? (
        <div className="rounded-2xl border border-clara-line bg-clara-tint p-4 text-sm text-clara-gold">
          <p className="font-semibold">Kamu sedang menambah chat ke percakapan yang sudah ada.</p>
          <p className="mt-2 leading-6">
            Masukkan chat terbaru customer. Selama nama customer dan channel sama, pesan barunya ditempel ke
            percakapan yang sama.
          </p>
          {returnToConversationId ? (
            <div className="mt-3">
              <Link
                href={`/sales/conversations/${returnToConversationId}`}
                className="text-sm font-semibold underline"
              >
                Kembali ke percakapan
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="upload-identity-heading" className="space-y-4">
        <h2 id="upload-identity-heading" className="text-base font-semibold clara-text-primary">
          1. Siapa customernya?
        </h2>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="conversationTitle" className="clara-label">
              Nama customer
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
              Dipakai sebagai judul percakapan.
              {isContinueMode ? " Kalau diganti, Clara menganggap ini percakapan baru." : ""}
            </p>
          </div>

          <div>
            <label htmlFor="channelType" className="clara-label">
              Chat ini dari mana?
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
              <p className="mt-2 text-xs leading-5 clara-text-muted">{activeChannel.description}</p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="upload-content-heading" className="space-y-4">
        <h2 id="upload-content-heading" className="text-base font-semibold clara-text-primary">
          2. Masukkan isi chat
        </h2>

        <div role="radiogroup" aria-label="Cara memasukkan chat" className="grid gap-2 sm:grid-cols-2">
          {INPUT_MODE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${
                inputMode === option.value
                  ? "border-clara-gold bg-clara-wash clara-text-primary"
                  : "border-clara-line-subtle bg-clara-sunken clara-text-secondary hover:border-clara-line"
              }`}
            >
              <input
                type="radio"
                name="inputMode"
                value={option.value}
                checked={inputMode === option.value}
                onChange={() => {
                  setInputMode(option.value);
                  setErrorMessage("");
                }}
                className="h-4 w-4"
              />
              {option.label}
            </label>
          ))}
        </div>

        {inputMode === "file" ? (
          <div className="rounded-2xl border border-dashed border-clara-line p-4">
            <input
              ref={fileInputRef}
              id="whatsappFile"
              type="file"
              accept=".txt,text/plain"
              onChange={handleFileChange}
              aria-describedby="upload-file-help"
              className="peer sr-only"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label
                htmlFor="whatsappFile"
                className="clara-button clara-button-secondary cursor-pointer peer-focus-visible:shadow-[var(--focus-ring)]"
              >
                Pilih file .txt
              </label>
              <p role="status" aria-live="polite" className="min-w-0 break-words text-sm clara-text-secondary">
                {selectedFile
                  ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`
                  : "Belum ada file dipilih"}
              </p>
            </div>
            <p id="upload-file-help" className="mt-3 text-xs clara-text-muted">
              Format .txt, maksimal 5MB.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="pastedText" className="clara-label">
                Isi chat
              </label>
              <textarea
                id="pastedText"
                value={pastedText}
                onChange={(event) => {
                  setPastedText(event.target.value);
                  setDetectionMessage("");
                }}
                placeholder="Tempel chat di sini"
                className="clara-textarea mt-2 min-h-[220px] w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDetectChannel();
                }}
                disabled={isDetectingChannel}
                className="clara-button clara-button-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDetectingChannel ? "Mengenali..." : "Kenali channel dari isi chat"}
              </button>
              <p className="text-xs clara-text-muted">Tidak yakin ini chat dari mana? Biar Clara yang menebak.</p>
            </div>
            {detectionMessage ? (
              <p role="status" aria-live="polite" className="clara-alert clara-alert-success">
                {detectionMessage}
              </p>
            ) : null}
          </div>
        )}
      </section>

      {errorMessage ? (
        <p role="alert" className="clara-alert clara-alert-danger">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 border-t border-clara-line-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm clara-text-secondary">
          3. Setelah diproses, percakapannya langsung terbuka.
        </p>
        <button
          type="submit"
          aria-busy={isUploading}
          disabled={
            isUploading ||
            channelOptions.length === 0 ||
            conversationTitle.trim().length === 0 ||
            (inputMode === "file" ? !selectedFile : pastedText.trim().length === 0)
          }
          className="clara-button clara-button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          {isUploading ? "Memproses chat..." : "Proses chat"}
        </button>
      </div>
    </form>
  );
}

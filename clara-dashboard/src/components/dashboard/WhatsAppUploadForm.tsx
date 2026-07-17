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
      className="clara-card space-y-5 rounded-[30px] p-5 sm:p-6"
    >
      <div className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(28,21,15,0.94)_0%,rgba(18,13,10,0.96)_100%)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#f0cb73]">
          Form input chat
        </p>
        <h2 className="mt-2 text-xl font-bold tracking-tight text-[#fff3cf]">
          Isi data seperlunya, lalu proses
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#e3c990]">
          Clara butuh tiga hal inti: channel, nama customer, dan isi chat.
          Sisanya biarkan sesederhana mungkin supaya sales bisa cepat lanjut kerja.
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

      <section className="grid gap-4 lg:grid-cols-3">
        <div>
          <label
            htmlFor="channelType"
            className="text-sm font-semibold text-slate-900"
          >
            1. Pilih channel
          </label>
          <select
            id="channelType"
            value={selectedChannel}
            onChange={(event) => {
              setSelectedChannel(event.target.value);
              setDetectionMessage("");
            }}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
          >
            {channelOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          {activeChannel ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {activeChannel.description}
            </p>
          ) : null}
        </div>

        <div>
          <label
            htmlFor="conversationTitle"
            className="text-sm font-semibold text-slate-900"
          >
            2. Isi nama customer
          </label>
          <input
            id="conversationTitle"
            type="text"
            value={conversationTitle}
            onChange={(event) => {
              setConversationTitle(event.target.value);
            }}
            placeholder="Contoh: Rina Pratama"
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
          />
          <p className="mt-2 text-xs text-slate-500">
            Nama ini dipakai sebagai judul percakapan dan identitas awal customer.
            {isContinueMode
              ? " Kalau diganti, Clara bisa menganggap ini percakapan baru."
              : ""}
          </p>
        </div>

        <div>
          <label htmlFor="inputMode" className="clara-label">
            3. Pilih cara input
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
          >
            {INPUT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {inputMode === "file" ? (
        <div className="rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(28,21,15,0.94)_0%,rgba(18,13,10,0.96)_100%)] p-4">
          <label
            htmlFor="whatsappFile"
            className="text-sm font-semibold text-[#fff3cf]"
          >
            Upload file chat .txt
          </label>

          <input
            ref={fileInputRef}
            id="whatsappFile"
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="mt-2 block w-full rounded-xl border border-[#4a3618] bg-[#1a130d] p-3 text-sm text-[#f7e7b7] file:mr-4 file:rounded-lg file:border-0 file:bg-[linear-gradient(135deg,#f6d98c_0%,#c29032_100%)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[#140f08]"
          />

          <p className="mt-2 text-xs text-[#c8ab70]">
            Maksimal 5MB. Cocok kalau chat sudah diexport sebagai file dan tinggal dimasukkan ke Clara.
          </p>
        </div>
      ) : (
        <div className="space-y-4 rounded-[24px] border border-[#f0cb73]/16 bg-[linear-gradient(180deg,rgba(28,21,15,0.94)_0%,rgba(18,13,10,0.96)_100%)] p-4">
          <div>
            <label
              htmlFor="pastedText"
              className="text-sm font-semibold text-[#fff3cf]"
            >
              Paste isi chat
            </label>
            <textarea
              id="pastedText"
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setDetectionMessage("");
              }}
              placeholder="Paste export chat di sini..."
              className="mt-2 min-h-[220px] w-full rounded-xl border border-[#4a3618] bg-[#1a130d] p-3 text-sm text-[#f7e7b7] placeholder:text-[#907953]"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDetectChannel();
                }}
                disabled={isDetectingChannel}
                className="rounded-full border border-[#f0cb73]/18 bg-[#241a10] px-3.5 py-2 text-xs font-semibold text-[#f0cb73] hover:bg-[#2b1f13] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDetectingChannel ? "Mendeteksi..." : "Deteksi channel otomatis"}
              </button>
              <p className="text-xs text-[#c8ab70]">
                Cocok kalau sales mau cepat tempel chat tanpa bikin file dulu.
              </p>
            </div>
            {detectionMessage ? (
              <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                {detectionMessage}
              </p>
            ) : null}
          </div>
        </div>
      )}

      {selectedFile && (
        <div className="clara-card-soft rounded-[24px] p-4 text-sm text-slate-700">
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
        <p className="clara-alert clara-alert-danger">{errorMessage}</p>
      )}

      <button
        type="submit"
        disabled={
          isUploading ||
          channelOptions.length === 0 ||
          conversationTitle.trim().length < 2 ||
          (inputMode === "file"
            ? !selectedFile
            : pastedText.trim().length === 0)
        }
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isUploading
          ? "Memproses chat..."
          : inputMode === "file"
            ? "Proses File Chat"
            : "Proses Chat Paste"}
      </button>
    </form>
  );
}

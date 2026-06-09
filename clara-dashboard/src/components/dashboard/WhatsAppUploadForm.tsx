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
  { value: "file", label: "Upload File" },
  { value: "paste", label: "Paste Chat" },
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
      onSubmit={handleUpload}
      className="clara-card space-y-5 rounded-[30px] p-5 sm:p-6"
    >
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

      <div>
        <label
          htmlFor="channelType"
          className="text-sm font-semibold text-slate-900"
        >
          Channel
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
          Nama Customer / Judul Conversation
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
          Wajib diisi dengan nama customer. Nilai ini akan dipakai sebagai
          judul conversation dan nama awal customer di Clara.
          {isContinueMode
            ? " Kalau judul diganti, Clara bisa menganggap ini conversation baru."
            : ""}
        </p>
      </div>

      <div>
        <label htmlFor="whatsappFile" className="clara-label">
          Input Mode
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

      {inputMode === "file" ? (
        <div>
          <label
            htmlFor="whatsappFile"
            className="text-sm font-semibold text-slate-900"
          >
            File Chat .txt
          </label>

          <input
            ref={fileInputRef}
            id="whatsappFile"
            type="file"
            accept=".txt,text/plain"
            onChange={handleFileChange}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
          />

          <p className="mt-2 text-xs text-slate-500">
            Maksimal 5MB. Pilih channel yang sesuai sebelum upload supaya parser
            Clara memakai format yang benar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label
              htmlFor="pastedText"
              className="text-sm font-semibold text-slate-900"
            >
              Paste Chat
            </label>
            <textarea
              id="pastedText"
              value={pastedText}
              onChange={(event) => {
                setPastedText(event.target.value);
                setDetectionMessage("");
              }}
              placeholder="Paste export chat di sini..."
              className="mt-2 min-h-[220px] w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void handleDetectChannel();
                }}
                disabled={isDetectingChannel}
                className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDetectingChannel ? "Mendeteksi..." : "Auto-Detect Channel"}
              </button>
              <p className="text-xs text-slate-500">
                Cocok untuk user yang tidak ingin menyimpan file .txt dulu.
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
            <span className="font-semibold">Selected:</span> {selectedFile.name}
          </p>
          <p>
            <span className="font-semibold">Size:</span>{" "}
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
          ? "Uploading..."
          : inputMode === "file"
            ? "Upload Chat"
            : "Proses Paste Chat"}
      </button>
    </form>
  );
}

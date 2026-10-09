"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";

import { ErrorState, LoadingState } from "@/components/dashboard/StateViews";
import { Tag } from "@/components/dashboard/Tag";
import { WorkspaceShell } from "@/components/dashboard/WorkspaceShell";
import { apiFetch } from "@/lib/api";
import { formatDateTime, formatFileSize, formatRelativeTime } from "@/lib/format";
import { PAGE_NAMES } from "@/lib/labels";
import { canAccessAdminPages } from "@/lib/roles";
import type { CurrentUser, ExtensionBuildItem } from "@/types/dashboard";

export default function AdminExtensionPage() {
  const router = useRouter();
  const versionId = useId();
  const fileId = useId();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [build, setBuild] = useState<ExtensionBuildItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [version, setVersion] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  async function loadBuild() {
    setLoadError("");

    try {
      const me = await apiFetch<CurrentUser>("/auth/me");
      setCurrentUser(me);

      if (!canAccessAdminPages(me.role)) {
        router.replace("/workspace");
        return;
      }

      setBuild(await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds"));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data ekstensi belum bisa dimuat.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBuild();
    }, 0);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!file) {
      setUploadError("Pilih berkas ekstensi (.zip atau .crx) dulu.");
      return;
    }
    if (version.trim().length < 2) {
      setUploadError("Isi nomor versi dulu.");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("version", version.trim());
      formData.set("file", file);

      await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds", { method: "POST", body: formData });
      setBuild(await apiFetch<ExtensionBuildItem>("/dashboard/extension-builds"));
      setUploadSuccess("Ekstensi baru sudah diunggah. Semua pengguna dapat pemberitahuan dan bisa mengunduhnya dari halaman Profil.");
      setFile(null);
      setVersion("");
      const input = document.getElementById(fileId) as HTMLInputElement | null;
      if (input) {
        input.value = "";
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Ekstensi belum bisa diunggah. Coba lagi.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <WorkspaceShell
      currentUser={currentUser}
      title={PAGE_NAMES.extension}
      description="Satu berkas ekstensi yang diunduh semua pengguna dari halaman Profil mereka."
    >
      <div className="space-y-6">
        {isLoading ? <LoadingState message="Memuat data ekstensi..." /> : null}
        {!isLoading && loadError ? <ErrorState message={loadError} onRetry={() => void loadBuild()} /> : null}

        {build && !isLoading ? (
          <>
            <section aria-labelledby="ext-current" className="clara-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="ext-current" className="text-xl font-bold clara-text-primary">
                  {build.available ? "Versi yang sedang dibagikan" : "Belum ada ekstensi yang bisa diunduh"}
                </h2>
                {build.available ? <Tag tone="good">Versi {build.version || "-"}</Tag> : <Tag tone="warn">Belum tersedia</Tag>}
              </div>

              {build.available ? (
                <>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <Fact label="Berkas" value={build.file_name ?? "-"} />
                    <Fact label="Ukuran" value={formatFileSize(build.size_bytes)} />
                    <Fact
                      label="Diunggah"
                      value={build.uploaded_at ? `${formatDateTime(build.uploaded_at)} (${formatRelativeTime(build.uploaded_at)})` : "-"}
                    />
                    <Fact label="Oleh" value={build.uploaded_by_email ?? "-"} />
                  </dl>
                  <div className="mt-4">
                    <a href="/api/dashboard/extension-builds/download" className="clara-button clara-button-secondary">
                      Unduh untuk dicoba sendiri
                    </a>
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 clara-text-secondary">
                  Pengguna belum bisa mengunduh ekstensi. Kalau sebelumnya sudah pernah diunggah lalu hilang setelah update server,
                  unggah ulang di bawah. Pastikan penyimpanan berkas di server memakai volume permanen.
                </p>
              )}
            </section>

            <section aria-labelledby="ext-upload" className="clara-card p-5 sm:p-6">
              <h2 id="ext-upload" className="text-xl font-bold clara-text-primary">
                Unggah versi baru
              </h2>
              <p className="mt-1 text-sm leading-6 clara-text-secondary">
                Berkas lama langsung tergantikan untuk semua pengguna, dan mereka mendapat pemberitahuan update.
              </p>

              <form onSubmit={handleUpload} className="mt-4 space-y-4">
                {uploadError ? (
                  <div role="alert" className="clara-alert clara-alert-danger">
                    {uploadError}
                  </div>
                ) : null}
                {uploadSuccess ? (
                  <div role="status" className="clara-alert clara-alert-success">
                    {uploadSuccess}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor={versionId} className="clara-label">
                      Nomor versi
                    </label>
                    <input
                      id={versionId}
                      value={version}
                      onChange={(event) => setVersion(event.target.value)}
                      placeholder={build.version ? `Sekarang ${build.version}. Contoh: v0.1.13` : "Contoh: v0.1.13"}
                      className="clara-input mt-2 w-full"
                    />
                  </div>
                  <div>
                    <label htmlFor={fileId} className="clara-label">
                      Berkas ekstensi (.zip atau .crx)
                    </label>
                    <input
                      id={fileId}
                      type="file"
                      accept=".zip,.crx"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="clara-file-input mt-2"
                    />
                  </div>
                </div>

                <button type="submit" disabled={isUploading} className="clara-button clara-button-primary">
                  {isUploading ? "Mengunggah..." : "Unggah ekstensi"}
                </button>
              </form>
            </section>

            <details className="clara-card p-4 sm:p-5">
              <summary className="flex min-h-11 cursor-pointer items-center text-base font-semibold clara-text-primary">
                Cara pengguna memasang ekstensi
              </summary>
              <ol className="mt-3 list-decimal space-y-1.5 pl-6 text-sm leading-6 clara-text-secondary">
                <li>Buka halaman Profil di dashboard, lalu unduh ekstensi dan ekstrak berkasnya.</li>
                <li>Buka chrome://extensions dan nyalakan Developer mode.</li>
                <li>Klik Load unpacked, lalu pilih folder hasil ekstrak.</li>
                <li>Login ke dashboard Clara, buka WhatsApp Web, Instagram DM, atau TikTok Messages, lalu klik ikon Clara.</li>
              </ol>
            </details>
          </>
        ) : null}
      </div>
    </WorkspaceShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="clara-card-soft min-w-0 p-3">
      <dt className="text-xs clara-text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold clara-text-primary">{value}</dd>
    </div>
  );
}

# Mekanisme dan Ketentuan Transaksi Akun Mini

Dokumen ini merangkum cara kerja dan aturan operasional Akun Mini (CDD Sederhana, kontrak XUL10 dan BCO10_BBJ lewat Sistem Perdagangan Alternatif) supaya bisa dijelaskan ke customer secara konseptual.

Dokumen ini tidak memuat angka. Margin, komisi, spread, jam trading, ukuran kontrak, batas lot, batas dana, dan batas waktu hanya boleh disebut dari Product Fact ACTIVE dan fresh yang sesuai akun dan produk. Jika fact tidak tersedia, jelaskan konsepnya tanpa angka dan sarankan konfirmasi lewat kanal resmi.

## Sistem dan kontrak

- Sistem Perdagangan Alternatif (SPA) adalah perdagangan kontrak derivatif secara bilateral di luar bursa berjangka, dengan margin yang didaftarkan ke Lembaga Kliring Berjangka. PT Solid Gold Berjangka berperan sebagai Pialang Berjangka Peserta SPA.
- Kontrak gulir (rolling contract): posisi terbuka otomatis diperpanjang ke hari perdagangan berikutnya sampai customer menutupnya.
- Akun Mini memperdagangkan Emas Loco London (XUL10) dan Brent Crude Oil (BCO10_BBJ) dengan fixed rate USD ke IDR. Nilai kurs tetap hanya dari Product Fact.
- Harga mengacu ke last trade dari penyedia data harga (Telequote) lalu ditambah spread sesuai Trade Table.

## Day trading dan overnight

- Day trading: posisi dibuka dan ditutup di hari yang sama.
- Overnight: posisi dibawa ke hari berikutnya dan dikenakan Storage/Rollover Fee per malam plus PPN. Besarnya hanya dari Product Fact.
- Jangan menyebut overnight sebagai gratis dan jangan menyamakannya dengan swap forex.

## Jenis margin

- Deposit margin: dana yang disetor customer, harus lebih besar dari initial margin.
- Initial margin: jaminan untuk posisi terbuka (angka day trade dari Product Fact).
- Maintenance margin: dana untuk memelihara posisi saat ada kerugian yang belum terealisasi.
- Variation margin: untung rugi hasil penilaian ulang harian (mark-to-market) terhadap harga penyelesaian.
- Margin call: kondisi saat dana turun di bawah batas maintenance; customer harus memenuhinya kembali sampai level yang ditentukan.
- Auto liquidation: bila margin call tidak dipenuhi dan dana menyentuh batas minimum, perusahaan berhak menutup seluruh posisi dengan atau tanpa pemberitahuan.
- Equity adalah saldo ditambah atau dikurangi floating profit/loss. Effective margin adalah equity dikurangi initial margin dan dipakai untuk melihat dana yang bisa ditarik.
- Level persentase hanya dari Product Fact.

## Jenis order

- Market order: dieksekusi di harga terbaik yang tersedia dengan market execution, tanpa requote.
- Limit order: harga yang ditentukan atau lebih baik. Stop order: harga yang ditentukan atau tidak lebih baik, biasa dipakai untuk membatasi rugi.
- OCO: kombinasi limit dan stop; bila satu tereksekusi, yang lain otomatis dibatalkan.
- Limit dan stop berlaku sampai tereksekusi atau dibatalkan (GTC).
- Limit dan stop tidak menjamin tereksekusi tepat di harga yang dipesan. Saat ada gap antar sesi, eksekusi terjadi di harga open sesi. Saat harga melompat melewati level, eksekusi terjadi di harga terdekat.
- Locking adalah membuka posisi berlawanan tanpa bermaksud menutup posisi sebelumnya.
- Order tidak boleh dipecah (split order). Order yang sudah done tidak dapat dibatalkan.
- Order hanya ditolak karena margin tidak cukup, melewati batas lot atau posisi terbuka maksimum, atau equity melewati batas saat pengkinian data ditolak.

## Hectic market dan wrong quote

- Hectic market: pasar tidak normal, misalnya bid atau offer hanya ada satu sisi, spread melebar melewati batas Trade Table, atau harga melonjak tajam karena berita besar. Saat itu spread mengikuti kondisi pasar.
- Wrong quote: harga di sistem tidak akurat, misalnya karena kesalahan penyedia harga atau gangguan koneksi. Harganya indikatif dan transaksi di harga itu dibatalkan oleh penyelenggara SPA.

## Rumus untung rugi

P/L = [(Harga Jual - Harga Beli) x Contract Size x jumlah Lot] - [(Facility Fee + PPN) x jumlah Lot]

- Jelaskan rumus ini apa adanya. Contract Size dan Facility Fee hanya dari Product Fact.
- Jangan menghitung hasil memakai angka asumsi. Jika ada nilai yang belum diberikan customer atau belum ada di fact, sebutkan nilai yang masih dibutuhkan dan jangan beri hasil akhir.
- Semua faktor harus dihitung penuh, termasuk Contract Size dikali jumlah Lot.

## Ketentuan Akun Mini (CDD Sederhana)

- Penerimaan nasabah dilakukan secara elektronik (online). Kanal dan langkah pendaftaran mengikuti Product Fact process, bukan dokumen ini.
- Satu nasabah hanya boleh punya satu akun di satu pialang, dan CDD Sederhana hanya untuk nasabah perseorangan.
- Ada batas posisi terbuka minimum dan maksimum selama transaksi berjalan (angka dari Product Fact).
- Jika equity melewati batas tertentu, nasabah wajib pengkinian data untuk CDD Standar, termasuk mengisi ulang dokumen penerimaan nasabah elektronik. Jika menolak, nasabah tidak dapat melakukan penarikan dan tidak dapat membuka posisi baru.

## Deposit dan penarikan

- Setoran margin awal maupun top-up dilakukan lewat pemindahbukuan dari rekening bank atas nama nasabah sendiri ke Rekening Terpisah (segregated account) PT Solid Gold Berjangka. Jangan arahkan transfer ke rekening pribadi atau pihak lain.
- Ada batas nilai setoran per transaksi dan per bulan. Sebut angkanya hanya bila tersedia sebagai Product Fact; selain itu arahkan ke petugas.
- Penarikan diajukan lewat formulir penarikan dana di sistem aplikasi trading dan atau formulir cetak, dan hanya bisa bila dana melebihi initial margin. Pencairan mengikuti batas waktu pada ketentuan resmi; sebut jangka waktunya hanya dari fact atau petugas.
- Deposit atau penarikan yang bermasalah, belum masuk, atau gagal adalah kasus akun spesifik: teruskan ke petugas di chat aktif.

## Laporan dan keamanan akses

- Laporan transaksi harian dikirim secara elektronik ke email yang terdaftar. Ada batas waktu sanggahan, dan bila tidak ada sanggahan transaksi dianggap benar.
- User ID, password, dan OTP bersifat pribadi dan rahasia. Nasabah wajib mengganti password awal dan tidak membagikannya ke siapa pun. Jangan pernah meminta password, PIN, atau OTP.
- Ketentuan trading rules dapat berubah dengan pemberitahuan resmi dari perusahaan.

## Cara menjawab

- Jawab konsep yang ditanyakan dulu, lalu angka bila Product Fact yang sesuai tersedia.
- Jika customer menanyakan mekanisme, jangan mengalihkannya ke modal awal atau onboarding.
- Jika customer menyebut Mini, bahas Mini saja dan jangan mencampur angka Akun Reguler.
- Kasus spesifik akun, transaksi, atau dana customer diteruskan ke petugas di chat aktif tanpa meminta data akses.
- Selalu ingatkan bahwa trading berjangka berisiko bila membahas margin, auto liquidation, atau hasil trading.

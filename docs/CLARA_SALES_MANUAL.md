# Clara Sales Manual

Manual ini dibuat khusus untuk user `sales` di Clara.

Tujuannya:

- membantu sales baru cepat paham cara kerja Clara
- menjelaskan urutan kerja harian yang aman
- menjelaskan halaman apa yang harus dibuka
- menjelaskan apa yang harus dilakukan saat melihat status tertentu

Kalau harus diingat dalam satu kalimat:

> Tugas sales di Clara adalah membaca chat dengan benar, membalas dengan aman, merapikan lead, lalu memastikan follow-up berikutnya jelas.

---

## 1. Clara Dipakai Untuk Apa

Clara adalah tempat kerja harian sales.

Di Clara, pekerjaan berikut disatukan:

- chat customer
- lead
- customer profile
- follow-up
- bantuan AI untuk membaca chat

Jadi Clara bukan cuma tempat simpan data. Clara dipakai supaya sales cepat tahu:

- chat mana yang harus dibaca dulu
- balasan apa yang paling aman
- lead mana yang paling penting
- customer mana yang datanya belum rapi

---

## 2. Halaman Yang Paling Sering Dipakai Sales

Urutan halaman yang paling sering dipakai sales:

1. `Queue`
2. `Conversation Detail`
3. `Lead Management`
4. `Lead Detail`
5. `Customer List`
6. `Customer Detail`
7. `Action Center`
8. `Lead Capture`

Aturan paling sederhana:

- kalau mau balas chat: buka `Queue`
- kalau mau baca detail chat: buka `Conversation Detail`
- kalau mau rapikan lead: buka `Lead Management`
- kalau mau rapikan customer: buka `Customer Detail`
- kalau mau lihat pekerjaan hari ini: buka `Action Center`
- kalau mau masukkan chat baru: buka `Lead Capture`

---

## 3. Alur Kerja Harian Sales

### Saat mulai kerja pagi

1. login ke Clara
2. buka `Queue`
3. baca chat yang paling baru atau paling penting
4. lihat apakah AI analysis sudah ada
5. lihat apakah kategori akun sudah terbaca

### Saat mulai membalas customer

1. buka `Conversation Detail`
2. baca chat terakhir
3. lihat siapa yang bicara terakhir
4. pahami apa yang customer minta
5. jalankan `AI Analysis` jika belum ada
6. cek draft balasan
7. edit draft jika perlu
8. kirim balasan jika aman

### Setelah selesai membalas

1. buka `Lead Management`
2. cari lead terkait
3. cek stage
4. isi `next follow-up`
5. kalau ada aktivitas penting, buka `Lead Detail`
6. isi `Log Disiplin Harian`

### Kalau data customer terasa belum rapi

1. buka `Customer List`
2. cari nama customer
3. buka `Customer Detail`
4. cek nama, telepon, email, alamat
5. cek `kategori akun`
6. cek `temperature customer`
7. koreksi manual bila memang perlu

### Saat menjelang siang atau sore

1. buka `Action Center`
2. cek item `Overdue`
3. kerjakan yang paling telat dulu
4. pastikan tidak ada lead panas yang dibiarkan

---

## 4. Urutan Kerja Yang Paling Aman

Kalau Anda bingung harus mulai dari mana, pakai urutan ini:

1. `Queue`
2. `Conversation Detail`
3. `Lead Management`
4. `Lead Detail`
5. `Customer Detail`
6. `Action Center`

Jangan dibalik.

Alasannya:

- `Queue` dipakai untuk melihat chat yang masuk
- `Conversation Detail` dipakai untuk memahami konteks
- `Lead Management` dipakai untuk memilih lead mana yang perlu dirapikan
- `Lead Detail` dipakai untuk update data eksekusi
- `Customer Detail` dipakai untuk merapikan identitas customer
- `Action Center` dipakai untuk bersih-bersih prioritas harian

---

## 5. Panduan Halaman Satu Per Satu

## 5.1 Queue

### Fungsi halaman ini

Queue adalah tempat kerja utama sales untuk membaca chat customer.

### Yang biasanya terlihat

- daftar conversation
- preview isi chat
- channel
- risk level
- kategori akun
- tombol `AI Analysis`
- tombol `Generate Draft`
- tombol `Buka Chat`

### Cara pakai

1. buka `Queue`
2. pilih chat yang paling penting
3. baca preview singkat
4. kalau AI belum jalan, tekan `AI Analysis`
5. kalau perlu draft, tekan `Generate Draft`
6. kalau butuh konteks penuh, tekan `Buka Chat`

### Hal yang harus dicari saat membaca satu row chat

- nama customer
- isi chat terakhir
- channel
- risk level
- kategori akun
- apakah draft sudah ada

### Jangan lakukan ini di Queue

- membuka semua chat satu per satu tanpa prioritas
- langsung membalas tanpa membaca konteks
- mengirim draft AI mentah untuk topik sensitif

---

## 5.2 Conversation Detail

### Fungsi halaman ini

Halaman ini dipakai untuk membaca percakapan lengkap.

### Yang biasanya ada

- transcript chat
- hasil AI analysis
- draft balasan
- sent logs
- account category
- konteks lead

### Urutan membaca halaman ini

1. baca chat terbaru dulu
2. lihat siapa bicara terakhir
3. pahami apa yang diminta customer
4. lihat AI analysis
5. lihat next action recommendation
6. lihat draft balasan
7. edit atau tindak lanjuti

### Catatan penting

- `account category` membantu Clara memilih knowledge `Mini` atau `Reguler`
- kalau kategori salah, perbaikannya biasanya dilakukan dari `Lead Detail` atau `Customer Detail`

### Untuk kasus sensitif

Kalau customer bertanya soal:

- legalitas
- kebijakan
- janji hasil
- aturan pembayaran

jangan langsung kirim draft mentah. Baca dulu konteksnya dan pastikan jawabannya aman.

---

## 5.3 Lead Capture

### Fungsi halaman ini

Dipakai untuk memasukkan chat baru ke Clara.

### Aturan baru yang wajib dipahami

Judul conversation sekarang **wajib diisi dengan nama customer**.

Jangan isi dengan:

- `chat baru`
- `customer`
- `test`

Isi dengan nama customer yang benar.

### Cara pakai

1. buka `Lead Capture`
2. isi nama customer sebagai judul conversation
3. pilih cara input:
   - upload file TXT
   - paste chat manual
4. cek isi chat
5. submit
6. cek hasil parsing

### Yang harus diperiksa setelah submit

- apakah nama customer terbaca benar
- apakah isi chat lengkap
- apakah conversation terbentuk
- apakah lead ikut terbentuk
- apakah customer profile awal ikut masuk

---

## 5.4 Lead Management

### Fungsi halaman ini

Dipakai untuk membaca banyak lead secara cepat.

Tujuannya bukan membaca semua lead satu per satu, tetapi menemukan:

- lead mana yang perlu tindakan
- lead mana yang terlambat
- lead mana yang belum sinkron
- lead mana yang perlu dibuka detailnya

### Yang biasanya terlihat

- ringkasan total lead
- search
- filter
- bucket lead
- list lead
- preview lead

### Cara pakai

1. buka `Lead Management`
2. lihat angka ringkasan di atas
3. fokus ke:
   - `Needs tindakan`
   - `Overdue`
   - `Needs sync`
4. pilih bucket yang paling penting
5. baca lead satu per satu dari bucket itu
6. buka detail lead jika perlu

### Hal yang harus dilihat di satu kartu lead

- nama customer
- stage
- badge seperti `Overdue`, `Hot`, atau `Disiplin stale`
- owner
- kontak terakhir
- next follow-up
- kategori akun

---

## 5.5 Lead Detail

### Fungsi halaman ini

Halaman ini adalah pusat kerja untuk satu lead.

### Bagian yang biasanya ada

- konteks lead
- log disiplin harian
- metrik deal
- tugas follow-up
- timeline aktivitas

### Urutan membaca

1. lihat action plan di bagian atas
2. cek follow-up
3. cek owner
4. cek metrik deal
5. cek `account category`
6. cek task dan timeline

### Hal penting yang harus diisi sales

- stage lead
- next follow-up
- log disiplin
- metrik deal jika memang perlu

### Kapan harus isi log disiplin

- setelah follow-up penting
- setelah telepon
- setelah meeting
- saat customer memberi sinyal baru

---

## 5.6 Customer List

### Fungsi halaman ini

Dipakai untuk mencari customer yang sudah dikenal Clara.

### Kapan harus buka

- saat Anda ingin cari satu customer tertentu
- saat Anda merasa satu orang terbaca dari banyak lead
- saat Anda ingin rapikan identitas customer

### Cara pakai

1. buka `Customer List`
2. cari nama customer
3. buka detailnya

---

## 5.7 Customer Detail

### Fungsi halaman ini

Dipakai untuk memahami satu customer secara utuh.

### Yang biasanya ada

- ringkasan customer
- profil customer
- lead terkait
- data customer
- channel coverage

### Urutan membaca

1. lihat `Profil customer` dulu
2. cek nama, telepon, email, alamat, status
3. cek `kategori akun`
4. cek `temperature customer`
5. lihat lead terkait
6. buka lead prioritas kalau perlu

### Tentang kategori akun

Kategori akun bisa:

- terbaca otomatis oleh Clara
- diubah manual oleh sales jika memang yakin

Pilihan yang biasanya ada:

- `Belum ditentukan`
- `Mini`
- `Reguler`

### Tentang temperature customer

Temperature bisa:

- diisi otomatis berdasarkan hasil analisa Clara
- diubah manual jika penilaian otomatis kurang tepat

Pilihan yang biasanya ada:

- `Belum ditentukan`
- `Cold`
- `Warm`
- `Hot`

### Tentang AI autofill

Clara bisa membantu mengisi otomatis:

- nama customer
- nomor telepon
- email
- alamat
- kategori akun
- temperature

Tetapi:

- user tetap boleh koreksi manual
- jangan isi data palsu bila masih ragu

---

## 5.8 Action Center

### Fungsi halaman ini

Dipakai untuk melihat pekerjaan harian yang paling perlu dibersihkan.

### Yang biasanya ada

- overdue
- due today
- hot lead
- item perlu analisis
- item siap kirim

### Cara pakai

1. buka `Action Center`
2. fokus ke bucket paling kritis
3. lihat item mana yang paling telat
4. kerjakan satu per satu
5. setelah selesai, pindah ke bucket berikutnya

---

## 6. Apa Yang Harus Dilakukan Kalau Melihat Status Ini

## 6.1 `Overdue`

Artinya:

- follow-up sudah lewat dari jadwal

Yang harus dilakukan:

1. buka lead
2. baca chat terakhir
3. tentukan langkah berikutnya
4. isi `next follow-up` baru

## 6.2 `Disiplin stale`

Artinya:

- aktivitas sudah lama tidak dicatat

Yang harus dilakukan:

1. buka lead detail
2. isi log disiplin baru
3. tulis aktivitas terbaru secara jujur dan jelas

## 6.3 `Needs sync`

Artinya:

- data di lead belum cocok dengan kondisi deal sebenarnya

Yang harus dilakukan:

1. buka lead detail
2. periksa `Metrik Deal`
3. samakan status, nilai, atau catatan deal

## 6.4 Chat `high risk`

Artinya:

- balasan berpotensi sensitif atau salah

Yang harus dilakukan:

1. jangan kirim draft mentah
2. baca konteks penuh
3. cek kategori akun
4. pastikan jawabannya aman

## 6.5 Customer profile terasa salah

Artinya:

- nama, nomor, kategori akun, atau temperature bisa terbaca kurang tepat

Yang harus dilakukan:

1. buka `Customer Detail`
2. cek lead terkait
3. koreksi manual kalau Anda yakin
4. jangan isi asal jika masih ragu

---

## 7. Checklist Cepat Sales

Sebelum selesai kerja hari itu, cek:

- apakah semua chat penting sudah dibaca
- apakah follow-up penting sudah punya jadwal
- apakah lead panas tidak dibiarkan
- apakah aktivitas penting sudah dicatat
- apakah data customer penting yang baru muncul sudah cukup rapi

---

## 8. Hal Yang Jangan Dilakukan Sales

- jangan kirim draft AI mentah untuk topik sensitif
- jangan membiarkan `Overdue` tanpa tindakan
- jangan menutup pekerjaan tanpa mengisi `next follow-up`
- jangan mengubah data deal kalau belum yakin
- jangan mengisi data customer palsu hanya supaya form cepat penuh
- jangan menebak-nebak legalitas atau janji hasil

---

## 9. Troubleshooting Singkat

## 9.1 Kenapa Queue kosong

Kemungkinan:

- memang tidak ada conversation aktif
- filter terlalu ketat
- chat belum masuk ke sistem

## 9.2 Kenapa kategori akun belum muncul

Kemungkinan:

- Clara belum cukup yakin membaca kategori akun
- analisis chat belum dijalankan

Yang harus dilakukan:

1. cek apakah AI analysis sudah dijalankan
2. buka `Lead Detail` atau `Customer Detail`
3. isi manual jika Anda yakin

## 9.3 Kenapa temperature customer berbeda dengan lead

Kemungkinan:

- temperature customer pernah diubah manual
- ada sinyal baru dari lead lain

Yang harus dilakukan:

1. buka `Customer Detail`
2. lihat nilai temperature customer
3. putuskan apakah perlu disesuaikan manual

---

## 10. Ringkasan Super Singkat

Kalau Anda lupa semua isi manual ini, ingat 4 hal:

- mulai kerja dari `Queue`
- rapikan lead di `Lead Management` dan `Lead Detail`
- rapikan identitas di `Customer Detail`
- bersihkan prioritas harian di `Action Center`

Kalau Anda bingung melihat satu item:

- chat -> buka `Conversation Detail`
- lead -> buka `Lead Detail`
- customer -> buka `Customer Detail`

---

## 11. Penutup

Clara paling mudah dipakai kalau sales tidak mencoba menghafal semua modul sekaligus.

Mulailah dari:

- `Queue`
- `Conversation Detail`
- `Lead Management`
- `Customer Detail`

Kalau empat hal itu sudah dikuasai, workflow sales di Clara akan jauh lebih mudah dipahami.

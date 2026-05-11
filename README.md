<div align="center">

# PARTY CONSOLE

### Local multiplayer party console berbasis browser  
### Ringan, cepat, tanpa ribet, tanpa install aplikasi tambahan

<br>

<img src="https://readme-typing-svg.demolab.com?font=Inter&weight=600&size=24&duration=3000&pause=1000&color=00FF88&center=true&vCenter=true&width=700&lines=Local+Party+Gaming+System;Play+Together+Using+Phone+as+Controller;Offline+Ready;Fast+%2B+Lightweight+%2B+Open+Source" />

<br>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-Backend-111111?style=for-the-badge&logo=node.js&logoColor=00ff88">
  <img src="https://img.shields.io/badge/Socket.IO-Realtime-111111?style=for-the-badge&logo=socket.io&logoColor=white">
  <img src="https://img.shields.io/badge/Open%20Source-Community-111111?style=for-the-badge&logo=github&logoColor=white">
  <img src="https://img.shields.io/badge/Offline-Supported-111111?style=for-the-badge&logo=wifi&logoColor=00ff88">
</p>

<br>

<img src="https://capsule-render.vercel.app/api?type=waving&height=220&text=Party%20Console&fontAlign=50&fontAlignY=78&color=0:111111,100:00ff88&fontColor=ffffff&animation=fadeIn"/>
<img src="https://capsule-render.vercel.app/api?type=waving&height=120&color=0:00ff88,100:111111&section=footer"/>

</div>

---

# Tentang Project Ini

Party Console adalah sebuah local multiplayer gaming system berbasis browser yang memungkinkan HP digunakan sebagai controller dan laptop/PC digunakan sebagai layar utama.

Project ini dibuat karena jujur aja...  
main game party multiplayer sekarang makin ngeselin.

AirConsole?  
Iklannya kebanyakan.

PlayCloud?  
Delay dan lag-nya kadang bikin emosi sendiri.

Akhirnya kepikiran:

> "Kenapa nggak bikin sendiri aja sekalian?"

Dan dari situ lahir Party Console.

Fokus utama project ini:

- ringan
- realtime
- minim delay
- gampang dipakai
- bisa dimainkan rame-rame
- tidak perlu install aplikasi controller
- dan yang paling penting:
  **bisa dimainkan offline dalam satu jaringan lokal**

Jadi walaupun tidak ada internet, game tetap bisa dimainkan selama device masih dalam jaringan yang sama.

---

# Cara Kerja

Sistemnya sederhana:

- Laptop / PC → menjadi layar utama
- HP → menjadi controller
- Semua device cukup membuka browser
- Koneksi menggunakan jaringan lokal / hotspot
- Realtime communication menggunakan Socket.IO

Tidak perlu akun.  
Tidak perlu login.  
Tidak perlu pairing ribet.

Tinggal connect, ready, main.

---

# Cara Menjalankan

## 1. Clone Repository

```bash
git clone https://github.com/Poetr123/party-console
cd party-console
```

---

## 2. Install Dependency

```bash
npm install
```

---

## 3. Jalankan Server

```bash
node server.js
```

---

## 4. Sambungkan Semua Device ke Jaringan yang Sama

Bisa menggunakan:

- Hotspot HP
- WiFi rumah/sekolah
- LAN lokal
- Router lokal
- bahkan tanpa internet sekalipun

Yang penting:
semua device berada dalam jaringan yang sama.

---

## 5. Buka URL yang Muncul di Terminal

Contoh:

```txt
Screen: http://localhost:48231/screen

Controller: http://192.168.1.8:48231/controller
```

---

## 6. Mainkan

- Buka `/screen` di laptop/PC
- Buka `/controller` di HP masing-masing
- Ready
- Pilih game
- Main

Selesai.

---

# Kenapa Port-Nya Random?

Setiap server menggunakan random port secara otomatis.

Tujuannya supaya:

- lebih fleksibel
- tidak bentrok dengan aplikasi lain
- bisa menjalankan banyak room/server sekaligus dalam satu jaringan
- terasa seperti kode room dinamis

---

# Fitur Umum

- Realtime multiplayer
- HP sebagai controller
- Local network gaming
- Offline support
- Responsive mobile controller
- Lobby system
- Host system
- Kick player
- Dynamic game loading
- Modular game architecture
- Random port room system
- Open source ready
- Minim latency
- Full browser based

---

# Struktur Project

```txt
party-console/
│
├── games/
├── public/
│   ├── controller/
│   ├── screen/
│   ├── games/
│   ├── shared/
│   └── core/
│
├── server.js
├── games.js
└── README.md
```

---

# Sistem Modular

Project ini dibuat modular supaya gampang dikembangkan contributor lain.

Menambahkan game baru cukup dengan:

1. Membuat folder game baru
2. Register game ke `games.js`
3. Load game melalui `GameLoader`

Tidak perlu mengubah keseluruhan engine.

---

# Tujuan Project

Project ini dibuat bukan untuk menjadi game engine super berat atau platform kompleks.

Tujuannya lebih ke:

> bikin pengalaman local multiplayer yang seru, cepat, ringan, dan modern.

Yang penting:
langsung connect terus langsung main dan langsung seru.

---

# Harapan Kedepannya

Semoga project ini bisa berkembang jadi:

- makin modern
- makin responsif
- makin minim delay
- makin modular
- makin scalable
- makin enak dipakai rame-rame
- dan tetap ringan walaupun fiturnya bertambah banyak

Masih banyak hal random, seru dan canggih yang pengen ditambah juga nanti wkwk.

---

# Kontribusi

Kalau mau bantu contribute:

- tambah game baru
- improve controller
- improve UI/UX
- optimasi latency
- improve AI bot
- bikin map baru
- nambah Aset
- atau sekadar kasih ide

silakan banget.

Open source berarti project ini memang dibuat supaya bisa berkembang rame-rame.
Yaaa... Semoga bisa menyaingi Airconsole wkwkwkwkw :v

---

# Repository

## GitHub

https://github.com/Poetr123/party-console

---

<div align="center">

### PARTY CONSOLE

Lightweight Local Multiplayer Gaming System

<br>

Made with frustration, caffeine, dan rasa kesal terhadap delay dan iklan. 😡

</div>

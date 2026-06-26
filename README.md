# Lead Data 📇

A simple, **local** lead manager for macOS (Electron). Your **database is just JSON files** in a `data/` folder — no CSV, no cloud, no login, no internet needed. Built for anyone doing outreach: doctors, hotels, shops, advocates, hospitals — any kind of lead.

---

## ✨ Features

- 📋 **JSON in, JSON out** — drag & drop any `.json` to import. Smart import recognises alternate key names (`Name`, `Phone`, `mobile`, `category`, `Google Maps`…) automatically.
- 🔎 **Search & filters** — by status, **has website / no website**, quality, and WhatsApp.
- ⭐ **Quality marking** — mark each lead 🟢 Best / 🟡 Average / 🔴 Bad.
- 📞 **One-click copy** — phone only, or **name + phone** (ready to paste into WhatsApp).
- 📲 **WhatsApp check (optional)** — verify whether a number is on WhatsApp (see the ⚠️ disclaimer below).
- 📝 Status, contacted, notes, response, follow-up — all in one place.
- 🔒 **100% local** — your data stays on your computer and never leaves it.

---

## 🚀 Install & Run

### Option A — Ready-made app (easiest)
Go to the [**Releases**](../../releases) page and download the latest `.dmg`.
Open it → drag **Lead Data** to Applications → launch.

> ⚠️ The app is **unsigned** (no Apple Developer account), so macOS shows an
> "unidentified developer" warning the first time. Fix: **right-click the app → Open → Open**. (One time only.)
> Only for **Apple Silicon Macs (arm64)**.

### Option B — From source (developers)
```bash
git clone https://github.com/jairaj0/lead-data.git
cd lead-data
npm install
npm start
```

### Build your own `.dmg`
```bash
npm run dist      # creates dist/Lead Data-<version>-arm64.dmg
```

---

## 📖 How to use

1. **Add leads:** click **＋ Lead**, or **drag & drop a `.json`** file onto the window.
2. **Filter:** use the chips — status, 🌐 Has website / 🚫 No website, quality, WhatsApp.
3. **Mark quality:** each lead has a Best / Average / Bad dropdown.
4. **Copy for WhatsApp:** the 📋 Phone or 📋 Name+Phone buttons.
5. **WhatsApp check (optional):** see below.

### JSON format
The JSON must be an **array** `[ {…}, {…} ]`. Only `name` is required — everything else is optional.
The app also accepts alternate key names (case/space-insensitive), e.g. `Name`, `Phone Number`, `mobile`, `category`, `Google Maps`, `Stars`, `Reviews`.

```json
[
  {
    "name": "Sunrise Hotel",
    "phone": "098765 43210",
    "category": "Hotel",
    "company": "Sunrise Hospitality Pvt Ltd",
    "location": "Main Road, Sample City, 800001",
    "website": "https://example.com",
    "rating": 4.5,
    "reviews_count": 210
  }
]
```
There's a **📋 JSON format** button inside the app that shows this template and copies it.

---

## ⚠️ WhatsApp check — please read

The optional WhatsApp feature uses **[whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js)**, an
**unofficial** library that automates WhatsApp Web with your own logged-in account.

- ❗ **It is against WhatsApp's Terms of Service.** Checking many numbers quickly can get your **WhatsApp number banned**.
- The app deliberately slows it down: a **random 15–60 sec gap** between checks and a **hard cap of 20 per run** — then you start the next batch manually.
- **Strongly recommended:** use a **spare/secondary number**, go slow, keep batches small.
- This is provided for educational/personal use. **You are responsible** for how you use it. The authors take no responsibility for bans or misuse.

To use it: open **📲 WhatsApp check** → scan the QR with your phone (WhatsApp → Linked devices) → **Check next 20**. The check runs in the background — you can close the popup and keep working; progress shows on the button.

---

## 💾 Where is my data?

- **Packaged app & dev mode:** `~/Library/Application Support/lead-data/data/`
  (seeded once from this repo's `data/` folder on first run).
- WhatsApp session (if used): `~/Library/Application Support/lead-data/wa-session/` — never leaves your machine.

The **📁 Data** button in the app opens this folder in Finder. Each `.json` file in it is one dataset (shown in the app's dropdown). Any change you make saves straight back to that JSON.

> The `data/` folder in this repo only contains `sample_leads.json` (dummy data). Your real leads stay on your computer and are **not** part of the repo.

---

## 🗂 Project structure
```
lead-data/
├── main.js           # Electron main process + data folder logic
├── preload.js        # safe bridge (renderer <-> main)
├── leadstore.js      # JSON read/write (database layer) + smart key mapping
├── whatsapp.js       # optional WhatsApp check (whatsapp-web.js)
├── public/index.html # the whole UI
├── build/            # app icons
└── data/             # sample dataset (your real data lives in userData, see above)
```

## 🛠 Tech
Electron · vanilla JS (no framework) · JSON file storage · whatsapp-web.js (optional).

## 📄 License
[MIT](LICENSE) — free to use, modify, and share.

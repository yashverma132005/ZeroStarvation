# 🌿 Zero Starvation

**End Hunger, End Waste** — A platform connecting restaurants with surplus food to NGOs and individuals who redistribute it to people in need.

![Status](https://img.shields.io/badge/Status-Production--Ready-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) v18+ installed
- A free [Supabase](https://supabase.com/) account

### 1. Clone & Install

```bash
git clone https://github.com/your-username/zero-starvation.git
cd zero-starvation
npm run setup
```

### 2. Set Up Supabase

1. Go to [supabase.com](https://supabase.com/) and create a new project
2. Once your project is ready, go to **SQL Editor** in the Supabase dashboard
3. Copy the contents of `database/schema.sql` and run it in the SQL Editor
4. Go to **Settings → API** and copy your:
   - **Project URL** (e.g., `https://abc123.supabase.co`)
   - **anon / public key**

### 3. Configure Frontend

Open `frontend/js/config.js` and replace the placeholder values:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

### 4. Run the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗 Project Structure

```
ZeroStarvation/
├── frontend/                 # Client-side SPA
│   ├── index.html           # Main HTML (all pages)
│   ├── css/
│   │   └── style.css        # Complete design system
│   └── js/
│       ├── app.js           # SPA router & initialization
│       ├── config.js        # Supabase client config
│       ├── auth.js          # Authentication flows
│       ├── donations.js     # Donation CRUD & rendering
│       ├── dashboard.js     # Dashboard rendering
│       ├── map.js           # Leaflet map integration
│       └── utils.js         # Utilities & helpers
├── backend/                  # Express server
│   ├── server.js            # Static file server + health check
│   └── package.json
├── database/
│   └── schema.sql           # Supabase schema + RLS policies
├── Dockerfile
├── docker-compose.yml
├── .github/workflows/ci.yml
├── .env.example
└── README.md
```

---

## 🎯 Features

### Restaurant Users
- **Sign up / Log in** with email & password
- **Post donations**: food type, quantity, expiry time, pickup location (map)
- **View your donations** with status tracking
- **See NGO requests** in your area
- **Mark donations as completed** after pickup

### NGO / Individual Users
- **Sign up / Log in** with email & password
- **Browse available donations** with filters (search, status)
- **Map view** of all donations with clickable markers
- **Claim donations** with one click
- **Contact restaurants** via phone, WhatsApp, or in-app messaging
- **Post food requests** for their programs
- **Get directions** to pickup location via Google Maps

### General
- 🗺 **Interactive maps** (Leaflet + OpenStreetMap)
- 📱 **Fully responsive** (mobile, tablet, desktop)
- 🔒 **Row-Level Security** (Supabase RLS policies)
- 🔑 **JWT authentication** (via Supabase Auth)
- 🎨 **Modern UI** with green/earth tone design system
- ♿ **Accessible** (ARIA labels, keyboard navigation, focus management)
- ⚡ **Real-time ready** (Supabase subscriptions)

---

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|------------|----------|
| `SUPABASE_URL` | Your Supabase project URL | Yes (in `config.js`) |
| `SUPABASE_ANON_KEY` | Your Supabase anon key | Yes (in `config.js`) |
| `PORT` | Server port (default: 3000) | No |
| `NODE_ENV` | Environment (development/production) | No |

---

## 🚢 Deployment

### Option 1: Render / Railway

1. Push your code to GitHub
2. Connect your repo on [Render](https://render.com/) or [Railway](https://railway.app/)
3. Set the build command: `cd backend && npm install`
4. Set the start command: `cd backend && node server.js`
5. Add environment variables

### Option 2: Docker

```bash
# Build and run
docker-compose up -d

# Or build manually
docker build -t zero-starvation .
docker run -p 3000:3000 zero-starvation
```

### Option 3: Vercel (Frontend Only)

Deploy the `frontend/` directory to Vercel as a static site.

---

## 🧪 Testing

### Manual Testing Checklist

1. ✅ Sign up as a restaurant
2. ✅ Log in with credentials
3. ✅ Post a new food donation
4. ✅ Log out, sign up as an NGO
5. ✅ Browse available donations
6. ✅ View donation on the map
7. ✅ Claim a donation
8. ✅ Contact the restaurant (phone/WhatsApp)
9. ✅ Mark donation as completed
10. ✅ Test on mobile viewport

### Smoke Test

```bash
# Start the server and test health endpoint
npm run dev
curl http://localhost:3000/api/health
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Backend | Node.js, Express |
| Database | PostgreSQL (Supabase) |
| Auth | Supabase Auth (JWT) |
| Maps | Leaflet + OpenStreetMap |
| Fonts | Google Fonts (Inter) |
| Deployment | Docker, Render/Railway/Vercel |

---

## 📜 License

MIT License — feel free to use and modify.

---

Built with 💚 for a hunger-free world.

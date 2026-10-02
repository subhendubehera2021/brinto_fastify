# Brinto Node.js TypeScript + Fastify API (Vercel Ready)

Backend REST API and interactive OpenAPI developer documentation built with **Node.js**, **TypeScript**, **Fastify**, and **Mongoose**, configured for both standalone server deployment and **Vercel Serverless Functions**.

---

## 🚀 Features

- **Fastify + TypeScript** server architecture (`src/app.ts` and `src/server.ts`).
- **Vercel Serverless Ready** via `/api/index.ts` and `vercel.json` rewrites.
- **Mongoose / MongoDB integration** with connection caching and offline fallback in `src/lib/db.ts`.
- **Interactive Scalar OpenAPI Documentation** available at `/docs` and `/api/openapi.json`.
- **Modular Domain Architecture** (`users`, `forms`, `documents`, `orders`, `order-additional-docs`, `payments`).

---

## 🛠️ Environment Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Configure your environment variables in `.env`:
   ```env
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/brinto
   JWT_SECRET=your_jwt_secret
   CASHFREE_TEST_APP_ID=
   CASHFREE_TEST_SECRET_KEY=
   CASHFREE_PROD_APP_ID=
   CASHFREE_PROD_SECRET_KEY=
   ```

---

## 💻 Local Development

Start the Fastify development server with hot reload on port `3000`:
```bash
npm run dev
```

- **API Status:** `http://localhost:3000/`
- **Interactive API Docs (Scalar):** `http://localhost:3000/docs`
- **OpenAPI Spec:** `http://localhost:3000/api/openapi.json`
- **Health Check:** `http://localhost:3000/api/health`

---

## ▲ Vercel Deployment

This repository includes `vercel.json` and `api/index.ts` for zero-config Vercel Serverless deployment:

1. Import the project into Vercel or run:
   ```bash
   npx vercel
   ```
2. Add `MONGODB_URI`, `JWT_SECRET`, and Cashfree credentials in your Vercel Project Environment Variables.
3. Deploy to production:
   ```bash
   npx vercel --prod
   ```

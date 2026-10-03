# Brinto Node.js TypeScript API (Fastify & Hono Dual-Engine, Vercel Ready)

Backend REST API and interactive OpenAPI developer documentation built with **Node.js**, **TypeScript**, and **Mongoose**, designed with clean decoupled domain modules that allow switching effortlessly between **Fastify** and **Hono** without modifying any business logic, controllers, services, or models.

---

## 🚀 Features

- **Dual-Engine Architecture**: Switch seamlessly between **Fastify** (`src/app.ts`) and **Hono** (`src/hono-app.ts`).
- **Zero-Coupling Modules**: All models (`src/models/`), DAOs, services, and routers (`src/modules/`) use standard Web Fetch API (`Request` -> `Response`), making them 100% framework-agnostic.
- **Vercel Serverless Ready** via `/api/index.ts` and `vercel.json` rewrites.
- **Mongoose / MongoDB integration** with singleton connection caching and offline fallback in `src/lib/db.ts`.
- **Interactive Scalar OpenAPI Documentation** available at `/docs` and `/api/openapi.json`.
- **Modular Domain Architecture** (`users`, `forms`, `documents`, `orders`, `order-additional-docs`, `payments`).

---

## 🔄 Switching Between Fastify and Hono

### Local Development
You can switch frameworks with a single command or environment variable:

- **Run Fastify**:
  ```bash
  npm run dev:fastify
  # or FRAMEWORK=fastify npm run dev
  ```

- **Run Hono**:
  ```bash
  npm run dev:hono
  # or FRAMEWORK=hono npm run dev
  ```

### On Vercel
In your Vercel Project Settings > **Environment Variables**, simply set:
- `FRAMEWORK=hono` (default) or `FRAMEWORK=fastify`
Redeploy without changing any source code!

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
   CASHFREE_USE_SDK=true
   ```

   `CASHFREE_USE_SDK` selects the Cashfree integration: `true` uses the SDK, while
   `false` uses the direct API implementation. It defaults to `true` when unset.

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

   <!-- Compatibility flags updated -->
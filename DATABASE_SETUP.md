# PostgreSQL Database Setup Guide

This guide walks you through setting up PostgreSQL with Neon for the AI Diagnostics application.

## ✅ Completed Steps

1. ✅ Installed Prisma dependencies (`@prisma/client` and `prisma`)
2. ✅ Created Prisma schema (`prisma/schema.prisma`) with Diagnostic model
3. ✅ Created database client (`lib/db.ts`)
4. ✅ Updated storage functions (`lib/storage.ts`) to use database
5. ✅ Updated API routes to use async database calls
6. ✅ Updated package.json with Prisma scripts
7. ✅ Generated Prisma Client

## 🔧 Next Steps: Set Up Neon Database

### Step 1: Create Neon Account & Project

1. Go to https://neon.tech
2. Sign up (GitHub/Google)
3. Click "Create Project"
4. Name: `ai-diagnostics` (or your choice)
5. Region: Choose closest to your users
6. PostgreSQL version: 15 or 16

### Step 2: Get Connection String

1. After project creation, open the project dashboard
2. Go to "Connection Details"
3. Copy the connection string (looks like: `postgresql://user:password@host.neon.tech/dbname?sslmode=require`)

### Step 3: Add DATABASE_URL to Environment Variables

Add to `.env.local`:

```bash
DATABASE_URL="postgresql://user:password@host.neon.tech/dbname?sslmode=require"
```

**Important**: Replace the connection string with your actual Neon connection string.

### Step 4: Run Database Migration

Run this command to create the database table:

```bash
npm run db:migrate
```

When prompted, name the migration: `init_diagnostics`

This will:
- Create the `diagnostics` table in your Neon database
- Generate migration files in `prisma/migrations/`

### Step 5: Test Locally

1. Start the dev server:
   ```bash
   npm run dev
   ```

2. Generate a diagnostic — it should save to the database

3. (Optional) View data in Prisma Studio:
   ```bash
   npm run db:studio
   ```
   Opens at `http://localhost:5555` — you can view/edit data

## 🚀 Deploy to Production (Vercel)

### Step 1: Add DATABASE_URL to Vercel

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DATABASE_URL` with your Neon connection string
3. Make sure to select all environments (Production, Preview, Development)

### Step 2: Deploy

The build command is already configured in `package.json` to run `prisma generate` before building:

```bash
git add .
git commit -m "Add PostgreSQL database with Prisma"
git push origin main
```

Vercel will automatically:
- Run `prisma generate` during build
- Connect to your Neon database
- Use the DATABASE_URL environment variable

## 📋 Database Schema

The `Diagnostic` model stores:
- `id`: Unique identifier (CUID)
- `unitId`: Lift/unit identifier
- `unitName`: Lift/unit name
- `buildingName`: Building name
- `generatedAt`: Timestamp when diagnostic was created
- `visitReports`: JSON array of visit reports
- `breakdowns`: JSON array of breakdowns
- `maintenanceIssues`: JSON array of maintenance issues
- `repairRequests`: JSON array of repair requests (optional)
- `analysis`: JSON object containing LLM analysis (optional)

**Indexes** are created on:
- `unitId` (for filtering by unit)
- `generatedAt` (for date-based queries)
- `unitName` (for search)
- `buildingName` (for filtering by building)

## 🛠️ Available Scripts

- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Create a new migration
- `npm run db:studio` - Open Prisma Studio (database GUI)

## 🔍 Benefits

✅ **Persistent Storage**: Works in production (Vercel serverless)  
✅ **Search/Filter**: Can add queries by unit name, building, date range  
✅ **Scalable**: Handles 30+ diagnostics/day easily  
✅ **Environment Separation**: Different databases for dev/prod  
✅ **Type Safety**: Prisma provides TypeScript types  

## 📝 Notes

- Past diagnostic results from file system are **not migrated** (as requested)
- Only new diagnostics will be stored in the database
- The file system storage functions (`storePDF`, `getPDF`, etc.) are still available for PDF storage if needed



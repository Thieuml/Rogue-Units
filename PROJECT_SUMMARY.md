# Project Summary - Rogue Units Analysis

## Overview

This project implements a Lift Diagnostic Summary & Issue Analysis System as specified in the PRD. It provides technicians and technical experts with instant diagnostic summaries for lifts by compiling recent data and generating actionable PDF reports.

## What Was Built

### ✅ Core Features Implemented

1. **Building & Unit Selection UI**
   - Dropdown selection for buildings (from Looker)
   - Dynamic unit loading based on selected building
   - Recent selections stored in localStorage
   - Clean, responsive interface using Tailwind CSS

2. **Context Input**
   - Optional text area for additional context
   - Used to guide LLM analysis

3. **Data Integration (Looker)**
   - Fetch buildings list
   - Fetch units by building
   - Fetch visit reports (last 30-90 days)
   - Fetch fault logs (last 30-90 days)
   - Fetch IoT alerts (optional)
   - Fetch parts replaced (optional)

4. **LLM Analysis**
   - OpenAI integration for diagnostic analysis
   - Structured prompt template
   - Deterministic output (temperature: 0.3)
   - Generates:
     - Executive summary
     - Event timeline
     - Repeated patterns
     - Likely causes (hypotheses)
     - Suggested next checks
     - Optional parts to pre-check
     - Confidence level

5. **PDF Generation**
   - Professional PDF layout using PDFKit
   - Includes all analysis sections
   - Color-coded confidence levels
   - Automatic pagination
   - Downloadable via browser

6. **Optional Storage**
   - 30-day retention for generated PDFs
   - Automatic cleanup of expired files
   - Metadata storage

### 📁 Project Structure

```
Rogue Units Analysis/
├── app/
│   ├── api/
│   │   ├── buildings/route.ts          # Fetch buildings
│   │   ├── units/route.ts               # Fetch units by building
│   │   └── diagnostic/
│   │       ├── generate/route.ts        # Generate PDF
│   │       └── preview/route.ts         # Preview message
│   ├── page.tsx                         # Main UI
│   ├── layout.tsx                       # Root layout
│   └── globals.css                       # Global styles
├── lib/
│   ├── looker.ts                        # Looker API integration
│   ├── llm-analysis.ts                  # LLM diagnostic analysis
│   ├── pdf-generator.ts                 # PDF generation
│   └── storage.ts                       # PDF storage (optional)
├── package.json                         # Dependencies
├── tsconfig.json                        # TypeScript config
├── tailwind.config.ts                   # Tailwind config
├── README.md                            # Main documentation
├── SETUP.md                             # Setup guide
└── .env.example                         # Environment variables template
```

### 🔧 Technical Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Source**: Looker API (via @looker/sdk)
- **LLM**: OpenAI API (GPT-4 Turbo)
- **PDF**: PDFKit
- **State Management**: SWR for data fetching

### 🚀 API Endpoints

1. `GET /api/buildings` - Fetch all buildings
2. `GET /api/units?buildingId=<id>` - Fetch units for a building
3. `POST /api/diagnostic/preview` - Generate preview message
4. `POST /api/diagnostic/generate` - Generate diagnostic PDF

### 📋 Environment Variables Required

See `.env.example` for full list. Key variables:
- `LOOKER_API_BASE_URL`
- `LOOKER_CLIENT_ID`
- `LOOKER_CLIENT_SECRET`
- `LOOKER_BUILDINGS_LOOK_ID=161` (Single Look for both buildings and devices)
- `LOOKER_VISITS_LOOK_ID` (or QUERY_ID)
- `LOOKER_FAULTS_LOOK_ID` (or QUERY_ID)
- `OPENAI_API_KEY`

### ✨ Key Features

- **Response Time**: Optimized for < 20 seconds
- **Deterministic Output**: Stable prompts for consistent results
- **Graceful Degradation**: Handles missing optional data
- **Recent Selections**: Quick access to previously searched units
- **Preview**: Shows what will be compiled before generation

### 📝 Next Steps

1. **Configure Looker**
   - Set up Looker looks/queries for each data type
   - Add Look/Query IDs to `.env.local`
   - Test data fetching

2. **Customize Field Names**
   - Update filter field names in `lib/looker.ts` if your Looker schema differs
   - Adjust data parsing if needed

3. **Test the System**
   - Run `npm install`
   - Configure `.env.local`
   - Run `npm run dev`
   - Test with real building/unit data

4. **Deploy**
   - Build: `npm run build`
   - Deploy to Vercel, AWS, or your preferred platform
   - Set environment variables in hosting platform

### 🔍 Areas That May Need Customization

1. **Looker Field Names**: The filter field names in `lib/looker.ts` assume specific field names. You may need to adjust:
   - `building.id` → your building ID field
   - `unit.id` → your unit ID field
   - `visit.date` → your visit date field
   - `fault.date` → your fault date field
   - etc.

2. **Data Structure**: The code assumes certain fields in the returned data. You may need to adjust:
   - Building/unit name fields
   - Visit type detection logic
   - Date parsing

3. **LLM Prompt**: The prompt in `lib/llm-analysis.ts` can be customized for your specific needs.

### 🐛 Known Limitations (Per PRD)

- No deep IoT analytics
- No editable PDFs
- No multi-step conversational agent
- No technician feedback loops

### 📚 Documentation

- `README.md` - Main project documentation
- `SETUP.md` - Detailed setup instructions
- Code comments throughout for maintainability

## Status: ✅ Complete

All core features from the PRD have been implemented and are ready for configuration and testing.


# Rogue Units Analysis - Lift Diagnostic Summary System

A tool for generating instant diagnostic summaries for lifts, compiling recent visit reports, fault logs, IoT alerts, and parts data into actionable PDF reports.

## Features

- **Building & Unit Selection**: Simple UI to select buildings and units from Looker data
- **Context-Aware Analysis**: Optional context input to tailor LLM analysis
- **Recent Selections**: Quick access to recently searched buildings/units
- **Comprehensive Diagnostics**: Compiles visits, faults, IoT alerts, and parts replaced
- **PDF Generation**: Generates structured PDF reports with:
  - Executive summary
  - Event timeline
  - Repeated patterns
  - Likely causes (hypotheses)
  - Suggested next checks
  - Optional parts to pre-check
  - Confidence level
- **Optional Storage**: 30-day storage for generated PDFs (if enabled)

## Prerequisites

- Node.js 18+ 
- Looker API access with appropriate credentials
- OpenAI API key (for LLM analysis)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Thieuml/Rogue-Units.git
cd "Rogue Units Analysis"
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory:

```env
# Looker API Configuration
LOOKER_API_BASE_URL=https://your-looker-instance.com
LOOKER_CLIENT_ID=your_client_id
LOOKER_CLIENT_SECRET=your_client_secret

# Looker Look/Query IDs (use either Look ID or Query ID for each)
LOOKER_BUILDINGS_LOOK_ID=123
# OR
# LOOKER_BUILDINGS_QUERY_ID=456

LOOKER_UNITS_LOOK_ID=124
# OR
# LOOKER_UNITS_QUERY_ID=457

LOOKER_VISITS_LOOK_ID=125
# OR
# LOOKER_VISITS_QUERY_ID=458

LOOKER_FAULTS_LOOK_ID=126
# OR
# LOOKER_FAULTS_QUERY_ID=459

# Optional - IoT Alerts
LOOKER_IOT_ALERTS_LOOK_ID=127
# OR
# LOOKER_IOT_ALERTS_QUERY_ID=460

# Optional - Parts Replaced
LOOKER_PARTS_LOOK_ID=128
# OR
# LOOKER_PARTS_QUERY_ID=461

# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo-preview  # Optional, defaults to gpt-4-turbo-preview

# Optional - Enable PDF Storage (30-day retention)
ENABLE_STORAGE=false
```

## Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Building for Production

```bash
npm run build
npm start
```

## Looker Data Requirements

The system expects Looker queries/looks that return data in the following formats:

### Buildings
- Must include: `id`, `name` (or similar fields)

### Units
- Must include: `id`, `name` (or similar fields)
- Must be filterable by `building.id`

### Visit Reports
- Must include: `date`, `type` (or `reason`), and other relevant fields
- Must be filterable by `unit.id` and `visit.date`

### Fault Logs
- Must include: `date` and fault details
- Must be filterable by `unit.id` and `fault.date`

### IoT Alerts (Optional)
- Must include: `date` and alert details
- Must be filterable by `unit.id` and `alert.date`

### Parts Replaced (Optional)
- Must include: `replaced_date` and part details
- Must be filterable by `unit.id` and `part.replaced_date`

**Note**: Field names may vary based on your Looker schema. You may need to adjust the filter field names in `lib/looker.ts` to match your actual Looker model.

## API Endpoints

### GET `/api/buildings`
Fetch all buildings from Looker.

### GET `/api/units?buildingId=<id>`
Fetch units for a specific building.

### POST `/api/diagnostic/preview`
Generate a preview message for selected unit.
Body: `{ unitId: string, daysBack?: number }`

### POST `/api/diagnostic/generate`
Generate diagnostic PDF.
Body: `{ unitId: string, unitName: string, buildingId: string, buildingName: string, context?: string, daysBack?: number }`

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   ├── page.tsx          # Main UI page
│   ├── layout.tsx        # Root layout
│   └── globals.css       # Global styles
├── lib/
│   ├── looker.ts         # Looker API integration
│   ├── llm-analysis.ts   # LLM diagnostic analysis
│   ├── pdf-generator.ts   # PDF generation
│   └── storage.ts        # PDF storage (optional)
├── generated-pdfs/       # Stored PDFs (if storage enabled)
└── temp/                 # Temporary PDF files
```

## Performance

- Target response time: < 20 seconds
- Uses deterministic LLM prompts for consistent output
- Graceful degradation when optional data is missing

## Limitations (V1)

- No deep IoT analytics or new signal models
- No editable or annotated PDFs
- No multi-step conversational agent
- No technician comments or feedback loops

## License

[Add your license here]


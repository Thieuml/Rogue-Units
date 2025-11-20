# Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   Copy `.env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   - `LOOKER_API_BASE_URL` - Your Looker instance URL
   - `LOOKER_CLIENT_ID` - Looker API client ID
   - `LOOKER_CLIENT_SECRET` - Looker API client secret
   - `OPENAI_API_KEY` - OpenAI API key for LLM analysis
   - At least one Look ID or Query ID for each data type (buildings, units, visits, faults)

3. **Configure Looker Look/Query IDs**
   
   You need to set up Looker looks or queries that return the following data:
   
   - **Buildings**: List of all buildings
   - **Units**: Units filtered by building ID
   - **Visit Reports**: Visit reports filtered by unit ID and date range
   - **Fault Logs**: Fault logs filtered by unit ID and date range
   - **IoT Alerts** (optional): IoT alerts filtered by unit ID and date range
   - **Parts Replaced** (optional): Parts replaced filtered by unit ID and date range

   Once you have the Look IDs or Query IDs, add them to `.env.local`:
   ```env
   LOOKER_BUILDINGS_LOOK_ID=161  # Single Look for both buildings and devices
   LOOKER_VISITS_LOOK_ID=125
   LOOKER_FAULTS_LOOK_ID=126
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Open Browser**
   Navigate to [http://localhost:3002](http://localhost:3002)

## Looker Query Requirements

### Buildings and Devices Query (Single Look - ID 161)
Should be filtered by country: `Account Country` = `<countryCode>` (FR, GB, SG, HK)
Should return:
- `Building ID` (string) - Building identifier
- `Building name` (string) - Building name
- `Full address` (string) - Building address
- `Country` (string) - Country code
- `Device ID` (string) - Device identifier
- `Device Name` (string) - Device name

Note: This single Look contains both buildings and devices. The system extracts unique buildings and all devices from this Look.

### Visit Reports Query
Should accept filters:
- `unit.id` = `<unitId>`
- `visit.date` >= `<startDate>` (YYYY-MM-DD format)

Should return:
- `date` (date) - Visit date
- `type` or `reason` (string) - Visit type/reason (should contain "maintenance", "callback", etc.)
- Other relevant visit details

### Fault Logs Query
Should accept filters:
- `unit.id` = `<unitId>`
- `fault.date` >= `<startDate>` (YYYY-MM-DD format)

Should return:
- `date` (date) - Fault date
- Fault description/details

### IoT Alerts Query (Optional)
Should accept filters:
- `unit.id` = `<unitId>`
- `alert.date` >= `<startDate>` (YYYY-MM-DD format)

### Parts Replaced Query (Optional)
Should accept filters:
- `unit.id` = `<unitId>`
- `part.replaced_date` >= `<startDate>` (YYYY-MM-DD format)

## Field Name Customization

If your Looker schema uses different field names, you may need to update the filter field names in `lib/looker.ts`. For example, if your model uses `building_id` instead of `building.id`, update the filter accordingly.

## Testing

1. Start the dev server: `npm run dev`
2. Open the UI at http://localhost:3002
3. Select a building and unit
4. Optionally add context
5. Click "Generate Diagnostic PDF"
6. The PDF should download automatically

## Troubleshooting

### "Failed to fetch buildings"
- Check your Looker credentials in `.env.local`
- Verify the Look/Query ID is correct
- Check that the Look/Query is accessible with your API credentials

### "Failed to generate diagnostic"
- Check OpenAI API key is set correctly
- Verify you have sufficient OpenAI credits
- Check server logs for detailed error messages

### PDF generation fails
- Ensure `pdfkit` is installed: `npm install pdfkit`
- Check server logs for PDF generation errors

### No units showing
- Verify the Look returns both buildings and devices
- Check that the country filter is working correctly
- Ensure the field names match (Building ID, Building name, Device ID, Device Name)
- Test the Look directly in Looker with the country filter applied

## Production Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Set environment variables in your hosting platform (Vercel, etc.)

3. Start the production server:
   ```bash
   npm start
   ```

## Optional: Enable PDF Storage

To enable 30-day PDF storage, set in `.env.local`:
```env
ENABLE_STORAGE=true
```

This will store generated PDFs in the `generated-pdfs/` directory with automatic cleanup after 30 days.


# Deployment Guide

This guide covers deploying the Rogue Units Analysis application to production.

## Prerequisites

- GitHub repository: `https://github.com/Thieuml/Rogue-Units.git`
- All environment variables configured (see below)
- Looker API access configured
- OpenAI API key configured

## Deployment Options

### Option 1: Vercel (Recommended for Next.js)

Vercel is the recommended platform for Next.js applications as it provides:
- Automatic deployments from GitHub
- Built-in CI/CD
- Serverless functions for API routes
- Environment variable management
- Free tier available

#### Steps:

1. **Sign up/Login to Vercel**
   - Go to https://vercel.com
   - Sign up or login with your GitHub account

2. **Import Project**
   - Click "Add New Project"
   - Import from GitHub: `Thieuml/Rogue-Units`
   - Select the repository

3. **Configure Project**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: Leave as default (or set to `Rogue_Units_Analysis` if the repo root is different)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)
   - Install Command: `npm install` (default)

4. **Set Environment Variables**
   In Vercel dashboard, go to Project Settings → Environment Variables and add:

   ```
   # Looker API Configuration
   LOOKER_API_BASE_URL=https://wemaintain.cloud.looker.com
   LOOKER_CLIENT_ID=your_client_id
   LOOKER_CLIENT_SECRET=your_client_secret

   # Looker Look IDs
   LOOKER_BUILDINGS_LOOK_ID=161
   LOOKER_VISITS_LOOK_ID=162
   LOOKER_BREAKDOWNS_LOOK_ID=163
   LOOKER_MAINTENANCE_ISSUES_LOOK_ID=165
   LOOKER_REPAIR_REQUESTS_LOOK_ID=166

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_MODEL=gpt-4o

   # Optional - PDF Storage
   ENABLE_STORAGE=false
   ```

5. **Deploy**
   - Click "Deploy"
   - Wait for build to complete
   - Your app will be live at `https://your-project-name.vercel.app`

6. **Custom Domain (Optional)**
   - Go to Project Settings → Domains
   - Add your custom domain

### Option 2: Netlify

1. Sign up at https://netlify.com
2. Connect GitHub repository
3. Build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
4. Add environment variables in Site Settings → Environment Variables
5. Deploy

### Option 3: Self-Hosted (VPS/Docker)

#### Using Docker:

1. Create `Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3002

CMD ["npm", "start"]
```

2. Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3002:3002"
    environment:
      - LOOKER_API_BASE_URL=${LOOKER_API_BASE_URL}
      - LOOKER_CLIENT_ID=${LOOKER_CLIENT_ID}
      - LOOKER_CLIENT_SECRET=${LOOKER_CLIENT_SECRET}
      - LOOKER_BUILDINGS_LOOK_ID=${LOOKER_BUILDINGS_LOOK_ID}
      - LOOKER_VISITS_LOOK_ID=${LOOKER_VISITS_LOOK_ID}
      - LOOKER_BREAKDOWNS_LOOK_ID=${LOOKER_BREAKDOWNS_LOOK_ID}
      - LOOKER_MAINTENANCE_ISSUES_LOOK_ID=${LOOKER_MAINTENANCE_ISSUES_LOOK_ID}
      - LOOKER_REPAIR_REQUESTS_LOOK_ID=${LOOKER_REPAIR_REQUESTS_LOOK_ID}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=${OPENAI_MODEL}
      - ENABLE_STORAGE=${ENABLE_STORAGE}
```

3. Build and run:
```bash
docker-compose up -d
```

## Environment Variables

### Required Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `LOOKER_API_BASE_URL` | Looker instance URL | `https://wemaintain.cloud.looker.com` |
| `LOOKER_CLIENT_ID` | Looker API client ID | (from Looker admin) |
| `LOOKER_CLIENT_SECRET` | Looker API client secret | (from Looker admin) |
| `LOOKER_BUILDINGS_LOOK_ID` | Look ID for buildings/devices | `161` |
| `LOOKER_VISITS_LOOK_ID` | Look ID for visit reports | `162` |
| `LOOKER_BREAKDOWNS_LOOK_ID` | Look ID for breakdowns | `163` |
| `LOOKER_MAINTENANCE_ISSUES_LOOK_ID` | Look ID for maintenance issues | `165` |
| `LOOKER_REPAIR_REQUESTS_LOOK_ID` | Look ID for repair requests | `166` |
| `OPENAI_API_KEY` | OpenAI API key | (from OpenAI dashboard) |
| `OPENAI_MODEL` | OpenAI model to use | `gpt-4o` |

### Optional Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_STORAGE` | Enable 30-day PDF storage | `false` |

## Post-Deployment Checklist

- [ ] Verify environment variables are set correctly
- [ ] Test building selection and device selection
- [ ] Test diagnostic analysis generation
- [ ] Test PDF generation
- [ ] Verify Looker API connectivity
- [ ] Verify OpenAI API connectivity
- [ ] Test with different countries (FR, UK, SG, HK)
- [ ] Monitor error logs for any issues
- [ ] Set up monitoring/alerts (optional)

## Troubleshooting

### Build Fails

- Check environment variables are set
- Verify Node.js version (18+)
- Check build logs for specific errors

### API Errors

- Verify Looker API credentials
- Check Looker Look IDs are correct
- Verify Looker Looks have proper filters configured (see README.md)

### PDF Generation Fails

- Check OpenAI API key is valid
- Verify API rate limits
- Check server logs for specific errors

## Monitoring

Consider setting up:
- Error tracking (Sentry, LogRocket)
- Performance monitoring (Vercel Analytics, New Relic)
- Uptime monitoring (UptimeRobot, Pingdom)

## Security Notes

- Never commit `.env.local` or environment variables to Git
- Use environment variables for all secrets
- Enable HTTPS in production
- Consider rate limiting for API routes
- Review Looker API permissions regularly














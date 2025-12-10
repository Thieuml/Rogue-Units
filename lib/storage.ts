/**
 * Storage service for generated PDFs (30-day retention)
 * Diagnostic results are now stored in PostgreSQL database
 */

import fs from 'fs'
import path from 'path'
import { prisma } from './db'

// Lazy import to avoid blocking server startup
// Prisma client will only be initialized when actually used

const STORAGE_DIR = path.join(process.cwd(), 'generated-pdfs')
const RETENTION_DAYS = 30

/**
 * Initialize storage directory
 */
export function initStorage(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

/**
 * Store PDF file with metadata
 */
export function storePDF(filePath: string, metadata: {
  unitId: string
  unitName: string
  buildingName: string
  generatedAt: Date
}): string {
  initStorage()
  
  const filename = path.basename(filePath)
  const storagePath = path.join(STORAGE_DIR, filename)
  
  // Copy file to storage
  fs.copyFileSync(filePath, storagePath)
  
  // Store metadata
  const metadataPath = storagePath.replace('.pdf', '.json')
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
  
  return storagePath
}

/**
 * Get PDF file path if it exists and is not expired
 */
export function getPDF(filename: string): string | null {
  const filePath = path.join(STORAGE_DIR, filename)
  
  if (!fs.existsSync(filePath)) {
    return null
  }
  
  // Check if expired
  const metadataPath = filePath.replace('.pdf', '.json')
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
    const generatedAt = new Date(metadata.generatedAt)
    const daysSinceGeneration = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceGeneration > RETENTION_DAYS) {
      // File expired, delete it
      fs.unlinkSync(filePath)
      fs.unlinkSync(metadataPath)
      return null
    }
  }
  
  return filePath
}

/**
 * Clean up expired PDFs
 */
export function cleanupExpiredPDFs(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    return
  }
  
  const files = fs.readdirSync(STORAGE_DIR)
  const now = Date.now()
  
  files.forEach((file) => {
    if (file.endsWith('.json')) {
      const metadataPath = path.join(STORAGE_DIR, file)
      const pdfPath = metadataPath.replace('.json', '.pdf')
      
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        const generatedAt = new Date(metadata.generatedAt)
        const daysSinceGeneration = (now - generatedAt.getTime()) / (1000 * 60 * 60 * 24)
        
        if (daysSinceGeneration > RETENTION_DAYS) {
          if (fs.existsSync(pdfPath)) {
            fs.unlinkSync(pdfPath)
          }
          fs.unlinkSync(metadataPath)
        }
      } catch (error) {
        console.error(`Error cleaning up ${file}:`, error)
      }
    }
  })
}

/**
 * Store diagnostic result in database (without PDF)
 */
export async function storeDiagnostic(metadata: {
  unitId: string
  unitName: string
  buildingName: string
  generatedAt: Date
  visitReports: any[]
  breakdowns: any[]
  maintenanceIssues: any[]
  repairRequests?: any[]
  analysis: any
}): Promise<string> {
  const diagnostic = await prisma.diagnostic.create({
    data: {
      unitId: metadata.unitId,
      unitName: metadata.unitName,
      buildingName: metadata.buildingName,
      generatedAt: metadata.generatedAt,
      visitReports: metadata.visitReports,
      breakdowns: metadata.breakdowns,
      maintenanceIssues: metadata.maintenanceIssues,
      repairRequests: metadata.repairRequests ?? undefined,
      analysis: metadata.analysis ?? undefined,
    },
  })
  
  return diagnostic.id
}

/**
 * List all stored PDFs with metadata
 */
export function listStoredPDFs(): Array<{
  filename: string
  unitId: string
  unitName: string
  buildingName: string
  generatedAt: Date
  daysRemaining: number
}> {
  if (!fs.existsSync(STORAGE_DIR)) {
    return []
  }
  
  const files = fs.readdirSync(STORAGE_DIR)
  const pdfs: Array<{
    filename: string
    unitId: string
    unitName: string
    buildingName: string
    generatedAt: Date
    daysRemaining: number
  }> = []
  
  const now = Date.now()
  
  files.forEach((file) => {
    if (file.endsWith('.json')) {
      const metadataPath = path.join(STORAGE_DIR, file)
      const pdfFilename = file.replace('.json', '.pdf')
      
      // Only include if PDF exists
      if (!fs.existsSync(path.join(STORAGE_DIR, pdfFilename))) {
        return
      }
      
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
        const generatedAt = new Date(metadata.generatedAt)
        const daysSinceGeneration = (now - generatedAt.getTime()) / (1000 * 60 * 60 * 24)
        const daysRemaining = Math.max(0, RETENTION_DAYS - daysSinceGeneration)
        
        if (daysRemaining > 0) {
          pdfs.push({
            filename: pdfFilename,
            ...metadata,
            generatedAt,
            daysRemaining: Math.floor(daysRemaining),
          })
        }
      } catch (error) {
        console.error(`Error reading metadata for ${file}:`, error)
      }
    }
  })
  
  return pdfs.sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime())
}

/**
 * List all stored diagnostics from database
 */
export async function listStoredDiagnostics(): Promise<Array<{
  id: string
  unitId: string
  unitName: string
  buildingName: string
  generatedAt: Date
  visitReports: any[]
  breakdowns: any[]
  maintenanceIssues: any[]
  repairRequests?: any[]
  analysis: any
}>> {
  const diagnostics = await prisma.diagnostic.findMany({
    orderBy: {
      generatedAt: 'desc',
    },
  })
  
  return diagnostics.map(d => ({
    id: d.id,
    unitId: d.unitId,
    unitName: d.unitName,
    buildingName: d.buildingName,
    generatedAt: d.generatedAt,
    visitReports: d.visitReports as any[],
    breakdowns: d.breakdowns as any[],
    maintenanceIssues: d.maintenanceIssues as any[],
    repairRequests: d.repairRequests as any[] | undefined,
    analysis: d.analysis as any,
  }))
}

/**
 * Get diagnostic by ID
 */
export async function getDiagnosticById(id: string) {
  const diagnostic = await prisma.diagnostic.findUnique({
    where: { id },
  })
  
  if (!diagnostic) return null
  
  return {
    id: diagnostic.id,
    unitId: diagnostic.unitId,
    unitName: diagnostic.unitName,
    buildingName: diagnostic.buildingName,
    generatedAt: diagnostic.generatedAt,
    visitReports: diagnostic.visitReports as any[],
    breakdowns: diagnostic.breakdowns as any[],
    maintenanceIssues: diagnostic.maintenanceIssues as any[],
    repairRequests: diagnostic.repairRequests as any[] | undefined,
    analysis: diagnostic.analysis as any,
  }
}


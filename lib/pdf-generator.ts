/**
 * PDF generation service for diagnostic summaries
 */

import PDFDocument from 'pdfkit'
import type { PDFDocument as PDFDocumentType } from 'pdfkit'
import { DiagnosticAnalysis, DiagnosticData } from './llm-analysis'
import fs from 'fs'
import path from 'path'

/**
 * Generate PDF diagnostic report as Buffer (for API responses)
 */
export async function generatePDFBuffer(
  data: DiagnosticData,
  analysis: DiagnosticAnalysis
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const doc = new PDFDocument({ margin: 50 })
    
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    
    generatePDFContent(doc, data, analysis)
    doc.end()
  })
}

/**
 * Generate PDF diagnostic report to file
 */
export async function generatePDF(
  data: DiagnosticData,
  analysis: DiagnosticAnalysis,
  outputPath: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Ensure output directory exists
    const outputDir = path.dirname(outputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    generatePDFContent(doc, data, analysis)
    
    doc.end()
    
    stream.on('finish', () => {
      resolve(outputPath)
    })
    
    stream.on('error', (error) => {
      reject(error)
    })
  })
}

/**
 * Generate PDF content (shared between buffer and file generation)
 */
function generatePDFContent(
  doc: PDFDocumentType,
  data: DiagnosticData,
  analysis: DiagnosticAnalysis
): void {
  // Header
  doc.fontSize(20).font('Helvetica-Bold')
  doc.text('Lift Diagnostic Summary', { align: 'center' })
  doc.moveDown(0.5)
  
  // Unit Information
  doc.fontSize(14).font('Helvetica-Bold')
  doc.text(`Unit: ${data.unitName}`)
  doc.font('Helvetica')
  doc.fontSize(12)
  doc.text(`Building: ${data.buildingName}`)
  doc.text(`Generated: ${new Date().toLocaleDateString()}`)
  doc.moveDown(1)
  
  // Executive Summary
  doc.fontSize(16).font('Helvetica-Bold')
  doc.text('Executive Summary', { underline: true })
  doc.moveDown(0.3)
  doc.fontSize(11).font('Helvetica')
  doc.text(analysis.executiveSummary, {
    align: 'left',
    lineGap: 3,
  })
  doc.moveDown(1)
  
  // Confidence Level
  doc.fontSize(12).font('Helvetica-Bold')
  doc.text(`Confidence Level: `, { continued: true })
  doc.font('Helvetica')
  doc.fillColor(getConfidenceColor(analysis.confidenceLevel))
  doc.text(analysis.confidenceLevel.toUpperCase())
  doc.fillColor('black')
  doc.moveDown(1)
  
  // Timeline
  if (analysis.timeline.length > 0) {
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Event Timeline', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    
    analysis.timeline.forEach((event, index) => {
      if (index > 0 && index % 20 === 0) {
        doc.addPage()
      }
      
      doc.text(`${event.date} [${event.type.toUpperCase()}]`, {
        continued: false,
        indent: 10,
      })
      doc.text(event.description, { indent: 30, lineGap: 2 })
      doc.moveDown(0.2)
    })
    doc.moveDown(1)
  }
  
  // Repeated Patterns
  if (analysis.repeatedPatterns.length > 0) {
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Repeated Patterns', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica')
    
    analysis.repeatedPatterns.forEach((pattern) => {
      doc.font('Helvetica-Bold')
      doc.text(`${pattern.pattern} (${pattern.frequency} occurrences)`, {
        indent: 10,
      })
      doc.font('Helvetica')
      pattern.examples.forEach((example) => {
        doc.text(`• ${example}`, { indent: 20, lineGap: 1 })
      })
      doc.moveDown(0.3)
    })
    doc.moveDown(1)
  }
  
  // Hypotheses
  if (analysis.hypotheses.length > 0) {
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Likely Causes', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica')
    
    analysis.hypotheses.forEach((hypothesis) => {
      doc.font('Helvetica-Bold')
      doc.text(`${hypothesis.category} (${hypothesis.likelihood} likelihood)`, {
        indent: 10,
      })
      doc.font('Helvetica')
      doc.text(hypothesis.reasoning, {
        indent: 20,
        lineGap: 2,
      })
      doc.moveDown(0.3)
    })
    doc.moveDown(1)
  }
  
  // Suggested Checks
  if (analysis.suggestedChecks.length > 0) {
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Suggested Next Checks', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica')
    
    analysis.suggestedChecks.forEach((check) => {
      doc.text(`• ${check}`, { indent: 10, lineGap: 2 })
    })
    doc.moveDown(1)
  }
  
  // Optional Parts to Check
  if (analysis.optionalPartsToCheck.length > 0) {
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Optional Parts to Pre-Check', { underline: true })
    doc.moveDown(0.3)
    doc.fontSize(11).font('Helvetica')
    
    analysis.optionalPartsToCheck.forEach((part) => {
      doc.text(`• ${part}`, { indent: 10, lineGap: 2 })
    })
    doc.moveDown(1)
  }
  
  // Footer
  doc.fontSize(8).font('Helvetica')
  doc.text(
    `Generated by Rogue Units Analysis System - ${new Date().toISOString()}`,
    { align: 'center' }
  )
}

/**
 * Get color for confidence level
 */
function getConfidenceColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return '#00AA00'
    case 'medium':
      return '#FF8800'
    case 'low':
      return '#CC0000'
    default:
      return '#000000'
  }
}

/**
 * Generate a unique filename for the PDF
 */
export function generatePDFFilename(unitId: string, unitName: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const sanitizedName = unitName.replace(/[^a-zA-Z0-9]/g, '_')
  return `diagnostic_${sanitizedName}_${unitId}_${timestamp}.pdf`
}


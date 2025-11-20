/**
 * PDF generation service for diagnostic summaries
 */

import PDFDocument from 'pdfkit'
type PDFDocumentType = typeof PDFDocument.prototype
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
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
    })
    
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
    
    const doc = new PDFDocument({ 
      margin: 50,
      size: 'A4',
    })
    const stream = fs.createWriteStream(outputPath)
    doc.pipe(stream)
    
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
  // Ensure analysis has required fields
  if (!analysis) {
    throw new Error('Analysis data is required for PDF generation')
  }
  
  // Ensure required fields exist with defaults
  const safeAnalysis = {
    executiveSummary: analysis.executiveSummary || 'No summary available',
    repeatedPatterns: analysis.repeatedPatterns || [],
    hypotheses: analysis.hypotheses || [],
    suggestedChecks: analysis.suggestedChecks || [],
    confidenceLevel: (analysis.confidenceLevel || 'medium') as 'low' | 'medium' | 'high',
    partsReplaced: analysis.partsReplaced || [],
  }
  
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const margin = 50
  const headerHeight = 80
  const footerHeight = 60
  const contentTop = headerHeight + 20
  const contentBottom = pageHeight - footerHeight
  
  // Track current Y position
  let currentY = contentTop
  
  // Add header function
  const addHeader = () => {
    doc.save()
    // Header background
    doc.rect(0, 0, pageWidth, headerHeight)
      .fillColor('#1e293b') // slate-800
      .fill()
    
    // Logo text (WeMaintain)
    doc.fillColor('#ffffff')
    doc.fontSize(24).font('Helvetica-Bold')
    doc.text('WeMaintain', margin, 25, { align: 'left' })
    
    // Title
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text('Lift Diagnostic Summary', margin, 50, { align: 'left' })
    
    doc.restore()
  }
  
  // Add footer function
  const addFooter = () => {
    doc.save()
    const footerY = pageHeight - footerHeight
    
    // Footer background
    doc.rect(0, footerY, pageWidth, footerHeight)
      .fillColor('#f8fafc') // gray-50
      .fill()
    
    // Footer line
    doc.moveTo(margin, footerY)
      .lineTo(pageWidth - margin, footerY)
      .strokeColor('#e2e8f0')
      .lineWidth(1)
      .stroke()
    
    // WeMaintain logo text
    doc.fillColor('#1e293b')
    doc.fontSize(10).font('Helvetica-Bold')
    doc.text('WeMaintain', margin, footerY + 15, { align: 'left' })
    
    // Generated info
    doc.fontSize(8).font('Helvetica')
    doc.fillColor('#64748b')
    doc.text(
      `Generated: ${new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })}`,
      margin,
      footerY + 30,
      { align: 'left' }
    )
    
    // Page number
    doc.text(
      `Page ${doc.bufferedPageRange().start + 1}`,
      pageWidth - margin,
      footerY + 15,
      { align: 'right' }
    )
    
    doc.restore()
  }
  
  // Helper function to check if we need a new page
  const ensureSpace = (requiredHeight: number): void => {
    if (currentY + requiredHeight > contentBottom) {
      addFooter()
      doc.addPage()
      addHeader()
      currentY = contentTop
    }
  }
  
  // Helper function to add vertical space
  const addSpace = (height: number): void => {
    currentY += height
    // Don't check for page break here - let the caller do it if needed
  }
  
  // Initial header
  addHeader()
  
  // Unit Information Box
  ensureSpace(70)
  doc.rect(margin, currentY, pageWidth - 2 * margin, 60)
    .fillColor('#f1f5f9') // slate-100
    .fill()
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .stroke()
  
  doc.fillColor('#0f172a') // slate-900
  doc.fontSize(16).font('Helvetica-Bold')
  doc.text(`Unit: ${data.unitName}`, margin + 10, currentY + 10)
  
  doc.fontSize(12).font('Helvetica')
  doc.fillColor('#475569') // slate-600
  doc.text(`Building: ${data.buildingName}`, margin + 10, currentY + 30)
  doc.text(`Unit ID: ${data.unitId}`, margin + 10, currentY + 45)
  
  currentY += 80
  ensureSpace(0)
  
  // Executive Summary
  ensureSpace(100)
  doc.fillColor('#0f172a')
  doc.fontSize(18).font('Helvetica-Bold')
  doc.text('Summary', margin, currentY)
  currentY += 25
  ensureSpace(50)
  
  doc.fillColor('#334155') // slate-700
  doc.fontSize(11).font('Helvetica')
  const summaryText = safeAnalysis.executiveSummary
  const summaryLines = doc.heightOfString(summaryText, {
    width: pageWidth - 2 * margin,
    lineGap: 4,
  })
  ensureSpace(summaryLines + 20)
  doc.text(summaryText, {
    x: margin,
    y: currentY,
    align: 'left',
    lineGap: 4,
    width: pageWidth - 2 * margin,
  })
  currentY += summaryLines + 15
  
  // Confidence Level Badge
  if (safeAnalysis.confidenceLevel) {
    ensureSpace(35)
    const confidenceColor = getConfidenceColor(safeAnalysis.confidenceLevel)
    doc.rect(margin, currentY, 200, 25)
      .fillColor(confidenceColor)
      .fill()
    
    doc.fillColor('#ffffff')
    doc.fontSize(11).font('Helvetica-Bold')
    doc.text(
      `Confidence Level: ${safeAnalysis.confidenceLevel.toUpperCase()}`,
      margin + 10,
      currentY + 7
    )
    doc.fillColor('#0f172a')
    currentY += 35
  }
  
  // Visit Reports Table
  if (data.visitReports.length > 0) {
    ensureSpace(100)
    
    doc.fillColor('#0f172a')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text(`Visit Reports (${data.visitReports.length})`, margin, currentY)
    currentY += 25
    ensureSpace(30)
    
    const colWidths = {
      date: 90,
      engineer: 100,
      type: 80,
      status: 80,
      comment: pageWidth - 2 * margin - 350,
    }
    
    // Table header
    ensureSpace(30)
    doc.fillColor('#1e293b') // slate-800
    doc.rect(margin, currentY, pageWidth - 2 * margin, 25)
      .fill()
    
    doc.fillColor('#ffffff')
    doc.fontSize(9).font('Helvetica-Bold')
    doc.text('Date', margin + 5, currentY + 8)
    doc.text('Engineer', margin + colWidths.date + 5, currentY + 8)
    doc.text('Type', margin + colWidths.date + colWidths.engineer + 5, currentY + 8)
    doc.text('Status', margin + colWidths.date + colWidths.engineer + colWidths.type + 5, currentY + 8)
    doc.text('Comment', margin + colWidths.date + colWidths.engineer + colWidths.type + colWidths.status + 5, currentY + 8)
    
    currentY += 25
    
    // Table rows
    data.visitReports.forEach((visit: any, index: number) => {
      // Find maintenance issues for this visit
      const visitIssues = data.maintenanceIssues?.filter((issue: any) => {
        const visitDate = visit.date || visit.completedDate
        const issueDate = issue.completedDate
        if (visitDate && issueDate) {
        const visitDateStr = typeof visitDate === 'string' && visitDate.length >= 10 ? visitDate.substring(0, 10) : String(visitDate)
        const issueDateStr = typeof issueDate === 'string' && issueDate.length >= 10 ? issueDate.substring(0, 10) : String(issueDate)
        const visitType = visit.type ? String(visit.type).toUpperCase() : ''
        const issueType = issue.type ? String(issue.type).toUpperCase() : ''
        return visitDateStr === issueDateStr && 
               (visitType === issueType || 
                issueType.includes('REGULAR') || 
                issueType.includes('QUARTERLY') ||
                issueType.includes('SEMI_ANNUAL'))
        }
        return false
      }) || []
      
      const rowHeight = visitIssues.length > 0 ? 25 + (Math.min(visitIssues.length, 3) * 8) + 5 : 25
      ensureSpace(rowHeight)
      
      // Row background (alternating)
      if (index % 2 === 0) {
        doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight)
          .fillColor('#f8fafc') // gray-50
          .fill()
      }
      
      // Row border
      doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight)
        .strokeColor('#e2e8f0')
        .lineWidth(0.5)
        .stroke()
      
      // Date
      doc.fontSize(8).font('Helvetica')
      doc.fillColor('#334155')
      const dateStr = visit.date || visit.completedDate || 'N/A'
      const dateDisplay = typeof dateStr === 'string' && dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr
      doc.text(dateDisplay, margin + 5, currentY + 8, { width: colWidths.date - 10 })
      
      // Engineer
      const engineerName = visit.engineer || visit.fullName || 'N/A'
      const engineerDisplay = typeof engineerName === 'string' ? engineerName.substring(0, 15) : String(engineerName)
      doc.text(engineerDisplay, margin + colWidths.date + 5, currentY + 8, { width: colWidths.engineer - 10 })
      
      // Type with color
      const typeValue = visit.type || 'N/A'
      const typeStr = typeof typeValue === 'string' ? typeValue.toUpperCase() : String(typeValue).toUpperCase()
      const isBreakdown = typeStr.includes('BREAKDOWN') || typeStr.includes('CALLOUT')
      const isRegular = typeStr.includes('REGULAR') || typeStr.includes('MAINTENANCE')
      
      doc.rect(margin + colWidths.date + colWidths.engineer + 5, currentY + 4, colWidths.type - 10, 17)
        .fillColor(isBreakdown ? '#fee2e2' : isRegular ? '#dbeafe' : '#f3f4f6')
        .fill()
      
      doc.fillColor(isBreakdown ? '#991b1b' : isRegular ? '#1e40af' : '#374151')
      doc.fontSize(7).font('Helvetica-Bold')
      doc.text(typeStr.substring(0, 8), margin + colWidths.date + colWidths.engineer + 8, currentY + 9, { width: colWidths.type - 16 })
      
      // Status with color
      const statusValue = visit.endStatus || 'N/A'
      const statusStr = typeof statusValue === 'string' ? statusValue : String(statusValue)
      const isWorking = statusStr.toLowerCase().includes('in_service') || statusStr.toLowerCase().includes('working')
      
      doc.rect(margin + colWidths.date + colWidths.engineer + colWidths.type + 5, currentY + 4, colWidths.status - 10, 17)
        .fillColor(isWorking ? '#dcfce7' : '#fef3c7')
        .fill()
      
      doc.fillColor(isWorking ? '#166534' : '#92400e')
      doc.fontSize(7).font('Helvetica-Bold')
      doc.text(statusStr.substring(0, 10), margin + colWidths.date + colWidths.engineer + colWidths.type + 8, currentY + 9, { width: colWidths.status - 16 })
      
      // Comment
      doc.fillColor('#475569')
      doc.fontSize(7).font('Helvetica')
      const commentText = visit.comment || visit.globalComment || 'N/A'
      const comment = typeof commentText === 'string' ? commentText.substring(0, 60) : String(commentText)
      doc.text(comment, margin + colWidths.date + colWidths.engineer + colWidths.type + colWidths.status + 5, currentY + 8, { 
        width: colWidths.comment - 10,
        ellipsis: true
      })
      
      // Maintenance issues below row
      if (visitIssues.length > 0) {
        doc.fillColor('#f59e0b') // orange-500
        doc.fontSize(6).font('Helvetica-Bold')
        doc.text('Issues:', margin + colWidths.date + colWidths.engineer + 5, currentY + 25)
        
        visitIssues.slice(0, 3).forEach((issue: any, issueIdx: number) => {
          doc.fillColor('#92400e') // orange-800
          doc.fontSize(6).font('Helvetica')
          const issueText = `${issue.stateKey || 'Component'}${issue.problemKey ? ': ' + issue.problemKey : ''}`
          const issueDisplay = typeof issueText === 'string' ? issueText.substring(0, 50) : String(issueText)
          doc.text(issueDisplay, margin + colWidths.date + colWidths.engineer + 25, currentY + 25 + (issueIdx * 8), {
            width: colWidths.comment + colWidths.status + colWidths.type - 20,
            ellipsis: true
          })
        })
        
        if (visitIssues.length > 3) {
          doc.fillColor('#64748b')
          doc.fontSize(6).font('Helvetica')
          doc.text(`+${visitIssues.length - 3} more`, margin + colWidths.date + colWidths.engineer + 25, currentY + 25 + (3 * 8))
        }
      }
      
      currentY += rowHeight
    })
    
    currentY += 10
  }
  
  // Breakdowns Table
  if (data.breakdowns && data.breakdowns.length > 0) {
    ensureSpace(100)
    
    doc.fillColor('#0f172a')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text(`Breakdowns / Downtimes (${data.breakdowns.length})`, margin, currentY)
    currentY += 25
    ensureSpace(30)
    
    const breakdownColWidths = {
      startDate: 80,
      endDate: 80,
      duration: 60,
      origin: 90,
      component: 90,
      visited: 40,
      status: pageWidth - 2 * margin - 440,
    }
    
    // Table header
    ensureSpace(30)
    doc.fillColor('#dc2626') // red-600
    doc.rect(margin, currentY, pageWidth - 2 * margin, 25)
      .fill()
    
    doc.fillColor('#ffffff')
    doc.fontSize(9).font('Helvetica-Bold')
    doc.text('Start', margin + 5, currentY + 8)
    doc.text('End', margin + breakdownColWidths.startDate + 5, currentY + 8)
    doc.text('Duration', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + 5, currentY + 8)
    doc.text('Origin', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + 5, currentY + 8)
    doc.text('Component', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + 5, currentY + 8)
    doc.text('Visited', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + breakdownColWidths.component + 5, currentY + 8)
    doc.text('Status', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + breakdownColWidths.component + breakdownColWidths.visited + 5, currentY + 8)
    
    currentY += 25
    
    // Table rows
    data.breakdowns.forEach((bd: any, index: number) => {
      const rowHeight = bd.publicComment ? 35 : 30
      ensureSpace(rowHeight)
      
      // Row background (alternating, red tint for ongoing)
      if (bd.isOngoing) {
        doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight)
          .fillColor('#fef2f2') // red-50
          .fill()
      } else if (index % 2 === 0) {
        doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight)
          .fillColor('#fff7ed') // orange-50
          .fill()
      }
      
      // Row border
      doc.rect(margin, currentY, pageWidth - 2 * margin, rowHeight)
        .strokeColor(bd.isOngoing ? '#dc2626' : '#fb923c')
        .lineWidth(bd.isOngoing ? 1.5 : 0.5)
        .stroke()
      
      // Start date
      doc.fontSize(8).font('Helvetica')
      doc.fillColor('#334155')
      const startDate = bd.startTime ? new Date(bd.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A'
      doc.text(startDate, margin + 5, currentY + 8, { width: breakdownColWidths.startDate - 10 })
      
      // End date
      const endDate = bd.endTime ? new Date(bd.endTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'ONGOING'
      doc.fillColor(bd.isOngoing ? '#dc2626' : '#334155')
      doc.font('Helvetica-Bold')
      doc.text(endDate, margin + breakdownColWidths.startDate + 5, currentY + 8, { width: breakdownColWidths.endDate - 10 })
      
      // Duration
      doc.font('Helvetica')
      doc.fillColor('#334155')
      const duration = bd.minutesDuration
        ? `${Math.floor(bd.minutesDuration / 60)}h ${bd.minutesDuration % 60}m`
        : 'N/A'
      doc.text(duration, margin + breakdownColWidths.startDate + breakdownColWidths.endDate + 5, currentY + 8, { width: breakdownColWidths.duration - 10 })
      
      // Origin
      const originValue = bd.origin || 'N/A'
      const originDisplay = typeof originValue === 'string' ? originValue.substring(0, 20) : String(originValue)
      doc.text(originDisplay, margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + 5, currentY + 8, { 
        width: breakdownColWidths.origin - 10,
        ellipsis: true
      })
      
      // Component
      const failureLocationsValue = bd.failureLocations || 'N/A'
      const failureLocationsDisplay = typeof failureLocationsValue === 'string' ? failureLocationsValue.substring(0, 20) : String(failureLocationsValue)
      doc.text(failureLocationsDisplay, margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + 5, currentY + 8, {
        width: breakdownColWidths.component - 10,
        ellipsis: true
      })
      
      // Visited
      doc.fillColor(bd.visitedDuringBreakdown ? '#16a34a' : '#64748b')
      doc.font('Helvetica-Bold')
      doc.text(bd.visitedDuringBreakdown ? '✓' : '-', margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + breakdownColWidths.component + 5, currentY + 8, {
        width: breakdownColWidths.visited - 10,
        align: 'center'
      })
      
      // Status
      doc.font('Helvetica')
      doc.fillColor('#334155')
      const internalStatusValue = bd.internalStatus || 'N/A'
      const internalStatusDisplay = typeof internalStatusValue === 'string' ? internalStatusValue.substring(0, 30) : String(internalStatusValue)
      doc.text(internalStatusDisplay, margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + breakdownColWidths.origin + breakdownColWidths.component + breakdownColWidths.visited + 5, currentY + 8, {
        width: breakdownColWidths.status - 10,
        ellipsis: true
      })
      
      // Public comment on second line if available
      if (bd.publicComment) {
        doc.fontSize(7).font('Helvetica')
        doc.fillColor('#64748b')
        const publicCommentDisplay = typeof bd.publicComment === 'string' ? bd.publicComment.substring(0, 100) : String(bd.publicComment)
        doc.text(publicCommentDisplay, margin + breakdownColWidths.startDate + breakdownColWidths.endDate + breakdownColWidths.duration + 5, currentY + 18, {
          width: pageWidth - 2 * margin - breakdownColWidths.startDate - breakdownColWidths.endDate - breakdownColWidths.duration - 10,
          ellipsis: true
        })
      }
      
      currentY += rowHeight
    })
    
    currentY += 10
  }
  
  // Repeated Patterns
  if (safeAnalysis.repeatedPatterns && safeAnalysis.repeatedPatterns.length > 0) {
    ensureSpace(80)
    
    doc.fillColor('#0f172a')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text('Repeated Patterns', margin, currentY)
    currentY += 25
    ensureSpace(60)
    
    safeAnalysis.repeatedPatterns.forEach((pattern) => {
      ensureSpace(60)
      
      // Pattern box
      doc.rect(margin, currentY, pageWidth - 2 * margin, 50)
        .fillColor('#fef3c7') // yellow-100
        .fill()
        .strokeColor('#fbbf24')
        .lineWidth(1)
        .stroke()
      
      doc.fillColor('#92400e') // yellow-800
      doc.fontSize(11).font('Helvetica-Bold')
      doc.text(`${pattern.pattern} (${pattern.frequency} occurrences)`, margin + 10, currentY + 8)
      
      doc.fillColor('#78350f') // yellow-900
      doc.fontSize(9).font('Helvetica')
      if (pattern.examples && pattern.examples.length > 0) {
        pattern.examples.slice(0, 2).forEach((example: any, idx: number) => {
          const exampleText = typeof example === 'string' ? example.substring(0, 80) : String(example)
          doc.text(`• ${exampleText}`, margin + 15, currentY + 22 + (idx * 12), {
            width: pageWidth - 2 * margin - 30,
            ellipsis: true
          })
        })
      }
      
      currentY += 60
    })
    
    currentY += 10
  }
  
  // Hypotheses
  if (safeAnalysis.hypotheses && safeAnalysis.hypotheses.length > 0) {
    ensureSpace(80)
    
    doc.fillColor('#0f172a')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text('Likely Causes', margin, currentY)
    currentY += 25
    ensureSpace(60)
    
    safeAnalysis.hypotheses.forEach((hypothesis) => {
      // Calculate actual height needed for reasoning text
      doc.fontSize(10).font('Helvetica')
      const reasoningHeight = doc.heightOfString(hypothesis.reasoning, {
        width: pageWidth - 2 * margin - 20,
        lineGap: 3,
      })
      const boxHeight = 25 + reasoningHeight + 10
      
      ensureSpace(boxHeight)
      
      // Hypothesis box
      const likelihoodColor = hypothesis.likelihood === 'high' ? '#dbeafe' : hypothesis.likelihood === 'medium' ? '#fef3c7' : '#fee2e2'
      const likelihoodBorder = hypothesis.likelihood === 'high' ? '#3b82f6' : hypothesis.likelihood === 'medium' ? '#f59e0b' : '#ef4444'
      
      doc.rect(margin, currentY, pageWidth - 2 * margin, boxHeight)
        .fillColor(likelihoodColor)
        .fill()
        .strokeColor(likelihoodBorder)
        .lineWidth(1.5)
        .stroke()
      
      doc.fillColor('#0f172a')
      doc.fontSize(12).font('Helvetica-Bold')
      doc.text(`${hypothesis.category} (${hypothesis.likelihood} likelihood)`, margin + 10, currentY + 8)
      
      doc.fillColor('#334155')
      doc.fontSize(10).font('Helvetica')
      doc.text(hypothesis.reasoning, {
        x: margin + 10,
        y: currentY + 25,
        width: pageWidth - 2 * margin - 20,
        lineGap: 3,
      })
      
      currentY += boxHeight
    })
    
    currentY += 10
  }
  
  // Suggested Checks
  if (safeAnalysis.suggestedChecks && safeAnalysis.suggestedChecks.length > 0) {
    ensureSpace(50)
    
    doc.fillColor('#0f172a')
    doc.fontSize(18).font('Helvetica-Bold')
    doc.text('Suggested Next Checks', margin, currentY)
    currentY += 25
    ensureSpace(20)
    
    doc.fillColor('#334155')
    doc.fontSize(10).font('Helvetica')
    safeAnalysis.suggestedChecks.forEach((check) => {
      // Calculate height for this check item
      const checkHeight = doc.heightOfString(`✓ ${check}`, {
        width: pageWidth - 2 * margin - 20,
        lineGap: 2,
      })
      
      ensureSpace(checkHeight + 5)
      
      doc.text(`✓ ${check}`, margin + 10, currentY, {
        width: pageWidth - 2 * margin - 20,
        lineGap: 2,
      })
      currentY += checkHeight + 5
    })
    
    currentY += 10
  }
  
  // Final footer - only add if we have content on this page
  if (currentY > contentTop) {
    addFooter()
  }
}

/**
 * Get color for confidence level
 */
function getConfidenceColor(level: 'low' | 'medium' | 'high'): string {
  switch (level) {
    case 'high':
      return '#10b981' // green-500
    case 'medium':
      return '#f59e0b' // amber-500
    case 'low':
      return '#ef4444' // red-500
    default:
      return '#6b7280' // gray-500
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

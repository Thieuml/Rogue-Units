/**
 * PDF generation service for diagnostic summaries - Analysis Tab Only
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
      margin: 60,
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
      margin: 60,
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
 * Generate PDF content - Analysis Tab Only
 */
function generatePDFContent(
  doc: PDFDocumentType,
  data: DiagnosticData,
  analysis: any
): void {
  
  if (!analysis) {
    throw new Error('Analysis data is required for PDF generation')
  }
  
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const margin = 60
  const contentWidth = pageWidth - 2 * margin
  const headerHeight = 100
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
    doc.fontSize(28).font('Helvetica-Bold')
    doc.text('WeMaintain', margin, 30, { align: 'left' })
    
    // Title
    doc.fontSize(20).font('Helvetica-Bold')
    doc.text('Lift Diagnostic Analysis', margin, 60, { align: 'left' })
    
    doc.restore()
  }
  
  // Add footer function
  const addFooter = () => {
    doc.save()
    const footerY = pageHeight - footerHeight
    
    // Footer line
    doc.moveTo(margin, footerY)
      .lineTo(pageWidth - margin, footerY)
      .strokeColor('#cbd5e1')
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
      pageWidth - margin - 50,
      footerY + 15,
      { align: 'right', width: 50 }
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
  
  // Helper function to add text with automatic pagination
  const addText = (text: string, fontSize: number, font: string, color: string, options: any = {}): void => {
    const textHeight = doc.heightOfString(text, {
      width: options.width || contentWidth,
      lineGap: options.lineGap || 4,
    })
    
    ensureSpace(textHeight + (options.marginBottom || 0))
    
    doc.fontSize(fontSize).font(font).fillColor(color)
    doc.text(text, {
      x: options.x || margin,
      y: currentY,
      width: options.width || contentWidth,
      lineGap: options.lineGap || 4,
      align: options.align || 'left',
    })
    
    currentY += textHeight + (options.marginBottom || 0)
  }
  
  // Initial header
  addHeader()
  
  // Unit Information Box
  ensureSpace(80)
  doc.roundedRect(margin, currentY, contentWidth, 70, 5)
    .fillColor('#f1f5f9') // slate-100
    .fill()
    .strokeColor('#cbd5e1')
    .lineWidth(1)
    .stroke()
  
  doc.fillColor('#0f172a')
  doc.fontSize(18).font('Helvetica-Bold')
  doc.text(`Unit: ${data.unitName}`, margin + 15, currentY + 15)
  
  doc.fontSize(12).font('Helvetica')
  doc.fillColor('#475569')
  doc.text(`Building: ${data.buildingName}`, margin + 15, currentY + 38)
  doc.text(`Unit ID: ${data.unitId}`, margin + 15, currentY + 53)
  
  currentY += 90
  
  // Executive Summary (if present)
  if (analysis.finalExecSummary) {
    ensureSpace(60)
    
    // Section banner
    doc.roundedRect(margin, currentY, contentWidth, 35, 5)
      .fillColor('#eff6ff') // blue-50
      .fill()
      .strokeColor('#93c5fd')
      .lineWidth(1)
      .stroke()
    
    doc.fillColor('#1e293b')
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Executive Summary', margin + 15, currentY + 10)
    
    currentY += 45
    
    // Summary content
    addText(
      analysis.finalExecSummary.replace(/at Unit /gi, '').replace(/at /gi, ''),
      11,
      'Helvetica',
      '#334155',
      { marginBottom: 20, lineGap: 5 }
    )
  }
  
  // Operational Summary
  if (analysis.executiveSummary) {
    ensureSpace(60)
    
    // Section banner
    doc.roundedRect(margin, currentY, contentWidth, 35, 5)
      .fillColor('rgba(115, 161, 255, 0.15)')
      .fill()
      .strokeColor('#73A1FF')
      .lineWidth(1.5)
      .stroke()
    
    doc.fillColor('#1e293b')
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Operational Summary', margin + 15, currentY + 10)
    
    currentY += 50
    
    if (typeof analysis.executiveSummary === 'object') {
      // Overview
      if (analysis.executiveSummary.overview) {
        ensureSpace(40)
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('Overview', margin, currentY)
        currentY += 20
        
        addText(
          analysis.executiveSummary.overview.replace(/at Unit /gi, '').replace(/at /gi, ''),
          11,
          'Helvetica',
          '#334155',
          { marginBottom: 20, lineGap: 5 }
        )
      }
      
      // Summary of Events
      if (analysis.executiveSummary.summaryOfEvents) {
        ensureSpace(40)
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('Summary of Events', margin, currentY)
        currentY += 20
        
        addText(
          analysis.executiveSummary.summaryOfEvents.replace(/at Unit /gi, '').replace(/at /gi, ''),
          11,
          'Helvetica',
          '#334155',
          { marginBottom: 20, lineGap: 5 }
        )
      }
      
      // Current Situation
      if (analysis.executiveSummary.currentSituation) {
        ensureSpace(40)
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('Current Situation and Next Steps', margin, currentY)
        currentY += 20
        
        addText(
          analysis.executiveSummary.currentSituation.replace(/at Unit /gi, '').replace(/at /gi, ''),
          11,
          'Helvetica',
          '#334155',
          { marginBottom: 20, lineGap: 5 }
        )
      }
    } else {
      addText(
        analysis.executiveSummary.replace(/at Unit /gi, '').replace(/at /gi, ''),
        11,
        'Helvetica',
        '#334155',
        { marginBottom: 20, lineGap: 5 }
      )
    }
  }
  
  // Technical Summary
  if (analysis.technicalSummary) {
    ensureSpace(60)
    
    // Section banner
    doc.roundedRect(margin, currentY, contentWidth, 35, 5)
      .fillColor('rgba(109, 112, 156, 0.15)')
      .fill()
      .strokeColor('#6D709C')
      .lineWidth(1.5)
      .stroke()
    
    doc.fillColor('#1e293b')
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Technical Summary', margin + 15, currentY + 10)
    
    currentY += 50
    
    // Overview
    if (analysis.technicalSummary.overview) {
      addText(
        analysis.technicalSummary.overview,
        11,
        'Helvetica',
        '#334155',
        { marginBottom: 20, lineGap: 5 }
      )
    }
    
    // Pattern Details
    if (analysis.technicalSummary.patternDetails && analysis.technicalSummary.patternDetails.length > 0) {
      analysis.technicalSummary.patternDetails.forEach((pattern: any, idx: number) => {
        ensureSpace(80)
        
        // Pattern card with top border
        const patternStartY = currentY
        
        // Calculate total content height first (for the box)
        let estimatedHeight = 40 // Pattern name
        estimatedHeight += doc.heightOfString(pattern.verdict, { width: contentWidth - 30, lineGap: 4 }) + 20
        
        if (pattern.quantifiedImpact) estimatedHeight += 70
        if (pattern.driverTree) estimatedHeight += 60
        if (pattern.actionableRecommendations) estimatedHeight += pattern.actionableRecommendations.length * 45
        if (pattern.resolutionProbability) estimatedHeight += 40
        
        ensureSpace(estimatedHeight)
        
        // Draw pattern box background
        doc.roundedRect(margin, patternStartY, contentWidth, estimatedHeight, 5)
          .fillColor('rgba(109, 112, 156, 0.05)')
          .fill()
        
        // Draw top border
        doc.rect(margin, patternStartY, contentWidth, 3)
          .fillColor('#6D709C')
          .fill()
        
        // Pattern Name
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text(pattern.patternName, margin + 15, currentY + 15, { width: contentWidth - 30 })
        currentY += 40
        
        // Verdict
        doc.fontSize(11).font('Helvetica').fillColor('#334155')
        const verdictHeight = doc.heightOfString(pattern.verdict, { width: contentWidth - 30, lineGap: 4 })
        doc.text(pattern.verdict, margin + 15, currentY, { width: contentWidth - 30, lineGap: 4 })
        currentY += verdictHeight + 20
        
        // Quantified Impact
        if (pattern.quantifiedImpact) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('Quantified Impact', margin + 15, currentY)
          currentY += 18
          
          doc.fontSize(10).font('Helvetica').fillColor('#334155')
          doc.text(`Breakdowns: ${pattern.quantifiedImpact.breakdownCount} over ${pattern.quantifiedImpact.timeSpan}`, margin + 15, currentY)
          currentY += 15
          doc.text(`Downtime: ${pattern.quantifiedImpact.downtimeHours} total (${pattern.quantifiedImpact.downtimePerEvent} per event)`, margin + 15, currentY)
          currentY += 15
          
          // Risk level badge
          const riskLevel = pattern.quantifiedImpact.riskLevel.toLowerCase()
          const riskColor = riskLevel === 'high' ? '#dc2626' : riskLevel === 'medium' ? '#f59e0b' : '#16a34a'
          const riskBgColor = riskLevel === 'high' ? '#fee2e2' : riskLevel === 'medium' ? '#fef3c7' : '#dcfce7'
          
          doc.roundedRect(margin + 15, currentY, 100, 18, 9)
            .fillColor(riskBgColor)
            .fill()
          
          doc.fontSize(9).font('Helvetica-Bold').fillColor(riskColor)
          doc.text(`RISK: ${pattern.quantifiedImpact.riskLevel.toUpperCase()}`, margin + 25, currentY + 5, { width: 80, align: 'center' })
          
          doc.fontSize(10).font('Helvetica').fillColor('#334155')
          doc.text(` - ${pattern.quantifiedImpact.riskRationale}`, margin + 120, currentY + 3)
          currentY += 30
        }
        
        // Root Cause Analysis
        if (pattern.driverTree) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('Root Cause Analysis', margin + 15, currentY)
          currentY += 18
          
          doc.fontSize(10).font('Helvetica').fillColor('#334155')
          const driverText = pattern.driverTree.replace(/^Defective materials? →?\s*/i, '').replace(/^Defective materials? and \w+ →?\s*/i, '')
          const driverHeight = doc.heightOfString(driverText, { width: contentWidth - 30, lineGap: 4 })
          doc.text(driverText, margin + 15, currentY, { width: contentWidth - 30, lineGap: 4 })
          currentY += driverHeight + 20
        }
        
        // Actionable Recommendations
        if (pattern.actionableRecommendations && pattern.actionableRecommendations.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('Actionable Recommendations', margin + 15, currentY)
          currentY += 18
          
          pattern.actionableRecommendations.forEach((rec: any, recIdx: number) => {
            // Number badge
            doc.circle(margin + 22, currentY + 5, 8)
              .fillColor('#6D709C')
              .fill()
            
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff')
            doc.text(String(recIdx + 1), margin + 18, currentY + 2, { width: 8, align: 'center' })
            
            // Recommendation text
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
            const actionHeight = doc.heightOfString(rec.action, { width: contentWidth - 50, lineGap: 3 })
            doc.text(rec.action, margin + 35, currentY, { width: contentWidth - 50, lineGap: 3 })
            currentY += actionHeight + 3
            
            doc.fontSize(9).font('Helvetica').fillColor('#64748b')
            doc.text(`Timeframe: ${rec.timeframe.replace(/_/g, ' ')} • Expected: ${rec.expectedOutcome}`, margin + 35, currentY, { width: contentWidth - 50 })
            currentY += 25
          })
          
          currentY += 10
        }
        
        // Resolution Probability
        if (pattern.resolutionProbability) {
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
          doc.text('Probability of Resolution', margin + 15, currentY)
          currentY += 18
          
          doc.fontSize(10).font('Helvetica').fillColor('#334155')
          doc.text(`Success Rate: ${pattern.resolutionProbability.probability}`, margin + 15, currentY)
          currentY += 15
          
          doc.text(`If issue persists: ${pattern.resolutionProbability.escalationPath}`, margin + 15, currentY, { width: contentWidth - 30, lineGap: 4 })
          currentY += 20
        }
        
        currentY += 15 // Space after pattern card
      })
    }
  }
  
  // Fallback: Repeated Patterns (if Technical Summary not available)
  if (!analysis.technicalSummary && analysis.repeatedPatterns && analysis.repeatedPatterns.length > 0) {
    ensureSpace(60)
    
    // Section banner
    doc.roundedRect(margin, currentY, contentWidth, 35, 5)
      .fillColor('rgba(251, 191, 36, 0.15)')
      .fill()
      .strokeColor('#fbbf24')
      .lineWidth(1.5)
      .stroke()
    
    doc.fillColor('#1e293b')
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Repeated Patterns', margin + 15, currentY + 10)
    
    currentY += 50
    
    analysis.repeatedPatterns.forEach((pattern: any) => {
      ensureSpace(60)
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#92400e')
      doc.text(`${pattern.pattern} (${pattern.frequency} occurrences)`, margin, currentY)
      currentY += 18
      
      if (pattern.summary) {
        addText(pattern.summary, 10, 'Helvetica', '#334155', { marginBottom: 10 })
      }
      
      if (pattern.rootCause) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('Root Cause: ', margin, currentY, { continued: true })
        doc.font('Helvetica')
        doc.text(pattern.rootCause)
        currentY += 15
      }
      
      if (pattern.impact) {
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#1e293b')
        doc.text('Impact: ', margin, currentY, { continued: true })
        doc.font('Helvetica')
        doc.text(pattern.impact)
        currentY += 15
      }
      
      currentY += 15
    })
  }
  
  // Fallback: Likely Causes (if Technical Summary not available)
  if (!analysis.technicalSummary && analysis.hypotheses && analysis.hypotheses.length > 0) {
    ensureSpace(60)
    
    // Section banner
    doc.roundedRect(margin, currentY, contentWidth, 35, 5)
      .fillColor('rgba(115, 161, 255, 0.15)')
      .fill()
      .strokeColor('#73A1FF')
      .lineWidth(1.5)
      .stroke()
    
    doc.fillColor('#1e293b')
    doc.fontSize(16).font('Helvetica-Bold')
    doc.text('Likely Causes', margin + 15, currentY + 10)
    
    currentY += 50
    
    analysis.hypotheses.forEach((hypothesis: any) => {
      ensureSpace(50)
      
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e293b')
      doc.text(`${hypothesis.category} (${hypothesis.likelihood} likelihood)`, margin, currentY)
      currentY += 18
      
      addText(hypothesis.reasoning, 10, 'Helvetica', '#334155', { marginBottom: 15 })
    })
  }
  
  // Final footer
  if (currentY > contentTop) {
    addFooter()
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

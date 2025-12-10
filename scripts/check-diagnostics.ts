import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') })
config({ path: resolve(process.cwd(), '.env') })

import { prisma } from '../lib/db'

async function checkDiagnostics() {
  try {
    console.log('Checking diagnostics in database...\n')
    
    const diagnostics = await prisma.diagnostic.findMany({
      orderBy: {
        generatedAt: 'desc',
      },
      take: 5, // Get last 5 diagnostics
    })
    
    console.log(`Found ${diagnostics.length} diagnostic(s) in database:\n`)
    
    diagnostics.forEach((diag, index) => {
      console.log(`--- Diagnostic ${index + 1} ---`)
      console.log(`ID: ${diag.id}`)
      console.log(`Unit ID: ${diag.unitId}`)
      console.log(`Unit Name: ${diag.unitName}`)
      console.log(`Building Name: ${diag.buildingName}`)
      console.log(`Generated At: ${diag.generatedAt}`)
      console.log(`Visit Reports: ${Array.isArray(diag.visitReports) ? diag.visitReports.length : 'N/A'}`)
      console.log(`Breakdowns: ${Array.isArray(diag.breakdowns) ? diag.breakdowns.length : 'N/A'}`)
      console.log(`Maintenance Issues: ${Array.isArray(diag.maintenanceIssues) ? diag.maintenanceIssues.length : 'N/A'}`)
      console.log(`Repair Requests: ${diag.repairRequests ? (Array.isArray(diag.repairRequests) ? diag.repairRequests.length : 'N/A') : 'null'}`)
      console.log(`Has Analysis: ${diag.analysis ? 'Yes' : 'No'}`)
      if (diag.analysis) {
        const analysis = diag.analysis as any
        console.log(`Analysis Keys: ${Object.keys(analysis).join(', ')}`)
      }
      console.log('')
    })
    
    if (diagnostics.length === 0) {
      console.log('No diagnostics found in database.')
    }
    
  } catch (error) {
    console.error('Error checking diagnostics:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkDiagnostics()


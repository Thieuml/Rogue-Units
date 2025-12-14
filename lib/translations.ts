/**
 * Translation dictionary for FR/EN language support
 * Professional lift maintenance industry terminology
 */

export type Language = 'en' | 'fr'

export const translations = {
  en: {
    // Navigation
    nav: {
      newDiagnostic: 'Launch New Diagnostic',
      recentDiagnostics: 'Recent Diagnostics',
      usageAnalytics: 'Usage Analytics',
      promptTesting: 'Prompt Testing',
      navigation: 'Navigation',
      adminTools: 'Admin Tools',
      country: 'Country',
    },
    
    // Countries
    countries: {
      france: 'France',
      unitedKingdom: 'United Kingdom',
      singapore: 'Singapore',
      hongKong: 'Hong Kong',
    },
    
    // Form labels
    form: {
      building: 'Building',
      device: 'Device',
      whatLookingFor: 'What are you looking for?',
      optional: 'Optional',
      defaultPeriod: 'Default Diagnostic Period: last 3 months',
      typeBuildingName: 'Type building name or address...',
      typeDeviceName: 'Type device name...',
      selected: 'Selected',
      buildingsIn: 'buildings in',
      selectBuildingFirst: 'Select a building first',
      examplePlaceholder: 'e.g. change diagnostic period, dig into the recurring car door issues, general overview of recent failures...',
    },
    
    // Actions
    actions: {
      analyze: 'Analyze',
      copy: 'Copy',
      copied: 'Copied!',
      delete: 'Delete',
      signOut: 'Sign Out',
      cancel: 'Cancel',
      confirm: 'Confirm',
      clearFilters: 'Clear Filters',
    },
    
    // Tabs
    tabs: {
      summary: 'Summary',
      timeline: 'Timeline',
      visitReports: 'Visit Reports',
      analysis: 'Analysis',
      componentsHistory: 'Components History',
    },
    
    // Results page
    results: {
      title: 'Diagnostic Results',
      generated: 'Generated',
      visits: 'visits',
      visit: 'visit',
      breakdowns: 'breakdowns',
      breakdown: 'breakdown',
      repairRequests: 'repair requests',
      repairRequest: 'repair request',
      partReplaced: 'part replaced',
      partsReplaced: 'parts replaced',
      lastDaysTimeline: 'Last {days} days timeline',
      relatedBreakdowns: 'Related Breakdowns',
      relatedFaults: 'Related Faults',
      partsReplacedOn: 'Parts Replaced on this Component',
      noRelatedData: 'No related data for this component.',
      noComponentHistory: 'No component history available for this period.',
      duration: 'Duration',
    },
    
    // Analysis sections
    analysis: {
      executiveSummary: 'Executive Summary',
      operationalSummary: 'Operational Summary',
      technicalSummary: 'Technical Summary',
      overview: 'Overview',
      summaryOfEvents: 'Summary of Events',
      currentSituation: 'Current Situation and Next Steps',
      serviceHandlingReview: 'Service Handling Review',
      internalUse: 'INTERNAL USE',
      repeatedPatterns: 'Repeated Patterns',
      likelyCauses: 'Likely Causes',
      quantifiedImpact: 'Quantified Impact',
      rootCauseAnalysis: 'Root Cause Analysis',
      actionableRecommendations: 'Actionable Recommendations',
      probabilityOfResolution: 'Probability of Resolution',
      breakdowns: 'Breakdowns',
      timeSpan: 'over',
      downtime: 'Downtime',
      total: 'total',
      perEvent: 'per event',
      riskLevel: 'Risk Level',
      successRate: 'Success Rate',
      ifIssuePersists: 'If issue persists',
      timeframe: 'Timeframe',
      expected: 'Expected',
    },
    
    // Table headers
    table: {
      date: 'Date',
      engineer: 'Engineer',
      type: 'Type',
      status: 'Status',
      comment: 'Comment',
      duration: 'Duration',
      origin: 'Origin',
      component: 'Component',
      visited: 'Visited',
      userName: 'User Name',
      userId: 'User ID',
      totalDiagnostics: 'Total Diagnostics',
      countries: 'Countries',
      latestDiagnostic: 'Latest Diagnostic',
      unit: 'Unit',
      building: 'Building',
      generatedAt: 'Generated At',
    },
    
    // Status labels
    status: {
      loading: 'Loading...',
      analyzing: 'Analyzing diagnostic data...',
      inspecting: 'Inspecting the unit, please wait...',
      mayTakeTime: 'This may take up to 20 seconds',
      noResults: 'No results found',
      noData: 'No data available',
      error: 'Error',
      retry: 'Retry',
    },
    
    // Recent Diagnostics
    recent: {
      title: 'Recent Diagnostics',
      myDiagnostics: 'My Diagnostics',
      startDate: 'Start Date',
      endDate: 'End Date',
      unitName: 'Unit Name',
      searchByUnitName: 'Search by unit name...',
      foundDiagnostics: 'diagnostics found for',
      noDiagnosticsYet: 'No diagnostics found.',
      tryAdjustingFilters: 'Try adjusting your filters or launch a new diagnostic.',
    },
    
    // Page titles
    page: {
      liftDiagnosticSummary: 'Lift Diagnostic Summary',
    },
    
    // Usage Analytics
    usage: {
      title: 'Usage Analytics',
      totalUsers: 'Total Users',
      totalDiagnostics: 'Total Diagnostics',
      averagePerUser: 'Average per User',
      searchUsers: 'Search by user name or ID...',
      noDiagnosticsYet: 'No diagnostics have been generated yet.',
      checkBackLater: 'Check back after some diagnostics have been created.',
      noUsersFound: 'No users found matching your search.',
      tryDifferentSearch: 'Try a different search term.',
    },
    
    // Timeline
    timeline: {
      daysTimeline: 'days timeline',
      last: 'Last',
      breakdown: 'BREAKDOWN',
      ongoing: 'ONGOING',
      visit: 'VISIT',
      ended: 'ended',
      repairRequest: 'Repair Request',
      partReplaced: 'Part Replaced',
    },
  },
  
  fr: {
    // Navigation
    nav: {
      newDiagnostic: 'Lancer un diagnostic',
      recentDiagnostics: 'Diagnostics récents',
      usageAnalytics: 'Statistiques d\'utilisation',
      promptTesting: 'Test des prompts',
      navigation: 'Navigation',
      adminTools: 'Outils admin',
      country: 'Pays',
    },
    
    // Countries
    countries: {
      france: 'France',
      unitedKingdom: 'Royaume-Uni',
      singapore: 'Singapour',
      hongKong: 'Hong Kong',
    },
    
    // Form labels
    form: {
      building: 'Bâtiment',
      device: 'Appareil',
      whatLookingFor: 'Que recherchez-vous ?',
      optional: 'Optionnel',
      defaultPeriod: 'Période de diagnostic par défaut : 3 derniers mois',
      typeBuildingName: 'Saisir le nom ou l\'adresse du bâtiment...',
      typeDeviceName: 'Saisir le nom de l\'appareil...',
      selected: 'Sélectionné',
      buildingsIn: 'bâtiments en',
      selectBuildingFirst: 'Sélectionner d\'abord un bâtiment',
      examplePlaceholder: 'ex. modifier la période de diagnostic, approfondir les problèmes récurrents de portes de cabine, aperçu général des pannes récentes...',
    },
    
    // Actions
    actions: {
      analyze: 'Analyser',
      copy: 'Copier',
      copied: 'Copié !',
      delete: 'Supprimer',
      signOut: 'Se déconnecter',
      cancel: 'Annuler',
      confirm: 'Confirmer',
      clearFilters: 'Effacer les filtres',
    },
    
    // Tabs
    tabs: {
      summary: 'Résumé',
      timeline: 'Chronologie',
      visitReports: 'Rapports d\'intervention',
      analysis: 'Analyse',
      componentsHistory: 'Historique des composants',
    },
    
    // Results page
    results: {
      title: 'Résultats du diagnostic',
      generated: 'Généré',
      visits: 'interventions',
      visit: 'intervention',
      breakdowns: 'pannes',
      breakdown: 'panne',
      repairRequests: 'demandes de réparation',
      repairRequest: 'demande de réparation',
      partReplaced: 'pièce remplacée',
      partsReplaced: 'pièces remplacées',
      lastDaysTimeline: 'Chronologie des {days} derniers jours',
      relatedBreakdowns: 'Pannes associées',
      relatedFaults: 'Défauts associés',
      partsReplacedOn: 'Pièces remplacées sur ce composant',
      noRelatedData: 'Aucune donnée associée pour ce composant.',
      noComponentHistory: 'Aucun historique de composant disponible pour cette période.',
      duration: 'Durée',
    },
    
    // Analysis sections
    analysis: {
      executiveSummary: 'Synthèse',
      operationalSummary: 'Résumé opérationnel',
      technicalSummary: 'Résumé technique',
      overview: 'Vue d\'ensemble',
      summaryOfEvents: 'Résumé des événements',
      currentSituation: 'Situation actuelle et prochaines étapes',
      serviceHandlingReview: 'Revue de la gestion du service',
      internalUse: 'USAGE INTERNE',
      repeatedPatterns: 'Schémas répétés',
      likelyCauses: 'Causes probables',
      quantifiedImpact: 'Impact quantifié',
      rootCauseAnalysis: 'Analyse de la cause racine',
      actionableRecommendations: 'Recommandations actionnables',
      probabilityOfResolution: 'Probabilité de résolution',
      breakdowns: 'Pannes',
      timeSpan: 'sur',
      downtime: 'Temps d\'arrêt',
      total: 'total',
      perEvent: 'par événement',
      riskLevel: 'Niveau de risque',
      successRate: 'Taux de réussite',
      ifIssuePersists: 'Si le problème persiste',
      timeframe: 'Délai',
      expected: 'Attendu',
    },
    
    // Table headers
    table: {
      date: 'Date',
      engineer: 'Technicien',
      type: 'Type',
      status: 'Statut',
      comment: 'Commentaire',
      duration: 'Durée',
      origin: 'Origine',
      component: 'Composant',
      visited: 'Visité',
      userName: 'Nom d\'utilisateur',
      userId: 'ID utilisateur',
      totalDiagnostics: 'Total diagnostics',
      countries: 'Pays',
      latestDiagnostic: 'Dernier diagnostic',
      unit: 'Appareil',
      building: 'Bâtiment',
      generatedAt: 'Généré le',
    },
    
    // Status labels
    status: {
      loading: 'Chargement...',
      analyzing: 'Analyse des données de diagnostic...',
      inspecting: 'Inspection de l\'appareil, veuillez patienter...',
      mayTakeTime: 'Cela peut prendre jusqu\'à 20 secondes',
      noResults: 'Aucun résultat trouvé',
      noData: 'Aucune donnée disponible',
      error: 'Erreur',
      retry: 'Réessayer',
    },
    
    // Recent Diagnostics
    recent: {
      title: 'Diagnostics récents',
      myDiagnostics: 'Mes diagnostics',
      startDate: 'Date de début',
      endDate: 'Date de fin',
      unitName: 'Appareil',
      searchByUnitName: 'Rechercher par nom d\'appareil...',
      foundDiagnostics: 'diagnostics trouvés',
      noDiagnosticsYet: 'Aucun diagnostic trouvé.',
      tryAdjustingFilters: 'Essayez d\'ajuster vos filtres ou lancez un nouveau diagnostic.',
    },
    
    // Page titles
    page: {
      liftDiagnosticSummary: 'Lancer un diagnostic opérationnel et technique d\'ascenseur',
    },
    
    // Usage Analytics
    usage: {
      title: 'Statistiques d\'utilisation',
      totalUsers: 'Nombre d\'utilisateurs',
      totalDiagnostics: 'Total diagnostics',
      averagePerUser: 'Moyenne par utilisateur',
      searchUsers: 'Rechercher par nom ou ID utilisateur...',
      noDiagnosticsYet: 'Aucun diagnostic n\'a encore été généré.',
      checkBackLater: 'Revenez après la création de quelques diagnostics.',
      noUsersFound: 'Aucun utilisateur trouvé correspondant à votre recherche.',
      tryDifferentSearch: 'Essayez un autre terme de recherche.',
    },
    
    // Timeline
    timeline: {
      daysTimeline: 'jours de chronologie',
      last: 'Derniers',
      breakdown: 'PANNE',
      ongoing: 'EN COURS',
      visit: 'INTERVENTION',
      ended: 'terminée',
      repairRequest: 'Demande de réparation',
      partReplaced: 'Pièce remplacée',
    },
  },
} as const

/**
 * Translation hook - returns t() function for current language
 */
export function useTranslation(language: Language) {
  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations[language]
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k]
      } else {
        console.warn(`[Translation] Missing key: ${key} for language: ${language}`)
        return key // Return the key itself as fallback
      }
    }
    
    return typeof value === 'string' ? value : key
  }
  
  return { t }
}


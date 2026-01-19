/**
 * Translation dictionary for EN/FR/ZH language support
 * Professional lift maintenance industry terminology
 */

export type Language = 'en' | 'fr' | 'zh'

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
      feedback: 'Feedback',
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
    
    // Feedback
    feedback: {
      provideFeedback: 'Provide Feedback',
      section: 'Section',
      yourRating: 'Your Rating',
      helpful: 'Helpful',
      needsImprovement: 'Needs Improvement',
      whatDescribesFeedback: 'What best describes your feedback?',
      required: '*',
      selectCategory: 'Select a category...',
      additionalDetails: 'Additional details',
      optional: '(optional)',
      placeholder: 'Please share any specific details that could help us improve...',
      submitFeedback: 'Submit Feedback',
      submitting: 'Submitting...',
      selectCategoryError: 'Please select a category',
      // Positive categories
      accurate: 'Accurate and trustworthy',
      clearSummary: 'Clear summary',
      rightDetail: 'Right level of detail',
      actionable: 'Actionable next steps',
      usefulOps: 'Useful for OPS decisions',
      // Negative categories
      inaccurate: 'Contains inaccuracies',
      tooConfident: 'Too confident / not cautious enough',
      missesPatterns: 'Misses important patterns',
      tooLong: 'Too long or hard to scan',
      tooVague: 'Too vague',
      notRealistic: 'Recommendations not realistic',
      avoidsHandling: 'Avoids addressing handling issues',
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
      high: 'HIGH',
      medium: 'MEDIUM',
      low: 'LOW',
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
      by: 'by',
      datePlaceholder: 'dd/mm/yyyy',
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
      feedback: 'Retours',
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
    
    // Feedback
    feedback: {
      provideFeedback: 'Donner un retour',
      section: 'Section',
      yourRating: 'Votre évaluation',
      helpful: 'Utile',
      needsImprovement: 'À améliorer',
      whatDescribesFeedback: 'Qu\'est-ce qui décrit le mieux votre retour ?',
      required: '*',
      selectCategory: 'Sélectionner une catégorie...',
      additionalDetails: 'Détails supplémentaires',
      optional: '(optionnel)',
      placeholder: 'Veuillez partager tous les détails spécifiques qui pourraient nous aider à améliorer...',
      submitFeedback: 'Envoyer le retour',
      submitting: 'Envoi en cours...',
      selectCategoryError: 'Veuillez sélectionner une catégorie',
      // Positive categories
      accurate: 'Précis et fiable',
      clearSummary: 'Synthèse claire',
      rightDetail: 'Bon niveau de détail',
      actionable: 'Prochaines étapes actionnables',
      usefulOps: 'Utile pour les décisions OPS',
      // Negative categories
      inaccurate: 'Contient des inexactitudes',
      tooConfident: 'Trop confiant / pas assez prudent',
      missesPatterns: 'Manque des patterns importants',
      tooLong: 'Trop long ou difficile à parcourir',
      tooVague: 'Trop vague',
      notRealistic: 'Recommandations peu réalistes',
      avoidsHandling: 'Évite de traiter les problèmes de gestion',
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
      high: 'ÉLEVÉ',
      medium: 'MOYEN',
      low: 'FAIBLE',
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
      by: 'par',
      datePlaceholder: 'jj/mm/aaaa',
    },
    
    // Page titles
    page: {
      liftDiagnosticSummary: 'Diagnostic opérationnel et technique d\'ascenseur',
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
  
  zh: {
    // Navigation
    nav: {
      newDiagnostic: '启动新诊断',
      recentDiagnostics: '最近的诊断',
      usageAnalytics: '使用统计',
      promptTesting: '提示测试',
      navigation: '导航',
      adminTools: '管理工具',
      country: '国家',
      feedback: '反馈',
    },
    
    // Countries
    countries: {
      france: '法国',
      unitedKingdom: '英国',
      singapore: '新加坡',
      hongKong: '香港',
    },
    
    // Form labels
    form: {
      building: '建筑物',
      device: '设备',
      whatLookingFor: '您想查询什么？',
      optional: '可选',
      defaultPeriod: '默认诊断期限：最近3个月',
      typeBuildingName: '输入建筑物名称或地址...',
      typeDeviceName: '输入设备名称...',
      selected: '已选择',
      buildingsIn: '个建筑物位于',
      selectBuildingFirst: '请先选择建筑物',
      examplePlaceholder: '例如：更改诊断期限、深入了解重复出现的轿厢门问题、近期故障概述...',
    },
    
    // Actions
    actions: {
      analyze: '分析',
      copy: '复制',
      copied: '已复制！',
      delete: '删除',
      signOut: '退出登录',
      cancel: '取消',
      confirm: '确认',
      clearFilters: '清除筛选条件',
    },
    
    // Feedback
    feedback: {
      provideFeedback: '提供反馈',
      section: '部分',
      yourRating: '您的评价',
      helpful: '有用',
      needsImprovement: '需要改进',
      whatDescribesFeedback: '以下哪项最能描述您的反馈？',
      required: '*',
      selectCategory: '选择类别...',
      additionalDetails: '其他详细信息',
      optional: '（可选）',
      placeholder: '请分享任何具体细节以帮助我们改进...',
      submitFeedback: '提交反馈',
      submitting: '提交中...',
      selectCategoryError: '请选择一个类别',
      // Positive categories
      accurate: '准确可靠',
      clearSummary: '摘要清晰',
      rightDetail: '详细程度适当',
      actionable: '后续步骤可行',
      usefulOps: '对运营决策有用',
      // Negative categories
      inaccurate: '包含不准确之处',
      tooConfident: '过于自信/不够谨慎',
      missesPatterns: '遗漏重要模式',
      tooLong: '过长或难以浏览',
      tooVague: '过于模糊',
      notRealistic: '建议不切实际',
      avoidsHandling: '回避处理问题',
    },
    
    // Tabs
    tabs: {
      summary: '摘要',
      timeline: '时间线',
      visitReports: '服务报告',
      analysis: '分析',
      componentsHistory: '部件历史',
    },
    
    // Results page
    results: {
      title: '诊断结果',
      generated: '生成时间',
      visits: '次服务',
      visit: '次服务',
      breakdowns: '次故障',
      breakdown: '次故障',
      repairRequests: '个维修请求',
      repairRequest: '个维修请求',
      partReplaced: '个更换部件',
      partsReplaced: '个更换部件',
      lastDaysTimeline: '最近{days}天时间线',
      relatedBreakdowns: '相关故障',
      relatedFaults: '相关缺陷',
      partsReplacedOn: '此部件上更换的部件',
      noRelatedData: '此部件没有相关数据。',
      noComponentHistory: '此期间没有可用的部件历史记录。',
      duration: '持续时间',
    },
    
    // Analysis sections
    analysis: {
      executiveSummary: '执行摘要',
      operationalSummary: '运营摘要',
      technicalSummary: '技术摘要',
      overview: '概述',
      summaryOfEvents: '事件摘要',
      currentSituation: '当前情况和后续步骤',
      serviceHandlingReview: '服务处理审查',
      internalUse: '内部使用',
      repeatedPatterns: '重复模式',
      likelyCauses: '可能原因',
      quantifiedImpact: '量化影响',
      rootCauseAnalysis: '根本原因分析',
      actionableRecommendations: '可行建议',
      probabilityOfResolution: '解决概率',
      breakdowns: '故障',
      timeSpan: '时间跨度',
      downtime: '停机时间',
      total: '总计',
      perEvent: '每次事件',
      riskLevel: '风险等级',
      high: '高',
      medium: '中',
      low: '低',
      successRate: '成功率',
      ifIssuePersists: '如果问题持续',
      timeframe: '时间范围',
      expected: '预期',
    },
    
    // Table headers
    table: {
      date: '日期',
      engineer: '技术员',
      type: '类型',
      status: '状态',
      comment: '评论',
      duration: '持续时间',
      origin: '来源',
      component: '部件',
      visited: '已访问',
      userName: '用户名',
      userId: '用户ID',
      totalDiagnostics: '诊断总数',
      countries: '国家',
      latestDiagnostic: '最新诊断',
      unit: '设备',
      building: '建筑物',
      generatedAt: '生成时间',
    },
    
    // Status labels
    status: {
      loading: '加载中...',
      analyzing: '正在分析诊断数据...',
      inspecting: '正在检查设备，请稍候...',
      mayTakeTime: '这可能需要最多20秒',
      noResults: '未找到结果',
      noData: '无可用数据',
      error: '错误',
      retry: '重试',
    },
    
    // Recent Diagnostics
    recent: {
      title: '最近的诊断',
      myDiagnostics: '我的诊断',
      startDate: '开始日期',
      endDate: '结束日期',
      unitName: '设备',
      searchByUnitName: '按设备名称搜索...',
      foundDiagnostics: '找到的诊断',
      noDiagnosticsYet: '未找到诊断。',
      tryAdjustingFilters: '请尝试调整您的筛选条件或启动新诊断。',
      by: '由',
      datePlaceholder: '日/月/年',
    },
    
    // Page titles
    page: {
      liftDiagnosticSummary: '电梯诊断摘要',
    },
    
    // Usage Analytics
    usage: {
      title: '使用统计',
      totalUsers: '用户总数',
      totalDiagnostics: '诊断总数',
      averagePerUser: '每位用户平均',
      searchUsers: '按用户名或ID搜索...',
      noDiagnosticsYet: '尚未生成任何诊断。',
      checkBackLater: '在创建一些诊断后再回来查看。',
      noUsersFound: '未找到与您的搜索匹配的用户。',
      tryDifferentSearch: '请尝试其他搜索词。',
    },
    
    // Timeline
    timeline: {
      daysTimeline: '天时间线',
      last: '最近',
      breakdown: '故障',
      ongoing: '进行中',
      visit: '服务',
      ended: '已结束',
      repairRequest: '维修请求',
      partReplaced: '更换部件',
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


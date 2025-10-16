// logging.config.js
// Configuration du système de logging

module.exports = {
    // Répertoire des logs
    logDirectory: 'logs',
    
    // Fichiers de logs par catégorie
    logFiles: {
        general: 'general_{date}.log',
        warlord: 'warlord_{date}.log',
        performance: 'performance_{date}.log',
        error: 'error_{date}.log',
        debug: 'debug_{date}.log'
    },
    
    // Configuration des niveaux de log
    logLevels: {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
        WARLORD: 4
    },
    
    // Niveau de log actuel (seuls les logs de ce niveau et inférieurs seront écrits)
    currentLevel: 'DEBUG',
    
    // Configuration de la rotation des logs
    rotation: {
        enabled: true,
        maxDays: 7,        // Garder les logs pendant 7 jours
        maxSize: '10MB',   // Taille maximale par fichier
        compress: true     // Compresser les anciens logs
    },
    
    // Configuration de l'affichage console
    console: {
        enabled: false,    // Désactiver l'affichage console par défaut
        showTimestamp: true,
        showLevel: true,
        colors: true
    },
    
    // Configuration spécifique aux warlords
    warlord: {
        logSlots: true,           // Logger les slots warlord
        logErrors: true,         // Logger les erreurs de récupération
        logEndpoints: false,     // Logger les tentatives d'endpoints
        logDetails: true         // Logger les détails des faces warlord
    },
    
    // Configuration des performances
    performance: {
        logSlowFunctions: true,  // Logger les fonctions lentes
        slowThreshold: 5.0,      // Seuil en secondes pour considérer une fonction comme lente
        logMemoryUsage: false    // Logger l'utilisation mémoire
    }
};

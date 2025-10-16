// logManager.js
// Gestionnaire de logs pour le système de calcul de scores
// Permet de consulter, filtrer et analyser les logs

const fs = require('fs').promises;
const path = require('path');

class LogManager {
    constructor() {
        this.logDir = path.join(__dirname, 'logs');
    }

    // Lister tous les fichiers de logs disponibles
    async listLogFiles() {
        try {
            const files = await fs.readdir(this.logDir);
            const logFiles = files.filter(file => file.endsWith('.log'));
            return logFiles.sort();
        } catch (error) {
            console.error('Erreur lors de la lecture du répertoire logs:', error);
            return [];
        }
    }

    // Lire un fichier de log spécifique
    async readLogFile(filename, lines = null) {
        try {
            const filePath = path.join(this.logDir, filename);
            const content = await fs.readFile(filePath, 'utf8');
            const lines_array = content.split('\n').filter(line => line.trim());
            
            if (lines) {
                return lines_array.slice(-lines);
            }
            return lines_array;
        } catch (error) {
            console.error(`Erreur lors de la lecture du fichier ${filename}:`, error);
            return [];
        }
    }

    // Filtrer les logs par type
    async filterLogsByType(filename, type) {
        const logs = await this.readLogFile(filename);
        return logs.filter(log => log.includes(`[${type}]`));
    }

    // Obtenir les logs des warlords
    async getWarlordLogs(date = null) {
        const dateStr = date || new Date().toISOString().split('T')[0];
        const filename = `warlord_${dateStr}.log`;
        return await this.readLogFile(filename);
    }

    // Obtenir les logs d'erreur
    async getErrorLogs(date = null) {
        const dateStr = date || new Date().toISOString().split('T')[0];
        const filename = `error_${dateStr}.log`;
        return await this.readLogFile(filename);
    }

    // Obtenir les logs de performance
    async getPerformanceLogs(date = null) {
        const dateStr = date || new Date().toISOString().split('T')[0];
        const filename = `performance_${dateStr}.log`;
        return await this.readLogFile(filename);
    }

    // Analyser les performances
    async analyzePerformance(date = null) {
        const logs = await this.getPerformanceLogs(date);
        const analysis = {
            totalFunctions: 0,
            totalTime: 0,
            averageTime: 0,
            slowestFunctions: [],
            fastestFunctions: []
        };

        logs.forEach(log => {
            const match = log.match(/\[([^\]]+)\] Temps d'exécution : ([\d.]+) secondes/);
            if (match) {
                const functionName = match[1];
                const duration = parseFloat(match[2]);
                
                analysis.totalFunctions++;
                analysis.totalTime += duration;
                
                analysis.slowestFunctions.push({ function: functionName, duration });
                analysis.fastestFunctions.push({ function: functionName, duration });
            }
        });

        analysis.averageTime = analysis.totalTime / analysis.totalFunctions;
        analysis.slowestFunctions.sort((a, b) => b.duration - a.duration);
        analysis.fastestFunctions.sort((a, b) => a.duration - b.duration);

        return analysis;
    }

    // Nettoyer les anciens logs (garder seulement les 7 derniers jours)
    async cleanOldLogs(daysToKeep = 7) {
        try {
            const files = await fs.readdir(this.logDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
            
            let deletedCount = 0;
            for (const file of files) {
                if (file.endsWith('.log')) {
                    const filePath = path.join(this.logDir, file);
                    const stats = await fs.stat(filePath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filePath);
                        deletedCount++;
                        console.log(`🗑️  Fichier de log supprimé: ${file}`);
                    }
                }
            }
            
            console.log(`✅ Nettoyage terminé: ${deletedCount} fichiers supprimés`);
            return deletedCount;
        } catch (error) {
            console.error('Erreur lors du nettoyage des logs:', error);
            return 0;
        }
    }

    // Afficher un résumé des logs du jour
    async showDailySummary(date = null) {
        const dateStr = date || new Date().toISOString().split('T')[0];
        console.log(`\n📊 RÉSUMÉ DES LOGS - ${dateStr}`);
        console.log('=' .repeat(50));

        // Logs généraux
        const generalLogs = await this.readLogFile(`general_${dateStr}.log`);
        console.log(`📝 Logs généraux: ${generalLogs.length} entrées`);

        // Logs warlord
        const warlordLogs = await this.getWarlordLogs(dateStr);
        console.log(`⚔️  Logs warlord: ${warlordLogs.length} entrées`);

        // Logs d'erreur
        const errorLogs = await this.getErrorLogs(dateStr);
        console.log(`❌ Logs d'erreur: ${errorLogs.length} entrées`);

        // Logs de performance
        const performanceLogs = await this.getPerformanceLogs(dateStr);
        console.log(`⏱️  Logs de performance: ${performanceLogs.length} entrées`);

        // Analyse des performances
        if (performanceLogs.length > 0) {
            const analysis = await this.analyzePerformance(dateStr);
            console.log(`\n📈 ANALYSE DES PERFORMANCES:`);
            console.log(`   • Fonctions exécutées: ${analysis.totalFunctions}`);
            console.log(`   • Temps total: ${analysis.totalTime.toFixed(2)}s`);
            console.log(`   • Temps moyen: ${analysis.averageTime.toFixed(2)}s`);
            
            if (analysis.slowestFunctions.length > 0) {
                console.log(`   • Plus lent: ${analysis.slowestFunctions[0].function} (${analysis.slowestFunctions[0].duration.toFixed(2)}s)`);
            }
        }

        console.log('=' .repeat(50));
    }
}

// Fonctions utilitaires pour l'utilisation en ligne de commande
async function showHelp() {
    console.log(`
🔧 GESTIONNAIRE DE LOGS - AIDE
===============================

Usage: node logManager.js [commande] [options]

Commandes disponibles:
  list                    - Lister tous les fichiers de logs
  warlord [date]          - Afficher les logs warlord (date optionnelle: YYYY-MM-DD)
  error [date]            - Afficher les logs d'erreur
  performance [date]      - Afficher les logs de performance
  summary [date]          - Afficher un résumé des logs du jour
  clean [jours]           - Nettoyer les anciens logs (défaut: 7 jours)
  analyze [date]          - Analyser les performances

Exemples:
  node logManager.js list
  node logManager.js warlord
  node logManager.js warlord 2025-01-15
  node logManager.js summary
  node logManager.js clean 10
  node logManager.js analyze
`);
}

// Interface en ligne de commande
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const param = args[1];

    const logManager = new LogManager();

    switch (command) {
        case 'list':
            const files = await logManager.listLogFiles();
            console.log('📁 Fichiers de logs disponibles:');
            files.forEach(file => console.log(`   • ${file}`));
            break;

        case 'warlord':
            const warlordLogs = await logManager.getWarlordLogs(param);
            console.log('\n⚔️  LOGS WARLORD:');
            warlordLogs.forEach(log => console.log(log));
            break;

        case 'error':
            const errorLogs = await logManager.getErrorLogs(param);
            console.log('\n❌ LOGS D\'ERREUR:');
            errorLogs.forEach(log => console.log(log));
            break;

        case 'performance':
            const perfLogs = await logManager.getPerformanceLogs(param);
            console.log('\n⏱️  LOGS DE PERFORMANCE:');
            perfLogs.forEach(log => console.log(log));
            break;

        case 'summary':
            await logManager.showDailySummary(param);
            break;

        case 'clean':
            const days = param ? parseInt(param) : 7;
            await logManager.cleanOldLogs(days);
            break;

        case 'analyze':
            const analysis = await logManager.analyzePerformance(param);
            console.log('\n📈 ANALYSE DES PERFORMANCES:');
            console.log(`   • Fonctions exécutées: ${analysis.totalFunctions}`);
            console.log(`   • Temps total: ${analysis.totalTime.toFixed(2)}s`);
            console.log(`   • Temps moyen: ${analysis.averageTime.toFixed(2)}s`);
            
            if (analysis.slowestFunctions.length > 0) {
                console.log('\n🐌 FONCTIONS LES PLUS LENTES:');
                analysis.slowestFunctions.slice(0, 5).forEach((item, index) => {
                    console.log(`   ${index + 1}. ${item.function}: ${item.duration.toFixed(2)}s`);
                });
            }
            break;

        default:
            await showHelp();
            break;
    }
}

// Exporter pour utilisation dans d'autres modules
module.exports = { LogManager };

// Exécuter si appelé directement
if (require.main === module) {
    main().catch(console.error);
}

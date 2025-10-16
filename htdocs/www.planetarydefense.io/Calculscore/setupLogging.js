// setupLogging.js
// Script d'initialisation du système de logging

const fs = require('fs').promises;
const path = require('path');
const config = require('./logging.config');

async function setupLogging() {
    console.log('🔧 Configuration du système de logging...');
    
    try {
        // Créer le répertoire des logs
        const logDir = path.join(__dirname, config.logDirectory);
        await fs.mkdir(logDir, { recursive: true });
        console.log(`✅ Répertoire des logs créé: ${logDir}`);
        
        // Créer un fichier README pour expliquer le système
        const readmeContent = `# Système de Logs - Planetary Defense

## Structure des fichiers de logs

- \`general_{date}.log\` - Logs généraux du système
- \`warlord_{date}.log\` - Logs spécifiques aux warlords
- \`performance_{date}.log\` - Logs de performance et temps d'exécution
- \`error_{date}.log\` - Logs d'erreurs
- \`debug_{date}.log\` - Logs de débogage

## Utilisation

### Consulter les logs
\`\`\`bash
# Lister tous les fichiers de logs
node logManager.js list

# Afficher les logs warlord du jour
node logManager.js warlord

# Afficher les logs warlord d'une date spécifique
node logManager.js warlord 2025-01-15

# Afficher un résumé des logs du jour
node logManager.js summary

# Analyser les performances
node logManager.js analyze
\`\`\`

### Nettoyer les anciens logs
\`\`\`bash
# Nettoyer les logs de plus de 7 jours (défaut)
node logManager.js clean

# Nettoyer les logs de plus de 10 jours
node logManager.js clean 10
\`\`\`

## Configuration

Le fichier \`logging.config.js\` permet de personnaliser le système de logging.

## Logs des Warlords

Les logs warlord contiennent :
- Récupération des faces warlord par propriétaire
- Nombre de slots warlord calculés
- Erreurs de récupération des données warlord
- Détails des faces warlord trouvées

## Rotation automatique

Les logs sont automatiquement nettoyés après 7 jours par défaut.
`;
        
        await fs.writeFile(path.join(logDir, 'README.md'), readmeContent, 'utf8');
        console.log('✅ Fichier README créé dans le répertoire logs');
        
        // Créer un fichier .gitignore pour les logs
        const gitignoreContent = `# Logs
*.log
logs/
!logs/README.md
`;
        
        const gitignorePath = path.join(__dirname, '.gitignore');
        try {
            const existingGitignore = await fs.readFile(gitignorePath, 'utf8');
            if (!existingGitignore.includes('# Logs')) {
                await fs.appendFile(gitignorePath, '\n' + gitignoreContent, 'utf8');
                console.log('✅ Entrées ajoutées au .gitignore');
            }
        } catch (error) {
            // Le fichier .gitignore n'existe pas, on le crée
            await fs.writeFile(gitignorePath, gitignoreContent, 'utf8');
            console.log('✅ Fichier .gitignore créé');
        }
        
        console.log('\n🎉 Système de logging configuré avec succès !');
        console.log('\n📋 Prochaines étapes :');
        console.log('   1. Les logs seront automatiquement créés lors de l\'exécution');
        console.log('   2. Utilisez "node logManager.js summary" pour voir un résumé');
        console.log('   3. Utilisez "node logManager.js warlord" pour voir les logs warlord');
        console.log('   4. Consultez logs/README.md pour plus d\'informations');
        
    } catch (error) {
        console.error('❌ Erreur lors de la configuration du logging:', error);
        process.exit(1);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    setupLogging();
}

module.exports = { setupLogging };

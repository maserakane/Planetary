# Récupération des Templates PlanetaryDefense

Ce script récupère **TOUS** les templates de la collection `planetdefnft` et leurs détails.

## 🚀 Utilisation rapide

```bash
# Test du système
node testTemplates.js

# Récupération complète avec détails
node fetchPlanetaryDefenseTemplates.js

# Récupération des Template IDs uniquement
node fetchPlanetaryDefenseTemplates.js --ids-only
```

## 📁 Fichiers créés

- **`fetchPlanetaryDefenseTemplates.js`** - Script principal
- **`testTemplates.js`** - Script de test
- **`planetarydefense_templates.json`** - Fichier complet avec détails
- **`planetarydefense_template_ids.json`** - Liste des Template IDs uniquement

## 📊 Structure du fichier JSON

### Fichier complet (`planetarydefense_templates.json`)
```json
{
  "metadata": {
    "collection_name": "planetdefnft",
    "generated_at": "2024-01-01T12:00:00.000Z",
    "total_templates": 150,
    "processing_time_seconds": 5
  },
  "statistics": {
    "total_templates": 150,
    "unique_schemas": 3,
    "rarity_distribution": {
      "Common": 100,
      "Rare": 30,
      "Epic": 15,
      "Legendary": 5
    },
    "schema_distribution": {
      "mercenary": 80,
      "warlord": 20,
      "other": 50
    },
    "template_ids": ["898936", "898937", "898938"]
  },
  "templates": [
    {
      "template_id": "898936",
      "name": "Mercenary Template",
      "collection_name": "planetdefnft",
      "schema_name": "mercenary",
      "rarity": "Common",
      "shine": "Stone",
      "img": "ipfs://...",
      "attack": 10,
      "defense": 8,
      "movecost": 5,
      "slots": 0,
      "description": "Template description",
      "max_supply": 1000,
      "issued_supply": 500,
      "is_transferable": true,
      "is_burnable": true,
      "created_at_time": "2024-01-01T10:00:00.000Z"
    }
  ]
}
```

### Fichier IDs uniquement (`planetarydefense_template_ids.json`)
```json
{
  "collection_name": "planetdefnft",
  "generated_at": "2024-01-01T12:00:00.000Z",
  "total_templates": 150,
  "template_ids": ["898936", "898937", "898938", "898939"]
}
```

## 🔧 Fonctionnalités

- ✅ **Récupération complète** - Tous les templates de la collection
- ✅ **Pagination automatique** - Gère les grandes collections
- ✅ **Redondance des endpoints** - 16 endpoints AtomicAssets
- ✅ **Gestion d'erreurs** - Retry automatique
- ✅ **Statistiques détaillées** - Distribution par type/rareté
- ✅ **Données transformées** - Format standardisé et lisible
- ✅ **Mode IDs uniquement** - Option pour récupérer seulement les IDs

## 📈 Types de templates récupérés

1. **Mercenaires** (`schema_name: "mercenary"`)
   - Stats d'attaque, défense, coût de mouvement
   - Utilisés dans le système de combat

2. **Warlords** (`schema_name: "warlord"`)
   - Fournissent des slots supplémentaires
   - Pas de stats de combat

3. **Autres templates** (autres schema_name)
   - Divers types selon la collection

## ⚙️ Configuration

### Paramètres modifiables dans le script :

```javascript
const DELAY_BETWEEN_REQUESTS = 500; // Délai en ms
const OUTPUT_FILE = 'planetarydefense_templates.json'; // Fichier de sortie
```

### Endpoints utilisés :
- 16 endpoints AtomicAssets pour la redondance
- Rotation automatique en cas d'erreur
- Timeout de 30 secondes par requête

## 🧪 Tests

```bash
# Test rapide
node testTemplates.js

# Le script affiche des exemples et la liste des Template IDs
```

## 📊 Statistiques générées

- **Total templates** - Nombre total de templates
- **Schemas uniques** - Nombre de schemas différents
- **Distribution par schema** - Répartition par type (mercenary, warlord, etc.)
- **Distribution par rareté** - Répartition par rareté (Common, Rare, Epic, etc.)
- **Liste des Template IDs** - Tous les IDs triés numériquement

## 🔍 Exemple d'utilisation

```javascript
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('planetarydefense_templates.json', 'utf8'));

console.log(`Total templates: ${data.metadata.total_templates}`);
console.log(`Template IDs: ${data.statistics.template_ids.join(', ')}`);

// Filtrer les mercenaires
const mercenaries = data.templates.filter(t => t.schema_name === 'mercenary');
console.log(`Templates mercenaires: ${mercenaries.length}`);

// Filtrer par rareté
const legendary = data.templates.filter(t => t.rarity === 'Legendary');
console.log(`Templates légendaires: ${legendary.length}`);
```

## ⚠️ Notes importantes

- **Temps de traitement** : Généralement rapide (quelques secondes)
- **Taille du fichier** : Le fichier JSON est généralement petit
- **Rate limiting** : Le script respecte les limites des APIs
- **Redondance** : Utilise plusieurs endpoints pour éviter les échecs


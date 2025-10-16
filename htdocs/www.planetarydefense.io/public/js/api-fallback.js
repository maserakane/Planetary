// api-fallback.js
// Système de fallback pour les API qui ne fonctionnent pas

class APIFallback {
    constructor() {
        this.primaryAPIs = [
            'https://atomic.3dkrender.com',
            'https://wax.api.atomicassets.io',
            'https://wax.api.atomicassets.io'
        ];
        this.currentAPI = 0;
        this.failedAPIs = new Set();
    }

    async fetchWithFallback(url, options = {}) {
        // Essayer d'abord l'API principale
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
        } catch (error) {
            console.warn(`API ${url} failed, trying fallback...`);
        }

        // Essayer les API de fallback
        for (let i = 1; i < this.primaryAPIs.length; i++) {
            try {
                const fallbackUrl = url.replace(this.primaryAPIs[0], this.primaryAPIs[i]);
                const response = await fetch(fallbackUrl, options);
                if (response.ok) {
                    console.log(`Using fallback API: ${this.primaryAPIs[i]}`);
                    return response;
                }
            } catch (error) {
                console.warn(`Fallback API ${this.primaryAPIs[i]} also failed`);
            }
        }

        throw new Error('All APIs failed');
    }

    async getAssetInfo(assetId) {
        const endpoints = [
            `https://atomic.3dkrender.com/atomicassets/v1/assets/${assetId}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/assets/${assetId}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/assets/${assetId}`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${endpoint}:`, error);
            }
        }

        throw new Error('All asset info endpoints failed');
    }

    async getTemplateInfo(templateId) {
        const endpoints = [
            `https://atomic.3dkrender.com/atomicassets/v1/templates/alien.worlds/${templateId}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/templates/alien.worlds/${templateId}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/templates/alien.worlds/${templateId}`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn(`Failed to fetch template from ${endpoint}:`, error);
            }
        }

        throw new Error('All template endpoints failed');
    }

    async getCollectionInfo(collectionName) {
        const endpoints = [
            `https://atomic.3dkrender.com/atomicassets/v1/collections/${collectionName}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/collections/${collectionName}`,
            `https://wax.api.atomicassets.io/atomicassets/v1/collections/${collectionName}`
        ];

        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint);
                if (response.ok) {
                    return await response.json();
                }
            } catch (error) {
                console.warn(`Failed to fetch collection from ${endpoint}:`, error);
            }
        }

        throw new Error('All collection endpoints failed');
    }
}

// Instance globale
const apiFallback = new APIFallback();

// Fonctions utilitaires pour compatibilité
async function fetchAssetInfo(assetId) {
    try {
        return await apiFallback.getAssetInfo(assetId);
    } catch (error) {
        console.error('Failed to fetch asset info:', error);
        return null;
    }
}

async function fetchTemplateInfo(templateId) {
    try {
        return await apiFallback.getTemplateInfo(templateId);
    } catch (error) {
        console.error('Failed to fetch template info:', error);
        return null;
    }
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { APIFallback, apiFallback, fetchAssetInfo, fetchTemplateInfo };
}

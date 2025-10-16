// test-api-fallback.js
// Script pour tester les API alternatives

async function testAPIFallback() {
    console.log('🔍 Test des API alternatives...');
    
    const testAssetId = '1099616846779';
    const apiUrls = [
        `https://atomic.3dkrender.com/atomicassets/v1/assets/${testAssetId}`,
        `https://wax.api.atomicassets.io/atomicassets/v1/assets/${testAssetId}`,
        `https://wax.api.atomicassets.io/atomicassets/v1/assets/${testAssetId}`
    ];
    
    for (let i = 0; i < apiUrls.length; i++) {
        const apiUrl = apiUrls[i];
        console.log(`\n📡 Test de l'API ${i + 1}: ${apiUrl}`);
        
        try {
            const startTime = Date.now();
            const response = await fetch(apiUrl);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ API ${i + 1} fonctionne (${duration}ms)`);
                console.log(`   - Status: ${response.status}`);
                console.log(`   - Data available: ${data.success ? 'Yes' : 'No'}`);
                if (data.data) {
                    console.log(`   - Asset name: ${data.data.name || 'N/A'}`);
                    console.log(`   - Template ID: ${data.data.template?.template_id || 'N/A'}`);
                }
                return { success: true, api: apiUrl, duration, data };
            } else {
                console.log(`❌ API ${i + 1} échoué - Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ API ${i + 1} erreur: ${error.message}`);
        }
    }
    
    console.log('\n💥 Toutes les API ont échoué');
    return { success: false };
}

// Test des templates
async function testTemplateAPI() {
    console.log('\n🔍 Test des API de templates...');
    
    const testTemplateId = '123456';
    const apiUrls = [
        `https://atomic.3dkrender.com/atomicassets/v1/templates/alien.worlds/${testTemplateId}`,
        `https://wax.api.atomicassets.io/atomicassets/v1/templates/alien.worlds/${testTemplateId}`,
        `https://wax.api.atomicassets.io/atomicassets/v1/templates/alien.worlds/${testTemplateId}`
    ];
    
    for (let i = 0; i < apiUrls.length; i++) {
        const apiUrl = apiUrls[i];
        console.log(`\n📡 Test template API ${i + 1}: ${apiUrl}`);
        
        try {
            const startTime = Date.now();
            const response = await fetch(apiUrl);
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            if (response.ok) {
                const data = await response.json();
                console.log(`✅ Template API ${i + 1} fonctionne (${duration}ms)`);
                return { success: true, api: apiUrl, duration, data };
            } else {
                console.log(`❌ Template API ${i + 1} échoué - Status: ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ Template API ${i + 1} erreur: ${error.message}`);
        }
    }
    
    console.log('\n💥 Toutes les template API ont échoué');
    return { success: false };
}

// Exécuter les tests
async function runTests() {
    console.log('🚀 Début des tests d\'API...\n');
    
    const assetResult = await testAPIFallback();
    const templateResult = await testTemplateAPI();
    
    console.log('\n📊 Résumé des tests:');
    console.log(`Assets API: ${assetResult.success ? '✅ Fonctionne' : '❌ Échoué'}`);
    console.log(`Template API: ${templateResult.success ? '✅ Fonctionne' : '❌ Échoué'}`);
    
    if (assetResult.success) {
        console.log(`Meilleure API pour assets: ${assetResult.api}`);
        console.log(`Temps de réponse: ${assetResult.duration}ms`);
    }
    
    if (templateResult.success) {
        console.log(`Meilleure API pour templates: ${templateResult.api}`);
        console.log(`Temps de réponse: ${templateResult.duration}ms`);
    }
}

// Exécuter si appelé directement
if (typeof window !== 'undefined') {
    // Dans le navigateur
    runTests();
} else if (require.main === module) {
    // Dans Node.js
    runTests();
}

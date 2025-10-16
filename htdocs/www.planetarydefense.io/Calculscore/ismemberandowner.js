const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Load the private key from environment variables
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName= process.env.PERMISSION_NAME;

if (!privateKey) {
    console.error('Private key is not defined in the environment variables.');
    process.exit(1);
}

// Configuration for blockchain
const chain = {
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    url: "https://wax.pink.gg",
};

const walletPlugin = new WalletPluginPrivateKey(privateKey);

const session = new Session({
    actor: accountName,
    permission: permissionName,
    chain,
    walletPlugin,
});

// Fonction pour récupérer les données des tables "owners" et "members" sur la blockchain WAX
async function ismemberandowner() {
    try {
        // Récupérer les données de la table "owners"
        const ownersResponse = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'magordefense',   // Le contrat intelligent EOSIO
                table: "owners",        // La table à interroger
                scope: 'magordefense',  // La portée de la table
                json: true,             // Demande des résultats au format JSON
                limit: 1000,            // Limite le nombre de résultats retournés
                reverse: false,         // Ordre des résultats
                show_payer: false       // Ne pas afficher le payeur
            }),
        });

        if (!ownersResponse.ok) {
            throw new Error('Error fetching owners data from blockchain');
        }

        const ownersData = await ownersResponse.json();
        const owners = ownersData.rows.map(row => row.owner_address);  // Extraire les adresses des propriétaires

        // Récupérer les données de la table "members"
        const membersResponse = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'magordefense',   // Le contrat intelligent EOSIO
                table: "members",       // La table à interroger
                scope: 'magordefense',  // La portée de la table
                json: true,             // Demande des résultats au format JSON
                limit: 1000,            // Limite le nombre de résultats retournés
                reverse: false,         // Ordre des résultats
                show_payer: false       // Ne pas afficher le payeur
            }),
        });

        if (!membersResponse.ok) {
            throw new Error('Error fetching members data from blockchain');
        }

        const membersData = await membersResponse.json();
        const members = membersData.rows.map(row => row.player_name);  // Extraire les noms des membres

        // Concaténer les adresses des propriétaires et des membres
        const allAddresses = [...owners, ...members];

        // Vérifier si une adresse apparaît deux fois (trouver les duplicatas)
        const duplicateAddresses = allAddresses.filter((address, index, array) => array.indexOf(address) !== index);

        if (duplicateAddresses.length > 0) {
            // Boucle sur les adresses dupliquées et envoie une transaction pour les supprimer
            for (const playerToRemove of duplicateAddresses) {
                try {
                    const action = {
                        account: accountName,  // Le compte exécutant l'action
                        name: 'removemem',     // Le nom de l'action sur la blockchain EOSIO
                        authorization: [{
                            actor: accountName,     // Le compte autorisant l'action
                            permission: permissionName, // Le niveau de permission, généralement 'active'
                        }],
                        data: {
                            player_name: playerToRemove  // Le joueur à supprimer, passé en tant que paramètre
                        },
                    };

                    const result = await session.transact({ actions: [action] }, {
                        blocksBehind: 3,          // Délais des blocs derrière
                        expireSeconds: 30,        // Durée d'expiration de la transaction
                    });

                    if (result && result.transaction_id) {
                        //console.log(`Transaction successful! Transaction ID: ${result.transaction_id}`);
                    } else {
                        //console.log('Transaction might have succeeded but did not return a transaction_id', result);
                    }
                } catch (error) {
                    console.error(`Error occurred during removemem action for ${playerToRemove}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error fetching data from blockchain:', error);
        throw error;
    }
}


module.exports = { ismemberandowner };

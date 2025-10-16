const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Charge les variables d'environnement depuis le même dossier

const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DATABASE_PATH;

if (!dbPath) {
    console.error('Database path is not defined in the environment variables.');
    process.exit(1);
}

const db = new sqlite3.Database(dbPath);

// Load the private key from environment variables
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
    console.error('Private key is not defined in the environment variables.');
    process.exit(1);
}

// Configuration for blockchain
const chain = {
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    url: "https://wax.pink.gg",
};
const accountName = "magordefense";
const permissionName = "owner";
const walletPlugin = new WalletPluginPrivateKey(privateKey);

const session = new Session({
    actor: accountName,
    permission: permissionName,
    chain,
    walletPlugin,
});

async function Harden(mission_name, hardening_percentage) {
    try {
        const action = {
            account: 'magordefense',
            name: 'hardenmiss',
            authorization: [{
                actor: 'magordefense',
                permission: 'owner',
            }],
            data: {
                mission_name: mission_name,
                hardening_percentage: hardening_percentage,
            },
        };



        const result = await session.transact({ actions: [action] }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        // Ajouter un délai de 40 secondes avant d'exécuter la transaction
        await new Promise(resolve => setTimeout(resolve, 40000));

        if (result) {
            console.log(`Transaction successful! Transaction ID: ${result}`);
            // Après une transaction réussie, récupérez les nouvelles données de la mission
            await updateAttackTarget(mission_name, hardening_percentage);
        } else {
            console.log('Transaction might have succeeded but did not return a transaction_id', result);
            await updateAttackTarget(mission_name, hardening_percentage);
        }
    } catch (error) {
        console.error(`Error occurred: ${error.message}`);
    }
}

async function updateAttackTarget(mission_name, hardening_percentage) {
    console.log(`Starting updateAttackTarget for mission: ${mission_name} with hardening percentage: ${hardening_percentage}`);

    try {
        // Requête API pour obtenir les informations de la mission
        const response = await fetch('https://wax.blokcrafters.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "code": "magordefense",
                "table": "missions",
                "scope": "magordefense",
                "upper_bound": mission_name,
                "lower_bound": mission_name,
                "json": true
            })
        });

        const data = await response.json();

        if (data.rows.length === 0) {
            console.log(`No data returned from API for mission: ${mission_name}`);
            return;
        }

        const missionData = data.rows[0];
        const newAttackTarget = parseFloat(missionData.target_attack_points);
        console.log(`New target attack points from API: ${newAttackTarget}`);

        // Mise à jour de la base de données avec le nouveau target
        db.serialize(() => {
            console.log(`Updating database for mission: ${mission_name}`);

            db.run(`UPDATE html SET attackTarget = ? WHERE progress = 0 AND attackTitleOnchain = ?`, [newAttackTarget, mission_name], (updateErr) => {
                if (updateErr) {
                    console.error(`Error updating database: ${updateErr.message}`);
                    return;
                }
                console.log(`AttackTarget successfully updated to ${newAttackTarget} for mission ${mission_name}`);
            });
        });

    } catch (error) {
        console.error(`Error fetching mission data from API: ${error.message}`);
    } finally {
        db.close((err) => {
            if (err) {
                console.error(`Error closing the database: ${err.message}`);
            } else {
                console.log('Database connection closed successfully.');
            }
        });
    }
}

// Exemple d'utilisation
(async () => {
    const baseUrl = 'https://www.planetarydefense.io'; // Replace with your server's base URL
    try {
        const response = await fetch(`${baseUrl}/mission/mission-data?cache-buster=${new Date().getTime()}`);
        const data = await response.json();
        
        const endDateTimestamp = data.attack.attackEndDate;  // Timestamp from the API (e.g., 1729036800)
        const currentTimestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds

        console.log(`Mission end date: ${endDateTimestamp}`);
        console.log(`Current timestamp: ${currentTimestamp}`);

        if (currentTimestamp < endDateTimestamp) {
            // Mission is not finished, perform hardenning
            const name = data.attack.attackTitleOnchain;
            const hardenning = data.attack.attackDifficulty;
            console.log(`Mission not finished, performing hardenning for: ${name} with difficulty: ${hardenning}`);
            await Harden(name, hardenning);
        } else {
            console.log('Mission is already finished, hardenning not performed.');
        }
    } catch (error) {
        console.error(`Error fetching mission data: ${error.message}`);
    }
})();

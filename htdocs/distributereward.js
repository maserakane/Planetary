const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'www.planetarydefense.io/.env') });

const dbPath = process.env.DATABASE_PATH;
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

async function Distributereward(mission_name) {
    try {
        const action = {
            account: accountName,
            name: 'distributere',
            authorization: [{
                actor: accountName,
                permission: permissionName,
            }],
            data: {
                mission_name: mission_name
            },
        };

        const result = await session.transact({ actions: [action] }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        if (result) {
            console.log(`Transaction successful! Transaction ID: ${result}`);
            // After successful transaction, update the database
            updateAttackTarget(mission_name);
        } else {
            console.log('Transaction might have succeeded but did not return a transaction_id', result);
        }
    } catch (error) {
        console.error(`Error occurred: ${error.message}`);
    }
}

function updateAttackTarget(mission_name) {
    db.serialize(() => {
        db.get(`SELECT * FROM html WHERE progress = 0 AND attackTitleOnchain = ?`, [mission_name], (err, row) => {
            if (err) {
                return console.error(err.message);
            }
            if (row && !row.defenseimg && !row.defensetext && !row.defenseTitleSite && !row.defenseTarget && !row.defenseRewards && !row.defenseStartDate && !row.defenseEndDate && !row.defenseTitleOnchain) {
                db.run(`UPDATE html SET progress = 1 WHERE progress = 0 AND attackTitleOnchain = ?`, [mission_name], (updateErr) => {
                    if (updateErr) {
                        return console.error(updateErr.message);
                    }
                    console.log(`Progress set to 1 for mission ${mission_name}`);
                });
            } else {
                console.log('No matching attack mission found or it has defense fields.');
            }
        });
    });
}

// Example usage
(async () => {
    const baseUrl = 'https://www.planetarydefense.io'; // Replace with your server's base URL
    try {
        const response = await fetch(`${baseUrl}/mission/mission-data?cache-buster=${new Date().getTime()}`);
        const data = await response.json();
        
        const endDateTimestamp = data.attack.attackEndDate;  // Timestamp from the API (1729036800)
        const currentTimestamp = Math.floor(Date.now() / 1000); // Current timestamp in seconds

        console.log(`Mission end date: ${endDateTimestamp}`);
        console.log(`Current timestamp: ${currentTimestamp}`);

        if (currentTimestamp >= endDateTimestamp) {
            const name = data.attack.attackTitleOnchain;
            console.log(`Mission finished, distributing reward for: ${name}`);
            await Distributereward(name);  // Uncomment this when the function is ready
        } else {
            console.log('Mission not yet finished, reward not distributed.');
        }
    } catch (error) {
        console.error(`Error fetching mission data: ${error.message}`);
    } finally {
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Closed the database connection.');
        });
    }
})();

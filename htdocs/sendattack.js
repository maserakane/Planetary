const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'www.planetarydefense.io/.env') });

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

const dbPath = process.env.DATABASE_PATH;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                return reject(err);
            }
            resolve(db);
        });
    });
}

function fetchAttackMissions(db) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM html WHERE progress IS NULL`;
        db.all(sql, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
}

function updateProgress(db, id) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE html SET progress = 0 WHERE id = ?`;
        db.run(sql, [id], function(err) {
            if (err) {
                return reject(err);
            }
            resolve();
        });
    });
}

async function sendAttackMissionsOnChain(db, missions) {
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    console.log(`Current time in seconds: ${currentTimeInSeconds}`);

    for (const row of missions) {
        const { id, attackTitleOnchain, attackTarget, attackRewards, attackStartDate, attackEndDate, attackShards } = row;
        console.log("row", row);
        console.log(`Processing mission ID: ${id}`);

        // Convert attackStartDate and attackEndDate to integers for comparison
        const startDate = parseInt(attackStartDate);
        const endDate = parseInt(attackEndDate);

        // Check if attackStartDate is in the past and all necessary fields are provided
        if (!attackTitleOnchain || !attackTarget || !attackRewards || !startDate || !endDate || !attackShards) {
            console.log(`Skipping mission ID: ${id} due to missing data.`);
            continue;
        }

        if (startDate <= currentTimeInSeconds) {
            const mission = {
                mission_name: attackTitleOnchain,
                target_attack_points: parseInt(attackTarget),
                reward: attackRewards,
                shards: parseInt(attackShards), // Include attackShards in the mission data
                deadline_seconds: endDate - startDate,
            };

            const action = {
                account: "magordefense",
                name: "createmis",
                authorization: [{
                    actor: session.actor,
                    permission: session.permission,
                }],
                data: mission,
            };

            console.log(`Sending transaction for mission ID: ${id}`);
            try {
                const result = await session.transact({ actions: [action] });
                console.log(`Transaction successful for mission ID: ${id}, Transaction ID: ${result.transaction_id}`);

                await updateProgress(db, id);
            } catch (error) {
                console.error(`Error executing transaction for mission ID: ${id}`, error);
            }
        } else {
            console.log(`Skipping mission ID: ${id} as its start date is in the future.`);
        }
    }
}

async function main() {
    try {
        const db = await openDatabase();
        const missions = await fetchAttackMissions(db);
        await sendAttackMissionsOnChain(db, missions);
        db.close();
        console.log("Database closed.");
    } catch (error) {
        console.error("Error processing mission data:", error);
    }
}

main();

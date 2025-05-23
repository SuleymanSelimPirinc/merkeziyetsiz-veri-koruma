// key_manager_lit/lit_client.js
const { LitNodeClientNodeJs } = require('@lit-protocol/lit-node-client-nodejs');

async function getLitClient() {
    const client = new LitNodeClientNodeJs({
        litNetwork: 'datil-test',
        debug: false,
        // logLevel: 'error' // Gerekirse sadece error seviyesindeki SDK logları için
    });

    try {
        await client.connect();
        console.error("✅ Lit Client connected."); // Başarı logu
        return client;
    } catch (error) {
        console.error("❌ FATAL (lit_client.js): Lit Client connection failed:", error.message);
        // if (error.stack) console.error("   Connection Error Stack:", error.stack); // Gerekirse detaylı stack trace
        process.exit(1);
    }
}

module.exports = { getLitClient };
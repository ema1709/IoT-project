const { app } = require('@azure/functions');
const { CosmosClient } = require('@azure/cosmos');

// Configuration for Cosmos DB
const endpoint = process.env.COSMOS_DB_ENDPOINT;
const key = process.env.COSMOS_DB_KEY;
// The CosmosClient should be initialized once globally for best performance
const client = new CosmosClient({ endpoint, key });

const databaseId = 'IoTMessages';
const containerId = 'DeviceData';

/**
 * Retrieves an existing document or returns a new template.
 * @param {string} deviceId The ID of the device, used as the document ID and Partition Key.
 * @param {object} container The Cosmos DB container object.
 * @param {object} context The Azure Function context object for logging.
 * @returns {object} The existing document resource or a new template.
 */
async function getOrCreateDeviceDocument(deviceId, container, context) {
    // We use the deviceId as the document ID and the partition key (if configured that way)
    const item = container.item(deviceId, deviceId);
    
    try {
        // 1. Try to read the existing document
        const { resource } = await item.read();
        if (resource) {
            context.log(`Found existing document for device: ${deviceId}`);
            return resource;
        }
    } catch (error) {
        // Error code 404 means the document was not found, which is expected for the first message.
        if (error.code !== 404) {
            context.log('❌ Error reading Cosmos DB document:', error.message);
            throw error; // Throw other critical errors
        }
    }

    // 2. If not found (or 404 error), create a template for the document
    const newDoc = {
        id: deviceId, // Using Device ID as the Document ID (Crucial for upsert)
        deviceId: deviceId, // And as an explicit field
        lastUpdated: new Date().toISOString(),
        temperature_c: null,
        humidity_pct: null,
        activity_index: null,
        activity_index_avg: null,
        activity_index_count: 0,
        spi_raw: null
    };
    context.log(`Creating new document template for device: ${deviceId}`);
    return newDoc;
}

app.eventHub('eventHubTrigger1', {
    connection: 'eventHubConnectionAppSetting',
    eventHubName: 'iot-prototyping-34365',
    cardinality: 'many',
    handler: async (messages, context) => {
        const db = client.database(databaseId);
        const container = db.container(containerId);

        for (const message of messages) {
            let updateNeeded = false;
            let deviceId;

            try {
                // --- ROBUST BODY PARSING FIX (V2) ---
                let messageSource = message.body || message; 
                let messageBodyString;

                if (!messageSource) {
                    context.log('❌ Message payload source is empty or undefined. Skipping.');
                    continue;
                }
                
                // If it's a buffer, use toString. If it's a string, use it. If it's a plain object, stringify it.
                if (typeof Buffer !== 'undefined' && Buffer.isBuffer(messageSource)) {
                    messageBodyString = messageSource.toString('utf8');
                } else if (typeof messageSource === 'string') {
                    messageBodyString = messageSource;
                } else {
                    // Assume it's a plain object that contains the payload data (common for local runs)
                    // If message is already a deserialized object, we use it directly for parsing.
                    messageBodyString = JSON.stringify(messageSource);
                }

                // If messageSource was a plain object, this re-parses it, which is fine
                // but if it was the stringified body, this correctly parses it.
                const parsedBody = JSON.parse(messageBodyString);
                // --- END ROBUST BODY PARSING FIX (V2) ---

                // 1. Get Device ID: PRIORITIZING FIX
                // Use optional chaining (?. ) on systemProperties to prevent crash if undefined.
                deviceId = message.systemProperties?.['iothub-connection-device-id'] 
                            || parsedBody?.end_device_ids?.device_id;
                
                if (!deviceId) {
                    context.log('❌ Could not determine Device ID from message. Skipping.');
                    continue; 
                }

                // 2. Extract the decoded sensor data. Based on your sample, 
                // the data we want is nested deep inside 'uplink_message.decoded_payload'.
                const payload = parsedBody.uplink_message?.decoded_payload || {}; 

                context.log(`Processing device ${deviceId}. Extracted sensor data (payload): ${JSON.stringify(payload)}`);


                // 3. Read existing document or get a template for a new one
                const currentDoc = await getOrCreateDeviceDocument(deviceId, container, context);
                
                // 4. Apply updates based on the decoded payload fields
                
                // Temperature update (FPort 1)
                if (payload.temperature_c !== undefined && payload.temperature_c !== null) {
                    currentDoc.temperature_c = payload.temperature_c;
                    context.log(`-> Updating Temperature: ${currentDoc.temperature_c}°C`);
                    updateNeeded = true;
                }

                // Humidity update (FPort 2)
                if (payload.humidity_pct !== undefined && payload.humidity_pct !== null) {
                    currentDoc.humidity_pct = payload.humidity_pct;
                    context.log(`-> Updating Humidity: ${currentDoc.humidity_pct}%`);
                    updateNeeded = true;
                }

                // Activity update (FPort 3)
                if (payload.activity_index !== undefined && payload.activity_index !== null) {
                    const newValue = payload.activity_index;

                    // Store current value
                    currentDoc.activity_index = newValue;

                    // Initialize if null (first ever message)
                    if (!currentDoc.activity_index_count) {
                        currentDoc.activity_index_count = 0;
                        currentDoc.activity_index_avg = 0;
                    }

                    // Update average
                    const oldCount = currentDoc.activity_index_count;
                    const oldAvg = currentDoc.activity_index_avg || 0;

                    const newAvg = ((oldAvg * oldCount) + newValue) / (oldCount + 1);

                    currentDoc.activity_index_avg = newAvg;
                    currentDoc.activity_index_count = oldCount + 1;

                    context.log(`-> Updating Activity: current=${newValue}, avg=${newAvg}`);
                    updateNeeded = true;
                }

                // FPort 4 (SPI Raw / MAC + RSSI)

                if (payload.macAddress1 !== undefined || payload.macAddress2 !== undefined || payload.macAddress3 !== undefined) {
                    // MAC + Signal Strength 1
                    if (payload.macAddress1) currentDoc.macAddress1 = payload.macAddress1;
                    if (payload.signalStrength1 !== undefined && payload.signalStrength1 !== null) currentDoc.signalStrength1 = payload.signalStrength1;

                    // MAC + Signal Strength 2
                    if (payload.macAddress2) currentDoc.macAddress2 = payload.macAddress2;
                    if (payload.signalStrength2 !== undefined && payload.signalStrength2 !== null) currentDoc.signalStrength2 = payload.signalStrength2;

                    // MAC + Signal Strength 3
                    if (payload.macAddress3) currentDoc.macAddress3 = payload.macAddress3;
                    if (payload.signalStrength3 !== undefined && payload.signalStrength3 !== null) currentDoc.signalStrength3 = payload.signalStrength3;

                    // Store the raw hex
                    if (payload.raw_hex) currentDoc.spi_raw = payload.raw_hex;

                    context.log(`-> Updated SPI RAW fields for device ${deviceId}`);
                    updateNeeded = true;
                }
                
                // Battery update (FPort 5)
                if (payload.battery_percent !== undefined && payload.battery_percent !== null) {
                    currentDoc.battery_percent = payload.battery_percent;
                    context.log(`-> Updating battery: ${currentDoc.battery_percent}%`);
                    updateNeeded = true;
                 }

                // 5. Perform the upsert if data was updated
                if (updateNeeded) {
                    currentDoc.lastUpdated = new Date().toISOString();
                    
                    // CRITICAL LOG: Check the ID being used right before the write
                    context.log(`>>> ATTEMPTING UPSERT FOR DOCUMENT ID: ${currentDoc.id} <<<`);
                    
                    // The upsert method uses currentDoc.id (which is deviceId) to check for existence.
                    const { resource: updatedResource } = await container.items.upsert(currentDoc);
                    context.log(`✅ Document upserted successfully for device ${deviceId}. ETag: ${updatedResource._etag}`);
                } else {
                    context.log(`ℹ️ Message for device ${deviceId} did not contain relevant sensor data. Skipping DB update.`);
                }

            } catch (err) {
                // Log critical errors during message processing
                context.log(`❌ Critical Error processing message for device ${deviceId || 'Unknown'}: ${err.message}`);
            }
        }
    }
});
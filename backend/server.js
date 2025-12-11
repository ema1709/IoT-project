const express = require('express');
const cors = require('cors');
const { CosmosClient } = require('@azure/cosmos');
require('dotenv').config();
const app = express();
app.use(cors());

const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;
const databaseId = process.env.DATABASE_ID;
const containerId = process.env.CONTAINER_ID;
const port = process.env.PORT || 3001;

const client = new CosmosClient({ endpoint, key });


app.get('/messages', async (req, res) => {
  try {
    const container = client.database(databaseId).container(containerId);
    const { resources } = await container.items.query('SELECT * FROM c').fetchAll();

    if (resources.length > 0) {
      const latest = resources[resources.length - 1];
      const base64 = latest.payload?.uplink_message?.frm_payload;

      if (base64) {
        const buffer = Buffer.from(base64, 'base64');
        const temperature = buffer[0]; // assuming 1-byte Celsius value
        latest.decoded_temperature = temperature;
      }
    }

    res.json(resources);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/downlink', express.json(), async (req, res) => {
  try {
    const { deviceId, payload, fPort } = req.body;

    console.log(req.body)

    if (!deviceId || !payload) {
      return res.status(400).json({ error: "Missing deviceId or payload" });
    }

    const appId = process.env.TTN_APP_ID;
    const apiKey = process.env.TTN_API_KEY;

    const url = `https://eu1.cloud.thethings.network/api/v3/as/applications/${appId}/devices/${deviceId}/down/push`;

    const fetch = global.fetch;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        downlinks: [
          {
            f_port: fPort || 1,
            frm_payload: payload, // must be Base64
            priority: "NORMAL"
          }
        ]
      })
    });

    const result = await response.text();
    res.status(200).send(result);
    console.log(result)

  } catch (err) {
    console.error("Downlink error:", err);
    res.status(500).json({ error: err.message });
  }
});


app.listen(port, () => console.log(`API running on http://localhost:${port}`));


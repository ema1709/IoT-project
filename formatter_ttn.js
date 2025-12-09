// -------------------------
// Converts array of bytes into a plain ASCII string.
// Used because all sensor values (Temp/Hum/AI/Battery) are sent as ASCII floats.
// -------------------------
function bytesToString(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) {
        s += String.fromCharCode(bytes[i]);
    }
    return s;
}


function decodeUplink(input) {
    var bytes = input.bytes;
    var port  = input.fPort;
    var decoded = {};

    // Convert bytes → ASCII text (e.g., "23.5", "78", "W6CD...")
    var text  = bytesToString(bytes);

    // Try converting the string into a float number
    // (valid for ports 1–3–5)
    var value = parseFloat(text);


    // -------------------------
    // Handle decoding based on FPort value.
    // Each sensor sends on a different LoRaWAN port.
    // -------------------------
    switch (port) {


        // ======================================================
        // PORT 1 → TEMPERATURE (ASCII float)
        // ======================================================
        case 1:
            if (!isNaN(value)) {
                decoded.temperature_c = value;   // parsed temperature
                decoded.raw_text      = text;    // original ASCII string
                decoded.sensor_type   = "Temperature";
            } else {
                decoded.error = "Invalid temperature format on FPort 1.";
            }
            break;


        // ======================================================
        // PORT 2 → HUMIDITY (ASCII float)
        // ======================================================
        case 2:
            if (!isNaN(value)) {
                decoded.humidity_pct = value;
                decoded.raw_text     = text;
                decoded.sensor_type  = "Humidity";
            } else {
                decoded.error = "Invalid humidity format on FPort 2.";
            }
            break;


        // ======================================================
        // PORT 3 → ACTIVITY INDEX (ASCII float)
        // ======================================================
        case 3:
            if (!isNaN(value)) {
                decoded.activity_index = value;
                decoded.raw_text       = text;
                decoded.sensor_type    = "Activity";
            } else {
                decoded.error = "Invalid activity format on FPort 3.";
            }
            break;


        // ======================================================
        // PORT 4 → WiFi scan results (custom ASCII format)
        //
        // The Pro Mini sends a long ASCII string:
        // "W<MAC1><RSSI1><MAC2><RSSI2><MAC3><RSSI3>"
        //
        // Example:
        // "W6CD6E314E580736CD6E314E582746CD6E314E58374"
        //
        // - 'W' is a prefix we ignore
        // - Each MAC is 12 hex chars
        // - Each RSSI is 2 digits representing magnitude (negative value)
        // ======================================================
        case 4: {
            decoded.sensor_type = "WiFiScan";
            decoded.raw_text    = text;

            // Remove optional "W" prefix sent by the Arduino
            var wifi = text;
            if (wifi.length > 0 && wifi[0] === 'W') {
                wifi = wifi.substring(1);
            }

            // Expect 42 chars = 3 * (12-char MAC + 2-char RSSI)
            if (wifi.length >= 42) {

                // Convert 12 hex chars → MAC address format XX:XX:XX:XX:XX:XX
                function macFromHex(str) {
                    if (!str || str.length < 12) return null;
                    var parts = [];
                    for (var i = 0; i < 12; i += 2) {
                        parts.push(str.substring(i, i + 2));
                    }
                    return parts.join(":");
                }

                // Convert 2 ASCII digits → RSSI value (negative)
                function rssiFrom2Digits(str) {
                    if (!str || str.length !== 2) return null;
                    var mag = parseInt(str, 10);
                    if (isNaN(mag)) return null;
                    return -mag;  // original RSSI values are negative
                }

                // ---- Extract MAC1 + RSSI1 ----
                decoded.macAddress1     = macFromHex(wifi.substring(0, 12));
                decoded.signalStrength1 = rssiFrom2Digits(wifi.substring(12, 14));

                // ---- Extract MAC2 + RSSI2 ----
                decoded.macAddress2     = macFromHex(wifi.substring(14, 26));
                decoded.signalStrength2 = rssiFrom2Digits(wifi.substring(26, 28));

                // ---- Extract MAC3 + RSSI3 ----
                decoded.macAddress3     = macFromHex(wifi.substring(28, 40));
                decoded.signalStrength3 = rssiFrom2Digits(wifi.substring(40, 42));

            } else {
                decoded.warning = "WiFi payload shorter than expected (len=" + wifi.length + ")";
            }
            break;
        }


        // ======================================================
        // PORT 5 → BATTERY percentage (ASCII float)
        // ======================================================
        case 5:
            if (!isNaN(value)) {
                decoded.battery_percent = value;
                decoded.raw_text        = text;
                decoded.sensor_type     = "Battery";
            } else {
                decoded.error = "Invalid battery format on FPort 5.";
            }
            break;


        // ======================================================
        // PORT 6 → GNSS raw ASCII string (e.g., "G4512345612345678")
        // The decoder just passes it through to the application.
        // ======================================================
        case 6:
            decoded.gnss_raw    = text;
            decoded.sensor_type = "GNSS";
            break;


        // ======================================================
        // Unknown FPort → return an error
        // ======================================================
        default:
            decoded.error = "Unknown or unused FPort: " + port;
    }

    // TTN expects this structure
    return {
        data: decoded,
        warnings: []
    };
}
# Installing zwave-js-otel on Home Assistant

This guide covers installing the plugin on a Home Assistant instance running the [Z-Wave JS UI add-on](https://github.com/hassio-addons/addon-zwave-js-ui).

## Prerequisites

- Home Assistant with the Z-Wave JS UI add-on installed
- A way to copy files to your HA instance ([Samba](https://github.com/home-assistant/addons/tree/master/samba), [SSH](https://github.com/hassio-addons/addon-ssh), or [File Editor](https://github.com/home-assistant/addons/tree/master/configurator))
- A Grafana Cloud account (or any OTLP-compatible collector)

## Step 1: Install the plugin

The plugin ships as a single pre-bundled file (`bundle.mjs`, ~1.4 MB) — no npm or node_modules needed.

The Z-Wave JS UI add-on mounts the HA `/share` directory at `/share` inside the container. This is the easiest place to put the plugin since it's accessible from any add-on and from Samba.

**Option A: Via Samba**

1. Open the `share` folder on your network (`\\homeassistant\share`)
2. Create a `zwave-js-otel` folder
3. Download `bundle.mjs` from the [latest release](https://github.com/bobcob7/zwave-js-otel/releases) and copy it in

**Option B: Via SSH**

```bash
mkdir -p /share/zwave-js-otel
curl -fsSL https://github.com/bobcob7/zwave-js-otel/releases/latest/download/bundle.mjs \
  -o /share/zwave-js-otel/bundle.mjs
```

## Step 2: Configure the OTLP exporter

Create `otel.json` in the same folder as the bundle:

**Via Samba:** Create the file at `\\homeassistant\share\zwave-js-otel\otel.json`

**Via SSH:**
```bash
cat > /share/zwave-js-otel/otel.json << 'EOF'
{
  "endpoint": "https://otlp-gateway-prod-us-east-0.grafana.net/otlp",
  "headers": {
    "Authorization": "Basic YOUR_BASE64_CREDENTIALS"
  },
  "metricExportIntervalMs": 60000
}
EOF
```

The plugin looks for `otel.json` next to the bundle file first, then falls back to the zwave-js-ui store directory (`/data/store/otel.json`).

### Getting your Grafana Cloud credentials

1. Go to [Grafana Cloud Portal](https://grafana.com) and select your stack
2. Navigate to **Connections** > **OpenTelemetry (OTLP)**
3. Note your **OTLP endpoint URL** and **Instance ID**
4. Generate an API token with **MetricsPublisher**, **TracesPublisher**, and **LogsPublisher** roles

Build the `Authorization` header value:

```bash
echo -n "INSTANCE_ID:API_TOKEN" | base64
```

Replace `YOUR_BASE64_CREDENTIALS` in `otel.json` with the output.

### Config file reference

| Field | Description | Default |
|---|---|---|
| `endpoint` | OTLP collector base URL | `http://localhost:4318` |
| `serviceName` | Service name in telemetry data | `zwave-js-ui` |
| `headers` | HTTP headers sent with every export | `{}` |
| `metricExportIntervalMs` | How often metrics are exported (ms) | `60000` |

## Step 3: Enable the plugin in Z-Wave JS UI

1. Open the Z-Wave JS UI web interface
2. Go to **Settings** > **General**
3. In the **Plugins** field, add:
   ```
   /share/zwave-js-otel/bundle.mjs
   ```
4. Click **Save** and restart the add-on

## Step 4: Verify

After restarting, check the Z-Wave JS UI logs for:

```
zwave-js-otel plugin initialized
```

In Grafana Cloud, you should see:

- **Metrics** in Grafana Cloud Metrics (Prometheus): `zwave_node_count`, `zwave_value_changes`, `zwave_controller_messages_tx`, etc.
- **Traces** in Grafana Cloud Traces (Tempo): spans for inclusion/exclusion and node interviews
- **Logs** in Grafana Cloud Logs (Loki): node status changes, driver events

## Troubleshooting

### Plugin not loading

Verify the file exists from SSH:

```bash
ls -la /share/zwave-js-otel/bundle.mjs
```

### No data in Grafana Cloud

1. Verify `otel.json` is valid JSON:
   ```bash
   cat /share/zwave-js-otel/otel.json | python3 -m json.tool
   ```
2. Check that your API token has the correct roles (MetricsPublisher, TracesPublisher, LogsPublisher)
3. Check the endpoint region matches your Grafana Cloud stack

## Updating the plugin

Replace `bundle.mjs` with the new version and restart the add-on:

**Via SSH:**
```bash
curl -fsSL https://github.com/bobcob7/zwave-js-otel/releases/latest/download/bundle.mjs \
  -o /share/zwave-js-otel/bundle.mjs
```

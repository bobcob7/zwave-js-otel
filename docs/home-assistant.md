# Installing zwave-js-otel on Home Assistant

This guide covers installing the plugin on a Home Assistant instance running the [Z-Wave JS UI add-on](https://github.com/hassio-addons/addon-zwave-js-ui).

## Prerequisites

- Home Assistant with the Z-Wave JS UI add-on installed
- [Advanced SSH & Web Terminal](https://github.com/hassio-addons/addon-ssh) add-on (with "Protection mode" disabled)
- A Grafana Cloud account (or any OTLP-compatible collector)

## Step 1: Install the plugin

The plugin ships as a single pre-bundled file (`bundle.mjs`) — no npm or node_modules needed on the target machine.

Download the bundle from the [latest release](https://github.com/bobcob7/zwave-js-otel/releases) and copy it to the add-on's persistent store directory.

From the Advanced SSH & Web Terminal:

```bash
# Create the plugin directory
docker exec $(docker ps -qf "name=zwave") mkdir -p /data/store/plugins/zwave-js-otel

# Download the bundle into the container
curl -fsSL https://github.com/bobcob7/zwave-js-otel/releases/latest/download/bundle.mjs \
  | docker exec -i $(docker ps -qf "name=zwave") sh -c 'cat > /data/store/plugins/zwave-js-otel/bundle.mjs'
```

That's it — one 1.4 MB file, no dependencies to install. The file persists across add-on restarts and updates.

## Step 2: Configure the OTLP exporter

Create the config file at `/data/store/otel.json`:

```bash
docker exec -i $(docker ps -qf "name=zwave") sh -c 'cat > /data/store/otel.json' << 'EOF'
{
  "endpoint": "https://otlp-gateway-prod-us-east-0.grafana.net/otlp",
  "headers": {
    "Authorization": "Basic YOUR_BASE64_CREDENTIALS"
  },
  "metricExportIntervalMs": 60000
}
EOF
```

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
   /data/store/plugins/zwave-js-otel/bundle.mjs
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

Check the file exists:

```bash
docker exec $(docker ps -qf "name=zwave") ls -la /data/store/plugins/zwave-js-otel/bundle.mjs
```

### No data in Grafana Cloud

1. Verify `otel.json` is valid JSON:
   ```bash
   docker exec $(docker ps -qf "name=zwave") cat /data/store/otel.json
   ```
2. Check that your API token has the correct roles (MetricsPublisher, TracesPublisher, LogsPublisher)
3. Check the endpoint region matches your Grafana Cloud stack

## Updating the plugin

Download the new bundle and restart:

```bash
curl -fsSL https://github.com/bobcob7/zwave-js-otel/releases/latest/download/bundle.mjs \
  | docker exec -i $(docker ps -qf "name=zwave") sh -c 'cat > /data/store/plugins/zwave-js-otel/bundle.mjs'
```

Restart the add-on after updating.

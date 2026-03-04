# Installing zwave-js-otel on Home Assistant

This guide covers installing the plugin on a Home Assistant instance running the [Z-Wave JS UI add-on](https://github.com/hassio-addons/addon-zwave-js-ui).

## Prerequisites

- Home Assistant with the Z-Wave JS UI add-on installed
- [Advanced SSH & Web Terminal](https://github.com/hassio-addons/addon-ssh) add-on (with "Protection mode" disabled)
- A Grafana Cloud account (or any OTLP-compatible collector)

## Step 1: Install the plugin

Open the Advanced SSH & Web Terminal and run:

```bash
# Get a shell inside the Z-Wave JS UI container
docker exec -it $(docker ps -qf "name=zwave") sh

# Install npm (removed from the add-on image by default)
apk add --no-cache npm

# Install the plugin into the persistent store directory
cd /data/store
mkdir -p plugins
cd plugins
npm init -y
npm install zwave-js-otel
```

> **Note:** The `apk add npm` step is needed because the HA add-on strips npm
> from the image. This is temporary — npm will be gone again on the next
> add-on update, but the installed plugin in `/data/store/plugins` persists.
> Re-run `apk add npm && npm install` after add-on updates if the plugin
> stops loading.

## Step 2: Configure the OTLP exporter

Create the config file at `/data/store/otel.json`. From the same shell:

```bash
cat > /data/store/otel.json << 'EOF'
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
   /data/store/plugins/node_modules/zwave-js-otel
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

Check the plugin path is correct. From SSH:

```bash
docker exec -it $(docker ps -qf "name=zwave") ls /data/store/plugins/node_modules/zwave-js-otel/dist/
```

You should see `index.js` and other `.js` files.

### No data in Grafana Cloud

1. Verify `otel.json` is valid JSON:
   ```bash
   docker exec -it $(docker ps -qf "name=zwave") cat /data/store/otel.json
   ```
2. Check that your API token has the correct roles (MetricsPublisher, TracesPublisher, LogsPublisher)
3. Check the endpoint region matches your Grafana Cloud stack

### Plugin disappears after add-on update

The plugin files in `/data/store/plugins` persist, but npm is removed on update. If the plugin fails to load after an update, get a shell and reinstall:

```bash
docker exec -it $(docker ps -qf "name=zwave") sh -c "apk add --no-cache npm && cd /data/store/plugins && npm install"
```

Then restart the add-on.

## Updating the plugin

```bash
docker exec -it $(docker ps -qf "name=zwave") sh -c "apk add --no-cache npm && cd /data/store/plugins && npm update zwave-js-otel"
```

Restart the add-on after updating.

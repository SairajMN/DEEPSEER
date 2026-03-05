const marketAddress = args[0];
if (!marketAddress) {
  throw Error("missing market address arg");
}

const endpoint = secrets.RISK_API_URL;
const apiKey = secrets.RISK_API_KEY;

if (!endpoint) {
  throw Error("missing secret RISK_API_URL");
}
if (!apiKey) {
  throw Error("missing secret RISK_API_KEY");
}

const request = Functions.makeHttpRequest({
  url: endpoint,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey
  },
  data: {
    market_address: marketAddress,
    external_price: "0",
    external_timestamp: Math.floor(Date.now() / 1000),
    source_payload_hash: "0x0",
    deterministic: true
  },
  timeout: 9000
});

const response = await request;
if (response.error) {
  throw Error(`risk API request failed: ${JSON.stringify(response.error)}`);
}

const body = response.data;
if (
  typeof body.confidence_score !== "number" ||
  typeof body.source_consensus !== "number" ||
  typeof body.anomaly_flag !== "boolean"
) {
  throw Error("invalid risk API response shape");
}

const confidence = BigInt(body.confidence_score);
const anomaly = body.anomaly_flag ? 1n : 0n;
const consensus = BigInt(body.source_consensus);

const packed = confidence | (anomaly << 16n) | (consensus << 17n);
return Functions.encodeUint256(packed);

import {
  bytesToHex,
  cre,
  EVMLog,
  getNetwork,
  Runner,
  Runtime,
} from "@chainlink/cre-sdk";
import { decodeEventLog, keccak256, parseAbi, toHex } from "viem";

import { fetchExternalData } from "./externalData";
import { submitSettlementReport } from "./evm";
import { fetchRiskScore } from "./risk";
import { configSchema, type Config } from "./types";

const eventAbi = parseAbi([
  "event ResolutionWindowOpenedByEngine(address indexed market)",
]);

const triggerSignature = "ResolutionWindowOpenedByEngine(address)";

function handleResolutionTrigger(runtime: Runtime<Config>, log: EVMLog): string {
  const topics = log.topics.map(topic => bytesToHex(topic)) as [
    `0x${string}`,
    ...`0x${string}`[],
  ];
  const data = bytesToHex(log.data);

  const decoded = decodeEventLog({
    abi: eventAbi,
    data,
    topics,
  });

  const marketAddress = decoded.args.market as `0x${string}`;
  runtime.log(`Resolution trigger received for market ${marketAddress}`);

  const externalData = fetchExternalData(runtime);
  runtime.log(
    `External data fetched. price=${externalData.externalPrice.toString()} timestamp=${externalData.externalTimestamp.toString()}`,
  );

  const riskResponse = fetchRiskScore(runtime, marketAddress, externalData);
  runtime.log(
    `Risk score received. confidence=${riskResponse.confidence_score} anomaly=${riskResponse.anomaly_flag} consensus=${riskResponse.source_consensus}`,
  );

  const txHash = submitSettlementReport(runtime, marketAddress, externalData, riskResponse);
  runtime.log(`Settlement report submitted: ${txHash}`);

  return txHash;
}

function initWorkflow(config: Config) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: config.evm.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Unknown network: ${config.evm.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const topic = keccak256(toHex(triggerSignature));

  return [
    cre.handler(
      evmClient.logTrigger({
        addresses: [config.evm.settlementEngineAddress],
        topics: [{ values: [topic] }],
        confidence: "CONFIDENCE_LEVEL_FINALIZED",
      }),
      handleResolutionTrigger,
    ),
  ];
}

export async function main() {
  const runner = await Runner.newRunner<Config>({ configSchema });
  await runner.run(initWorkflow);
}

main();

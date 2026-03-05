import {
  bytesToHex,
  cre,
  getNetwork,
  hexToBase64,
  type Runtime,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters } from "viem";

import { type Config, type ExternalDataResult, type RiskResponse } from "./types";

export function submitSettlementReport(
  runtime: Runtime<Config>,
  marketAddress: string,
  externalData: ExternalDataResult,
  risk: RiskResponse,
): string {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evm.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Unknown network: ${runtime.config.evm.chainSelectorName}`);
  }

  const evmClient = new cre.capabilities.EVMClient(network.chainSelector.selector);

  const reportData = encodeAbiParameters(
    parseAbiParameters(
      "address market, int256 externalPrice, uint64 externalPriceTimestamp, uint16 confidenceScore, bool anomalyFlag, uint16 sourceConsensus, bytes32 evidenceHash",
    ),
    [
      marketAddress as `0x${string}`,
      externalData.externalPrice,
      externalData.externalTimestamp,
      risk.confidence_score,
      risk.anomaly_flag,
      risk.source_consensus,
      risk.evidence_hash as `0x${string}`,
    ],
  );

  const signedReport = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.evm.settlementEngineAddress,
      report: signedReport,
      gasConfig: {
        gasLimit: runtime.config.evm.gasLimit,
      },
    })
    .result();

  return bytesToHex(writeResult.txHash ?? new Uint8Array(32));
}

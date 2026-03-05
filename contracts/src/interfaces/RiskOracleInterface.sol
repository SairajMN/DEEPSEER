// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface RiskOracleInterface {
    struct RiskAssessment {
        uint16 confidenceScore; // 0-10000
        bool anomalyFlag;
        uint16 sourceConsensus; // 0-10000
        bytes32 evidenceHash;
        uint64 evaluatedAt;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {RiskOracleInterface} from "./RiskOracleInterface.sol";

interface IPredictionMarket {
    enum Phase {
        Trading,
        Locked,
        Resolved,
        Cancelled
    }

    function phase() external view returns (Phase);
    function lockTimestamp() external view returns (uint64);
    function expiryTimestamp() external view returns (uint64);
    function resolutionRequested() external view returns (bool);
    function lockRound() external;
    function openResolutionWindow() external;
    function resolveMarket(
        RiskOracleInterface.RiskAssessment calldata assessment,
        int256 externalPrice,
        uint64 externalPriceTimestamp
    ) external;
}

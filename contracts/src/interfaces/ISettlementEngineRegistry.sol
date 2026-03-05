// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ISettlementEngineRegistry {
    function registerMarket(address market) external;
}

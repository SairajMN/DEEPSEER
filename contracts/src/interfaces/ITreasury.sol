// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITreasury {
    function collateralToken() external view returns (address);
    function protocolFeeBps() external view returns (uint16);
    function addMarket(address market) external;
    function escrowStake(address payer, uint256 amount) external;
    function payout(address recipient, uint256 grossAmount, uint256 feeAmount) external;
    function refund(address recipient, uint256 amount) external;
}

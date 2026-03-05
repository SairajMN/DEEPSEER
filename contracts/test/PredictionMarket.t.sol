// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {PredictionMarket} from "../src/PredictionMarket.sol";
import {Treasury} from "../src/Treasury.sol";
import {RiskOracleInterface} from "../src/interfaces/RiskOracleInterface.sol";
import {IPredictionMarket} from "../src/interfaces/IPredictionMarket.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockAggregator {
    int256 public answer;
    uint80 public roundId;
    uint256 public updatedAt;

    function setAnswer(int256 newAnswer) external {
        roundId += 1;
        answer = newAnswer;
        updatedAt = block.timestamp;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (roundId, answer, updatedAt, updatedAt, roundId);
    }
}

contract PredictionMarketTest is Test {
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    MockERC20 internal token;
    MockAggregator internal feed;
    Treasury internal treasury;
    PredictionMarket internal market;

    function setUp() external {
        token = new MockERC20();
        feed = new MockAggregator();
        feed.setAnswer(2000e8);

        treasury = new Treasury(address(this), address(this), address(this), address(token), 200);

        PredictionMarket.InitParams memory init = PredictionMarket.InitParams({
            admin: address(this),
            pauser: address(this),
            settlementEngine: address(this),
            treasury: address(treasury),
            priceFeed: address(feed),
            marketQuestion: "BTC/USD closes above lock price",
            lockTimestamp: uint64(block.timestamp + 10 minutes),
            expiryTimestamp: uint64(block.timestamp + 20 minutes),
            maxOracleDelay: 1 hours,
            minBetLeadTime: 30 seconds,
            minBetAmount: 1e18,
            minConfidenceScore: 6_000,
            minSourceConsensus: 6_000,
            maxExternalDeviationBps: 300
        });

        market = new PredictionMarket(init);
        treasury.addMarket(address(market));

        token.mint(alice, 200e18);
        token.mint(bob, 200e18);

        vm.startPrank(alice);
        token.approve(address(treasury), type(uint256).max);
        market.placeBet(PredictionMarket.Side.Bull, 100e18);
        vm.stopPrank();

        vm.startPrank(bob);
        token.approve(address(treasury), type(uint256).max);
        market.placeBet(PredictionMarket.Side.Bear, 100e18);
        vm.stopPrank();
    }

    function testResolveBullAndClaim() external {
        vm.warp(block.timestamp + 11 minutes);
        market.lockRound();

        vm.warp(block.timestamp + 10 minutes);
        feed.setAnswer(2100e8);
        market.openResolutionWindow();

        RiskOracleInterface.RiskAssessment memory assessment = RiskOracleInterface.RiskAssessment({
            confidenceScore: 9_000,
            anomalyFlag: false,
            sourceConsensus: 9_100,
            evidenceHash: keccak256("ok"),
            evaluatedAt: uint64(block.timestamp)
        });

        market.resolveMarket(assessment, 2100e8, uint64(block.timestamp));

        vm.startPrank(alice);
        market.claim();
        vm.stopPrank();

        assertEq(token.balanceOf(alice), 298e18);
        assertEq(uint8(market.phase()), uint8(IPredictionMarket.Phase.Resolved));
    }

    function testCancellationRefundPath() external {
        vm.warp(block.timestamp + 11 minutes);
        market.lockRound();

        vm.warp(block.timestamp + 10 minutes);
        feed.setAnswer(2000e8);
        market.openResolutionWindow();

        RiskOracleInterface.RiskAssessment memory assessment = RiskOracleInterface.RiskAssessment({
            confidenceScore: 7_000,
            anomalyFlag: true,
            sourceConsensus: 8_000,
            evidenceHash: keccak256("anomaly"),
            evaluatedAt: uint64(block.timestamp)
        });

        market.resolveMarket(assessment, 0, 0);

        vm.prank(alice);
        market.claim();

        vm.prank(bob);
        market.claim();

        assertEq(token.balanceOf(alice), 200e18);
        assertEq(token.balanceOf(bob), 200e18);
        assertEq(uint8(market.phase()), uint8(IPredictionMarket.Phase.Cancelled));
    }
}

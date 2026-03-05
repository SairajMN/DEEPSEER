// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/interfaces/AutomationCompatibleInterface.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";

import {IPredictionMarket} from "./interfaces/IPredictionMarket.sol";
import {ISettlementEngineRegistry} from "./interfaces/ISettlementEngineRegistry.sol";
import {RiskOracleInterface} from "./interfaces/RiskOracleInterface.sol";

contract SettlementEngine is
    AccessControl,
    Pausable,
    ReentrancyGuard,
    FunctionsClient,
    AutomationCompatibleInterface,
    ISettlementEngineRegistry
{
    using FunctionsRequest for FunctionsRequest.Request;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");
    bytes32 public constant CONFIG_ROLE = keccak256("CONFIG_ROLE");

    enum Action {
        None,
        LockRound,
        OpenResolution
    }

    struct FunctionsRiskReport {
        bytes32 requestId;
        bool pending;
        bool fulfilled;
        bool hadError;
        uint16 confidenceScore;
        bool anomalyFlag;
        uint16 sourceConsensus;
        uint64 receivedAt;
    }

    struct CreRiskReport {
        bool delivered;
        int256 externalPrice;
        uint64 externalPriceTimestamp;
        uint16 confidenceScore;
        bool anomalyFlag;
        uint16 sourceConsensus;
        bytes32 evidenceHash;
        uint64 receivedAt;
    }

    struct MarketResolutionStatus {
        bool finalized;
    }

    error InvalidAddress();
    error InvalidConfig();
    error MarketAlreadyRegistered(address market);
    error MarketNotRegistered(address market);
    error InvalidAction();
    error FunctionsSourceNotSet();
    error RequestAlreadyPending(address market, bytes32 requestId);
    error UnknownRequest(bytes32 requestId);
    error UnauthorizedForwarder(address caller, address expected);
    error UnexpectedWorkflowId(bytes32 workflowId, bytes32 expectedWorkflowId);
    error UnexpectedWorkflowOwner(address workflowOwner, address expectedWorkflowOwner);
    error UnexpectedWorkflowName(bytes10 workflowName, bytes10 expectedWorkflowName);
    error ResolutionAlreadyFinalized(address market);

    event MarketRegistered(address indexed market);
    event UpkeepActionQueued(Action indexed action, address indexed market);
    event MarketLockedByEngine(address indexed market);
    event ResolutionWindowOpenedByEngine(address indexed market);

    event FunctionsRiskRequested(address indexed market, bytes32 indexed requestId);
    event FunctionsRiskFulfilled(
        address indexed market,
        bytes32 indexed requestId,
        uint16 confidenceScore,
        bool anomalyFlag,
        uint16 sourceConsensus
    );
    event FunctionsRiskFailed(address indexed market, bytes32 indexed requestId, bytes errorData);

    event CreReportReceived(
        address indexed market,
        int256 externalPrice,
        uint64 externalPriceTimestamp,
        uint16 confidenceScore,
        bool anomalyFlag,
        uint16 sourceConsensus,
        bytes32 evidenceHash
    );

    event MarketResolvedByEngine(
        address indexed market,
        uint16 mergedConfidence,
        bool mergedAnomaly,
        uint16 mergedConsensus,
        bytes32 mergedEvidenceHash
    );

    event FunctionsConfigUpdated(
        uint64 subscriptionId,
        bytes32 donId,
        uint32 callbackGasLimit,
        uint32 maxMarketsPerCheck,
        uint64 functionsGracePeriod
    );
    event FunctionsSourceUpdated(bytes32 indexed sourceHash);
    event EncryptedSecretsReferenceUpdated(bytes32 indexed referenceHash);
    event CreConfigUpdated(address indexed forwarder, bytes32 indexed workflowId, address workflowOwner, bytes10 workflowName);

    address[] public trackedMarkets;
    mapping(address market => bool) public isTracked;
    mapping(address market => MarketResolutionStatus) public marketStatus;

    mapping(address market => FunctionsRiskReport) public functionsReports;
    mapping(address market => CreRiskReport) public creReports;

    mapping(bytes32 requestId => address market) public requestToMarket;

    uint256 public upkeepCursor;

    uint64 public functionsSubscriptionId;
    bytes32 public functionsDonId;
    uint32 public functionsCallbackGasLimit;
    uint32 public maxMarketsPerCheck;
    uint64 public functionsGracePeriod;

    string public functionsSource;
    bytes public encryptedSecretsReference;

    address public creForwarder;
    bytes32 public expectedWorkflowId;
    address public expectedWorkflowOwner;
    bytes10 public expectedWorkflowName;

    constructor(
        address admin,
        address pauser,
        address factory,
        address functionsRouter,
        address forwarder,
        bytes32 workflowId,
        uint64 subscriptionId,
        bytes32 donId,
        uint32 callbackGasLimit,
        uint32 maxMarketsPerCheck_
    ) FunctionsClient(functionsRouter) {
        if (
            admin == address(0) || pauser == address(0) || factory == address(0) || functionsRouter == address(0)
                || forwarder == address(0)
        ) revert InvalidAddress();
        if (callbackGasLimit == 0 || maxMarketsPerCheck_ == 0) revert InvalidConfig();

        creForwarder = forwarder;
        expectedWorkflowId = workflowId;

        functionsSubscriptionId = subscriptionId;
        functionsDonId = donId;
        functionsCallbackGasLimit = callbackGasLimit;
        maxMarketsPerCheck = maxMarketsPerCheck_;
        functionsGracePeriod = 30 minutes;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PAUSER_ROLE, pauser);
        _grantRole(FACTORY_ROLE, factory);
        _grantRole(CONFIG_ROLE, admin);
    }

    function registerMarket(address market) external override onlyRole(FACTORY_ROLE) {
        if (market == address(0)) revert InvalidAddress();
        if (isTracked[market]) revert MarketAlreadyRegistered(market);

        isTracked[market] = true;
        trackedMarkets.push(market);
        emit MarketRegistered(market);
    }

    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256 totalMarkets = trackedMarkets.length;
        if (totalMarkets == 0) return (false, bytes(""));

        uint256 checked;
        uint256 cursor = upkeepCursor;

        while (checked < totalMarkets && checked < maxMarketsPerCheck) {
            address market = trackedMarkets[cursor];
            if (!marketStatus[market].finalized) {
                IPredictionMarket m = IPredictionMarket(market);
                IPredictionMarket.Phase currentPhase = m.phase();

                if (currentPhase == IPredictionMarket.Phase.Trading && block.timestamp >= m.lockTimestamp()) {
                    return (true, abi.encode(Action.LockRound, market, _nextCursor(cursor, totalMarkets)));
                }

                if (
                    currentPhase == IPredictionMarket.Phase.Locked && block.timestamp >= m.expiryTimestamp()
                        && !m.resolutionRequested()
                ) {
                    return (true, abi.encode(Action.OpenResolution, market, _nextCursor(cursor, totalMarkets)));
                }
            }

            cursor = _nextCursor(cursor, totalMarkets);
            unchecked {
                ++checked;
            }
        }

        return (false, bytes(""));
    }

    function performUpkeep(bytes calldata performData) external override whenNotPaused nonReentrant {
        (Action action, address market, uint256 nextCursor) = abi.decode(performData, (Action, address, uint256));
        if (!isTracked[market]) revert MarketNotRegistered(market);
        if (action == Action.None) revert InvalidAction();

        upkeepCursor = nextCursor;
        emit UpkeepActionQueued(action, market);

        if (action == Action.LockRound) {
            _performLockRound(market);
            return;
        }

        if (action == Action.OpenResolution) {
            _performOpenResolution(market);
            return;
        }

        revert InvalidAction();
    }

    function requestFunctionsRisk(address market) external onlyRole(CONFIG_ROLE) {
        if (!isTracked[market]) revert MarketNotRegistered(market);
        _requestFunctionsRisk(market);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external whenNotPaused nonReentrant {
        if (msg.sender != creForwarder) revert UnauthorizedForwarder(msg.sender, creForwarder);

        (bytes32 workflowId, bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);

        if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) {
            revert UnexpectedWorkflowId(workflowId, expectedWorkflowId);
        }
        if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
            revert UnexpectedWorkflowOwner(workflowOwner, expectedWorkflowOwner);
        }
        if (expectedWorkflowName != bytes10(0) && workflowName != expectedWorkflowName) {
            revert UnexpectedWorkflowName(workflowName, expectedWorkflowName);
        }

        (
            address market,
            int256 externalPrice,
            uint64 externalPriceTimestamp,
            uint16 confidenceScore,
            bool anomalyFlag,
            uint16 sourceConsensus,
            bytes32 evidenceHash
        ) = abi.decode(report, (address, int256, uint64, uint16, bool, uint16, bytes32));

        if (!isTracked[market]) revert MarketNotRegistered(market);
        if (marketStatus[market].finalized) revert ResolutionAlreadyFinalized(market);

        CreRiskReport storage creReport = creReports[market];
        creReport.delivered = true;
        creReport.externalPrice = externalPrice;
        creReport.externalPriceTimestamp = externalPriceTimestamp;
        creReport.confidenceScore = confidenceScore;
        creReport.anomalyFlag = anomalyFlag;
        creReport.sourceConsensus = sourceConsensus;
        creReport.evidenceHash = evidenceHash;
        creReport.receivedAt = uint64(block.timestamp);

        emit CreReportReceived(
            market,
            externalPrice,
            externalPriceTimestamp,
            confidenceScore,
            anomalyFlag,
            sourceConsensus,
            evidenceHash
        );

        _finalizeIfReady(market);
    }

    function setFunctionsConfig(
        uint64 subscriptionId,
        bytes32 donId,
        uint32 callbackGasLimit,
        uint32 maxMarketsPerCheck_,
        uint64 functionsGracePeriod_
    ) external onlyRole(CONFIG_ROLE) {
        if (callbackGasLimit == 0 || maxMarketsPerCheck_ == 0) revert InvalidConfig();

        functionsSubscriptionId = subscriptionId;
        functionsDonId = donId;
        functionsCallbackGasLimit = callbackGasLimit;
        maxMarketsPerCheck = maxMarketsPerCheck_;
        functionsGracePeriod = functionsGracePeriod_;

        emit FunctionsConfigUpdated(subscriptionId, donId, callbackGasLimit, maxMarketsPerCheck_, functionsGracePeriod_);
    }

    function setFunctionsSource(string calldata source) external onlyRole(CONFIG_ROLE) {
        if (bytes(source).length == 0) revert FunctionsSourceNotSet();
        functionsSource = source;
        emit FunctionsSourceUpdated(keccak256(bytes(source)));
    }

    function setEncryptedSecretsReference(bytes calldata encryptedRef) external onlyRole(CONFIG_ROLE) {
        encryptedSecretsReference = encryptedRef;
        emit EncryptedSecretsReferenceUpdated(keccak256(encryptedRef));
    }

    function setCreConfig(address forwarder, bytes32 workflowId, address workflowOwner, bytes10 workflowName)
        external
        onlyRole(CONFIG_ROLE)
    {
        if (forwarder == address(0)) revert InvalidAddress();
        creForwarder = forwarder;
        expectedWorkflowId = workflowId;
        expectedWorkflowOwner = workflowOwner;
        expectedWorkflowName = workflowName;

        emit CreConfigUpdated(forwarder, workflowId, workflowOwner, workflowName);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function trackedMarketsLength() external view returns (uint256) {
        return trackedMarkets.length;
    }

    function _performLockRound(address market) internal {
        IPredictionMarket m = IPredictionMarket(market);
        if (m.phase() != IPredictionMarket.Phase.Trading || block.timestamp < m.lockTimestamp()) return;

        m.lockRound();
        emit MarketLockedByEngine(market);
    }

    function _performOpenResolution(address market) internal {
        IPredictionMarket m = IPredictionMarket(market);
        if (m.phase() != IPredictionMarket.Phase.Locked || block.timestamp < m.expiryTimestamp() || m.resolutionRequested()) {
            return;
        }

        m.openResolutionWindow();
        emit ResolutionWindowOpenedByEngine(market);

        _requestFunctionsRisk(market);
    }

    function _requestFunctionsRisk(address market) internal {
        if (bytes(functionsSource).length == 0) revert FunctionsSourceNotSet();
        if (marketStatus[market].finalized) revert ResolutionAlreadyFinalized(market);

        FunctionsRiskReport storage currentReport = functionsReports[market];
        if (currentReport.pending) revert RequestAlreadyPending(market, currentReport.requestId);

        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(functionsSource);

        if (encryptedSecretsReference.length > 0) {
            req.addSecretsReference(encryptedSecretsReference);
        }

        string[] memory args = new string[](1);
        args[0] = Strings.toHexString(uint256(uint160(market)), 20);
        req.setArgs(args);

        bytes32 requestId = _sendRequest(req.encodeCBOR(), functionsSubscriptionId, functionsCallbackGasLimit, functionsDonId);

        currentReport.requestId = requestId;
        currentReport.pending = true;
        currentReport.fulfilled = false;
        currentReport.hadError = false;

        requestToMarket[requestId] = market;
        emit FunctionsRiskRequested(market, requestId);
    }

    function fulfillRequest(bytes32 requestId, bytes memory response, bytes memory err) internal override {
        address market = requestToMarket[requestId];
        if (market == address(0)) revert UnknownRequest(requestId);

        FunctionsRiskReport storage report = functionsReports[market];
        report.pending = false;
        report.receivedAt = uint64(block.timestamp);

        if (err.length > 0) {
            report.hadError = true;
            emit FunctionsRiskFailed(market, requestId, err);
            _finalizeIfReady(market);
            return;
        }

        uint256 packed = abi.decode(response, (uint256));
        report.fulfilled = true;
        report.confidenceScore = uint16(packed & 0xFFFF);
        report.anomalyFlag = ((packed >> 16) & 1) == 1;
        report.sourceConsensus = uint16((packed >> 17) & 0xFFFF);

        emit FunctionsRiskFulfilled(
            market,
            requestId,
            report.confidenceScore,
            report.anomalyFlag,
            report.sourceConsensus
        );

        _finalizeIfReady(market);
    }

    function _finalizeIfReady(address market) internal {
        if (marketStatus[market].finalized) return;

        CreRiskReport memory creReport = creReports[market];
        if (!creReport.delivered) return;

        FunctionsRiskReport memory functionsReport = functionsReports[market];
        bool functionsTimedOut =
            functionsReport.pending && block.timestamp >= IPredictionMarket(market).expiryTimestamp() + functionsGracePeriod;
        bool functionsUnavailable = functionsReport.hadError || functionsTimedOut;

        if (!functionsReport.fulfilled && !functionsUnavailable) {
            return;
        }

        uint16 mergedConfidence;
        uint16 mergedConsensus;
        bool mergedAnomaly;

        if (functionsReport.fulfilled) {
            mergedConfidence = _min(creReport.confidenceScore, functionsReport.confidenceScore);
            mergedConsensus = _min(creReport.sourceConsensus, functionsReport.sourceConsensus);
            mergedAnomaly = creReport.anomalyFlag || functionsReport.anomalyFlag;
        } else {
            // Fail-safe behavior: if Functions failed/timed out, we prefer cancellation over uncertain resolution.
            mergedConfidence = creReport.confidenceScore;
            mergedConsensus = creReport.sourceConsensus;
            mergedAnomaly = true;
        }

        RiskOracleInterface.RiskAssessment memory assessment = RiskOracleInterface.RiskAssessment({
            confidenceScore: mergedConfidence,
            anomalyFlag: mergedAnomaly,
            sourceConsensus: mergedConsensus,
            evidenceHash: keccak256(abi.encode(creReport.evidenceHash, functionsReport.requestId, market, block.chainid)),
            evaluatedAt: uint64(block.timestamp)
        });

        IPredictionMarket(market).resolveMarket(assessment, creReport.externalPrice, creReport.externalPriceTimestamp);
        marketStatus[market].finalized = true;

        emit MarketResolvedByEngine(market, mergedConfidence, mergedAnomaly, mergedConsensus, assessment.evidenceHash);
    }

    function _nextCursor(uint256 cursor, uint256 totalMarkets) internal pure returns (uint256) {
        if (totalMarkets == 0) return 0;
        uint256 next = cursor + 1;
        return next >= totalMarkets ? 0 : next;
    }

    function _decodeMetadata(bytes memory metadata)
        internal
        pure
        returns (bytes32 workflowId, bytes10 workflowName, address workflowOwner)
    {
        assembly {
            workflowId := mload(add(metadata, 32))
            workflowName := mload(add(metadata, 64))
            workflowOwner := shr(96, mload(add(metadata, 74)))
        }
    }

    function _min(uint16 a, uint16 b) internal pure returns (uint16) {
        return a <= b ? a : b;
    }
}

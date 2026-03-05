// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";

import {Treasury} from "../src/Treasury.sol";
import {SettlementEngine} from "../src/SettlementEngine.sol";
import {PredictionMarketFactory} from "../src/PredictionMarketFactory.sol";

contract DeployDeepseer is Script {
    struct DeployConfig {
        uint256 deployerPrivateKey;
        address admin;
        address pauser;
        address treasurer;
        address creator;
        address collateral;
        address functionsRouter;
        address creForwarder;
        bytes32 expectedWorkflowId;
        uint64 functionsSubscriptionId;
        bytes32 functionsDonId;
        uint32 functionsCallbackGasLimit;
        uint32 maxMarketsPerCheck;
        uint16 protocolFeeBps;
        string functionsSource;
        string functionsSourceFile;
    }

    function run() external {
        DeployConfig memory cfg = _loadConfig();

        vm.startBroadcast(cfg.deployerPrivateKey);

        Treasury treasury = new Treasury(cfg.admin, cfg.pauser, cfg.treasurer, cfg.collateral, cfg.protocolFeeBps);

        // Bootstrap with admin as temporary FACTORY_ROLE holder, then transfer role to the deployed factory.
        SettlementEngine settlementEngine = new SettlementEngine(
            cfg.admin,
            cfg.pauser,
            cfg.admin,
            cfg.functionsRouter,
            cfg.creForwarder,
            cfg.expectedWorkflowId,
            cfg.functionsSubscriptionId,
            cfg.functionsDonId,
            cfg.functionsCallbackGasLimit,
            cfg.maxMarketsPerCheck
        );

        PredictionMarketFactory factory =
            new PredictionMarketFactory(cfg.admin, cfg.creator, cfg.pauser, address(treasury), address(settlementEngine));

        settlementEngine.grantRole(settlementEngine.FACTORY_ROLE(), address(factory));
        treasury.grantRole(treasury.MARKET_MANAGER_ROLE(), address(factory));

        if (bytes(cfg.functionsSource).length > 0) {
            settlementEngine.setFunctionsSource(cfg.functionsSource);
        }

        vm.stopBroadcast();

        console2.log("Treasury:", address(treasury));
        console2.log("SettlementEngine:", address(settlementEngine));
        console2.log("PredictionMarketFactory:", address(factory));
    }

    function _loadConfig() internal view returns (DeployConfig memory cfg) {
        cfg.deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        cfg.admin = vm.envAddress("ADMIN");
        cfg.pauser = vm.envAddress("PAUSER");
        cfg.treasurer = vm.envAddress("TREASURER");
        cfg.creator = vm.envAddress("CREATOR");
        cfg.collateral = vm.envAddress("COLLATERAL_TOKEN");

        cfg.functionsRouter = vm.envAddress("FUNCTIONS_ROUTER");
        cfg.creForwarder = vm.envAddress("CRE_FORWARDER");
        cfg.expectedWorkflowId = vm.envOr("EXPECTED_WORKFLOW_ID", bytes32(0));

        cfg.functionsSubscriptionId = uint64(vm.envUint("FUNCTIONS_SUBSCRIPTION_ID"));
        cfg.functionsDonId = vm.envBytes32("FUNCTIONS_DON_ID");
        cfg.functionsCallbackGasLimit = uint32(vm.envUint("FUNCTIONS_CALLBACK_GAS_LIMIT"));
        cfg.maxMarketsPerCheck = uint32(vm.envOr("MAX_MARKETS_PER_CHECK", uint256(8)));

        cfg.protocolFeeBps = uint16(vm.envOr("PROTOCOL_FEE_BPS", uint256(200)));
        cfg.functionsSource = vm.envOr("FUNCTIONS_SOURCE", string(""));
        cfg.functionsSourceFile = vm.envOr("FUNCTIONS_SOURCE_FILE", string(""));

        if (bytes(cfg.functionsSource).length == 0 && bytes(cfg.functionsSourceFile).length > 0) {
            cfg.functionsSource = vm.readFile(cfg.functionsSourceFile);
        }
    }
}

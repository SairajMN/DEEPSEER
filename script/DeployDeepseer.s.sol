// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AMM} from "../contracts/deepseer/AMM.sol";
import {DeepSeerToken} from "../contracts/deepseer/DeepSeerToken.sol";
import {Governance} from "../contracts/deepseer/Governance.sol";
import {PredictionMarket} from "../contracts/deepseer/PredictionMarket.sol";
import {SettlementEngine} from "../contracts/deepseer/SettlementEngine.sol";

interface Vm {
    function envUint(string calldata key) external returns (uint256 value);
    function startBroadcast(uint256 privateKey) external;
    function stopBroadcast() external;
}

contract DeployDeepseer {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    struct Deployment {
        address token;
        address predictionMarket;
        address amm;
        address settlementEngine;
        address governance;
    }

    event DeploymentComplete(
        address indexed token,
        address indexed predictionMarket,
        address amm,
        address settlementEngine,
        address governance
    );

    function run() external returns (Deployment memory deployed) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        DeepSeerToken token = new DeepSeerToken();
        PredictionMarket predictionMarket = new PredictionMarket();
        AMM amm = new AMM(address(predictionMarket));
        SettlementEngine settlementEngine = new SettlementEngine(address(predictionMarket));
        Governance governance = new Governance(address(token));

        predictionMarket.setAMM(address(amm));
        predictionMarket.setSettlementEngine(address(settlementEngine));

        vm.stopBroadcast();

        deployed = Deployment({
            token: address(token),
            predictionMarket: address(predictionMarket),
            amm: address(amm),
            settlementEngine: address(settlementEngine),
            governance: address(governance)
        });

        emit DeploymentComplete(
            deployed.token,
            deployed.predictionMarket,
            deployed.amm,
            deployed.settlementEngine,
            deployed.governance
        );
    }
}

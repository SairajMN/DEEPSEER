// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IDeepSeerToken {
    function balanceOf(address account) external view returns (uint256);
}

contract Governance {
    struct Proposal {
        address proposer;
        string description;
        uint8 status;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 startBlock;
        uint256 endBlock;
        bool executed;
    }

    IDeepSeerToken public immutable token;
    Proposal[] private proposals;
    mapping(uint256 => mapping(address => bool)) private hasVoted;
    mapping(address => uint256) private lockedBalances;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);

    constructor(address tokenAddress) {
        require(tokenAddress != address(0), "INVALID_TOKEN");
        token = IDeepSeerToken(tokenAddress);
    }

    function propose(string calldata description, bytes calldata) external returns (uint256) {
        proposals.push(
            Proposal({
                proposer: msg.sender,
                description: description,
                status: 0,
                forVotes: 0,
                againstVotes: 0,
                startBlock: block.number,
                endBlock: block.number + 5760,
                executed: false
            })
        );

        uint256 proposalId = proposals.length - 1;
        emit ProposalCreated(proposalId, msg.sender, description);
        return proposalId;
    }

    function vote(uint256 proposalId, bool support) external returns (bool) {
        require(proposalId < proposals.length, "PROPOSAL_NOT_FOUND");

        Proposal storage proposal = proposals[proposalId];
        _refreshProposalStatus(proposal);
        require(proposal.status == 0, "PROPOSAL_NOT_ACTIVE");
        require(block.number <= proposal.endBlock, "VOTING_ENDED");
        require(!proposal.executed, "ALREADY_EXECUTED");
        require(!hasVoted[proposalId][msg.sender], "ALREADY_VOTED");

        uint256 weight = getVotingPower(msg.sender);
        if (weight == 0) {
            weight = 1;
        }

        hasVoted[proposalId][msg.sender] = true;
        if (support) {
            proposal.forVotes += weight;
        } else {
            proposal.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
        return true;
    }

    function execute(uint256 proposalId) external returns (bool) {
        require(proposalId < proposals.length, "PROPOSAL_NOT_FOUND");

        Proposal storage proposal = proposals[proposalId];
        _refreshProposalStatus(proposal);
        require(proposal.status == 1, "PROPOSAL_NOT_PASSED");
        require(!proposal.executed, "ALREADY_EXECUTED");

        proposal.executed = true;
        proposal.status = 3;

        emit ProposalExecuted(proposalId);
        return true;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposalId < proposals.length, "PROPOSAL_NOT_FOUND");
        return proposals[proposalId];
    }

    function getProposalCount() external view returns (uint256) {
        return proposals.length;
    }

    function getVotingPower(address account) public view returns (uint256) {
        return token.balanceOf(account) + lockedBalances[account];
    }

    function getLockedTokens(address account) external view returns (uint256) {
        return lockedBalances[account];
    }

    function _refreshProposalStatus(Proposal storage proposal) internal {
        if (proposal.executed) {
            proposal.status = 3;
            return;
        }

        if (block.number <= proposal.endBlock) {
            proposal.status = 0;
            return;
        }

        proposal.status = proposal.forVotes > proposal.againstVotes ? 1 : 2;
    }
}

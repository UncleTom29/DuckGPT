// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IPluginRegistry.sol";

/// @title UsageMeter - Handles payments and metering
contract UsageMeter is ReentrancyGuard {
    using ECDSA for bytes32;

    struct Subscription {
        uint256 planId;
        uint256 callsRemaining;
        uint256 renewalTimestamp;
        bool active;
    }

    mapping(address => mapping(uint256 => uint256)) public userEscrow;
    mapping(address => mapping(uint256 => Subscription)) public subscriptions;
    mapping(bytes32 => bool) public consumedReceipts;
    mapping(uint256 => uint256) public pluginEarnings;

    address public duckToken;
    address public pluginRegistry;
    uint256 public marketplaceFeePercent = 250; // 2.5%
    uint256 public constant MAX_FEE_PERCENT = 1000; // 10%

    event FundsEscrowed(address indexed user, uint256 indexed pluginId, uint256 amount);
    event UsageConsumed(uint256 indexed pluginId, address indexed user, uint256 cost, bytes32 receiptHash);
    event EarningsWithdrawn(uint256 indexed pluginId, address indexed owner, uint256 amount);
    event SubscriptionCreated(address indexed user, uint256 indexed pluginId, uint256 planId);

    modifier onlyValidPlugin(uint256 pluginId) {
        require(IPluginRegistry(pluginRegistry).plugins(pluginId).active, "Plugin not active");
        _;
    }

    constructor(address _duckToken, address _pluginRegistry) {
        duckToken = _duckToken;
        pluginRegistry = _pluginRegistry;
    }

    function prepay(uint256 pluginId, uint256 amount)
        external
        nonReentrant
        onlyValidPlugin(pluginId)
    {
        require(amount > 0, "Amount must be positive");

        IERC20(duckToken).transferFrom(msg.sender, address(this), amount);
        userEscrow[msg.sender][pluginId] += amount;

        emit FundsEscrowed(msg.sender, pluginId, amount);
    }

    function consume(
        uint256 pluginId,
        bytes32 receiptHash,
        uint256 cost,
        bytes calldata verifierSig
    ) external nonReentrant onlyValidPlugin(pluginId) {
        require(!consumedReceipts[receiptHash], "Receipt already consumed");
        require(cost > 0, "Cost must be positive");

        IPluginRegistry.Plugin memory plugin = IPluginRegistry(pluginRegistry).plugins(pluginId);

        address signer = receiptHash.recover(verifierSig);
        require(signer == plugin.verifierPubKey, "Invalid oracle signature");

        address caller = msg.sender;

        require(userEscrow[caller][pluginId] >= cost, "Insufficient escrow");

        userEscrow[caller][pluginId] -= cost;

        uint256 fee = (cost * marketplaceFeePercent) / 10000;
        uint256 ownerEarnings = cost - fee;

        pluginEarnings[pluginId] += ownerEarnings;

        consumedReceipts[receiptHash] = true;

        IPluginRegistry(pluginRegistry).incrementStats(pluginId, cost);

        emit UsageConsumed(pluginId, caller, cost, receiptHash);
    }

    function withdrawEarnings(uint256 pluginId) external nonReentrant {
        IPluginRegistry.Plugin memory plugin = IPluginRegistry(pluginRegistry).plugins(pluginId);
        require(plugin.owner == msg.sender, "Not plugin owner");

        uint256 earnings = pluginEarnings[pluginId];
        require(earnings > 0, "No earnings to withdraw");

        pluginEarnings[pluginId] = 0;
        IERC20(duckToken).transfer(msg.sender, earnings);

        emit EarningsWithdrawn(pluginId, msg.sender, earnings);
    }

    function getUserEscrow(address user, uint256 pluginId) external view returns (uint256) {
        return userEscrow[user][pluginId];
    }

    function setSubscription(
        uint256 pluginId,
        uint256 planId,
        uint256 callsIncluded,
        uint256 duration
    ) external payable onlyValidPlugin(pluginId) {
        subscriptions[msg.sender][pluginId] = Subscription({
            planId: planId,
            callsRemaining: callsIncluded,
            renewalTimestamp: block.timestamp + duration,
            active: true
        });

        emit SubscriptionCreated(msg.sender, pluginId, planId);
    }
}

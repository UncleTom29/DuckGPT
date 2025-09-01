// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IPluginRegistry - Interface for PluginRegistry
interface IPluginRegistry {
    struct Plugin {
        string name;
        string description;
        string uri;
        address owner;
        uint256 pricePerCall;
        uint256 version;
        address verifierPubKey;
        bool active;
        uint256 totalCalls;
        uint256 totalEarnings;
        uint256 createdAt;
        uint256 updatedAt;
    }

    function plugins(uint256 id) external view returns (Plugin memory);

    function incrementStats(uint256 pluginId, uint256 earnings) external;
}

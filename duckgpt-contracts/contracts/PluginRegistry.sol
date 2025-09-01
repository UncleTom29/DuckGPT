// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title PluginRegistry - Manages plugin metadata and ownership
contract PluginRegistry is Ownable, ReentrancyGuard {
    using EnumerableSet for EnumerableSet.UintSet;

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

    struct SLA {
        uint256 maxResponseTimeMs;
        uint256 availabilityPercent;
        uint256 maxTokens;
    }

    mapping(uint256 => Plugin) public plugins;
    mapping(uint256 => SLA) public pluginSLAs;
    mapping(address => EnumerableSet.UintSet) private ownerPlugins;
    mapping(string => uint256) public nameToId;

    uint256 public nextPluginId = 1;
    uint256 public registrationFee = 10 * 10 ** 18; // 10 DUCK to register
    address public duckToken;

    event PluginRegistered(uint256 indexed pluginId, string name, address indexed owner);
    event PluginUpdated(uint256 indexed pluginId, uint256 version);
    event PluginDeprecated(uint256 indexed pluginId);
    event PriceUpdated(uint256 indexed pluginId, uint256 oldPrice, uint256 newPrice);

     constructor(address _duckToken, address initialOwner) Ownable(initialOwner) {
        duckToken = _duckToken;
    }

    modifier onlyPluginOwner(uint256 pluginId) {
        require(plugins[pluginId].owner == msg.sender, "Not plugin owner");
        _;
    }

    modifier validPlugin(uint256 pluginId) {
        require(pluginId > 0 && pluginId < nextPluginId, "Invalid plugin ID");
        require(plugins[pluginId].active, "Plugin not active");
        _;
    }

 

    function register(
        string calldata name,
        string calldata description,
        string calldata uri,
        uint256 pricePerCall,
        address verifierPubKey,
        SLA calldata sla
    ) external nonReentrant returns (uint256) {
        require(bytes(name).length > 0 && bytes(name).length <= 64, "Invalid name");
        require(nameToId[name] == 0, "Name already taken");
        require(verifierPubKey != address(0), "Invalid verifier");
        require(sla.availabilityPercent >= 9000, "SLA availability too low");

        IERC20(duckToken).transferFrom(msg.sender, address(this), registrationFee);

        uint256 pluginId = nextPluginId++;

        plugins[pluginId] = Plugin({
            name: name,
            description: description,
            uri: uri,
            owner: msg.sender,
            pricePerCall: pricePerCall,
            version: 1,
            verifierPubKey: verifierPubKey,
            active: true,
            totalCalls: 0,
            totalEarnings: 0,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        pluginSLAs[pluginId] = sla;
        nameToId[name] = pluginId;
        ownerPlugins[msg.sender].add(pluginId);

        emit PluginRegistered(pluginId, name, msg.sender);
        return pluginId;
    }

    function updatePrice(uint256 pluginId, uint256 newPrice)
        external
        onlyPluginOwner(pluginId)
    {
        uint256 oldPrice = plugins[pluginId].pricePerCall;
        plugins[pluginId].pricePerCall = newPrice;
        plugins[pluginId].updatedAt = block.timestamp;

        emit PriceUpdated(pluginId, oldPrice, newPrice);
    }

    function updateURI(uint256 pluginId, string calldata newURI)
        external
        onlyPluginOwner(pluginId)
    {
        plugins[pluginId].uri = newURI;
        plugins[pluginId].version++;
        plugins[pluginId].updatedAt = block.timestamp;

        emit PluginUpdated(pluginId, plugins[pluginId].version);
    }

    function deprecate(uint256 pluginId) external onlyPluginOwner(pluginId) {
        plugins[pluginId].active = false;
        plugins[pluginId].updatedAt = block.timestamp;

        emit PluginDeprecated(pluginId);
    }

    function getPluginsByOwner(address owner) external view returns (uint256[] memory) {
        return ownerPlugins[owner].values();
    }

    function getActivePlugins() external view returns (uint256[] memory) {
        uint256[] memory activeIds = new uint256[](nextPluginId - 1);
        uint256 count = 0;

        for (uint256 i = 1; i < nextPluginId; i++) {
            if (plugins[i].active) {
                activeIds[count++] = i;
            }
        }

        uint256[] memory result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = activeIds[i];
        }
        return result;
    }

    /// @dev incrementStats can be called by UsageMeter
    function incrementStats(uint256 pluginId, uint256 earnings) external {
        plugins[pluginId].totalCalls += 1;
        plugins[pluginId].totalEarnings += earnings;
        plugins[pluginId].updatedAt = block.timestamp;
    }
}

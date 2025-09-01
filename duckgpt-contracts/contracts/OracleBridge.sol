// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title OracleBridge - Manages off-chain execution verification
contract OracleBridge is Ownable {
    using ECDSA for bytes32;

    struct VerifierInfo {
        bool active;
        uint256 reputation;
        uint256 totalVerifications;
        uint256 lastActivity;
    }

    mapping(address => VerifierInfo) public verifiers;
    mapping(bytes32 => bool) public verifiedReceipts;

    event VerifierAdded(address indexed verifier);
    event VerifierRemoved(address indexed verifier);
    event ReceiptVerified(bytes32 indexed receiptHash, address indexed verifier);


    constructor(address initialOwner) Ownable(initialOwner) {}

   function addVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");

        verifiers[verifier] = VerifierInfo({
            active: true,
            reputation: 10000,
            totalVerifications: 0,
            lastActivity: block.timestamp
        });

        emit VerifierAdded(verifier);
    }

    function removeVerifier(address verifier) external onlyOwner {
        verifiers[verifier].active = false;
        emit VerifierRemoved(verifier);
    }

    function verifyReceipt(bytes32 receiptHash, bytes calldata signature)
        external
        view
        returns (bool)
    {
        address signer = receiptHash.recover(signature);
        return verifiers[signer].active && verifiers[signer].reputation > 5000;
    }

    function updateVerifierReputation(address verifier, uint256 newReputation)
        external
        onlyOwner
    {
        require(verifiers[verifier].active, "Verifier not active");
        require(newReputation <= 10000, "Reputation too high");

        verifiers[verifier].reputation = newReputation;
    }
}

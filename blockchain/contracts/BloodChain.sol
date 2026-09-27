// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract BloodChain is AccessControl {
    bytes32 public constant BLOOD_BANK_ROLE = keccak256("BLOOD_BANK_ROLE");
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");
    bytes32 public constant TRANSPORT_ROLE = keccak256("TRANSPORT_ROLE");

    enum BloodStatus {
        REGISTERED,
        AVAILABLE,
        ALLOCATED,
        DISPATCHED,
        DELIVERED,
        EXPIRED,
        QUARANTINED
    }

    enum DeliveryStatus {
        REQUESTED,
        APPROVED,
        DISPATCHED,
        IN_TRANSIT,
        DELIVERED,
        CANCELLED
    }

    struct BloodUnit {
        string unitId;
        bytes32 metadataHash;
        string bloodGroup;
        uint64 donatedAt;
        uint64 expiresAt;
        BloodStatus status;
        address createdBy;
    }

    struct Delivery {
        string deliveryId;
        string bloodUnitId;
        bytes32 manifestHash;
        DeliveryStatus status;
        address actor;
        uint64 updatedAt;
    }

    mapping(string => BloodUnit) private bloodUnits;
    mapping(string => Delivery) private deliveries;
    mapping(string => bool) public bloodUnitExists;
    mapping(string => bool) public deliveryExists;

    event BloodUnitRegistered(
        string indexed unitId,
        string bloodGroup,
        bytes32 metadataHash,
        uint64 donatedAt,
        uint64 expiresAt,
        address indexed actor
    );

    event BloodStatusChanged(
        string indexed unitId,
        BloodStatus status,
        address indexed actor,
        uint64 timestamp
    );

    event DeliveryCreated(
        string indexed deliveryId,
        string indexed unitId,
        bytes32 manifestHash,
        address indexed actor
    );

    event DeliveryStatusChanged(
        string indexed deliveryId,
        DeliveryStatus status,
        address indexed actor,
        uint64 timestamp
    );

    event TemperatureCommitment(
        string indexed deliveryId,
        bytes32 readingHash,
        int16 temperatureDeciC,
        uint64 timestamp
    );

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function grantOperationalRoles(
        address bloodBank,
        address hospital,
        address transporter
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(BLOOD_BANK_ROLE, bloodBank);
        _grantRole(HOSPITAL_ROLE, hospital);
        _grantRole(TRANSPORT_ROLE, transporter);
    }

    function registerBloodUnit(
        string calldata unitId,
        string calldata bloodGroup,
        uint64 donatedAt,
        uint64 expiresAt,
        bytes32 metadataHash
    ) external onlyRole(BLOOD_BANK_ROLE) {
        require(!bloodUnitExists[unitId], "UNIT_EXISTS");
        require(expiresAt > donatedAt, "INVALID_DATES");

        bloodUnits[unitId] = BloodUnit({
            unitId: unitId,
            metadataHash: metadataHash,
            bloodGroup: bloodGroup,
            donatedAt: donatedAt,
            expiresAt: expiresAt,
            status: BloodStatus.AVAILABLE,
            createdBy: msg.sender
        });

        bloodUnitExists[unitId] = true;

        emit BloodUnitRegistered(
            unitId,
            bloodGroup,
            metadataHash,
            donatedAt,
            expiresAt,
            msg.sender
        );
    }

    function setBloodStatus(
        string calldata unitId,
        BloodStatus status
    ) external {
        require(bloodUnitExists[unitId], "UNIT_NOT_FOUND");
        require(
            hasRole(BLOOD_BANK_ROLE, msg.sender) ||
            hasRole(TRANSPORT_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "NOT_AUTHORIZED"
        );

        bloodUnits[unitId].status = status;
        emit BloodStatusChanged(unitId, status, msg.sender, uint64(block.timestamp));
    }

    function createDelivery(
        string calldata deliveryId,
        string calldata unitId,
        bytes32 manifestHash
    ) external {
        require(
            hasRole(BLOOD_BANK_ROLE, msg.sender) ||
            hasRole(HOSPITAL_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "NOT_AUTHORIZED"
        );
        require(!deliveryExists[deliveryId], "DELIVERY_EXISTS");
        require(bloodUnitExists[unitId], "UNIT_NOT_FOUND");

        deliveries[deliveryId] = Delivery({
            deliveryId: deliveryId,
            bloodUnitId: unitId,
            manifestHash: manifestHash,
            status: DeliveryStatus.REQUESTED,
            actor: msg.sender,
            updatedAt: uint64(block.timestamp)
        });

        deliveryExists[deliveryId] = true;

        emit DeliveryCreated(deliveryId, unitId, manifestHash, msg.sender);
    }

    function setDeliveryStatus(
        string calldata deliveryId,
        DeliveryStatus status
    ) external {
        require(deliveryExists[deliveryId], "DELIVERY_NOT_FOUND");
        require(
            hasRole(BLOOD_BANK_ROLE, msg.sender) ||
            hasRole(TRANSPORT_ROLE, msg.sender) ||
            hasRole(HOSPITAL_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "NOT_AUTHORIZED"
        );

        deliveries[deliveryId].status = status;
        deliveries[deliveryId].actor = msg.sender;
        deliveries[deliveryId].updatedAt = uint64(block.timestamp);

        emit DeliveryStatusChanged(
            deliveryId,
            status,
            msg.sender,
            uint64(block.timestamp)
        );
    }

    function commitTemperature(
        string calldata deliveryId,
        bytes32 readingHash,
        int16 temperatureDeciC
    ) external {
        require(
            hasRole(TRANSPORT_ROLE, msg.sender) ||
            hasRole(BLOOD_BANK_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "NOT_AUTHORIZED"
        );
        require(deliveryExists[deliveryId], "DELIVERY_NOT_FOUND");

        emit TemperatureCommitment(
            deliveryId,
            readingHash,
            temperatureDeciC,
            uint64(block.timestamp)
        );
    }

    function getBloodUnit(
        string calldata unitId
    ) external view returns (BloodUnit memory) {
        require(bloodUnitExists[unitId], "UNIT_NOT_FOUND");
        return bloodUnits[unitId];
    }

    function getDelivery(
        string calldata deliveryId
    ) external view returns (Delivery memory) {
        require(deliveryExists[deliveryId], "DELIVERY_NOT_FOUND");
        return deliveries[deliveryId];
    }
}

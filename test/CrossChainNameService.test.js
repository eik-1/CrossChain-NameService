const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CrossChainNameService", function () {
  async function deployFixture() {
    const [alice] = await ethers.getSigners();

    const ccipLocalSimulatorFactory = await ethers.getContractFactory(
      "CCIPLocalSimulator"
    );
    const ccipLocalSimulator = await ccipLocalSimulatorFactory.deploy();

    const { chainSelector_, sourceRouter_, destinationRouter_ } =
      await ccipLocalSimulator.configuration();

    const ccns_LookupFactory = await ethers.getContractFactory(
      "CrossChainNameServiceLookup"
    );
    const sourceLookup = await ccns_LookupFactory.deploy();
    const destinationLookup = await ccns_LookupFactory.deploy();
    const sourceLookupAddress = await sourceLookup.getAddress();
    const destinationLookupAddress = await destinationLookup.getAddress();

    const ccns_RegisterFactory = await ethers.getContractFactory(
      "CrossChainNameServiceRegister"
    );
    const ccns_Register = await ccns_RegisterFactory.deploy(
      sourceRouter_,
      sourceLookupAddress
    );

    const ccns_ReceiverFactory = await ethers.getContractFactory(
      "CrossChainNameServiceReceiver"
    );
    const ccns_Receiver = await ccns_ReceiverFactory.deploy(
      destinationRouter_,
      destinationLookupAddress,
      chainSelector_
    );

    const ccns_RegisterAddress = await ccns_Register.getAddress();
    const ccns_ReceiverAddress = await ccns_Receiver.getAddress();

    let txResponse = await sourceLookup.setCrossChainNameServiceAddress(
      ccns_RegisterAddress
    );

    txResponse = await destinationLookup.setCrossChainNameServiceAddress(
      ccns_ReceiverAddress
    );

    txResponse = await ccns_Register.enableChain(
      chainSelector_,
      ccns_ReceiverAddress,
      200_000n
    );

    return {
      alice,
      sourceLookup,
      destinationLookup,
      ccns_Register,
      ccns_Receiver,
    };
  }

  it("Should register a name and lookup the address on source and destination", async function () {
    const { alice, ccns_Register, sourceLookup, destinationLookup } =
      await loadFixture(deployFixture);

    const aliceConnected = ccns_Register.connect(alice);
    const aliceAddress = await alice.getAddress();

    // Register Alice's name in the source chain
    try {
      const res = await aliceConnected.register("alice.ccns");
      console.log("Register transaction:", res.hash);
    } catch (error) {
      console.log("Error:", error);
    }

    // Lookup Alice's address in the source chain
    expect(await sourceLookup.lookup("alice.ccns")).to.equal(aliceAddress);
    // Lookup Alice's address in the destination chain
    expect(await destinationLookup.lookup("alice.ccns")).to.equal(aliceAddress);

    console.log("Alice's address:", aliceAddress);
    console.log(
      "Alice's address on source:",
      await sourceLookup.lookup("alice.ccns")
    );
    console.log(
      "Alice's address on destination:",
      await destinationLookup.lookup("alice.ccns")
    );
  });
});

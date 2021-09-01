import hre from "hardhat";
import { Artifact } from "hardhat/types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";

import { expect } from "chai";
import { ethers } from "hardhat";
import { utils } from "ethers";
import { MockDai, RockPaperScissors } from "../typechain";

enum GameStatus {
  ENROLLING,
  STARTED,
  FINISHED,
}

async function deployContracts(): Promise<[RockPaperScissors, MockDai]> {
  var [owner, player1, player2] = await ethers.getSigners();
  const DAI = await ethers.getContractFactory("MockDai");
  const dai = await DAI.deploy();
  await dai.deployed();

  await dai.transfer(player1.address, utils.parseEther("3000"));
  await dai.transfer(player2.address, utils.parseEther("3000"));

  const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors", owner);
  const rockPaperScissors = await RockPaperScissors.deploy(dai.address);

  return [<RockPaperScissors>rockPaperScissors, <MockDai>dai];
}

describe("RockPaperScissors Unit tests", function () {
  let owner: SignerWithAddress, player1: SignerWithAddress, player2: SignerWithAddress;

  before(async function () {});

  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();
  });

  it("Players have enough money to play", async function () {
    var [RPS, dai] = await deployContracts();
    expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("3000"));
    expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("3000"));
  });

  it("Should enroll player 1 with 1000 dai", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let dai1 = dai.connect(player1);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    const expectedBet = await RPS1.gameBet(gameId);
    //assert
    await expect((await RPS1.lastGameId()).toString()).to.equal(gameId + "");
    await expect(expectedBet.toString()).to.equal(bet.toString());
    await expect((await RPS1.player1ForGame(gameId)).toString()).to.equal(player1.address);
    await expect((await RPS1.balances(player1.address)).toString()).to.equal(bet.toString());
    await expect((await RPS1.status(gameId)).toString()).to.equal(GameStatus.ENROLLING + "");
    await expect((await RPS1.activePlayer(player1.address)).toString()).to.equal("true");
    await expect((await dai.balanceOf(RPS.address)).toString()).to.equal(bet.toString());
  });

  it("should enroll player 1 and 2", async function () {});

  it("should enroll player 1 with zero dai", async function () {});

  it("player 2 tries to enroll to non existing game", async function () {});

  it("player 1 tries to enroll again after player 2 did", async function () {});
});

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from "chai";
import hre from "hardhat";
import { utils } from "ethers";
import { MockDai, RockPaperScissors } from "../typechain";

enum GameStatus {
  ENROLLING,
  STARTED,
  FINISHED,
}

const ONEWEEK = 604800;
const ONEDAY = 86400;

enum GameValue {
  ROCK,
  PAPER,
  SCISSORS
}

async function deployContracts(): Promise<[RockPaperScissors, MockDai]> {
  var [owner, player1, player2] = await hre.ethers.getSigners();
  const DAI = await await hre.ethers.getContractFactory("MockDai");
  const dai = await DAI.deploy();
  await dai.deployed();

  await dai.transfer(player1.address, utils.parseEther("3000"));
  await dai.transfer(player2.address, utils.parseEther("3000"));

  const RockPaperScissors = await hre.ethers.getContractFactory("RockPaperScissors", owner);
  const rockPaperScissors = await RockPaperScissors.deploy(dai.address);

  return [<RockPaperScissors>rockPaperScissors, <MockDai>dai];
}

describe("RockPaperScissors Unit tests", function () {
  let owner, player1: SignerWithAddress, player2: SignerWithAddress;

  before(async function () { });

  beforeEach(async function () {
    [owner, player1, player2] = await hre.ethers.getSigners();
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

  it("player 1 tries to enroll twice - should fail", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");

    let RPS1 = RPS.connect(player1);
    let dai1 = dai.connect(player1);

    await dai1.approve(RPS1.address, bet);

    //act
    await RPS1.enrollPlayer1(bet);
    await expect(RPS1.enrollPlayer1(bet)).to.be.revertedWith("you can only play one game at once");
  });

  it("player 2 tries to enroll twice - should fail", async function () {

    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);
    await expect(RPS2.enrollPlayer2(bet, gameId)).to.be.revertedWith("you can only play one game at once");



  });

  it("should enroll player 1 and 2 - happy path", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);

  });

  it("should enroll player 1 with zero dai", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("0");
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

  it("player 2 tries to enroll to non existing game - should fail", async function () {

    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    const inexistentGame = 56

    await expect(RPS2.enrollPlayer2(bet, inexistentGame)).to.be.revertedWith("there is no player 1 for this game");

  });

  it("player 1 tries to enroll again after player 2 did", async function () {


    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);

    await expect(RPS1.enrollPlayer1(bet)).to.be.revertedWith("you can only play one game at once");

  });

  it("player 1 plays, then player 2, it is a tie", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);


    //start playing

    await RPS1.player1Plays(GameValue.PAPER, gameId);

    await expect(await RPS2.player2Plays(GameValue.PAPER, gameId)).to.emit(RPS1, "Tie").withArgs(gameId);
    await expect((await RPS2.balances(player1.address)).toString()).to.equal(utils.parseEther("1000").toString());
    await expect((await RPS2.balances(player2.address)).toString()).to.equal(utils.parseEther("1000").toString());

  });

  it("player 1 plays, then player 2, player 1 wins", async function () {

    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);


    //start playing

    await RPS1.player1Plays(GameValue.PAPER, gameId);

    await expect(await RPS2.player2Plays(GameValue.ROCK, gameId)).to.emit(RPS1, "Player1Wins").withArgs(gameId);

    await expect((await RPS2.balances(player1.address)).toString()).to.equal(utils.parseEther("2000").toString());
    await expect((await RPS2.balances(player2.address)).toString()).to.equal(utils.parseEther("0").toString());
  });

  it("player 1 plays, then player 2, player 2 wins", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);


    //start playing

    await RPS1.player1Plays(GameValue.ROCK, gameId);

    await expect(await RPS2.player2Plays(GameValue.PAPER, gameId)).to.emit(RPS1, "Player2Wins").withArgs(gameId);

    await expect((await RPS2.balances(player1.address)).toString()).to.equal(utils.parseEther("0").toString());
    await expect((await RPS2.balances(player2.address)).toString()).to.equal(utils.parseEther("2000").toString());
  });

  it("player 1 plays and tries to withdraw bet in less than a week", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await RPS1.enrollPlayer1(bet);

    await dai2.approve(RPS2.address, bet);
    await RPS2.enrollPlayer2(bet, gameId);

    await RPS1.player1Plays(GameValue.ROCK, gameId);

    IncreaseTime(RPS1, ONEDAY);

    await expect(RPS1.player1WithdrawBalance(gameId)).to.be.revertedWith("you cannnot withdraw your bet yet");

  });


  it("player 1 plays,  player 2 does not play after one week, then player 1 recovers funds", async function () {
    //arrange
    var [RPS, dai] = await deployContracts();
    let bet = utils.parseEther("1000");
    let gameId = 1;

    let RPS1 = RPS.connect(player1);
    let RPS2 = RPS.connect(player2);

    let dai1 = dai.connect(player1);
    let dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);

    //act
    await expect(RPS1.enrollPlayer1(bet)).to.emit(RPS, "Player1Enrolled").withArgs(gameId);

    await dai2.approve(RPS2.address, bet);

    await expect(RPS2.enrollPlayer2(bet, gameId)).to.emit(RPS, "Player2Enrolled").withArgs(gameId);

    await RPS1.player1Plays(GameValue.ROCK, gameId);

    await IncreaseTime(RPS1, ONEWEEK * 2);

    await expect(RPS1.player1WithdrawBalance(gameId)).to.emit(RPS1, "Player1WithdrewBalance").withArgs(gameId);
    await expect((await RPS1.activePlayer(player1.address)).toString()).to.equal("false")
    await expect((await RPS1.player1ForGame(gameId)).toString()).to.equal("0x0000000000000000000000000000000000000000");
    await expect((await RPS1.balances(player1.address)).toString()).to.equal("0");
    await expect((await dai1.balanceOf(player1.address))).to.equal(utils.parseEther("3000"));


  });


  it("player 1 plays withdrew bet after a week, then player 2 does the same after one week", async function () {


  });

  async function IncreaseTime(contract: RockPaperScissors, seconds: number) {
    let time = await contract.getCurrentTime();
    time = time.add(seconds);
    await contract.setCurrentTime(time);
  }

});

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from "chai";
import hre from "hardhat";
import { BigNumber, utils } from "ethers";
import { MockDai } from "../typechain";
import { RockPaperScissorsV2 } from '../typechain/RockPaperScissorsV2';

enum GameStatus {
  COMMITING,
  REVEALING,
  FINISHED
}

enum Choice {
  ROCK = 0,
  PAPER = 1,
  SCISSORS = 2
}

const ONEWEEK = 604800;

async function deployContracts(): Promise<[RockPaperScissorsV2, MockDai]> {
  const [owner, player1, player2] = await hre.ethers.getSigners();
  const DAI = await await hre.ethers.getContractFactory("MockDai");
  const dai = await DAI.deploy();
  await dai.deployed();

  await dai.transfer(player1.address, utils.parseEther("3000"));
  await dai.transfer(player2.address, utils.parseEther("3000"));

  const RockPaperScissors = await hre.ethers.getContractFactory("RockPaperScissorsV2", owner);
  const rockPaperScissors = await RockPaperScissors.deploy(dai.address);

  return [<RockPaperScissorsV2>rockPaperScissors, <MockDai>dai];
}

describe("RockPaperScissorsv2 Unit tests", function () {
  let owner: SignerWithAddress, player1: SignerWithAddress, player2: SignerWithAddress;
  const player1Password = "P@assword123!";
  const player2Password = "P@assword456!Secret";
  const gameId = 1;
  const fee = 1;
  const bet = utils.parseEther("1000");
  let rest: BigNumber;

  beforeEach(async function () {
    [owner, player1, player2] = await hre.ethers.getSigners();
    let feeval = (bet.div(BigNumber.from(100))).mul(BigNumber.from(fee));
    rest = bet.sub(feeval);
  });

  it("Fee calculus is ok", async function () {
    const [RPS, dai] = await deployContracts();
    let response: [BigNumber, BigNumber] = await RPS.calculateFee(utils.parseEther("350"), 10);
    expect(response[0].toString()).to.equal("35000000000000000000");
    expect(response[1].toString()).to.equal("315000000000000000000");
  });


  it("Players have enough money to play", async function () {
    const [_, dai] = await deployContracts();
    expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("3000"));
    expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("3000"));
  });

  it("Player logs in with a password with less thatn 6 chars ", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    await dai1.approve(RPS1.address, bet);
    await expect(RPS1.login("ABC")).to.be.revertedWith("password must have between 6 and 20 characters");
  });

  it("Player logs in with a password with less thatn 20 chars ", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    await dai1.approve(RPS1.address, bet);
    await expect(RPS1.login("abcdefghijklmnopqrstuvwxyz")).to.be.revertedWith("password must have between 6 and 20 characters");
  });

  it("player 1 and 2 commit with 1000 dai, then they both reveal, it is a tie, player 1 executes prize distribution, there is no balance to distribute", async function () {
    //arrange
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);

    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    //act
    await expect(RPS1.player1Commit(Choice.ROCK, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.ROCK, bet, gameId, player2Password)).to.emit(RPS, "Player2Commited").withArgs(gameId);
    
    await expect((await RPS.player1Revealed(player1.address)).toString()).to.equal(false.toString());
    await expect((await RPS.player2Revealed(player2.address)).toString()).to.equal(false.toString());

    await expect(RPS1.player1Reveals(Choice.ROCK, gameId, player1Password)).to.emit(RPS, "Player1Revealed").withArgs(gameId);
    await expect((await RPS1.player1Choices(gameId)).toString()).to.equal(Choice.ROCK.toString());
    await expect((await RPS1.player1Revealed(gameId)).toString()).to.equal(true.toString());

    await expect(RPS2.player2Reveals(Choice.ROCK, gameId, player2Password)).to.emit(RPS, "Player2Revealed").withArgs(gameId);
    await expect((await RPS2.player2Choices(gameId)).toString()).to.equal(Choice.ROCK.toString());
    await expect((await RPS1.player2Revealed(gameId)).toString()).to.equal(true.toString());

    await expect(RPS1.distribute(gameId)).to.emit(RPS, "Tie");

    await expect(await RPS1.balances(player1.address)).to.equal(utils.parseEther("990"));
    await expect(await RPS2.balances(player2.address)).to.equal(utils.parseEther("990"));

    await expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("2990"));
    await expect(await dai.balanceOf(player2.address)).to.equal(utils.parseEther("2990"));

    await expect(await RPS.status(gameId)).to.equal(GameStatus.FINISHED);
    await expect(await RPS.feeBalance()).to.equal(utils.parseEther("20"));
    await expect(await RPS.extract());
    await expect(await dai.balanceOf(owner.address)).to.equal(utils.parseEther("4020"));
  });

  it("player 2 wants to distribute without having revealed commits", async function () {
    //arrange
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);

    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    //act
    await expect(RPS1.player1Commit(Choice.ROCK, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.ROCK, bet, gameId, player2Password)).to.emit(RPS, "Player2Commited").withArgs(gameId);
    await expect(RPS2.distribute(gameId)).to.be.revertedWith("player 1 has to reveal");
  });



  it("player 1 and 2 commit with 1000 dai, then they both reveal, player 1 wins, player 1 executes prize distribution", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);

    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.ROCK, bet, gameId, player2Password)).to.emit(RPS, "Player2Commited").withArgs(gameId);
    await expect((await RPS.player1Revealed(player1.address)).toString()).to.equal(false.toString());
    await expect((await RPS.player2Revealed(player1.address)).toString()).to.equal(false.toString());
    await expect(RPS1.player1Reveals(Choice.PAPER, gameId, player1Password)).to.emit(RPS, "Player1Revealed").withArgs(gameId);
    await expect((await RPS1.player1Choices(gameId)).toString()).to.equal(Choice.PAPER.toString());
    await expect((await RPS1.player1Revealed(gameId)).toString()).to.equal(true.toString());
    await expect(RPS2.player2Reveals(Choice.ROCK, gameId, player2Password)).to.emit(RPS, "Player2Revealed").withArgs(gameId);
    await expect((await RPS2.player2Choices(gameId)).toString()).to.equal(Choice.ROCK.toString());
    await expect((await RPS1.player2Revealed(gameId)).toString()).to.equal(true.toString());
    await expect(RPS1.distribute(gameId)).to.emit(RPS, "Player1Wins").withArgs(gameId);

    await expect(await RPS1.balances(player1.address)).to.equal(utils.parseEther("1980"))
    await expect(await RPS2.balances(player2.address)).to.equal(utils.parseEther("0"))
    await expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("3980"))
    await expect(await dai.balanceOf(player2.address)).to.equal(utils.parseEther("2000"))
    await expect(await RPS.status(gameId)).to.equal(GameStatus.FINISHED);
  });

  it("player 1 and 2 commit with 1000 dai, then they both reveal, player 2 wins, player 2 executes prize distribution", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);
    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);
    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.SCISSORS, bet, gameId, player2Password)).to.emit(RPS, "Player2Commited").withArgs(gameId);
    await expect((await RPS.player1Revealed(player1.address)).toString()).to.equal(false.toString());
    await expect((await RPS.player2Revealed(player1.address)).toString()).to.equal(false.toString());
    await expect(RPS1.player1Reveals(Choice.PAPER, gameId, player1Password)).to.emit(RPS, "Player1Revealed").withArgs(gameId);
    await expect((await RPS1.player1Choices(gameId)).toString()).to.equal(Choice.PAPER.toString());
    await expect((await RPS1.player1Revealed(gameId)).toString()).to.equal(true.toString());
    await expect(RPS2.player2Reveals(Choice.SCISSORS, gameId, player2Password)).to.emit(RPS, "Player2Revealed").withArgs(gameId);
    await expect((await RPS2.player2Choices(gameId)).toString()).to.equal(Choice.SCISSORS.toString());
    await expect((await RPS2.player2Revealed(gameId)).toString()).to.equal(true.toString());
    await expect(RPS2.distribute(gameId)).to.emit(RPS, "Player2Wins").withArgs(gameId);
    await expect(await RPS1.balances(player1.address)).to.equal(utils.parseEther("0"))
    await expect(await RPS2.balances(player2.address)).to.equal(utils.parseEther("1980"))
    await expect(await dai.balanceOf(player1.address)).to.equal(utils.parseEther("2000"))
    await expect(await dai.balanceOf(player2.address)).to.equal(utils.parseEther("3980"))
    await expect(await RPS.status(gameId)).to.equal(GameStatus.FINISHED);
  });



  it("player 1 commits, player 2 never commits after a week, player 1 withraws bet, player 2 does the same", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);
    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);
    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);

    await IncreaseTime(RPS, ONEWEEK * 2);

    await expect(RPS1.player1WithdrawBalance(gameId)).to.emit(RPS, "Player1WithdrewBalance").withArgs(gameId);
    await expect((await RPS.player1ForGame(gameId)).toString()).to.equal("0x0000000000000000000000000000000000000000");
    await expect((await RPS.balances(player1.address)).toString()).to.equal("0");
  });

  it("player 2 wants to play after player 1 withdrew the bet after 1 week", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);
    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    //act
    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);

    await IncreaseTime(RPS, ONEWEEK * 2);

    await expect(RPS1.player1WithdrawBalance(gameId)).to.emit(RPS, "Player1WithdrewBalance").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.PAPER, bet, gameId, player2Password)).to.be.revertedWith("there is no player 1 for this game");
  });



  it("player 2 tries to play in a game with no player 1", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS2.player2Commit(Choice.PAPER, bet, gameId, player2Password)).to.be.revertedWith("there is no player 1 for this game");
  });

  it("player 2 bet does not match player 1 bet", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);
    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS2.player2Commit(Choice.SCISSORS, utils.parseEther("2000"), gameId, player2Password)).to.be.revertedWith("you have to match player 1 bet");
  });


  it("player 1 commits and tries to withdraw bet in afer 1 day", async function () {

    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await expect(RPS1.player1WithdrawBalance(gameId)).to.be.revertedWith("you cannnot withdraw your bet yet");
  });

  it("player 1 commits in different games, and then player 2 plays. ", async function () {
    const [RPS, dai] = await deployContracts();

    const RPS1 = RPS.connect(player1);
    const dai1 = dai.connect(player1);
    const RPS2 = RPS.connect(player2);
    const dai2 = dai.connect(player2);

    await dai1.approve(RPS1.address, bet);
    await dai2.approve(RPS2.address, bet);

    await RPS1.login(player1Password);
    await RPS2.login(player2Password);

    //act
    await expect(RPS1.player1Commit(Choice.PAPER, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId);
    await dai1.approve(RPS1.address, bet);
    await expect(RPS1.player1Commit(Choice.ROCK, bet, player1Password)).to.emit(RPS, "Player1Commited").withArgs(gameId + 1);
  });

  async function IncreaseTime(contract: RockPaperScissorsV2, seconds: number) {
    let time = await contract.getCurrentTime();
    time = time.add(seconds);
    await contract.setCurrentTime(time);
  }
});
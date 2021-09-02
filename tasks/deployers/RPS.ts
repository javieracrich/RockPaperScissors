// import { task } from "hardhat/config";
// import { TaskArguments } from "hardhat/types";

// import { RockPaperScissors, RockPaperScissors__factory } from "../../typechain";

// const ropstenDai = "0xad6d458402f60fd3bd25163575031acdce07538d";

// task("deploy:RPS")
//     .addParam("erc20", ropstenDai)
//     .setAction(async function (taskArguments: TaskArguments, { ethers }) {
//         const rpsFactory: RockPaperScissors__factory = await ethers.getContractFactory("RockPaperScissors");
//         const rps: RockPaperScissors = <RockPaperScissors>await rpsFactory.deploy(taskArguments._erc20);
//         await rps.deployed();
//         console.log("RPS deployed to: ", rps.address);
//     });

// import { ethers } from "hardhat"

// async function main() {

//     const [deployer] = await ethers.getSigners();

//     console.log("deploying RockPaperScissors with account: ", deployer.address);

//     console.log("Account Balance: ", (await deployer.getBalance()).toString());

//     const RockPaperScissors = await ethers.getContractFactory("RockPaperScissors");

//     const erc20Address = "0xad6d458402f60fd3bd25163575031acdce07538d"; //ropsten dai

//     const rps = await RockPaperScissors.deploy(erc20Address);

//     console.log("RockPaperScissors is deployed to", rps.address);
// }

// main()
//     .then(() => process.exit(0))
//     .catch((error) => {
//         console.error(error);
//         process.exit(1);
//     });
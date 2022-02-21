// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

enum GameStatus {
    COMMITING,
    REVEALING,
    FINISHED
}

enum Choice {
    ROCK,
    PAPER,
    SCISSORS
}

struct Game {
    uint256 game;
    bool active;
}

error TransferFailed();
error ShouldNeverHappen();

contract RockPaperScissorsV2 is Ownable {
    IERC20 private erc20;
    uint256 public time = 0;
    uint256 public lastGameId = 1;

    //gameid => game status
    mapping(uint256 => GameStatus) public status;
    //gameiD=> player1 choice
    mapping(uint256 => Choice) public player1Choices;
    //gameid => player 2 choice
    mapping(uint256 => Choice) public player2Choices;

    // //gameid => player 1
    mapping(uint256 => address) public player1ForGame;
    // //gameid => player 2
    mapping(uint256 => address) public player2ForGame;

    //gameId => player1 revealead
    mapping(uint256 => bool) public player1Revealed;
    //gameId => player 2 revealed
    mapping(uint256 => bool) public player2Revealed;

    //player 1 => play timestamp
    mapping(uint256 => uint256) public player1Timestamp;
    //gameid => player 1 bet
    mapping(uint256 => uint256) public gameBet;

    //player => balance
    mapping(address => uint256) public balances;
    //player addres => [gameId => bytes32 hash]
    mapping(address => mapping(uint256 => bytes32)) public commits;
    //player => password
    mapping(address => bytes32) private playerPasswords;

    mapping(uint256 => bool) public gameActive;

    uint256 public feeBalance = 0;

    uint256 public percentage = 1;

    event Player1Commited(uint256 gameId);
    event Player2Commited(uint256 gameId);
    event Player1Wins(uint256 gameId);
    event Player2Wins(uint256 gameId);
    event Tie(uint256 gameId);
    event Player1WithdrewBalance(uint256 gameId);
    event Player2WithdrewBalance(uint256 gameId);
    event Player1Revealed(uint256 gameId);
    event Player2Revealed(uint256 gameId);
    event PlayerLoggedIn(address player);

    constructor(IERC20 _erc20) {
        erc20 = _erc20;
    }

    function extract() external onlyOwner {
        bool success = erc20.transfer(_msgSender(), feeBalance);
        if (!success) {
            revert TransferFailed();
        }
    }

    function configureFees(uint256 _percentage) external onlyOwner {
        percentage = _percentage;
    }

    function login(string memory password) external {
        require(
            bytes(password).length >= 6 && bytes(password).length <= 20,
            "password must have between 6 and 20 characters"
        );
        require(playerPasswords[_msgSender()] == bytes32(0), "you have already logged in");
        playerPasswords[_msgSender()] = hashPassword(password);
        emit PlayerLoggedIn(_msgSender());
    }

    function hashChoice(Choice data) private view returns (bytes32) {
        return keccak256(abi.encodePacked(address(this), playerPasswords[_msgSender()], data));
    }

    function hashPassword(string memory password) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(password));
    }

    function player1Commit(
        Choice choice,
        uint256 _amount,
        string memory password
    ) external onlyLoggedIn(password) {
        (uint256 fee, uint256 rest) = calculateFee(_amount, percentage);

        gameBet[lastGameId] = _amount;

        player1ForGame[lastGameId] = _msgSender();

        status[lastGameId] = GameStatus.COMMITING;

        player1Timestamp[lastGameId] = getCurrentTime();

        balances[_msgSender()] = rest;

        commits[_msgSender()][lastGameId] = hashChoice(choice);

        feeBalance = feeBalance + fee;

        gameActive[lastGameId] = true;

        bool success = erc20.transferFrom(_msgSender(), address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }

        emit Player1Commited(lastGameId);

        lastGameId++;
    }

    function player2Commit(
        Choice choice,
        uint256 _amount,
        uint256 gameId,
        string memory password
    ) external onlyLoggedIn(password) {
        //checks
        require(status[gameId] == GameStatus.COMMITING, "this game is not the COMMITING phase");
        require(player1ForGame[gameId] != address(0), "there is no player 1 for this game");
        require(gameBet[gameId] == _amount, "you have to match player 1 bet");
        require(player1ForGame[gameId] != address(0), "you can't play because player 1 withdrew the bet");

        //effects
        (uint256 fee, uint256 rest) = calculateFee(_amount, percentage);
        player2ForGame[gameId] = _msgSender();
        status[gameId] = GameStatus.REVEALING;
        balances[_msgSender()] = rest;
        commits[_msgSender()][gameId] = hashChoice(choice);

        feeBalance = feeBalance + fee;

        //interactions
        bool success = erc20.transferFrom(_msgSender(), address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }

        emit Player2Commited(gameId);
    }

    function player1Reveals(
        Choice choice,
        uint256 gameId,
        string memory password
    ) external onlyLoggedIn(password) {
        require(status[gameId] == GameStatus.REVEALING, "this game is not the REVEALING phase");
        require(player1ForGame[gameId] == _msgSender(), "you are not playing this game");

        bool valid = hashChoice(choice) == commits[_msgSender()][gameId];
        require(valid, "invalid choice hash");

        player1Choices[gameId] = choice;
        player1Revealed[gameId] = true;

        emit Player1Revealed(gameId);
    }

    function player2Reveals(
        Choice choice,
        uint256 gameId,
        string memory password
    ) external onlyLoggedIn(password) {
        require(player1Revealed[gameId] == true, "player 1 has to reveal first");

        require(status[gameId] == GameStatus.REVEALING, "this game is not the REVEALING phase");
        require(player2ForGame[gameId] == _msgSender(), "you are not playing this game");

        bool valid = hashChoice(choice) == commits[_msgSender()][gameId];
        require(valid, "invalid choice hash");

        player2Choices[gameId] = choice;
        player2Revealed[gameId] = true;
        emit Player2Revealed(gameId);
    }

    function distribute(uint256 gameId) external {
        require(status[gameId] != GameStatus.FINISHED, "this game has already been distributed");
        require(player1Revealed[gameId] == true, "player 1 has to reveal");
        require(player2Revealed[gameId] == true, "player 2 has to reveal");

        address player1 = player1ForGame[gameId];
        address player2 = player2ForGame[gameId];

        uint8 who = whoWins(player1Choices[gameId], player2Choices[gameId]);
        if (who == 0) {
            transfer(player1);
            transfer(player2);
            emit Tie(gameId);
        }
        if (who == 1) {
            transferBalanceFromPlayerToPlayer(player2, player1);
            emit Player1Wins(gameId);
        }
        if (who == 2) {
            transferBalanceFromPlayerToPlayer(player1, player2);
            emit Player2Wins(gameId);
        }

        gameActive[gameId] = false;

        status[gameId] = GameStatus.FINISHED;
    }

    function transferBalanceFromPlayerToPlayer(address from, address to) private {
        balances[to] = balances[to] + balances[from];
        balances[from] = 0;
        transfer(to);
    }

    function transfer(address player) private {
        bool success = erc20.transfer(player, balances[player]);
        if (!success) {
            revert TransferFailed();
        }
    }

    function player1WithdrawBalance(uint256 gameId) external {
        require(player1ForGame[gameId] == _msgSender(), "invalid game id");
        require((player1Timestamp[gameId] + 1 weeks) < getCurrentTime(), "you cannnot withdraw your bet yet");
        require(
            status[gameId] == GameStatus.COMMITING || status[gameId] == GameStatus.REVEALING,
            "this game is not in the COMMITING or REVEALING status"
        );

        bool success = erc20.transfer(_msgSender(), gameBet[gameId]);
        if (!success) {
            revert TransferFailed();
        }
        player1ForGame[gameId] = address(0);
        balances[_msgSender()] = 0;
        gameActive[gameId] = false;
        emit Player1WithdrewBalance(gameId);
    }

    function whoWins(Choice choice1, Choice choice2) private pure returns (uint8) {
        if (choice1 == choice2) {
            return 0;
        }

        if (choice1 == Choice.ROCK && choice2 == Choice.PAPER) {
            return 2;
        }

        if (choice1 == Choice.ROCK && choice2 == Choice.SCISSORS) {
            return 1;
        }

        if (choice1 == Choice.PAPER && choice2 == Choice.ROCK) {
            return 1;
        }

        if (choice1 == Choice.PAPER && choice2 == Choice.SCISSORS) {
            return 2;
        }

        if (choice1 == Choice.SCISSORS && choice2 == Choice.ROCK) {
            return 2;
        }

        if (choice1 == Choice.SCISSORS && choice2 == Choice.PAPER) {
            return 1;
        }

        revert ShouldNeverHappen();
    }

    function calculateFee(uint256 _amount, uint256 _percentage) public pure returns (uint256, uint256) {
        uint256 fee = (_amount / 100) * _percentage;
        uint256 rest = _amount - fee;
        return (fee, rest);
    }

    //only for testing purposes, remove for prod
    //this is used to mock current time for testing
    function getCurrentTime() public view returns (uint256) {
        if (time == 0) {
            return block.timestamp;
        } else {
            return time;
        }
    }

    //only for testing purposes, remove for prod
    function setCurrentTime(uint256 _time) external {
        time = _time;
    }

    modifier onlyLoggedIn(string memory password) {
        require(playerPasswords[_msgSender()] != bytes32(0), "you are not loggedIn");
        require(playerPasswords[_msgSender()] == hashPassword(password), "invalid password");
        _;
    }
}

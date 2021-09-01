// SPDX-License-Identifier: MIT
pragma solidity >=0.8.4;
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

enum RockPaperScissorsValues {
    ROCK,
    PAPER,
    SCISSORS
}

enum GameStatus {
    ENROLLING,
    STARTED,
    FINISHED
}

enum GameValue {
    ROCK,
    PAPER,
    SCISSORS
}

error TransferFailed();
error ShouldNeverHappen();

contract RockPaperScissors is Ownable {
    IERC20 private erc20;

    //gameid => player 1
    mapping(uint256 => address) public player1ForGame;
    //gameid => player 2
    mapping(uint256 => address) public player2ForGame;
    //gameid => game status
    mapping(uint256 => GameStatus) public status;
    //gameid => player 1 bet
    mapping(uint256 => uint256) public gameBet;
    //player addres => [gameId => gameValue]
    mapping(address => mapping(uint256 => GameValue)) private gamePlays;
    //player => balance
    mapping(address => uint256) public balances;
    //player => isPlaying ?
    mapping(address => bool) public activePlayer;

    uint256 public lastGameId = 0;

    event Player1Enrolled(uint256 gameId);
    event Player2Enrolled(uint256 gameId);
    event Player1Wins(uint256 gameId);
    event Player2Wins(uint256 gameId);
    event Tie(uint256 gameId);

    constructor(IERC20 _erc20) {
        erc20 = _erc20;
    }

    function enrollPlayer1(uint256 _amount) public {
        //checks
        require(activePlayer[_msgSender()] == false, "you can only play one game at once");

        //effects
        lastGameId++;
        gameBet[lastGameId] = _amount;
        player1ForGame[lastGameId] = _msgSender();
        balances[_msgSender()] = _amount;
        status[lastGameId] = GameStatus.ENROLLING;
        activePlayer[_msgSender()] = true;

        //interactions
        bool success = erc20.transferFrom(_msgSender(), address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }

        emit Player1Enrolled(lastGameId);
    }

    function enrollPlayer2(uint256 _amount, uint256 gameId) public {
        //checks
        require(status[gameId] == GameStatus.ENROLLING, "this game does not allow new players");
        require(player1ForGame[gameId] != address(0), "there is no player 1 for this game");
        require(gameBet[gameId] == _amount, "you have to match player 1 bet");
        require(activePlayer[_msgSender()] == false, "you can only play one game at once");

        //effects
        player2ForGame[gameId] = _msgSender();
        status[gameId] = GameStatus.STARTED;
        balances[_msgSender()] = _amount;
        activePlayer[_msgSender()] = true;

        //interactions
        bool success = erc20.transferFrom(_msgSender(), address(this), _amount);
        if (!success) {
            revert TransferFailed();
        }

        emit Player2Enrolled(gameId);
    }

    function player1Plays(GameValue _val, uint256 gameId) public onlyActiveGame(gameId) {
        require(_msgSender() == player1ForGame[gameId], "you are not playing in this game");

        gamePlays[_msgSender()][gameId] = _val;
    }

    function player2Plays(GameValue _val, uint256 gameId) public onlyActiveGame(gameId) {
        require(_msgSender() == player2ForGame[gameId], "you are not playing in this game");
        gamePlays[_msgSender()][gameId] = _val;

        checkResultAndTransferPrize(gameId);
    }

    modifier onlyActiveGame(uint256 gameId) {
        require(status[gameId] == GameStatus.STARTED, "this game is not active");
        _;
    }

    function checkResultAndTransferPrize(uint256 gameId) public {
        address player1 = player1ForGame[gameId];
        address player2 = player2ForGame[gameId];
        GameValue value1 = gamePlays[player1][gameId];
        GameValue value2 = gamePlays[player2][gameId];
        uint8 who = whoWins(value1, value2);
        if (who == 0) {
            emit Tie(gameId);
        }
        if (who == 1) {
            balances[player1] = balances[player1] + balances[player2];
            emit Player1Wins(gameId);
        }
        if (who == 2) {
            balances[player2] = balances[player2] + balances[player1];
            emit Player2Wins(gameId);
        }
        activePlayer[player1] = false;
        activePlayer[player2] = false;
        status[gameId] = GameStatus.FINISHED;
    }

    function withdrawBalance() public {
        bool success = erc20.transfer(_msgSender(), balances[_msgSender()]);
        if (!success) {
            revert TransferFailed();
        }
    }

    function checkMyBalance() public view returns (uint256) {
        return balances[_msgSender()];
    }

    function whoWins(GameValue _val1, GameValue _val2) public pure returns (uint8) {
        if (_val1 == GameValue.ROCK) {
            if (_val2 == GameValue.ROCK) {
                return 0;
            }
            if (_val2 == GameValue.PAPER) {
                return 2;
            }
            if (_val2 == GameValue.SCISSORS) {
                return 1;
            }
        }

        if (_val1 == GameValue.PAPER) {
            if (_val2 == GameValue.ROCK) {
                return 1;
            }
            if (_val2 == GameValue.PAPER) {
                return 0;
            }
            if (_val2 == GameValue.SCISSORS) {
                return 2;
            }
        }

        if (_val1 == GameValue.SCISSORS) {
            if (_val2 == GameValue.ROCK) {
                return 2;
            }
            if (_val2 == GameValue.PAPER) {
                return 1;
            }
            if (_val2 == GameValue.SCISSORS) {
                return 0;
            }
        }

        revert ShouldNeverHappen();
    }
}

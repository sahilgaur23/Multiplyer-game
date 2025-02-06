import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'

const socket = io('http://localhost:3001');

function App() {
  const [gameState, setGameState] = useState('home') // home, create, join, game
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [error, setError] = useState('')
  const [isPlayer1, setIsPlayer1] = useState(false)
  
  const [gameStarted, setGameStarted] = useState(false)
  const [score, setScore] = useState(0)
  const [opponentScore, setOpponentScore] = useState(0)
  const [opponentJoined, setOpponentJoined] = useState(false)
  const [activeRooms, setActiveRooms] = useState(new Set())
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameOver, setGameOver] = useState(false)
  const [winner, setWinner] = useState(null)
  const [opponentName, setOpponentName] = useState('')

  useEffect(() => {
    socket.on('connect', () => {
      console.log('Connected to server');
    });

    socket.on('error', ({ message }) => {
      setError(message);
      console.log('Error:', message);
    });

    socket.on('roomCreated', ({ roomCode }) => {
      setRoomCode(roomCode);
      setGameState('game');
      setIsPlayer1(true);
      setError('');
      console.log('Room created:', roomCode);
    });

    socket.on('gameStart', ({ player1, player2 }) => {
      setOpponentJoined(true);
      setGameStarted(true);
      setGameState('game');
      setGameOver(false);
      if (!isPlayer1) {
        setOpponentName(player1.name);
        setOpponentScore(0);
        setScore(0);
      } else {
        setOpponentName(player2.name);
        setOpponentScore(0);
        setScore(0);
      }
      console.log('Game started with players:', player1.name, player2.name);
    });

    socket.on('scoreUpdate', ({ player1Score, player2Score }) => {
      console.log('Received score update:', { 
        player1Score, 
        player2Score, 
        isPlayer1, 
        currentScore: score, 
        currentOpponentScore: opponentScore 
      });
      
      if (isPlayer1) {
        setScore(player1Score);
        setOpponentScore(player2Score);
      } else {
        setScore(player2Score);
        setOpponentScore(player1Score);
      }
    });

    socket.on('playerDisconnected', () => {
      setError('Other player disconnected');
      setGameStarted(false);
      setOpponentJoined(false);
    });

    socket.on('startTimer', () => {
      setGameStarted(true);
      setTimeLeft(30);
    });

    socket.on('gameOver', ({ winner, player1Score, player2Score, winnerName, player1Name, player2Name }) => {
      setGameOver(true);
      setGameStarted(false);
      setWinner({
        isWinner: (isPlayer1 && winner === 'player1') || (!isPlayer1 && winner === 'player2'),
        name: winnerName,
        player1Name: player1Name,
        player2Name: player2Name,
        score: Math.max(player1Score, player2Score)
      });
      console.log('Game Over Data:', { winner, player1Score, player2Score, winnerName, player1Name, player2Name });
    });

    return () => {
      socket.off('connect');
      socket.off('error');
      socket.off('roomCreated');
      socket.off('gameStart');
      socket.off('scoreUpdate');
      socket.off('playerDisconnected');
      socket.off('startTimer');
      socket.off('gameOver');
    };
  }, [isPlayer1]);

  useEffect(() => {
    let timer;
    if (gameStarted && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            clearInterval(timer);
            socket.emit('endGame', { 
              roomCode,
              player1Score: isPlayer1 ? score : opponentScore,
              player2Score: isPlayer1 ? opponentScore : score,
              player1Name: isPlayer1 ? playerName : null,
              player2Name: !isPlayer1 ? playerName : null
            });
            setGameStarted(false);
            setGameOver(true);
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [gameStarted]);

  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name')
      return
    }
    socket.emit('createRoom', { playerName })
  }

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    console.log('Attempting to join room:', roomCode);
    socket.emit('joinRoom', { roomCode: roomCode.toUpperCase(), playerName });
  }

  const handleClick = () => {
    if (!gameStarted || gameOver) return;
    
    const newScore = score + 1;
    setScore(newScore);
    
    const updatedScores = {
      player1Score: isPlayer1 ? newScore : opponentScore,
      player2Score: isPlayer1 ? opponentScore : newScore
    };
    
    socket.emit('updateScore', { 
      roomCode,
      ...updatedScores
    });
    
    console.log('Sending click:', {
      roomCode,
      ...updatedScores,
      isPlayer1,
      currentScore: newScore,
      currentOpponentScore: opponentScore
    });
  };

  const handleStartGame = () => {
    socket.emit('startGame', { roomCode });
  };

  const handlePlayAgain = () => {
    setGameOver(false);
    setScore(0);
    setOpponentScore(0);
    socket.emit('startGame', { roomCode });
  };

  return (
    <div className="game-container">
      {gameState === 'home' && (
        <div className="menu">
          <h1>Welcome to the Game</h1>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />
          <button onClick={() => setGameState('create')}>Create Room</button>
          <button onClick={() => setGameState('join')}>Join Room</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {gameState === 'create' && (
        <div className="menu">
          <h2>Create Room</h2>
          <p>Player Name: {playerName}</p>
          <button onClick={handleCreateRoom}>Generate Room Code</button>
          <button onClick={() => setGameState('home')}>Back</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {gameState === 'join' && (
        <div className="menu">
          <h2>Join Room</h2>
          <p>Player Name: {playerName}</p>
          <input
            type="text"
            placeholder="Enter Room Code"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          />
          <button onClick={handleJoinRoom}>Join</button>
          <button onClick={() => setGameState('home')}>Back</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {gameState === 'game' && (
        <div className="game">
          <h2>Game Room: {roomCode}</h2>
          <div className="players-info">
            <p className="player-info">You: {playerName}</p>
            {opponentJoined && (
              <p className="player-info">Opponent: {opponentName}</p>
            )}
          </div>
          
          {!opponentJoined && isPlayer1 && (
            <div className="waiting-message">
              <h3>Waiting for opponent to join...</h3>
              <p>Share this room code: {roomCode}</p>
            </div>
          )}

          {opponentJoined && !gameStarted && isPlayer1 && !gameOver && (
            <button className="start-button" onClick={handleStartGame}>
              Start Game
            </button>
          )}

          {gameStarted && !gameOver && (
            <div className="game-area">
              <div className="timer">Time Left: {timeLeft}s</div>
              <div className="score-board">
                <h3>Scores</h3>
                <p>{playerName}: {score}</p>
                <p>{opponentName}: {opponentScore}</p>
              </div>
              
              <div className="buzzer-container">
                <button 
                  className="buzzer"
                  onClick={handleClick}
                  disabled={!gameStarted || gameOver}
                >
                  Click Me!
                </button>
              </div>
            </div>
          )}

          {gameOver && (
            <div className="game-over">
              <h2>Game Over!</h2>
              <div className="final-scores">
                <p className="score-line">
                  <span className="player-name">{playerName}</span>
                  <span className="score">{score}</span>
                </p>
                <p className="score-line">
                  <span className="player-name">{opponentName}</span>
                  <span className="score">{opponentScore}</span>
                </p>
              </div>
              <div className="winner-announcement">
                {score === opponentScore ? (
                  <h3>It's a Tie between {playerName} and {opponentName}!</h3>
                ) : (
                  <>
                    <h3 className="winner-text">
                      {score > opponentScore ? 
                        `${playerName} Wins! 🎉` : 
                        `${opponentName} Wins! 🎉`}
                    </h3>
                    <p className="winning-score">Winning Score: {Math.max(score, opponentScore)}</p>
                  </>
                )}
              </div>
            </div>
          )}
          
          <button 
            className="leave-button" 
            onClick={() => {
              socket.emit('leaveRoom', { roomCode });
              setGameState('home');
              setGameOver(false);
              setGameStarted(false);
              setScore(0);
              setOpponentScore(0);
              setOpponentName('');
              setTimeLeft(30);
              setOpponentJoined(false);
              setIsPlayer1(false);
            }}
          >
            Leave Game
          </button>
        </div>
      )}
    </div>
  )
}

export default App

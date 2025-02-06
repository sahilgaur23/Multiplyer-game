const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Your React app URL
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const activeRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createRoom', ({ playerName }) => {
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    activeRooms.set(roomCode, {
      player1: { id: socket.id, name: playerName, score: 0 },
      player2: null
    });

    socket.join(roomCode);
    socket.emit('roomCreated', { roomCode });
    console.log(`Room created: ${roomCode}`);
  });

  socket.on('joinRoom', ({ roomCode, playerName }) => {
    console.log(`Join attempt - Room: ${roomCode}, Player: ${playerName}`);
    const room = activeRooms.get(roomCode);
    
    if (!room) {
      socket.emit('error', { message: 'Invalid room code' });
      return;
    }

    if (room.player2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Join the room
    socket.join(roomCode);
    room.player2 = { id: socket.id, name: playerName, score: 0 };
    activeRooms.set(roomCode, room); // Update the room in our map

    // Notify both players that the game can start
    io.to(roomCode).emit('gameStart', {
      player1: { name: room.player1.name, score: room.player1.score },
      player2: { name: room.player2.name, score: room.player2.score }
    });

    console.log(`Player 2 joined room ${roomCode}`);
  });

  socket.on('updateScore', ({ roomCode, player1Score, player2Score }) => {
    console.log('Received score update:', { roomCode, player1Score, player2Score });
    
    const room = activeRooms.get(roomCode);
    if (room) {
      // Update scores in room state
      room.player1.score = player1Score;
      room.player2.score = player2Score;
      
      // Save updated room state
      activeRooms.set(roomCode, room);
      
      // Broadcast the updated scores to all players in the room
      io.to(roomCode).emit('scoreUpdate', {
        player1Score: room.player1.score,
        player2Score: room.player2.score
      });
      
      console.log('Updated room scores:', {
        roomCode,
        player1Score: room.player1.score,
        player2Score: room.player2.score
      });
    }
  });

  socket.on('startGame', ({ roomCode }) => {
    const room = activeRooms.get(roomCode);
    if (!room) return;

    // Reset scores when game starts
    room.player1.score = 0;
    room.player2.score = 0;
    
    io.to(roomCode).emit('startTimer');
  });

  socket.on('endGame', ({ roomCode }) => {
    const room = activeRooms.get(roomCode);
    if (!room) return;

    room.gameActive = false;

    // Get final scores and player names from the room state
    const finalPlayer1Score = room.player1.score;
    const finalPlayer2Score = room.player2.score;
    const player1Name = room.player1.name;
    const player2Name = room.player2.name;

    // Determine winner based on final scores
    let winner;
    let winnerName;

    if (finalPlayer1Score > finalPlayer2Score) {
      winner = 'player1';
      winnerName = player1Name;
    } else if (finalPlayer2Score > finalPlayer1Score) {
      winner = 'player2';
      winnerName = player2Name;
    } else {
      winner = 'tie';
      winnerName = null;
    }

    // Send final game results to all players
    io.to(roomCode).emit('gameOver', {
      winner,
      winnerName,
      player1Score: finalPlayer1Score,
      player2Score: finalPlayer2Score,
      player1Name,
      player2Name
    });

    console.log('Game Over Results:', {
      roomCode,
      player1: {
        name: player1Name,
        score: finalPlayer1Score
      },
      player2: {
        name: player2Name,
        score: finalPlayer2Score
      },
      winner: winnerName || 'Tie'
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Clean up rooms when players disconnect
    for (const [roomCode, room] of activeRooms.entries()) {
      if (room.player1?.id === socket.id || room.player2?.id === socket.id) {
        io.to(roomCode).emit('playerDisconnected');
        activeRooms.delete(roomCode);
        console.log(`Room ${roomCode} cleaned up due to player disconnect`);
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
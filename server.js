//Untuk auto detect IP address

const os = require("os");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const games = require("./games");
const {
  getTankMapChoices,
  resolveTankMapChoice
} = require("./public/shared/tankMaps.js");

//Untuk cari IP lokal
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  let fallbackIP = "localhost";

  for (const name in interfaces) {
    for (const net of interfaces[name]) {
      //Skip IPv6
      if (net.family !== "IPv4") continue;

      //Skip localhost
      if (net.internal) continue;

      const ip = net.address;

      //Prioritas hotspot
      if (ip.startsWith("10.")) return ip;

      //Prioritas LAN
      if (ip.startsWith("192.168.")) return ip;

      //Prioritas lain
      if (ip.startsWith("172.")) return ip;

      fallbackIP = ip;
    }
  }

  return fallbackIP;
}

//Server utama
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

//Untuk port random dari OS
const PORT = 0;

//Untuk static files
app.use(express.static("public"));

//Untuk data room
const room = {
  players: [],
  hostId: null,
  selectedGameIndex: 0,
  phase: "lobby",
  setup: {
    gameId: null,
    botCount: 0,
    mapIndex: 0
  },
  lastMoveTime: 0,
  currentGame: null,
  matchEnding: false,
  matchWinner: null,
  finishTimer: null
};

//Untuk ambil player input realtime
app.get("/players-state", (req, res) => {
  res.json(
    room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isReady: p.isReady,
      input: {
        x: p.input?.x ?? 0,
        y: p.input?.y ?? 0,
        shootQueue: p.input?.shootQueue ?? 0
      }
    }))
  );
});

//Generate id
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

//Untuk data player yang dikirim ke client
function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    isHost: player.isHost,
    isReady: player.isReady,
    input: {
      x: player.input?.x ?? 0,
      y: player.input?.y ?? 0,
      shootQueue: player.input?.shootQueue ?? 0
    }
  };
}

//Untuk cek semua ready
function allPlayersReady() {
  if (room.players.length === 0) return false;
  return room.players.every((p) => p.isReady);
}

//Untuk batas bot
function getBotLimits() {
  const humanCount = room.players.length;
  const minBotCount = humanCount === 1 ? 1 : 0;
  const maxBotCount = 4;
  return { minBotCount, maxBotCount };
}

//Untuk bot count awal
function getDefaultBotCount() {
  const { minBotCount, maxBotCount } = getBotLimits();
  const suggested = Math.max(minBotCount, 4 - room.players.length);
  return Math.max(minBotCount, Math.min(maxBotCount, suggested));
}

//Untuk setup state
function getSetupState() {
  const choices = getTankMapChoices();
  const safeMapIndex = Math.max(
    0,
    Math.min(room.setup.mapIndex || 0, choices.length - 1)
  );

  return {
    gameId: room.setup.gameId,
    botCount: room.setup.botCount,
    mapIndex: safeMapIndex,
    mapChoices: choices,
    minBotCount: getBotLimits().minBotCount,
    maxBotCount: getBotLimits().maxBotCount
  };
}

//Untuk broadcast host
function broadcastHostUpdate() {
  io.emit("host:update", {
    hostId: room.hostId
  });
}

//Untuk broadcast lobby
function broadcastLobby() {
  io.emit("lobby:update", {
    players: room.players.map(publicPlayer),
    hostId: room.hostId,
    games: games,
    selectedGameIndex: room.selectedGameIndex,
    phase: room.phase,
    setup: getSetupState(),
    currentGameId: room.currentGame ? room.currentGame.id : null,
    currentGameMatchId: room.currentGame ? room.currentGame.matchId : null,
    currentGameBotCount: room.currentGame ? room.currentGame.botCount : 0,
    currentGameMapId: room.currentGame ? room.currentGame.mapId : null,
    currentGameMapName: room.currentGame ? room.currentGame.mapName : null,
    matchEnding: room.matchEnding
  });

  broadcastHostUpdate();
}

//Untuk broadcast state game
function broadcastGameState() {
  if (!room.currentGame) return;

  io.emit("game:update", {
    gameId: room.currentGame.id,
    matchId: room.currentGame.matchId,
    botCount: room.currentGame.botCount,
    mapId: room.currentGame.mapId,
    mapName: room.currentGame.mapName,
    players: room.players.map(publicPlayer)
  });
}

//Untuk broadcast start game
function broadcastGameStart() {
  if (!room.currentGame) return;

  io.emit("game:start", {
    gameId: room.currentGame.id,
    matchId: room.currentGame.matchId,
    botCount: room.currentGame.botCount,
    mapId: room.currentGame.mapId,
    mapName: room.currentGame.mapName,
    players: room.players.map(publicPlayer)
  });
}

//Untuk reset input
function resetControllerInputs() {
  room.players.forEach((player) => {
    player.input = {
      x: 0,
      y: 0,
      shootQueue: 0
    };
  });
}

//Untuk kembali ke lobby
function goLobby() {
  room.phase = "lobby";
  room.setup = {
    gameId: null,
    botCount: 0,
    mapIndex: 0
  };
  room.lastMoveTime = 0;
  broadcastLobby();
}

//Untuk mulai game yang dipilih
function startSelectedGame() {
  const selectedGame = games[room.selectedGameIndex];
  if (!selectedGame) return;

  if (selectedGame.id !== "tank") {
    io.emit("popup:message", "Game belum tersedia");
    return;
  }

  const choices = getTankMapChoices();
  const safeMapIndex = Math.max(
    0,
    Math.min(room.setup.mapIndex || 0, choices.length - 1)
  );
  const chosenMap = resolveTankMapChoice(choices[safeMapIndex].id);

  room.currentGame = {
    id: selectedGame.id,
    name: selectedGame.name,
    botCount: Math.max(0, Math.min(4, room.setup.botCount)),
    mapId: chosenMap.id,
    mapName: chosenMap.name,
    matchId: generateId()
  };

  room.phase = "inGame";
  room.matchEnding = false;
  room.matchWinner = null;

  if (room.finishTimer) {
    clearTimeout(room.finishTimer);
    room.finishTimer = null;
  }

  resetControllerInputs();
  broadcastLobby();
  broadcastGameStart();
  broadcastGameState();
}

//Untuk balik ke lobby paksa
function forceBackToLobby(reason = "back_to_lobby") {
  if (room.finishTimer) {
    clearTimeout(room.finishTimer);
    room.finishTimer = null;
  }

  const oldMatchId = room.currentGame ? room.currentGame.matchId : null;

  room.currentGame = null;
  room.phase = "lobby";
  room.setup = {
    gameId: null,
    botCount: 0,
    mapIndex: 0
  };
  room.matchEnding = false;
  room.matchWinner = null;
  room.lastMoveTime = 0;

  room.players.forEach((player) => {
    player.isReady = false;
    player.input = {
      x: 0,
      y: 0,
      shootQueue: 0
    };
  });

  io.emit("game:end", {
    reason: reason,
    matchId: oldMatchId,
    winnerId: null,
    winnerName: null
  });

  broadcastLobby();
}

//Untuk tembak sekali
function triggerShootOnce(player) {
  if (!player) return;

  player.input.shootQueue = (player.input.shootQueue || 0) + 1;
  broadcastGameState();
}

//Untuk hapus player
function removePlayerBySocket(socket) {
  const index = room.players.findIndex((p) => p.socketId === socket.id);
  if (index === -1) return null;

  const removed = room.players[index];
  room.players.splice(index, 1);

  //Untuk host baru
  if (removed.id === room.hostId) {
    if (room.players.length > 0) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    } else {
      room.hostId = null;
    }

    broadcastHostUpdate();
  }

  //Untuk saat game berjalan
  if (room.currentGame) {
    if (room.players.length === 0) {
      forceBackToLobby("no_players");
      return removed;
    }

    broadcastLobby();
    broadcastGameState();
    return removed;
  }

  //Untuk saat lobby
  if (room.players.length === 0) {
    room.hostId = null;
    room.selectedGameIndex = 0;
    room.lastMoveTime = 0;
    goLobby();
    return removed;
  }

  broadcastLobby();
  return removed;
}

//Untuk end game
function endGameWithWinner(winnerPayload, reason = "last_man_standing", delayMs = 5000) {
  if (!room.currentGame) return;

  if (room.finishTimer) {
    clearTimeout(room.finishTimer);
    room.finishTimer = null;
  }

  room.phase = "inGame";
  room.matchEnding = true;
  room.matchWinner = winnerPayload || null;

  io.emit("game:finish", {
    reason: reason,
    matchId: room.currentGame.matchId,
    winnerId: winnerPayload?.winnerId || null,
    winnerName: winnerPayload?.winnerName || null
  });

  room.finishTimer = setTimeout(() => {
    const oldMatchId = room.currentGame ? room.currentGame.matchId : null;

    room.currentGame = null;
    room.phase = "lobby";
    room.setup = {
      gameId: null,
      botCount: 0,
      mapIndex: 0
    };
    room.matchEnding = false;
    room.matchWinner = null;
    room.finishTimer = null;
    room.lastMoveTime = 0;

    room.players.forEach((player) => {
      player.isReady = false;
      player.input = {
        x: 0,
        y: 0,
        shootQueue: 0
      };
    });

    if (room.players.length === 0) {
      room.hostId = null;
      room.selectedGameIndex = 0;
    }

    io.emit("game:end", {
      reason: reason,
      matchId: oldMatchId,
      winnerId: winnerPayload?.winnerId || null,
      winnerName: winnerPayload?.winnerName || null
    });

    broadcastLobby();
  }, delayMs);
}

//Socket connection
io.on("connection", (socket) => {
  const ip = getLocalIP();

  socket.emit("server:info", {
    ip: ip,
    port: server.address()?.port || 0
  });

  //Untuk register device
  socket.on("device:register", (data) => {
    if (data.type === "screen") {
      broadcastLobby();

      if (room.currentGame) {
        socket.emit("game:start", {
          gameId: room.currentGame.id,
          matchId: room.currentGame.matchId,
          botCount: room.currentGame.botCount,
          mapId: room.currentGame.mapId,
          mapName: room.currentGame.mapName,
          players: room.players.map(publicPlayer)
        });

        socket.emit("game:update", {
          gameId: room.currentGame.id,
          matchId: room.currentGame.matchId,
          botCount: room.currentGame.botCount,
          mapId: room.currentGame.mapId,
          mapName: room.currentGame.mapName,
          players: room.players.map(publicPlayer)
        });

        if (room.matchEnding) {
          socket.emit("game:finish", {
            reason: room.matchWinner?.reason || "winner",
            matchId: room.currentGame.matchId,
            winnerId: room.matchWinner?.winnerId || null,
            winnerName: room.matchWinner?.winnerName || null
          });
        }
      }

      return;
    }

    if (data.type === "controller") {
      if (room.currentGame) {
        socket.emit("popup:message", "Game sedang berjalan");
        return;
      }

      if (room.players.length >= 4) {
        socket.emit("popup:message", "Room penuh");
        return;
      }

      const playerId = generateId();
      const isHost = room.players.length === 0;

      const player = {
        id: playerId,
        socketId: socket.id,
        name: "Player",
        isHost: isHost,
        isReady: false,
        input: {
          x: 0,
          y: 0,
          shootQueue: 0
        }
      };

      room.players.push(player);

      if (isHost) {
        room.hostId = playerId;
      }

      socket.emit("player:assigned", publicPlayer(player));
      broadcastLobby();
    }
  });

  //Untuk toggle ready
  socket.on("player:toggleReady", () => {
    if (room.currentGame || room.phase !== "lobby") return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    player.isReady = !player.isReady;
    broadcastLobby();
  });

  //Untuk set nama
  socket.on("player:setName", (data) => {
    if (room.currentGame) return;

    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    player.name = String(data.name || "Player").substring(0, 12);
    broadcastLobby();
  });

  //Untuk joystick movement
  socket.on("controller:move", (data) => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    const x = Number(data?.x) || 0;
    const y = Number(data?.y) || 0;
    const now = Date.now();

    //Untuk lobby dan setup
    if (!room.currentGame) {
      if (player.id !== room.hostId) return;
      if (now - room.lastMoveTime < 150) return;

      if (room.phase === "lobby") {
        if (x > 0.45) {
          room.selectedGameIndex++;
          if (room.selectedGameIndex >= games.length) room.selectedGameIndex = 0;
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }

        if (x < -0.45) {
          room.selectedGameIndex--;
          if (room.selectedGameIndex < 0) room.selectedGameIndex = games.length - 1;
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }
      }

      if (room.phase === "botCount") {
        const limits = getBotLimits();

        if (x > 0.45) {
          room.setup.botCount = Math.min(
            limits.maxBotCount,
            (room.setup.botCount ?? getDefaultBotCount()) + 1
          );
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }

        if (x < -0.45) {
          room.setup.botCount = Math.max(
            limits.minBotCount,
            (room.setup.botCount ?? getDefaultBotCount()) - 1
          );
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }
      }

      if (room.phase === "mapSelect") {
        const choices = getTankMapChoices();
        const maxIndex = choices.length - 1;

        if (y < -0.45) {
          room.setup.mapIndex = Math.max(0, (room.setup.mapIndex ?? 0) - 1);
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }

        if (y > 0.45) {
          room.setup.mapIndex = Math.min(maxIndex, (room.setup.mapIndex ?? 0) + 1);
          room.lastMoveTime = now;
          broadcastLobby();
          return;
        }
      }

      return;
    }

    //Untuk in game
    if (room.matchEnding) return;

    player.input.x = x;
    player.input.y = y;
    broadcastGameState();
  });

  //Untuk tombol A
  socket.on("controller:buttonA", () => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    //Untuk shoot saat game
    if (room.currentGame) {
      if (room.matchEnding) return;
      triggerShootOnce(player);
      return;
    }

    //Untuk hanya host yang bisa kontrol flow
    if (player.id !== room.hostId) return;

    //Untuk lobby pilih game
    if (room.phase === "lobby") {
      const selectedGame = games[room.selectedGameIndex];
      if (!selectedGame) return;

      if (!selectedGame.playable) {
        io.emit("popup:message", "Game belum tersedia");
        return;
      }

      room.setup.gameId = selectedGame.id;
      room.setup.botCount = getDefaultBotCount();
      room.setup.mapIndex = 0;
      room.phase = "botCount";
      broadcastLobby();
      return;
    }

    //Untuk phase botCount ke mapSelect
    if (room.phase === "botCount") {
      room.phase = "mapSelect";
      broadcastLobby();
      return;
    }

    //Untuk phase mapSelect ke start
    if (room.phase === "mapSelect") {
      //Untuk cek semua player ready
      if (room.players.length === 0 || !allPlayersReady()) {
        io.emit("popup:message", "Semua player harus READY!");
        return;
      }

      startSelectedGame();
      return;
    }
  });

  //Untuk tombol A dilepas
  socket.on("controller:buttonA:release", () => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
  });

  //Untuk tombol B
  socket.on("controller:buttonB", () => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    if (player.id !== room.hostId) return;
    if (room.currentGame) return;

    if (room.phase === "mapSelect") {
      room.phase = "botCount";
      broadcastLobby();
      return;
    }

    if (room.phase === "botCount") {
      room.phase = "lobby";
      room.setup = {
        gameId: null,
        botCount: 0,
        mapIndex: 0
      };
      broadcastLobby();
    }
  });

  //Untuk kembali ke lobby
  socket.on("controller:requestBackToLobby", () => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    if (!room.currentGame) {
      socket.emit("popup:message", "Belum ada game yang berjalan");
      return;
    }

    if (player.id !== room.hostId) {
      socket.emit("popup:message", "Hanya host yang bisa kembali ke lobby");
      return;
    }

    forceBackToLobby("back_to_lobby");
  });

  //Untuk kick player
  socket.on("controller:kickPlayer", (data) => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;
    if (player.id !== room.hostId) return;

    const targetId = String(data?.playerId || "");
    const targetIndex = room.players.findIndex((p) => p.id === targetId);

    if (targetIndex === -1) return;

    const target = room.players[targetIndex];
    if (target.id === room.hostId) return;

    const targetSocketId = target.socketId;

    room.players.splice(targetIndex, 1);

    io.to(targetSocketId).emit("controller:kicked", {
      reason: "kicked",
      by: player.id
    });

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      setTimeout(() => {
        try {
          targetSocket.disconnect(true);
        } catch (err) {}
      }, 80);
    }

    if (room.currentGame) {
      if (room.players.length === 0) {
        forceBackToLobby("no_players");
      } else {
        broadcastLobby();
        broadcastGameState();
      }
      return;
    }

    if (room.players.length > 0 && room.players[0] && room.hostId === target.id) {
      room.players[0].isHost = true;
      room.hostId = room.players[0].id;
    }

    if (room.players.length === 0) {
      room.hostId = null;
      room.phase = "lobby";
      room.setup = {
        gameId: null,
        botCount: 0,
        mapIndex: 0
      };
      room.selectedGameIndex = 0;
    }

    broadcastLobby();
  });

  //Untuk keluar room
  socket.on("controller:disconnectSelf", () => {
    const player = room.players.find((p) => p.socketId === socket.id);
    if (!player) return;

    socket.emit("controller:disconnected", {
      reason: "left_room"
    });

    setTimeout(() => {
      try {
        socket.disconnect(true);
      } catch (err) {}
    }, 80);
  });

  //Untuk finish game
  socket.on("game:finish", (data) => {
    if (!room.currentGame) return;
    if (room.matchEnding) return;

    const reason = data?.reason || "last_man_standing";

    endGameWithWinner(
      {
        winnerId: data?.winnerId || null,
        winnerName: data?.winnerName || null,
        reason: reason
      },
      reason,
      5000
    );
  });

  //Untuk disconnect
  socket.on("disconnect", () => {
    removePlayerBySocket(socket);
  });
});

//Untuk start server
server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  const actualPort = server.address()?.port || 0;

  console.log("");
  console.log("=== PARTY CONSOLE SERVER ===");
  console.log("");
  console.log(`Screen: http://localhost:${actualPort}/screen`);
  console.log("");
  console.log(`Controller: http://${ip}:${actualPort}/controller`);
  console.log("");
});
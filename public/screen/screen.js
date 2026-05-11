//Untuk screen logic

const socket = io();

//Untuk global socket
window.socket = socket;
window.currentGameStartData = null;
window.currentGameFinishData = null;

let activeSessionKey = null;
let winnerFallbackTimer = null;
let activeGameId = null;

const screenRoot =
  document.getElementById("screen");

const headerRoot =
  document.getElementById("header");

socket.emit("device:register", {
  type: "screen"
});

//Untuk key session
function sessionKeyOf(gameId, matchId, mapId) {
  return `${gameId || "none"}:${matchId || "none"}:${mapId || "none"}`;
}

//Untuk mode game
function enterGameMode() {
  document.body.classList.add("game-mode");
}

//Untuk mode lobby
function leaveGameMode() {
  document.body.classList.remove("game-mode");
}

//Untuk hapus timer winner
function clearWinnerFallback() {
  if (winnerFallbackTimer) {
    clearTimeout(winnerFallbackTimer);
    winnerFallbackTimer = null;
  }
}

//Untuk show header
function setHeaderVisible(visible) {
  if (headerRoot) {
    headerRoot.style.display = visible ? "block" : "none";
  }
}

//Untuk show lobby
function setLobbyVisible(visible) {
  const lobbySection =
    document.getElementById("lobbySection");

  if (lobbySection) {
    lobbySection.style.display = visible ? "block" : "none";
  }
}

//Untuk show game
function setGameVisible(visible) {
  const gameContainer =
    document.getElementById("gameContainer");

  if (gameContainer) {
    gameContainer.style.display = visible ? "block" : "none";
  }
}

//Untuk show setup
function setSetupVisible(visible) {
  const setupOverlay =
    document.getElementById("setupOverlay");

  if (setupOverlay) {
    setupOverlay.style.display = visible ? "flex" : "none";
  }
}

//Untuk full screen game
function setGameLayout(isGame) {
  if (screenRoot) {
    screenRoot.style.padding = isGame ? "0" : "";
  }

  if (isGame) {
    enterGameMode();
  } else {
    leaveGameMode();
  }

  setHeaderVisible(!isGame);
  setLobbyVisible(!isGame);
  setSetupVisible(false);
  setGameVisible(isGame);
}

//Untuk daftar map
function getChoices() {
  if (window.getTankMapChoices) {
    return window.getTankMapChoices();
  }

  return [
    { id: "crossfire", name: "Crossfire", description: "Jalur silang di tengah." },
    { id: "fortress", name: "Fortress", description: "Benteng pusat dengan jalur sempit." },
    { id: "split_valley", name: "Split Valley", description: "Arena terbelah dua." },
    { id: "maze_ruins", name: "Maze Ruins", description: "Lorong sempit dan rawan jebakan." },
    { id: "chaos_field", name: "Chaos Field", description: "Obstacle acak di mana-mana." },
    { id: "random", name: "Random Map", description: "Map dipilih acak saat game dimulai.", random: true }
  ];
}

//Untuk ambil map by index
function getMapByIndex(index) {
  const choices = getChoices();
  return choices[Math.max(0, Math.min(index, choices.length - 1))];
}

//Untuk render lobby
function renderLobby(data) {
  const gameRow =
    document.getElementById("gameRow");

  const selectedGameIndex =
    data.selectedGameIndex || 0;

  //Untuk render player slot
  for (let i = 0; i < 4; i++) {
    const slot =
      document.getElementById(`slot-${i}`);

    if (!slot) continue;

    slot.className = "player-slot";

    const player = data.players[i];

    if (!player) {
      slot.innerText = `[${i + 1}] Waiting...`;
      continue;
    }

    let text = `[${i + 1}] ${player.name}`;

    if (player.id === data.hostId) {
      text += " (HOST)";
      slot.classList.add("host");
    }

    const readyText =
      player.isReady ? "[READY]" : "[NOT READY]";

    slot.innerHTML =
      `${text} <span class="${
        player.isReady ? "ready" : "not-ready"
      }">${readyText}</span>`;
  }

  //Untuk render game list
  if (data.games && gameRow) {
    gameRow.innerHTML = "";

    data.games.forEach((game, index) => {
      const card = document.createElement("div");
      card.className = "game-card";

      if (index === selectedGameIndex) {
        card.classList.add("game-selected");
      }

      card.innerText = game.name;
      gameRow.appendChild(card);
    });
  }
}

//Untuk render setup overlay
function renderSetupOverlay(data) {
  const setup = data.setup || {};
  const phase = data.phase || "lobby";

  const setupOverlay =
    document.getElementById("setupOverlay");

  const setupTitle =
    document.getElementById("setupTitle");

  const setupSubtitle =
    document.getElementById("setupSubtitle");

  const setupBody =
    document.getElementById("setupBody");

  const setupHint =
    document.getElementById("setupHint");

  if (
    !setupOverlay ||
    !setupTitle ||
    !setupSubtitle ||
    !setupBody ||
    !setupHint
  ) return;

  //Untuk hide setup saat lobby atau game
  if (phase === "lobby" || phase === "inGame") {
    setSetupVisible(false);
    return;
  }

  //Untuk bot count
  if (phase === "botCount") {
    setSetupVisible(true);

    setupTitle.innerText = "Pilih jumlah bot";
    setupSubtitle.innerText = "Joystick kiri/kanan untuk ubah angka. Tekan A untuk lanjut ke map.";
    setupHint.innerText = `Minimal ${setup.minBotCount ?? 0}, maksimal ${setup.maxBotCount ?? 4}.`;

    const botCount = Number(setup.botCount || 0);

    setupBody.innerHTML = `
      <div class="bot-counter">
        <div class="bot-count-number">${botCount}</div>
        <div class="bot-count-range">Bot sekarang</div>
      </div>
    `;

    return;
  }

  //Untuk map select
  if (phase === "mapSelect") {
    setSetupVisible(true);

    const choices = getChoices();
    const selectedMap = getMapByIndex(setup.mapIndex || 0) || choices[0];

    setupTitle.innerText = "Pilih map";
    setupSubtitle.innerText = "Joystick atas/bawah untuk scroll map. Tekan A untuk mulai game.";
    setupHint.innerText = "Ada 5 map unik + Random map. Tekan B untuk kembali ke bot.";

    const previewMap =
      selectedMap && selectedMap.random
        ? choices[Math.floor(Math.random() * Math.max(1, choices.length - 1))]
        : selectedMap;

    const actualPreview = previewMap || choices[0];
    const miniMap = actualPreview && actualPreview.random ? null : actualPreview;

    setupBody.innerHTML = `
      <div class="map-preview-wrap">
        <div class="map-preview-card">
          <div class="map-preview-title">${selectedMap.name || "Map"}</div>
          <div class="map-preview-desc">${selectedMap.description || ""}</div>

          <div class="map-mini">
            <div class="map-mini-grid"></div>
            ${
              miniMap
                ? `
                  ${(miniMap.obstacles || []).map((o) => {
                    const left = (o.x / 1800) * 100;
                    const top = (o.y / 1000) * 100;
                    const width = (o.w / 1800) * 100;
                    const height = (o.h / 1000) * 100;

                    return `
                      <div
                        class="map-mini-obstacle"
                        style="
                          left:${left}%;
                          top:${top}%;
                          width:${width}%;
                          height:${height}%;
                        ">
                      </div>
                    `;
                  }).join("")}

                  ${(miniMap.spawns || []).map((s) => {
                    const left = (s.x / 1800) * 100;
                    const top = (s.y / 1000) * 100;

                    return `
                      <div
                        class="map-mini-spawn"
                        style="
                          left:${left}%;
                          top:${top}%;
                        ">
                      </div>
                    `;
                  }).join("")}
                `
                : `
                  <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:bold;letter-spacing:1px;">
                    RANDOM MAP
                  </div>
                `
            }
          </div>
        </div>

        <div class="map-list-row">
          ${choices.map((m, index) => `
            <div class="map-chip ${index === (setup.mapIndex || 0) ? "selected" : ""}">
              ${m.name}
            </div>
          `).join("")}
        </div>
      </div>
    `;

    return;
  }

  setSetupVisible(false);
}

//Untuk tampilkan IP controller
socket.on("server:info", (data) => {
  const ipDiv = document.getElementById("ip");

  if (!ipDiv) return;

  const port = data?.port || 3435;

  ipDiv.innerText =
    `Connect Controller: http://${data.ip}:${port}/controller`;
});

//Untuk update lobby
socket.on("lobby:update", (data) => {
  renderLobby(data);
  renderSetupOverlay(data);

  const inSetup =
    data.phase === "botCount" ||
    data.phase === "mapSelect";

  const inGame =
    data.phase === "inGame" &&
    !!data.currentGameId;

  //Untuk setup mode
  if (inSetup) {
    setHeaderVisible(true);
    setLobbyVisible(true);
    setGameVisible(false);
    leaveGameMode();
    return;
  }

  //Untuk game mode
  if (inGame) {
    enterGame(
      data.currentGameId,
      data.players,
      data.currentGameBotCount || 0,
      data.currentGameMatchId || null,
      data.currentGameMapId || null
    );
    return;
  }

  //Untuk balik lobby
  if (activeSessionKey && data.phase === "lobby") {
    leaveGame();
    return;
  }

  //Untuk lobby biasa
  setHeaderVisible(true);
  setLobbyVisible(true);
  setGameVisible(false);
  setSetupVisible(false);
  leaveGameMode();
});

//Untuk popup message
socket.on("popup:message", (message) => {
  alert(message);
});

//Untuk start game
socket.on("game:start", (data) => {
  console.log("Game starting:", data.gameId);

  enterGame(
    data.gameId,
    data.players,
    data.botCount || 0,
    data.matchId || null,
    data.mapId || null
  );
});

//Untuk masuk game mode
function enterGame(gameId, players, botCount = 0, matchId = null, mapId = null) {
  if (!gameId) return;

  const normalizedPlayers = Array.isArray(players) ? players : [];
  const nextSessionKey = sessionKeyOf(gameId, matchId, mapId);

  window.currentGameStartData = {
    gameId: gameId,
    matchId: matchId,
    mapId: mapId,
    players: normalizedPlayers,
    botCount: Number(botCount) || 0
  };

  window.currentGameFinishData = null;

  const shouldReload = activeSessionKey !== nextSessionKey;

  activeGameId = gameId;
  activeSessionKey = nextSessionKey;

  setGameLayout(true);

  if (shouldReload && window.GameLoader) {
    window.GameLoader.loadGame(gameId);
  }

  window.dispatchEvent(
    new CustomEvent("party-game-update", {
      detail: {
        gameId: gameId,
        matchId: matchId,
        mapId: mapId,
        players: normalizedPlayers,
        botCount: Number(botCount) || 0
      }
    })
  );
}

//Untuk keluar game mode
function leaveGame() {
  activeGameId = null;
  activeSessionKey = null;
  window.currentGameStartData = null;
  window.currentGameFinishData = null;

  clearWinnerFallback();
  leaveGameMode();

  if (window.GameLoader) {
    window.GameLoader.unloadGame();
  }

  setHeaderVisible(true);
  setLobbyVisible(true);
  setSetupVisible(false);
  setGameVisible(false);

  if (screenRoot) {
    screenRoot.style.padding = "";
  }
}

//Untuk game update realtime
socket.on("game:update", (data) => {
  if (!data || !data.gameId) return;

  const currentId =
    window.currentGameStartData
      ? window.currentGameStartData.gameId
      : activeGameId;

  if (currentId && data.gameId !== currentId) return;

  window.currentGameStartData = {
    gameId: data.gameId,
    matchId: data.matchId || window.currentGameStartData?.matchId || null,
    mapId: data.mapId || window.currentGameStartData?.mapId || null,
    players: Array.isArray(data.players) ? data.players : [],
    botCount: Number(data.botCount) || window.currentGameStartData?.botCount || 0
  };

  window.dispatchEvent(
    new CustomEvent("party-game-update", {
      detail: {
        gameId: data.gameId,
        matchId: data.matchId || null,
        mapId: data.mapId || null,
        players: Array.isArray(data.players) ? data.players : [],
        botCount: Number(data.botCount) || window.currentGameStartData?.botCount || 0
      }
    })
  );
});

//Untuk game finish
socket.on("game:finish", (data) => {
  window.currentGameFinishData = {
    reason: data?.reason || "winner",
    matchId: data?.matchId || window.currentGameStartData?.matchId || null,
    winnerId: data?.winnerId || null,
    winnerName: data?.winnerName || null
  };

  window.dispatchEvent(
    new CustomEvent("party-game-finish", {
      detail: window.currentGameFinishData
    })
  );

  clearWinnerFallback();

  winnerFallbackTimer = setTimeout(() => {
    if (activeSessionKey) {
      leaveGame();
    }
  }, 5600);
});

//Untuk game end
socket.on("game:end", () => {
  clearWinnerFallback();
  leaveGame();
});
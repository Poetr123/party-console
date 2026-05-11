//Untuk controller logic

const socket = io();

let playerData = null;
let lobbyState = null;
let controllerMode = "lobby";
let menuOpen = false;
let disconnected = false;
let lastDirection = null;

let aPressLocked = false;
let aReleaseTimer = null;

const nameScreen =
 document.getElementById("nameScreen");

const controllerScreen =
 document.getElementById("controllerScreen");

const disconnectScreen =
 document.getElementById("disconnectScreen");

const disconnectMessage =
 document.getElementById("disconnectMessage");

const reloadBtn =
 document.getElementById("reloadBtn");

const roleText =
 document.getElementById("roleText");

const menuBtn =
 document.getElementById("menuBtn");

const menuBackdrop =
 document.getElementById("menuBackdrop");

const menuPanel =
 document.getElementById("menuPanel");

const menuInfo =
 document.getElementById("menuInfo");

const menuPlayers =
 document.getElementById("menuPlayers");

const backToLobbyBtn =
 document.getElementById("backToLobbyBtn");

const disconnectBtn =
 document.getElementById("disconnectBtn");

const nameInput =
 document.getElementById("nameInput");

const nameBtn =
 document.getElementById("nameBtn");

const readyBtn =
 document.getElementById("readyBtn");

const btnA =
 document.getElementById("btn-a");

const btnB =
 document.getElementById("btn-b");

//Untuk joystick
const base =
 document.getElementById("joystickBase");

const stick =
 document.getElementById("joystickStick");

let dragging = false;
let centerX = 0;
let centerY = 0;
const maxDistance = 50;

//Untuk fix viewport height mobile
function setViewportHeight() {
  let vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}

setViewportHeight();
window.addEventListener("resize", setViewportHeight);

//Untuk fullscreen
function enterFullscreen() {
  const elem = document.documentElement;

  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(() => {});
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  }
}

//Untuk mode layar
function showNameScreen() {
  if (nameScreen) nameScreen.style.display = "flex";
  if (controllerScreen) controllerScreen.style.display = "none";
  if (disconnectScreen) disconnectScreen.style.display = "none";
}

function showControllerScreen() {
  if (nameScreen) nameScreen.style.display = "none";
  if (controllerScreen) controllerScreen.style.display = "flex";
  if (disconnectScreen) disconnectScreen.style.display = "none";
}

function showDisconnected(message) {
  disconnected = true;
  controllerMode = "disconnected";
  closeMenu();
  releaseA();

  if (disconnectMessage) {
    disconnectMessage.innerText =
      message || "Refresh halaman untuk join lagi.";
  }

  if (nameScreen) nameScreen.style.display = "none";
  if (controllerScreen) controllerScreen.style.display = "none";
  if (disconnectScreen) disconnectScreen.style.display = "flex";
}

//Untuk label role
function updateRoleLabel() {
  if (!playerData) {
    roleText.innerText = "";
    return;
  }

  if (controllerMode === "botCount") {
    roleText.innerText = "SELECT BOT COUNT";
    return;
  }

  if (controllerMode === "mapSelect") {
    roleText.innerText = "SELECT MAP";
    return;
  }

  roleText.innerText = playerData.isHost
    ? "HOST CONTROLLER"
    : "PLAYER CONTROLLER";
}

//Untuk mode controller
function setControllerMode(mode) {
  controllerMode = mode;

  if (mode === "game") {
    readyBtn.disabled = true;
    readyBtn.innerText = "READY LOCKED";
  } else if (mode === "botCount") {
    readyBtn.disabled = true;
    readyBtn.innerText = "READY LOCKED";
  } else if (mode === "mapSelect") {
    readyBtn.disabled = true;
    readyBtn.innerText = "READY LOCKED";
  } else {
    readyBtn.disabled = false;
    readyBtn.innerText = "READY";
  }

  updateRoleLabel();
  updateMenuButtons();
}

//Untuk menu
function setMenuOpen(open) {
  if (disconnected) return;

  menuOpen = open;

  if (menuBackdrop) {
    menuBackdrop.style.display = open ? "block" : "none";
  }

  if (menuPanel) {
    menuPanel.style.display = open ? "block" : "none";
  }

  if (menuBtn) {
    menuBtn.innerText = open ? "✕" : "☰";
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }

  updateMenuButtons();
}

function openMenu() {
  setMenuOpen(true);
}

function closeMenu() {
  setMenuOpen(false);
}

//Untuk tombol menu
function updateMenuButtons() {
  const isHost = !!playerData?.isHost;
  const inGame = controllerMode === "game";
  const inSetup = controllerMode === "botCount" || controllerMode === "mapSelect";

  if (backToLobbyBtn) {
    backToLobbyBtn.style.display = isHost ? "block" : "none";
    backToLobbyBtn.disabled = !isHost || !inGame;
  }

  if (disconnectBtn) {
    disconnectBtn.style.display = "block";
  }

  if (menuInfo) {
    if (!playerData) {
      menuInfo.innerText = "Kamu belum tersambung.";
    } else if (controllerMode === "game") {
      menuInfo.innerText = "Kamu sedang di dalam game.";
    } else if (inSetup) {
      menuInfo.innerText = "Kamu sedang memilih bot / map.";
    } else if (controllerMode === "lobby") {
      menuInfo.innerText = "Kamu sedang di lobby.";
    } else if (controllerMode === "disconnected") {
      menuInfo.innerText = "Kamu sudah keluar dari room.";
    }
  }
}

//Untuk render player menu
function renderMenuPlayers(players = [], hostId = null) {
  if (!menuPlayers) return;

  menuPlayers.innerHTML = "";

  const isHost = playerData?.id === hostId;

  players.forEach((player) => {
    const row = document.createElement("div");
    row.className = "menuPlayerRow";

    const label = document.createElement("div");
    label.className = "menuPlayerLabel";

    let nameText = player.name || "Player";

    if (player.id === hostId) {
      nameText += " (HOST)";
    }

    label.innerText = nameText;

    row.appendChild(label);

    if (isHost && player.id !== playerData?.id) {
      const kickBtn = document.createElement("button");
      kickBtn.className = "kickBtn";
      kickBtn.type = "button";
      kickBtn.innerText = "Kick";
      kickBtn.onclick = () => {
        socket.emit("controller:kickPlayer", {
          playerId: player.id
        });
      };
      row.appendChild(kickBtn);
    }

    menuPlayers.appendChild(row);
  });
}

//Untuk reset joystick
function resetJoystick() {
  dragging = false;
  lastDirection = null;

  if (stick) {
    stick.style.transform = "translate(0px, 0px)";
  }

  socket.emit("controller:move", {
    x: 0,
    y: 0
  });
}

//Untuk tombol A
function pressA(event) {
  if (disconnected) return;
  if (menuOpen) return;
  if (controllerMode === "disconnected") return;
  if (aPressLocked) return;

  aPressLocked = true;

  if (aReleaseTimer) {
    clearTimeout(aReleaseTimer);
    aReleaseTimer = null;
  }

  socket.emit("controller:buttonA", {
    pressed: true
  });

  aReleaseTimer = setTimeout(() => {
    releaseA();
  }, 350);

  if (event && event.currentTarget && typeof event.currentTarget.setPointerCapture === "function") {
    try {
      if (event.pointerId !== undefined && event.pointerId !== null) {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
    } catch (err) {}
  }
}

//Untuk tombol A lepas
function releaseA() {
  if (!aPressLocked) return;

  aPressLocked = false;

  if (aReleaseTimer) {
    clearTimeout(aReleaseTimer);
    aReleaseTimer = null;
  }

  socket.emit("controller:buttonA:release");
}

//Register controller
socket.emit("device:register", {
  type: "controller"
});

//Terima player data
socket.on("player:assigned", (player) => {
  playerData = player;
  window.myPlayerId = player.id;

  if (controllerScreen && controllerScreen.style.display !== "none") {
    updateRoleLabel();
  }

  updateMenuButtons();
});

//Update host realtime
socket.on("host:update", (data) => {
  if (!data) return;
  if (!playerData) return;

  playerData.isHost = playerData.id === data.hostId;
  updateRoleLabel();
  updateMenuButtons();
  renderMenuPlayers(lobbyState?.players || [], lobbyState?.hostId || null);
});

//Set nama player
nameBtn.onclick = () => {
  if (disconnected) return;

  const name = nameInput.value.trim();

  if (name.length === 0) return;
  if (!playerData) return;

  socket.emit("player:setName", {
    name: name
  });

  showControllerScreen();
  enterFullscreen();
  setControllerMode("lobby");
  resetJoystick();
};

//Reload
if (reloadBtn) {
  reloadBtn.onclick = () => {
    window.location.reload();
  };
}

//Toggle ready
readyBtn.onclick = () => {
  if (disconnected) return;
  if (controllerMode !== "lobby") return;

  socket.emit("player:toggleReady");
};

//Untuk tombol A
btnA.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  pressA(e);
});

btnA.addEventListener("pointerup", (e) => {
  e.preventDefault();
  releaseA();
});

btnA.addEventListener("pointercancel", (e) => {
  e.preventDefault();
  releaseA();
});

btnA.addEventListener("pointerleave", () => {
  releaseA();
});

//Untuk fallback sentuhan
btnA.addEventListener("touchstart", (e) => {
  e.preventDefault();
  pressA(e);
}, { passive: false });

btnA.addEventListener("touchend", (e) => {
  e.preventDefault();
  releaseA();
}, { passive: false });

btnA.addEventListener("touchcancel", (e) => {
  e.preventDefault();
  releaseA();
}, { passive: false });

//Untuk tombol B
btnB.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (disconnected) return;
  socket.emit("controller:buttonB");
});

btnB.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (disconnected) return;
  socket.emit("controller:buttonB");
}, { passive: false });

//Menu toggle
menuBtn.addEventListener("pointerup", (e) => {
  e.preventDefault();
  if (disconnected) return;
  if (menuOpen) {
    closeMenu();
  } else {
    openMenu();
  }
});

menuBackdrop.onclick = () => {
  closeMenu();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeMenu();
  }
});

//Host back to lobby
backToLobbyBtn.onclick = () => {
  if (disconnected) return;
  if (!playerData?.isHost) return;
  if (controllerMode !== "game") return;

  socket.emit("controller:requestBackToLobby");
  closeMenu();
};

//Keluar room
disconnectBtn.onclick = () => {
  if (disconnected) return;

  socket.emit("controller:disconnectSelf");
  closeMenu();
};

//Saat game mulai
socket.on("game:start", (data) => {
  if (disconnected) return;

  setControllerMode("game");
  closeMenu();
  resetJoystick();

  if (playerData?.isHost) {
    roleText.innerText = `${String(data.gameId).toUpperCase()} HOST`;
  } else {
    roleText.innerText = `${String(data.gameId).toUpperCase()} PLAYER`;
  }
});

//Saat game selesai
socket.on("game:end", () => {
  if (disconnected) return;

  setControllerMode("lobby");
  closeMenu();
  resetJoystick();
  updateRoleLabel();
});

//Untuk update lobby
socket.on("lobby:update", (data) => {
  lobbyState = data || null;

  if (!playerData) return;

  const newIsHost = playerData.id === data.hostId;
  playerData.isHost = newIsHost;

  renderMenuPlayers(data.players || [], data.hostId || null);

  if (data.phase === "botCount") {
    setControllerMode("botCount");
  } else if (data.phase === "mapSelect") {
    setControllerMode("mapSelect");
  } else if (data.currentGameId && data.phase === "inGame") {
    setControllerMode("game");
  } else {
    setControllerMode("lobby");
  }

  updateRoleLabel();
  updateMenuButtons();
});

//Saat server bilang kamu keluar room
socket.on("controller:disconnected", (data) => {
  showDisconnected(
    data?.reason === "left_room"
      ? "Kamu sudah keluar dari room. Refresh halaman untuk join lagi."
      : "Kamu terputus dari room. Refresh halaman untuk join lagi."
  );
});

socket.on("controller:kicked", () => {
  showDisconnected("Kamu dikeluarkan host. Refresh halaman untuk join lagi.");
});

//Saat room penuh / info popup
socket.on("popup:message", (message) => {
  alert(message);

  if (String(message).toLowerCase().includes("room penuh")) {
    setControllerMode("lobby");
    updateRoleLabel();
  }
});

//Saat koneksi putus
socket.on("disconnect", () => {
  if (!disconnected) {
    showDisconnected("Koneksi terputus. Refresh halaman untuk join lagi.");
  }
});

//Joystick start
base.addEventListener("pointerdown", (e) => {
  if (disconnected || menuOpen) return;
  if (controllerMode === "disconnected") return;

  dragging = true;
  base.setPointerCapture(e.pointerId);

  const rect = base.getBoundingClientRect();
  centerX = rect.left + rect.width / 2;
  centerY = rect.top + rect.height / 2;

  e.preventDefault();
});

//Joystick move
base.addEventListener("pointermove", (e) => {
  if (disconnected || menuOpen) return;
  if (controllerMode === "disconnected") return;
  if (!dragging) return;

  e.preventDefault();

  let dx = e.clientX - centerX;
  let dy = e.clientY - centerY;

  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > maxDistance) {
    dx = (dx * maxDistance) / distance;
    dy = (dy * maxDistance) / distance;
  }

  stick.style.transform =
    `translate(${dx}px, ${dy}px)`;

  const normalizedX = dx / maxDistance;
  const normalizedY = dy / maxDistance;

  //Untuk lobby dan bot count
  if (controllerMode === "lobby" || controllerMode === "botCount") {
    if (normalizedX > 0.4) {
      if (lastDirection !== "right") {
        socket.emit("controller:move", {
          x: 1,
          y: 0
        });
        lastDirection = "right";
      }
    } else if (normalizedX < -0.4) {
      if (lastDirection !== "left") {
        socket.emit("controller:move", {
          x: -1,
          y: 0
        });
        lastDirection = "left";
      }
    } else {
      lastDirection = null;
    }

    return;
  }

  //Untuk map select
  if (controllerMode === "mapSelect") {
    if (normalizedY < -0.4) {
      if (lastDirection !== "up") {
        socket.emit("controller:move", {
          x: 0,
          y: -1
        });
        lastDirection = "up";
      }
    } else if (normalizedY > 0.4) {
      if (lastDirection !== "down") {
        socket.emit("controller:move", {
          x: 0,
          y: 1
        });
        lastDirection = "down";
      }
    } else {
      lastDirection = null;
    }

    return;
  }

  //Untuk game
  socket.emit("controller:move", {
    x: Number(normalizedX.toFixed(2)),
    y: Number(normalizedY.toFixed(2))
  });

}, { passive: false });

//Joystick release
base.addEventListener("pointerup", () => {
  resetJoystick();
});

base.addEventListener("pointercancel", () => {
  resetJoystick();
});

//Cegah scroll
document.addEventListener("touchmove", function (e) {
  e.preventDefault();
}, { passive: false });

//Cegah lock A kalau tab pindah
window.addEventListener("blur", releaseA);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseA();
});
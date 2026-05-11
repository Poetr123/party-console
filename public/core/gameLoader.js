//Untuk global game loader

window.GameLoader = {
  currentGameId: null,
  currentScript: null,
  currentStyle: null,

  //Untuk unload game
  unloadGame() {
    if (typeof window.currentGameCleanup === "function") {
      try {
        window.currentGameCleanup();
      } catch (err) {
        console.warn("Cleanup game lama gagal:", err);
      }
    }

    window.currentGameCleanup = null;

    if (this.currentScript) {
      this.currentScript.remove();
      this.currentScript = null;
    }

    if (this.currentStyle) {
      this.currentStyle.remove();
      this.currentStyle = null;
    }

    const gameContainer =
      document.getElementById("gameContainer");

    if (gameContainer) {
      gameContainer.innerHTML = "";
      gameContainer.style.display = "block";
    }

    this.currentGameId = null;
  },

  //Untuk load script sekali
  loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find((s) => s.src && s.src.includes(src));
      if (existing) {
        resolve(existing);
        return;
      }

      const script = document.createElement("script");
      script.src = `${src}?v=${Date.now()}`;
      script.onload = () => resolve(script);
      script.onerror = reject;
      document.body.appendChild(script);
    });
  },

  //Untuk load game
  async loadGame(gameId) {
    if (!gameId) return;

    if (this.currentGameId === gameId && this.currentScript) {
      return;
    }

    console.log("Loading game:", gameId);

    this.unloadGame();

    const gameContainer =
      document.getElementById("gameContainer");

    if (!gameContainer) {
      console.error("gameContainer tidak ada");
      return;
    }

    try {
      if (gameId === "tank" && !window.TankMaps) {
        await this.loadScriptOnce("/shared/tankMaps.js");
      }

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `/games/${gameId}/${gameId}.css?v=${Date.now()}`;
      document.head.appendChild(link);
      this.currentStyle = link;

      const script = document.createElement("script");
      script.src = `/games/${gameId}/${gameId}.js?v=${Date.now()}`;
      script.onload = () => {
        console.log("Game loaded:", gameId);
      };
      script.onerror = () => {
        console.error("Gagal load game:", gameId);
      };
      document.body.appendChild(script);
      this.currentScript = script;
      this.currentGameId = gameId;
    } catch (err) {
      console.error("Gagal load aset game:", err);
    }
  }
};
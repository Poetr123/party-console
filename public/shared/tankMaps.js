//Untuk data map tank

(function (root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.TankMaps = api;
  root.TANK_MAPS = api.maps;
  root.getTankMapChoices = api.getTankMapChoices;
  root.getTankMapById = api.getTankMapById;
  root.resolveTankMapChoice = api.resolveTankMapChoice;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const maps = [
    {
      id: "crossfire",
      name: "Crossfire",
      description: "Jalur silang di tengah. Cepat, rame, dan gampang chaos.",
      accent: "#ff6b6b",
      worldWidth: 1800,
      worldHeight: 1000,
      spawns: [
        { x: 180, y: 180 },
        { x: 1620, y: 180 },
        { x: 180, y: 820 },
        { x: 1620, y: 820 },
        { x: 180, y: 500 },
        { x: 1620, y: 500 }
      ],
      obstacles: [
        { x: 820, y: 150, w: 160, h: 220 },
        { x: 820, y: 630, w: 160, h: 220 },
        { x: 520, y: 420, w: 760, h: 160 },
        { x: 300, y: 260, w: 180, h: 120 },
        { x: 1320, y: 620, w: 180, h: 120 }
      ]
    },
    {
      id: "fortress",
      name: "Fortress",
      description: "Benteng pusat dengan pintu masuk sempit.",
      accent: "#4da3ff",
      worldWidth: 1800,
      worldHeight: 1000,
      spawns: [
        { x: 180, y: 180 },
        { x: 1620, y: 180 },
        { x: 180, y: 820 },
        { x: 1620, y: 820 },
        { x: 180, y: 500 },
        { x: 1620, y: 500 }
      ],
      obstacles: [
        { x: 650, y: 220, w: 500, h: 70 },
        { x: 650, y: 710, w: 500, h: 70 },
        { x: 650, y: 220, w: 70, h: 560 },
        { x: 1080, y: 220, w: 70, h: 560 },
        { x: 770, y: 360, w: 260, h: 70 },
        { x: 770, y: 530, w: 260, h: 70 }
      ]
    },
    {
      id: "split_valley",
      name: "Split Valley",
      description: "Arena terbelah dua. Banyak sudut buat flank.",
      accent: "#48d46d",
      worldWidth: 1800,
      worldHeight: 1000,
      spawns: [
        { x: 200, y: 150 },
        { x: 1600, y: 150 },
        { x: 200, y: 850 },
        { x: 1600, y: 850 },
        { x: 180, y: 500 },
        { x: 1620, y: 500 }
      ],
      obstacles: [
        { x: 520, y: 120, w: 110, h: 260 },
        { x: 1170, y: 620, w: 110, h: 260 },
        { x: 720, y: 320, w: 360, h: 80 },
        { x: 720, y: 600, w: 360, h: 80 },
        { x: 330, y: 500, w: 220, h: 70 },
        { x: 1250, y: 330, w: 220, h: 70 }
      ]
    },
    {
      id: "maze_ruins",
      name: "Maze Ruins",
      description: "Lorong sempit dan ruangan kecil yang suka bikin salah arah.",
      accent: "#ffd24d",
      worldWidth: 1800,
      worldHeight: 1000,
      spawns: [
        { x: 160, y: 160 },
        { x: 1640, y: 160 },
        { x: 160, y: 840 },
        { x: 1640, y: 840 },
        { x: 160, y: 500 },
        { x: 1640, y: 500 }
      ],
      obstacles: [
        { x: 260, y: 180, w: 160, h: 70 }, { x: 460, y: 180, w: 70, h: 300 },
        { x: 260, y: 410, w: 230, h: 70 }, { x: 620, y: 180, w: 160, h: 70 },
        { x: 860, y: 180, w: 70, h: 330 }, { x: 960, y: 440, w: 220, h: 70 },
        { x: 1260, y: 180, w: 160, h: 70 }, { x: 1260, y: 260, w: 70, h: 300 },
        { x: 1360, y: 520, w: 220, h: 70 }, { x: 280, y: 610, w: 220, h: 70 },
        { x: 560, y: 610, w: 70, h: 220 }, { x: 720, y: 760, w: 360, h: 70 },
        { x: 1160, y: 660, w: 160, h: 70 }, { x: 1400, y: 720, w: 70, h: 180 }
      ]
    },
    {
      id: "chaos_field",
      name: "Chaos Field",
      description: "Obstacle acak di mana-mana. Susah ditebak, susah kabur.",
      accent: "#bb86fc",
      worldWidth: 1800,
      worldHeight: 1000,
      spawns: [
        { x: 200, y: 150 },
        { x: 1600, y: 150 },
        { x: 200, y: 850 },
        { x: 1600, y: 850 },
        { x: 900, y: 160 },
        { x: 900, y: 840 }
      ],
      obstacles: [
        { x: 280, y: 250, w: 120, h: 120 }, { x: 470, y: 170, w: 100, h: 260 },
        { x: 710, y: 260, w: 140, h: 140 }, { x: 930, y: 170, w: 120, h: 220 },
        { x: 1170, y: 250, w: 180, h: 80 }, { x: 1470, y: 200, w: 100, h: 280 },
        { x: 250, y: 620, w: 180, h: 80 }, { x: 520, y: 720, w: 120, h: 150 },
        { x: 770, y: 640, w: 170, h: 120 }, { x: 1040, y: 700, w: 140, h: 150 },
        { x: 1310, y: 610, w: 220, h: 80 }, { x: 1480, y: 760, w: 100, h: 120 }
      ]
    }
  ];

  function getTankMapChoices() {
    return [
      ...maps,
      {
        id: "random",
        name: "Random Map",
        description: "Map dipilih acak saat game dimulai.",
        accent: "#ffffff",
        random: true
      }
    ];
  }

  function getTankMapById(mapId) {
    return maps.find((m) => m.id === mapId) || maps[0];
  }

  function resolveTankMapChoice(choiceId) {
    if (choiceId === "random") {
      return maps[Math.floor(Math.random() * maps.length)];
    }
    return getTankMapById(choiceId);
  }

  return {
    maps,
    getTankMapChoices,
    getTankMapById,
    resolveTankMapChoice
  };
});
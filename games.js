//Untuk daftar game

module.exports = [
  {
    id: "tank",
    name: "Tank Battle",
    description: "Last man standing tank battle",
    playable: true,
    client: {
      css: "/games/tank/tank.css",
      js: "/games/tank/tank.js"
    }
  },
  {
    id: "dodge",
    name: "Dodge Arena",
    description: "Coming soon",
    playable: false,
    client: {
      css: "",
      js: ""
    }
  },
  {
    id: "push",
    name: "Push Arena",
    description: "Coming soon",
    playable: false,
    client: {
      css: "",
      js: ""
    }
  }
];
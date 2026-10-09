// ============================================================
// UNITS — PassGO! English A2 · City Adventure  (edit links here)
// Each unit has a list of resources. A resource can be:
//   { kind:"video",  title, youtube:"VIDEO_ID" }      -> YouTube player in the window
//   { kind:"video",  title, youtube:null }            -> "Coming soon" card
//   { kind:"link",   title, url, label, note }        -> big button, opens in a new tab
// kind also chooses the icon: activity · game · quiz · reading · app · test
// Positions on the map live in js/world-data.js (generated).
// ============================================================

const WELCOME_VIDEO = { youtube: "Lo69E6qN5To", title: "Welcome to PassGO!" };

const UNITS = [
  {
    id: 1, emoji: "🏨", title: "Hotel", stamp: "assets/stamps/unit1.webp", color: "#1d5fc8",
    goal: "Check in, ask for a room and talk about what a hotel has.",
    words: ["🛏️ room", "🔑 key", "🛎️ reception", "🧳 suitcase", "🏊 swimming pool", "📝 check in"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "activity", title: "Hotel activity", label: "Open the activity", url: "https://view.genially.com/6a4d299efafec6adb3abe06d" },
      { kind: "game", title: "Hotel game", label: "Play on Kahoot!", url: "https://kahoot.it/solo/06900128?challenge-id=eb977722-9b6d-4d2e-acf5-c49ac5628d78_1783445455310" }
    ],
    badge: "Hotel Explorer", xp: 100
  },
  {
    id: 2, emoji: "🍽️", title: "Restaurant", stamp: "assets/stamps/unit2.webp", color: "#d0452a",
    goal: "Read a menu, order food and drinks, and ask for the bill.",
    words: ["📋 menu", "🧑‍🍳 waiter", "🍝 main course", "🥤 drink", "🍰 dessert", "🧾 the bill"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "activity", title: "Restaurant vocabulary", label: "Open the activity", url: "https://www.educaplay.com/learning-resources/17721248-restaurant_vocabulary.html" },
      { kind: "game", title: "Role-play at the restaurant", label: "Play on Wordwall", url: "https://wordwall.net/es/resource/28673073/role-play-at-the-restaurant" }
    ],
    badge: "Master Chef", xp: 100
  },
  {
    id: 3, emoji: "🚌", title: "Transportation", stamp: "assets/stamps/unit3.webp", color: "#1f8a4c",
    goal: "Travel around the city: buses, trains and the airport.",
    words: ["🚌 bus", "🚆 train", "✈️ airport", "🎫 ticket", "🛂 passport", "🧳 luggage"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "activity", title: "Airport vocabulary", label: "Open the flash cards", url: "https://quizlet.com/co/1193786282/airport-vocabulary-flash-cards/?i=77pbjx&x=1qqt" },
      { kind: "game", title: "At the airport", label: "Play on Wordwall", url: "https://wordwall.net/resource/115943083/at-the-airport" }
    ],
    badge: "City Traveller", xp: 100
  },
  {
    id: 4, emoji: "🛍️", title: "Shopping", stamp: "assets/stamps/unit4.webp", color: "#7d2ea8",
    goal: "Buy things, ask prices and talk about clothes and sizes.",
    words: ["👕 T-shirt", "👟 shoes", "💲 How much is it?", "📏 size", "🏷️ cheap", "💎 expensive"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "activity", title: "Shopping vocabulary adventure", label: "Open the activity", url: "https://www.educaplay.com/learning-resources/29859101-shopping_vocabulary_adventure.html" },
      { kind: "quiz", title: "Shopping quiz", label: "Answer the quiz", url: "https://docs.google.com/forms/d/e/1FAIpQLSd_g96momOpjFLgqdaV7Mcec6FwhVlXYHFbTiD8bwVPaUMCaA/viewform" }
    ],
    badge: "Smart Shopper", xp: 100
  },
  {
    id: 5, emoji: "📷", title: "Tourist Attractions", stamp: "assets/stamps/unit5.webp", color: "#14899a",
    goal: "Visit famous places and describe your city.",
    words: ["🏛️ museum", "⛪ church", "🏰 castle", "🗺️ map", "📸 photo", "🎟️ tour"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "reading", title: "Reading: My city", label: "Read the text", url: "https://learnenglishteens.britishcouncil.org/skills/reading/a2-reading/my-city" },
      { kind: "app", title: "Listen & complete", label: "Open LingoClip", url: "https://lingoclip.app/play/Bm6A5L4?level=b1&mode=mc&type=fitb#safe" },
      { kind: "game", title: "Word search", label: "Play the word search", url: "https://wordsearchlabs.com/view/1743302" }
    ],
    badge: "Tour Guide", xp: 100
  },
  {
    id: 6, emoji: "⭐", title: "Final Challenge", stamp: "assets/stamps/unit6.webp", color: "#d98a12",
    goal: "Show everything you learned in the city!",
    words: ["🏨 hotel", "🍽️ restaurant", "🚌 transport", "🛍️ shopping", "📷 sightseeing", "🏆 champion"],
    resources: [
      { kind: "video", title: "Watch & learn", youtube: null },
      { kind: "test", title: "Final test", label: "Start the final test", url: "https://passporttravelenglishadventure.my.canva.site/quizinteractivo" }
    ],
    badge: "English A2 Master", xp: 200, isFinal: true
  }
];

// the two explorer teams
const TEAMS = {
  nico:   { kid: "nico",   bird: "luma", kidName: "Nico",   birdName: "Luma", motto: "Brave together!",
            voice: "assets/audio/brave-together.mp3", color: "#2f7d46", glow: "#ffd35a" },
  massie: { kid: "massie", bird: "luna", kidName: "Massie", birdName: "Luna", motto: "More friends, more discoveries!",
            voice: "assets/audio/more-friends.mp3", color: "#d6457b", glow: "#ffb3d1" }
};

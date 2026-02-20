// Services basieren auf der Salon-Liste (Demo). Preise „ab“.
// Quelle: Salonkee Snippet (Parrylicious Hair Artist) – kann später im Admin Panel gepflegt werden.

export const services = [
  {
    id: "dreadlocs_retwist",
    name: "Dreadlocs – Interlocking / Retwist + Styling",
    category: "Locs & Dreads",
    tags: ["locs"],
    priceFrom: 55,
    durationMin: 120,
    deposit: 30,
    description: "Retwist/Interlocking inkl. Styling – Zusatzkosten bei sehr dickem oder ungekämmtem Haar möglich."
  },
  {
    id: "instant_locs",
    name: "Häckeln – Instant Locs",
    category: "Locs & Dreads",
    tags: ["locs"],
    priceFrom: 100,
    durationMin: 180,
    deposit: 40,
    description: "Instant Locs per Häkeltechnik."
  },
  {
    id: "starter_locs",
    name: "Starter-Locs (Unisex) + Barrel / Twist / Open",
    category: "Locs & Dreads",
    tags: ["locs","twists"],
    priceFrom: 65,
    durationMin: 150,
    deposit: 35,
    description: "Perfekter Start für permanente Locs – Zusatzkosten bei aufwändigem Haarzustand möglich."
  },
  {
    id: "plain_twist_braids",
    name: "Plain Twist & Braids",
    category: "Twists",
    tags: ["twists","braids"],
    priceFrom: 60,
    durationMin: 120,
    deposit: 30,
    description: "Klassische Twists/Braids – clean & elegant."
  },
  {
    id: "comb_twist",
    name: "Comb Twist",
    category: "Twists",
    tags: ["twists"],
    priceFrom: 45,
    durationMin: 90,
    deposit: 25,
    description: "Schneller Twist-Look – ideal für Definition."
  },
  {
    id: "cornrows",
    name: "Cornrows / Twistn´Cornrows",
    category: "Braids",
    tags: ["braids"],
    priceFrom: 60,
    durationMin: 120,
    deposit: 30,
    description: "Cornrows & Kombi-Styles – je nach Anzahl der Reihen."
  },
  {
    id: "ponytail_europe",
    name: "Europe Hair Braided Ponytail",
    category: "Ponytails",
    tags: ["ponytails","braids"],
    priceFrom: 65,
    durationMin: 120,
    deposit: 30,
    description: "Braided Ponytail mit Europe Hair."
  },
  {
    id: "ponytail_afrohair",
    name: "Afrohair Braided Ponytail",
    category: "Ponytails",
    tags: ["ponytails","braids"],
    priceFrom: 65,
    durationMin: 120,
    deposit: 30,
    description: "Braided Ponytail mit Afrohair."
  },
  {
    id: "half_down_half_up",
    name: "Half down Half up",
    category: "Ponytails",
    tags: ["ponytails"],
    priceFrom: 70,
    durationMin: 150,
    deposit: 35,
    description: "Half up / Half down – elegant, editorial."
  },
  {
    id: "braids_feed_in",
    name: "Braids (Boho) / Feed‑In Cornrows",
    category: "Braids",
    tags: ["braids"],
    priceFrom: 90,
    durationMin: 180,
    deposit: 40,
    description: "Boho Braids oder Feed‑In Cornrows."
  },
  {
    id: "passion_twist",
    name: "Passion Twist",
    category: "Twists",
    tags: ["twists"],
    priceFrom: 110,
    durationMin: 180,
    deposit: 40,
    description: "Passion Twists – weicher, voluminöser Look."
  }
];

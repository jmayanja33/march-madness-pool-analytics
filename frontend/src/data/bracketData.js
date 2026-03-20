// 2026 NCAA Tournament bracket data.
// Team names match predictions.json keys exactly so API lookups succeed.

// First Four matchups — four play-in games before the Round of 64.
// 'destination' describes which bracket slot the winner earns.
export const FIRST_FOUR_2026 = [
  {
    id: 'ff-west-11',
    teamA: { seed: 11, name: 'Texas' },
    teamB: { seed: 11, name: 'NC State' },
    destination: 'West 11',
  },
  {
    id: 'ff-midwest-11',
    teamA: { seed: 11, name: 'Miami (OH)' },
    teamB: { seed: 11, name: 'SMU' },
    destination: 'Midwest 11',
  },
  {
    id: 'ff-south-16',
    teamA: { seed: 16, name: 'Lehigh' },
    teamB: { seed: 16, name: 'Prairie View A&M' },
    destination: 'South 16',
  },
  {
    id: 'ff-midwest-16',
    teamA: { seed: 16, name: 'Howard' },
    teamB: { seed: 16, name: 'UMBC' },
    destination: 'Midwest 16',
  },
];

// 2026 tournament results — updated through Round of 64.
//
// firstFour: maps each First Four game id → the winner's name.
//   Used by Bracket.jsx to highlight the winning team in each First Four pairing.
//
// Per-region keys: each region object contains:
//   r64Winners — teams that won their Round of 64 game (used to green-outline
//                their slot in the Round of 64 column).
//   r32        — teams that advanced after winning a Round of 32 game (empty
//                until that round is played; drives the Round of 32 column).
//   s16/e8/f4  — analogous for later rounds.
export const RESULTS_2026 = {
  firstFour: {
    'ff-west-11':   'Texas',
    'ff-midwest-11': 'Miami (OH)',
    'ff-south-16':  'Prairie View A&M',
    'ff-midwest-16': 'Howard',
  },
  // r32 arrays are positionally ordered to match R32 bracket slots:
  // slot 0 = winner of (1v16), slot 1 = winner of (8v9), slot 2 = winner of (5v12),
  // slot 3 = winner of (4v13), slot 4 = winner of (6v11), slot 5 = winner of (3v14),
  // slot 6 = winner of (7v10), slot 7 = winner of (2v15).
  // null means that R64 game has not yet been played.
  East: {
    r64Winners: ['Duke', 'Michigan State', 'Louisville', 'TCU'],
    //              1v16    8v9    5v12   4v13        6v11          3v14            7v10   2v15
    r32: ['Duke', 'TCU',  null,  null, 'Louisville', 'Michigan State', null,   null],
    s16: [], e8: [], f4: null,
  },
  West: {
    r64Winners: ['Arkansas', 'High Point', 'Texas', 'Gonzaga', 'Arizona'],
    //             1v16   8v9    5v12         4v13       6v11    3v14   7v10   2v15
    r32: ['Arizona',   null, 'High Point', 'Arkansas', 'Texas',  'Gonzaga',  null,  null],
    s16: [], e8: [], f4: null,
  },
  South: {
    r64Winners: ['Houston', 'Illinois', 'Nebraska', 'Vanderbilt', 'VCU', 'Texas A&M'],
    //             1v16   8v9       5v12          4v13      6v11   3v14       7v10          2v15
    r32: [null,   null, 'Vanderbilt', 'Nebraska', 'VCU', 'Illinois', 'Texas A&M', 'Houston'],
    s16: [], e8: [], f4: null,
  },
  Midwest: {
    r64Winners: ['Michigan', 'Saint Louis', 'Virginia', 'Texas Tech', 'Kentucky'],
    //               1v16          8v9     5v12   4v13   6v11   3v14   7v10   2v15
    r32: ['Michigan', 'Saint Louis', null,  'Texas Tech',  null,  'Virginia',  'Kentucky',  null],
    s16: [], e8: [], f4: null,
  },
};

// Main bracket — 16 teams per region, seeded 1–16.
//
// First Four slots use a "Team A/Team B" slash notation in the main bracket
// to indicate the two teams competing for that seed position.
// West 11  → Texas vs. NC State winner
// Midwest 11 → Miami (OH) vs. SMU winner
// South 16 → Lehigh vs. Prairie View A&M winner
// Midwest 16 → Howard vs. UMBC winner
export const BRACKET_2026 = {
  East: [
    { seed: 1,  name: 'Duke' },
    { seed: 2,  name: 'UConn' },
    { seed: 3,  name: 'Michigan State' },
    { seed: 4,  name: 'Kansas' },
    { seed: 5,  name: "St. John's" },
    { seed: 6,  name: 'Louisville' },
    { seed: 7,  name: 'UCLA' },
    { seed: 8,  name: 'Ohio State' },
    { seed: 9,  name: 'TCU' },
    { seed: 10, name: 'UCF' },
    { seed: 11, name: 'South Florida' },
    { seed: 12, name: 'Northern Iowa' },
    { seed: 13, name: 'California Baptist' },
    { seed: 14, name: 'North Dakota State' },
    { seed: 15, name: 'Furman' },
    { seed: 16, name: 'Siena' },
  ],
  West: [
    { seed: 1,  name: 'Arizona' },
    { seed: 2,  name: 'Purdue' },
    { seed: 3,  name: 'Gonzaga' },
    { seed: 4,  name: 'Arkansas' },
    { seed: 5,  name: 'Wisconsin' },
    { seed: 6,  name: 'BYU' },
    { seed: 7,  name: 'Miami' },
    { seed: 8,  name: 'Villanova' },
    { seed: 9,  name: 'Utah State' },
    { seed: 10, name: 'Missouri' },
    { seed: 11, name: 'Texas' },              // First Four winner (beat NC State)
    { seed: 12, name: 'High Point' },
    { seed: 13, name: "Hawai'i" },
    { seed: 14, name: 'Kennesaw State' },
    { seed: 15, name: 'Queens University' },
    { seed: 16, name: 'Long Island University' },
  ],
  South: [
    { seed: 1,  name: 'Florida' },
    { seed: 2,  name: 'Houston' },
    { seed: 3,  name: 'Illinois' },
    { seed: 4,  name: 'Nebraska' },
    { seed: 5,  name: 'Vanderbilt' },
    { seed: 6,  name: 'North Carolina' },
    { seed: 7,  name: "Saint Mary's" },
    { seed: 8,  name: 'Clemson' },
    { seed: 9,  name: 'Iowa' },
    { seed: 10, name: 'Texas A&M' },
    { seed: 11, name: 'VCU' },
    { seed: 12, name: 'McNeese' },
    { seed: 13, name: 'Troy' },
    { seed: 14, name: 'Pennsylvania' },
    { seed: 15, name: 'Idaho' },
    { seed: 16, name: 'Prairie View A&M' },         // First Four winner (beat Lehigh)
  ],
  Midwest: [
    { seed: 1,  name: 'Michigan' },
    { seed: 2,  name: 'Iowa State' },
    { seed: 3,  name: 'Virginia' },
    { seed: 4,  name: 'Alabama' },
    { seed: 5,  name: 'Texas Tech' },
    { seed: 6,  name: 'Tennessee' },
    { seed: 7,  name: 'Kentucky' },
    { seed: 8,  name: 'Georgia' },
    { seed: 9,  name: 'Saint Louis' },
    { seed: 10, name: 'Santa Clara' },
    { seed: 11, name: 'Miami (OH)' },       // First Four winner (beat SMU)
    { seed: 12, name: 'Akron' },
    { seed: 13, name: 'Hofstra' },
    { seed: 14, name: 'Wright State' },
    { seed: 15, name: 'Tennessee State' },
    { seed: 16, name: 'Howard' },           // First Four winner (beat UMBC)
  ],
};

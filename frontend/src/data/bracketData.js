// 2025 NCAA Tournament bracket data.
// Team names match predictions.json keys exactly so API lookups succeed.

// First Four matchups — four play-in games before the Round of 64.
// 'destination' describes which bracket slot the winner earns.
export const FIRST_FOUR_2025 = [
  {
    id: 'ff-south-16',
    teamA: { seed: 16, name: 'Alabama State' },
    teamB: { seed: 16, name: 'St. Francis (PA)' },
    destination: 'South 16',
  },
  {
    id: 'ff-east-16',
    teamA: { seed: 16, name: 'American University' },
    teamB: { seed: 16, name: "Mount St. Mary's" },
    destination: 'East 16',
  },
  {
    id: 'ff-south-11',
    teamA: { seed: 11, name: 'San Diego State' },
    teamB: { seed: 11, name: 'North Carolina' },
    destination: 'South 11',
  },
  {
    id: 'ff-midwest-11',
    teamA: { seed: 11, name: 'Texas' },
    teamB: { seed: 11, name: 'Xavier' },
    destination: 'Midwest 11',
  },
];

// Main bracket — 16 teams per region, seeded 1–16.
// East 16 and Midwest 11 slots are filled by First Four winners; the First Four
// losers (American University, Mount St. Mary's, Texas, Xavier) still appear
// in the First Four band and are clickable for analytics.
export const BRACKET_2025 = {
  East: [
    { seed: 1,  name: 'Duke' },
    { seed: 2,  name: 'Alabama' },
    { seed: 3,  name: 'Wisconsin' },
    { seed: 4,  name: 'Arizona' },
    { seed: 5,  name: 'Oregon' },
    { seed: 6,  name: 'BYU' },
    { seed: 7,  name: "Saint Mary's" },
    { seed: 8,  name: 'Mississippi State' },
    { seed: 9,  name: 'Baylor' },
    { seed: 10, name: 'Vanderbilt' },
    { seed: 11, name: 'VCU' },
    { seed: 12, name: 'Liberty' },
    { seed: 13, name: 'Akron' },
    { seed: 14, name: 'Montana' },
    { seed: 15, name: 'Robert Morris' },
    { seed: 16, name: "Mount St. Mary's" }, // First Four winner (vs American University)
  ],
  West: [
    { seed: 1,  name: 'Florida' },
    { seed: 2,  name: "St. John's" },
    { seed: 3,  name: 'Texas Tech' },
    { seed: 4,  name: 'Maryland' },
    { seed: 5,  name: 'Memphis' },
    { seed: 6,  name: 'Missouri' },
    { seed: 7,  name: 'Kansas' },
    { seed: 8,  name: 'UConn' },
    { seed: 9,  name: 'Oklahoma' },
    { seed: 10, name: 'Arkansas' },
    { seed: 11, name: 'Drake' },
    { seed: 12, name: 'Colorado State' },
    { seed: 13, name: 'Grand Canyon' },
    { seed: 14, name: 'UNC Wilmington' },
    { seed: 15, name: 'Omaha' },
    { seed: 16, name: 'Norfolk State' },
  ],
  South: [
    { seed: 1,  name: 'Auburn' },
    { seed: 2,  name: 'Michigan State' },
    { seed: 3,  name: 'Iowa State' },
    { seed: 4,  name: 'Texas A&M' },
    { seed: 5,  name: 'Michigan' },
    { seed: 6,  name: 'Ole Miss' },
    { seed: 7,  name: 'Marquette' },
    { seed: 8,  name: 'Louisville' },
    { seed: 9,  name: 'Creighton' },
    { seed: 10, name: 'New Mexico' },
    { seed: 11, name: 'North Carolina' }, // First Four winner (vs San Diego State)
    { seed: 12, name: 'UC San Diego' },
    { seed: 13, name: 'Yale' },
    { seed: 14, name: 'Lipscomb' },
    { seed: 15, name: 'Bryant' },
    { seed: 16, name: 'Alabama State' },  // First Four winner (vs St. Francis PA)
  ],
  Midwest: [
    { seed: 1,  name: 'Houston' },
    { seed: 2,  name: 'Tennessee' },
    { seed: 3,  name: 'Kentucky' },
    { seed: 4,  name: 'Purdue' },
    { seed: 5,  name: 'Clemson' },
    { seed: 6,  name: 'Illinois' },
    { seed: 7,  name: 'UCLA' },
    { seed: 8,  name: 'Gonzaga' },
    { seed: 9,  name: 'Georgia' },
    { seed: 10, name: 'Utah State' },
    { seed: 11, name: 'Xavier' },         // First Four winner (vs Texas)
    { seed: 12, name: 'McNeese' },
    { seed: 13, name: 'High Point' },
    { seed: 14, name: 'Troy' },
    { seed: 15, name: 'Wofford' },
    { seed: 16, name: 'SIU Edwardsville' },
  ],
};

/*
 * VR.data.rooms: hand-authored rooms as ASCII maps. Owner: level-builder (seeded by proto-architect in M1).
 *
 * Legend (one character per tile; VR.world parses it):
 *   #  wall          .  floor        W  breakable window    (space) void, nothing drawn
 *   h  half cover    F  full cover   c  destructible crate
 *   D  entry door    1 2  exit doors P  player start
 *   g  grunt         r  rusher       n  gunner              H  heavy
 * Spawn and door characters stand on floor; they are listed in VR.world.spawns.
 * Room metadata:
 *   exits  { '1': rewardType, '2': rewardType }  reward icon on each exit door (types in VR.data.upgrades.types);
 *          the reward is granted when the NEXT room is cleared
 *   final  true: last room; its exit door ends the run and grants no reward
 * Screen orientation: +x (columns) runs down-right, +y (rows) runs down-left; row 0 is the far top corner.
 */
window.VR = window.VR || {};
window.VR.data = window.VR.data || {};

window.VR.data.rooms = [
  {
    id: 'm1-test',
    name: 'M1 test bay',
    lesson: 'Walk, aim, check depth sorting and wall fade',
    map: [
      '##########WWWW##########',
      '#......................#',
      '#..c...........F.......1',
      '#..c......g............#',
      '#.......hhhh.......c...#',
      '#...g..............g...#',
      '#....F.........#####...#',
      '#..............#.......#',
      '#..........P...#...r...2',
      '#..............#..r....#',
      '#..hh..................#',
      '#..........F......hh...#',
      '#......................#',
      '#####......c...........#',
      '#...#..................#',
      '#......................#',
      '###########D############'
    ]
  },
  {
    id: 'room1-intro',
    exits: { '1': 'offense', '2': 'mobility' },
    name: 'Intro bay',
    lesson: 'One-hit kills and the shotgun; crates are cover you can shoot through',
    map: [
      '########################',
      '#......................#',
      '#...g..............c...1',
      '#......................#',
      '#..c.........g.........#',
      '#......................#',
      '#..........c...........#',
      '#......g...............#',
      '#......................#',
      '#..............c.......2',
      '#......................#',
      '#......................#',
      '#..........P...........#',
      '###########D############'
    ]
  },
  {
    id: 'room2-cover',
    exits: { '1': 'defense', '2': 'offense' },
    name: 'Cover deck',
    lesson: 'Gunners hold the half-cover line: flank, or pop out and shoot',
    map: [
      '########################',
      '#......................#',
      '#......................1',
      '#....n.........n.......#',
      '#...hhhh.....hhhh......#',
      '#......................#',
      '#..g..........F....g...#',
      '#......................#',
      '#...c..............c...#',
      '#......................2',
      '#......................#',
      '#..........P...........#',
      '###########D############'
    ]
  },
  {
    id: 'room3-breach',
    exits: { '1': 'mobility', '2': 'defense' },
    name: 'Breach hall',
    lesson: 'Enemies bunch under the window wall: shoot the glass to blow them out, or thin them from cover',
    map: [
      '######WWWWWWWWWWWW######',
      '#......................#',
      '#.......g..g..g........#',
      '#........g...r.........#',
      '#......................#',
      '#...hh..........hh.....#',
      '#......................1',
      '#......................#',
      '#..c..............c....#',
      '2......................#',
      '#......................#',
      '#..........P...........#',
      '###########D############'
    ]
  },
  {
    id: 'room4-rushers',
    exits: { '1': 'offense', '2': 'defense' },
    name: 'Rush corridor',
    lesson: 'Rushers ignore cover and flush you out: kill them as they close, dash through, then deal with the gunner',
    map: [
      '########################',
      '#......................#',
      '#..r..................r#',
      '#..........n...........#',
      '#........hhhh..........1',
      '#......................#',
      '#.....F..........F.....#',
      '#.r..................r.#',
      '2......................#',
      '#...c..............c...#',
      '#......................#',
      '#......................#',
      '#..........P...........#',
      '###########D############'
    ]
  },
  {
    id: 'room5-elite',
    final: true,
    exits: { '1': 'extract' },
    name: 'Elite bay',
    lesson: 'Everything at once: shoot the window to space the heavy, or flank it while the gunners are pinned',
    map: [
      '##########WWW###########',
      '#......................#',
      '#...n..........n.......#',
      '#..hhhh...H....hhhh....#',
      '#......................#',
      '#.r..................r.#',
      '#.........F....F.......#',
      '#......................#',
      '#...c..............c...#',
      '#......................#',
      '#.........F....F.......#',
      '#......................1',
      '#..........P...........#',
      '###########D############'
    ]
  }
];

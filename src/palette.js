// Cartographer's Folio palette and rendering tokens.
// Keep in sync with CSS custom properties in styles.css.

export const COLORS = {
  parchment:      '#ede0c4',
  parchmentLight: '#f4ead0',
  parchmentDark:  '#c9b894',
  parchmentInk:   '#bca87d',
  ironGall:       '#2b1810',
  sepia:          '#6b4423',
  lapis:          '#1d4e89',
  vermillion:     '#d94f04',
  verdigris:      '#43a35f',
  goldLeaf:       '#b8943a',
};

export const ALGO_META = {
  bfs: {
    name: 'Breadth-First Reconnaissance',
    color: COLORS.lapis,
    pattern: 'stipple',
    optimal: true,
    complexity: 'O(V + E)',
    roman: 'I',
  },
  astar: {
    name: 'A-Star Voyage',
    color: COLORS.vermillion,
    pattern: 'solid',
    optimal: true,
    complexity: 'O(E log V)',
    roman: 'II',
  },
  dfs: {
    name: 'Depth-First Plunge',
    color: COLORS.verdigris,
    pattern: 'hatch',
    optimal: false,
    complexity: 'O(V + E)',
    roman: 'III',
  },
};

export const ALGOS_ORDER = ['bfs', 'astar', 'dfs'];

// rough.js options used throughout
export const ROUGH_WALL = {
  roughness: 1.4,
  bowing: 1.1,
  stroke: COLORS.ironGall,
  strokeWidth: 1.6,
  disableMultiStroke: false,
};

export const ROUGH_SOLUTION = {
  roughness: 1.2,
  bowing: 0.8,
  strokeWidth: 3.2,
  disableMultiStroke: true,
};

export const PAGE_MAX_HEXES = 280;

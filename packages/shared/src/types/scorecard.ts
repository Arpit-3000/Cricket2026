/**
 * Professional cricket scorecard data structures conforming to international broadcast standards.
 */

export interface BattingScorecardEntry {
  playerId: string;
  playerName: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  isOut: boolean;
  dismissalDescription: string; // e.g. "c Maxwell b Starc" or "not out"
  onStrike: boolean;
}

export interface BowlingScorecardEntry {
  playerId: string;
  playerName: string;
  overs: string; // e.g. "1.4"
  legalBalls: number;
  maidens: number;
  runsConceded: number;
  wickets: number;
  economy: number;
  dotBalls: number;
  wides: number;
  noBalls: number;
}

export interface FallOfWicketEntry {
  wicketNumber: number;
  teamScore: number;
  overs: string;
  batterName: string;
}

export interface ExtrasBreakdown {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
  total: number;
}

export interface InningsScorecard {
  inningsIndex: 1 | 2;
  battingTeamId: 'TEAM_A' | 'TEAM_B';
  bowlingTeamId: 'TEAM_A' | 'TEAM_B';
  runs: number;
  wickets: number;
  oversCompleted: number; // 0 to 5
  ballsInCurrentOver: number; // 0 to 6
  runRate: number;
  requiredRunRate?: number | null;
  target?: number | null;
  extras: ExtrasBreakdown;
  batters: BattingScorecardEntry[];
  bowlers: BowlingScorecardEntry[];
  fallOfWickets: FallOfWicketEntry[];
  currentPartnershipRuns: number;
  currentPartnershipBalls: number;
}

export interface MatchScorecard {
  roomId: string;
  innings: [InningsScorecard, InningsScorecard?];
  currentInningsIndex: 1 | 2;
  matchResultCommentary?: string;
  isCompleted: boolean;
}

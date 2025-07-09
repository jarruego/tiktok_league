import { relations } from "drizzle-orm/relations";
import { coaches, teams, divisions, leagues, teamLeagueAssignments, seasons, players, matches, standings } from "./schema";

export const teamsRelations = relations(teams, ({one, many}) => ({
	coach: one(coaches, {
		fields: [teams.coachId],
		references: [coaches.id]
	}),
	teamLeagueAssignments: many(teamLeagueAssignments),
	players: many(players),
	matches_homeTeamId: many(matches, {
		relationName: "matches_homeTeamId_teams_id"
	}),
	matches_awayTeamId: many(matches, {
		relationName: "matches_awayTeamId_teams_id"
	}),
	standings: many(standings),
}));

export const coachesRelations = relations(coaches, ({many}) => ({
	teams: many(teams),
}));

export const leaguesRelations = relations(leagues, ({one, many}) => ({
	division: one(divisions, {
		fields: [leagues.divisionId],
		references: [divisions.id]
	}),
	teamLeagueAssignments: many(teamLeagueAssignments),
	matches: many(matches),
	standings: many(standings),
}));

export const divisionsRelations = relations(divisions, ({many}) => ({
	leagues: many(leagues),
}));

export const teamLeagueAssignmentsRelations = relations(teamLeagueAssignments, ({one}) => ({
	team: one(teams, {
		fields: [teamLeagueAssignments.teamId],
		references: [teams.id]
	}),
	league: one(leagues, {
		fields: [teamLeagueAssignments.leagueId],
		references: [leagues.id]
	}),
	season: one(seasons, {
		fields: [teamLeagueAssignments.seasonId],
		references: [seasons.id]
	}),
}));

export const seasonsRelations = relations(seasons, ({many}) => ({
	teamLeagueAssignments: many(teamLeagueAssignments),
	matches: many(matches),
	standings: many(standings),
}));

export const playersRelations = relations(players, ({one}) => ({
	team: one(teams, {
		fields: [players.teamId],
		references: [teams.id]
	}),
}));

export const matchesRelations = relations(matches, ({one}) => ({
	season: one(seasons, {
		fields: [matches.seasonId],
		references: [seasons.id]
	}),
	league: one(leagues, {
		fields: [matches.leagueId],
		references: [leagues.id]
	}),
	team_homeTeamId: one(teams, {
		fields: [matches.homeTeamId],
		references: [teams.id],
		relationName: "matches_homeTeamId_teams_id"
	}),
	team_awayTeamId: one(teams, {
		fields: [matches.awayTeamId],
		references: [teams.id],
		relationName: "matches_awayTeamId_teams_id"
	}),
}));

export const standingsRelations = relations(standings, ({one}) => ({
	season: one(seasons, {
		fields: [standings.seasonId],
		references: [seasons.id]
	}),
	league: one(leagues, {
		fields: [standings.leagueId],
		references: [leagues.id]
	}),
	team: one(teams, {
		fields: [standings.teamId],
		references: [teams.id]
	}),
}));
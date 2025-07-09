import { pgTable, serial, integer, varchar, jsonb, timestamp, boolean, foreignKey, text, unique, uniqueIndex, date } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const footballDataCache = pgTable("football_data_cache", {
	id: serial().primaryKey().notNull(),
	competitionId: integer("competition_id").notNull(),
	competitionName: varchar("competition_name", { length: 100 }).notNull(),
	competitionCode: varchar("competition_code", { length: 10 }).notNull(),
	rawData: jsonb("raw_data").notNull(),
	season: varchar({ length: 20 }).notNull(),
	teamsCount: integer("teams_count").notNull(),
	lastUpdated: timestamp("last_updated", { mode: 'string' }).defaultNow().notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const teams = pgTable("teams", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	tiktokId: varchar("tiktok_id", { length: 100 }).notNull(),
	followers: integer().default(0).notNull(),
	description: text(),
	lastScrapedAt: timestamp("last_scraped_at", { withTimezone: true, mode: 'string' }),
	displayName: varchar("display_name", { length: 100 }),
	following: integer().default(0),
	likes: integer().default(0),
	profileUrl: varchar("profile_url", { length: 500 }),
	avatarUrl: text("avatar_url"),
	footballDataId: integer("football_data_id"),
	shortName: varchar("short_name", { length: 50 }),
	tla: varchar({ length: 5 }),
	crest: text(),
	venue: varchar({ length: 200 }),
	founded: integer(),
	clubColors: varchar("club_colors", { length: 100 }),
	website: varchar({ length: 500 }),
	coachId: integer("coach_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	competitionId: integer("competition_id"),
	areaId: integer("area_id"),
	areaName: varchar("area_name", { length: 100 }),
	areaCode: varchar("area_code", { length: 10 }),
	areaFlag: text("area_flag"),
	failedScrapingAttempts: integer("failed_scraping_attempts").default(0),
	lastFailedAt: timestamp("last_failed_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "teams_coach_id_coaches_id_fk"
		}),
]);

export const divisions = pgTable("divisions", {
	id: serial().primaryKey().notNull(),
	level: integer().notNull(),
	name: varchar({ length: 100 }).notNull(),
	description: text(),
	totalLeagues: integer("total_leagues").notNull(),
	teamsPerLeague: integer("teams_per_league").default(20).notNull(),
	promoteSlots: integer("promote_slots").default(0),
	promotePlayoffSlots: integer("promote_playoff_slots").default(0),
	relegateSlots: integer("relegate_slots").default(0),
	tournamentSlots: integer("tournament_slots").default(0),
}, (table) => [
	unique("divisions_level_unique").on(table.level),
]);

export const leagues = pgTable("leagues", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	groupCode: varchar("group_code", { length: 10 }).notNull(),
	divisionId: integer("division_id").notNull(),
	maxTeams: integer("max_teams").default(20).notNull(),
	description: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.divisionId],
			foreignColumns: [divisions.id],
			name: "leagues_division_id_divisions_id_fk"
		}),
	unique("leagues_division_id_group_code_unique").on(table.groupCode, table.divisionId),
]);

export const teamLeagueAssignments = pgTable("team_league_assignments", {
	id: serial().primaryKey().notNull(),
	teamId: integer("team_id").notNull(),
	leagueId: integer("league_id").notNull(),
	seasonId: integer("season_id").notNull(),
	tiktokFollowersAtAssignment: integer("tiktok_followers_at_assignment").default(0),
	assignmentReason: integer("assignment_reason").default(0).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	uniqueIndex("team_season_unique").using("btree", table.teamId.asc().nullsLast().op("int4_ops"), table.seasonId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "team_league_assignments_team_id_teams_id_fk"
		}),
	foreignKey({
			columns: [table.leagueId],
			foreignColumns: [leagues.id],
			name: "team_league_assignments_league_id_leagues_id_fk"
		}),
	foreignKey({
			columns: [table.seasonId],
			foreignColumns: [seasons.id],
			name: "team_league_assignments_season_id_seasons_id_fk"
		}),
]);

export const seasons = pgTable("seasons", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	year: integer().notNull(),
	startDate: timestamp("start_date", { withTimezone: true, mode: 'string' }),
	endDate: timestamp("end_date", { withTimezone: true, mode: 'string' }),
	isActive: boolean("is_active").default(false),
	isCompleted: boolean("is_completed").default(false),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const coaches = pgTable("coaches", {
	id: serial().primaryKey().notNull(),
	footballDataId: integer("football_data_id"),
	name: varchar({ length: 100 }).notNull(),
	nationality: varchar({ length: 50 }),
	dateOfBirth: varchar("date_of_birth", { length: 20 }),
	contract: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const players = pgTable("players", {
	id: serial().primaryKey().notNull(),
	teamId: integer("team_id"),
	name: varchar({ length: 100 }).notNull(),
	position: varchar({ length: 50 }).notNull(),
	dateOfBirth: date("date_of_birth"),
	nationality: varchar({ length: 50 }),
	shirtNumber: integer("shirt_number"),
	role: varchar({ length: 20 }).default('PLAYER').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	footballDataId: integer("football_data_id"),
}, (table) => [
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "players_team_id_teams_id_fk"
		}),
]);

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	username: varchar({ length: 100 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 20 }).notNull(),
	displayName: varchar("display_name", { length: 100 }),
	avatar: varchar({ length: 255 }),
	provider: varchar({ length: 50 }),
}, (table) => [
	unique("users_username_unique").on(table.username),
]);

export const matches = pgTable("matches", {
	id: serial().primaryKey().notNull(),
	seasonId: integer("season_id").notNull(),
	leagueId: integer("league_id").notNull(),
	homeTeamId: integer("home_team_id").notNull(),
	awayTeamId: integer("away_team_id").notNull(),
	matchday: integer().notNull(),
	scheduledDate: date("scheduled_date").notNull(),
	status: varchar({ length: 20 }).default('scheduled').notNull(),
	homeGoals: integer("home_goals"),
	awayGoals: integer("away_goals"),
	notes: varchar({ length: 500 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	simulationDetails: varchar("simulation_details", { length: 1000 }),
}, (table) => [
	foreignKey({
			columns: [table.seasonId],
			foreignColumns: [seasons.id],
			name: "matches_season_id_seasons_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leagueId],
			foreignColumns: [leagues.id],
			name: "matches_league_id_leagues_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.homeTeamId],
			foreignColumns: [teams.id],
			name: "matches_home_team_id_teams_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.awayTeamId],
			foreignColumns: [teams.id],
			name: "matches_away_team_id_teams_id_fk"
		}).onDelete("cascade"),
]);

export const standings = pgTable("standings", {
	id: serial().primaryKey().notNull(),
	seasonId: integer("season_id").notNull(),
	leagueId: integer("league_id").notNull(),
	teamId: integer("team_id").notNull(),
	position: integer().notNull(),
	played: integer().default(0).notNull(),
	won: integer().default(0).notNull(),
	drawn: integer().default(0).notNull(),
	lost: integer().default(0).notNull(),
	goalsFor: integer("goals_for").default(0).notNull(),
	goalsAgainst: integer("goals_against").default(0).notNull(),
	goalDifference: integer("goal_difference").default(0).notNull(),
	points: integer().default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.seasonId],
			foreignColumns: [seasons.id],
			name: "standings_season_id_seasons_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.leagueId],
			foreignColumns: [leagues.id],
			name: "standings_league_id_leagues_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.teamId],
			foreignColumns: [teams.id],
			name: "standings_team_id_teams_id_fk"
		}).onDelete("cascade"),
]);

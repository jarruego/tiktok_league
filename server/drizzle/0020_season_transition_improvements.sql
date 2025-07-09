-- Mejoras para el sistema de transición de temporadas

-- Verificar si la columna updated_at ya existe, si no, agregarla
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'team_league_assignments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE "team_league_assignments" 
        ADD COLUMN "updated_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

-- Agregar índices para mejorar performance de consultas de playoffs
CREATE INDEX IF NOT EXISTS "idx_matches_playoff" ON "matches" ("is_playoff", "season_id", "league_id");
CREATE INDEX IF NOT EXISTS "idx_matches_status_season" ON "matches" ("status", "season_id", "league_id");
CREATE INDEX IF NOT EXISTS "idx_standings_position" ON "standings" ("season_id", "league_id", "position");
CREATE INDEX IF NOT EXISTS "idx_team_assignments_season_flags" ON "team_league_assignments" ("season_id", "promoted_next_season", "relegated_next_season", "playoff_next_season");

-- Agregar comentarios a tablas para documentación
COMMENT ON TABLE "team_league_assignments" IS 'Asignaciones de equipos a ligas por temporada con información de transición';
COMMENT ON COLUMN "team_league_assignments"."promoted_next_season" IS 'Indica si el equipo asciende la próxima temporada';
COMMENT ON COLUMN "team_league_assignments"."relegated_next_season" IS 'Indica si el equipo desciende la próxima temporada';
COMMENT ON COLUMN "team_league_assignments"."playoff_next_season" IS 'Indica si el equipo juega playoff de ascenso';
COMMENT ON COLUMN "team_league_assignments"."qualified_for_tournament" IS 'Indica si el equipo se clasificó para torneos internacionales';

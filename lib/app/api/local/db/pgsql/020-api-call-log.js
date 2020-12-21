const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "api_call_load" (
    "method_id" TEXT NOT NULL,
    "user_id" INT4 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" TIMESTAMPTZ NOT NULL,
    "is_declined" BOOL NOT NULL
);

CREATE INDEX "api_call_load_started_idx" ON "api_call_load" ("started");

CREATE TABLE "api_call_log" (
    "method_id" TEXT NOT NULL,
    "user_id" INT4 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" TIMESTAMPTZ NOT NULL,
    "finished" TIMESTAMPTZ NOT NULL,
    "runtime" INT4 NOT NULL,
    "is_error" BOOL NOT NULL,
    "is_exception" BOOL NOT NULL,
    "status" INT2 NOT NULL,
    "reason" TEXT NOT NULL
);

CREATE INDEX "api_call_log_method_id_idx" ON "api_call_log" ("method_id");
CREATE INDEX "api_call_log_started_idx" ON "api_call_log" ("started");
CREATE INDEX "api_call_log_finished_idx" ON "api_call_log" ("finished");
CREATE INDEX "api_call_log_is_exception_idx" ON "api_call_log" ("is_exception");

CREATE VIEW "_api_call_log_methods" AS (
    SELECT "method_id" FROM "api_call_load"
    UNION
    SELECT "method_id" FROM "api_call_log"
);

CREATE MATERIALIZED VIEW "api_call_log_stat_60_min" AS (
    WITH
        "_api_call_log_load" AS (
            SELECT
                "method_id",
                TIME_BUCKET_GAPFILL(INTERVAL '1 minute', "started") AS "date",
                COUNT(NULLIF("is_declined", TRUE)) AS "total_accepted",
                COUNT(NULLIF("is_declined", FALSE)) AS "total_declined"
            FROM
                "api_call_load"
            WHERE
                "started" > NOW() - INTERVAL '30 days'
                AND "started" <= NOW()
            GROUP BY
                "method_id",
                "date"
            ORDER BY
                "date",
                "method_id"
        ),

        "_api_call_log_requests" AS (
            SELECT
                "method_id",
                TIME_BUCKET_GAPFILL(INTERVAL '1 minute', "finished") AS "date",
                COUNT(*) AS "total_requests",
                COUNT(NULLIF("is_exception", FALSE)) AS "total_exceptions",
                (AVG(runtime) / 1000)::DECIMAL(10, 2) AS "avg_runtime"
            FROM
                "api_call_log"
            WHERE
                "finished" > NOW() - INTERVAL '30 days'
                AND "finished" <= NOW()
            GROUP BY
                "method_id",
                "date"
            ORDER BY
                "date",
                "method_id"
        )
    SELECT
        "_api_call_log_methods"."method_id",
        CURRENT_TIMESTAMP AS "last_updated",
        (   SELECT JSON_AGG(JSON_BUILD_OBJECT(
                'date', "date",
                'total_accepted', "total_accepted",
                'total_declined', "total_declined"
            ))
            FROM
                "_api_call_log_load"
            WHERE
                "method_id" = "_api_call_log_methods"."method_id"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS "load",
        (   SELECT JSON_AGG(JSON_BUILD_OBJECT(
                'date', "date",
                'exceptions_percent', (("total_exceptions"::DECIMAL / NULLIF("total_requests", 0)) * 100)::DECIMAL(5, 2),
                'avg_runtime', "avg_runtime"
            ))
            FROM
                "_api_call_log_requests"
            WHERE
                "method_id" = "_api_call_log_methods"."method_id"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS "requests"
    FROM
        "_api_call_log_methods"
);

CREATE UNIQUE INDEX "api_call_log_stat_60_min_id_idx" ON "api_call_log_stat_60_min" ("method_id");

CREATE MATERIALIZED VIEW "api_call_log_stat_30_days" AS (
    WITH
        "_api_call_log_load" AS (
            SELECT
                "method_id",
                TIME_BUCKET_GAPFILL(INTERVAL '10 minutes', "started") AS "date",
                COUNT(NULLIF("is_declined", TRUE)) AS "total_accepted",
                COUNT(NULLIF("is_declined", FALSE)) AS "total_declined"
            FROM
                "api_call_load"
            WHERE
                "started" > NOW() - INTERVAL '30 days'
                AND "started" <= NOW()
            GROUP BY
                "method_id",
                "date"
            ORDER BY
                "date",
                "method_id"
        ),

        "_api_call_log_requests" AS (
            SELECT
                "method_id",
                TIME_BUCKET_GAPFILL(INTERVAL '10 minutes', "finished") AS "date",
                COUNT(*) AS "total_requests",
                COUNT(NULLIF("is_exception", FALSE)) AS "total_exceptions",
                (AVG(runtime) / 1000)::DECIMAL(10, 2) AS "avg_runtime"
            FROM
                "api_call_log"
            WHERE
                "finished" > NOW() - INTERVAL '30 days'
                AND "finished" <= NOW()
            GROUP BY
                "method_id",
                "date"
            ORDER BY
                "date",
                "method_id"
        )
    SELECT
        "_api_call_log_methods"."method_id",
        CURRENT_TIMESTAMP AS "last_updated",
        (   SELECT JSON_AGG(JSON_BUILD_OBJECT(
                'date', "date",
                'total_accepted', "total_accepted",
                'total_declined', "total_declined"
            ))
            FROM
                "_api_call_log_load"
            WHERE
                "method_id" = "_api_call_log_methods"."method_id"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS "load",
        (   SELECT JSON_AGG(JSON_BUILD_OBJECT(
                'date', "date",
                'exceptions_percent', (("total_exceptions"::DECIMAL / NULLIF("total_requests", 0)) * 100)::DECIMAL(5, 2),
                'avg_runtime', "avg_runtime"
            ))
            FROM
                "_api_call_log_requests"
            WHERE
                "method_id" = "_api_call_log_methods"."method_id"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS "requests"
    FROM
        "_api_call_log_methods"
);

CREATE UNIQUE INDEX "api_call_log_stat_30_days_id_idx" ON "api_call_log_stat_30_days" ("method_id");

`;

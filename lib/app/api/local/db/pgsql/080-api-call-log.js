const sql = require( "@softvisio/core/sql" );

module.exports = sql`

CREATE TABLE "api_call_load" (
    "method_id" text NOT NULL,
    "user_id" int8 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" timestamptz NOT NULL,
    "is_declined" bool NOT NULL
);

CREATE INDEX "api_call_load_started_idx" ON "api_call_load" ("started");

CREATE TABLE "api_call_log" (
    "method_id" text NOT NULL,
    "user_id" int8 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" timestamptz NOT NULL,
    "finished" timestamptz NOT NULL,
    "runtime" int4 NOT NULL,
    "is_error" bool NOT NULL,
    "is_exception" bool NOT NULL,
    "status" int2 NOT NULL,
    "reason" text NOT NULL
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
                time_bucket_gapfill(INTERVAL '1 minute', "started") AS "date",
                count(NULLIF("is_declined", TRUE)) AS "total_accepted",
                count(NULLIF("is_declined", FALSE)) AS "total_declined"
            FROM
                "api_call_load"
            WHERE
                "started" > now() - INTERVAL '30 days'
                AND "started" <= now()
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
                time_bucket_gapfill(INTERVAL '1 minute', "finished") AS "date",
                count(*) AS "total_requests",
                count(NULLIF("is_exception", FALSE)) AS "total_exceptions",
                (avg(runtime) / 1000)::decimal(10, 2) AS "avg_runtime"
            FROM
                "api_call_log"
            WHERE
                "finished" > now() - INTERVAL '30 days'
                AND "finished" <= now()
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
        (   SELECT json_agg(json_build_object(
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
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'exceptions_percent', (("total_exceptions"::decimal / NULLIF("total_requests", 0)) * 100)::decimal(5, 2),
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
                time_bucket_gapfill(INTERVAL '10 minutes', "started") AS "date",
                count(NULLIF("is_declined", TRUE)) AS "total_accepted",
                count(NULLIF("is_declined", FALSE)) AS "total_declined"
            FROM
                "api_call_load"
            WHERE
                "started" > now() - INTERVAL '30 days'
                AND "started" <= now()
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
                time_bucket_gapfill(INTERVAL '10 minutes', "finished") AS "date",
                count(*) AS "total_requests",
                count(NULLIF("is_exception", FALSE)) AS "total_exceptions",
                (avg(runtime) / 1000)::decimal(10, 2) AS "avg_runtime"
            FROM
                "api_call_log"
            WHERE
                "finished" > now() - INTERVAL '30 days'
                AND "finished" <= now()
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
        (   SELECT json_agg(json_build_object(
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
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'exceptions_percent', (("total_exceptions"::decimal / NULLIF("total_requests", 0)) * 100)::decimal(5, 2),
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

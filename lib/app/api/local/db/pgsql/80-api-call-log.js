import sql from "#lib/sql";

export default sql`

CREATE TABLE "apiCallLoad" (
    "methodId" text NOT NULL,
    "userId" int8 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" timestamptz NOT NULL,
    "isDeclined" bool NOT NULL
);

CREATE INDEX "apiCallLoad_started_idx" ON "apiCallLoad" ("started");

CREATE TABLE "apiCallLog" (
    "methodId" text NOT NULL,
    "userId" int8 REFERENCES "user" ("id") ON DELETE RESTRICT,
    "started" timestamptz NOT NULL,
    "finished" timestamptz NOT NULL,
    "runtime" int4 NOT NULL,
    "isError" bool NOT NULL,
    "isException" bool NOT NULL,
    "status" int2 NOT NULL,
    "status_text" text NOT NULL
);

CREATE INDEX "apiCallLog_methodId_idx" ON "apiCallLog" ("methodId");
CREATE INDEX "apiCallLog_started_idx" ON "apiCallLog" ("started");
CREATE INDEX "apiCallLog_finished_idx" ON "apiCallLog" ("finished");
CREATE INDEX "apiCallLog_isException_idx" ON "apiCallLog" ("isException");

CREATE VIEW "_apiCallLogMethods" AS (
    SELECT "methodId" FROM "apiCallLoad"
    UNION
    SELECT "methodId" FROM "apiCallLog"
);

CREATE MATERIALIZED VIEW "apiCallLogStat60Min" AS (
    WITH
        "_apiCallLogLoad" AS (
            SELECT
                "methodId",
                time_bucket_gapfill(INTERVAL '1 minute', "started") AS "date",
                count(NULLIF("isDeclined", TRUE)) AS "totalAccepted",
                count(NULLIF("isDeclined", FALSE)) AS "totalDeclined"
            FROM
                "apiCallLoad"
            WHERE
                "started" > now() - INTERVAL '30 days'
                AND "started" <= now()
            GROUP BY
                "methodId",
                "date"
            ORDER BY
                "date",
                "methodId"
        ),

        "_apiCallLogRequests" AS (
            SELECT
                "methodId",
                time_bucket_gapfill(INTERVAL '1 minute', "finished") AS "date",
                count(*) AS "totalRequests",
                count(NULLIF("isException", FALSE)) AS "totalExceptions",
                (avg(runtime) / 1000)::numeric(10, 2) AS "avgRuntime"
            FROM
                "apiCallLog"
            WHERE
                "finished" > now() - INTERVAL '30 days'
                AND "finished" <= now()
            GROUP BY
                "methodId",
                "date"
            ORDER BY
                "date",
                "methodId"
        )
    SELECT
        "_apiCallLogMethods"."methodId",
        CURRENT_TIMESTAMP AS "lastUpdated",
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'totalAccepted', "totalAccepted",
                'totalDeclined', "totalDeclined"
            ))
            FROM
                "_apiCallLogLoad"
            WHERE
                "methodId" = "_apiCallLogMethods"."methodId"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS "load",
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'exceptions_percent', (("totalExceptions"::numeric / NULLIF("totalRequests", 0)) * 100)::numeric(5, 2),
                'avgRuntime', "avgRuntime"
            ))
            FROM
                "_apiCallLogRequests"
            WHERE
                "methodId" = "_apiCallLogMethods"."methodId"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '60 minutes'
        ) AS "requests"
    FROM
        "_apiCallLogMethods"
);

CREATE UNIQUE INDEX "apiCallLogStat60Min_methodId_idx" ON "apiCallLogStat60Min" ("methodId");

CREATE MATERIALIZED VIEW "apiCallLogStat30Days" AS (
    WITH
        "_apiCallLogLoad" AS (
            SELECT
                "methodId",
                time_bucket_gapfill(INTERVAL '10 minutes', "started") AS "date",
                count(NULLIF("isDeclined", TRUE)) AS "totalAccepted",
                count(NULLIF("isDeclined", FALSE)) AS "totalDeclined"
            FROM
                "apiCallLoad"
            WHERE
                "started" > now() - INTERVAL '30 days'
                AND "started" <= now()
            GROUP BY
                "methodId",
                "date"
            ORDER BY
                "date",
                "methodId"
        ),

        "_apiCallLogRequests" AS (
            SELECT
                "methodId",
                time_bucket_gapfill(INTERVAL '10 minutes', "finished") AS "date",
                count(*) AS "totalRequests",
                count(NULLIF("isException", FALSE)) AS "totalExceptions",
                (avg(runtime) / 1000)::numeric(10, 2) AS "avgRuntime"
            FROM
                "apiCallLog"
            WHERE
                "finished" > now() - INTERVAL '30 days'
                AND "finished" <= now()
            GROUP BY
                "methodId",
                "date"
            ORDER BY
                "date",
                "methodId"
        )
    SELECT
        "_apiCallLogMethods"."methodId",
        CURRENT_TIMESTAMP AS "lastUpdated",
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'totalAccepted', "totalAccepted",
                'totalDeclined', "totalDeclined"
            ))
            FROM
                "_apiCallLogLoad"
            WHERE
                "methodId" = "_apiCallLogMethods"."methodId"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS "load",
        (   SELECT json_agg(json_build_object(
                'date', "date",
                'exceptionsPercent', (("totalExceptions"::numeric / NULLIF("totalRequests", 0)) * 100)::numeric(5, 2),
                'avgRuntime', "avgRuntime"
            ))
            FROM
                "_apiCallLogRequests"
            WHERE
                "methodId" = "_apiCallLogMethods"."methodId"
                AND "date" >= CURRENT_TIMESTAMP - INTERVAL '30 days'
        ) AS "requests"
    FROM
        "_apiCallLogMethods"
);

CREATE UNIQUE INDEX "apiCallLogStat30Days_methodId_idx" ON "apiCallLogStat30Days" ("methodId");

`;

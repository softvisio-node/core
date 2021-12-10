export default {
    "reservedEvents": new Set( [

        // events
        "newListener",
        "removeListener",

        // dbh
        "connect",
        "disconnect",
        "destroy",
        "idle",
    ] ),

    "locks": {
        "migration": -1,
        "cron": -2,
    },
};

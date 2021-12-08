export default {
    "reservedEvents": new Set( [

        // events
        "newListener",
        "removeListener",

        // dbh
        "connect",
        "disconnect",
        "destroy",
        "release",
        "idle",
    ] ),

    "migrationTableName": "_schema",
};

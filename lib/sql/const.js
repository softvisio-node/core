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

    "migrationTableName": "_schema",
};

import _CLI from "#lib/cli";

export default class CLI extends _CLI {
    static parse ( spec ) {
        if ( spec.cli && typeof spec.cli === "function" ) spec = spec.cli();

        if ( !spec.options ) spec.options = {};

        spec.options.mode = {
            "summary": `Set application mode. Set NODE_ENV variable. Allowed values: "production", "development", "test"`,
            "default": "production",
            "schema": {
                "type": "string",
                "enum": ["production", "development", "test"],
            },
        };

        spec.options["reset-settings"] = {
            "short": false,
            "summary": `Update application settings from the ".env" files and exit.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        spec.options["reset-root"] = {
            "short": false,
            "summary": `Set root password from the ".env" files and exit. If root password is not defined in environment it will be randomly generated.`,
            "default": false,
            "schema": {
                "type": "boolean",
            },
        };

        super.parse( spec );
    }
}

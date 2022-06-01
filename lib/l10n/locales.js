import { readConfig } from "#lib/config";

export default readConfig( "#resources/locales.yaml", { "resolve": import.meta.url } );

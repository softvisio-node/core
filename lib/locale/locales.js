import { readConfig } from "#lib/config";

const locales = readConfig( "#resources/locales.yaml", { "resolve": import.meta.url } );

export default locales;

// compile plural expressions
for ( const language in locales ) {
    if ( locales[language].expression ) locales[language].function = eval( `n => ${locales[language].expression}` );
}

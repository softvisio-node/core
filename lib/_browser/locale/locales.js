import locales from "#resources/locales.yaml";

export default locales;

// compile plural expressions
for ( const language in locales ) {
    if ( locales[language].expression ) locales[language].function = eval( `n => ${locales[language].expression}` );
}

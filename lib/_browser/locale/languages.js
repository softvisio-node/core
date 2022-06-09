import languages from "#resources/languages.yaml";

export default languages;

// compile plural expressions
for ( const language in languages ) {
    languages[language].id = language;

    if ( languages[language].expression ) languages[language].function = eval( `n => ${languages[language].expression}` );
}

import ansi from "#lib/ansi";

export function prepareHeader ( header ) {
    ansi.setEnabled( process.stdout, () => {
        header = ansi.bold.underline( header + ":" );
    } );

    return header;
}

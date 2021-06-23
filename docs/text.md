# Text

## Class: ANSI

## Class: Table

Draw text table.

```javascript
import Table from "@softvisio/core/text/table";

const table = new Table({});

table.begin();

table.add(row1, row2);

table.end();
```

### Table.defineStyle(name, style)

-   `name` <string\> New style name.
-   `style` <Object\> Style definition:
    -   `topLine` <string\> Top line style.
    -   `headerRow` <string\> Header row style.
    -   `headerLine` <string\> Header line style.
    -   `dataRow` <string\> Data row style.
    -   `dataLine` <string\> Data line style.
    -   `bottomLine` <string\> Bottom line style.

Define table style. Example of `ascii` style definition:

<!-- prettier-ignore -->
```javascript
Table.defineStyle("ascii", {
    topLine:    "+-++",
    headerRow:  "| ||",
    headerLine: "|=+|",
    dataRow:    "| ||",
    dataLine:   "|-+|",
    bottomLine: "+-++",
});
```

### new Table([options])

-   `options` <Object\> Table options:
    -   `style` <"ascii" | "unicode" | "markdown" | "compact" | "borderless"> Table style. **Default:** `"ascii"`.
    -   `console` <boolean\> Output table content to the console.
    -   `ansi` <boolean\> Allow ANSI escape codes in the output.
    -   `width` <integer\> Table width. If `console` set to `true` terminal width is used as default value. **Default:** `80`.
    -   `lazy` <boolean\> Render table header on first row added.
    -   `header` <boolean\> Render table header. **Default:** `true`.
    -   `columnWidth?` <integer\> Default column width.
    -   `margin` <integer[]\> Default column margin. Should be specified as [leftMargin, rightMargin]. **Default:** `[0, 0]`.
    -   `trim` <boolean\> Trim cell content.
    -   `wordWrap` <boolean\> Split words at spaces. **Default:** `true`.
    -   `columns` <Object\> Table columns:
        -   `width?` <integer\> Column width.
        -   `minWidth?` <integer\> Minimal column width.
        -   `flex` <integer\> Column flex.
        -   `title` <string\> Column title.
        -   `margin` <Array\> Column margin. Should be specified as [leftMargin, rightMargin]. **Default:** `[0, 0]`.
        -   `trim` <boolean\> Trim cell content.
        -   `wordWrap` <boolean\> Split words at spaces. **Default:** `true`.
        -   `align` <"left" | "right"> Cell content horizontal align.
        -   `headerAlign` <"left" | "right"> Column header cell content horizontal align.
        -   `valign` <"left" | "right"> Cell content vertical align.
        -   `headerValign` <"left" | "right"> Column header cell content vertical align.
-   Returns: <Table\>

### table.hasContent

-   <boolean\>

`true` if table has some content.

### table.text

-   <string\>

Table content.

### table.begin()

-   Returns: <string\> Rendered table heade.

Render table header.

### table.add(...rows)

-   `...rows` <Array\> | <Object\> Rows to add.
-   Returns: <string\> Rendered rows.

Add rows to the table.

### table.end()

-   Returns: <string\> Rendered table bottom line.

Render bottom line.

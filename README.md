# semo-plugin-markmap

This is a tool to convert markdown to mindmap, based on [markmap](https://github.com/gera2ld/markmap), what I have done is to add his toolbar package to command.

## Usage

### Basic

```
npm i -g @semo/cli semo-plugin-markmap
semo markmap test.md
semo mm test.md
```

### Url

```
semo mm https://raw.githubusercontent.com/semojs/semo-plugin-markmap/master/test.md
```

### Pipe

```
echo "# abc" | semo mm
```

## Shortcuts

- `space`: fit window in center in case you move or zoom it.
- `0`: hide all except the central one.
- `9`: show all.
- `1`: expand to level 1.
- `2`: expand to level 2.
- `3`: expand to level 3.
- `+`: zoomIn
- `-`: zoomOut
- `ESC`: close the mindmap fullscreen mode.
- `f`: toggle fullscreen mode.

## Licence

MIT
